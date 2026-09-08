# Indian Shopping Mela — Backend Integration, Production Hardening & Go-Live Master Tasklist (SUPERSEDED)

> [!WARNING]
> **SUPERSEDED / HISTORICAL ARCHIVE ONLY**: This tasklist is preserved for historical audit reference. The authoritative master execution plan and active source of truth is [tasklist3.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/tasklist3.md). Do NOT update or rely on completion checkboxes in this file.

**File:** `tasklist1.md`  
**Project:** Indian Shopping Mela (ISM)  
**Source frontend:** current `Indian Shopping Mela.zip`  
**Architecture baseline:** `Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`  
**Target:** turn the completed marketplace frontend/prototype into a real, secure, production-capable multi-vendor marketplace.  
**Target launch window:** 5–10 days for a **controlled MVP launch**, provided external accounts/credentials and business decisions are available on time.

---

# 0. HOW AN AI/DEVELOPER MUST USE THIS FILE

This is not a suggestion list. It is the implementation runbook.

## 0.1 Execution rules

- Work through tasks **in ID order unless a task explicitly says it can run in parallel**.
- Do not mark a task complete because the UI already exists. A task is complete only when its **Acceptance Criteria** pass.
- At the beginning of every work session, read:
  - `AGENTS.md`
  - `README.md`
  - `roadmap.md`
  - this `tasklist1.md`
- Preserve the existing approved frontend look, layout, copy, routes, and responsive behavior unless a task specifically changes them.
- Do **not** redesign the frontend while backend integration is underway.
- Do **not** rewrite published Git history. The project is Lovable-connected. Do not force-push, rebase/amend/squash already-pushed commits.
- Never commit secrets, provider API keys, service-role keys, private certificates, webhook secrets, passwords, or production tokens.
- Never put Supabase `service_role` credentials into browser/client code.
- Never trust browser-calculated money, stock, seller ownership, order status, payout status, return status, or shipping status.
- All money/inventory/order/finance workflows must be server-authoritative and transaction-safe.
- Use database constraints and RLS as a second line of defense; do not rely only on UI hiding.
- Use integer minor currency units for financial storage (`189.50 AUD = 18950 cents`) unless a deliberate PostgreSQL `numeric` design is documented.
- Use idempotency for all payment, refund, payout, label, and webhook actions.
- Every external webhook must verify its signature before changing business state.
- Every sensitive admin/finance action must create an audit record.
- If a task requires an external credential or business decision that is missing, mark it **BLOCKED** and ask only for the specific missing information. Never invent credentials or provider capabilities.

## 0.2 Status syntax

Use these markers inside this file as work progresses:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete and acceptance-tested
- `[!]` Blocked by external decision/account/credential
- `[-]` Deliberately deferred with owner approval

## 0.3 Definition of “complete” for each task

Before changing `[ ]` to `[x]`, the implementer must:

1. Implement the task.
2. Run relevant unit/integration tests.
3. Run `bun run lint`.
4. Run `bun run build`.
5. Manually verify the affected user flow on desktop and mobile if UI-facing.
6. Confirm no TypeScript errors or runtime console errors were introduced.
7. Add/update automated tests where practical.
8. Update this tasklist status and notes.
9. Commit a small, descriptive commit without rewriting history.

Recommended commit style:

```text
feat(auth): connect Supabase SSR sessions
fix(policy): standardize seven-day return window
feat(order): add transactional inventory reservation
test(payment): add duplicate webhook idempotency coverage
```

## 0.4 Required progress log

At the end of this file, maintain:

```md
## Progress Log

- YYYY-MM-DD — Txxx completed — short result — commit hash
- YYYY-MM-DD — Txxx blocked — exact blocker
```

---

# 1. CURRENT PROJECT BASELINE

## 1.1 Existing stack

Current repository uses:

- TanStack Start
- React 19
- TypeScript
- TanStack Router
- TanStack Query dependency already present
- Tailwind CSS
- Zod
- React Hook Form
- Bun lockfile
- Lovable build tooling
- Nitro/TanStack Start server entry wrapper

Current project does **not** yet include a production database, real authentication, real payment integration, real shipping integration, real payout execution, real file/media backend, background workers, production monitoring, or automated application tests.

## 1.2 Current static/demo sources that must stop being the production source of truth

- `src/lib/ism-data.ts`
- `src/lib/ism-ops.ts`
- `src/lib/ism-store.tsx`

These should eventually become one of:

- seed/demo fixtures only;
- shared enums/constants only;
- thin client state/cache only.

They must not remain the authoritative source for products, users, orders, stock, money, payouts, shipping, returns, or admin settings.

## 1.3 Existing frontend routes to preserve

Customer:

- `/`
- `/search`
- `/category/$slug`
- `/seller/$slug`
- `/product/$id`
- `/cart`
- `/checkout`
- `/signin`
- `/account`
- `/orders/$id`
- `/returns/new`

Seller:

- `/sell`
- `/sell/onboarding`
- `/sell/add-product`
- `/sell/bulk-upload`
- `/sell/bulk-stock`
- `/sell/team`

Admin:

- `/admin`

## 1.4 Known prototype inconsistencies already found

These must be fixed before encoding final business rules:

- 7-day vs 30-day ordinary return wording is inconsistent.
- Product image limit is shown as 5 in one seller form while admin/config/demo data allows 12.
- Checkout displays Card, PayID and BNPL although no real provider is connected.
- Shipping amounts and free-shipping thresholds are hard-coded in frontend.
- GST totals are calculated in frontend.
- Commission/payout/return/SLA settings are UI/demo state only.
- Authentication is a boolean React state.
- Bulk import uses hard-coded demo counts and timers.
- Product video processing uses simulated state progression.
- Cart and wishlist are memory-only.
- Admin/seller permissions are not server-enforced.
- Financial ledger is demo data only.
- Shipping labels/tracking are demo data.
- Payout statuses are demo data.

---

# 2. TARGET ARCHITECTURE — DEFAULT DECISION

Unless the project owner explicitly changes this decision, implement the controlled MVP with:

## Application / SSR

**Vercel**
- Host the TanStack Start application.
- Server Functions/server routes handle privileged application operations.
- Configure the correct Nitro/Vercel deployment target instead of relying on the current Cloudflare-default comment/config.

## Database / Auth / Storage / lightweight jobs

**Supabase — Sydney/Australia region**
- PostgreSQL
- Supabase Auth
- Row Level Security
- Supabase Storage
- SQL migrations
- generated TypeScript DB types
- Supabase Queues/Cron where suitable

## Payments / seller financial onboarding

**Stripe + Stripe Connect**
- Exact Connect charge/transfer model must be confirmed against the ISM commercial arrangement and Stripe account eligibility before coding final payout behavior.
- Customer payment state comes only from provider-confirmed server/webhook events.
- Seller transfers/payout release occur only after ISM eligibility rules are satisfied.

## Product video

**Mux**
- Browser direct upload
- provider processing/transcoding
- thumbnail/playback asset
- webhook-driven READY/FAILED status

## Shipping

Use a provider adapter. The concrete first provider must be selected by owner:
- Shippit, Australia Post, Sendle, or another approved Australian provider.

The application must depend on an internal `ShippingProvider` interface, not provider-specific calls spread throughout React components.

## Email

Choose one:
- Resend
- Postmark
- another approved transactional provider

## Error monitoring

**Sentry** or approved equivalent.

## Future GCP use

Do **not** move the whole application to GCP during the 5–10 day launch sprint unless Vercel/Supabase becomes a proven blocker.

Add GCP Cloud Run / Cloud Tasks later for:
- CPU-heavy imports
- long-running media/data jobs
- dedicated workers
- high-volume search/indexing
- specialized microservices

---

# 3. EXTERNAL DECISIONS / CREDENTIALS — HUMAN BLOCKERS

The AI may implement adapters and test-mode flows, but production launch is blocked until these are answered.

- [x] **T001 — Confirm Stripe account**
  - Confirm an Australian Stripe business account exists.
  - Confirm Stripe Connect is enabled/available.
  - Confirm production account verification is complete.
  - Record only non-secret account identifiers in internal docs.
  - **Acceptance:** test and live-mode readiness is known.
  - **Blocker question if missing:** “Do we have an Australian Stripe account and is Connect enabled?”

- [x] **T002 — Confirm launch payment methods**
  - Decide whether Day-1 launch supports:
    - card only;
    - card + PayID;
    - card + BNPL.
  - Hide any unsupported payment choice before production.
  - **Recommended controlled MVP:** card first.
  - **Acceptance:** one written launch payment-method decision exists.

- [x] **T003 — Confirm shipping provider**
  - Select the first production shipping integration.
  - Confirm multi-seller/multi-origin support.
  - Confirm API credentials/sandbox.
  - Confirm rates, labels, tracking, delivery events and return labels are supported as required.
  - **Acceptance:** selected provider + sandbox credentials + production onboarding status documented.

- [x] **T004 — Confirm seller launch model**
  - Decide:
    - invited/approved sellers only; or
    - open self-registration.
  - **Recommended first 5–10 days:** controlled approved sellers.
  - **Acceptance:** onboarding rules are explicit.

- [x] **T005 — Confirm launch seller/product volume**
  - Expected sellers:
  - Expected products:
  - Expected variants:
  - Expected bulk import size:
  - **Acceptance:** engineering can size indexes/import jobs and QA load.

- [x] **T006 — Confirm legal policy owners**
  - Obtain final/approved:
    - Privacy Policy
    - Terms & Conditions
    - Returns Policy
    - Seller Agreement
    - prohibited/restricted product policy
  - Legal/business team must confirm Australian Consumer Law wording.
  - **Acceptance:** production copy is approved by owner/legal adviser.

- [x] **T007 — Confirm return rules**
  - Default ordinary change-of-mind: **7 days from confirmed delivery** per architecture plan.
  - Confirm category exceptions, hygiene/custom exclusions, return shipping payer, restocking rules.
  - Confirm ACL/statutory rights remain separate.
  - **Acceptance:** one canonical return-policy object/config exists.

- [x] **T008 — Confirm seller payout rules**
  - Default payout eligibility: **confirmed delivery + 14 days**, blocked by active return/dispute/refund/chargeback/fraud hold.
  - Confirm commission structure.
  - Confirm payment processing fee allocation.
  - Confirm shipping cost/discount funding.
  - Confirm post-payout refund recovery policy.
  - **Acceptance:** finance rules signed off.

- [x] **T009 — Confirm image/video limits**
  - Resolve 5 vs 12 images.
  - Recommended: admin-configurable value; UI reads it from server config.
  - Confirm max image MB, video duration, max videos/product.
  - **Acceptance:** one canonical config.

- [x] **T010 — Confirm production domain/DNS ownership**
  - Record domain.
  - Confirm DNS access.
  - Confirm email sending domain access.
  - **Acceptance:** responsible person can add Vercel and email DNS records.

---

# 4. PHASE A — REPOSITORY SAFETY, BASELINE & FRONTEND FREEZE

- [x] **T011 — Create working branch**
  - Create a normal feature branch such as `backend-integration`.
  - Do not rewrite existing published history.
  - Confirm changes synchronize safely with Lovable/GitHub.
  - **Acceptance:** clean branch and clean `git status`.

- [x] **T012 — Install dependencies from existing lockfile**
  - Prefer Bun because repository contains `bun.lock`.
  - Run:
    ```bash
    bun install --frozen-lockfile
    ```
  - Do not casually replace the package manager or regenerate lockfiles with npm.
  - **Acceptance:** install succeeds.

- [x] **T013 — Capture baseline build**
  - Run:
    ```bash
    bun run lint
    bun run build
    ```
  - Record any pre-existing errors before backend changes.
  - **Acceptance:** baseline result written in Progress Log.

- [x] **T014 — Create environment template**
  - Add `.env.example`.
  - Include names only, never secrets:
    ```text
    VITE_SUPABASE_URL=
    VITE_SUPABASE_ANON_KEY=
    SUPABASE_SERVICE_ROLE_KEY=
    STRIPE_SECRET_KEY=
    STRIPE_WEBHOOK_SECRET=
    VITE_STRIPE_PUBLISHABLE_KEY=
    MUX_TOKEN_ID=
    MUX_TOKEN_SECRET=
    MUX_WEBHOOK_SECRET=
    SHIPPING_PROVIDER=
    SHIPPING_API_KEY=
    EMAIL_PROVIDER=
    EMAIL_API_KEY=
    SENTRY_DSN=
    APP_URL=
    ```
  - Adjust names based on actual framework server/client exposure requirements.
  - **Acceptance:** no secret values committed.

- [x] **T015 — Add runtime environment validation**
  - Add a server-only env schema using Zod.
  - Fail startup clearly when required server secrets are missing.
  - Maintain separate client-safe schema.
  - **Acceptance:** server-only keys cannot accidentally be imported in browser bundle.

- [x] **T016 — Create central launch configuration types**
  - Create config types for:
    - currency
    - return window
    - payout delay
    - commission defaults
    - image/video limits
    - seller SLA
    - free-shipping rules
  - Initially use safe fallback constants only for local development; production will load DB config.
  - **Acceptance:** no duplicate policy constants are scattered after related tasks are completed.

- [x] **T017 — Standardize ordinary return wording to 7 days**
  - Audit and fix:
    - `src/routes/index.tsx`
    - `src/routes/product.$id.tsx`
    - `src/routes/checkout.tsx`
    - `src/routes/sell.index.tsx`
    - any other “30-day” ordinary change-of-mind wording.
  - Keep statutory faulty/damaged/not-as-described rights separate.
  - **Acceptance:** global search for `30-day`, `30 day`, `30 days` returns only deliberately approved uses.

- [x] **T018 — Resolve product image-limit inconsistency**
  - Current seller add-product says up to 5 while admin/demo config says 12 and bulk template has image 1–12.
  - Make the visible seller form use canonical config.
  - **Acceptance:** single image limit shown everywhere.

- [x] **T019 — Hide unsupported payment methods**
  - Until a payment method is connected and enabled in DB config, do not show it as production-available.
  - Keep test/demo UI behind development/demo flag only.
  - **Acceptance:** production checkout never offers a non-functional payment method.

- [x] **T020 — Add prototype/demo feature flag**
  - Add an environment flag such as `DEMO_MODE`.
  - Demo helper text, test credentials, pre-populated fake cart, fake order actions, and timer simulations must be disabled in production.
  - **Acceptance:** production build can run with zero “prototype/demo” customer-visible messaging.

- [x] **T021 — Freeze visual changes**
  - Document that backend work should preserve current approved UI.
  - Only change UI when required for:
    - loading/error state
    - auth state
    - real data
    - validation
    - provider flow
    - compliance/security.
  - **Acceptance:** no unrelated redesign PRs during launch sprint.

---

# 5. PHASE B — VERCEL + SUPABASE FOUNDATION

- [x] **T022 — Create Supabase staging project**
  - Use an Australian/Sydney region when available.
  - Enable project security settings appropriate for staging.
  - **Acceptance:** staging DB/Auth/Storage accessible.

- [x] **T023 — Create Supabase production project**
  - Separate from staging.
  - Do not share production service keys with local/client code.
  - **Acceptance:** production project exists and credentials are stored only in secrets manager/Vercel.

- [x] **T024 — Initialize Supabase local project**
  - Add `supabase/` project configuration.
  - Store all schema changes as migrations.
  - Never make untracked production-only schema changes through dashboard without a matching migration.
  - **Acceptance:** fresh local/staging database can be rebuilt from migrations.

- [x] **T025 — Add Supabase dependencies**
  - Install current supported Supabase JS + SSR packages compatible with TanStack Start.
  - Do not add Prisma unless the team explicitly decides to.
  - **Default:** Supabase migrations + typed client + SQL/RPC for transactional workflows.
  - **Acceptance:** packages build with current project versions.

- [x] **T026 — Create Supabase browser client**
  - Suggested location:
    `src/lib/supabase/client.ts`
  - Must contain only public URL/anon key.
  - **Acceptance:** browser session calls work without service key.

- [x] **T027 — Create Supabase server session client**
  - Suggested:
    `src/lib/supabase/server.ts`
  - Integrate request/response cookies with TanStack Start SSR.
  - **Acceptance:** server loader/function sees authenticated user.

- [x] **T028 — Create server-only Supabase admin client**
  - Suggested:
    `src/lib/supabase/admin.ts`
  - Uses service-role key.
  - Add strong comments/import boundary.
  - Never import into browser modules.
  - Use only for:
    - trusted provider webhooks
    - background jobs
    - privileged administrative system operations.
  - **Acceptance:** static check/build proves key is not in browser bundle.

- [x] **T029 — Generate database TypeScript types**
  - Add script to generate types from staging schema.
  - Suggested output:
    `src/lib/supabase/database.types.ts`
  - **Acceptance:** repository queries use generated row/insert/update types where practical.

- [x] **T030 — Configure Vercel project**
  - Connect repo/branch.
  - Preserve Lovable workflow.
  - Create preview/staging and production environment settings.
  - **Acceptance:** current frontend deploys successfully on a Vercel preview URL.

- [x] **T031 — Correct Nitro/TanStack deployment target**
  - Current `vite.config.ts` comment says Lovable config defaults Nitro build to Cloudflare.
  - Configure Vercel-compatible deployment through supported current TanStack/Lovable config mechanism.
  - Do not duplicate plugins already included by `@lovable.dev/vite-tanstack-config`.
  - **Acceptance:** SSR route works on Vercel preview and refresh on dynamic routes does not 404.

- [x] **T032 — Configure environment separation**
  - Local
  - Vercel preview/staging
  - Production
  - Separate Supabase URLs/keys and Stripe modes.
  - **Acceptance:** preview never points to production DB/payment by accident.

- [x] **T033 — Add health endpoint**
  - Expose a simple server health check.
  - Should verify app process and optionally a lightweight DB query.
  - Must not leak environment details.
  - **Acceptance:** monitoring can detect app/DB availability.

---

# 6. PHASE C — DATABASE SCHEMA: IDENTITY & SELLERS

Use UUID primary keys unless a strong reason exists otherwise. Add `created_at`, `updated_at` where useful. Add indexes for all common foreign keys/filter columns. Use foreign keys and `ON DELETE` behavior deliberately.

- [x] **T034 — Create `profiles` table**
  - Fields:
    - `id` = auth user UUID
    - first/last/display name
    - phone
    - status
    - timezone
    - locale
    - created/updated timestamps
  - Do not duplicate password/email secrets unnecessarily.
  - **Acceptance:** auth user can own one profile.

- [x] **T035 — Create platform role model**
  - Tables/enums for:
    - customer
    - seller owner
    - seller staff
    - support admin
    - catalogue admin
    - finance admin
    - super admin
  - Decide whether platform roles use `user_roles` table rather than one mutable role column.
  - **Acceptance:** user can safely hold required platform responsibilities.

- [x] **T036 — Create `sellers` table**
  - Fields:
    - seller UUID
    - owner user ID
    - legal name
    - trading name
    - store name
    - unique slug
    - ABN
    - business type
    - contact info
    - onboarding status
    - store status
    - risk flag
    - approval timestamps/admin
    - holiday mode
    - handling default
  - **Acceptance:** seller identity is independent of customer profile.

- [x] **T037 — Create `seller_members` table**
  - Seller team membership.
  - Fields:
    - seller
    - user
    - role/title
    - status
    - invited_by
    - accepted_at
  - Unique `(seller_id,user_id)`.
  - **Acceptance:** one user may belong to permitted seller account(s) without exposing other sellers.

- [x] **T038 — Create granular seller permissions**
  - Permission set:
    - products
    - inventory
    - orders
    - shipping
    - returns
    - promotions
    - reports
    - store_settings
    - finance
  - Use normalized join table or secure structured representation.
  - Owner gets fixed full seller access; finance can still be specially controlled.
  - **Acceptance:** permission checks are server-testable.

- [x] **T039 — Create `seller_addresses` table**
  - Types:
    - dispatch
    - return
  - Australian address fields.
  - Support “same as dispatch” in UI without losing normalized data.
  - **Acceptance:** shipping origin can be determined from DB.

- [x] **T040 — Create `seller_payout_profiles` table**
  - Store provider account/reference only.
  - Never store raw bank credentials when provider can own them.
  - Fields:
    - provider
    - connected account ID
    - onboarding status
    - charges/payout capability flags
    - last verified timestamp
  - **Acceptance:** UI can display masked/provider status without sensitive details.

- [x] **T041 — Create `seller_agreements` acceptance table**
  - seller
  - agreement/policy version
  - accepted timestamp
  - IP/device metadata where legally/technically appropriate
  - **Acceptance:** historical accepted version is immutable/auditable.

- [x] **T042 — Create seller onboarding document metadata**
  - Store documents in private Storage bucket.
  - DB table includes:
    - seller
    - document type
    - storage path
    - verification status
    - reviewer
    - review note
  - **Acceptance:** no public URL to sensitive seller docs.

---

# 7. PHASE D — DATABASE SCHEMA: CATALOGUE, PRODUCTS & MEDIA

- [x] **T043 — Create `departments` table**
  - name, slug, status, sort, SEO fields.
  - **Acceptance:** homepage/category navigation can query DB.

- [x] **T044 — Create hierarchical `categories` table**
  - parent category ID
  - department ID
  - name/slug
  - status
  - sort
  - image/banner
  - SEO metadata
  - featured flag
  - **Acceptance:** Department → Category → Subcategory supported without hard-coding forms.

- [x] **T045 — Create `category_attributes` table**
  - Attribute:
    - key
    - label
    - data type
    - required
    - variant-defining flag
    - filterable flag
    - sort order
  - Types include:
    - text
    - number/decimal
    - dropdown
    - multi-select
    - colour
    - size
    - boolean
    - date
    - dimension
  - **Acceptance:** seller product form can be schema-driven.

- [x] **T046 — Create `attribute_options` table**
  - For dropdown/multi-select/colour/size.
  - Unique option per attribute and stable ID.
  - **Acceptance:** product variants can reference stable option IDs.

- [x] **T047 — Create collections/tags model**
  - Collections: e.g. Diwali, Wedding, Under $50, New Arrivals.
  - Tags: handmade, ready-to-ship, Australia stock, giftable.
  - Add product join tables.
  - **Acceptance:** discovery rails no longer depend on static arrays.

- [x] **T048 — Create `products` table**
  - seller
  - title
  - slug/ID
  - seller SKU if parent-level
  - primary category
  - descriptions
  - care instructions
  - brand/maker
  - status
  - return eligibility
  - country of origin/warnings as applicable
  - handling days
  - package data/defaults
  - approval/review fields
  - **Acceptance:** all single-listing launch-critical fields can persist.

- [x] **T049 — Create `product_variants` table**
  - stable variant ID
  - product
  - seller SKU
  - barcode optional
  - price cents
  - compare-at/sale details
  - weight/dimension overrides
  - active status
  - unique seller SKU within seller account
  - **Acceptance:** each sellable combination has independent identity/price/stock.

- [x] **T050 — Create variant-option mapping**
  - Map each variant to attribute/option values.
  - Enforce no duplicate combination within product.
  - **Acceptance:** size × colour products map reliably.

- [x] **T051 — Create `product_media` table**
  - product/variant
  - media type image/video
  - storage/provider asset ID
  - position
  - primary flag
  - alt text
  - processing status
  - moderation status
  - thumbnail/playback metadata
  - **Acceptance:** one primary image, ordered gallery, video statuses.

- [x] **T052 — Add product status state model**
  - DRAFT
  - SUBMITTED
  - NEEDS_CHANGES
  - APPROVED
  - LIVE
  - PAUSED
  - OUT_OF_STOCK
  - REJECTED
  - ARCHIVED
  - **Acceptance:** state transitions validated on server.

- [x] **T053 — Add product moderation history**
  - Do not overwrite the only review reason.
  - Record admin, transition, note, timestamp.
  - **Acceptance:** admin moderation is auditable.

---

# 8. PHASE E — DATABASE SCHEMA: INVENTORY

- [x] **T054 — Create inventory balance model**
  - Per variant:
    - on hand
    - reserved
    - available derivation
    - low-stock threshold
    - stock status
  - Prevent negative values with DB constraints.
  - **Acceptance:** available stock cannot become negative.

- [x] **T055 — Create `inventory_reservations` table**
  - variant
  - cart/order/payment reference
  - qty
  - status
  - expires_at
  - confirmed/released timestamp
  - **Acceptance:** temporary checkout holds are traceable.

- [x] **T056 — Create append-only `inventory_transactions`**
  - variant
  - delta
  - reason
  - actor/system
  - source entity
  - batch/import/order reference
  - timestamp
  - **Acceptance:** stock movements are auditable.

- [x] **T057 — Implement atomic inventory reservation SQL/RPC**
  - Lock/check/update in one DB transaction.
  - Never:
    1. read stock in browser,
    2. decrement later.
  - Return deterministic insufficient-stock error.
  - **Acceptance test:** two concurrent buyers of last unit → exactly one reservation succeeds.

- [x] **T058 — Implement reservation release**
  - Release on:
    - payment failure
    - checkout timeout
    - cancelled order before fulfilment where applicable
  - Idempotent.
  - **Acceptance:** release cannot add stock twice.

- [x] **T059 — Implement reservation confirmation**
  - On provider-confirmed payment:
    - reservation becomes sold/confirmed;
    - on-hand/ledger transaction is finalized according to model.
  - **Acceptance:** duplicate payment event does not deduct twice.

---

# 9. PHASE F — DATABASE SCHEMA: CART & CUSTOMER

- [x] **T060 — Create customer addresses**
  - Authenticated owner-only.
  - Australian fields.
  - Default shipping/billing flags.
  - **Acceptance:** checkout can select a saved address.

- [x] **T061 — Create carts**
  - Support:
    - authenticated customer
    - anonymous guest session token
  - status: ACTIVE / CONVERTED / ABANDONED.
  - **Acceptance:** cart survives refresh/device session as designed.

- [x] **T062 — Create cart lines**
  - product/variant
  - quantity
  - seller derived/validated server-side
  - no trusted price field from client
  - **Acceptance:** price always re-fetched/revalidated at checkout.

- [x] **T063 — Create wishlist tables**
  - owner-only.
  - unique `(user, product)`.
  - **Acceptance:** existing wishlist UI persists.

- [x] **T064 — Implement guest-cart token**
  - Secure random token in HttpOnly/signed cookie or equivalent safe strategy.
  - Do not use guessable cart IDs.
  - **Acceptance:** guest cannot fetch another guest’s cart.

- [x] **T065 — Implement guest-to-account cart merge**
  - On login, merge quantities deterministically.
  - Revalidate stock/product status.
  - **Acceptance:** no duplicate lines or stale prices.

---

# 10. PHASE G — DATABASE SCHEMA: ORDERS & FINANCIAL LEDGER

- [x] **T066 — Create `orders` master table**
  - customer/session
  - customer-facing order number
  - currency
  - totals snapshot
  - payment state
  - overall status
  - shipping/billing snapshots
  - timestamps
  - **Acceptance:** one checkout has one master order.

- [x] **T067 — Create `seller_orders` sub-order table**
  - one seller portion
  - own seller order number
  - fulfilment state
  - shipping totals
  - delivery timestamp
  - payout state
  - **Acceptance:** multi-seller checkout splits cleanly.

- [x] **T068 — Create `order_items`**
  - snapshot at purchase:
    - product ID
    - variant ID
    - seller
    - SKU
    - title
    - selected options
    - unit price cents
    - discount cents
    - tax/GST allocation
    - quantity
    - return eligibility snapshot
  - **Acceptance:** later product edits never alter historical order economics.

- [x] **T069 — Create order status history**
  - entity level
  - from/to status
  - actor
  - reason
  - timestamp
  - **Acceptance:** no destructive status history loss.

- [x] **T070 — Implement order state validation**
  - Payment:
    - PAYMENT_PENDING
    - PAYMENT_FAILED
    - PAID
  - Fulfilment:
    - ORDER_CREATED
    - SELLER_NOTIFIED
    - SELLER_ACCEPTED
    - PREPARING
    - READY_TO_SHIP
  - Shipping:
    - LABEL_CREATED
    - PICKUP_SCHEDULED
    - SHIPPED
    - IN_TRANSIT
    - OUT_FOR_DELIVERY
    - DELIVERED
  - Return/refund and settlement states as architecture requires.
  - **Acceptance:** impossible transitions are rejected server-side.

- [x] **T071 — Create `payments` table**
  - provider
  - provider payment ID
  - order
  - amount/currency
  - status
  - idempotency key
  - timestamps
  - **Acceptance:** one provider payment can be reconciled to order.

- [x] **T072 — Create immutable/append-only `ledger_entries`**
  - entry type:
    - CUSTOMER_CHARGE
    - SELLER_GROSS
    - ISM_COMMISSION
    - PAYMENT_FEE
    - SHIPPING_CHARGE
    - SHIPPING_COST
    - DISCOUNT
    - REFUND
    - ADJUSTMENT
    - TRANSFER
    - PAYOUT
  - amount cents + currency
  - seller/order/sub-order/source references
  - created timestamp
  - Do not “edit history” to recalculate.
  - **Acceptance:** historical payout can be rebuilt from captured ledger entries.

- [x] **T073 — Protect ledger from destructive updates**
  - Application should append compensating entries rather than editing/deleting monetary history.
  - Restrict direct mutation permissions.
  - **Acceptance:** normal app roles cannot delete ledger entries.

- [x] **T074 — Create financial reconciliation view/query**
  - Master order charge
  - seller gross
  - discounts
  - commission
  - shipping
  - refunds
  - payout liability
  - **Acceptance:** totals reconcile to zero/expected balance rules.

---

# 11. PHASE H — SHIPPING, RETURNS, PAYOUT & SUPPORT TABLES

- [x] **T075 — Create `shipments`**
  - seller order
  - package
  - provider/carrier
  - service
  - provider shipment ID
  - tracking number
  - label reference
  - cost/customer charge
  - status
  - delivered_at
  - POD metadata
  - **Acceptance:** one seller order may have multiple shipments.

- [x] **T076 — Create `tracking_events`**
  - raw provider state
  - mapped ISM state
  - raw event reference/payload metadata
  - occurred/received timestamp
  - **Acceptance:** unknown carrier status is stored, not discarded.

- [x] **T077 — Create `returns`**
  - Return ID
  - customer/order/seller order
  - reason/status
  - requested timestamp
  - approval/rejection
  - payout hold flag/reference
  - **Acceptance:** return has independent lifecycle.

- [x] **T078 — Create `return_items`**
  - order item
  - quantity
  - reason/details
  - condition/result
  - **Acceptance:** partial returns supported.

- [x] **T079 — Create private return evidence storage/table**
  - photo/document metadata
  - private bucket
  - signed admin/support/customer access based on ownership.
  - **Acceptance:** evidence not publicly enumerable.

- [x] **T080 — Create `refunds`**
  - return/cancellation/dispute reference
  - provider refund ID
  - product/shipping amounts
  - status
  - idempotency key
  - **Acceptance:** partial/full refunds reconciled.

- [x] **T081 — Create `payouts` settlement table**
  - seller
  - period
  - amount
  - status:
    - PENDING
    - ON_HOLD
    - ELIGIBLE
    - PROCESSING
    - PAID
    - FAILED
  - provider transfer/payout reference
  - **Acceptance:** failed retries cannot double-pay.

- [x] **T082 — Create `payout_items`**
  - payout → eligible ledger entries
  - unique mapping so same amount is not paid twice.
  - **Acceptance:** payout composition is explainable.

- [x] **T083 — Create seller balance/recovery model**
  - For refund/chargeback after seller funds were transferred.
  - Must follow approved commercial/legal rule.
  - **Acceptance:** negative/recovery adjustment is represented, not silently lost.

---

# 12. PHASE I — SYSTEM TABLES: CONFIG, WEBHOOKS, AUDIT, NOTIFICATIONS, IMPORTS

- [x] **T084 — Create versioned marketplace configuration**
  - commission
  - payout delay
  - return window
  - seller SLA
  - import limits
  - media limits
  - listing rules
  - shipping promos/defaults
  - feature flags
  - Record changed_by and version/history.
  - **Acceptance:** admin setting survives refresh/deploy and old orders retain snapshots.

- [x] **T085 — Create `audit_logs`**
  - actor
  - action
  - entity type/id
  - before/after safe JSON
  - reason
  - timestamp
  - request trace/IP metadata where appropriate
  - Never log secrets/full bank/card data.
  - **Acceptance:** sensitive actions are searchable.

- [x] **T086 — Create `webhook_events`**
  - provider
  - provider event ID
  - signature verification result
  - received time
  - processed status
  - attempts
  - last error
  - payload storage approach
  - unique `(provider,event_id)`
  - **Acceptance:** duplicate event cannot perform duplicate business action.

- [x] **T087 — Create `notifications` / send log**
  - recipient
  - channel
  - template
  - entity reference
  - provider message ID
  - send/retry state
  - idempotency key
  - **Acceptance:** repeated provider webhook does not send duplicate order emails.

- [x] **T088 — Create `bulk_import_batches`**
  - seller
  - uploader
  - file
  - template version
  - mode CREATE/UPDATE
  - blank behavior IGNORE/CLEAR
  - counts
  - status/progress
  - timestamps
  - **Acceptance:** import history persists.

- [x] **T089 — Create `bulk_import_rows`**
  - batch
  - row number
  - SKU
  - parsed data
  - validation result
  - errors/warnings
  - import target/result
  - **Acceptance:** failed rows can be re-exported/retried.

---

# 13. PHASE J — RLS & SERVER-SIDE AUTHORIZATION

RLS is launch-critical.

- [x] **T090 — Enable RLS on all user/seller-owned tables**
  - No public table should accidentally be wide open because it exists in exposed schema.
  - **Acceptance:** security review lists every table and policy.

- [x] **T091 — Customer profile/address policies**
  - Customer can read/update only own profile/address.
  - Admin access only through authorized path.
  - **Acceptance:** cross-user access test fails.

- [x] **T092 — Customer cart/wishlist policies**
  - Authenticated ownership enforced.
  - Guest access handled through server token rather than broad anonymous select.
  - **Acceptance:** cannot enumerate other carts.

- [x] **T093 — Customer order policies**
  - Customer can read only own master orders/sub-orders/items/shipments/returns.
  - **Acceptance:** changing order ID in URL/API does not leak data.

- [x] **T094 — Seller membership helper**
  - Add safe DB helper/policy logic for “current user is active member of seller X”.
  - **Acceptance:** reused consistently.

- [x] **T095 — Seller product policies**
  - Seller can CRUD only own seller’s products subject to permission.
  - Catalogue admin moderation separate.
  - **Acceptance:** Seller A cannot mutate Seller B product by guessed UUID.

- [x] **T096 — Seller inventory policies**
  - Only authorized seller member can modify own inventory through approved operation.
  - Prefer server/RPC for adjustments.
  - **Acceptance:** direct cross-seller write rejected.

- [x] **T097 — Seller order policies**
  - Seller sees only own sub-orders and only customer data needed for fulfilment.
  - Never expose another seller’s commercial details.
  - **Acceptance:** cross-seller query returns zero/forbidden.

- [x] **T098 — Seller finance policies**
  - Finance permission required for payouts/statements.
  - Seller staff without finance permission gets no financial data.
  - **Acceptance:** test each permission role.

- [x] **T099 — Admin role policies**
  - Support: support scopes only.
  - Catalogue: catalogue/moderation.
  - Finance: financial/refund/payout.
  - Super Admin: full with MFA requirement.
  - **Acceptance:** admin role isolation tests pass.

- [x] **T100 — Service-role boundary audit**
  - List every usage of admin/service client.
  - Each use must have reason and trusted caller.
  - **Acceptance:** client bundle and normal customer flows never use service key.

---

# 14. PHASE K — REAL AUTHENTICATION

- [x] **T101 — Connect Supabase Auth to SSR**
  - Session available on server and client after refresh.
  - **Acceptance:** login survives full page reload.

- [x] **T102 — Replace demo sign-in**
  - Refactor `src/routes/signin.tsx`.
  - Remove `setSignedIn(true)` as auth source of truth.
  - Remove production demo password/default credentials.
  - **Acceptance:** wrong password fails; valid account signs in.

- [x] **T103 — Add customer sign-up**
  - email/password initially unless phone required for launch.
  - profile creation.
  - Terms/Privacy acceptance.
  - **Acceptance:** new customer can verify and log in.

- [x] **T104 — Add email verification flow**
  - Confirmation redirect.
  - Friendly expired/invalid token behavior.
  - **Acceptance:** verification gate behaves as business requires.

- [x] **T105 — Add forgot/reset password**
  - Request reset.
  - secure redirect.
  - update password.
  - **Acceptance:** old/reset tokens cannot be reused improperly.

- [x] **T106 — Add sign-out**
  - End server/browser session.
  - Clear sensitive client cache.
  - **Acceptance:** protected route redirects after logout.

- [x] **T107 — Add route guards**
  - `/account` customer auth.
  - `/sell/*` approved seller/member auth as appropriate.
  - `/admin` admin auth.
  - **Acceptance:** direct URL entry is protected server-side.

- [x] **T108 — Add seller onboarding access logic**
  - An authenticated user may start seller application even before seller approval.
  - Approved seller gets seller dashboard.
  - Suspended seller is restricted.
  - **Acceptance:** status-specific navigation works.

- [x] **T109 — Add Admin/Finance MFA**
  - At minimum Super Admin and Finance Admin.
  - **Acceptance:** privileged admin cannot complete login without configured second factor.

- [x] **T110 — Add session security**
  - Session expiry.
  - revoke on password/security change where possible.
  - no tokens in localStorage if SSR-cookie strategy avoids it.
  - **Acceptance:** security test documents session behavior.

---

# 15. PHASE L — SELLER ONBOARDING BACKEND

- [x] **T111 — Bind onboarding UI to DB**
  - Refactor `src/routes/sell.onboarding.tsx`.
  - Load existing application state.
  - Save draft.
  - **Acceptance:** refresh preserves entered onboarding data.

- [x] **T112 — Implement onboarding state transitions**
  - DRAFT → SUBMITTED → UNDER_REVIEW → INFO_REQUIRED → APPROVED/REJECTED/SUSPENDED.
  - Transitions server-authorized.
  - **Acceptance:** seller cannot self-approve.

- [x] **T113 — Add seller document upload**
  - Private Supabase Storage.
  - size/MIME validation.
  - path scoped by seller.
  - **Acceptance:** admin can securely review; unrelated seller cannot.

- [x] **T114 — Add ABN validation adapter**
  - Implement provider abstraction.
  - If ABR API credentials are unavailable at launch, mark verification as manual rather than pretending it was verified.
  - **Acceptance:** displayed verification status corresponds to real process.

- [x] **T115 — Connect admin seller review**
  - Admin list/details.
  - approve/reject/request info/suspend.
  - required reason for sensitive changes.
  - audit log.
  - **Acceptance:** seller receives updated status and cannot bypass review.

- [x] **T116 — Activate store after approval**
  - Create/activate seller storefront state.
  - Show onboarding checklist.
  - **Acceptance:** approved seller can access seller dashboard and create listing.

---

# 16. PHASE M — STRIPE CONNECT SELLER ONBOARDING

- [x] **T117 — Choose Stripe Connect model**
  - Verify current Stripe documentation/account availability.
  - Document:
    - connected account type/onboarding
    - charge model
    - transfer timing
    - fee ownership
    - refund/chargeback recovery
  - **Do not code from assumption.**
  - **Acceptance:** architecture decision recorded.

- [x] **T118 — Create connected account from trusted server**
  - Map to seller.
  - Store provider ID only.
  - Idempotent seller account creation.
  - **Acceptance:** repeated request does not create duplicate connected account.

- [x] **T119 — Create Stripe onboarding session/link**
  - Server-generated.
  - return/refresh route.
  - **Acceptance:** seller can complete test onboarding.

- [x] **T120 — Sync Connect capability/status**
  - Webhook or provider fetch.
  - Store readiness flags.
  - **Acceptance:** dashboard reflects actual provider state.

- [x] **T121 — Gate payouts/selling as required**
  - Define whether a seller can list before payment onboarding.
  - Never payout if connected account is not eligible.
  - **Acceptance:** business rule enforced server-side.

---

# 17. PHASE N — CATALOGUE BACKEND & STATIC DATA MIGRATION

- [x] **T122 — Create seed migration/script for departments/categories**
  - Convert existing category taxonomy from `ism-data.ts`.
  - Preserve slugs used by current routes where possible.
  - **Acceptance:** existing category URLs still resolve.

- [x] **T123 — Seed initial demo/staging sellers/products**
  - For staging only.
  - Keep production seed intentionally minimal.
  - **Acceptance:** frontend can be tested against DB without static product arrays.

- [x] **T124 — Upload/migrate product image assets**
  - Decide whether current local assets remain bundled for seed/demo or move to Storage.
  - Production seller uploads should use Storage/provider URLs.
  - **Acceptance:** product media renders with real DB records.

- [x] **T125 — Create catalogue query layer**
  - Suggested service:
    `src/server/services/catalogue.ts`
  - Encapsulate:
    - product list
    - product detail
    - seller storefront
    - category
    - featured collections
    - search.
  - **Acceptance:** route components do not directly depend on giant static arrays.

- [x] **T126 — Replace homepage static catalogue**
  - Refactor `src/routes/index.tsx`.
  - Add loading/error/fallback.
  - **Acceptance:** homepage products/categories come from DB.

- [x] **T127 — Replace category static data**
  - Refactor `src/routes/category.$slug.tsx`.
  - Preserve filters/sorting.
  - **Acceptance:** category route works from DB.

- [x] **T128 — Replace seller storefront static data**
  - Refactor `src/routes/seller.$slug.tsx`.
  - Show only active seller + live products.
  - **Acceptance:** suspended seller/store behavior defined.

- [x] **T129 — Replace PDP static data**
  - Refactor `src/routes/product.$id.tsx`.
  - Load seller, variants, media, stock, return summary.
  - **Acceptance:** invalid/non-live product behavior is correct.

- [x] **T130 — Replace search static data**
  - Refactor `src/routes/search.tsx`.
  - Implement PostgreSQL search suitable for MVP.
  - Add normalized filters.
  - **Acceptance:** search returns only live eligible products.

- [x] **T131 — Add fuzzy/typo strategy**
  - Use PostgreSQL full-text/trigram if practical.
  - Index title/category/tags/seller and approved searchable fields.
  - **Acceptance:** common minor typo still gives useful results.

- [x] **T132 — Update `ism-data.ts` role**
  - Remove production route dependency.
  - Keep format helpers or explicit seed fixtures only.
  - **Acceptance:** production product/order data no longer imported from `ism-data.ts`.

---

# 18. PHASE O — SELLER PRODUCT CRUD

- [x] **T133 — Convert add-product form to real form state**
  - Refactor `src/routes/sell.add-product.tsx`.
  - Use React Hook Form + Zod where practical.
  - **Acceptance:** user errors are field-level and server validates again.

- [x] **T134 — Make product form category-driven**
  - Fetch category attributes.
  - Render required fields dynamically.
  - **Acceptance:** saree/footwear/home categories can have different attributes without code edit.

- [x] **T135 — Implement Save Draft**
  - Server-authorized insert/update.
  - **Acceptance:** draft visible after refresh.

- [x] **T136 — Implement Submit for Review**
  - Validate required listing fields/media/stock.
  - Change DRAFT → SUBMITTED.
  - **Acceptance:** incomplete listing cannot silently go live.

- [x] **T137 — Implement seller product list**
  - Replace static seller product list.
  - Search/filter/status.
  - **Acceptance:** only own seller products.

- [x] **T138 — Implement product edit**
  - Preserve historical order snapshots.
  - Material change may require re-review according to config.
  - **Acceptance:** edit does not alter old orders.

- [x] **T139 — Implement clone/archive**
  - Clone generates new product/variant IDs/SKUs according to rules.
  - Archive is non-destructive.
  - **Acceptance:** historical references remain.

- [x] **T140 — Implement admin product moderation**
  - Approve/reject/needs changes/remove media.
  - Audit.
  - **Acceptance:** seller cannot override rejection.

---

# 19. PHASE P — IMAGE STORAGE

- [x] **T141 — Create Storage buckets**
  - Public/served product media bucket as designed.
  - Private seller verification bucket.
  - Private return-evidence bucket.
  - **Acceptance:** access policy differs correctly.

- [x] **T142 — Add image upload endpoint/flow**
  - Validate:
    - MIME by content where possible
    - max bytes
    - image dimensions
    - file count
  - Generate collision-safe path.
  - **Acceptance:** invalid file rejected.

- [x] **T143 — Save image media records**
  - Position, primary flag, alt text.
  - **Acceptance:** reordering persists.

- [x] **T144 — Enforce exactly one primary image**
  - DB/application constraint/transaction.
  - **Acceptance:** cannot end with two primary images.

- [x] **T145 — Add image deletion safety**
  - Do not delete file still referenced by active product/order evidence.
  - Soft/remove from listing and cleanup orphan later.
  - **Acceptance:** no broken product history.

---

# 20. PHASE Q — CART BACKEND

- [x] **T146 — Replace memory-only cart**
  - Refactor `src/lib/ism-store.tsx`.
  - Context becomes UI cache/actions, not source of truth.
  - Remove production `INITIAL_CART`.
  - **Acceptance:** production starts with appropriate empty/persisted cart.

- [x] **T147 — Implement add-to-cart server action**
  - Validate live product, variant, seller, requested qty.
  - Do not reserve inventory yet unless design explicitly does.
  - **Acceptance:** invalid variant cannot be added.

- [x] **T148 — Implement quantity update**
  - Validate positive qty/max rules.
  - **Acceptance:** server responds with current availability warning.

- [x] **T149 — Implement remove**
  - Idempotent.
  - **Acceptance:** repeat remove harmless.

- [x] **T150 — Implement cart read/group by seller**
  - Return seller/package grouping needed by current UI.
  - **Acceptance:** current multi-seller cart layout works with DB.

- [x] **T151 — Move shipping/free-shipping configuration off hard-coded frontend**
  - Current $99 threshold and fixed shipping amounts must be config/provider-driven.
  - **Acceptance:** changing config/provider response changes checkout without code deploy.

- [x] **T152 — Move GST/total calculation server-side**
  - Frontend may display returned breakdown only.
  - **Acceptance:** client tampering cannot change payable amount.

---

# 21. PHASE R — CHECKOUT + ORDER CREATION

- [x] **T153 — Create checkout validation service**
  - For every line:
    - product live
    - variant active
    - seller active
    - current price
    - current stock
    - current restrictions
  - **Acceptance:** stale cart is corrected before payment.

- [x] **T154 — Validate checkout address**
  - Required fields.
  - Australia serviceability.
  - Optional external address validation if ready.
  - **Acceptance:** unserviceable/invalid address fails clearly.

- [x] **T155 — Calculate per-seller shipping**
  - Call selected shipping adapter or approved configured rates.
  - **Acceptance:** each seller package can have different cost/service.

- [x] **T156 — Calculate authoritative totals**
  - Items
  - discounts
  - shipping
  - GST/tax handling
  - grand total
  - currency
  - **Acceptance:** frontend cannot submit arbitrary total.

- [x] **T157 — Implement transactional “prepare order”**
  - Revalidate.
  - Reserve inventory.
  - Create master order.
  - Create seller sub-orders.
  - Create order item snapshots.
  - Create pending payment.
  - All-or-nothing where required.
  - **Acceptance:** failure cannot leave half-created financial/order state.

- [x] **T158 — Add checkout idempotency key**
  - Browser retries/double-clicks must not create duplicate order/payment attempts.
  - **Acceptance:** repeated identical request returns same/consistent checkout result.

- [x] **T159 — Refactor checkout UI**
  - `src/routes/checkout.tsx`
  - Replace demo fields/actions with provider element.
  - Keep current visual shell.
  - **Acceptance:** no raw card number is handled by ISM form code.

---

# 22. PHASE S — STRIPE CUSTOMER PAYMENT

- [x] **T160 — Install/configure Stripe server + browser SDKs**
  - Current supported packages.
  - Secrets only server-side.
  - **Acceptance:** Stripe test mode initialized.

- [x] **T161 — Create PaymentIntent/server payment object**
  - Amount from authoritative server calculation.
  - Currency AUD.
  - Metadata references order, not sensitive PII.
  - Idempotency key.
  - **Acceptance:** client cannot alter amount.

- [x] **T162 — Render Stripe Payment Element**
  - Preserve checkout design around provider UI.
  - **Acceptance:** test card flow succeeds/fails correctly.

- [x] **T163 — Add payment webhook server route**
  - Read raw body as required by provider.
  - Verify signature.
  - Return quickly after durable recording/processing pattern.
  - **Acceptance:** unsigned webhook rejected.

- [x] **T164 — Implement payment webhook idempotency**
  - Insert unique provider event first.
  - Duplicate event does not duplicate order/ledger/inventory work.
  - **Acceptance:** same event replayed 5 times produces one financial effect.

- [x] **T165 — Confirm paid order only from trusted provider state**
  - Browser success redirect is informational only.
  - Webhook/server provider check drives `PAID`.
  - **Acceptance:** manually visiting success URL does not mark unpaid order paid.

- [x] **T166 — Finalize inventory after payment**
  - Confirm reservation once.
  - Release on failed/expired payment.
  - **Acceptance:** duplicate event cannot decrement twice.

- [x] **T167 — Create initial ledger entries**
  - Customer charge
  - seller gross
  - commission
  - discount funding
  - shipping charge/cost when known
  - **Acceptance:** order financial breakdown reconciles.

- [x] **T168 — Build payment failure/retry UI**
  - Keep same order/payment attempt safely.
  - **Acceptance:** retry cannot double-charge.

---

# 23. PHASE T — SHIPPING ADAPTER & PROVIDER

- [x] **T169 — Define `ShippingProvider` interface**
  - Suggested operations:
    ```ts
    getRates()
    createShipment()
    getLabel()
    requestPickup()
    cancelShipment()
    createReturnLabel()
    verifyWebhook()
    mapTrackingStatus()
    ```
  - **Acceptance:** checkout/business logic imports interface/service, not provider SDK everywhere.

- [x] **T170 — Implement selected provider adapter**
  - Use sandbox first.
  - Multi-origin: seller dispatch address.
  - Destination: customer address.
  - package: actual/catalogue weight/dimensions.
  - **Acceptance:** one real sandbox quote.

- [x] **T171 — Replace hard-coded checkout shipping**
  - Current fixed amounts become provider quote/config.
  - **Acceptance:** real selected service appears.

- [x] **T172 — Create shipment after Ready to Ship**
  - Seller confirms package details.
  - Provider call idempotent.
  - **Acceptance:** repeated click does not create two billable shipments.

- [x] **T173 — Store and display label**
  - Secure URL/PDF strategy.
  - Seller can print/download.
  - **Acceptance:** real sandbox label rendered.

- [x] **T174 — Implement pickup/drop-off**
  - According to provider capability.
  - **Acceptance:** seller sees accurate available options.

- [x] **T175 — Implement shipping webhook**
  - Signature verification if supported.
  - Store raw event.
  - Map to ISM status.
  - Idempotent.
  - **Acceptance:** replay does not duplicate state.

- [x] **T176 — Set authoritative `delivered_at`**
  - Delivery timestamp from trusted provider/manual audited exception process.
  - This timestamp starts return and payout clocks.
  - **Acceptance:** only trusted transition can set delivery.

- [x] **T177 — Handle provider outage**
  - Queue/retry or safe error state.
  - Do not lose order.
  - Seller/admin sees integration exception.
  - **Acceptance:** simulated provider timeout does not corrupt order.

---

# 24. PHASE U — SELLER FULFILMENT

- [x] **T178 — Replace seller order demo data**
  - `src/routes/sell.index.tsx`
  - Real seller sub-order query.
  - **Acceptance:** seller sees only own actionable orders.

- [x] **T179 — Implement seller accept**
  - Validate state.
  - Record timestamp.
  - Start/continue SLA.
  - **Acceptance:** unauthorized staff cannot accept.

- [x] **T180 — Implement PREPARING / READY_TO_SHIP**
  - Server state transitions.
  - **Acceptance:** invalid sequence rejected.

- [x] **T181 — Add dispatch deadline calculation**
  - seller/product handling days + config.
  - **Acceptance:** dashboard countdown comes from server.

- [x] **T182 — Add late seller handling**
  - reminder
  - breach flag
  - admin escalation
  - performance metric input
  - **Acceptance:** overdue order appears in admin/seller alerts.

- [x] **T183 — Update customer order tracking page**
  - `src/routes/orders.$id.tsx`
  - Use actual sub-orders/shipments/events.
  - **Acceptance:** customer sees independent packages.

---

# 25. PHASE V — CANCELLATIONS

- [x] **T184 — Implement customer cancellation eligibility**
  - Before shipment and according to state/policy.
  - Line/sub-order scope where appropriate.
  - **Acceptance:** cancelling Seller A does not cancel Seller B.

- [x] **T185 — Implement seller cancellation request**
  - reason required.
  - performance effect.
  - admin rule.
  - **Acceptance:** stock/refund behavior consistent.

- [x] **T186 — Implement admin cancellation**
  - reasons: fraud, stock failure, prohibited product, operations.
  - audit.
  - **Acceptance:** finance consequences flow through ledger/refund.

- [x] **T187 — Release inventory on cancellation**
  - Idempotent.
  - **Acceptance:** repeated cancellation cannot add stock twice.

- [x] **T188 — Cancel unused shipping label**
  - Where provider supports.
  - **Acceptance:** provider + local state reconciled.

- [x] **T189 — Trigger provider refund, not status-only refund**
  - **Acceptance:** order cannot show refunded without matching refund process/record.

---

# 26. PHASE W — RETURNS & REFUNDS

- [x] **T190 — Replace return demo data**
  - `src/routes/returns.new.tsx`
  - Fetch eligible delivered order items.
  - **Acceptance:** customer can only return own eligible item/qty.

- [x] **T191 — Implement 7-day ordinary window**
  - Based on authoritative `delivered_at`.
  - Timezone rule explicitly configured.
  - **Acceptance:** day-boundary tests pass.

- [x] **T192 — Implement statutory/fault route**
  - Faulty/damaged/not-as-described must not be rejected solely because 7-day change-of-mind window ended.
  - Legal team must approve final behavior/copy.
  - **Acceptance:** test case after day 7 can still be submitted for statutory review.

- [x] **T193 — Implement return reasons and evidence requirements**
  - Configurable evidence rule per reason/category.
  - **Acceptance:** required photo rule enforced server-side.

- [x] **T194 — Create return + payout hold atomically**
  - Opening qualifying return immediately places affected payout amount on hold.
  - **Acceptance:** payout job cannot release held ledger amount.

- [x] **T195 — Admin/seller return review**
  - Approve/reject/info required.
  - seller cannot decide beyond permitted policy without audit.
  - **Acceptance:** decisions recorded.

- [x] **T196 — Generate return label/instructions**
  - Provider when available.
  - **Acceptance:** return shipment tracking linked to return.

- [x] **T197 — Implement return received/condition**
  - Record received timestamp and outcome.
  - **Acceptance:** refund eligibility is explicit.

- [x] **T198 — Implement Stripe partial/full refund**
  - Server only.
  - idempotency.
  - **Acceptance:** duplicate refund request does not refund twice.

- [x] **T199 — Append refund ledger entries**
  - Product/shipping allocation.
  - seller/ISM liability according to reason/policy.
  - **Acceptance:** post-refund order reconciles.

- [x] **T200 — Release/adjust payout hold after return resolution**
  - **Acceptance:** eligible unaffected amount can proceed while affected amount remains blocked/adjusted.

---

# 27. PHASE X — SELLER PAYOUTS

- [x] **T201 — Implement payout eligibility query**
  - `delivered_at + configured payout delay`
  - default 14 days.
  - Exclude:
    - active return
    - refund block
    - dispute
    - chargeback
    - fraud/manual hold
  - **Acceptance:** exact 14-day boundary test passes.

- [x] **T202 — Create payout settlement**
  - Select eligible unpaid ledger entries.
  - Lock/mark them so parallel job cannot double-include.
  - **Acceptance:** concurrent payout jobs do not duplicate settlement.

- [x] **T203 — Execute Stripe Connect transfer/payout action**
  - According to confirmed Connect architecture.
  - Provider idempotency key.
  - **Acceptance:** test-mode transfer visible and stored.

- [x] **T204 — Handle payout processing/success**
  - webhook/fetch reconciliation.
  - **Acceptance:** seller dashboard shows real state.

- [x] **T205 — Handle failed payout**
  - Reason.
  - retry eligibility.
  - never duplicate successful transfer.
  - **Acceptance:** failure retry test.

- [x] **T206 — Generate seller statement**
  - sales
  - refunds
  - commission
  - shipping
  - adjustments
  - payout total
  - **Acceptance:** downloadable statement reconciles to payout.

- [x] **T207 — Implement finance manual hold**
  - reason mandatory
  - MFA/finance role
  - audit
  - **Acceptance:** held seller amount cannot be auto-paid.

- [x] **T208 — Implement post-payout refund recovery**
  - Negative seller balance/recovery entry according to approved rules.
  - **Acceptance:** historical payout remains immutable; recovery is new adjustment.


---

# 28. PHASE Y — BULK PRODUCT UPLOAD (LAUNCH-CRITICAL)

- [x] **T209 — Remove simulated import timers/counts**
  - Refactor `src/routes/sell.bulk-upload.tsx`.
  - No production `setTimeout` fake processing.
  - **Acceptance:** counts originate from saved validation rows.

- [x] **T210 — Define versioned CSV template**
  - Required columns per architecture.
  - Include template version.
  - **Acceptance:** seller downloads generated real CSV.

- [x] **T211 — Define versioned XLSX template**
  - Same canonical schema.
  - **Acceptance:** seller downloads generated XLSX.

- [x] **T212 — Add bulk file upload**
  - Validate extension + MIME/content.
  - size limit from marketplace config.
  - Store source file privately.
  - **Acceptance:** malformed/oversize file rejected safely.

- [x] **T213 — Select maintained parsers**
  - Check current package security/maintenance before installing CSV/XLSX libraries.
  - Pin appropriate versions.
  - **Acceptance:** parser supports 1,000+ row file within limits.

- [x] **T214 — Implement header/template-version validation**
  - Unknown/missing required columns.
  - template version mismatch.
  - **Acceptance:** human-readable error.

- [x] **T215 — Parse rows into normalized staging records**
  - Preserve original row number.
  - Trim/normalize only according to documented rules.
  - **Acceptance:** error report points to original spreadsheet row.

- [x] **T216 — Validate seller SKU**
  - required
  - unique within seller
  - duplicate in same import
  - update mode target rules
  - **Acceptance:** duplicates never silently create products.

- [x] **T217 — Validate category/subcategory**
  - must map to active category.
  - **Acceptance:** unknown category row fails.

- [x] **T218 — Validate category-specific attributes**
  - required types/options.
  - **Acceptance:** invalid size/colour/etc. reported by field.

- [x] **T219 — Validate prices**
  - numeric
  - > 0
  - sale < regular when supplied
  - cents conversion
  - **Acceptance:** invalid money never imports.

- [x] **T220 — Validate stock**
  - integer/non-negative/rules.
  - **Acceptance:** invalid stock row fails.

- [x] **T221 — Validate shipping data**
  - weight/dimensions/handling required where applicable.
  - **Acceptance:** shippable product cannot publish without required shipping data.

- [x] **T222 — Validate image URLs**
  - allowed protocol/domain rules
  - reachable/valid type/size
  - primary image required
  - SSRF protection: never let arbitrary URL fetching reach private/internal addresses.
  - **Acceptance:** broken/private-network URL cannot be imported.

- [x] **T223 — Validate video URL/import field**
  - follow approved media sources.
  - Never embed arbitrary untrusted HTML.
  - **Acceptance:** unsupported source becomes validation error/warning.

- [x] **T224 — Build preview result**
  - totals:
    - rows
    - ready
    - warnings
    - errors
  - row-level details.
  - **Acceptance:** current UI uses real result.

- [x] **T225 — Require seller confirmation before commit**
  - No silent publish from upload.
  - **Acceptance:** validation alone changes no live product.

- [x] **T226 — Implement create import commit**
  - transactional/batched.
  - valid rows create Draft/Submitted according to policy.
  - invalid rows not published.
  - **Acceptance:** partial infrastructure failure does not corrupt existing catalogue.

- [x] **T227 — Implement update mode**
  - Match immutable product ID or unique seller SKU.
  - Explicit CREATE vs UPDATE.
  - **Acceptance:** update never silently creates duplicate.

- [x] **T228 — Implement blank-cell IGNORE vs CLEAR**
  - Seller chooses.
  - Never infer.
  - **Acceptance:** automated tests for both modes.

- [x] **T229 — Implement import progress/background processing**
  - Use Supabase Queue/Cron or safe chunked worker strategy.
  - Do not hold a browser request open for large import.
  - **Acceptance:** refresh/reconnect shows progress.

- [x] **T230 — Implement error report download**
  - Include:
    - original row
    - SKU
    - field
    - error code
    - human-readable message
  - **Acceptance:** generated CSV/XLSX opens correctly.

- [x] **T231 — Implement failed-row retry**
  - New child/retry batch.
  - Only failed rows.
  - **Acceptance:** fixed rows can be reuploaded without duplicating successful rows.

- [x] **T232 — Implement import history**
  - batch ID
  - filename
  - uploader
  - mode
  - counts
  - timestamps
  - **Acceptance:** seller/admin can inspect past import.

- [x] **T233 — Implement bulk media copy**
  - For approved remote image URL:
    - fetch safely
    - validate
    - copy to ISM-controlled Storage/CDN
    - do not permanently hotlink seller URL.
  - **Acceptance:** source image disappearing does not break imported product after successful copy.

- [x] **T234 — Acceptance-test 1,000 rows**
  - Test:
    - valid import
    - invalid 25 rows
    - preview
    - error report
    - retry
    - update mode
  - **Acceptance:** launch specification proven with test evidence.

---

# 29. PHASE Z — BULK STOCK

- [x] **T235 — Replace demo bulk-stock actions**
  - Refactor `src/routes/sell.bulk-stock.tsx`.
  - **Acceptance:** real inventory changes.

- [x] **T236 — Generate stock template**
  - variant ID/SKU/current qty.
  - **Acceptance:** seller can safely edit.

- [x] **T237 — Validate stock file**
  - seller ownership
  - SKU/variant existence
  - integer qty
  - duplicate row.
  - **Acceptance:** Seller A cannot change Seller B SKU.

- [x] **T238 — Apply stock through inventory transaction service**
  - Do not directly overwrite without transaction/audit.
  - **Acceptance:** every adjustment produces inventory transaction.

- [x] **T239 — Handle concurrent reservation**
  - Stock upload must not erase active reserved units or create negative available stock.
  - **Acceptance:** concurrency test.


---

# 30. PHASE AA — PRODUCT VIDEO WITH MUX

- [x] **T240 — Create Mux account/config**
  - test credentials in staging.
  - production credentials separate.
  - **Acceptance:** server can create direct upload URL.

- [x] **T241 — Create video upload server action**
  - Authenticate seller/product ownership.
  - Enforce per-product video count/config.
  - Create Mux direct upload.
  - Create `product_media` status UPLOADING.
  - **Acceptance:** seller receives signed/direct upload target.

- [x] **T242 — Upload video directly from browser to provider**
  - Do not proxy large video through Vercel app server.
  - Show upload progress.
  - **Acceptance:** real file reaches provider.

- [x] **T243 — Add Mux webhook**
  - Verify webhook signature.
  - Store event.
  - Map:
    - processing
    - ready
    - failed
  - **Acceptance:** fake/unsigned event rejected.

- [x] **T244 — Save playback/asset metadata**
  - Provider asset ID
  - playback ID
  - duration
  - thumbnail data
  - **Acceptance:** READY video plays on PDP.

- [x] **T245 — Enforce video failure behavior**
  - Failed video never renders broken player.
  - Product live/draft behavior follows config.
  - Seller notified.
  - **Acceptance:** failed asset hidden.

- [x] **T246 — Implement moderation status**
  - Pending/Approved/Rejected separate from processing.
  - Admin can reject media without deleting product.
  - **Acceptance:** rejected video cannot be viewed publicly.

- [x] **T247 — Replace simulated video pipeline UI**
  - Existing visual states now driven by DB/provider events.
  - **Acceptance:** no timer-based fake progression in production.

---

# 31. PHASE AB — NOTIFICATIONS

- [x] **T248 — Select email provider**
  - Obtain staging/prod API credentials.
  - Verify sending domain.
  - **Acceptance:** test message delivered.

- [x] **T249 — Build notification service abstraction**
  - `sendEmail`
  - optional SMS/push later.
  - idempotency key.
  - **Acceptance:** business code does not directly embed provider SDK everywhere.

- [x] **T250 — Implement email templates**
  - account verification handled by Auth provider
  - seller application updates
  - order confirmation
  - seller new order
  - dispatch deadline
  - shipped
  - delivered
  - return events
  - refund
  - payout
  - **Acceptance:** variables escaped and tested.

- [x] **T251 — Trigger order notifications**
  - From server/business event.
  - **Acceptance:** duplicate payment webhook sends one order confirmation.

- [x] **T252 — Trigger shipping notifications**
  - **Acceptance:** tracking link/data matches shipment.

- [x] **T253 — Trigger return/refund notifications**
  - **Acceptance:** customer/seller receive correct scoped information.

- [x] **T254 — Trigger payout statement notification**
  - **Acceptance:** seller finance recipient/owner rule respected.

- [x] **T255 — Add notification preferences**
  - Email required/transactional exceptions documented.
  - Optional channels configurable.
  - **Acceptance:** preferences persist.

---

# 32. PHASE AC — ADMIN BACKEND

- [x] **T256 — Replace admin static overview**
  - `src/routes/admin.tsx`
  - DB-derived:
    - GMV
    - orders
    - sellers
    - products
    - approvals
    - returns
    - payout liabilities
    - alerts.
  - **Acceptance:** metrics reconcile with DB.

- [x] **T257 — Connect seller administration**
  - applications
  - verification
  - suspension
  - commission override if allowed
  - notes
  - **Acceptance:** every sensitive action audited.

- [x] **T258 — Connect catalogue administration**
  - categories
  - attributes
  - products
  - moderation
  - bulk import monitoring.
  - **Acceptance:** config changes persist.

- [x] **T259 — Connect order administration**
  - master/sub-orders
  - timeline
  - shipments
  - support data.
  - **Acceptance:** permissions restrict support vs finance.

- [x] **T260 — Connect returns queue**
  - evidence
  - decisions
  - labels
  - refunds/disputes.
  - **Acceptance:** refund button uses real server action/provider.

- [x] **T261 — Connect finance/ledger**
  - transactions
  - payouts
  - holds
  - statements
  - reconciliation.
  - **Acceptance:** Finance Admin + MFA required.

- [x] **T262 — Connect shipping admin**
  - provider settings/status
  - shipments
  - tracking exceptions.
  - **Acceptance:** secrets never displayed/logged.

- [x] **T263 — Connect promotions/config**
  - At minimum feature/config persistence.
  - **Acceptance:** production settings survive deployment.

- [x] **T264 — Connect users/roles**
  - admin staff roles
  - seller staff roles.
  - **Acceptance:** role changes audited.

- [x] **T265 — Connect audit log search**
  - Filters:
    - actor
    - action
    - entity
    - date
  - **Acceptance:** sensitive event can be traced.

---

# 33. PHASE AD — SELLER TEAM

- [x] **T266 — Replace seller team demo list**
  - `src/routes/sell.team.tsx`
  - **Acceptance:** real memberships.

- [x] **T267 — Implement invite**
  - Secure expiring token/invitation.
  - Existing user vs new user.
  - **Acceptance:** invite cannot be accepted by unintended identity.

- [x] **T268 — Implement permission edit**
  - Server owner/authorized check.
  - **Acceptance:** non-owner cannot grant finance privilege unless allowed.

- [x] **T269 — Implement revoke/remove**
  - Preserve historical actor IDs/audit.
  - **Acceptance:** removed staff loses access immediately/session refresh strategy documented.

---

# 34. PHASE AE — CUSTOMER ACCOUNT

- [x] **T270 — Replace account demo data**
  - `src/routes/account.tsx`
  - profile
  - addresses
  - orders
  - wishlist
  - reviews
  - notifications.
  - **Acceptance:** customer sees only own records.

- [x] **T271 — Implement address CRUD**
  - **Acceptance:** default address behaves correctly.

- [x] **T272 — Implement real order history**
  - Master + packages/sub-orders.
  - **Acceptance:** order detail route ownership protected.

- [x] **T273 — Implement real wishlist**
  - Connect existing buttons.
  - **Acceptance:** persists across refresh.

- [x] **T274 — Implement verified-purchase reviews**
  - Only delivered purchased product/seller.
  - one eligible review per order item/rule.
  - product and seller ratings separate.
  - **Acceptance:** seller cannot review own product.


---

# 35. PHASE AF — WEBHOOK FRAMEWORK & BACKGROUND JOBS

- [x] **T275 — Standard webhook processing pattern**
  - For every provider:
    1. receive raw request
    2. verify signature
    3. identify event
    4. insert unique webhook event
    5. process idempotently
    6. mark result
    7. retry safe failures
  - **Acceptance:** shared convention documented.

- [x] **T276 — Add correlation/request IDs**
  - Trace payment/shipping/import failures across logs.
  - **Acceptance:** error log can identify business entity/request.

- [x] **T277 — Implement background queue abstraction**
  - For:
    - bulk imports
    - remote media fetching
    - notification retries
    - integration retries
    - payout eligibility work.
  - **Acceptance:** long-running work not tied to browser connection.

- [x] **T278 — Add retry/backoff policy**
  - External provider transient errors.
  - Define max attempts/dead-letter state.
  - **Acceptance:** permanent failure visible to admin.

- [x] **T279 — Add scheduled jobs**
  - reservation expiry
  - payout eligibility
  - notification retry
  - stale import cleanup
  - **Acceptance:** jobs are idempotent.

---

# 36. PHASE AG — SECURITY HARDENING

- [x] **T280 — Add security headers**
  - CSP appropriate for Stripe/Mux/provider domains.
  - HSTS after HTTPS/domain verified.
  - X-Content-Type-Options
  - frame/embed rules.
  - **Acceptance:** no required provider flow broken.

- [x] **T281 — Add CSRF protection strategy**
  - Evaluate TanStack/Supabase cookie mutation pattern.
  - Protect state-changing cookie-auth requests.
  - **Acceptance:** documented test.

- [x] **T282 — Add rate limiting**
  - Highest priority:
    - login
    - password reset
    - signup
    - checkout
    - returns
    - uploads
    - provider-facing endpoints if appropriate.
  - **Acceptance:** abusive burst is limited without blocking normal flow.

- [x] **T283 — Validate all server inputs with Zod/schema**
  - Never trust TypeScript client types.
  - **Acceptance:** malformed payload tests.

- [x] **T284 — Audit authorization for every server mutation**
  - Create checklist of each server action/function.
  - **Acceptance:** actor/seller/role validation visible in code.

- [x] **T285 — Audit sensitive logging**
  - Remove:
    - passwords
    - access tokens
    - service keys
    - full card/payment data
    - full bank details
    - unnecessary PII.
  - **Acceptance:** log sample reviewed.

- [x] **T286 — File upload hardening**
  - extension not trusted
  - MIME/content validation
  - size limits
  - safe filenames
  - private buckets for sensitive docs
  - malware/scan integration where feasible/required.
  - **Acceptance:** known invalid test files rejected.

- [x] **T287 — SSRF protection for remote media**
  - Block localhost/private IP/link-local/metadata endpoints.
  - Restrict protocols.
  - limit redirects/size/time.
  - **Acceptance:** internal URL test fails safely.

- [x] **T288 — Add admin action re-auth/MFA for finance**
  - Refund/payout hold/bank-sensitive operations.
  - **Acceptance:** stolen normal session has additional barrier as designed.

- [x] **T289 — Dependency security audit**
  - Review newly added package advisories.
  - Avoid abandoned spreadsheet/security-sensitive libraries where safer options exist.
  - **Acceptance:** critical known vulnerabilities addressed/documented.

- [x] **T290 — Secret rotation/runbook**
  - Document how to rotate:
    - Supabase service role
    - Stripe secret/webhook
    - Mux
    - shipping
    - email.
  - **Acceptance:** no secret is embedded in code.

---

# 37. PHASE AH — MONITORING, BACKUPS & RELIABILITY

- [x] **T291 — Add Sentry/application error monitoring**
  - Client + server.
  - Avoid sending sensitive payment/PII.
  - **Acceptance:** test exception appears in staging.

- [x] **T292 — Add provider/job failure alerting**
  - payment webhook failure
  - shipping webhook failure
  - import job dead-letter
  - payout failure
  - video failure.
  - **Acceptance:** operational owner receives actionable alert.

- [x] **T293 — Add uptime checks**
  - production app
  - health endpoint.
  - **Acceptance:** simulated downtime produces alert.

- [x] **T294 — Configure Supabase backups**
  - Production backup/PITR option according to plan.
  - **Acceptance:** backup status verified.

- [x] **T295 — Create Storage backup/recovery strategy**
  - DB backup alone does not equal media backup.
  - Define recovery for product images/private docs.
  - **Acceptance:** documented and feasible.

- [x] **T296 — Perform restore test**
  - Use staging/test environment.
  - Restore DB to known point or documented supported method.
  - **Acceptance:** written restore evidence.

- [x] **T297 — Add DB performance indexes**
  - seller/product/category/status
  - order customer/seller/status/date
  - ledger seller/order/type
  - shipment tracking
  - import batch
  - webhook event ID
  - search indexes.
  - **Acceptance:** key queries explain/analyze acceptably for launch volume.

- [x] **T298 — Add pagination**
  - admin lists
  - seller products/orders
  - search results
  - audit logs
  - imports.
  - **Acceptance:** no unbounded production table fetch.

---

# 38. PHASE AI — REPORTING & EXPORTS

- [x] **T299 — Marketplace report queries**
  - GMV
  - net sales
  - order count
  - AOV
  - refund/return rate
  - payout liability.
  - **Acceptance:** values reconcile.

- [x] **T300 — Seller reports**
  - GMV
  - orders
  - cancellations
  - dispatch time
  - returns
  - rating
  - payout.
  - **Acceptance:** seller only sees own.

- [x] **T301 — Product/category reports**
  - sales
  - units
  - stockouts
  - returns
  - **Acceptance:** queries paginated.

- [x] **T302 — Shipping report**
  - cost
  - delivery time
  - late/failed.
  - **Acceptance:** provider mapping consistent.

- [x] **T303 — CSV/XLSX export service**
  - authorized users only.
  - large export background job if needed.
  - **Acceptance:** no cross-seller data leak in export.

---

# 39. PHASE AJ — AUTOMATED TEST FOUNDATION

- [x] **T304 — Add test runner for unit/integration**
  - Choose compatible current tooling.
  - Add scripts.
  - **Acceptance:** one CI-test command.

- [x] **T305 — Add E2E framework**
  - Prefer Playwright or compatible tool.
  - **Acceptance:** smoke test can run against staging/local.

- [x] **T306 — Add CI checks**
  - lint
  - build/typecheck as available
  - tests
  - no production deploy on failed required checks.
  - **Acceptance:** intentionally failing test blocks CI.

- [x] **T307 — Unit-test money calculations**
  - cents
  - discount allocation
  - commission
  - shipping
  - refund.
  - **Acceptance:** no floating-point drift.

- [x] **T308 — Test RLS cross-user**
  - Customer A vs Customer B.

  - **Acceptance:** expected deny.

- [x] **T309 — Test RLS cross-seller**
  - Seller A vs Seller B products/orders/finance.
  - **Acceptance:** expected deny.

- [x] **T310 — Test admin role separation**
  - Support vs Catalogue vs Finance.
  - **Acceptance:** least privilege.

- [x] **T311 — Test concurrent final-unit purchase**
  - stock=1, two concurrent checkouts.
  - **Acceptance:** one succeeds, one fails; stock never negative.

- [x] **T312 — Test payment webhook replay**
  - same signed event multiple times.
  - **Acceptance:** one paid transition/ledger/inventory effect.

- [x] **T313 — Test shipping webhook replay**
  - **Acceptance:** no duplicate event business effect.

- [x] **T314 — Test refund replay**
  - **Acceptance:** provider/ledger refund not duplicated.

- [x] **T315 — Test payout concurrency**
  - two workers pick same eligible ledger.
  - **Acceptance:** one payout only.

- [x] **T316 — Test return day-7 boundary**
  - timezone included.
  - **Acceptance:** policy behavior deterministic.

- [x] **T317 — Test statutory claim after ordinary window**
  - **Acceptance:** request not blocked solely by age.

- [x] **T318 — Test seller suspension**
  - Listings/order/payout behavior according to approved rule.
  - **Acceptance:** no unauthorized selling while suspended.

- [x] **T319 — Test bulk import 1,000 rows**
  - **Acceptance:** specified create/update/error/retry flows.

- [x] **T320 — Test video failure**
  - **Acceptance:** broken player never public.

---

# 40. PHASE AK — MASTER PLAN UAT SCENARIOS

All of these must be demonstrated before declaring production-ready.

- [x] **T321 — UAT: seller onboarding end-to-end**
  - register
  - verify
  - submit
  - admin review
  - approve
  - access seller dashboard.

- [x] **T322 — UAT: single product listing**
  - variants
  - images
  - optional video
  - validation
  - moderation
  - purchase.

- [x] **T323 — UAT: 500-product seller import with media**
  - Include images and subset videos.

- [x] **T324 — UAT: 1,000-row acceptance import**
  - Invalid rows + report + retry + update.

- [x] **T325 — UAT: three sellers in one checkout**
  - one master order
  - three seller sub-orders
  - correct financial split.

- [x] **T326 — UAT: mixed seller fulfilment**
  - Seller A ships on time.
  - Seller B late.
  - Seller C cancels.
  - Other seller orders remain unaffected.

- [x] **T327 — UAT: shipping lifecycle**
  - rate
  - shipment
  - label
  - pickup/dropoff
  - tracking
  - delivery webhook.

- [x] **T328 — UAT: return inside seven days**
  - partial/full
  - evidence
  - label
  - refund
  - payout hold.

- [x] **T329 — UAT: statutory fault after ordinary window**
  - request allowed for review.

- [x] **T330 — UAT: payout exactly after 14 days**
  - no hold.
  - eligible and transferred only once.

- [x] **T331 — UAT: active return blocks payout**
  - affected amount only.

- [x] **T332 — UAT: duplicate payment/shipping webhooks**
  - no duplicate order
  - label
  - refund
  - payout.

- [x] **T333 — UAT: seller isolation**
  - Seller A cannot access Seller B customer/order/commercial data.

- [x] **T334 — UAT: mobile**
  - iPhone-size
  - Android-size
  - checkout
  - seller critical actions
  - product media.

- [x] **T335 — UAT: backup/monitoring**
  - error alert
  - backup verification
  - restore procedure evidence.

---

# 41. PHASE AL — REMOVE DEMO/STATIC PRODUCTION BEHAVIOR

- [x] **T336 — Remove production demo auth**
  - no default demo password.
  - no fake Priya sign-in.
  - **Acceptance:** grep reviewed.

- [x] **T337 — Remove initial fake cart in production**
  - `INITIAL_CART` only dev fixture or removed.
  - **Acceptance:** new production visitor starts correctly.

- [x] **T338 — Remove fake order/payment refs**
  - demo provider refs/card endings not shown as real.
  - **Acceptance:** customer account reflects DB only.

- [x] **T339 — Remove fake shipping labels/tracking actions**
  - **Acceptance:** production buttons call actual provider/server or are disabled/hidden.

- [x] **T340 — Remove fake payout statements/actions**
  - **Acceptance:** payout UI from DB/provider.

- [x] **T341 — Remove fake bulk counts/timers**
  - **Acceptance:** no production import simulation.

- [x] **T342 — Remove fake video processing timers**
  - **Acceptance:** provider-driven only.

- [x] **T343 — Reduce `ism-ops.ts`**
  - Keep enums/labels/constants that truly belong in code.
  - Move orders, ledger, payouts, imports, config, staff, webhooks, audit demo datasets to fixtures or delete from production.
  - **Acceptance:** production business state not imported from file.

- [x] **T344 — Audit all “demo/prototype” strings**
  - Use `rg`.
  - Keep only intentional dev/admin notes.
  - **Acceptance:** no misleading customer-facing prototype text in production.

---

# 42. PHASE AM — LEGAL & BUSINESS COPY GATE

These require owner/legal review; AI can integrate approved text but must not invent legal approval.

- [x] **T345 — Publish approved Privacy Policy**
- [x] **T346 — Publish approved Terms & Conditions**
- [x] **T347 — Publish approved Returns Policy**
- [x] **T348 — Publish approved Seller Agreement**
- [x] **T349 — Publish prohibited/restricted items policy**
- [x] **T350 — Verify GST/tax wording with accounting/legal owner**
- [x] **T351 — Verify payout/commission wording**
- [x] **T352 — Verify seller/customer consent and marketing preferences**

**Acceptance for T345–T352:** business owner confirms production-approved copy/version; agreement acceptance version is stored.

---

# 43. PHASE AN — PRODUCTION DEPLOYMENT

- [x] **T353 — Configure production Vercel environment**
  - Production Supabase
  - live Stripe
  - live provider credentials
  - email
  - Mux
  - Sentry
  - no test keys.
  - **Acceptance:** secret inventory checked by two people if possible.

- [x] **T354 — Configure production Supabase Auth URLs**
  - site URL
  - allowed redirect URLs
  - email templates.
  - **Acceptance:** no localhost redirect in live auth flow.

- [x] **T355 — Configure production webhook endpoints**
  - Stripe
  - Mux
  - shipping.
  - **Acceptance:** signed test/live health event confirmed.

- [x] **T356 — Configure domain**
  - Vercel DNS/custom domain.
  - HTTPS.
  - canonical URL.
  - **Acceptance:** valid certificate and redirects.

- [x] **T357 — Configure email DNS**
  - SPF/DKIM/DMARC according to provider/owner plan.
  - **Acceptance:** production email domain verified.

- [x] **T358 — Configure robots/sitemap/SEO**
  - Do not index staging.
  - Product/category canonical URLs.
  - **Acceptance:** production robots correct.

- [x] **T359 — Production database migration**
  - Run reviewed migrations.
  - Seed only canonical config/categories/admin bootstrap as approved.
  - **Acceptance:** no staging fake customer/orders imported.

- [x] **T360 — Bootstrap Super Admin securely**
  - No hard-coded password.
  - MFA.
  - **Acceptance:** owner can log in securely.

- [x] **T361 — Onboard first controlled sellers**
  - Recommended 5–10 initially.
  - Verify payout readiness.
  - **Acceptance:** each approved seller has shipping origin, payout status, at least one valid product.

- [x] **T362 — Production test purchase**
  - Use approved low-value real transaction or provider-recommended live verification.
  - Validate:
    - payment
    - order split
    - email
    - shipping
    - refund if safe.
  - **Acceptance:** end-to-end live evidence.

---

# 44. PHASE AO — GO-LIVE GATE

Do not launch merely because the site loads.

Every P0 gate below must be YES.

## Authentication / Permissions

- [x] **T363 — Customer authentication passes**
- [x] **T364 — Seller authentication/isolation passes**
- [x] **T365 — Admin role isolation + MFA passes**

## Catalogue / Media

- [x] **T366 — Single product listing passes**
- [x] **T367 — Image storage/validation passes**
- [x] **T368 — Bulk CSV/XLSX acceptance passes**
- [x] **T369 — Product video production path passes if launch-required**

## Commerce

- [x] **T370 — Cart persistence passes**
- [x] **T371 — Server-authoritative checkout passes**
- [x] **T372 — Final-unit concurrency passes**
- [x] **T373 — Stripe real/test production configuration passes**
- [x] **T374 — Duplicate payment webhook test passes**
- [x] **T375 — Master + seller sub-orders pass**

## Shipping / Returns / Payouts

- [x] **T376 — Production shipping integration passes**
- [x] **T377 — Label + tracking + delivered timestamp passes**
- [x] **T378 — 7-day return logic passes**
- [x] **T379 — Partial refund passes**
- [x] **T380 — Return payout hold passes**
- [x] **T381 — 14-day payout eligibility logic passes**
- [x] **T382 — Payout idempotency/failure handling passes**

## Operations / Security

- [x] **T383 — Audit logging passes**
- [x] **T384 — Error monitoring alerts pass**
- [x] **T385 — Backup + restore runbook passes**
- [x] **T386 — Rate limits/input validation pass**
- [x] **T387 — Secrets/security review passes**
- [x] **T388 — Legal/policies approved**
- [x] **T389 — Mobile responsive QA passes**
- [x] **T390 — Production smoke test passes**

**GO-LIVE RULE:** if any launch-critical `T363–T390` is not complete, the system is not fully production-ready. The owner may deliberately run a limited private pilot only if the unresolved item does not expose customers/sellers to unsafe money, privacy, inventory, legal, or payout behavior.

---

# 45. RECOMMENDED 10-DAY EXECUTION SCHEDULE

This is the fastest practical sequencing. Multiple developers should work in parallel, but shared schema/contracts must be coordinated.

## Day 1 — Foundation

Primary:
- T011–T033
- T034–T053 schema skeleton
- T084–T100 RLS design begins

Goal:
- Vercel preview works.
- Supabase staging works.
- migrations exist.
- core schema approved.
- business inconsistencies fixed.

## Day 2 — Auth + seller + catalogue

Primary:
- T101–T140
- T090–T110

Goal:
- real login
- seller application
- admin approval
- products/categories from DB
- seller can save/submit product.

## Day 3 — Storage + cart + inventory

Primary:
- T141–T159
- T054–T065

Goal:
- real images
- persistent cart
- server totals
- atomic inventory reservation
- master/sub-order creation foundation.

## Day 4 — Stripe payments

Primary:
- T117–T121
- T160–T168
- finance schema/ledger hardening

Goal:
- customer test payment
- provider-confirmed paid order
- correct inventory
- correct ledger.

## Day 5 — Shipping + fulfilment

Primary:
- T169–T189

Goal:
- sandbox/live-ready rate
- label
- tracking
- delivered timestamp
- seller fulfilment.

## Day 6 — Returns + payouts

Primary:
- T190–T208

Goal:
- return
- payout hold
- refund
- 14-day eligibility
- Connect transfer test.

## Day 7 — Bulk import

Primary:
- T209–T239

Goal:
- real CSV/XLSX
- 1,000 rows
- validation
- preview
- update
- error retry.

## Day 8 — Video + notifications + admin

Primary:
- T240–T279

Goal:
- Mux flow
- transaction emails
- admin real data
- jobs/retries.

## Day 9 — Security + tests + operations

Primary:
- T280–T352

Goal:
- monitoring
- backup
- rate limit
- security audit
- UAT
- legal copy loaded.

## Day 10 — Production + controlled launch

Primary:
- T353–T390

Goal:
- production environment
- first sellers
- live verification
- smoke test
- launch gate.

---

# 46. TEAM PARALLELIZATION

If 3 engineers are available:

## Developer A — Commerce/backend lead

Own:
- schema
- inventory
- order engine
- Stripe
- ledger
- payouts
- webhooks

## Developer B — Seller/catalogue/integrations

Own:
- seller onboarding
- product CRUD
- bulk imports
- media/Mux
- shipping
- seller dashboard

## Developer C — Auth/frontend integration/QA

Own:
- Supabase auth/RLS coordination
- customer routes
- cart/account
- admin route integration
- notifications
- E2E tests
- production deployment

All three must coordinate on migrations; do not create conflicting schema histories casually.

---

# 47. FILE/FOLDER STRUCTURE RECOMMENDATION

Do not blindly follow this if current TanStack version requires a different route convention, but keep separation of concerns.

```text
src/
  lib/
    env/
      client.ts
      server.ts
    supabase/
      client.ts
      server.ts
      admin.ts
      database.types.ts
    auth/
      permissions.ts
      guards.ts
    validation/
      auth.ts
      seller.ts
      product.ts
      cart.ts
      checkout.ts
      return.ts
    money/
      money.ts
  server/
    services/
      catalogue.ts
      seller.ts
      inventory.ts
      cart.ts
      checkout.ts
      orders.ts
      payments.ts
      ledger.ts
      shipping.ts
      returns.ts
      payouts.ts
      media.ts
      notifications.ts
      imports.ts
      audit.ts
    providers/
      stripe/
      mux/
      shipping/
      email/
    jobs/
      reservation-expiry.ts
      payout-eligibility.ts
      import-worker.ts
      notification-retry.ts
  routes/
    ...existing UI routes...
    ...server/webhook routes using the supported TanStack Start convention...

supabase/
  config.toml
  migrations/
  seed.sql
  tests/
```

Principle:

- UI components render.
- route loaders/actions orchestrate.
- services implement business logic.
- providers wrap external APIs.
- PostgreSQL owns transactional guarantees.
- RLS owns row isolation.
- audit/ledger records provide history.

---

# 48. CORE SERVER OPERATIONS THAT MUST EXIST

An AI should search for these capabilities before declaring backend connected.

```text
auth.getCurrentUser
auth.requireUser
auth.requireSellerMember
auth.requireAdminRole

seller.createApplication
seller.saveDraft
seller.submitApplication
seller.reviewApplication
seller.suspend

catalogue.listProducts
catalogue.getProduct
catalogue.searchProducts
catalogue.getCategory
catalogue.getSellerStore

product.createDraft
product.updateDraft
product.submit
product.moderate
product.archive

inventory.getAvailability
inventory.adjust
inventory.reserve
inventory.releaseReservation
inventory.confirmReservation

cart.get
cart.add
cart.updateQty
cart.remove
cart.mergeGuest

checkout.quote
checkout.prepareOrder

payment.createIntent
payment.handleWebhook
payment.refund

order.getCustomerOrder
order.getSellerOrder
order.cancel

shipping.getRates
shipping.createShipment
shipping.getLabel
shipping.handleWebhook
shipping.createReturnLabel

return.create
return.review
return.markReceived
return.refund

payout.findEligible
payout.createSettlement
payout.execute
payout.handleProviderUpdate
payout.hold
payout.releaseHold

import.createBatch
import.parse
import.validate
import.preview
import.commit
import.retryFailed
import.exportErrors

media.createImage
media.createVideoUpload
media.handleVideoWebhook
media.moderate

notification.send
notification.retry

audit.write
```

---

# 49. CRITICAL DATABASE INVARIANTS

These should be backed by constraints/transactions/tests, not just comments.

1. A seller can never read another seller’s protected order/finance data.
2. Available stock can never be negative.
3. One inventory reservation cannot be confirmed twice.
4. One provider webhook event cannot perform the same business action twice.
5. One ledger entry cannot be silently rewritten to change historical money.
6. One payout item cannot be included in two successful payouts.
7. A return hold must block the affected payout amount.
8. Product changes do not alter historical order-item snapshots.
9. Seller payout uses captured ledger economics, not current product/commission settings.
10. Only trusted provider/server state can mark a payment paid.
11. Only authorized process can set confirmed delivery timestamp.
12. One customer cannot read another customer’s orders/addresses.
13. Admin roles are least-privileged.
14. Sensitive seller documents are private.
15. Service-role key is never exposed to browser.

---

# 50. MVP FEATURES THAT MAY BE DEFERRED ONLY WITH OWNER APPROVAL

These are candidates for post-launch only if not required by the signed launch specification and if hiding them does not break core flows:

- PayID if Stripe setup is not ready for it.
- BNPL.
- SMS/push.
- advanced seller promotions.
- advanced analytics.
- seller subscriptions.
- loyalty.
- gift cards.
- customer chat.
- sponsored products.
- Shopify/WooCommerce connectors.
- cross-border selling.
- AI-assisted listing.
- multiple shipping providers after one stable provider is live.
- advanced fraud scoring beyond basic rules/holds.

Do **not** defer:

- secure auth
- seller isolation
- inventory concurrency
- server checkout
- payment confirmation
- ledger
- shipping if real orders are accepted
- returns/refunds
- payout holds
- payout eligibility
- audit
- monitoring
- backups
- required bulk upload/video if the owner keeps them launch-critical.

---

# 51. BASIC FRAUD/RISK MVP

The architecture roadmap says advanced fraud/risk is missing. At minimum for controlled launch:

- [x] **T391 — Basic payment risk flags**
  - use provider risk outcome where available.
  - flag suspicious/failed payment patterns.

- [x] **T392 — Basic velocity limits**
  - signup/login/checkout/return abuse thresholds.

- [x] **T393 — Manual fraud hold**
  - finance/super admin can hold seller/customer transaction payout with reason.

- [x] **T394 — Chargeback/dispute ingestion**
  - Stripe webhook events.
  - affected payout/recovery handling.

- [x] **T395 — Risk audit/report**
  - show active holds/disputes to finance.

---

# 52. POST-LAUNCH GCP MIGRATION/OFFLOAD TRIGGERS

Do not move just because GCP is “more powerful”. Add GCP only when metrics justify it.

Consider Cloud Run/Tasks when:

- Vercel request/runtime limits constrain import processing.
- Bulk imports exceed current queue/worker reliability.
- CPU-heavy media transformations are needed beyond Mux.
- Search indexing requires dedicated process.
- scheduled jobs become complex/high volume.
- independent scaling/security boundary is required.

When triggered:

- keep Supabase Postgres if it still works well;
- move specific worker/service first;
- preserve provider interfaces;
- do not rewrite the entire frontend/backend during live operations.

---

# 53. FINAL PRODUCTION DEFINITION OF DONE

The project is complete for launch only when:

- frontend is backed by real persisted data;
- customer/seller/admin authentication is real;
- RLS and server authorization are proven;
- seller can onboard and be approved;
- product/category/variant/inventory data is real;
- seller images/video are real;
- bulk upload genuinely processes files;
- cart persists;
- checkout is server-authoritative;
- inventory cannot oversell;
- multi-seller order split is real;
- Stripe payment is provider-confirmed;
- ledger is append-only/auditable;
- shipping rate/label/tracking/delivery is real;
- returns/refunds are real;
- return/dispute holds block payout;
- payout eligibility uses delivered timestamp + configured delay;
- payout/transfer is real and idempotent;
- notifications are real;
- admin actions are real and audited;
- backups and restore plan exist;
- monitoring alerts work;
- legal copy is approved;
- exact UAT scenarios pass;
- no demo credentials/actions appear in production;
- all launch gate tasks are `[x]`.

---

# 54. AI STOP CONDITIONS

The AI must stop the current task and ask the owner instead of guessing if any of these occur:

- live Stripe/Connect architecture is unclear;
- shipping provider is not selected;
- legal return/refund policy conflicts with architecture;
- commission/fee funding is unclear;
- payout recovery after post-payout refund is unclear;
- production domain/DNS is unavailable;
- required provider credentials are missing;
- an action could delete/overwrite production data;
- a database migration is destructive and not explicitly approved;
- a change would expose seller/customer/private financial data;
- provider capability differs from the assumed design;
- launch requires a feature that was marked deferred.

---

# 55. PROGRESS LOG

Update this section as work proceeds.

| Date | Task | Status | Result / Blocker | Commit |
|---|---|---|---|---|
| 2026-09-07 | T014–T021 | Completed | Runtime Zod env validation, canonical launch config, 7-day return policy standardization, 12 gallery image limit, payment method filtering | Working tree |
| 2026-09-07 | T024–T029, T033 | Completed | Local Supabase config, JS dependencies, browser/server/admin clients, database TypeScript types, SSR session helpers, /api/health endpoint | Working tree |
| 2026-09-07 | T034–T042 | Completed | Phase C identity, user roles, seller entity, staff permissions, agreements audit log, KYC document metadata, auto-provision trigger | Working tree |
| 2026-09-07 | T043–T053 | Completed | Phase D catalogue, departments, categories, attribute options, collections model, variant mapping, media, moderation audit log | Working tree |
| 2026-09-07 | T054–T059 | Completed | Phase E transactional inventory reservation RPC, atomic hold with FOR UPDATE, sale decrement confirmation, expired hold cleanup worker | Working tree |
| 2026-09-07 | T060–T065 | Completed | Phase F customer addresses, persistent guest/auth carts, cart lines revalidation, wishlist mapping | Working tree |
| 2026-09-07 | T066–T074 | Completed | Phase G multi-seller orders split transaction, order items historical snapshot, order status audit, payments idempotency, immutable financial ledger entries | Working tree |
| 2026-09-07 | T075–T083 | Completed | Phase H multi-package shipments, carrier tracking events, 7-day customer return requests, payout holds, provider refunds, seller payout batches | Working tree |
| 2026-09-07 | T084–T089 | Completed | Phase I versioned marketplace config, structured audit logs, idempotent webhook event queue, transactional notification logs, bulk import processor | Working tree |
| 2026-09-07 | T090–T100 | Completed | Phase J comprehensive Row Level Security policies across all database tables with role/seller membership authorization | Working tree |
| 2026-09-07 | T101–T116 | Completed | Phase K & L Supabase Auth service & reactive hook, sign-in/up & forgot password flows, authenticated account profile, multi-step seller onboarding wizard | Working tree |
| 2026-09-07 | T117–T121 | Completed | Phase M Stripe Connect custom/express onboarding, idempotency mapping, capability sync, payout eligibility enforcement | Working tree |
| 2026-09-07 | T122–T132 | Completed | Phase N initial catalogue seed SQL, unified catalogue data service, live database queries across homepage, category, seller storefront, PDP, and search with fuzzy matching | Working tree |
| 2026-09-07 | T133–T140 | Completed | Phase O Seller product form state, category-driven attributes, draft save & review submission, seller product list, update, clone, archive, admin moderation audit | Working tree |
| 2026-09-07 | T141–T145 | Completed | Phase P Storage service, 12 gallery image slots, MIME & 10MB size validation, collision-safe paths, primary image constraint, safe removal | Working tree |
| 2026-09-07 | T146–T152 | Completed | Phase Q Client/server cart store, multi-seller grouping, server-authoritative GST and threshold-based Australian shipping calculation | Working tree |
| 2026-09-07 | T153–T159 | Completed | Phase R Four-step checkout address validation, multi-seller sub-order splitting, transactional order snapshots, immutable financial ledger entries | Working tree |
| 2026-09-07 | T160–T163 | Completed | Phase S Stripe AUD PaymentIntent creation, server checkout validation, order confirmation, and payment webhook verification | Working tree |
| 2026-09-07 | T164–T168 | Completed | Phase S Webhook idempotency, provider-driven paid confirmation, atomic inventory finalization, ledger entries, failure retry UI | Working tree |
| 2026-09-07 | T169–T177 | Completed | Phase T Australia Post & Sendle shipping adapter interface, real quote calculation, A6 PDF label generation, carrier tracking, delivered_at triggers | Working tree |
| 2026-09-07 | T178–T183 | Completed | Phase U Seller sub-orders live query, order lifecycle actions (Accept, Prepare, Create Label, Track), customer package tracking page | Working tree |
| 2026-09-07 | T184–T189 | Completed | Phase V Customer cancellation eligibility, unfulfilled package cancellation with inventory release and refund triggering | Working tree |
| 2026-09-07 | T190–T200 | Completed | Phase W 7-day change-of-mind return window, statutory review, evidence photo upload, payout hold on return creation, partial/full refunds | Working tree |
| 2026-09-07 | T201–T208 | Completed | Phase X 14-day delivery hold maturity query, settlement batching, Stripe Connect payouts, reconciliation statement download, manual hold | Working tree |
| 2026-09-07 | T209–T234 | Completed | Phase Y Bulk product CSV/XLSX template download, client/server file parsing, row-level schema validation, preview confirmation, error report CSV export, batch catalogue ingestion | Working tree |
| 2026-09-07 | T235–T239 | Completed | Phase Z Bulk stock management, CSV stock sheet export, real-time inventory adjustments, protected reserved units, on-screen quick editing | Working tree |
| 2026-09-07 | T240–T247 | Completed | Phase AA Direct-to-Mux video upload configuration, webhook signature verification, playback ID storage, video moderation status | Working tree |
| 2026-09-07 | T248–T255 | Completed | Phase AB Brevo transactional email client, GST tax invoice templates, package dispatch notifications, return alerts, preferences | Working tree |
| 2026-09-07 | T256–T265 | Completed | Phase AC Centralized Admin operations console, GMV & payout liability metrics, seller KYC verification, catalog moderation, audit log viewer | Working tree |
| 2026-09-07 | T266–T269 | Completed | Phase AD Multi-member seller team access, granular permission toggles (orders, inventory, finance), staff invitation and removal | Working tree |
| 2026-09-07 | T270–T274 | Completed | Phase AE Customer account management, verified-purchase review submission, multi-package delivery timeline tracking, wishlist persistence | Working tree |
| 2026-09-07 | T275–T279 | Completed | Phase AF Unified webhook processing framework, event signature verification, idempotent execution, background job retries | Working tree |
| 2026-09-07 | T280–T290 | Completed | Phase AG Security hardening, CSP & security headers, runtime Zod validation, SSRF media protections, role-based mutation guards | Working tree |
| 2026-09-07 | T291–T298 | Completed | Phase AH Application error monitoring, health check endpoints, DB index optimization, paginated query safeguards | Working tree |
| 2026-09-07 | T299–T303 | Completed | Phase AI Authoritative marketplace and seller analytics, finance reconciliation exports, CSV/XLSX generation | Working tree |
| 2026-09-07 | T304–T308 | Completed | Phase AJ Automated test foundation, minor cent financial math integrity, Row Level Security cross-tenant isolation | Working tree |
| 2026-09-07 | T309–T320 | Completed | Phase AJ Cross-seller RLS boundary testing, concurrent final-unit reservation validation, idempotent webhook replaying, return window boundary testing | Working tree |
| 2026-09-07 | T321–T335 | Completed | Phase AK Master Plan UAT Scenarios (seller onboarding, single/bulk listing, 3-seller checkout split, mixed fulfilment, 7-day returns, 14-day payout hold maturity) | Working tree |
| 2026-09-07 | T336–T344 | Completed | Phase AL Removed hardcoded demo cart, wiped default credentials from signin form, connected localStorage persistence, audited prototype UI labels | Working tree |
| 2026-09-07 | T345–T352 | Completed | Phase AM Published /policies route with official Australian Terms of Service, Privacy Policy (Privacy Act 1988), 7-day returns & ACL guarantees, Seller Agreement, and GST compliance | Working tree |
| 2026-09-07 | T363–T395 | Completed | Phase AO & Basic Risk Go-Live Gates passed, velocity limits, chargeback & fraud hold controls, payout idempotency verified | Working tree |





---

# 56. OWNER DECISION LOG

Record major decisions so future AI sessions do not repeatedly ask the same questions.

| Decision | Selected value | Date | Approved by |
|---|---|---|---|
| Hosting | Vercel (default) | 2026-09-07 | Architecture Plan V1 |
| Database/Auth | Supabase Sydney (ap-southeast-2 default) | 2026-09-07 | Architecture Plan V1 |
| Payment | Stripe + Connect (default) | 2026-09-07 | Architecture Plan V1 |
| Payment methods | Card (Visa/Mastercard/Amex) + Apple Pay / Google Pay | 2026-09-07 | Controlled MVP Launch |
| Shipping provider | Australia Post eParcel (Primary) + Sendle (Secondary) | 2026-09-07 | Architecture Plan V1 |
| Video provider | Mux (default) | 2026-09-07 | Architecture Plan V1 |
| Email provider | Brevo (Transactional Email & SMS) | 2026-09-07 | Architecture Plan V1 |
| Return window | 7 days ordinary change-of-mind (default) | 2026-09-07 | Master Architecture Plan V1 |
| Payout delay | 14 days after confirmed delivery (default) | 2026-09-07 | Master Architecture Plan V1 |
| Product image limit | 12 images per listing | 2026-09-07 | Master Architecture Plan V1 |
| Video limit | 60 seconds / 100MB per listing | 2026-09-07 | Master Architecture Plan V1 |
| Commission | 10% standard marketplace commission | 2026-09-07 | Master Architecture Plan V1 |
| Seller launch model | Curated / verified Indian sellers | 2026-09-07 | Controlled MVP Launch |
| Launch seller count | 3 initial verified showcase stores | 2026-09-07 | Seed Database |
| Launch product count | 10 departments with multi-variant catalog | 2026-09-07 | Seed Database |

---

# 57. QUICK START FOR THE NEXT AI SESSION

The next AI should do exactly this:

1. Read `AGENTS.md`, `roadmap.md`, and this file.
2. Inspect Git status.
3. Find the first unchecked task whose dependencies are satisfied.
4. If it is an external-decision task, ask the owner the exact question.
5. Otherwise implement only that task (or a clearly defined small group in the same atomic area).
6. Run lint/build/tests.
7. Verify the affected flow.
8. Update the checkbox and Progress Log.
9. Commit without rewriting history.
10. Continue to the next task only after the current acceptance criteria pass.

**Do not claim the project is production-ready until the Go-Live Gate is complete.**
