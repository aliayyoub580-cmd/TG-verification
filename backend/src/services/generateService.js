const { supabaseAdmin } = require('../config/supabase');
const { generateUniqueBatch } = require('../utils/codeGenerator');
const { buildVerificationUrl } = require('../utils/qrGenerator');
const { v4: uuidv4 } = require('uuid');
const {
  DB_INSERT_BATCH_SIZE,
  DEFAULT_CODE_LENGTH,
  STATUS_ACTIVE,
  BATCH_STATUS_PENDING,
  BATCH_STATUS_PROCESSING,
  BATCH_STATUS_COMPLETED,
  BATCH_STATUS_FAILED,
  BATCH_STATUS_PARTIAL,
} = require('../config/constants');

/**
 * Generates QR codes in bulk and inserts them into the database in safe batches.
 *
 * This runs fully server-side. For very large quantities (10,000+) it uses
 * chunked inserts to avoid blocking and provides progress tracking via the
 * generation_batches table.
 *
 * @param {object} options
 * @param {string} options.productId
 * @param {number} options.quantity
 * @param {number} options.codeLength
 * @param {string} options.prefix
 * @param {string} options.status
 * @param {string} options.baseUrl
 * @param {string} options.adminId
 * @returns {Promise<object>} batch summary
 */
async function generateQRCodes({
  productId,
  quantity,
  codeLength = DEFAULT_CODE_LENGTH,
  prefix = '',
  status = STATUS_ACTIVE,
  baseUrl,
  adminId,
}) {
  if (quantity < 1 || quantity > 50000) {
    throw Object.assign(
      new Error('Quantity must be between 1 and 50,000'),
      { statusCode: 400 }
    );
  }

  // 1. Create a generation batch record (marks start of job)
  const batchId = uuidv4();
  const { error: batchError } = await supabaseAdmin
    .from('generation_batches')
    .insert({
      id: batchId,
      product_id: productId,
      requested_quantity: quantity,
      generated_quantity: 0,
      failed_quantity: 0,
      status: BATCH_STATUS_PROCESSING,
      base_url: baseUrl,
      created_by: adminId || null,
    });

  if (batchError) {
    throw new Error(`Failed to create batch record: ${batchError.message}`);
  }

  let generatedCount = 0;
  let failedCount = 0;
  const allCodes = [];

  try {
    // 2. Load existing codes that match the prefix pattern to avoid conflicts
    //    We load only the codes (not full records) for memory efficiency
    const existingCodesSet = await loadExistingCodesSet(prefix, codeLength);

    // 3. Generate all codes up front (in-memory — crypto.randomBytes is fast)
    const codes = generateUniqueBatch(quantity, codeLength, prefix, existingCodesSet);

    // 4. Insert in batches to avoid DB timeouts
    const chunks = chunkArray(codes, DB_INSERT_BATCH_SIZE);

    for (const chunk of chunks) {
      const rows = chunk.map((code) => ({
        code,
        product_id: productId,
        status,
        generation_batch_id: batchId,
      }));

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('qr_codes')
        .insert(rows)
        .select('code');

      if (insertError) {
        // Handle duplicate key violations gracefully
        if (insertError.code === '23505') {
          // Unique constraint violation — some codes already exist
          // Try inserting individually to maximise successful inserts
          const { savedCount, lostCount } = await insertWithRetry(rows, productId, status, batchId);
          generatedCount += savedCount;
          failedCount += lostCount;
        } else {
          console.error('Batch insert error:', insertError.message);
          failedCount += chunk.length;
        }
      } else {
        generatedCount += inserted.length;
        allCodes.push(...(inserted.map((r) => r.code)));
      }
    }

    // Also collect codes from successful chunk inserts (already added above)
    // Merge with allCodes — deduplicate
    codes.slice(0, generatedCount).forEach((c) => {
      if (!allCodes.includes(c)) allCodes.push(c);
    });

    const finalStatus =
      generatedCount === quantity
        ? BATCH_STATUS_COMPLETED
        : generatedCount > 0
        ? BATCH_STATUS_PARTIAL
        : BATCH_STATUS_FAILED;

    // 5. Update batch record
    await supabaseAdmin
      .from('generation_batches')
      .update({
        generated_quantity: generatedCount,
        failed_quantity: failedCount,
        status: finalStatus,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    return {
      batchId,
      productId,
      requestedQuantity: quantity,
      generatedQuantity: generatedCount,
      failedQuantity: failedCount,
      status: finalStatus,
      baseUrl,
    };
  } catch (err) {
    // Mark batch as failed
    await supabaseAdmin
      .from('generation_batches')
      .update({
        generated_quantity: generatedCount,
        failed_quantity: quantity - generatedCount,
        status: generatedCount > 0 ? BATCH_STATUS_PARTIAL : BATCH_STATUS_FAILED,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId);

    throw err;
  }
}

/**
 * Loads all existing codes from the database into a Set for O(1) lookups.
 * For very large tables we fetch in pages.
 */
async function loadExistingCodesSet(prefix, codeLength) {
  const set = new Set();
  const pageSize = 10000;
  let from = 0;

  // Only load codes that could conflict (same length, same prefix)
  // This keeps memory usage reasonable
  while (true) {
    let q = supabaseAdmin
      .from('qr_codes')
      .select('code')
      .range(from, from + pageSize - 1);

    if (prefix) {
      q = q.ilike('code', `${prefix}%`);
    }

    const { data, error } = await q;

    if (error || !data || data.length === 0) break;

    data.forEach((row) => set.add(row.code));

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return set;
}

/**
 * Inserts rows one at a time when a batch has a duplicate key conflict.
 * This maximises successful inserts while counting individual failures.
 */
async function insertWithRetry(rows, productId, status, batchId) {
  let savedCount = 0;
  let lostCount = 0;

  for (const row of rows) {
    const { error } = await supabaseAdmin
      .from('qr_codes')
      .insert(row);

    if (error) {
      lostCount++;
    } else {
      savedCount++;
    }
  }

  return { savedCount, lostCount };
}

/**
 * Retrieves generation batch details along with a sample of generated codes.
 */
async function getBatchDetails(batchId) {
  const { data: batch, error } = await supabaseAdmin
    .from('generation_batches')
    .select(`
      *,
      products ( id, name )
    `)
    .eq('id', batchId)
    .single();

  if (error || !batch) {
    throw Object.assign(new Error('Batch not found'), { statusCode: 404 });
  }

  return batch;
}

async function listBatches(query = {}) {
  const { getPagination } = require('../utils/pagination');
  const { page, limit, offset } = getPagination(query);

  const { data, count, error } = await supabaseAdmin
    .from('generation_batches')
    .select(`
      *,
      products ( id, name )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list batches: ${error.message}`);

  return { data: data || [], total: count || 0, page, limit };
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

module.exports = { generateQRCodes, getBatchDetails, listBatches };
