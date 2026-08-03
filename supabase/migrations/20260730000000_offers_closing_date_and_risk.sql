-- ============================================================================
-- DWELLINGLY.AI / NEXHOMEAGENT AI - OFFERS SCHEMA ALIGNMENT
-- Migration: 20260730000000_offers_closing_date_and_risk.sql
-- Adds columns the offer submission flow already collects but could not persist.
-- ============================================================================

-- Proposed closing date is collected in OfferModal and rendered on the dashboard.
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS proposed_closing_date DATE;

-- Structured risk/compliance output from the Gemini review in POST /api/offers.
-- Shape: { "riskScore": number, "insights": string[], "suggestedContingencies": string[] }
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS ai_risk_assessment JSONB DEFAULT '{}'::jsonb NOT NULL;
