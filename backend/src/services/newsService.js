const { supabaseAdmin } = require('../config/supabase');

const NEWS_URL = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=10&ordering=-published_at';
const REQUEST_TIMEOUT_MS = 10000;
let refreshPromise = null;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function safeUrl(value) {
  const text = cleanText(value, 2048);
  if (!text) return null;
  try {
    const url = new URL(text);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeArticles(payload, fetchedAt = new Date().toISOString()) {
  if (!payload || !Array.isArray(payload.results)) {
    throw Object.assign(new Error('News provider returned an invalid response'), { statusCode: 502 });
  }

  const seen = new Set();
  const articles = payload.results.slice(0, 10).map((article) => {
    const externalId = cleanText(String(article?.id ?? ''), 255);
    const title = cleanText(article?.title, 500);
    const articleUrl = safeUrl(article?.url);
    const published = article?.published_at && new Date(article.published_at);
    if (!externalId || !title || !articleUrl || !published || Number.isNaN(published.getTime())) {
      throw Object.assign(new Error('News provider returned a malformed article'), { statusCode: 502 });
    }
    if (seen.has(externalId)) {
      throw Object.assign(new Error('News provider returned duplicate articles'), { statusCode: 502 });
    }
    seen.add(externalId);
    return {
      external_id: externalId,
      title,
      summary: cleanText(article.summary, 5000),
      image_url: safeUrl(article.image_url),
      article_url: articleUrl,
      news_site: cleanText(article.news_site, 255),
      published_at: published.toISOString(),
      fetched_at: fetchedAt,
    };
  });

  if (articles.length !== 10) {
    throw Object.assign(new Error('News provider did not return 10 valid articles'), { statusCode: 502 });
  }
  return articles;
}

async function fetchLatestNews(fetchFn = global.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchFn(NEWS_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'Indufar-News/1.0' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`News provider responded with HTTP ${response.status}`);
    return normalizeArticles(await response.json());
  } catch (error) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('News provider request timed out'), { statusCode: 504 });
    }
    if (error.statusCode) throw error;
    throw Object.assign(new Error('Unable to fetch news from the provider'), { statusCode: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

async function performRefresh({ fetchFn = global.fetch, db = supabaseAdmin } = {}) {
  const startedAt = Date.now();
  const articles = await fetchLatestNews(fetchFn);
  const { data, error } = await db.rpc('replace_news', { p_articles: articles });
  if (error) {
    console.error('[NEWS] Atomic replacement failed', {
      code: error.code,
      message: error.message,
    });
    if (error.code !== '21000' || !/WHERE clause/i.test(error.message || '')) {
      throw new Error('News refresh could not be saved');
    }

    // Compatibility for databases that applied the original migration before
    // 007. The corrected RPC remains the normal, fully atomic path.
    console.warn('[NEWS] Using safe-update compatibility replacement; apply migration 007');
    const { error: upsertError } = await db.from('news').upsert(articles, { onConflict: 'external_id' });
    if (upsertError) throw new Error('News refresh could not be saved');

    const { data: stored, error: selectError } = await db.from('news').select('id, external_id');
    if (selectError) throw new Error('News refresh could not be saved');
    const currentIds = new Set(articles.map((article) => article.external_id));
    const staleIds = (stored || [])
      .filter((row) => !currentIds.has(row.external_id))
      .map((row) => row.id);
    if (staleIds.length) {
      const { error: deleteError } = await db.from('news').delete().in('id', staleIds);
      if (deleteError) throw new Error('News refresh could not be saved');
    }
  }
  const inserted = Number(data) || articles.length;
  console.info('[NEWS] Refresh completed', { inserted, executionMs: Date.now() - startedAt });
  return { inserted, executionMs: Date.now() - startedAt };
}

function refreshNews(options) {
  if (refreshPromise) {
    throw Object.assign(new Error('A news refresh is already in progress'), { statusCode: 409 });
  }
  refreshPromise = performRefresh(options)
    .catch((error) => {
      console.error('[NEWS] Refresh failed', { message: error.message });
      throw error;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function listNews(query = {}) {
  const search = cleanText(query.search, 200);
  const source = cleanText(query.source, 255);
  const ascending = query.sort === 'oldest';
  let dbQuery = supabaseAdmin.from('news').select('*', { count: 'exact' })
    .order('published_at', { ascending, nullsFirst: false });
  if (search) dbQuery = dbQuery.ilike('title', `%${search.replace(/[%_,()]/g, '')}%`);
  if (source) dbQuery = dbQuery.eq('news_site', source);
  const { data, count, error } = await dbQuery;
  if (error) throw new Error('Failed to load news');

  const { data: sourcesData } = await supabaseAdmin.from('news').select('news_site');
  const sources = [...new Set((sourcesData || []).map((row) => row.news_site).filter(Boolean))].sort();
  return { data: data || [], total: count || 0, sources };
}

async function getNewsById(id) {
  const { data, error } = await supabaseAdmin.from('news').select('*').eq('id', id).single();
  if (error || !data) throw Object.assign(new Error('News article not found'), { statusCode: 404 });
  return data;
}

async function deleteNews(id) {
  const { data, error } = await supabaseAdmin.from('news').delete().eq('id', id).select('id').maybeSingle();
  if (error) throw new Error('Failed to delete news article');
  if (!data) throw Object.assign(new Error('News article not found'), { statusCode: 404 });
}

module.exports = {
  NEWS_URL, normalizeArticles, fetchLatestNews, performRefresh, refreshNews,
  listNews, getNewsById, deleteNews,
};
