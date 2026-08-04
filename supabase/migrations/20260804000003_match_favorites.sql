-- ============================================================================
-- DWELLINGLY.AI - SHORTLIST SCORING
-- Migration: 20260804000003_match_favorites.sql
-- Scores a user's saved properties against their stated buying preferences.
--
-- The search page gets its match % from `match_properties`, which ranks the
-- whole catalogue against a typed query. The Property Evaluation Hub has no
-- query -- it works from the favorites list -- so this function inverts the
-- relationship: fixed set of properties, one preference embedding, same cosine
-- distance operator and the same 768 dimension.
--
-- SECURITY DEFINER to read property_vectors uniformly, but it scopes to
-- auth.uid() internally rather than taking a user id parameter, so it cannot be
-- used to read somebody else's shortlist.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_favorites(
  query_embedding vector(768)
)
RETURNS TABLE (
  property_id BIGINT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.property_id,
    1 - (pv.embedding <=> query_embedding) AS similarity
  FROM public.favorites f
  JOIN public.property_vectors pv ON pv.property_id = f.property_id
  WHERE f.user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_favorites(vector) TO authenticated;
