jest.mock('../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() },
  supabaseAuth: {},
}));

const {
  normalizeArticles, fetchLatestNews, performRefresh,
} = require('../services/newsService');

function article(id = 1, overrides = {}) {
  return {
    id,
    title: `Article ${id}`,
    summary: 'Summary',
    image_url: 'https://example.com/image.jpg',
    url: `https://example.com/articles/${id}`,
    news_site: 'Test News',
    published_at: '2026-07-23T12:00:00Z',
    ...overrides,
  };
}

function response(payload, ok = true, status = 200) {
  return { ok, status, json: jest.fn().mockResolvedValue(payload) };
}

const tenArticles = () => Array.from({ length: 10 }, (_, index) => article(index + 1));

describe('news refresh service', () => {
  test('normalizes a successful provider response', () => {
    const result = normalizeArticles({ results: tenArticles() }, '2026-07-24T00:00:00Z');
    expect(result).toHaveLength(10);
    expect(result[0]).toMatchObject({
      external_id: '1',
      title: 'Article 1',
      article_url: 'https://example.com/articles/1',
    });
  });

  test('rejects empty and invalid responses', () => {
    expect(() => normalizeArticles({ results: [] })).toThrow('10 valid articles');
    expect(() => normalizeArticles({ wrong: [] })).toThrow('invalid response');
    expect(() => normalizeArticles({ results: [article(1, { title: '' })] })).toThrow('malformed article');
  });

  test('prevents duplicate external IDs', () => {
    expect(() => normalizeArticles({ results: [article(1), article(1)] })).toThrow('duplicate articles');
  });

  test('reports request timeout safely', async () => {
    const timeoutError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(fetchLatestNews(jest.fn().mockRejectedValue(timeoutError)))
      .rejects.toMatchObject({ statusCode: 504 });
  });

  test('replaces old records through one atomic RPC', async () => {
    const db = { rpc: jest.fn().mockResolvedValue({ data: 10, error: null }) };
    const fetchFn = jest.fn().mockResolvedValue(response({ results: tenArticles() }));
    await expect(performRefresh({ fetchFn, db })).resolves.toMatchObject({ inserted: 10 });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc.mock.calls[0][0]).toBe('replace_news');
    expect(db.rpc.mock.calls[0][1].p_articles).toHaveLength(10);
  });

  test('preserves existing data when provider response is empty', async () => {
    const db = { rpc: jest.fn() };
    const fetchFn = jest.fn().mockResolvedValue(response({ results: [] }));
    await expect(performRefresh({ fetchFn, db })).rejects.toThrow('10 valid articles');
    expect(db.rpc).not.toHaveBeenCalled();
  });

  test('surfaces transaction failure without a partial fallback write', async () => {
    const db = { rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'rollback' } }) };
    const fetchFn = jest.fn().mockResolvedValue(response({ results: tenArticles() }));
    await expect(performRefresh({ fetchFn, db })).rejects.toThrow('could not be saved');
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  test('supports databases awaiting the safe-delete function fix', async () => {
    const deleteQuery = { in: jest.fn().mockResolvedValue({ error: null }) };
    const db = {
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { code: '21000', message: 'DELETE requires a WHERE clause' },
      }),
      from: jest.fn()
        .mockReturnValueOnce({ upsert: jest.fn().mockResolvedValue({ error: null }) })
        .mockReturnValueOnce({
          select: jest.fn().mockResolvedValue({
            data: [{ id: 'old-id', external_id: 'old' }],
            error: null,
          }),
        })
        .mockReturnValueOnce({ delete: jest.fn().mockReturnValue(deleteQuery) }),
    };
    const fetchFn = jest.fn().mockResolvedValue(response({ results: tenArticles() }));

    await expect(performRefresh({ fetchFn, db })).resolves.toMatchObject({ inserted: 10 });
    expect(deleteQuery.in).toHaveBeenCalledWith('id', ['old-id']);
  });
});
