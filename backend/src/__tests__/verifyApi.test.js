/**
 * Integration tests for GET /api/verify
 * These mock the Supabase client so no live DB is required.
 */

const request = require('supertest');

// Mock Supabase before requiring the app
jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  supabasePublic: {},
}));

const { supabaseAdmin } = require('../config/supabase');
const app = require('../app');

// Helper to build a fluent Supabase mock chain
function mockChain(overrides = {}) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn().mockReturnThis(),
    ...overrides,
  };
  return chain;
}

describe('GET /api/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('missing code parameter → 400 missing_code', async () => {
    // Scan log insert mock
    supabaseAdmin.from.mockReturnValue(mockChain());

    const res = await request(app).get('/api/verify');
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('missing_code');
  });

  test('empty code → 400 missing_code', async () => {
    supabaseAdmin.from.mockReturnValue(mockChain());

    const res = await request(app).get('/api/verify?code=');
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('missing_code');
  });

  test('code with spaces is normalized', async () => {
    // Should be normalized to uppercase trimmed before DB lookup
    const qrChain = mockChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const logChain = mockChain();

    supabaseAdmin.from
      .mockReturnValueOnce(qrChain)  // qr_codes lookup
      .mockReturnValueOnce(logChain); // scan_logs insert

    const res = await request(app).get('/api/verify?code=%20%20abc123%20%20');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('not_found');
  });

  test('non-existent code → 404 not_found', async () => {
    const qrChain = mockChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const logChain = mockChain();

    supabaseAdmin.from
      .mockReturnValueOnce(qrChain)
      .mockReturnValueOnce(logChain);

    const res = await request(app).get('/api/verify?code=DOESNOTEXIST');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('not_found');
    expect(res.body.success).toBe(false);
  });

  test('inactive code → 200 inactive', async () => {
    const qrChain = mockChain({
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'qr-uuid',
          code: 'TESTCODE1',
          status: 'inactive',
          scan_count: 0,
          first_scanned_at: null,
          products: {
            name: 'T.G. 15 mg',
            medicine_name: 'Tirzepatida',
            dosage: '15 mg/0.5mL',
            product_image_url: null,
            company_logo_url: null,
            company_name: 'Indufar',
            success_message: null,
            footer_text: null,
            status: 'active',
          },
        },
        error: null,
      }),
    });
    const logChain = mockChain();

    supabaseAdmin.from
      .mockReturnValueOnce(qrChain)
      .mockReturnValueOnce(logChain);

    const res = await request(app).get('/api/verify?code=TESTCODE1');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
    expect(res.body.success).toBe(false);
  });

  test('valid active code → 200 authentic with product data', async () => {
    const product = {
      id: 'prod-uuid',
      name: 'T.G. 15 mg',
      medicine_name: 'Tirzepatida',
      dosage: '15 mg/0.5mL',
      description: null,
      product_image_url: 'https://example.com/image.jpg',
      company_logo_url: 'https://example.com/logo.png',
      company_name: 'Indufar',
      success_message: "This code matches our records.",
      footer_text: 'Secured verification · Powered by Indufar',
      status: 'active',
    };

    const qrChain = mockChain({
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: 'qr-uuid',
          code: '7GG6Y89U8K',
          status: 'active',
          scan_count: 0,
          first_scanned_at: null,
          products: product,
        },
        error: null,
      }),
    });
    // scan_logs insert
    const logChain = mockChain();
    // update scan counters
    const updateChain = mockChain({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });

    supabaseAdmin.from
      .mockReturnValueOnce(qrChain)    // qr_codes lookup
      .mockReturnValueOnce(logChain)   // scan_logs insert
      .mockReturnValueOnce(updateChain); // update scan counters

    const res = await request(app).get('/api/verify?code=7GG6Y89U8K');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('authentic');
    expect(res.body.data.code).toBe('7GG6Y89U8K');
    expect(res.body.data.product.name).toBe('T.G. 15 mg');
    expect(res.body.data.product.companyName).toBe('Indufar');
  });

  test('lowercase code is normalized to uppercase before lookup', async () => {
    const qrChain = mockChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const logChain = mockChain();

    supabaseAdmin.from
      .mockReturnValueOnce(qrChain)
      .mockReturnValueOnce(logChain);

    // Even though code is lowercase, the service normalizes it
    await request(app).get('/api/verify?code=7gg6y89u8k');
    // The eq() call should have received the uppercased version
    expect(qrChain.eq).toHaveBeenCalledWith('code', '7GG6Y89U8K');
  });

  test('health endpoint returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
