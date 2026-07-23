const { supabaseAdmin } = require('../config/supabase');
const {
  RESULT_AUTHENTIC,
  RESULT_INACTIVE,
  RESULT_NOT_FOUND,
  RESULT_MISSING_CODE,
  STATUS_ACTIVE,
} = require('../config/constants');
const { normalizeCode, codeLookupKey } = require('../utils/csvUtils');

/**
 * Verifies a submitted QR code and returns structured result.
 * Also records the scan in scan_logs and updates the qr_codes counters.
 *
 * @param {string|undefined} rawCode
 * @param {object} meta - { ipAddress, userAgent, referrer }
 * @returns {Promise<object>}
 */
async function verifyCode(rawCode, meta = {}) {
  const { ipAddress, userAgent, referrer } = meta;

  // --- Missing code ---
  if (!rawCode || rawCode.trim() === '') {
    await recordScan({
      qrCodeId: null,
      submittedCode: null,
      result: RESULT_MISSING_CODE,
      ipAddress,
      userAgent,
      referrer,
    });

    return {
      success: false,
      status: RESULT_MISSING_CODE,
      message: 'No verification code provided. Please scan a valid QR code.',
    };
  }

  const code = normalizeCode(rawCode);
  const lookupKey = codeLookupKey(code);

  // Basic character/length validation — reject obviously malformed codes early
  if (code.length < 4 || code.length > 64) {
    await recordScan({
      qrCodeId: null,
      submittedCode: code,
      result: RESULT_NOT_FOUND,
      ipAddress,
      userAgent,
      referrer,
    });

    return {
      success: false,
      status: RESULT_NOT_FOUND,
      message: 'This code does not match our official records. Please verify the code printed on the packaging or contact the seller.',
    };
  }

  // --- Look up the code ---
  const { data: qrRecord, error: qrError } = await supabaseAdmin
    .from('qr_codes')
    .select(`
      id,
      code,
      status,
      scan_count,
      first_scanned_at,
      product_id,
      products (
        id,
        name,
        medicine_name,
        dosage,
        description,
        product_image_url,
        company_logo_url,
        company_name,
        success_message,
        footer_text,
        status
      )
    `)
    .eq('code_normalized', lookupKey)
    .maybeSingle();

  if (qrError) {
    console.error('DB error during verification:', qrError.message);
    // Don't expose DB errors — treat as not found
    return {
      success: false,
      status: 'error',
      message: 'Verification temporarily unavailable. Please try again shortly.',
    };
  }

  // --- Not found ---
  if (!qrRecord) {
    await recordScan({
      qrCodeId: null,
      submittedCode: code,
      result: RESULT_NOT_FOUND,
      ipAddress,
      userAgent,
      referrer,
    });

    return {
      success: false,
      status: RESULT_NOT_FOUND,
      message: 'This code does not match our official records. Please verify the code printed on the packaging or contact the seller.',
    };
  }

  // --- Inactive ---
  if (qrRecord.status !== STATUS_ACTIVE || !qrRecord.products || qrRecord.products.status !== STATUS_ACTIVE) {
    await recordScan({
      qrCodeId: qrRecord.id,
      submittedCode: code,
      result: RESULT_INACTIVE,
      ipAddress,
      userAgent,
      referrer,
    });

    return {
      success: false,
      status: RESULT_INACTIVE,
      message: 'This code exists but is currently inactive. It may have been recalled or deactivated.',
    };
  }

  // --- Authentic ---
  // Update scan counters asynchronously (don't block the response)
  updateScanCounters(qrRecord).catch((err) =>
    console.error('Failed to update scan counters:', err.message)
  );

  await recordScan({
    qrCodeId: qrRecord.id,
    submittedCode: code,
    result: RESULT_AUTHENTIC,
    ipAddress,
    userAgent,
    referrer,
  });

  const product = qrRecord.products;

  return {
    success: true,
    status: RESULT_AUTHENTIC,
    data: {
      code: qrRecord.code,
      product: {
        name: product.name,
        medicineName: product.medicine_name,
        dosage: product.dosage,
        description: product.description,
        imageUrl: product.product_image_url,
        logoUrl: product.company_logo_url,
        companyName: product.company_name,
        successMessage:
          product.success_message ||
          "This code matches our records. Compare it with the code printed on your product's packaging.",
        footerText: product.footer_text || 'Secured verification · Powered by Indufar',
      },
    },
  };
}

async function updateScanCounters(qrRecord) {
  const now = new Date().toISOString();
  const update = {
    scan_count: (qrRecord.scan_count || 0) + 1,
    last_scanned_at: now,
  };

  if (!qrRecord.first_scanned_at) {
    update.first_scanned_at = now;
  }

  await supabaseAdmin
    .from('qr_codes')
    .update(update)
    .eq('id', qrRecord.id);
}

async function recordScan({ qrCodeId, submittedCode, result, ipAddress, userAgent, referrer }) {
  try {
    await supabaseAdmin.from('scan_logs').insert({
      qr_code_id: qrCodeId || null,
      submitted_code: submittedCode || null,
      verification_result: result,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      referrer: referrer || null,
    });
  } catch (err) {
    // Non-critical — log but never break verification
    console.error('Failed to record scan log:', err.message);
  }
}

module.exports = { verifyCode };
