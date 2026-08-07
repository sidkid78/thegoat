-- ============================================================================
-- DWELLINGLY.AI - RECOMMENDATIONS, THIRD SIGNAL
-- Migration: 20260806000002_recommendations_with_views.sql
--
-- Adds browsing history to match_recommendations, which previously blended
-- only stated priorities and saved listings. Taste is now the sum of up to
-- three L2-normalised centroids, each weighted by how deliberate the signal is:
--
--   stated priorities   1.0   the buyer typed them
--   saved listings      1.0   an explicit act of interest
--   viewed listings     0.5   opening a page is weak evidence, and a buyer
--                             generates far more views than favourites
--
-- Weighting matters here in a way it did not before. Favourites and priorities
-- are both scarce and intentional, so summing them equally was right. Views
-- are neither, and at equal weight a browsing session would swamp preferences
-- the buyer actually stated.
--
-- Two things this deliberately does NOT do:
--
--   * It does not weight individual views by recency or count. pgvector has no
--     weighted aggregate, and faking one with repeated rows would be opaque.
--     Recency is handled by taking the most recent N distinct properties --
--     a plain ORDER BY ... LIMIT, which is explainable to anyone reading it.
--   * It does not run at all when the user has switched activity tracking off
--     in settings. The flag is read here rather than only at write time, so
--     opting out takes effect on the next page load even before the rows are
--     deleted.
--
-- Viewed properties are excluded from the results for the same reason
-- favourites are, only more acutely: the nearest neighbours to a centroid of
-- viewed listings ARE those listings, so without this exclusion the shelf
-- would simply replay the user's own browsing history back at them.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_recommendations(
  query_embedding vector(768) DEFAULT NULL,
  match_count INT DEFAULT 6
)
RETURNS TABLE (
  property_id BIGINT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  price NUMERIC,
  bedrooms INT,
  bathrooms NUMERIC,
  square_feet INT,
  description TEXT,
  features JSONB,
  photos JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- How many recently-viewed listings inform taste. Enough to describe a
  -- browsing session, few enough that last month's search does not linger.
  recent_view_limit CONSTANT INT := 20;
  view_weight CONSTANT REAL := 0.5;

  fav_centroid vector(768);
  view_centroid vector(768);
  weighted_views vector(768);
  taste vector(768);
  tracking_enabled BOOLEAN;
BEGIN
  -- Absent flag means enabled: tracking is on by default and advertised in
  -- settings, where it can be switched off and the history erased.
  SELECT COALESCE((p.metadata->>'trackActivity')::BOOLEAN, TRUE)
    INTO tracking_enabled
  FROM public.profiles p
  WHERE p.id = auth.uid();

  SELECT AVG(pv.embedding)
    INTO fav_centroid
  FROM public.favorites f
  JOIN public.property_vectors pv ON pv.property_id = f.property_id
  WHERE f.user_id = auth.uid();

  IF COALESCE(tracking_enabled, TRUE) THEN
    SELECT AVG(pv.embedding)
      INTO view_centroid
    FROM (
      SELECT v.property_id
      FROM public.property_views v
      WHERE v.user_id = auth.uid()
      ORDER BY v.last_viewed_at DESC
      LIMIT recent_view_limit
    ) recent
    JOIN public.property_vectors pv ON pv.property_id = recent.property_id;
  END IF;

  -- Accumulated with NULL arithmetic rather than a sentinel: `NULL + vector`
  -- is NULL, so each COALESCE falls back to the term being added and the first
  -- present signal seeds `taste` on its own.
  taste := l2_normalize(query_embedding);

  IF fav_centroid IS NOT NULL THEN
    taste := COALESCE(taste + l2_normalize(fav_centroid), l2_normalize(fav_centroid));
  END IF;

  IF view_centroid IS NOT NULL THEN
    -- pgvector has no `vector * scalar` operator -- only element-wise
    -- `vector * vector` -- so the weight is applied as a uniform vector.
    weighted_views := l2_normalize(view_centroid)
      * array_fill(view_weight, ARRAY[768])::vector;
    taste := COALESCE(taste + weighted_views, weighted_views);
  END IF;

  IF taste IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id AS property_id,
    p.address,
    p.city,
    p.state,
    p.zip_code,
    p.price,
    p.bedrooms,
    p.bathrooms,
    p.square_feet,
    p.description,
    p.features,
    p.photos,
    (1 - (pv.embedding <=> taste))::FLOAT AS similarity
  FROM public.property_vectors pv
  JOIN public.properties p ON p.id = pv.property_id
  WHERE
    p.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.favorites f
      WHERE f.user_id = auth.uid() AND f.property_id = p.id
    )
    -- Only when tracking is on: with it off the history is not taste, so it
    -- should not silently keep filtering results either.
    AND (
      NOT COALESCE(tracking_enabled, TRUE)
      OR NOT EXISTS (
        SELECT 1 FROM public.property_views v
        WHERE v.user_id = auth.uid() AND v.property_id = p.id
      )
    )
    AND (p.owner_id IS NULL OR p.owner_id <> auth.uid())
  ORDER BY pv.embedding <=> taste ASC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_recommendations(vector, INT) TO authenticated;
