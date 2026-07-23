const archiver = require('archiver');
const { supabaseAdmin } = require('../config/supabase');
const { generateQRBuffer, buildVerificationUrl } = require('../utils/qrGenerator');
const { objectsToCSV } = require('../utils/csvUtils');

/**
 * Streams a ZIP archive containing QR code PNG images, a CSV of codes,
 * and a README to the provided Express response object.
 *
 * Uses archiver streaming so the server never holds the entire ZIP in memory.
 *
 * @param {import('express').Response} res - Express response
 * @param {object} options
 * @param {string[]} options.codeIds - UUIDs of qr_codes rows to include
 * @param {string} options.baseUrl
 * @param {string} [options.productName]
 */
async function streamQRZip(res, { codeIds, baseUrl, productName = 'Product' }) {
  if (!codeIds || codeIds.length === 0) {
    throw Object.assign(new Error('No QR code IDs provided'), { statusCode: 400 });
  }

  if (codeIds.length > 20000) {
    throw Object.assign(
      new Error('Maximum 20,000 QR codes can be downloaded at once'),
      { statusCode: 400 }
    );
  }

  // Fetch all codes from DB
  const allCodes = await fetchCodesForZip(codeIds);

  if (allCodes.length === 0) {
    throw Object.assign(new Error('No QR codes found for the provided IDs'), { statusCode: 404 });
  }

  const generatedAt = new Date().toISOString();
  const folderName = `indufar-qr-codes`;

  // Set response headers before streaming
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${folderName}-${Date.now()}.zip"`
  );

  const archive = archiver('zip', {
    zlib: { level: 6 },
    store: false,
  });

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') {
      console.error('Archiver warning:', err);
    }
  });

  archive.on('error', (err) => {
    console.error('Archiver error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'ZIP generation failed' });
    }
  });

  archive.pipe(res);

  // --- Generate QR PNGs and add to ZIP ---
  const csvRows = [];

  for (const qrCode of allCodes) {
    const url = buildVerificationUrl(qrCode.code, baseUrl);
    const pngBuffer = await generateQRBuffer(url);

    archive.append(pngBuffer, {
      name: `${folderName}/qr-codes/${qrCode.code}.png`,
    });

    csvRows.push({
      code: qrCode.code,
      verification_url: url,
      product_name: qrCode.products?.name || productName,
      status: qrCode.status,
      scan_count: qrCode.scan_count,
      created_at: qrCode.created_at,
    });
  }

  // --- Add CSV ---
  const csvContent = await objectsToCSV(
    csvRows,
    ['code', 'verification_url', 'product_name', 'status', 'scan_count', 'created_at'],
    {
      code: 'Code',
      verification_url: 'Verification URL',
      product_name: 'Product Name',
      status: 'Status',
      scan_count: 'Scan Count',
      created_at: 'Created At',
    }
  );

  archive.append(Buffer.from(csvContent, 'utf8'), {
    name: `${folderName}/codes.csv`,
  });

  // --- Add README ---
  const readme = buildReadme({
    productName: allCodes[0]?.products?.name || productName,
    quantity: allCodes.length,
    baseUrl,
    generatedAt,
  });

  archive.append(Buffer.from(readme, 'utf8'), {
    name: `${folderName}/README.txt`,
  });

  await archive.finalize();
}

function buildReadme({ productName, quantity, baseUrl, generatedAt }) {
  return `INDUFAR QR VERIFICATION CODES
================================

Product Name  : ${productName}
Quantity      : ${quantity}
Verification  : ${baseUrl}/verify?code=<CODE>
Generated At  : ${generatedAt}
Image Format  : PNG (512x512 px)

FOLDER STRUCTURE
----------------
qr-codes/       - Individual QR PNG images, one per code
codes.csv       - All codes with verification URLs and metadata
README.txt      - This file

HOW TO USE
----------
Each PNG file is named after its unique code (e.g. 7GG6Y89U8K.png).
The QR code encodes the full verification URL shown above.

IMPORTANT WARNING
-----------------
DO NOT change the verification domain (${baseUrl}) after QR codes
have been printed and distributed.

Changing the domain will make all printed QR codes unverifiable and
you will need to reprint all materials.

Verify the domain is final before printing.

---
Secured verification · Powered by Indufar
`;
}

async function fetchCodesForZip(ids) {
  const chunkSize = 1000;
  const results = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);

    const { data, error } = await supabaseAdmin
      .from('qr_codes')
      .select(`
        code,
        status,
        scan_count,
        created_at,
        products ( name )
      `)
      .in('id', chunk);

    if (error) throw new Error(`Failed to fetch codes for ZIP: ${error.message}`);
    if (data) results.push(...data);
  }

  return results;
}

module.exports = { streamQRZip };
