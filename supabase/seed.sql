-- ============================================================================
-- DWELLINGLY.AI / NEXHOMEAGENT AI - SEED DATA FOR TESTING & PREVIEW DEMOS
-- File: supabase/seed.sql
-- Includes realistic listings and sample dummy 768-dim embeddings for vector search testing.
-- ============================================================================

-- 1. SEED TEST PROFILES (Simulating Auth Users)
-- Insert into auth.users first to satisfy foreign key constraint and trigger
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'seller.sarah@dwellingly.ai', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Sarah Jenkins (Seller)", "role": "seller", "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'buyer.alex@dwellingly.ai', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Alex Vance (Buyer)", "role": "buyer", "avatar_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"}', NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Update the auto-created profiles with phone numbers if needed
UPDATE public.profiles SET phone = '512-555-0192' WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET phone = '512-555-0144' WHERE id = '22222222-2222-2222-2222-222222222222';

-- 2. SEED PROPERTIES (Austen/Central Texas Mock Listings)
INSERT INTO public.properties (id, owner_id, address, city, state, zip_code, price, bedrooms, bathrooms, square_feet, property_type, description, features, photos, status)
VALUES
  (
    1,
    '11111111-1111-1111-1111-111111111111',
    '704 Barton Springs Rd',
    'Austin',
    'TX',
    '78704',
    875000.00,
    3,
    2.5,
    2200,
    'single_family',
    'Modern luxury home near Zilker Park featuring solar panels, open-concept floor plan, private pool, and EV charging station in garage.',
    '{"hasPool": true, "garageSpaces": 2, "yearBuilt": 2022, "evCharger": true, "solarPanels": true, "hoaFeeMonthly": 0}'::jsonb,
    '["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c"]'::jsonb,
    'active'
  ),
  (
    2,
    '11111111-1111-1111-1111-111111111111',
    '1208 Rainey St',
    'Austin',
    'TX',
    '78701',
    540000.00,
    2,
    2.0,
    1150,
    'condo',
    'High-rise luxury condo in downtown Rainey Street historic district. Skyline views, concierge service, rooftop lounge, and fitness center.',
    '{"hasPool": true, "garageSpaces": 1, "yearBuilt": 2020, "rooftopDeck": true, "hoaFeeMonthly": 420}'::jsonb,
    '["https://images.unsplash.com/photo-1567496898669-ee935f5f647a", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750"]'::jsonb,
    'active'
  ),
  (
    3,
    '11111111-1111-1111-1111-111111111111',
    '4501 East 5th St',
    'Austin',
    'TX',
    '78702',
    699000.00,
    4,
    3.0,
    2450,
    'townhouse',
    'Craftsman-style East Austin townhouse with private backyard, high ceilings, custom quartz kitchen, and accessory dwelling unit (ADU) potential.',
    '{"hasPool": false, "garageSpaces": 1, "yearBuilt": 2021, "aduPotential": true, "hoaFeeMonthly": 120}'::jsonb,
    '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c"]'::jsonb,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to allow auto-increment after seed IDs
SELECT setval('properties_id_seq', (SELECT MAX(id) FROM public.properties));

-- 3. SEED DUMMY VECTOR EMBEDDINGS FOR PGVECTOR TESTING
-- Note: In production, vectors are generated dynamically via Google text-embedding-004 API
INSERT INTO public.property_vectors (property_id, content_summary, embedding)
VALUES
  (
    1,
    'Modern luxury home Austin TX Barton Springs Zilker Park 3 bed 2.5 bath pool solar panels EV charger single family $875,000',
    array_fill(0.035::real, ARRAY[768])::vector
  ),
  (
    2,
    'High rise luxury condo downtown Rainey St Austin TX 2 bed 2 bath skyline views rooftop pool fitness center $540,000',
    array_fill(0.012::real, ARRAY[768])::vector
  ),
  (
    3,
    'East Austin townhouse craftsman 4 bed 3 bath private backyard quartz kitchen near downtown $699,000',
    array_fill(-0.021::real, ARRAY[768])::vector
  )
ON CONFLICT (property_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. ADVANCE THE PROPERTIES IDENTITY SEQUENCE
-- The listings above are inserted with explicit ids, which does NOT advance the
-- GENERATED BY DEFAULT AS IDENTITY sequence. Without this, the next seed file
-- (seed_realtor.sql, which omits ids) would restart at 1 and collide on the
-- primary key. Keep this last in the file.
-- ----------------------------------------------------------------------------
SELECT setval(
  pg_get_serial_sequence('public.properties', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM public.properties),
  true
);
-- ----------------------------------------------------------------------------
-- 5. COMPETING OFFERS ON LISTING 1 (Offer Comparison Matrix demo fixture)
-- Three buyers bidding on 704 Barton Springs Rd, deliberately spread across the
-- axes the matrix compares: over-ask-but-financed vs at-ask cash vs
-- over-ask-with-every-contingency. Ids are omitted so the offers identity
-- sequence advances normally and stays usable by the app.
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'buyer.morgan@dwellingly.ai', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Morgan Davis", "role": "buyer"}', NOW(), NOW(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'buyer.chen@dwellingly.ai', crypt('password123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{"full_name": "Priya Chen", "role": "buyer"}', NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.offers (property_id, buyer_id, offer_amount, earnest_money, contingencies, proposed_closing_date, financing_type, down_payment, status, created_at)
VALUES
  -- Over ask, conventional with 20% down, waives inspection.
  (1, '22222222-2222-2222-2222-222222222222', 905000.00, 20000.00, '["Financing", "Appraisal"]'::jsonb, CURRENT_DATE + 21, 'conventional', 181000.00, 'submitted', NOW() - INTERVAL '3 days'),
  -- At ask, all cash, waives everything -- fastest, most certain close.
  (1, '33333333-3333-3333-3333-333333333333', 875000.00, 50000.00, '[]'::jsonb, CURRENT_DATE + 11, 'cash', NULL, 'submitted', NOW() - INTERVAL '2 days'),
  -- Highest price but FHA with 3.5% down and every contingency intact.
  (1, '44444444-4444-4444-4444-444444444444', 915000.00, 10000.00, '["Inspection", "Financing", "Appraisal"]'::jsonb, CURRENT_DATE + 52, 'fha', 32025.00, 'submitted', NOW() - INTERVAL '1 day')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. BUYER SHORTLIST (Property Evaluation Hub demo fixture)
-- The hub compares saved properties, so it needs a shortlist to compare.
--
-- These reference ids 1-3 specifically: this file runs BEFORE seed_realtor.sql
-- in `sql_paths`, so favoriting a realtor listing (ids 4-103) here would fail
-- the foreign key. Ids 1-3 also carry real embeddings from seed_vectors.sql, so
-- match % scores against them are meaningful rather than uniform -- and they're
-- deliberately distinct (pool house / downtown condo / townhouse) so different
-- stated priorities visibly reorder them.
-- ----------------------------------------------------------------------------
INSERT INTO public.favorites (user_id, property_id)
VALUES
  ('22222222-2222-2222-2222-222222222222', 1),
  ('22222222-2222-2222-2222-222222222222', 2),
  ('22222222-2222-2222-2222-222222222222', 3)
ON CONFLICT DO NOTHING;
