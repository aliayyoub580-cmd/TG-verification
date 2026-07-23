const archiver = require('archiver');
const { supabaseAdmin } = require('../config/supabase');
const { QR_CODES_BUCKET } = require('../config/constants');
const { safeFileName } = require('./generateService');

async function fetchGenerated({ ids, filters = {} }) {
  let q = supabaseAdmin.from('qr_codes').select('id, code, qr_image_path, qr_generated_at').eq('qr_generated', true).not('qr_image_path', 'is', null).order('qr_generated_at', { ascending: false }).limit(20000);
  if (ids?.length) q = q.in('id', ids);
  if (filters.search) q = q.ilike('code', `%${filters.search}%`);
  if (filters.product_id) q = q.eq('product_id', filters.product_id);
  if (filters.date_from) q = q.gte('qr_generated_at', `${filters.date_from}T00:00:00.000Z`);
  if (filters.date_to) q = q.lte('qr_generated_at', `${filters.date_to}T23:59:59.999Z`);
  const { data, error } = await q;
  if (error) throw new Error(`Failed to load generated QR images: ${error.message}`);
  return data || [];
}

async function streamQRZip(res, options) {
  const codes = await fetchGenerated(options);
  if (!codes.length) throw Object.assign(new Error('No generated QR images match this selection'), { statusCode: 404 });
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="qr-codes-${date}.zip"`);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (error) => { if (!res.headersSent) res.status(500).end(); else res.destroy(error); });
  archive.pipe(res);
  for (const code of codes) {
    const { data, error } = await supabaseAdmin.storage.from(QR_CODES_BUCKET).download(code.qr_image_path);
    if (error || !data) throw new Error(`Stored QR image is unavailable for ${code.code}`);
    archive.append(Buffer.from(await data.arrayBuffer()), { name: `${safeFileName(code.code)}.png` });
  }
  await archive.finalize();
}

module.exports = { streamQRZip, fetchGenerated };
