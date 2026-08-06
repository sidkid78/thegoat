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

Dev auth shortcut: `GET /api/dev/login` signs in as the seeded seller (`seller.sarah@dwellingly.ai` / `password123`) and redirects to `/search`; `?as=buyer` signs in as `buyer.alex@dwellingly.ai` instead — needed for testing the offer flow, since accept/reject is seller-only and paying earnest money is buyer-only. `?next=/some/path` returns you there instead of `/search` (relative paths only — an absolute URL would make this an open redirect). It 403s outside `NODE_ENV=development`.

The route calls `signOut()` before signing in. `npx supabase db reset` wipes `auth.users` while the browser keeps its cookies, leaving a refresh token that no longer resolves; every later request then fails with `Invalid Refresh Token` and a fresh sign-in never takes hold until the stale cookie is cleared. This is the usual explanation for "I hit /api/dev/login but the app still says signed out" after a reset.

The navbar's profile icon is an account menu (`components/layout/AccountMenu.tsx`) showing the signed-in identity, role, a dev-only buyer/seller switcher, and sign out. The identity is resolved **once per request in `app/layout.tsx`** (a server component) and threaded down as `account` through `AppShell` → `Navbar` → `AccountMenu` — those three are all client components with no way to reach Supabase themselves. Signed out, the menu offers "Sign in" / "Create account"; the dev switcher stays available alongside them in development.

Real auth lives at `/login` and `/signup`, both rendering `components/auth/AuthForm.tsx` with a `mode` prop, backed by `signInAction`/`signUpAction` in `app/actions/auth.ts`. Signup writes `full_name` and `role` into the auth user's metadata, where the pre-existing `handle_new_user` trigger reads them to create the `profiles` row — that trigger is the only writer of `profiles`, and the app has no INSERT grant on it. Only `buyer`/`seller` are offered at signup; `agent`/`admin` are assigned out of band. Both pages redirect an already-signed-in visitor rather than showing a form that would silently replace their session, and `?next=` is filtered through `safeRedirectPath()` in `lib/safe-redirect.ts` (a plain module, not a `'use server'` export — everything exported from one of those becomes a callable network endpoint).

`enable_confirmations = false` in `supabase/config.toml`, so `signUp` returns a live session and the user lands signed in. Turn confirmations on and there is no session on the returned payload; `signUpAction` detects that and tells them to check their email rather than redirecting into an app that still sees a guest. There is no email-confirmation callback route yet — that has to be built before confirmations can be enabled.

The dev switcher marks the current account by **email, not role**. Role was a fine proxy when the two seed users were the only way in; now that anyone can register, a self-registered seller would otherwise light up the Sarah Jenkins row as "Current".

Scripts parse `.env.local` by hand (no dotenv) — they read `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`.

## Architecture

Next.js 16 App Router + React 19, Supabase (Postgres + auth + pgvector), Google Gemini via `@google/genai`. Tailwind v4 through `@tailwindcss/postcss`; no `tailwind.config` file. Path alias `@/*` maps to the repo root.

### Three layers, one Supabase client

`lib/supabase/server.ts` exports the only Supabase factory — an `@supabase/ssr` cookie-backed server client. Everything server-side goes through it: Server Actions (`app/actions/*`), route handlers (`app/api/*`), and AI tool executors. Client components reach the DB by calling Server Actions or fetching route handlers.

Session refresh happens in **`proxy.ts` at the repo root** — Next 16 renamed the `middleware` file convention to `proxy`, and it now defaults to the Node.js runtime (setting `runtime` in it throws). It exists because access tokens expire after `jwt_expiry` (an hour) and a Server Component can read cookies but never write them: without this, an expired token can't be refreshed from a page render and the user is silently signed out. It calls `getUser()` rather than `getSession()` so the token is revalidated against the auth server instead of trusted from the cookie. Its `setAll` writes refreshed cookies onto **both** the request and the response — skip the request half and Server Components rendering later in that same request still read the stale token and show a signed-out user for one page load. The matcher excludes `_next/*` and anything with a file extension so static assets don't each pay for an auth round-trip.

RLS is on for every table (`supabase/migrations/20240101000002_rls_policies.sql`) and is the real authorization boundary — the cookie identity is what policies see. Inserting properties requires the caller's profile role to be `seller`/`agent`/`admin`, which is why `scripts/seed.ts` signs in as the seed seller before inserting.

### Semantic search path

The one flow worth understanding end to end:

1. `generateEmbedding()` in `lib/ai/client.ts` → `gemini-embedding-001` with `outputDimensionality: 768`.
2. `supabase.rpc('match_properties', ...)` → a `SECURITY DEFINER` plpgsql function over `property_vectors` using an HNSW cosine index, with city/price/bed/bath filters applied inline and `status = 'active'` hardcoded.
3. Results are normalized with `id: p.id ?? p.property_id` — **the RPC returns `property_id`, not `id`**, so anything consuming raw RPC rows must do this mapping.

There are now **three** functions over the same cosine index, and it's worth knowing which is which:

| Function | Ranks | Against | Used by |
| --- | --- | --- | --- |
| `match_properties` | whole catalogue | a typed query | search page, AI agent |
| `match_favorites` | the user's shortlist | one preference embedding | `/evaluate` |
| `match_recommendations` | whole catalogue | inferred taste | `/dashboard` |

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

The **Property Evaluation Hub** (`/evaluate`, `components/evaluate/PropertyEvaluationHub.tsx`) compares a buyer's `favorites` side-by-side. It's reachable from the navbar's "Portfolio" link, which previously pointed at `/dashboard` — duplicating the first nav item and leaving two links permanently active together.

- **Match %** is real cosine similarity, but the hub has no typed query to score against, so the buyer states priorities instead. They're persisted to `profiles.metadata.buyerPreferences` (a jsonb column that already exists — no new table) and embedded via `composePreferenceText()`. `BUYER_PRIORITIES` reuses the exact phrases `PropertySearch` folds into its query, so a listing that ranked well in search ranks well here. `match_favorites` (`20260804000003_match_favorites.sql`) inverts `match_properties`: fixed property set, one preference embedding. It's `SECURITY DEFINER` but scopes to `auth.uid()` internally rather than taking a user id parameter, so it can't be used to read someone else's shortlist. **No preferences means no badge** — there's nothing to match against, and a made-up number is worse than none. Expect scores in the 0.5–0.7 band, not the mockup's 85–98%; that's just what cosine similarity on these embeddings returns.
- **ROI** in the mockup was invented. The real figure is a **gross rental yield** — `estimatedMonthlyRentalIncome × 12 / price` off the property's most recent `cma_reports` row — labelled "gross" because it's before tax, insurance, maintenance and vacancy. It's absent with a "generate a CMA" link when no valuation exists, the same graceful degradation `OfferWizard` uses.
- **AI Neighborhood Vibe** is real Maps grounding (`lib/ai/neighborhood.ts`), behind a per-card button rather than run on load — it's a paid grounded call per property and a shortlist can hold a dozen. Same `place_citation` extraction as `chat.ts`, rendered as source chips.
- `BUYER_PRIORITIES` lives in `lib/buyer-preferences.ts`, **not** in `app/actions/evaluation.ts`: a `'use server'` module may only export async functions, and exporting a plain const from one fails the build with *"A 'use server' file can only export async functions, found object."*
- `toggleFavoriteAction` was broken until this page needed it — `favorites` is keyed on the composite `(user_id, property_id)` and has **no `id` column**, so its `.select('id')` failed with `42703` every time, `existing` was always null, un-favoriting silently did nothing and re-clicking collided on the primary key. It now selects and deletes on the composite key.

Mockup controls are wired to real behaviour rather than left decorative — search AI-preferences fold into the embedded query, property-type and sort filter client-side, match % is the real cosine similarity, and the detail-page investment calculator is a real amortisation. Where a feature doesn't exist (map view) the control is rendered visibly `disabled` instead of faked.

The **Recommended for You** shelf on `/dashboard` (`components/dashboard/RecommendedForYou.tsx`) is the "AI-driven property recommendations" the MVP requirements list as a Must Have. `match_recommendations` (`20260805000000_match_recommendations.sql`) blends up to two signals the buyer genuinely produced:

- their stated priorities, embedded from `profiles.metadata.buyerPreferences` — the same object `/evaluate` writes;
- the **centroid of their favorited listings**, computed in Postgres via pgvector's `avg(vector)` so 768-float vectors never cross the wire.

Both are `l2_normalize`d before summing, because `gemini-embedding-001` at `outputDimensionality: 768` does **not** return unit vectors and the longer one would otherwise dominate. The sum is deliberately not halved — cosine distance is scale-invariant, so dividing by two is a no-op.

It is **not** inferred from browsing behaviour. There's no such tracking in this app, and the requirements put behaviour analytics in Could Have, not Must Have. With neither signal present the RPC returns zero rows and the section renders an empty state naming the two ways to fix it — same principle as the hub's missing match badge.

Two exclusions are baked into the SQL: already-favorited listings (finding them again teaches nothing) and the viewer's own listings (`owner_id`), since a seller's own property is never a recommendation for them to buy. Because favorites and preferences are both inputs, `toggleFavoriteAction` and `saveBuyerPreferencesAction` each `revalidatePath('/dashboard')` — without that the shelf silently goes stale. `getRecommendationsAction` swallows embedding failures into an empty result so a missing `GEMINI_API_KEY` can't take the whole dashboard render down. Expect favorites-only scores around 0.8+ (property-to-property similarity) versus the 0.5–0.7 the hub reports for query-to-property; blending a divergent preference in lowers the ceiling, which is correct rather than a regression.

Content deep in the tree can raise the AI assistant by dispatching `window.dispatchEvent(new CustomEvent('dwellingly:open-ai'))`; `AppShell` listens for it. That avoids threading the open/close state through every page.

### Integrations

`lib/integrations/{stripe,twilio,docusign}.ts` all no-op gracefully when credentials are absent, returning `{ success: true, simulated: true }` or a fake envelope ID. Local development works without any of these keys.

`twilio.ts` is **transactional notifications only** — no marketing, no OTP (auth is Supabase's job), no inbound. Everything funnels through `sendSms()`, which swallows every failure into a returned result: notification delivery must never break the action that triggered it, the same principle as a DocuSign failure not rolling back an acceptance. Wired into five places:

- `submitOfferAction` → texts the **seller** that an offer landed
- `acceptOfferAction` / `rejectOfferAction` → text the **buyer** the new status
- `counterOfferAction` (`app/actions/deals.ts`) → texts the **buyer** they were countered
- `scheduleViewingAction` → texts the **booker** a tour confirmation

`toE164()` normalises before sending — profile phones are stored however the user typed them (the seed rows are `512-555-0192`) and Twilio rejects anything that isn't `+15125550192`. It returns `null` for anything unparseable, which callers treat as "no phone on file" rather than an error. The number is set in the navbar account menu (`NotificationPhoneField`) and stored normalised, so the value in `profiles.phone` is send-ready.

Two things that will make texts silently not arrive even with credentials set: **a Twilio trial account can only message numbers verified in the Twilio console**, and the seeded `512-555-xxxx` numbers are not real. Set a real verified number via the account menu to see anything.

`/api/offers` used to be a second, parallel offer-submission path that inserted directly instead of going through `submitOfferAction`. **It was deleted** — nothing called it, it skipped the notification and the financing columns, and it was the last caller of the deprecated `ai.models.generateContent` API. Offers go through `submitOfferAction` only.

That route was also the only writer of `offers.ai_risk_assessment` (added by `20260730000000`), and nothing ever read it — the column is now permanently unwritten. It's left in place rather than dropped; if you want offer risk scoring back, rebuild it on the Interactions API inside `submitOfferAction` where it can actually be surfaced.

`stripe.ts` and `docusign.ts` have real, verified implementations when credentials are present, and both are wired into the offer lifecycle now:

- `acceptOfferAction`/`rejectOfferAction` (`app/actions/offers.ts`) are seller-only (RLS enforces this on the `offers` UPDATE policy — both buyer and the listing-owning seller can update, the action doesn't add its own role check). Accepting sets `status = 'accepted'` and calls `sendOfferContractForSignature()`, storing the result on `offers.docusign_envelope_id`; a DocuSign failure does **not** roll back the acceptance, it's surfaced back to the seller as `docusignError` instead so an integration hiccup can't block a real acceptance.
- `createEarnestMoneyCheckoutAction` (buyer-only, requires `status = 'accepted'`) creates a **fresh** Stripe Checkout session on every call rather than reusing a stored URL — sessions expire, so a "Pay Now" button always needs a new one.
- `app/dashboard/offers/page.tsx` (`SellerOffersInbox`) is the seller's incoming-offers index, filtered via `properties!inner` + `.eq('properties.owner_id', ...)` — offers RLS alone returns both sides (buyer's own offers and offers on owned listings mixed together), so the inner-join filter is what narrows it to just the seller side. It groups rows per listing and links into the comparison matrix at `/dashboard/offers/[propertyId]` (`OfferComparisonMatrix`), which puts each offer in its own column against shared row labels. That page repeats the ownership check explicitly (`property.owner_id !== user.id → notFound()`) rather than relying on RLS: offers RLS lets a buyer read *their own* offer on someone else's listing, so without the check a buyer could load the page and see competing bids. Withdrawn offers are filtered out of the matrix — they're retired by status, not deleted, so they'd otherwise linger as dead columns.
- The matrix's **AI Top Pick** is a real `gemini-3.1-pro-preview` structured-output call (`lib/ai/offer-analysis.ts` → `analyzeOffersAction`), deliberately behind a button rather than run on page load: it's a paid reasoning call and a seller re-reads the page far more often than the offer set changes. It needs ≥2 open offers. "Export PDF" is `window.print()` with `print:hidden` on the controls — there's no PDF generator in the project.
- The **contingencies** row renders all three canonical contingencies (`Inspection`, `Financing`, `Appraisal` — the set `OfferWizard` offers) on every column, striking through the ones a buyer *waived*. An absent contingency is the interesting signal for a seller, and a column that silently omits it hides exactly that.
- `offers.financing_type` / `offers.down_payment` (`20260804000002_offers_financing.sql`) exist because the matrix compares offers on financing strength and nothing recorded it. Collected in `OfferWizard` step 1; `down_payment` is stored in absolute dollars (the percentage is derived against `offer_amount` so it survives a counter) and is `NULL` for `financing_type = 'cash'`.
- `supabase/seed.sql` seeds two extra buyers (Morgan Davis, Priya Chen) and three competing offers on property 1, spread across the axes the matrix compares (over-ask-financed / at-ask-cash / over-ask-with-every-contingency) so the comparison screen has something to compare after a `db reset`. `DashboardView`'s `MyOffersSection` is the buyer-side counterpart, showing "Pay Earnest Money" once accepted and unpaid, or "Check your email to sign" while a DocuSign envelope is out but unpaid.
- The **deal collaboration hub** at `/deals/[offerId]` (`components/deals/CollaborationHub.tsx`) is the negotiation workspace for a single offer: a message thread between the two parties, the live offer terms, and — for the seller only — AI counter guidance. Reached from the "Negotiate" link on both the comparison matrix (seller) and `MyOffersSection` (buyer). Participation is checked explicitly in the page rather than left to RLS, because the page needs to know *which* side the viewer is on.
- `offer_messages` (`20260804000004_offer_messages_and_counters.sql`) hangs off the **offer**, not the property: a property carries several competing offers and those buyers must never see each other's negotiation. It has SELECT/INSERT policies for both parties and deliberately **no UPDATE or DELETE** — a negotiation record shouldn't be rewritable after the fact — with grants narrowed to match.
- The same migration adds `counter_amount` / `counter_concession` / `counter_notes` / `countered_at`. `offers.status` had always accepted `'countered'` but there was nowhere to record what was countered *with*, so the status carried no meaning. `counterOfferAction` is seller-only and also posts the counter into the thread, so it lands in the negotiation record rather than silently changing a panel the buyer may not be looking at.
- **Realtime is used in exactly one place** — the message thread — and it's the app's only live surface; everything else still refreshes via `revalidatePath`. `OfferWizard`'s post-submit "Offer Sent" screen is a one-time snapshot of the initial submit response, not live, and intentionally isn't where accept/reject/pay live.
- `lib/supabase/client.ts` is the app's **only** browser-side Supabase client and exists purely to hold that websocket — the cookie-backed server client can't. Writes still go through Server Actions; don't reach for it to insert or update.
- **`supabase.realtime.setAuth(token)` must run before `.subscribe()`.** `postgres_changes` is filtered by RLS server-side, so an unauthenticated socket matches zero rows: the subscription *succeeds* and simply never fires, which is indistinguishable from a broken feature. The session hydrates from cookies asynchronously, so the effect awaits `getSession()` first. This works only because the Supabase auth cookie is not `HttpOnly`.
- `sendDealMessageAction` returns the inserted row so the sender can append it immediately. Relying on the Realtime echo for your *own* message means staring at an empty thread until the socket round-trips, and at nothing at all if it's down.
- A real webhook receiver exists at `app/api/webhooks/stripe/route.ts` (`stripe listen --forward-to localhost:3050/api/webhooks/stripe`), which marks `offers.stripe_checkout_session_id`/`earnest_money_paid_at` via the service-role client on `checkout.session.completed`, matched on `session.metadata.offerId`/`type`.

DocuSign uses **JWT Grant**, not Authorization Code Grant — `sendOfferContractForSignature` is server-initiated with no interactive login, so it needs `DOCUSIGN_ACCOUNT_ID` (the GUID **API Account ID**, not the numeric account number shown in the console sidebar), `DOCUSIGN_USER_ID` (the GUID **User ID**, easy to swap with Account ID since both are GUIDs — check the DocuSign console's "My Account Information" panel carefully), `DOCUSIGN_INTEGRATION_KEY`, and `DOCUSIGN_PRIVATE_KEY` (RSA private key from the console's Service Integration section; must be quoted in `.env.local` since dotenv only supports multi-line PEM values inside matching quotes — unquoted, only the first line parses). JWT Grant also requires a one-time interactive consent visit to `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=...&redirect_uri=...` per user, where `redirect_uri` must exactly match a URI registered (and saved — the page needs an explicit bottom Save, not just "Add URI") in the app's console settings. `buildJwtAssertion()`/`getAccessToken()` in `docusign.ts` sign and exchange the JWT using Node's built-in `crypto` module — no external JWT library.

## Gotchas

- **New tables need an explicit `GRANT`.** This Supabase version does not auto-expose tables created by migrations to `anon`/`authenticated`/`service_role`, and `auto_expose_new_tables` is left commented out in `supabase/config.toml`. Verified still true on CLI 2.111.0. Note that every role *does* pick up `REFERENCES`, `TRIGGER` and `TRUNCATE` on every table automatically — so seeing rows in `information_schema.role_table_grants` proves nothing. Only the DML privileges (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) come from your explicit grants, and only those matter to PostgREST. GRANTs and RLS are independent layers: the GRANT decides whether the role may touch the table at all, RLS then filters rows. A table with policies but no GRANT fails every query with `42501 permission denied`. `20260730000001_grant_data_api_roles.sql` grants the existing tables per-operation to match their policies — **any new table needs a matching GRANT added there or in its own migration.**
- **Seed order is load-bearing.** `sql_paths` runs `seed.sql` → `seed_realtor.sql` → `seed_vectors.sql`, and each depends on the previous. `seed.sql` inserts ids 1-3 explicitly, which does *not* advance the `GENERATED BY DEFAULT AS IDENTITY` sequence, so it ends with a `setval` — without that, `seed_realtor.sql` (which omits ids) restarts at 1 and dies on the primary key. Realtor rows therefore occupy ids 4-103, and `seed_vectors.sql` hardcodes those absolute ids. Reordering the list, or inserting ids in `seed.sql` without updating the vector ids, silently misaligns embeddings against listings.
- `seed_vectors.sql` is generated by `scripts/generate_embeddings.ts` from whatever ids are live at the time. If you regenerate it, do so against a freshly reset DB or its ids will not match. To check alignment: every `property_vectors.content_summary` should contain its joined property's zip (100/100 for ids 4-103). `seed.sql` inserts `array_fill` placeholder vectors for ids 1-3, but `generate_embeddings.ts` re-embeds *every* property in the DB (including 1-3) and upserts via `ON CONFLICT (property_id) DO UPDATE` — so after running the full pipeline, ids 1-3 have real embeddings too, not the placeholders.
- `offers` and `cma_reports` have no DELETE policy and no DELETE grant, so a `.delete()` on them silently affects zero rows instead of erroring. Offers are retired by setting `status` to `withdrawn`/`rejected`.
- `offers` uses `buyer_id`, not `user_id` — unlike `favorites`, `viewings`, and `cma_reports`, which all use `user_id`. The RLS insert policy is `WITH CHECK (auth.uid() = buyer_id)`, so getting this wrong fails the policy rather than erroring on a missing column.
- `lib/ai/tools.ts` falls back to a bare anon-key client when the cookie client can't be constructed (i.e. outside a request scope, as in the test scripts). That fallback has no user identity, so RLS-protected writes will fail there.
- Comments across `lib/ai/` and the migrations still reference older model names (`text-embedding-004`, `gemini-2.5-flash-image`); the code in `GEMINI_MODELS` is authoritative.
