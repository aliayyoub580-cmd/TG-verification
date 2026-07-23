const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { parseCSVBuffer, objectsToCSV, normalizeCode, codeLookupKey } = require('../utils/csvUtils');
const { CSV_IMPORT_BATCH_SIZE, MAX_CSV_ROWS, STATUS_ACTIVE } = require('../config/constants');

async function assertProduct(productId) {
  if (!productId) throw Object.assign(new Error('Select a product before importing'), { statusCode: 400 });
  const { data, error } = await supabaseAdmin.from('products').select('id, name').eq('id', productId).single();
  if (error || !data) throw Object.assign(new Error('Selected product was not found'), { statusCode: 404 });
  return data;
}

async function analyzeCSV(buffer) {
  const { records, errors } = await parseCSVBuffer(buffer, ['code']);
  if (errors.length) throw Object.assign(new Error(errors.join('; ')), { statusCode: 422 });
  if (records.length > MAX_CSV_ROWS) throw Object.assign(new Error(`CSV has ${records.length} rows. Maximum allowed is ${MAX_CSV_ROWS}.`), { statusCode: 413 });

  const seen = new Set();
  const valid = [];
  const duplicatesInFile = [];
  const invalid = [];
  for (const row of records) {
    const code = normalizeCode(row.code);
    const key = codeLookupKey(code);
    if (!code) invalid.push({ row: row._rowIndex, code: '', reason: 'Empty code' });
    else if (code.length < 4 || code.length > 64) invalid.push({ row: row._rowIndex, code, reason: 'Code must be 4 to 64 characters' });
    else if (seen.has(key)) duplicatesInFile.push({ row: row._rowIndex, code, reason: 'Duplicate within CSV' });
    else { seen.add(key); valid.push({ row: row._rowIndex, code, code_normalized: key }); }
  }

  const existing = await findExistingCodes(valid.map((r) => r.code_normalized));
  const existingKeys = new Set(existing.map((r) => r.code_normalized));
  const duplicatesInDB = valid.filter((r) => existingKeys.has(r.code_normalized)).map((r) => ({ ...r, reason: 'Already in database' }));
  const importReady = valid.filter((r) => !existingKeys.has(r.code_normalized));
  return { records, importReady, duplicatesInFile, duplicatesInDB, invalid };
}

async function previewCSVImport(buffer, productId) {
  const product = await assertProduct(productId);
  const a = await analyzeCSV(buffer);
  return {
    product: { name: product.name }, totalRows: a.records.length, importReady: a.importReady.length,
    duplicatesInFile: a.duplicatesInFile.length, duplicatesInDB: a.duplicatesInDB.length,
    invalid: a.invalid.length, sample: a.importReady.slice(0, 10),
    details: { duplicatesInFile: a.duplicatesInFile, duplicatesInDB: a.duplicatesInDB, invalid: a.invalid },
  };
}

async function importCSV(buffer, { productId, fileName, adminId }) {
  const product = await assertProduct(productId);
  const a = await analyzeCSV(buffer);
  const batchId = uuidv4();
  let imported = 0;
  const failed = [];

  await supabaseAdmin.from('import_batches').insert({
    id: batchId, product_id: productId, file_name: fileName || 'codes.csv', total_codes: a.records.length,
    duplicate_codes: a.duplicatesInFile.length + a.duplicatesInDB.length,
    failed_codes: a.invalid.length, imported_by: adminId || null,
  }).then(({ error }) => { if (error) throw new Error(`Could not create import batch: ${error.message}`); });

  for (const chunk of chunkArray(a.importReady, CSV_IMPORT_BATCH_SIZE)) {
    const rows = chunk.map((r) => ({ code: r.code, code_normalized: r.code_normalized, product_id: productId,
      status: STATUS_ACTIVE, qr_generated: false, qr_generation_state: 'pending', imported_at: new Date().toISOString(), imported_batch_id: batchId }));
    const { data, error } = await supabaseAdmin.from('qr_codes').insert(rows).select('id');
    if (!error) imported += data?.length || rows.length;
    else {
      for (let i = 0; i < rows.length; i++) {
        const { error: rowError } = await supabaseAdmin.from('qr_codes').insert(rows[i]);
        if (rowError) failed.push({ row: chunk[i].row, code: chunk[i].code, reason: rowError.code === '23505' ? 'Already in database' : 'Import failed' });
        else imported++;
      }
    }
  }

  await supabaseAdmin.from('import_batches').update({ successful_codes: imported,
    duplicate_codes: a.duplicatesInFile.length + a.duplicatesInDB.length,
    failed_codes: a.invalid.length + failed.length }).eq('id', batchId);

  return { batchId, productName: product.name, total: a.records.length, imported,
    duplicateInCSV: a.duplicatesInFile.length, alreadyInDatabase: a.duplicatesInDB.length,
    invalid: a.invalid.length, failed: failed.length,
    details: { duplicatesInFile: a.duplicatesInFile, duplicatesInDB: a.duplicatesInDB, invalid: a.invalid, failed } };
}

async function exportQRCodes(filters = {}) {
  let q = supabaseAdmin.from('qr_codes').select('code, status, imported_at, qr_generated, products(name)').order('imported_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.product_id) q = q.eq('product_id', filters.product_id);
  const { data, error } = await q;
  if (error) throw new Error(`Export failed: ${error.message}`);
  return objectsToCSV((data || []).map((r) => ({ code: r.code, product_name: r.products?.name || '', status: r.status,
    qr_generated: r.qr_generated ? 'yes' : 'no', imported_at: r.imported_at })),
    ['code', 'product_name', 'status', 'qr_generated', 'imported_at']);
}

async function listImportHistory() {
  const { data, error } = await supabaseAdmin.from('import_batches').select('*, products(name), admin_profiles(full_name)').order('imported_at', { ascending: false }).limit(100);
  if (error) throw new Error(`Failed to load import history: ${error.message}`);
  return data || [];
}

function getCSVTemplate() { return Buffer.from('code\n7GG6Y89U8K\nABC123XYZ9\nCODE000003\n', 'utf8'); }
async function findExistingCodes(keys) {
  const results = [];
  for (const chunk of chunkArray(keys, 500)) {
    if (!chunk.length) continue;
    const { data, error } = await supabaseAdmin.from('qr_codes').select('code_normalized').in('code_normalized', chunk);
    if (error) throw new Error(`Duplicate check failed: ${error.message}`);
    results.push(...(data || []));
  }
  return results;
}
function chunkArray(arr, size) { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; }

module.exports = { exportQRCodes, previewCSVImport, importCSV, getCSVTemplate, listImportHistory };
