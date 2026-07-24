-- Fix deployments where migration 006 was already applied with an
-- unqualified DELETE rejected by Supabase's safe-update guard.
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
