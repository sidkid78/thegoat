-- ============================================================================
-- DWELLINGLY.AI - PERSONALIZED RECOMMENDATIONS
-- Migration: 20260805000000_match_recommendations.sql
--
-- Ranks the whole active catalogue against a buyer's taste. This is the third
-- shape of the same cosine search:
--
--   match_properties    -- whole catalogue vs. a typed query   (search page)
--   match_favorites     -- fixed shortlist vs. one embedding   (evaluation hub)
--   match_recommendations -- whole catalogue vs. inferred taste (this one)
--
-- "Taste" comes from up to two real signals, never invented:
--
--   1. `query_embedding` -- the buyer's stated priorities, embedded by the
--      caller from profiles.metadata.buyerPreferences.
--   2. The centroid of the properties they have actually favorited.
--
-- Both are L2-normalised before being summed so neither dominates on magnitude
-- alone (gemini-embedding-001 at outputDimensionality 768 does not return unit
-- vectors). The sum is not divided by two: cosine distance is scale-invariant,
-- so the halving would be a no-op.
--
-- With neither signal present the function returns no rows. There is nothing
-- real to rank against, and a shelf of arbitrary listings labelled
-- "recommended for you" is worse than an empty state that says why.
--
-- SECURITY DEFINER to read property_vectors uniformly, but every user-scoped
-- clause resolves auth.uid() internally rather than taking a user id argument,
-- so it cannot be pointed at somebody else's taste or shortlist.
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
  fav_centroid vector(768);
  taste vector(768);
BEGIN
  SELECT AVG(pv.embedding)
    INTO fav_centroid
  FROM public.favorites f
  JOIN public.property_vectors pv ON pv.property_id = f.property_id
  WHERE f.user_id = auth.uid();

  taste := CASE
    WHEN query_embedding IS NOT NULL AND fav_centroid IS NOT NULL
      THEN l2_normalize(query_embedding) + l2_normalize(fav_centroid)
    WHEN query_embedding IS NOT NULL THEN query_embedding
    ELSE fav_centroid
  END;

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
    -- Already saved: they have found it, so recommending it teaches nothing.
    AND NOT EXISTS (
      SELECT 1 FROM public.favorites f
      WHERE f.user_id = auth.uid() AND f.property_id = p.id
    )
    -- A seller's own listing is never a recommendation for them to buy.
    AND (p.owner_id IS NULL OR p.owner_id <> auth.uid())
  ORDER BY pv.embedding <=> taste ASC
  LIMIT match_count;
END;
$$;

-- Functions are not covered by the table GRANTs in
-- 20260730000001_grant_data_api_roles.sql; PostgREST needs this to expose the
-- RPC at all. Anonymous visitors have no taste to rank against (auth.uid() is
-- null, so both signals resolve empty), hence authenticated only.
GRANT EXECUTE ON FUNCTION public.match_recommendations(vector, INT) TO authenticated;
