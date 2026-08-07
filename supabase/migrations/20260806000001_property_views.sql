-- ============================================================================
-- DWELLINGLY.AI - BEHAVIOUR SIGNAL FOR RECOMMENDATIONS
-- Migration: 20260806000001_property_views.sql
--
-- Which listings a buyer actually opened. This is the "enhanced user behaviour
-- analytics for personalized content and recommendations" the MVP requirements
-- list as a Could Have, and it becomes the third taste signal feeding
-- match_recommendations alongside stated priorities and saved listings.
--
-- Scope is deliberately narrow. It records that a signed-in user opened a
-- property detail page, and nothing else -- no search terms, no scroll depth,
-- no dwell time, no page graph, no anonymous visitors. The data never leaves
-- the owning user's own recommendations: RLS scopes every row to auth.uid(),
-- and the only consumer is an RPC that ranks listings for that same user.
--
-- It is opt-out from the account settings page, which also clears history.
-- The RPC reads the toggle directly, so switching it off stops influencing
-- recommendations immediately, whether or not the rows have been deleted yet.
--
-- One row per (user, property) rather than an append-only event log: the
-- signal wanted is "which places is this person interested in", not a
-- clickstream. Collapsing repeat visits keeps the table small, makes "most
-- recent N distinct properties" a plain ORDER BY, and stores markedly less
-- about the person than a full event history would.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.property_views (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id BIGINT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  view_count INT DEFAULT 1 NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

-- Serves both the recency ordering the RPC needs and the settings page's
-- "recently viewed" list.
CREATE INDEX IF NOT EXISTS property_views_user_recent_idx
  ON public.property_views (user_id, last_viewed_at DESC);

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

-- A user may only ever see, record, or erase their own history. There is no
-- policy allowing anyone -- including a seller whose listing was viewed -- to
-- read someone else's rows.
CREATE POLICY "Users can view their own browsing history"
  ON public.property_views FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record their own views"
  ON public.property_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own view counts"
  ON public.property_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE exists here, unlike offers and cma_reports: erasing your own
-- behaviour history has to actually erase it.
CREATE POLICY "Users can clear their own browsing history"
  ON public.property_views FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies alone are not enough on this Supabase version; without the GRANT
-- every query fails with 42501 regardless of the policies above.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_views TO authenticated;

-- ----------------------------------------------------------------------------
-- Atomic upsert. PostgREST cannot express "increment on conflict", and doing it
-- as select-then-write is two round trips with a race between them.
--
-- SECURITY INVOKER on purpose, unlike the match_* functions: this one writes,
-- and it should stay behind the RLS policies above rather than around them. It
-- also honours the tracking opt-out, so a client that keeps calling after the
-- user opted out records nothing.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_property_view(p_property_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF NOT COALESCE(
    (SELECT (p.metadata->>'trackActivity')::BOOLEAN FROM public.profiles p WHERE p.id = auth.uid()),
    TRUE
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.property_views (user_id, property_id)
  VALUES (auth.uid(), p_property_id)
  ON CONFLICT (user_id, property_id) DO UPDATE
    SET view_count = public.property_views.view_count + 1,
        last_viewed_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_property_view(BIGINT) TO authenticated;
