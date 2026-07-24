-- News storage and atomic daily replacement.
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  article_url TEXT NOT NULL,
  news_site TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_news_site ON news(news_site);
CREATE INDEX IF NOT EXISTS idx_news_fetched_at ON news(fetched_at DESC);

DROP TRIGGER IF EXISTS set_news_updated_at ON news;
CREATE TRIGGER set_news_updated_at
  BEFORE UPDATE ON news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_news" ON news;
CREATE POLICY "service_role_all_news"
  ON news FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION replace_news(p_articles JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('indufar_news_refresh'));

  IF jsonb_typeof(p_articles) <> 'array' OR jsonb_array_length(p_articles) = 0 THEN
    RAISE EXCEPTION 'A non-empty article array is required';
  END IF;

  -- Supabase enables a safe-update guard that rejects unqualified deletes,
  -- including inside functions. Every persisted row has a non-null primary key.
  DELETE FROM news WHERE id IS NOT NULL;

  INSERT INTO news (
    external_id, title, summary, image_url, article_url,
    news_site, published_at, fetched_at
  )
  SELECT
    item->>'external_id',
    item->>'title',
    NULLIF(item->>'summary', ''),
    NULLIF(item->>'image_url', ''),
    item->>'article_url',
    NULLIF(item->>'news_site', ''),
    NULLIF(item->>'published_at', '')::TIMESTAMPTZ,
    (item->>'fetched_at')::TIMESTAMPTZ
  FROM jsonb_array_elements(p_articles) AS item;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> jsonb_array_length(p_articles) THEN
    RAISE EXCEPTION 'Not all news articles were inserted';
  END IF;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION replace_news(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION replace_news(JSONB) TO service_role;
