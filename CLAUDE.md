# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Next.js dev server on port 3050 (turbo)
npm run build
npx eslint .     # NOT `npm run lint` — see below
npm run seed     # tsx scripts/seed.ts — ingests scripts/seed_data.json into Supabase + generates embeddings
```

`npm run lint` is broken: the script is `next lint`, which this Next version removed, so it parses `lint` as a directory and fails with "Invalid project directory". Run ESLint directly instead.

Local Supabase stack (project id `dwellingly`, API on :54321, DB on :54322):

```bash
npx supabase start
npx supabase db reset   # re-applies supabase/migrations/* then supabase/seed.sql
```

Data pipeline (run in this order when rebuilding listing data):

```bash
python scripts/process_realtor_data.py     # data/realtor-data.zip.csv -> scripts/seed_data.json + supabase/seed_realtor.sql
npx supabase db reset                      # load the new properties before embedding them
npx tsx scripts/generate_embeddings.ts     # reads properties from DB -> writes supabase/seed_vectors.sql
npx supabase db reset                      # re-apply seed with the freshly generated embeddings
```

`process_realtor_data.py` filters `data/realtor-data.zip.csv` to `state == "Texas"` and fills the 100-row cap Austin-metro-first (Austin, Round Rock, Cedar Park, Pflugerville, Georgetown, Leander, Kyle, Buda, San Marcos, Dripping Springs, Manor, Hutto, Lakeway, Bee Cave, Taylor), backfilling from the rest of Texas only if Austin metro doesn't fill 100 rows. This matters because the raw CSV (the Kaggle "USA Real Estate Dataset") is **not shuffled** — it opens with an unbroken ~2,260-row block of Puerto Rico listings before anything else. Capping at the first N rows without a state filter silently produces a Puerto Rico-only dataset regardless of what city the app claims to be about; this happened once and shipped a seed set with zero Texas properties. If you ever raise/remove the row cap or point this script at a different source CSV, re-verify the state/city distribution before assuming it's still Austin-relevant.

`generate_embeddings.ts` reads properties **from the live DB**, so the properties must already be seeded before you run it — that's why the pipeline resets twice: once to load the new `seed_realtor.sql` rows, once to apply the `seed_vectors.sql` it produces. It fetches and re-embeds *all* properties, including the hand-seeded ids 1-3, via `ON CONFLICT (property_id) DO UPDATE` — so despite `seed.sql` inserting `array_fill` placeholder vectors for ids 1-3, running this pipeline overwrites them with real embeddings too, as long as it's run after `seed.sql` has loaded. Don't assume ids 1-3 have dummy vectors without checking `property_vectors` — it depends on whether the embedding pipeline has been run since the last reset.

There are only 14 stock photo URLs in `REAL_ESTATE_PHOTOS`, and `PropertyCard` only ever renders `photos[0]` on the search grid. Cover photos are assigned round-robin across the pool (once per selected listing, not per CSV row) rather than via independent `random.sample()`, specifically so the grid doesn't visibly cluster the same photo onto a third of the cards — it did, before this was fixed. If you add more stock photos to the pool, the round-robin still applies automatically; if you ever revert to per-row random sampling, expect the clustering to come back.

`npx supabase db reset` occasionally fails transiently with `error running container: exit 1` during "Initialising schema" (Docker flakiness, not a real schema error) — just retry the same command.

There is no test framework. `scripts/test_ai_tool_search.ts` and `scripts/test_full_ai_chat.ts` are manual end-to-end probes against a live DB + Gemini key — run individually with `npx tsx scripts/test_full_ai_chat.ts`.

Dev auth shortcut: `GET /api/dev/login` signs in as the seeded seller (`seller.sarah@dwellingly.ai` / `password123`) and redirects to `/search`. It 403s outside `NODE_ENV=development`.

Scripts parse `.env.local` by hand (no dotenv) — they read `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.

## Architecture

Next.js 16 App Router + React 19, Supabase (Postgres + auth + pgvector), Google Gemini via `@google/genai`. Tailwind v4 through `@tailwindcss/postcss`; no `tailwind.config` file. Path alias `@/*` maps to the repo root.

### Three layers, one Supabase client

`lib/supabase/server.ts` exports the only Supabase factory — an `@supabase/ssr` cookie-backed server client. Everything server-side goes through it: Server Actions (`app/actions/*`), route handlers (`app/api/*`), and AI tool executors. There is no browser client and no middleware session refresh; client components reach the DB by calling Server Actions or fetching route handlers.

RLS is on for every table (`supabase/migrations/20240101000002_rls_policies.sql`) and is the real authorization boundary — the cookie identity is what policies see. Inserting properties requires the caller's profile role to be `seller`/`agent`/`admin`, which is why `scripts/seed.ts` signs in as the seed seller before inserting.

### Semantic search path

The one flow worth understanding end to end:

1. `generateEmbedding()` in `lib/ai/client.ts` → `gemini-embedding-001` with `outputDimensionality: 768`.
2. `supabase.rpc('match_properties', ...)` → a `SECURITY DEFINER` plpgsql function over `property_vectors` using an HNSW cosine index, with city/price/bed/bath filters applied inline and `status = 'active'` hardcoded.
3. Results are normalized with `id: p.id ?? p.property_id` — **the RPC returns `property_id`, not `id`**, so anything consuming raw RPC rows must do this mapping.

The 768 dimension is fixed in three places that must stay in sync: the embedding call, `vector(768)` in `20240101000001_enable_pgvector.sql`, and the `match_properties` signature. Two callers exist with different thresholds: `app/actions/search.ts` (0.15 / 12 results) for the search page, and `executeSearchProperties` in `lib/ai/tools.ts` (0.2 / 6) for the AI agent.

### AI agent loop

All Gemini calls use the **Interactions API** (`ai.interactions.create`), not `generateContent`. Conversation state is server-side: the client holds only an `interactionId` and passes it back as `previous_interaction_id`.

`lib/ai/chat.ts` `streamAgentChat()` is an async generator implementing manual function calling:

1. Stream the first interaction; yield `interaction_id` and `token` events.
2. If the completed interaction is `requires_action`, re-fetch it with `ai.interactions.get()`, dispatch each function call by name against the executors in `lib/ai/tools.ts`, and yield a `tool_executed` event so the UI can render property cards.
3. Re-prompt with `function_result` inputs to stream the final prose.

`app/api/chat/route.ts` wraps that generator in an SSE `ReadableStream` (`data: {...}\n\n`, terminated by `data: [DONE]`). Tool declarations and their executors live side by side in `lib/ai/tools.ts` — adding a tool means updating the declaration, `ALL_AGENT_TOOLS`, the executor, and the dispatch `if/else` in `chat.ts`.

Model IDs are centralized in `GEMINI_MODELS` (`lib/ai/client.ts`) — chat/vision on `gemini-3.6-flash`, CMA reasoning on `gemini-3.1-pro-preview`, staging on `gemini-3.1-flash-image`. Never hardcode a model string elsewhere. Note `lib/ai/client.ts` throws at import time if `GEMINI_API_KEY` is unset, so any module importing it fails without a key.

**Stream events carry `event_type`, not `type`.** A streamed event looks like `{ index, delta: { type: 'text', text }, event_type }` — there is no top-level `type` field, so any check like `event.type === 'step.delta'` is dead code and silently yields nothing. Text arrives as `delta.type === 'text'`; other deltas (e.g. `thought_signature`) carry no text and must be skipped. `extractTextDelta()` in `lib/ai/chat.ts` is the single place that decodes this, and both stream loops go through it — don't re-inline the check. Note this is *not* the same shape as `interaction.steps[]`, which the CMA and image paths read via `steps.at(-1).content[0]`.

**Interactions API parameter shapes** (verified against the hosted docs — get these wrong and the call 400s):

- `response_format` is **top-level**, not nested inside `generation_config`: `{ type: 'text', mime_type: 'application/json', schema }`.
- Reasoning effort is `generation_config.thinking_level` (`minimal`/`low`/`medium`/`high`). The older `thinking_config.thinking_budget` is rejected with `400 Unknown parameter 'thinking_config' at 'generation_config'`.
- Prefer `interaction.output_text` over digging through `steps.at(-1).content[0].text`.

Structured output: `lib/ai/cma.ts` passes a hand-written JSON Schema plus a `thinking_budget` and parses the last step's text; `lib/ai/image.ts` does the same for vision analysis and requests `response_format: { type: 'image' }` for staging. Both dig results out with `interaction.steps?.at(-1)?.content?.[0]` — SDK response shapes here are loosely typed and littered with `as any`.

**Maps grounding** replaced the old `getNeighborhoodStats` tool, which was fully fabricated (hardcoded walk score, crime index, etc. — never actually called any external API). `buildTools()` in `lib/ai/chat.ts` appends `{ type: 'google_maps' }` to `ALL_AGENT_TOOLS`; it's a **built-in** tool, not a custom function — Gemini resolves it server-side and never emits a `function_call` step for it, so there is no executor to write. It *can* land in the same turn as a pending custom `function_call` (combined tools), so citation extraction runs regardless of whether `requires_action` fired. Citations arrive as `place_citation` annotations on `model_output` step content blocks — not on streamed deltas — so `extractCitations()` always re-fetches the full interaction via `ai.interactions.get()` after a turn completes; there's no way to get them from the stream alone. `streamAgentChat()` takes an optional `propertyContext` (address/city/state/zip, optionally lat/lng) that both biases the `google_maps` tool and gets folded into the system instruction; `AppShell` captures it from the `dwellingly:open-ai` event's `detail` payload, so any page can open the assistant pre-grounded to a specific property by dispatching `new CustomEvent('dwellingly:open-ai', { detail: {...} })` (see `PropertyDetail.tsx`'s "Ask about this neighborhood" button). `properties.latitude`/`longitude` exist as columns but are never populated by the seed pipeline — the Kaggle CSV has no lat/lng field — so grounding currently relies on the textual address alone.

### Design system

The visual language is defined by `files/stitch_dwellingly_ai_assistant/dwellingly/DESIGN.md` (Stitch mockups, with `screen.png` + `code.html` per screen). It's a **Microsoft Fluent** aesthetic: light Mica surfaces, Acrylic overlays, Deep Navy `#2c0a75` anchoring a sparing Intelligent Teal `#07ffcb` accent used only for AI affordances and success.

Those tokens live in `app/globals.css` under Tailwind v4's `@theme`, which generates the utilities — `bg-navy`, `text-ink-muted`, `border-hairline`, `rounded-card`, `shadow-fab`, `text-headline-lg`. **Use the semantic tokens, not raw palette classes** (`text-ink`, not `text-slate-900`); the old slate/indigo classes are leftovers from the previous look. Fonts come from `next/font` in `app/layout.tsx` and bind to `--font-inter` (body, via `font-sans`) and `--font-jakarta` (headlines, via `font-display`).

The design is **light-only** — `:root { color-scheme: light }` is set deliberately so an OS dark-mode preference can't repaint it. Don't add `dark:` variants to redesigned components.

Every screen is converted. The mockup set in `files/stitch_dwellingly_ai_assistant/` carries **three different wordmarks** — Dwellingly, "EstatePulse AI" (staging) and "EstateFlow" (offer flow) — and the offer screens disagree with each other on the stepper (3 vs 4 steps). The app standardises on **Dwellingly** and a **3-step** offer flow; treat the wordmarks and the 4-step "Documents" screen as mockup drift, not a spec.

The guided offer flow is a route, `/properties/[id]/offer` (`components/offer/OfferWizard.tsx`), not a modal — the old `OfferModal` was removed. Its AI Strategy Guide range and Market Context comps read from the most recent `cma_reports` row for that property, so it degrades gracefully to "generate a valuation first" when none exists.

Mockup controls are wired to real behaviour rather than left decorative — search AI-preferences fold into the embedded query, property-type and sort filter client-side, match % is the real cosine similarity, and the detail-page investment calculator is a real amortisation. Where a feature doesn't exist (map view) the control is rendered visibly `disabled` instead of faked.

Content deep in the tree can raise the AI assistant by dispatching `window.dispatchEvent(new CustomEvent('dwellingly:open-ai'))`; `AppShell` listens for it. That avoids threading the open/close state through every page.

### Integrations

`lib/integrations/{stripe,twilio,docusign}.ts` all no-op gracefully when credentials are absent, returning `{ success: true, simulated: true }` or a fake envelope ID. Local development works without any of these keys.

`stripe.ts` and `docusign.ts` have real, verified implementations when credentials are present, but neither is called from anywhere in the app yet (`createEarnestMoneyCheckoutSession` and `sendOfferContractForSignature` are both orphaned — no Server Action or button triggers them). A real webhook receiver exists at `app/api/webhooks/stripe/route.ts` (`stripe listen --forward-to localhost:3050/api/webhooks/stripe`), which marks `offers.stripe_checkout_session_id`/`earnest_money_paid_at` via the service-role client on `checkout.session.completed`, matched on `session.metadata.offerId`/`type`.

DocuSign uses **JWT Grant**, not Authorization Code Grant — `sendOfferContractForSignature` is server-initiated with no interactive login, so it needs `DOCUSIGN_ACCOUNT_ID` (the GUID **API Account ID**, not the numeric account number shown in the console sidebar), `DOCUSIGN_USER_ID` (the GUID **User ID**, easy to swap with Account ID since both are GUIDs — check the DocuSign console's "My Account Information" panel carefully), `DOCUSIGN_INTEGRATION_KEY`, and `DOCUSIGN_PRIVATE_KEY` (RSA private key from the console's Service Integration section; must be quoted in `.env.local` since dotenv only supports multi-line PEM values inside matching quotes — unquoted, only the first line parses). JWT Grant also requires a one-time interactive consent visit to `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=...&redirect_uri=...` per user, where `redirect_uri` must exactly match a URI registered (and saved — the page needs an explicit bottom Save, not just "Add URI") in the app's console settings. `buildJwtAssertion()`/`getAccessToken()` in `docusign.ts` sign and exchange the JWT using Node's built-in `crypto` module — no external JWT library.

## Gotchas

- **New tables need an explicit `GRANT`.** This Supabase version does not auto-expose tables created by migrations to `anon`/`authenticated`/`service_role`, and `auto_expose_new_tables` is left commented out in `supabase/config.toml`. GRANTs and RLS are independent layers: the GRANT decides whether the role may touch the table at all, RLS then filters rows. A table with policies but no GRANT fails every query with `42501 permission denied`. `20260730000001_grant_data_api_roles.sql` grants the existing tables per-operation to match their policies — **any new table needs a matching GRANT added there or in its own migration.**
- **Seed order is load-bearing.** `sql_paths` runs `seed.sql` → `seed_realtor.sql` → `seed_vectors.sql`, and each depends on the previous. `seed.sql` inserts ids 1-3 explicitly, which does *not* advance the `GENERATED BY DEFAULT AS IDENTITY` sequence, so it ends with a `setval` — without that, `seed_realtor.sql` (which omits ids) restarts at 1 and dies on the primary key. Realtor rows therefore occupy ids 4-103, and `seed_vectors.sql` hardcodes those absolute ids. Reordering the list, or inserting ids in `seed.sql` without updating the vector ids, silently misaligns embeddings against listings.
- `seed_vectors.sql` is generated by `scripts/generate_embeddings.ts` from whatever ids are live at the time. If you regenerate it, do so against a freshly reset DB or its ids will not match. To check alignment: every `property_vectors.content_summary` should contain its joined property's zip (100/100 for ids 4-103). `seed.sql` inserts `array_fill` placeholder vectors for ids 1-3, but `generate_embeddings.ts` re-embeds *every* property in the DB (including 1-3) and upserts via `ON CONFLICT (property_id) DO UPDATE` — so after running the full pipeline, ids 1-3 have real embeddings too, not the placeholders.
- `offers` and `cma_reports` have no DELETE policy and no DELETE grant, so a `.delete()` on them silently affects zero rows instead of erroring. Offers are retired by setting `status` to `withdrawn`/`rejected`.
- `offers` uses `buyer_id`, not `user_id` — unlike `favorites`, `viewings`, and `cma_reports`, which all use `user_id`. The RLS insert policy is `WITH CHECK (auth.uid() = buyer_id)`, so getting this wrong fails the policy rather than erroring on a missing column.
- `lib/ai/tools.ts` falls back to a bare anon-key client when the cookie client can't be constructed (i.e. outside a request scope, as in the test scripts). That fallback has no user identity, so RLS-protected writes will fail there.
- Comments across `lib/ai/` and the migrations still reference older model names (`text-embedding-004`, `gemini-2.5-flash-image`); the code in `GEMINI_MODELS` is authoritative.
