const { buildVerificationUrl, generateQRBuffer } = require('../utils/qrGenerator');

describe('buildVerificationUrl', () => {
  test('builds correct URL', () => {
    const url = buildVerificationUrl('7GG6Y89U8K', 'https://indufar-verification.vercel.app');
    expect(url).toBe('https://indufar-verification.vercel.app/verify?code=7GG6Y89U8K');
  });

  test('strips trailing slash from base URL', () => {
    const url = buildVerificationUrl('TESTCODE', 'https://example.com/');
    expect(url).toBe('https://example.com/verify?code=TESTCODE');
  });
});

describe('generateQRBuffer', () => {
  test('returns a Buffer', async () => {
    const buf = await generateQRBuffer('https://example.com/verify?code=TEST');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });

  test('PNG buffer starts with PNG magic bytes', async () => {
    const buf = await generateQRBuffer('https://example.com/verify?code=TEST');
    // PNG files start with 0x89 0x50 0x4E 0x47
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4E);
    expect(buf[3]).toBe(0x47);
  });
});
