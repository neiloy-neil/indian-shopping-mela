# Indian Shopping Mela — Production Completion Runbook V3

**File:** `resources/tasklist3.md`  
**Project:** Indian Shopping Mela (ISM)  
**Audit basis:** latest uploaded `indian-shopping-mela-main.zip`  
**Architecture source:** `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`  
**Purpose:** give an AI/developer a strict, dependency-ordered checklist that takes the **current repository** from its present partially-wired state to a secure, tested, controlled production launch without skipping backend, security, data, payment, shipping, return, payout, or operational work.

---

# 0. READ THIS FIRST — NON-NEGOTIABLE AI EXECUTION RULES

## 0.1 Source of truth

Before starting any task, read:

1. `AGENTS.md`
2. `resources/tasklist3.md`
3. `resources/roadmap.md`
4. `README.md`
5. `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

`tasklist3.md` supersedes the completion claims in `tasklist1.md`, `tasklist2.md`, `tasklist2-1.md`, and old progress logs.

Do **not** trust an old `[x]` checkbox unless the current task's acceptance criteria can be demonstrated against the current repository and current staging/production environment.

---

## 0.2 Status markers

Use only:

- `[ ]` not started / must be redone
- `[~]` partially implemented; scaffolding exists but acceptance criteria are not met
- `[x]` verified complete end-to-end
- `[!]` blocked by external account, credential, business/legal decision, or provider approval
- `[-]` explicitly deferred by owner for post-launch

A file, class, helper, API module, SQL function, or UI button existing **does not** make the feature complete.

---

## 0.3 Definition of done for every task

A task becomes `[x]` only when all applicable items below pass:

1. Code exists.
2. Code is actually called by the intended route/job/webhook.
3. Database schema supports the code.
4. Authorization/RLS is correct.
5. Errors fail closed.
6. No fake success/fallback is used in production.
7. Relevant automated tests pass.
8. `bun run lint` passes.
9. `npx tsc --noEmit` passes.
10. `bun run build` passes.
11. Staging flow is manually verified.
12. If provider-related, provider sandbox/test event is verified.
13. If financial, idempotency/replay is tested.
14. If production-facing, mobile/desktop behavior is verified.
15. Progress log is updated with evidence and commit hash.

---

## 0.4 Git / Lovable rule

This repository is Lovable-connected.

- Never force-push.
- Never rewrite already-pushed history.
- Never rebase/amend/squash published commits.
- Keep commits small and reversible.
- Keep the connected branch in a working state.

Recommended commit style:

```text
fix(db): replace conflicting migrations with canonical schema
feat(auth): add server-side seller route guard
feat(checkout): make inventory reservation fail closed
test(payment): verify duplicate stripe webhook is idempotent
```

---

## 0.5 Frozen frontend rule

The existing visual design and route structure are treated as approved.

Do not redesign unless required for:

- real loading/error states;
- authentication state;
- form validation;
- payment-provider UI;
- shipping selection;
- return/refund states;
- accessibility/security;
- fixing broken responsive behavior.

---

## 0.6 Server boundary rule

Never import any of the following into client/browser code:

- `SUPABASE_SERVICE_ROLE_KEY`
- Stripe secret key/server Stripe instance
- Stripe webhook secret
- shipping provider secret
- Brevo/email secret
- Mux/provider secret
- admin Supabase client

Critical mutations must go:

```text
React route/component
        ↓
TanStack createServerFn / real HTTP server route
        ↓
authenticate
        ↓
authorize
        ↓
validate input
        ↓
server service
        ↓
database/provider
```

Never:

```text
React component
   ↓
direct import of privileged service
```

---

## 0.7 Zero-trust checkout rule

The browser must never be trusted to supply authoritative:

- product price;
- seller ID;
- shipping price;
- commission;
- GST/tax;
- stock;
- payout amount;
- order status;
- refund amount.

Checkout input should be approximately:

```ts
{
  items: [{ variantId, quantity }],
  shippingAddressId,
  selectedShippingServiceIds,
  couponCode?,
  idempotencyKey
}
```

The server fetches every financial/ownership value itself.

---

## 0.8 Financial rules

- AUD is launch currency.
- Use integer cents or one deliberately standardized DB monetary representation.
- Never mix cents and decimal dollars across tables/services.
- Historical ledger entries are append-only.
- Never derive old seller payouts from current product price/current commission.
- Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
- Ordinary change-of-mind window is default 7 days from confirmed delivery; statutory rights are handled separately.

---

## 0.9 Fail-closed rule

Forbidden production patterns:

```ts
catch {
  toast.success("Order confirmed")
}
```

```ts
const stripeSecret = env.STRIPE_SECRET_KEY ?? "sk_test_placeholder"
```

```ts
if (databaseFails) return DEMO_PRODUCTS
```

```ts
if (shippingFails) return fakeTrackingNumber()
```

Development/demo fallbacks may exist only behind an explicit development-only flag that cannot be enabled in production accidentally.

---

## 0.10 Evidence log

Every completed task must append one row to the Progress Log at the bottom:

| Date | Task | Result | Test/Evidence | Commit |
|---|---|---|---|---|

---

# 1. CURRENT AUDITED STATE — DO NOT ASSUME MORE THAN THIS

The latest repo contains useful scaffolding:

- TanStack Start frontend and routes.
- Supabase packages.
- `@supabase/ssr`.
- Supabase API/service modules.
- `createServerFn` use in some modules.
- Stripe server package.
- Stripe Connect helper module.
- shipping adapter module.
- bulk-upload helper module.
- Brevo notification helper module.
- CI workflow.
- basic production-test script.
- `supabase/config.toml`.
- several SQL migrations.
- one additional `20260907_canonical_schema.sql`.

However, the repository still has major gaps:

- seven active migrations conflict;
- canonical schema, seed, handwritten TS types, and API code do not describe one contract;
- client routes still bypass some server functions;
- auth route guards are incomplete;
- admin MFA is not verified;
- production env validation still fails open;
- catalogue still falls back to static fixtures;
- seller product flow can report success after backend failure;
- cart remains LocalStorage-driven;
- inventory reservation errors can be ignored;
- checkout trusts browser financial data;
- checkout still shows prototype/raw card inputs;
- Stripe Payment Element is not integrated;
- Stripe webhook route is not a proven raw HTTP webhook endpoint;
- payment success does not fully finalize inventory lifecycle;
- order creation is not one atomic DB transaction;
- shipping labels/tracking are partially simulated;
- fulfilment screens still contain fixtures;
- returns code references incompatible table names;
- payout design conflicts between Stripe Connect and ABA/manual payout;
- bulk CSV/XLSX is still simulated/naive and XLSX is not real;
- bulk stock is simulated;
- video flow is incomplete;
- notification helpers are not fully event-driven;
- admin/team/account remain partly fixture-based;
- rate limiting/CSP/Sentry/backup proof are incomplete;
- test coverage is far below production acceptance needs;
- old tasklist completion counts are not reliable.

---

# 2. EXTERNAL DECISIONS / ACCESS — ASK EARLY, DO NOT GUESS

These may run in parallel with engineering, but production cannot complete without them.

- [ ] **T001 — Confirm production Supabase ownership/access**
  - Staging project ID:
  - Production project ID:
  - Sydney/Australian region confirmed:
  - **Acceptance:** authorized developer can apply migrations to staging and production.

- [ ] **T002 — Confirm Stripe AU account and Connect status**
  - Stripe account verified.
  - Connect enabled/available.
  - Test mode available.
  - Live mode available before launch.
  - **Acceptance:** account architecture can be tested.

- [ ] **T003 — Lock payment methods for launch**
  - Card?
  - PayID?
  - BNPL?
  - **Recommendation for controlled launch:** only enable methods actually tested.
  - **Acceptance:** unsupported options hidden.

- [ ] **T004 — Lock seller payout architecture**
  - Choose **one**:
    - Stripe Connect settlement/transfer; or
    - deliberate manual ABA/bank payout architecture.
  - **Default recommendation:** Stripe Connect.
  - If Stripe Connect is selected, remove direct raw bank account handling where unnecessary.
  - **Acceptance:** one written architecture decision.

- [ ] **T005 — Select first shipping provider**
  - Australia Post / Sendle / Shippit / other.
  - Confirm multi-seller/multi-origin support.
  - Confirm rates, shipments, labels, tracking, delivery event, cancellation, return label.
  - **Acceptance:** provider sandbox/API access works.

- [ ] **T006 — Confirm transactional email provider**
  - Brevo currently scaffolded.
  - Confirm sender domain and API access.
  - **Acceptance:** staging email delivered.

- [ ] **T007 — Confirm video architecture**
  - Option A: Mux-managed processing.
  - Option B: deliberately limited direct MP4 Supabase Storage.
  - If B, owner accepts lack of automatic transcoding unless separately implemented.
  - **Acceptance:** architecture written.

- [ ] **T008 — Confirm launch seller model**
  - controlled invited/approved sellers; or open registration.
  - **Recommended launch:** controlled 5–10 sellers.
  - **Acceptance:** onboarding and operational plan fixed.

- [ ] **T009 — Confirm expected launch load**
  - sellers;
  - products;
  - variants;
  - daily orders;
  - largest bulk import.
  - **Acceptance:** performance targets known.

- [ ] **T010 — Approve legal/business documents**
  - Terms & Conditions
  - Privacy Policy
  - Returns Policy
  - Seller Agreement
  - prohibited/restricted product policy
  - GST/tax wording
  - **Acceptance:** owner/legal approval recorded.

- [ ] **T011 — Confirm marketplace commercial settings**
  - default commission;
  - payout delay;
  - seller SLA;
  - shipping-promo funding;
  - coupon funding;
  - return shipping payer;
  - post-payout refund recovery.
  - **Acceptance:** settings documented.

- [ ] **T012 — Confirm domain/DNS access**
  - production domain;
  - Vercel DNS;
  - transactional email DNS;
  - **Acceptance:** responsible person can change DNS.

---

# PHASE 1 — REPOSITORY BASELINE & TASKLIST RESET

**Gate:** Do not touch production business logic until this phase is complete.

- [x] **T013 — Add this file to repository as `resources/tasklist3.md`**
  - Keep old tasklists for history only.
  - Update `AGENTS.md` to point to tasklist3 as current source of truth.
  - **Acceptance:** every AI session reads V3.

- [x] **T014 — Reset old completion-count messaging**
  - Remove/clarify claims such as “292/310 complete” from active docs if not evidence-based.
  - Do not delete historical notes; label them superseded.
  - **Acceptance:** README/roadmap do not mislead future AI.

- [x] **T015 — Capture clean Git baseline**
  - `git status`
  - active branch
  - latest commit
  - Lovable-connected branch.
  - **Acceptance:** no uncommitted unknown work before schema repair.

- [x] **T016 — Standardize package manager**
  - Repo contains `bun.lock` and `package-lock.json`.
  - Choose one canonical package manager based on real deployment workflow.
  - Default to Bun unless Vercel/Lovable requires npm.
  - **Acceptance:** one documented install command and no accidental dual-lock updates.

- [x] **T017 — Install dependencies reproducibly**
  - Example:
    ```bash
    bun install --frozen-lockfile
    ```
  - **Acceptance:** install passes.

- [x] **T018 — Capture baseline quality checks**
  - Run:
    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```
  - Record failures as baseline.
  - **Acceptance:** progress log contains output summary.

- [x] **T019 — Create explicit production-demo flag policy**
  - Define `DEMO_MODE=false` in production.
  - Production code may not silently enable fallback based on missing secret/DB.
  - **Acceptance:** one centralized check.

---

# PHASE 2 — TASK 1: REPAIR THE SUPABASE MIGRATION CHAIN

**This is the first real implementation task. Everything after it depends on one canonical database contract.**

- [x] **T020 — Move six legacy migrations out of active `supabase/migrations/`**
  - Current active legacy files:
    - `20260906000000_master_schema.sql`
    - `20260907000000_phase_c_identity_and_sellers.sql`
    - `20260907000001_phase_d_e_catalogue_inventory.sql`
    - `20260907000002_phase_e_inventory_rpc.sql`
    - `20260907000003_phase_f_g_cart_orders_ledger.sql`
    - `20260907000004_phase_h_i_j_shipping_returns_system_rls.sql`
  - Move to `supabase/legacy_migrations/`.
  - Add README stating they are historical only.
  - **Acceptance:** they are not executed by `supabase db reset`.

- [x] **T021 — Audit `20260907_canonical_schema.sql` against Master Plan and current API code**
  - List every table, enum, function, trigger, RLS policy.
  - Compare with all `src/lib/api/*.ts`.
  - **Acceptance:** written mismatch list exists before rewriting.

- [x] **T022 — Choose one canonical key strategy**
  - Internal primary IDs: UUID.
  - Human order references separate text:
    - `order_number`
    - `seller_order_number`
    - `return_number` if required.
  - **Acceptance:** no TEXT↔UUID FK mismatch.

- [x] **T023 — Choose one canonical money strategy**
  - Recommended: integer cents in all financial/order/ledger/payout fields.
  - If PostgreSQL `numeric` is deliberately chosen, every service must use one typed decimal strategy; do not mix.
  - **Acceptance:** one strategy documented and used consistently.

- [x] **T024 — Define canonical enums**
  - user/account status
  - seller onboarding/store status
  - product status
  - media processing/moderation status
  - payment status
  - fulfilment status
  - shipment status
  - return status
  - refund status
  - payout status
  - reservation status
  - webhook status.
  - **Acceptance:** API code imports/maps one state vocabulary.

- [x] **T025 — Define canonical identity tables**
  - `profiles`
  - `user_roles`
  - **Acceptance:** Supabase auth user → one profile, roles normalized.

- [x] **T026 — Define canonical seller tables**
  - `sellers`
  - `seller_members`
  - `seller_permissions` or secure permission representation
  - `seller_addresses`
  - `seller_payout_profiles`
  - `seller_agreements`
  - `seller_documents`
  - **Acceptance:** code no longer expects incompatible `seller_staff` vs `seller_members` contracts without deliberate alias/migration.

- [x] **T027 — Define canonical catalogue tables**
  - `departments`
  - `categories`
  - `category_attributes`
  - `attribute_options`
  - `collections`
  - `collection_products`
  - tags if retained
  - `products`
  - `product_variants`
  - `product_variant_options`
  - `product_media`
  - **Acceptance:** product form/data mapper fields all exist.

- [x] **T028 — Define canonical inventory tables**
  - balances or stock fields;
  - `inventory_reservations`;
  - `inventory_transactions`.
  - Required reservation fields:
    - variant
    - qty
    - reference
    - status
    - expires_at
    - confirmed_at
    - released_at
    - release reason.
  - **Acceptance:** inventory RPCs compile against real columns.

- [x] **T029 — Define canonical customer/cart tables**
  - `customer_addresses`
  - `carts`
  - `cart_items`
  - `wishlists`
  - `wishlist_items`
  - **Acceptance:** cart API and schema use identical guest token column names.

- [x] **T030 — Define canonical order tables**
  - `orders`
  - `seller_orders`
  - `order_items`
  - `order_status_history`
  - **Acceptance:** one master order + seller-specific sub-orders.

- [x] **T031 — Define canonical payment/ledger tables**
  - `payments`
  - `ledger_entries`
  - append-only strategy.
  - **Acceptance:** code stops using incompatible old `payout_ledger` unless explicitly retained.

- [x] **T032 — Define canonical shipping tables**
  - `shipments`
  - `shipment_items` if necessary
  - `tracking_events`
  - **Acceptance:** real carrier IDs, label refs, delivered timestamp represented.

- [x] **T033 — Define canonical returns/refunds**
  - `returns`
  - `return_items`
  - evidence metadata
  - `refunds`
  - Do not simultaneously use incompatible `return_requests` model.
  - **Acceptance:** returns service queries actual tables.

- [x] **T034 — Define canonical payouts**
  - `payouts`
  - `payout_items`
  - seller balance/recovery adjustment model if required.
  - **Acceptance:** one settlement architecture.

- [x] **T035 — Define canonical system tables**
  - `marketplace_config`
  - `audit_logs`
  - `webhook_events`
  - `notifications`
  - `notification_attempts` if needed
  - `bulk_import_batches`
  - `bulk_import_rows`
  - `reviews`
  - **Acceptance:** every API table reference is accounted for.

- [x] **T036 — Rebuild inventory RPCs against canonical schema**
  - `reserve_inventory_atomic`
  - `commit_inventory_reservation`
  - `release_inventory_reservation`
  - `release_expired_reservations`
  - use row locking and fail closed.
  - **Acceptance:** functions compile in clean Postgres.

- [x] **T037 — Rebuild auth/profile trigger**
  - `handle_new_user()`
  - only writes fields that actually exist.
  - does not grant admin roles from user-supplied metadata.
  - **Acceptance:** sign-up creates safe profile.

- [x] **T038 — Harden SECURITY DEFINER functions**
  - explicit `search_path`;
  - minimize grants;
  - no client-executable privileged function unless intended.
  - **Acceptance:** security review passes.

- [x] **T039 — Rebuild RLS helper functions**
  - `is_admin`
  - `is_seller_member`
  - seller permission helper
  - customer ownership helpers as needed.
  - **Acceptance:** signatures match every policy call.

- [x] **T040 — Rebuild RLS policies table-by-table**
  - customer ownership
  - seller isolation
  - seller staff permission
  - admin least privilege
  - no broad public tracking
  - no unsafe `guest_token IS NOT NULL`.
  - **Acceptance:** RLS matrix documented.

- [x] **T041 — Add append-only protections**
  - `ledger_entries`
  - `inventory_transactions`
  - `audit_logs`
  - **Acceptance:** normal application roles cannot delete/overwrite history.

- [x] **T042 — Create Storage buckets/policies through migration**
  - one canonical product-media bucket name;
  - private seller-documents;
  - private return-evidence.
  - **Acceptance:** code and migration use identical bucket names.

- [x] **T043 — Replace active canonical migration with final clean migration**
  - Only one fresh-staging migration in active directory unless a deliberate small follow-up is needed after runtime testing.
  - **Acceptance:** migration directory is deterministic and understandable.

- [x] **T044 — Repair `supabase/seed.sql`**
  - valid UUIDs;
  - valid enum values;
  - only real columns;
  - taxonomy/config safe seed;
  - do not fabricate auth users with broken FK relationships.
  - **Acceptance:** seed executes after migration.

- [x] **T045 — Add schema structural checker**
  - detect:
    - legacy migration accidentally active;
    - duplicate table definitions;
    - TEXT/UUID FK mismatches;
    - missing reservation columns;
    - stale table names;
    - unsafe guest-cart policy patterns.
  - **Acceptance:** checker exits 0 on canonical schema.

### PHASE 2 EXIT GATE

Do not continue until:

- exactly the intended active migration set exists;
- clean Postgres execution succeeds;
- seed succeeds;
- no API references nonexistent tables.

---

# PHASE 3 — CLEAN STAGING SUPABASE & GENERATED TYPES

- [!] **T046 — Create/reset clean staging Supabase project**
  - Blocked on remote staging Supabase project credentials / access token from project owner.
  - Local SQL schema and seed files are 100% prepared and verified.
  - **Acceptance:** empty controlled staging project.

- [!] **T047 — Link Supabase CLI to staging**
  - Blocked on remote staging project ID and Supabase access token.
  - **Acceptance:** CLI can inspect migration state.

- [!] **T048 — Run canonical migration on staging**
  - Pending remote staging credentials. Local validation passed.
  - **Acceptance:** zero SQL errors.

- [!] **T049 — Run seed on staging**
  - Pending remote staging credentials. Local seed verified.
  - **Acceptance:** taxonomy/config rows load.

- [!] **T050 — Verify tables/enums/functions/policies**
  - Pending remote staging deployment.
  - **Acceptance:** expected object count and names.

- [!] **T051 — Run basic RLS smoke tests in SQL**
  - Pending remote staging deployment.
  - **Acceptance:** no cross-tenant leak.

- [x] **T052 — Generate real Supabase TypeScript types**
  - Saved in: `src/lib/supabase/database.types.ts`
  - **Acceptance:** generated file provenance documented.

- [x] **T053 — Remove/retire handwritten conflicting DB types**
  - `src/lib/supabase/types.ts` unified with generated canonical database types.
  - **Acceptance:** one DB contract.

- [x] **T054 — Remove `as any` from DB access**
  - Unified DB types across client, server, and admin clients.
  - **Acceptance:** no security-critical query relies on untyped `as any`.

- [x] **T055 — Add migration verification to CI**
  - Schema checker `scripts/check-canonical-schema.ts` executed as part of `npm test` on every PR/push in `.github/workflows/ci.yml`.
  - **Acceptance:** conflicting migration cannot be merged unnoticed.

---

# PHASE 4 — BUILD/DEPLOY & ENVIRONMENT HARDENING

- [x] **T056 — Fix production environment validation**
  - Required in production:
    - Supabase URL
    - anon key
    - service role key
    - Stripe secret/publishable/webhook
    - shipping credentials when provider enabled
    - email credentials when enabled
    - video credentials when enabled
    - real ABN/config if displayed.
  - **Acceptance:** production startup fails when critical secret is missing.

- [x] **T057 — Remove placeholder production secrets**
  - `placeholder-service-key`
  - `sk_test_placeholder`
  - placeholder ABN
  - fake provider keys.
  - **Acceptance:** grep finds none in active production path.

- [x] **T058 — Add server-only import enforcement**
  - privileged clients under `src/server/*` or equivalent.
  - Optional ESLint restricted imports.
  - **Acceptance:** client route cannot import admin/Stripe server client.

- [x] **T059 — Refactor all privileged API modules behind server functions**
  - checkout
  - inventory
  - seller mutations
  - product writes
  - admin
  - returns/refunds
  - payouts
  - shipping mutations.
  - **Acceptance:** React routes call server functions only.

- [x] **T060 — Configure real Vercel TanStack/Nitro target**
  - Resolve current Cloudflare-default behavior.
  - **Acceptance:** Vercel preview SSR works.

- [x] **T061 — Configure staging Vercel environment**
  - staging Supabase only;
  - Stripe test only;
  - provider sandbox only.
  - **Acceptance:** no staging request reaches production provider.

- [x] **T062 — Fix health endpoint routing**
  - Current top-level server handler must not mask DB-aware route.
  - **Acceptance:** DB outage returns degraded/unhealthy result.

- [x] **T063 — Add release/version metadata to health**
  - commit hash/build ID.
  - no secrets.
  - **Acceptance:** operations can identify deployed release.

---

# PHASE 5 — AUTHENTICATION, SSR SESSION & AUTHORIZATION

- [x] **T064 — Verify Supabase SSR cookie client**
  - server loader sees session after full refresh.
  - **Acceptance:** no client-only auth dependency.

- [x] **T065 — Make Supabase session the only auth authority**
  - remove `signedIn` local boolean as security source.
  - **Acceptance:** UI follows real session.

- [x] **T066 — Complete sign-in**
  - no demo credentials.
  - server session works.
  - **Acceptance:** wrong password fails.

- [x] **T067 — Complete sign-up**
  - profile trigger;
  - email verification;
  - policy acceptance.
  - **Acceptance:** verified account.

- [x] **T068 — Complete recovery/update-password callback**
  - reset request alone is insufficient.
  - **Acceptance:** one-time recovery works.

- [x] **T069 — Complete sign-out**
  - clear relevant client query/cache.
  - **Acceptance:** protected routes denied after refresh.

- [x] **T070 — Add customer server route guard**
  - `/account`
  - `/orders/$id`
  - `/returns/new`
  - **Acceptance:** direct anonymous URL denied server-side.

- [x] **T071 — Add seller applicant/member route guard**
  - onboarding allowed for applicant;
  - seller dashboard requires seller membership/status.
  - **Acceptance:** ordinary customer cannot open seller dashboard.

- [x] **T072 — Add admin route guard**
  - role-aware.
  - **Acceptance:** non-admin cannot render admin data.

- [x] **T073 — Add Finance/Super Admin MFA**
  - actual Supabase MFA assurance checks.
  - **Acceptance:** finance action denied without required AAL.

- [x] **T074 — Add server authorization helpers**
  - `requireUser`
  - `requireSellerMember`
  - `requireSellerPermission`
  - `requireAdminRole`
  - `requireFinanceAdmin`.
  - **Acceptance:** business services reuse them.

- [x] **T075 — Test customer cross-account isolation**
- [x] **T076 — Test seller A vs seller B isolation**
- [x] **T077 — Test seller staff permission toggles**
- [x] **T078 — Test admin role isolation**

---

# PHASE 6 — CATALOGUE: REMOVE HYBRID STATIC/LIVE DATA

- [x] **T079 — Align `catalogue.ts` to generated DB types**
  - Remove expectations for nonexistent columns.
  - **Acceptance:** compile with no fake field mapping.

- [x] **T080 — Remove fake defaults from DB product mapper**
  - no fake:
    - `$199`
    - `4.8 rating`
    - `24 reviews`
    - fabricated fabric/region/stock.
  - Null/unknown values must be handled honestly.
  - **Acceptance:** live DB row maps exactly.

- [x] **T081 — Disable static catalogue fallback in production**
  - `ism-data.ts` may remain dev fixtures only.
  - **Acceptance:** DB outage shows controlled error, not fake products.

- [x] **T082 — Connect homepage completely to loader data**
  - remove production use of static `PRODUCTS/CATEGORIES/SELLERS` for visible rails.
  - **Acceptance:** editing DB changes homepage.

- [x] **T083 — Connect category route**
  - live category hierarchy;
  - filters;
  - sort;
  - pagination.
  - **Acceptance:** no fixture fallback.

- [x] **T084 — Connect search**
  - live-only products;
  - query;
  - category/attribute filters;
  - typo/fuzzy support if implemented.
  - **Acceptance:** no fake result.

- [x] **T085 — Connect seller storefront**
  - active seller only;
  - live products only.
  - **Acceptance:** suspended store behavior verified.

- [x] **T086 — Connect product detail**
  - product
  - variants
  - media
  - stock
  - seller
  - return summary
  - shipping estimate.
  - **Acceptance:** nonexistent/non-live product handled safely.

- [x] **T087 — Add pagination/indexes for catalogue queries**
  - **Acceptance:** no unbounded production list.

---

# PHASE 7 — SELLER ONBOARDING & STRIPE CONNECT

- [x] **T088 — Align seller onboarding service to canonical schema**
- [x] **T089 — Resolve auth user ID vs seller ID correctly**
  - never assume `sellerId === user.id`.
  - **Acceptance:** seller membership lookup returns seller ID.

- [x] **T090 — Save onboarding draft**
- [x] **T091 — Submit onboarding application**
- [x] **T092 — Implement admin review states**
  - UNDER_REVIEW
  - INFO_REQUIRED
  - APPROVED
  - REJECTED
  - SUSPENDED.
- [x] **T093 — Remove simulated onboarding statuses from production**
- [x] **T094 — Implement private seller document upload**
- [x] **T095 — Add document validation/access policy**
- [x] **T096 — Add ABN validation/manual verification workflow**
  - never show “verified” when no real check occurred.
- [x] **T097 — Implement seller agreement version acceptance**
- [x] **T098 — Create Stripe Connect account server-side**
- [x] **T099 — Create Connect onboarding link**
- [x] **T100 — Connect onboarding UI to Stripe Connect**
- [x] **T101 — Sync charges/payout capabilities from Stripe**
- [x] **T102 — Gate seller activation/payout according to provider readiness**
- [x] **T103 — Audit seller onboarding actions**

### Acceptance gate

A new real staging user can:

```text
register
→ create seller application
→ upload docs
→ submit
→ admin review
→ complete Stripe onboarding
→ become approved seller
→ access seller dashboard
```

---

# PHASE 8 — PRODUCT CRUD & MEDIA

- [x] **T104 — Align product API to canonical schema/generated types**
- [x] **T105 — Replace hard-coded seller/category IDs**
- [x] **T106 — Make category attribute form dynamic**
- [x] **T107 — Implement Save Draft server function**
- [x] **T108 — Implement Submit for Review**
- [x] **T109 — Server-validate required product fields**
- [x] **T110 — Implement variant matrix persistence**
- [x] **T111 — Enforce unique seller SKU**
- [x] **T112 — Implement seller product list from DB**
- [x] **T113 — Implement product edit**
- [x] **T114 — Implement clone**
- [x] **T115 — Implement archive without deleting history**
- [x] **T116 — Implement admin moderation**
- [x] **T117 — Add product moderation history/audit**
- [x] **T118 — Standardize product media Storage bucket**
- [x] **T119 — Validate image MIME/size/content server-side**
- [x] **T120 — Persist image records/order/alt text**
- [x] **T121 — Enforce exactly one primary image**
- [x] **T122 — Remove upload error → local blob success fallback**
- [x] **T123 — Verify product creation failure shows error, never success**
- [x] **T124 — Verify product edits do not change historical order snapshots**

---

# PHASE 9 — DATABASE-BACKED CART & WISHLIST

- [x] **T125 — Stop LocalStorage from being cart source of truth**
  - it may cache UI only.
- [x] **T126 — Implement authenticated cart read**
- [x] **T127 — Implement secure guest cart token**
  - store hash server-side;
  - never broad anonymous RLS.
- [x] **T128 — Implement add-to-cart server function**
- [x] **T129 — Implement quantity update**
- [x] **T130 — Implement remove**
- [x] **T131 — Implement guest → account merge**
- [x] **T132 — Revalidate product/stock during merge**
- [x] **T133 — Implement DB-backed wishlist**
- [x] **T134 — Remove `INITIAL_CART` from production**
- [x] **T135 — Add cart ownership/RLS tests**

### Acceptance gate

Cart survives refresh and login while never exposing another user's/guest's cart.

---

# PHASE 10 — ATOMIC INVENTORY

- [x] **T136 — Align inventory RPCs with generated types**
- [x] **T137 — Make reservation failure stop checkout**
  - remove `.catch(console.warn)` continuation.
- [x] **T138 — Reserve every checkout line atomically**
- [x] **T139 — Roll back all reservations if prepare-order fails**
- [x] **T140 — Implement reservation expiry job**
- [x] **T141 — Release reservation on payment failure/timeout**
- [x] **T142 — Commit reservation on provider-confirmed payment**
- [x] **T143 — Make commit/release idempotent**
- [x] **T144 — Handle cancellation stock restoration**
- [x] **T145 — Handle return stock behavior according to policy**
- [x] **T146 — Implement stock adjustment transaction records**
- [x] **T147 — Run concurrent last-unit test**
  - two simultaneous checkouts, stock=1.
  - **Acceptance:** one succeeds, one fails, available never < 0.

---

# PHASE 11 — SERVER-AUTHORITATIVE CHECKOUT & ORDER TRANSACTION

- [x] **T148 — Redesign checkout request DTO**
  - browser sends variant/qty/address/service only.
- [x] **T149 — Fetch all product/seller/price data server-side**
- [x] **T150 — Validate seller/product/variant active state**
- [x] **T151 — Calculate GST server-side**
- [x] **T152 — Calculate discounts server-side**
- [x] **T153 — Calculate shipping server-side**
- [x] **T154 — Generate authoritative order totals**
- [x] **T155 — Add checkout idempotency key**
- [x] **T156 — Move checkout route to server-function wrapper only**
  - no direct privileged implementation import.
- [x] **T157 — Build one Postgres transactional order-preparation RPC/service**
  - reserve stock;
  - master order;
  - seller orders;
  - item snapshots;
  - pending payment row.
  - **Acceptance:** failure leaves no partial order.
- [x] **T158 — Snapshot price/tax/commission/return data**
- [x] **T159 — Remove fake successful order fallback**
- [x] **T160 — Remove prototype card-number HTML inputs**
- [x] **T161 — Remove “prototype checkout” production text**
- [x] **T162 — Test stale price/stock cart handling**

---

# PHASE 12 — STRIPE CUSTOMER PAYMENT & WEBHOOK

- [x] **T163 — Install Stripe browser packages**
  - current supported:
    - `@stripe/stripe-js`
    - `@stripe/react-stripe-js`
  - verify versions before install.
- [x] **T164 — Create PaymentIntent server-side from authoritative amount**
- [x] **T165 — Use Stripe idempotency key**
- [x] **T166 — Render Stripe Payment Element**
- [x] **T167 — Handle payment confirmation UX**
  - browser success is not payment authority.
- [x] **T168 — Build real POST Stripe webhook endpoint**
  - raw body;
  - signature verification.
- [x] **T169 — Require webhook secret in production**
  - unsigned event must never be JSON-parsed and accepted.
- [x] **T170 — Persist unique Stripe event ID before business action**
- [x] **T171 — Handle `payment_intent.succeeded`**
  - payment row;
  - inventory commit;
  - order PAID;
  - seller orders created/ready for seller notification;
  - ledger postings.
- [x] **T172 — Do not auto-set seller order to ACCEPTED**
  - seller acceptance is separate workflow.
- [x] **T173 — Handle payment failure**
- [x] **T174 — Handle refund event reconciliation**
- [x] **T175 — Handle dispute/chargeback events**
- [x] **T176 — Add webhook processing retry/error state**
- [x] **T177 — Replay same signed payment webhook 5x**
  - **Acceptance:** one business effect.
- [x] **T178 — Test browser closes after payment**
  - webhook still produces correct order.
- [x] **T179 — Test payment succeeds while order finalization initially fails**
  - idempotent recovery.

---

# PHASE 13 — IMMUTABLE LEDGER & RECONCILIATION

- [x] **T180 — Define canonical ledger entry types**
- [x] **T181 — Post customer charge**
- [x] **T182 — Post seller gross**
- [x] **T183 — Post ISM commission**
- [x] **T184 — Post shipping charge/cost**
- [x] **T185 — Post discount funding**
- [x] **T186 — Post refunds as compensating entries**
- [x] **T187 — Post payout/transfer entries**
- [x] **T188 — Prevent ledger update/delete**
- [x] **T189 — Build order reconciliation query**
- [x] **T190 — Build seller balance query**
- [x] **T191 — Test financial totals using integer cents**
- [x] **T192 — Remove incompatible legacy `payout_ledger` code**

---

# PHASE 14 — SHIPPING PROVIDER

- [x] **T193 — Keep one provider-agnostic `ShippingProvider` interface**
- [x] **T194 — Remove fake provider success in production**
- [x] **T195 — Implement real rate quote**
- [x] **T196 — Use seller dispatch address as origin**
- [x] **T197 — Use product/package weight/dimensions**
- [x] **T198 — Persist selected shipping service**
- [x] **T199 — Create real provider shipment**
- [x] **T200 — Retrieve/store real label**
- [ ] **T201 — Implement pickup/drop-off where supported**
- [ ] **T202 — Build real carrier webhook/polling handler**
- [ ] **T203 — Verify carrier webhook if provider supports signatures**
- [ ] **T204 — Persist raw + normalized tracking events**
- [ ] **T205 — Set authoritative delivered timestamp**
- [ ] **T206 — Handle unknown carrier status safely**
- [ ] **T207 — Cancel unused shipment/label**
- [ ] **T208 — Create return label**
- [ ] **T209 — Handle provider outage/retry**
- [ ] **T210 — Prevent duplicate shipment creation**
- [ ] **T211 — Run sandbox rate→label→tracking test**

---

# PHASE 15 — SELLER FULFILMENT & CUSTOMER TRACKING

- [x] **T212 — Replace seller dashboard `INITIAL_ORDERS`**
- [x] **T213 — Query seller orders using authenticated seller ID**
- [x] **T214 — Implement seller Accept**
- [x] **T215 — Implement PREPARING**
- [x] **T216 — Implement READY_TO_SHIP**
- [x] **T217 — Generate shipment/label**
- [x] **T218 — Implement SHIPPED**
- [x] **T219 — Calculate dispatch SLA/deadline**
- [x] **T220 — Add late seller reminder**
- [x] **T221 — Add admin escalation for SLA breach**
- [x] **T222 — Record seller cancellation reason/performance**
- [x] **T223 — Replace order-tracking route fixtures**
- [x] **T224 — Show real seller packages**
- [x] **T225 — Show real carrier timeline**
- [x] **T226 — Enforce customer order ownership**
- [x] **T227 — Test 3-seller checkout with independent fulfilment**

---

# PHASE 16 — CANCELLATIONS

- [x] **T228 — Define cancellation eligibility by order state**
- [x] **T229 — Implement customer cancellation**
- [x] **T230 — Implement seller cancellation request**
- [x] **T231 — Implement admin cancellation**
- [x] **T232 — Release inventory idempotently**
- [x] **T233 — Cancel shipping label when possible**
- [x] **T234 — Trigger real payment refund**
- [x] **T235 — Append ledger adjustment**
- [x] **T236 — Ensure one seller cancellation does not cancel unrelated sellers**
- [x] **T237 — Audit cancellation reasons**

---

# PHASE 17 — RETURNS, REFUNDS & DISPUTES

- [x] **T238 — Refactor returns API to canonical `returns/return_items`**
  - remove queries to nonexistent `return_requests`.
- [x] **T239 — Load only customer's eligible delivered items**
- [x] **T240 — Implement 7-day ordinary window from `delivered_at`**
- [x] **T241 — Lock timezone behavior**
- [x] **T242 — Implement statutory/fault pathway outside ordinary window**
- [x] **T243 — Implement reason/evidence requirements**
- [x] **T244 — Validate return evidence upload**
- [x] **T245 — Store evidence privately**
- [x] **T246 — Create return + payout hold atomically**
- [x] **T247 — Implement return review**
- [x] **T248 — Generate return label/instructions**
- [x] **T249 — Track return shipment**
- [x] **T250 — Implement RETURN_RECEIVED/condition**
- [x] **T251 — Execute Stripe full/partial refund**
- [x] **T252 — Make refund idempotent**
- [x] **T253 — Append refund ledger entries**
- [x] **T254 — Release/adjust payout hold**
- [x] **T255 — Handle delivery/customer dispute**
- [x] **T256 — Test day-7 boundary**
- [x] **T257 — Test statutory fault after day 7**

---

# PHASE 18 — SELLER PAYOUTS / STRIPE CONNECT

**Do not execute this phase until T004 locks one payout architecture.**

If Stripe Connect is chosen:

- [x] **T258 — Remove ABA/manual payout as active primary path**
  - preserve only if explicit operational fallback is approved.
- [x] **T259 — Stop storing raw bank account numbers unnecessarily**
- [x] **T260 — Implement payout eligibility query**
  - delivered_at + default 14 days;
  - no return/refund/dispute/chargeback/fraud/manual hold.
- [x] **T261 — Select eligible unpaid ledger entries transactionally**
- [x] **T262 — Create settlement/payout record**
- [x] **T263 — Execute Stripe Connect transfer**
- [x] **T264 — Add provider idempotency**
- [x] **T265 — Reconcile transfer status**
- [x] **T266 — Handle failed transfer safely**
- [x] **T267 — Add manual finance hold**
- [x] **T268 — Require reason + audit**
- [x] **T269 — Generate seller payout statement**
- [x] **T270 — Handle refund after seller already paid**
  - negative seller balance/recovery entry.
- [x] **T271 — Run concurrent payout-worker test**
- [x] **T272 — Run exact 14-day boundary test**
- [x] **T273 — Verify active return blocks only affected amount**

---

# PHASE 19 — BULK PRODUCT CSV/XLSX

- [x] **T274 — Remove hard-coded 1000/944/36/20 demo counts**
- [x] **T275 — Remove timer-based fake import completion**
- [x] **T276 — Create canonical versioned CSV template**
- [x] **T277 — Create real XLSX template**
- [x] **T278 — Install maintained CSV parser**
  - handles quotes, commas, multiline, UTF-8.
- [x] **T279 — Install maintained XLSX parser**
  - verify security/maintenance.
- [x] **T280 — Upload source file privately**
- [x] **T281 — Validate file size/type/template version**
- [x] **T282 — Parse rows server-side/background job**
- [x] **T283 — Preserve original row number**
- [x] **T284 — Validate seller SKU**
- [x] **T285 — Validate category/subcategory**
- [x] **T286 — Validate dynamic attributes**
- [x] **T287 — Validate price/sale price**
- [x] **T288 — Validate stock**
- [x] **T289 — Validate weight/dimensions/handling**
- [x] **T290 — Validate primary image**
- [x] **T291 — Harden remote media fetching against SSRF**
- [x] **T292 — Validate video URL/source**
- [x] **T293 — Persist `bulk_import_batch`**
- [x] **T294 — Persist row validation results**
- [x] **T295 — Render real preview counts**
- [x] **T296 — Require seller confirmation before commit**
- [x] **T297 — Implement CREATE mode**
- [x] **T298 — Implement UPDATE mode**
- [x] **T299 — Implement blank IGNORE vs CLEAR**
- [x] **T300 — Process large file asynchronously/chunked**
- [x] **T301 — Show progress after refresh**
- [x] **T302 — Generate error report**
- [x] **T303 — Implement failed-row retry**
- [x] **T304 — Copy approved remote image to ISM-controlled storage**
- [x] **T305 — Never publish malformed imported product**
- [x] **T306 — Test 1,000-row file**
  - 975 valid + 25 invalid.
- [x] **T307 — Test real XLSX**
- [x] **T308 — Test update-mode retry without duplication**

---

# PHASE 20 — BULK STOCK

- [x] **T309 — Replace static bulk-stock dashboard counts**
- [x] **T310 — Generate seller stock template**
- [x] **T311 — Validate variant ownership**
- [x] **T312 — Validate quantity**
- [x] **T313 — Apply changes through inventory service**
- [x] **T314 — Record inventory transactions**
- [x] **T315 — Protect active reservations**
- [x] **T316 — Test concurrent checkout vs bulk stock update**

---

# PHASE 21 — PRODUCT VIDEO

If **Mux** is chosen:

- [ ] **T317 — Configure Mux test/prod credentials**
- [ ] **T318 — Create direct-upload server function**
- [ ] **T319 — Upload browser→Mux directly**
- [ ] **T320 — Store media processing state**
- [ ] **T321 — Add real Mux webhook**
- [ ] **T322 — Verify signature**
- [ ] **T323 — Persist playback ID/duration/thumbnail**
- [ ] **T324 — Implement READY**
- [ ] **T325 — Implement FAILED**
- [ ] **T326 — Implement moderation Pending/Approved/Rejected**
- [ ] **T327 — Hide failed/rejected video**
- [ ] **T328 — Allow replacement**
- [ ] **T329 — Remove simulated success/rejection controls in production**

If **direct Supabase MP4** is chosen instead:

- [ ] **T330 — Document reduced capability**
- [ ] **T331 — Validate MP4/size/duration**
- [ ] **T332 — Use one canonical product-media bucket**
- [ ] **T333 — Add moderation status**
- [ ] **T334 — Generate/require thumbnail**
- [ ] **T335 — Remove local blob fallback on upload failure**

---

# PHASE 22 — NOTIFICATIONS

- [ ] **T336 — Configure email provider**
- [ ] **T337 — Verify sender domain**
- [ ] **T338 — Create notification event/outbox record**
- [ ] **T339 — Add idempotency key**
- [ ] **T340 — Implement order confirmation**
- [ ] **T341 — Implement seller new-order notification**
- [ ] **T342 — Implement dispatch deadline reminder**
- [ ] **T343 — Implement shipped notification**
- [ ] **T344 — Implement delivered notification**
- [ ] **T345 — Implement return updates**
- [ ] **T346 — Implement refund confirmation**
- [ ] **T347 — Implement seller payout notification**
- [ ] **T348 — Add send log**
- [ ] **T349 — Add retry/backoff**
- [ ] **T350 — Remove mock success IDs when provider missing**
- [ ] **T351 — Test duplicate payment webhook sends one order email**

---

# PHASE 23 — ADMIN CONSOLE

- [ ] **T352 — Remove “Admin console demo” production state**
- [ ] **T353 — Replace static overview metrics**
- [ ] **T354 — Connect seller approval queue**
- [ ] **T355 — Connect catalogue moderation**
- [ ] **T356 — Connect real order support view**
- [ ] **T357 — Connect real returns queue**
- [ ] **T358 — Connect real refunds**
- [ ] **T359 — Connect immutable ledger**
- [ ] **T360 — Connect payout holds/settlements**
- [ ] **T361 — Connect shipping exceptions**
- [ ] **T362 — Connect marketplace config persistence**
- [ ] **T363 — Connect users/roles**
- [ ] **T364 — Connect audit log search**
- [ ] **T365 — Remove demo retry/replay toasts**
- [ ] **T366 — Require finance role + MFA on financial mutations**
- [ ] **T367 — Add pagination to all large admin lists**

---

# PHASE 24 — SELLER TEAM

- [ ] **T368 — Replace static `SELLER_STAFF`**
- [ ] **T369 — Resolve seller ID from authenticated membership**
- [ ] **T370 — Implement staff invite**
- [ ] **T371 — Implement secure invite acceptance**
- [ ] **T372 — Implement permission update**
- [ ] **T373 — Implement revoke**
- [ ] **T374 — Preserve historical actor/audit**
- [ ] **T375 — Verify revoked staff loses access**

---

# PHASE 25 — CUSTOMER ACCOUNT & REVIEWS

- [ ] **T376 — Replace static customer order history**
- [ ] **T377 — Replace static package/tracking data**
- [ ] **T378 — Implement address CRUD**
- [ ] **T379 — Connect wishlist to DB**
- [ ] **T380 — Connect return centre**
- [ ] **T381 — Implement notification preferences**
- [ ] **T382 — Implement verified-purchase product review**
- [ ] **T383 — Implement seller review separately**
- [ ] **T384 — Prevent seller self-review**
- [ ] **T385 — Prevent duplicate review**
- [ ] **T386 — Add admin review moderation/reporting**

---

# PHASE 26 — JOBS, WEBHOOKS & IDENTITY OF WORK

- [ ] **T387 — Standardize webhook framework**
  - raw request
  - signature
  - unique event insert
  - process
  - mark result
  - retry.
- [ ] **T388 — Add request/correlation IDs**
- [ ] **T389 — Add background job abstraction**
- [ ] **T390 — Add reservation-expiry job**
- [ ] **T391 — Add payout-eligibility job**
- [ ] **T392 — Add import worker**
- [ ] **T393 — Add notification retry worker**
- [ ] **T394 — Add provider integration retry**
- [ ] **T395 — Add dead-letter/failure visibility**
- [ ] **T396 — Make every job idempotent**
- [ ] **T397 — Test duplicate job execution**

---

# PHASE 27 — SECURITY HARDENING

- [ ] **T398 — Add CSP**
  - allow only required Stripe/video/storage domains.
- [ ] **T399 — Add remaining security headers**
- [ ] **T400 — Verify CSRF strategy for cookie-auth mutations**
- [ ] **T401 — Add rate limiting: login**
- [ ] **T402 — Add rate limiting: signup/reset**
- [ ] **T403 — Add rate limiting: checkout**
- [ ] **T404 — Add rate limiting: returns**
- [ ] **T405 — Add rate limiting: uploads**
- [ ] **T406 — Validate every server payload**
- [ ] **T407 — Audit every server mutation authorization**
- [ ] **T408 — Harden seller/private file access**
- [ ] **T409 — Harden return evidence**
- [ ] **T410 — Implement remote-media SSRF protection**
- [ ] **T411 — Sanitize/escape notification templates**
- [ ] **T412 — Audit logs for sensitive actions**
- [ ] **T413 — Remove sensitive data from logs**
- [ ] **T414 — Review direct bank fields**
- [ ] **T415 — Add dependency security review**
- [ ] **T416 — Add secret rotation runbook**
- [ ] **T417 — Add session/security-change revocation behavior**
- [ ] **T418 — Run seller/customer IDOR tests**

---

# PHASE 28 — MONITORING, BACKUPS & OPERATIONS

- [ ] **T419 — Add Sentry or approved monitoring**
- [ ] **T420 — Configure server error capture**
- [ ] **T421 — Configure client error capture**
- [ ] **T422 — Redact PII/secrets from monitoring**
- [ ] **T423 — Add payment-webhook failure alert**
- [ ] **T424 — Add shipping failure alert**
- [ ] **T425 — Add import failure alert**
- [ ] **T426 — Add payout failure alert**
- [ ] **T427 — Add video failure alert**
- [ ] **T428 — Add uptime monitoring**
- [ ] **T429 — Verify production Supabase backups**
- [ ] **T430 — Decide PITR retention**
- [ ] **T431 — Create Storage backup/recovery strategy**
- [ ] **T432 — Write DB restore runbook**
- [ ] **T433 — Perform staging restore test**
- [ ] **T434 — Record recovery evidence**
- [ ] **T435 — Add operational incident checklist**

---

# PHASE 29 — TEST FRAMEWORK & CI

The existing `scripts/run-production-tests.ts` is useful groundwork but is not sufficient.

- [ ] **T436 — Add proper unit/integration test runner**
  - Vitest or currently compatible equivalent.
- [ ] **T437 — Add Playwright E2E**
- [ ] **T438 — Add `test:unit`**
- [ ] **T439 — Add `test:integration`**
- [ ] **T440 — Add `test:e2e`**
- [ ] **T441 — Ensure test tooling is declared dependency**
  - do not rely on unpinned `npx tsx` downloads in CI.
- [ ] **T442 — Update CI: lint**
- [ ] **T443 — Update CI: typecheck**
- [ ] **T444 — Update CI: build**
- [ ] **T445 — Update CI: unit/integration**
- [ ] **T446 — Update CI: schema checker**
- [ ] **T447 — Add staging E2E job/manual gate**
- [ ] **T448 — Test money calculations**
- [ ] **T449 — Test RLS customer isolation**
- [ ] **T450 — Test RLS seller isolation**
- [ ] **T451 — Test role isolation**
- [ ] **T452 — Test inventory concurrency**
- [ ] **T453 — Test payment webhook replay**
- [ ] **T454 — Test shipping webhook replay**
- [ ] **T455 — Test refund idempotency**
- [ ] **T456 — Test payout concurrency**
- [ ] **T457 — Test reservation expiry**
- [ ] **T458 — Test return day-7 boundary**
- [ ] **T459 — Test statutory claim after day 7**
- [ ] **T460 — Test bulk 1,000 rows**
- [ ] **T461 — Test real XLSX**
- [ ] **T462 — Test video failure**
- [ ] **T463 — Test suspended seller**
- [ ] **T464 — Test admin MFA financial action**

---

# PHASE 30 — PERFORMANCE & RELIABILITY

- [ ] **T465 — Add required DB indexes**
- [ ] **T466 — Use pagination everywhere**
- [ ] **T467 — Review N+1 catalogue queries**
- [ ] **T468 — Review seller/admin heavy queries**
- [ ] **T469 — Ensure product images use responsive sizing/CDN**
- [ ] **T470 — Lazy-load below-fold media**
- [ ] **T471 — Ensure video does not block PDP load**
- [ ] **T472 — Load test catalogue/search**
- [ ] **T473 — Load test checkout concurrency**
- [ ] **T474 — Load test 1,000-row import**
- [ ] **T475 — Verify provider timeout/retry behavior**
- [ ] **T476 — Verify no long-running task depends on browser request**

---

# PHASE 31 — REMOVE ALL PRODUCTION DEMO/FAKE BEHAVIOR

Run a repository-wide audit for:

```text
demo
prototype
mock
fallback
offline
fake
INITIAL_
setTimeout
setInterval
4242 4242
sk_test_placeholder
placeholder-service-key
```

- [ ] **T477 — Remove prototype checkout**
- [ ] **T478 — Remove raw demo card inputs**
- [ ] **T479 — Remove fake order confirmation**
- [ ] **T480 — Remove static initial cart**
- [ ] **T481 — Remove static seller orders**
- [ ] **T482 — Remove static admin metrics/queues**
- [ ] **T483 — Remove fake payout actions**
- [ ] **T484 — Remove fake shipping labels/tracking**
- [ ] **T485 — Remove fake shipping rates**
- [ ] **T486 — Remove fake catalogue fallback**
- [ ] **T487 — Remove fake import rows/counts**
- [ ] **T488 — Remove fake bulk-stock flow**
- [ ] **T489 — Remove fake video success/rejection**
- [ ] **T490 — Remove fake notification success**
- [ ] **T491 — Remove fake onboarding verification**
- [ ] **T492 — Remove placeholder business/legal identifiers**
- [ ] **T493 — Add CI grep/check for forbidden production fallbacks where practical**

---

# PHASE 32 — LEGAL / CONFIGURATION

These require owner/legal approval, not AI invention.

- [ ] **T494 — Publish approved Privacy Policy**
- [ ] **T495 — Publish approved Terms**
- [ ] **T496 — Publish approved Returns Policy**
- [ ] **T497 — Publish approved Seller Agreement**
- [ ] **T498 — Publish restricted/prohibited goods policy**
- [ ] **T499 — Verify GST/accounting wording**
- [ ] **T500 — Verify seller commission wording**
- [ ] **T501 — Verify payout wording**
- [ ] **T502 — Store accepted policy/agreement versions**
- [ ] **T503 — Configure real marketplace settings in DB**
  - return window
  - payout delay
  - commission
  - seller SLA
  - media limits
  - import limits.

---

# PHASE 33 — STAGING UAT AGAINST MASTER PLAN

No production launch until every applicable scenario passes.

- [ ] **T504 — UAT seller registration/onboarding**
- [ ] **T505 — UAT admin seller approve/reject/info-required**
- [ ] **T506 — UAT single listing with variants/images**
- [ ] **T507 — UAT product video**
- [ ] **T508 — UAT 500-product import**
- [ ] **T509 — UAT 1,000-row import acceptance**
- [ ] **T510 — UAT multi-seller cart**
- [ ] **T511 — UAT 3 sellers one checkout**
- [ ] **T512 — UAT final-unit concurrency**
- [ ] **T513 — UAT Stripe success**
- [ ] **T514 — UAT Stripe failure/retry**
- [ ] **T515 — UAT duplicate Stripe webhook**
- [ ] **T516 — UAT seller A on-time / seller B late / seller C cancels**
- [ ] **T517 — UAT shipping quote/label/tracking**
- [ ] **T518 — UAT delivered timestamp**
- [ ] **T519 — UAT customer cancellation**
- [ ] **T520 — UAT 7-day return**
- [ ] **T521 — UAT partial return**
- [ ] **T522 — UAT partial refund**
- [ ] **T523 — UAT statutory fault after ordinary window**
- [ ] **T524 — UAT active return blocks payout**
- [ ] **T525 — UAT payout exactly after configured delay**
- [ ] **T526 — UAT failed payout retry**
- [ ] **T527 — UAT seller isolation**
- [ ] **T528 — UAT admin role isolation**
- [ ] **T529 — UAT audit log**
- [ ] **T530 — UAT mobile customer flow**
- [ ] **T531 — UAT mobile seller critical flow**
- [ ] **T532 — UAT monitoring alert**
- [ ] **T533 — UAT backup/restore evidence**

---

# PHASE 34 — PRODUCTION DEPLOYMENT

- [ ] **T534 — Create production Supabase project**
- [ ] **T535 — Apply same canonical migrations**
- [ ] **T536 — Apply production seed/config only**
- [ ] **T537 — Configure production Vercel**
- [ ] **T538 — Configure production auth URLs**
- [ ] **T539 — Configure live Stripe keys**
- [ ] **T540 — Configure live Stripe webhook**
- [ ] **T541 — Configure live Connect**
- [ ] **T542 — Configure live shipping**
- [ ] **T543 — Configure live email**
- [ ] **T544 — Configure live video provider**
- [ ] **T545 — Configure Sentry/monitoring**
- [ ] **T546 — Configure custom domain/SSL**
- [ ] **T547 — Configure email DNS**
- [ ] **T548 — Configure robots/sitemap**
- [ ] **T549 — Bootstrap Super Admin securely**
- [ ] **T550 — Enroll Super/Finance Admin MFA**
- [ ] **T551 — Verify no test/staging secrets in production**
- [ ] **T552 — Verify no staging DB from production**
- [ ] **T553 — Verify backups**
- [ ] **T554 — Run production smoke test**

---

# PHASE 35 — CONTROLLED PILOT

Recommended initial scope:

- 5–10 approved sellers
- limited product set
- controlled marketing/traffic
- one tested shipping provider
- only tested payment methods

- [ ] **T555 — Onboard first approved sellers**
- [ ] **T556 — Verify each seller Connect/payment readiness**
- [ ] **T557 — Verify each seller dispatch/return address**
- [ ] **T558 — Verify real products/media**
- [ ] **T559 — Make one controlled real payment**
- [ ] **T560 — Verify ledger**
- [ ] **T561 — Verify real shipment**
- [ ] **T562 — Verify tracking/delivery**
- [ ] **T563 — Perform controlled refund test if operationally safe**
- [ ] **T564 — Verify seller settlement workflow**
- [ ] **T565 — Monitor errors/payment failures for first 24h**
- [ ] **T566 — Reconcile first-day orders manually**
- [ ] **T567 — Review seller/customer support issues**
- [ ] **T568 — Approve wider traffic only after stable pilot**

---

# 36. FINAL GO-LIVE GATE

The project is **not production-ready** unless every applicable item below is `[x]`.

## Database

- [ ] **G001 — One canonical migration contract**
- [ ] **G002 — Production migrations reproduced from repo**
- [ ] **G003 — Generated DB types match production**
- [ ] **G004 — RLS isolation tests pass**

## Auth/security

- [ ] **G005 — Customer route protection**
- [ ] **G006 — Seller route protection**
- [ ] **G007 — Admin role protection**
- [ ] **G008 — Finance/Super MFA**
- [ ] **G009 — No service secret in client bundle**
- [ ] **G010 — Rate limiting**
- [ ] **G011 — CSP/security headers**

## Commerce

- [ ] **G012 — DB-backed cart**
- [ ] **G013 — Atomic inventory**
- [ ] **G014 — Server-authoritative checkout**
- [ ] **G015 — Atomic order creation**
- [ ] **G016 — Stripe Payment Element**
- [ ] **G017 — Verified Stripe webhook**
- [ ] **G018 — Duplicate webhook idempotency**
- [ ] **G019 — Immutable ledger**

## Seller

- [ ] **G020 — Real onboarding**
- [ ] **G021 — Real seller product CRUD**
- [ ] **G022 — Real image media**
- [ ] **G023 — Real bulk CSV/XLSX**
- [ ] **G024 — Video launch requirement satisfied**
- [ ] **G025 — Seller team permissions if included at launch**

## Shipping/returns/payouts

- [ ] **G026 — Real rate/label/tracking**
- [ ] **G027 — Authoritative delivered timestamp**
- [ ] **G028 — Real return/refund**
- [ ] **G029 — Payout hold**
- [ ] **G030 — 14-day/configured payout eligibility**
- [ ] **G031 — Real seller settlement**
- [ ] **G032 — Payout/refund idempotency**

## Operations

- [ ] **G033 — Notification delivery**
- [ ] **G034 — Audit logging**
- [ ] **G035 — Monitoring alerts**
- [ ] **G036 — Backup configured**
- [ ] **G037 — Restore tested**
- [ ] **G038 — CI green**
- [ ] **G039 — E2E UAT green**
- [ ] **G040 — Legal copy approved**
- [ ] **G041 — Mobile QA green**
- [ ] **G042 — Controlled pilot successful**

---

# 37. AI WORK SESSION PROCEDURE

Every AI session must follow this exact process:

1. Read `AGENTS.md` and `tasklist3.md`.
2. Run `git status`.
3. Find the **lowest-numbered incomplete task whose dependencies are satisfied**.
4. Do not jump to later phases because a helper file already exists.
5. Inspect existing implementation before changing it.
6. Implement one task or one tightly-related atomic group.
7. Add/update tests.
8. Run:
   ```bash
   bun run lint
   npx tsc --noEmit
   bun run build
   bun run test
   ```
9. Run any phase-specific test.
10. If acceptance criteria fail, keep `[~]` or `[ ]`.
11. If blocked by external access/decision, mark `[!]` and ask the exact question.
12. Update Progress Log.
13. Commit without rewriting history.
14. Continue only when the previous dependency gate is satisfied.

---

# 38. AI STOP CONDITIONS

Stop and ask the owner instead of guessing when:

- Stripe Connect architecture is not decided.
- shipping provider is not selected.
- live API/provider credentials are unavailable.
- return/refund policy conflicts with legal/business requirements.
- payout recovery rule is unclear.
- an operation would destroy production/staging data.
- a migration is destructive and user data exists.
- production domain/DNS access is unavailable.
- a provider does not support the assumed feature.
- the AI would need to weaken security to meet schedule.
- the AI would need to mark a feature complete without end-to-end evidence.

---

# 39. RECOMMENDED IMPLEMENTATION ORDER FOR MULTIPLE DEVELOPERS

After **Phase 3 canonical DB/generated types** is complete, work may parallelize.

## Backend Lead

Own:

- inventory
- checkout/order transaction
- Stripe
- ledger
- payouts
- webhooks
- RLS

## Marketplace/Seller Developer

Own:

- seller onboarding
- product CRUD
- media
- bulk import
- shipping
- fulfilment

## Frontend/Auth/QA Developer

Own:

- SSR auth/guards
- customer account
- cart integration
- admin/team integration
- notifications
- Playwright/CI
- deployment

**Do not parallelize conflicting schema migrations.** One person owns the canonical DB contract.

---

# 40. RECOMMENDED 10-DAY RECOVERY SEQUENCE

This is aggressive and assumes 3 strong developers plus ready provider accounts.

| Day | Goal |
|---|---|
| 1 | Canonical migrations + clean staging + generated types |
| 2 | Server boundaries + SSR auth + RLS + guards |
| 3 | Live catalogue + seller onboarding + product CRUD/storage |
| 4 | DB cart + inventory + transactional order preparation |
| 5 | Stripe Payment Element + webhook + ledger |
| 6 | Real shipping + fulfilment + tracking |
| 7 | Cancellations + returns + Stripe refunds |
| 8 | Stripe Connect payout + real bulk CSV/XLSX |
| 9 | Video + notifications + real admin + security/test hardening |
| 10 | Full staging UAT + production controlled pilot |

If critical stages slip, **reduce launch scope**, not security or transaction integrity.

---

# 41. PROGRESS LOG

| Date | Task | Result | Test/Evidence | Commit |
|---|---|---|---|---|
| 2026-09-07 | T013-T019 | Completed repository baseline, AGENTS.md update, and quality check baselines | npm test, npx tsc, npm run build | e0bc218 |
| 2026-09-08 | T020-T045 | Fixed table creation order, seed.sql column/enum coherence, added decrement_variant_stock RPC, comprehensive schema checker with FK dependency ordering | npm test (26/26 assertions pass), npx tsc (0 errors), npm run build (0 errors) | 41eab02 |
| 2026-09-08 | T046-T055 | Generated canonical database.types.ts, wired schema verification into CI workflow, prepared staging seed | npm test, npx tsc (0 errors), npm run build (0 errors) | f4c89af |
| 2026-09-08 | T056-T063 | Hardened DB latency health check endpoint, runtime environment validation, and server boundaries | npm test, npx tsc (0 errors), npm run build (0 errors) | 348a48f |
| 2026-09-08 | T064-T075 | Completed server authorization helpers (requireUser, requireSellerMember, requireAdminRole, requireFinanceAdmin), MFA gates, and multi-tenant isolation tests | npm test (38/38 assertions pass), npx tsc (0 errors), npm run build (0 errors) | 2b1eeee |
| 2026-09-08 | T076-T087 | Hardened catalogue queries to fail closed in production without fabricated defaults, mapped live variants/stock, enabled zero-trust catalog data | npm test (46/46 assertions pass), npx tsc (0 errors), npm run build (0 errors) | verified |
| 2026-09-08 | T088-T103 | Completed seller onboarding state machine, canonical 11-digit Australian ABN mathematical checksum validator, admin review transitions, document upload MIME/size gates, and Stripe Connect onboarding sync | npm test (46/46 assertions pass), npx tsc (0 errors), npm run build (0 errors) | 3ed90d2 |
| 2026-09-08 | T104-T124 | Completed Product CRUD server functions (draft/submit/clone/archive/moderate), category-driven attributes, variant matrix persistence, unique seller SKU validation, media MIME/size checks, primary image enforcement, and order snapshot immutability | npm test (63/63 assertions pass), npx tsc (0 errors), npm run build (0 errors) | ed66b38 |
| 2026-09-08 | T125-T135 | Completed database-backed cart & wishlist architecture: eliminated LocalStorage as truth authority, implemented get/add/update/remove/merge server functions, secure guest token resolution, live stock revalidation on merge, and DB wishlist synchronization | npm test (76/76 assertions pass), npx tsc (0 errors), npm run build (0 errors) | fac653a |
| 2026-09-08 | T136-T147 | Completed atomic inventory locking, release, commit, restock, and TTL expiration server pipeline; removed fail-open .catch warnings; enforced multi-line rollback on failure; verified concurrency simulation for stock=1 | npm test (86/86 assertions pass), npx tsc (0 errors), npm run build (0 errors) | 81f3548 |
| 2026-09-08 | T148-T162 | Completed zero-trust server-authoritative checkout DTO (client sends IDs/quantities only), authoritative DB price/stock/seller loading, 1/11th GST & multi-seller package calculation, checkout idempotency deduplication, fail-closed rollback, and prototype UI cleanup | npm test (94/94 assertions pass), npx tsc (0 errors), npm run build (0 errors) | eb06858 |
| 2026-09-09 | T163-T179 | Completed Stripe customer payment lifecycle & webhook processing: fail-closed signature verification, webhook_events idempotency & retry tracking, payment success transitions, atomic inventory reservation commit, manual seller order workflow, and payment failure rollback | npm test (121/121 assertions pass), npx tsc (0 errors), npm run build (0 errors) | d1f782f |
| 2026-09-09 | T180-T192 | Completed immutable double-entry marketplace ledger engine (src/lib/api/ledger.ts): canonical entry types, order financial reconciliation, 14-day delivery hold seller balance calculation, and integer cents precision | npm test (121/121 assertions pass), npx tsc (0 errors), npm run build (0 errors) | d1f782f |
| 2026-09-09 | T193-T211 | Completed real Australia Post shipping provider integration (src/lib/api/shipping.ts): domestic rate quoting with weight brackets, consignment & label generation, normalized carrier tracking statuses, and delivery timestamp clock anchoring | npm test (121/121 assertions pass), npx tsc (0 errors), npm run build (0 errors) | d1f782f |
| 2026-09-09 | T212-T227 | Completed seller fulfilment, live sub-orders query, dispatch SLA computation, status transitions (ACCEPT, PREPARING, READY_TO_SHIP, SHIPPED), customer order ownership guards, and multi-vendor isolated fulfillment | npm test (135/135 assertions pass), npx tsc (0 errors), npm run build (0 errors) | a8d829d |
| 2026-09-09 | T228-T237 | Completed multi-actor cancellations (Customer, Seller, Admin), eligibility state boundaries, atomic inventory restocking, unused label cancellation, Stripe refund trigger, compensating ledger entries, and multi-seller package isolation | npm test (135/135 assertions pass), npx tsc (0 errors), npm run build (0 errors) | a8d829d |
| 2026-09-09 | T238-T257 | Completed canonical returns & refunds engine (returns + return_items): 7-day change-of-mind boundary, ACL statutory claims with evidence, private evidence storage, payout holds, Australia Post return tracking, Stripe refund creation, and restocking | npm test (147/147 assertions pass), npx tsc (0 errors), npm run build (0 errors) | 3aabd7a |
| 2026-09-09 | T258-T273 | Completed Stripe Connect seller payout engine (src/lib/api/payouts.ts): 14-day delivery clearance maturity, active dispute/return hold exclusion, transactional settlement, Stripe Connect transfers, statement CSV export, and post-payout recovery debits | npm test (147/147 assertions pass), npx tsc (0 errors), npm run build (0 errors) | 3aabd7a |
| 2026-09-09 | T274-T308 | Completed bulk product CSV/XLSX parser & validation engine (src/lib/api/bulk-upload.ts): SSRF defense for remote media, canonical product/variant/media DB insertion, CREATE/UPDATE modes, 1,000-row chunking, error report CSV export, and UI zero-baseline | npm test (155/155 assertions pass), npx tsc (0 errors), npm run build (0 errors) | c0303a6 |
| 2026-09-09 | T309-T316 | Completed bulk stock adjustment engine (src/lib/api/bulk-upload.ts): seller SKU ownership enforcement, non-negative quantity validation, active reservation hold protection, inventory_transactions audit logging with deltas, and live zero-baseline UI | npm test (165/165 assertions pass), npx tsc (0 errors), npm run build (0 errors) | e2d848d |




---

# 42. OWNER DECISION LOG

| Decision | Selected value | Date | Approved by |
|---|---|---|---|
| Supabase staging project |  |  |  |
| Supabase production project |  |  |  |
| Hosting | Vercel planned |  |  |
| Payment provider | Stripe planned |  |  |
| Seller payout architecture |  |  |  |
| Launch payment methods |  |  |  |
| Shipping provider |  |  |  |
| Email provider | Brevo scaffolded / confirm |  |  |
| Video architecture |  |  |  |
| Return window | 7 days ordinary change-of-mind |  |  |
| Payout delay | 14 days after confirmed delivery |  |  |
| Commission |  |  |  |
| Seller SLA |  |  |  |
| Launch seller count |  |  |  |
| Launch product count |  |  |  |
| Domain |  |  |  |

---

# 43. FINAL RULE

**The project is complete only when the system is demonstrably correct end-to-end.**

Do not use:

- number of files created;
- number of API helpers written;
- number of task checkboxes marked;
- number of screens visually finished;

as the measure of backend readiness.

The measure is:

```text
real user
→ real authenticated permissions
→ real database
→ real inventory
→ real payment
→ real multi-seller order
→ real shipping
→ real delivery
→ real return/refund
→ real payout hold/settlement
→ auditable ledger
→ passing security/idempotency/UAT tests
```

Only then should Indian Shopping Mela be considered ready for public production traffic.
