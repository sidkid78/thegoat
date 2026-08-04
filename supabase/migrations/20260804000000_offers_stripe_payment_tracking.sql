-- Tracks the Stripe Checkout session used for an offer's earnest money
-- deposit, and when the webhook confirmed payment. Written only by the
-- service-role webhook handler (app/api/webhooks/stripe/route.ts), which
-- bypasses RLS -- these are not meant to be client-writable.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS earnest_money_paid_at TIMESTAMPTZ;
