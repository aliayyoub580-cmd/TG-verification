const QRCode = require('qrcode');

/**
 * Generates a QR code PNG as a Buffer.
 *
 * @param {string} url - The URL to encode
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateQRBuffer(url) {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 512,
    margin: 4,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
}

/**
 * Generates a QR code as a base64 data URL (for preview purposes).
 *
 * @param {string} url
 * @returns {Promise<string>} base64 data URL
 */
async function generateQRDataURL(url) {
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

/**
 * Builds the verification URL for a given code.
 *
 * @param {string} code
 * @param {string} baseUrl - The PUBLIC_VERIFICATION_BASE_URL
 * @returns {string}
 */
function buildVerificationUrl(code, baseUrl) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  return `${cleanBase}/verify?code=${encodeURIComponent(code)}`;
}

module.exports = { generateQRBuffer, generateQRDataURL, buildVerificationUrl };
