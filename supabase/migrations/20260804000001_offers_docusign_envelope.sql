-- Tracks the DocuSign envelope sent for an offer's purchase agreement, set by
-- acceptOfferAction (app/actions/offers.ts) when a seller accepts an offer.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT;
