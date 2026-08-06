-- ============================================================================
-- DWELLINGLY.AI - AREA MARKET TRENDS
-- Migration: 20260806000000_market_trends.sql
--
-- Monthly housing-market history per zip code, from the Redfin Data Center
-- (redfin.com/news/data-center) -- free, aggregated, publicly downloadable
-- market-trend data. Redfin has no REST API; the Data Center publishes
-- compressed TSVs to S3 on the third Friday of each month.
--
-- This backs the property detail page's "the area's historical pricing data or
-- market trends" requirement. It is deliberately **area-level, not
-- property-level**: this table says what the zip code did, never what a
-- specific listing sold for. The seeded listings come from a Kaggle export and
-- have no real transaction history, so any per-property price chart would be
-- fabricated. Keeping the grain at the zip is what makes this honest.
--
-- Keyed on (zip_code, period_begin) rather than a synthetic id: there is
-- exactly one "All Residential" observation per zip per month, and the natural
-- key makes a monthly refresh a plain upsert.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.market_trends (
  zip_code TEXT NOT NULL,
  period_begin DATE NOT NULL,
  -- No city column: the zip-code tracker leaves Redfin's CITY field empty on
  -- every row (verified across all 6,978 observations), so it would be a
  -- permanently NULL column implying data that isn't there.
  median_sale_price NUMERIC(18, 2),
  median_ppsf NUMERIC(12, 2),
  homes_sold INT,
  new_listings INT,
  inventory INT,
  median_dom INT,
  -- Redfin ships year-over-year as a fraction (0.0842 = +8.42%); stored as
  -- given rather than pre-multiplied so the raw file round-trips unchanged.
  median_sale_price_yoy NUMERIC(10, 6),
  PRIMARY KEY (zip_code, period_begin)
);

-- The property detail page always asks for one zip ordered by period, which
-- the primary key already serves. No extra index needed.

ALTER TABLE public.market_trends ENABLE ROW LEVEL SECURITY;

-- Matches the properties SELECT policy: active listings are viewable by
-- everyone, so the market context beside them must be too.
CREATE POLICY "Market trends are viewable by everyone"
  ON public.market_trends FOR SELECT
  TO public
  USING (true);

-- No INSERT/UPDATE/DELETE policies and no write grants on purpose. This is
-- reference data loaded by supabase/seed_market_trends.sql during a db reset,
-- or refreshed out of band with the service role; nothing in the app writes it.
--
-- Per the note in 20260730000001_grant_data_api_roles.sql, this Supabase
-- version does not auto-expose new tables to the Data API roles, so without
-- this GRANT every read fails with 42501 regardless of the policy above.
GRANT SELECT ON public.market_trends TO anon, authenticated;
