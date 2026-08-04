-- ============================================================================
-- DWELLINGLY.AI - OFFER FINANCING TERMS
-- Migration: 20260804000002_offers_financing.sql
-- The Offer Comparison Matrix compares offers on financing strength, which the
-- offer flow had no way to record. Collected in OfferWizard step 1.
-- ============================================================================

ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS financing_type TEXT
    CHECK (financing_type IN ('conventional', 'fha', 'va', 'cash', 'other'));

-- Absolute dollars, not a percentage -- the percentage is derived against
-- offer_amount so it stays correct if the offer is later countered.
-- NULL for all-cash offers.
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS down_payment NUMERIC(18, 2) CHECK (down_payment >= 0);
