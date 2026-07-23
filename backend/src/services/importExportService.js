const { supabaseAdmin } = require('../config/supabase');
const { parseCSVBuffer, objectsToCSV, normalizeCode } = require('../utils/csvUtils');
const { CSV_IMPORT_BATCH_SIZE, MAX_CSV_ROWS, STATUS_ACTIVE, STATUS_INACTIVE } = require('../config/constants');

// ─── EXPORT ───────────────────────────────────────────────────────────────────

const CSV_COLUMNS = ['code', 'batch_number', 'status'];

function batchNumberMigrationError() {
  return Object.assign(
    new Error(
      'Database update required: run backend/database/migrations/004_qr_code_batch_number.sql in the Supabase SQL Editor, then retry.'
    ),
    { statusCode: 503 }
  );
}

async function ensureBatchNumberColumn() {
  const { error } = await supabaseAdmin
    .from('qr_codes')
    .select('batch_number')
    .limit(0);

  if (error) {
    if (error.message?.includes('batch_number')) throw batchNumberMigrationError();
    throw new Error(`Database check failed: ${error.message}`);
  }
}

/**
 * Exports QR codes to CSV string.
 *
 * @param {object} filters - { status, product_id, ids, batch_id }
 * @param {string} baseUrl
 * @returns {Promise<string>} CSV content
 */
async function exportQRCodes(filters = {}) {
  await ensureBatchNumberColumn();
  const { status, product_id, ids, batch_id } = filters;

  let q = supabaseAdmin
    .from('qr_codes')
    .select(`
      code,
      status,
      batch_number
    `)
    .order('created_at', { ascending: false });

  if (status) q = q.eq('status', status);
  if (product_id) q = q.eq('product_id', product_id);
  if (batch_id) q = q.eq('generation_batch_id', batch_id);
  if (ids && ids.length > 0) q = q.in('id', ids);

  // Fetch all (no range) — for large exports use streaming in the future
  const { data, error } = await q;

  if (error) throw new Error(`Export failed: ${error.message}`);

  const records = (data || []).map((row) => ({
    code: row.code,
    batch_number: row.batch_number || '',
    status: row.status,
  }));

  return objectsToCSV(records, CSV_COLUMNS);
}

// ─── IMPORT ───────────────────────────────────────────────────────────────────

/**
 * Previews a CSV import without committing to the database.
 * Returns: { valid, duplicatesInFile, duplicatesInDB, invalid, sample }
 */
async function previewCSVImport(buffer) {
  const { records, errors } = await parseCSVBuffer(buffer, CSV_COLUMNS);

  if (errors.length > 0) {
    throw Object.assign(new Error(errors.join('; ')), { statusCode: 422 });
  }

  if (records.length > MAX_CSV_ROWS) {
    throw Object.assign(
      new Error(`CSV has ${records.length} rows. Maximum allowed is ${MAX_CSV_ROWS}.`),
      { statusCode: 413 }
    );
  }

  const seenInFile = new Set();
  const duplicatesInFile = [];
  const invalid = [];
  const valid = [];

  for (const row of records) {
    const code = normalizeCode(row.code);
    const rowIdx = row._rowIndex;

    if (!code) {
      invalid.push({ row: rowIdx, code: row.code, reason: 'Empty code' });
      continue;
    }

    if (code.length < 4 || code.length > 64) {
      invalid.push({ row: rowIdx, code, reason: 'Invalid code length' });
      continue;
    }

    const batchNumber = String(row.batch_number || '').trim();
    if (!batchNumber) {
      invalid.push({ row: rowIdx, code, reason: 'Missing batch_number' });
      continue;
    }

    const status = (row.status || STATUS_ACTIVE).toLowerCase();
    if (![STATUS_ACTIVE, STATUS_INACTIVE].includes(status)) {
      invalid.push({ row: rowIdx, code, reason: `Invalid status: ${row.status}` });
      continue;
    }

    if (seenInFile.has(code)) {
      duplicatesInFile.push({ row: rowIdx, code, reason: 'Duplicate within file' });
      continue;
    }

    seenInFile.add(code);
    valid.push({ row: rowIdx, code, batch_number: batchNumber, status });
  }

  // Check which valid codes already exist in the DB
  const validCodes = valid.map((r) => r.code);
  const dbDuplicates = await findExistingCodes(validCodes);
  const dbDuplicateSet = new Set(dbDuplicates.map((r) => r.code));

  const duplicatesInDB = valid
    .filter((r) => dbDuplicateSet.has(r.code))
    .map((r) => ({ ...r, reason: 'Already exists in database' }));

  const importReady = valid.filter((r) => !dbDuplicateSet.has(r.code));

  return {
    totalRows: records.length,
    importReady: importReady.length,
    duplicatesInFile: duplicatesInFile.length,
    duplicatesInDB: duplicatesInDB.length,
    invalid: invalid.length,
    sample: importReady.slice(0, 5),
    details: {
      duplicatesInFile,
      duplicatesInDB,
      invalid,
    },
  };
}

/**
 * Imports valid codes from a CSV buffer into the database.
 *
 * @param {Buffer} buffer
 * @param {boolean} skipDuplicates - If true, skip DB duplicates; if false, treat them as errors
 * @returns {Promise<object>} { imported, skipped, failed, errors }
 */
async function importCSV(buffer, skipDuplicates = true) {
  await ensureBatchNumberColumn();
  const { records, errors: parseErrors } = await parseCSVBuffer(buffer, CSV_COLUMNS);

  if (parseErrors.length > 0) {
    throw Object.assign(new Error(parseErrors.join('; ')), { statusCode: 422 });
  }

  if (records.length > MAX_CSV_ROWS) {
    throw Object.assign(
      new Error(`File exceeds maximum of ${MAX_CSV_ROWS} rows`),
      { statusCode: 413 }
    );
  }

  const seenInFile = new Set();
  const toInsert = [];
  const skipped = [];
  const failed = [];

  // First pass — validate and deduplicate within file
  for (const row of records) {
    const code = normalizeCode(row.code);
    const rowIdx = row._rowIndex;

    if (!code || code.length < 4 || code.length > 64) {
      failed.push({ row: rowIdx, code: row.code || '', reason: 'Invalid code' });
      continue;
    }

    const batchNumber = String(row.batch_number || '').trim();
    if (!batchNumber) {
      failed.push({ row: rowIdx, code, reason: 'Missing batch_number' });
      continue;
    }

    const status = (row.status || STATUS_ACTIVE).toLowerCase();
    if (![STATUS_ACTIVE, STATUS_INACTIVE].includes(status)) {
      failed.push({ row: rowIdx, code, reason: `Invalid status: "${row.status}"` });
      continue;
    }

    if (seenInFile.has(code)) {
      skipped.push({ row: rowIdx, code, reason: 'Duplicate within file' });
      continue;
    }

    seenInFile.add(code);
    toInsert.push({ row: rowIdx, code, batch_number: batchNumber, status });
  }

  // Check DB duplicates
  const allCodesToCheck = toInsert.map((r) => r.code);
  const dbDuplicates = await findExistingCodes(allCodesToCheck);
  const dbDupSet = new Set(dbDuplicates.map((r) => r.code));

  const finalInsert = [];
  for (const record of toInsert) {
    if (dbDupSet.has(record.code)) {
      if (skipDuplicates) {
        skipped.push({ row: record.row, code: record.code, reason: 'Already in database' });
      } else if (error.message?.includes('batch_number')) {
        throw batchNumberMigrationError();
      } else {
        failed.push({ row: record.row, code: record.code, reason: 'Already in database' });
      }
    } else {
      finalInsert.push(record);
    }
  }

  // Batch insert
  let importedCount = 0;
  const chunks = chunkArray(finalInsert, CSV_IMPORT_BATCH_SIZE);

  for (const chunk of chunks) {
    const rows = chunk.map((r) => ({
      code: r.code,
      batch_number: r.batch_number,
      status: r.status,
    }));

    const { error } = await supabaseAdmin.from('qr_codes').insert(rows);

    if (error) {
      if (error.code === '23505') {
        // Some in this chunk were inserted between our check and insert — retry individually
        for (const row of rows) {
          const { error: singleErr } = await supabaseAdmin.from('qr_codes').insert(row);
          if (singleErr) {
            const original = chunk.find((r) => r.code === row.code);
            failed.push({ row: original?.row, code: row.code, reason: 'Duplicate (race condition)' });
          } else {
            importedCount++;
          }
        }
      } else {
        chunk.forEach((r) => failed.push({ row: r.row, code: r.code, reason: error.message }));
      }
    } else {
      importedCount += chunk.length;
    }
  }

  return {
    imported: importedCount,
    skipped: skipped.length,
    failed: failed.length,
    details: { skipped, failed },
  };
}

/**
 * Generates a downloadable CSV template buffer.
 */
function getCSVTemplate() {
  const header = 'code,batch_number,status\n';
  const example = 'AFMU000SZQ,batch-2,active\n';
  return Buffer.from(header + example, 'utf8');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function findExistingCodes(codes) {
  if (!codes || codes.length === 0) return [];

  // Fetch in chunks to avoid query size limits
  const results = [];
  const chunks = chunkArray(codes, 500);

  for (const chunk of chunks) {
    const { data } = await supabaseAdmin
      .from('qr_codes')
      .select('code')
      .in('code', chunk);

    if (data) results.push(...data);
  }

  return results;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

module.exports = { exportQRCodes, previewCSVImport, importCSV, getCSVTemplate };
