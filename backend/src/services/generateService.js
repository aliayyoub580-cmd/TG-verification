const { supabaseAdmin } = require('../config/supabase');
const { generateQRBuffer, buildVerificationUrl } = require('../utils/qrGenerator');
const { QR_CODES_BUCKET } = require('../config/constants');
const { getPagination } = require('../utils/pagination');

function publicBaseUrl() {
  const value = process.env.PUBLIC_VERIFICATION_BASE_URL;
  if (!value || /localhost/i.test(value)) throw Object.assign(new Error('PUBLIC_VERIFICATION_BASE_URL must be configured with the production HTTPS URL'), { statusCode: 503 });
  return value.replace(/\/$/, '');
}
function safeFileName(code) { return code.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'code'; }

async function listPendingCodes(query = {}) {
  const { page, limit, offset } = getPagination(query);
  let q = supabaseAdmin.from('qr_codes').select('id, code, status, imported_at, product_id, products(name)', { count: 'exact' })
    .eq('qr_generated', false).order('imported_at', { ascending: false });
  if (query.all !== 'true') q = q.range(offset, offset + limit - 1);
  else q = q.limit(20000);
  if (query.search) q = q.ilike('code', `%${query.search.trim()}%`);
  if (query.product_id) q = q.eq('product_id', query.product_id);
  if (query.date_from) q = q.gte('imported_at', `${query.date_from}T00:00:00.000Z`);
  if (query.date_to) q = q.lte('imported_at', `${query.date_to}T23:59:59.999Z`);
  const { data, count, error } = await q;
  if (error) throw new Error(`Failed to list pending codes: ${error.message}`);
  return { data: data || [], total: count || 0, page, limit };
}

async function generateForIds(ids) {
  const uniqueIds = [...new Set(ids)];
  const generated = [], existing = [], failed = [];
  for (const id of uniqueIds) {
    try {
      const result = await generateOne(id);
      (result.alreadyGenerated ? existing : generated).push(result.record);
    } catch (error) { failed.push({ id, message: generationErrorMessage(error) }); }
  }
  return { generated: generated.length, alreadyGenerated: existing.length, failed: failed.length, records: generated, errors: failed };
}

function generationErrorMessage(error) {
  const message = error?.message || '';
  if (/PUBLIC_VERIFICATION_BASE_URL/i.test(message)) {
    return 'PUBLIC_VERIFICATION_BASE_URL is not configured with the live HTTPS site URL.';
  }
  if (/bucket|storage|upload/i.test(message)) {
    return 'QR image storage is not configured. Run database migration 005 and verify the qr-codes bucket.';
  }
  if (/qr_generated|qr_generation_state|qr_image_/i.test(message)) {
    return 'The QR workflow database migration is missing. Run database migration 005.';
  }
  if (error?.statusCode === 409) return message;
  return 'QR generation failed. Check the backend deployment logs and configuration.';
}

async function generateOne(id) {
  const { data: current, error: readError } = await supabaseAdmin.from('qr_codes')
    .select('id, code, product_id, qr_generated, qr_image_url, qr_generation_state').eq('id', id).single();
  if (readError || !current) throw Object.assign(new Error('Verification code not found'), { statusCode: 404 });
  if (current.qr_generated) return { alreadyGenerated: true, record: current };

  const { data: claimed, error: claimError } = await supabaseAdmin.from('qr_codes')
    .update({ qr_generation_state: 'processing' }).eq('id', id).eq('qr_generated', false).eq('qr_generation_state', 'pending').select('id').maybeSingle();
  if (claimError) throw new Error(`Could not claim code for generation: ${claimError.message}`);
  if (!claimed) throw Object.assign(new Error('QR generation is already in progress for this code'), { statusCode: 409 });

  const baseUrl = publicBaseUrl();
  const verificationUrl = buildVerificationUrl(current.code, baseUrl);
  const path = `${current.product_id}/${current.id}-${safeFileName(current.code)}.png`;
  try {
    const png = await generateQRBuffer(verificationUrl);
    if (!Buffer.isBuffer(png) || png.length < 100) throw new Error('PNG generation returned invalid data');
    const { error: uploadError } = await supabaseAdmin.storage.from(QR_CODES_BUCKET).upload(path, png, { contentType: 'image/png', upsert: false });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw new Error(`QR image upload failed: ${uploadError.message}`);
    const { data: urlData } = supabaseAdmin.storage.from(QR_CODES_BUCKET).getPublicUrl(path);
    if (!urlData?.publicUrl) throw new Error('QR image URL was not created');
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('qr_codes').update({ qr_generated: true, qr_generation_state: 'generated',
      qr_image_path: path, qr_image_url: urlData.publicUrl, qr_generated_at: now, updated_at: now }).eq('id', id).select('id, code, qr_image_url, qr_generated_at').single();
    if (error) throw new Error(`Could not save generated QR metadata: ${error.message}`);
    return { alreadyGenerated: false, record: { ...data, verificationUrl } };
  } catch (error) {
    await supabaseAdmin.from('qr_codes').update({ qr_generation_state: 'pending' }).eq('id', id).eq('qr_generated', false);
    throw error;
  }
}

module.exports = { listPendingCodes, generateForIds, generateOne, publicBaseUrl, safeFileName, generationErrorMessage };
