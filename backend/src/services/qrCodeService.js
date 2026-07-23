const { supabaseAdmin } = require('../config/supabase');
const { getPagination } = require('../utils/pagination');
const { normalizeCode, codeLookupKey } = require('../utils/csvUtils');
const { STATUS_ACTIVE, STATUS_INACTIVE } = require('../config/constants');

async function listQRCodes(query = {}) {
  const { page, limit, offset } = getPagination(query);
  const { search, status, product_id, sort_by = 'qr_generated_at', sort_order = 'desc', generated = 'true' } = query;

  const validSortColumns = ['created_at', 'imported_at', 'qr_generated_at', 'scan_count', 'code', 'status', 'last_scanned_at'];
  const sortCol = validSortColumns.includes(sort_by) ? sort_by : 'qr_generated_at';
  const ascending = sort_order === 'asc';

  let q = supabaseAdmin
    .from('qr_codes')
    .select(`
      id,
      code,
      status,
      scan_count,
      first_scanned_at,
      last_scanned_at,
      created_at,
      updated_at,
      imported_at,
      qr_generated,
      qr_generated_at,
      qr_image_url,
      qr_image_path,
      generation_batch_id,
      product_id,
      products ( id, name, medicine_name )
    `, { count: 'exact' })
    .order(sortCol, { ascending })
    .range(offset, offset + limit - 1);

  if (search) {
    q = q.ilike('code', `%${normalizeCode(search)}%`);
  }

  if (status) {
    q = q.eq('status', status);
  }

  if (product_id) {
    q = q.eq('product_id', product_id);
  }

  if (generated === 'true') q = q.eq('qr_generated', true);
  if (generated === 'false') q = q.eq('qr_generated', false);
  if (query.date_from) q = q.gte('qr_generated_at', `${query.date_from}T00:00:00.000Z`);
  if (query.date_to) q = q.lte('qr_generated_at', `${query.date_to}T23:59:59.999Z`);

  const { data, count, error } = await q;

  if (error) throw new Error(`Failed to list QR codes: ${error.message}`);

  return { data: data || [], total: count || 0, page, limit };
}

async function getQRCodeById(id) {
  const { data, error } = await supabaseAdmin
    .from('qr_codes')
    .select(`
      *,
      products ( id, name, medicine_name, company_name )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('QR code not found'), { statusCode: 404 });
  }

  return data;
}

async function createQRCode(body) {
  const code = normalizeCode(body.code);
  const codeNormalized = codeLookupKey(code);

  if (!code) {
    throw Object.assign(new Error('Code is required'), { statusCode: 400 });
  }

  // Check duplicate
  const { data: existing } = await supabaseAdmin
    .from('qr_codes')
    .select('id')
    .eq('code_normalized', codeNormalized)
    .maybeSingle();

  if (existing) {
    throw Object.assign(new Error(`Code "${code}" already exists in the database`), { statusCode: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from('qr_codes')
    .insert({
      code,
      code_normalized: codeNormalized,
      product_id: body.product_id,
      status: body.status || STATUS_ACTIVE,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create QR code: ${error.message}`);

  return data;
}

async function updateQRCode(id, body) {
  const updates = {};

  if (body.status !== undefined) {
    if (![STATUS_ACTIVE, STATUS_INACTIVE].includes(body.status)) {
      throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
    }
    updates.status = body.status;
  }

  if (body.product_id !== undefined) {
    updates.product_id = body.product_id;
  }

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { statusCode: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('qr_codes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update QR code: ${error.message}`);

  return data;
}

async function deleteQRCode(id) {
  // Delete related scan logs first to avoid FK constraint errors
  await supabaseAdmin.from('scan_logs').delete().eq('qr_code_id', id);

  const { error } = await supabaseAdmin.from('qr_codes').delete().eq('id', id);

  if (error) throw new Error(`Failed to delete QR code: ${error.message}`);

  return { deleted: true };
}

async function bulkUpdateStatus(ids, status) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw Object.assign(new Error('No IDs provided'), { statusCode: 400 });
  }
  if (![STATUS_ACTIVE, STATUS_INACTIVE].includes(status)) {
    throw Object.assign(new Error('Invalid status value'), { statusCode: 400 });
  }

  const { error } = await supabaseAdmin
    .from('qr_codes')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) throw new Error(`Bulk status update failed: ${error.message}`);

  return { updated: ids.length };
}

async function bulkDelete(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw Object.assign(new Error('No IDs provided'), { statusCode: 400 });
  }

  // Remove scan log references first
  await supabaseAdmin.from('scan_logs').delete().in('qr_code_id', ids);

  const { error } = await supabaseAdmin.from('qr_codes').delete().in('id', ids);

  if (error) throw new Error(`Bulk delete failed: ${error.message}`);

  return { deleted: ids.length };
}

module.exports = {
  listQRCodes,
  getQRCodeById,
  createQRCode,
  updateQRCode,
  deleteQRCode,
  bulkUpdateStatus,
  bulkDelete,
};
