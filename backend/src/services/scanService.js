const { supabaseAdmin } = require('../config/supabase');
const { getPagination } = require('../utils/pagination');
const { objectsToCSV } = require('../utils/csvUtils');

async function listScans(query = {}) {
  const { page, limit, offset } = getPagination(query);
  const { search, result, date_from, date_to } = query;

  let q = supabaseAdmin
    .from('scan_logs')
    .select(`
      id,
      submitted_code,
      verification_result,
      scanned_at,
      user_agent,
      referrer,
      qr_code_id,
      qr_codes ( code, products ( name ) )
    `, { count: 'exact' })
    .order('scanned_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    q = q.ilike('submitted_code', `%${search}%`);
  }

  if (result) {
    q = q.eq('verification_result', result);
  }

  if (date_from) {
    q = q.gte('scanned_at', date_from);
  }

  if (date_to) {
    q = q.lte('scanned_at', date_to);
  }

  const { data, count, error } = await q;

  if (error) throw new Error(`Failed to list scans: ${error.message}`);

  // Never expose raw IP in listing — omit intentionally
  const sanitized = (data || []).map(({ ip_address, ...rest }) => rest);

  return { data: sanitized, total: count || 0, page, limit };
}

async function getScanById(id) {
  const { data, error } = await supabaseAdmin
    .from('scan_logs')
    .select(`
      id,
      submitted_code,
      verification_result,
      scanned_at,
      user_agent,
      referrer,
      qr_code_id,
      qr_codes ( code, products ( name ) )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Scan record not found'), { statusCode: 404 });
  }

  // Omit IP from individual record view too
  const { ip_address, ...sanitized } = data;
  return sanitized;
}

async function exportScans(filters = {}) {
  const { result, date_from, date_to } = filters;

  let q = supabaseAdmin
    .from('scan_logs')
    .select(`
      id,
      submitted_code,
      verification_result,
      scanned_at,
      user_agent,
      referrer,
      qr_codes ( code, products ( name ) )
    `)
    .order('scanned_at', { ascending: false });

  if (result) q = q.eq('verification_result', result);
  if (date_from) q = q.gte('scanned_at', date_from);
  if (date_to) q = q.lte('scanned_at', date_to);

  const { data, error } = await q;

  if (error) throw new Error(`Export scans failed: ${error.message}`);

  const records = (data || []).map((row) => ({
    id: row.id,
    submitted_code: row.submitted_code || '',
    verification_result: row.verification_result,
    qr_code: row.qr_codes?.code || '',
    product_name: row.qr_codes?.products?.name || '',
    scanned_at: row.scanned_at,
    user_agent: row.user_agent || '',
    referrer: row.referrer || '',
  }));

  return objectsToCSV(
    records,
    ['id', 'submitted_code', 'qr_code', 'verification_result', 'product_name', 'scanned_at', 'user_agent', 'referrer'],
    {
      id: 'ID',
      submitted_code: 'Submitted Code',
      qr_code: 'Matched Code',
      verification_result: 'Result',
      product_name: 'Product',
      scanned_at: 'Scanned At',
      user_agent: 'User Agent',
      referrer: 'Referrer',
    }
  );
}

async function getDashboardStats() {
  const [
    productsRes,
    totalQRRes,
    activeQRRes,
    inactiveQRRes,
    totalScansRes,
    todayScansRes,
    validScansRes,
    invalidScansRes,
    recentQRRes,
    recentScansRes,
  ] = await Promise.all([
    supabaseAdmin.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('qr_codes').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('qr_codes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabaseAdmin.from('qr_codes').select('*', { count: 'exact', head: true }).eq('status', 'inactive'),
    supabaseAdmin.from('scan_logs').select('*', { count: 'exact', head: true }),
    supabaseAdmin
      .from('scan_logs')
      .select('*', { count: 'exact', head: true })
      .gte('scanned_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabaseAdmin
      .from('scan_logs')
      .select('*', { count: 'exact', head: true })
      .eq('verification_result', 'authentic'),
    supabaseAdmin
      .from('scan_logs')
      .select('*', { count: 'exact', head: true })
      .in('verification_result', ['not_found', 'inactive', 'missing_code']),
    supabaseAdmin
      .from('qr_codes')
      .select('id, code, status, created_at, products(name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('scan_logs')
      .select('id, submitted_code, verification_result, scanned_at, qr_codes(code, products(name))')
      .order('scanned_at', { ascending: false })
      .limit(5),
  ]);

  return {
    totalProducts: productsRes.count || 0,
    totalQRCodes: totalQRRes.count || 0,
    activeQRCodes: activeQRRes.count || 0,
    inactiveQRCodes: inactiveQRRes.count || 0,
    totalScans: totalScansRes.count || 0,
    todayScans: todayScansRes.count || 0,
    validScans: validScansRes.count || 0,
    invalidScans: invalidScansRes.count || 0,
    recentQRCodes: recentQRRes.data || [],
    recentScans: (recentScansRes.data || []).map(({ ip_address, ...rest }) => rest),
  };
}

module.exports = { listScans, getScanById, exportScans, getDashboardStats };
