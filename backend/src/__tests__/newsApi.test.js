const request = require('supertest');

jest.mock('../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
  supabaseAuth: {},
}));

const app = require('../app');

describe('admin news API authorization', () => {
  test.each([
    ['get', '/api/admin/news'],
    ['get', '/api/admin/news/7f460f76-f32d-45e0-a749-004339c82c8c'],
    ['post', '/api/admin/news/refresh'],
    ['delete', '/api/admin/news/7f460f76-f32d-45e0-a749-004339c82c8c'],
  ])('%s %s rejects unauthenticated requests', async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('cron endpoint rejects requests without its secret', async () => {
    const response = await request(app).get('/api/cron/news');
    expect(response.status).toBe(401);
  });
});
