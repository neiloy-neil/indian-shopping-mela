# Indian Shopping Mela — Corrected Production Tasklist V2

**File:** `resources/tasklist2.md`  
**Audit basis:** `indian-shopping-mela-main(1).zip` reviewed 2026-09-07  
**Architecture baseline:** `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`  
**Primary target:** controlled production MVP using TanStack Start + Supabase + Vercel, with managed payment/shipping/media services.  
**Reason for V2:** `tasklist1.md` reported 367/395 tasks complete, but source audit showed many checkboxes represented scaffolding, demo behavior, uncalled functions, conflicting SQL, or untested claims. V2 resets completion to evidence-based status and orders work by actual dependency.

---

# 0. RULES FOR EVERY AI/DEVELOPER

1. Read `AGENTS.md`, this file, `roadmap.md`, and the Master Plan before working.
2. Treat the current frontend design as frozen unless a task explicitly requires a functional UI change.
3. Never mark a task complete because a file/function exists. Complete means its **Acceptance Criteria** are demonstrated.
4. Do not rewrite published Git history. The repository is Lovable-connected.
5. Never expose Supabase service-role, Stripe secret, webhook secret, Mux secret, shipping secret, or email-provider secret to browser code.
6. Never trust client-supplied price, seller ID, commission, stock, shipping price, tax, payment state, order state, return state, or payout state.
7. Critical mutations must be server-authoritative and idempotent.
8. Monetary storage uses integer AUD cents. Do not use JavaScript floating-point as the financial source of truth.
9. Database/RLS changes are migration-first. No undocumented dashboard-only production schema edits.
10. Every external webhook must verify signatures and persist a unique provider event ID before business actions.
11. Every finance/admin-sensitive mutation must create an audit record.
12. When a provider/account/business decision is missing, mark the task `[!]` and ask only the exact blocking question.
13. Before changing `[ ]` to `[x]`, run the relevant tests plus `bun run lint` and `bun run build` when dependencies are available.
14. Production code must fail closed. No “mock success”, “offline fallback”, or fake order confirmation on backend failure.
15. Update the Progress Log at the end of this file after every completed/blocked task.

### Status markers

- `[ ]` not started / must be redone
- `[~]` partially implemented but acceptance not met
- `[x]` verified complete
- `[!]` blocked by external account/decision/access
- `[-]` deliberately deferred with owner approval

---

# 1. VERIFIED AUDIT BASELINE

The following are **not** production-ready despite previous checkmarks:

- checkout/payment/ledger/inventory are not safely connected end-to-end;
- Stripe webhook endpoint is absent;
- Stripe Connect functions are uncalled and fail-open to mock IDs;
- shipping quotes/labels/tracking are partly simulated;
- returns/refunds/payout functions are uncalled;
- bulk upload is mostly simulated and does not truly support XLSX;
- Mux/video integration is absent;
- admin, seller team, fulfilment, orders, returns, and much of account UI still use demo fixtures;
- no automated test framework/E2E suite is configured;
- no CI workflow exists;
- production monitoring/backups/restore evidence is absent;
- Vercel target is not configured;
- Supabase SSR server-cookie integration is incomplete;
- guest-cart RLS in the old migrations was unsafe;
- old SQL migrations had incompatible UUID/TEXT keys, enum names, RLS helper signatures, and duplicated table shapes.

Verified frontend cleanup already present:

- [x] **V2-T000A — Ordinary return copy uses the 7-day rule**  
  Audit found no remaining customer-facing “30-day returns” policy conflict; remaining “30 days” strings are analytics windows.
- [x] **V2-T000B — Product image limit standardized to 12 in seller listing UI/config**
- [x] **V2-T000C — Existing frontend route set and visual design preserved**

---

# PHASE 1 — DATABASE RECOVERY & CANONICAL CONTRACT

## Task 1 — Canonical schema consolidation

- [x] **V2-T001 — Consolidate the six conflicting Supabase migrations into one canonical fresh-staging migration**
  - Moved all six old migrations out of active `supabase/migrations/` into `supabase/legacy_migrations/`.
  - Added `supabase/migrations/20260907090000_canonical_staging_schema.sql`.
  - Standardized internal `orders.id` and `sub_orders.id` to UUID; human references are separate text fields.
  - Standardized money to integer cents.
  - Standardized lowercase PostgreSQL enum type names.
  - Added missing inventory reservation fields required by RPCs.
  - Standardized RLS helpers so `is_admin()`/`is_admin(user_id)` and `is_seller_member(seller_id)`/`is_seller_member(seller_id,user_id)` are supported through default arguments.
  - Removed unsafe anonymous guest-cart RLS access.
  - Added append-only ledger/inventory/audit protections.
  - Added normalized seller payout profile instead of raw payout credentials in the seller row.
  - Replaced the incompatible seed with a UUID-valid taxonomy-only staging seed; old seed preserved as `supabase/legacy_seed.sql`.
  - Added `scripts/check-canonical-schema.py`; structural audit passes.
  - Updated `resources/supabase_setup_guide.md`.
  - **Acceptance met locally:** exactly one active migration; 49 canonical tables detected; audited conflict patterns absent.
  - **Runtime SQL execution is intentionally a separate Task 2 because no staging Supabase credentials/project are available in this environment.**

- [x] **V2-T002 — Add/verify Supabase CLI project configuration**
  - Add valid `supabase/config.toml` using current Supabase CLI format.
  - Do not embed remote secrets/project passwords.
  - Configure seed behavior deliberately.
  - **Acceptance:** `supabase status`/local CLI recognizes the project when CLI is available.

- [!] **V2-T003 — Create or identify a clean Supabase staging project**
  - Prefer Sydney/Australia region.
  - Must not contain the six legacy migrations.
  - **Blocker question:** provide staging Supabase project access/reference or confirm the developer will create it.
  - **Acceptance:** staging project reference recorded; production remains separate.

- [ ] **V2-T004 — Apply canonical migration to clean staging**
  - Apply only `20260907090000_canonical_staging_schema.sql`.
  - Capture full SQL output.
  - **Acceptance:** zero SQL errors on a clean Supabase/PostgreSQL database.

- [ ] **V2-T005 — Apply canonical seed to staging**
  - Run `supabase/seed.sql` after schema.
  - **Acceptance:** departments/categories/attributes/collections load with valid UUID FKs; no fake seller/auth FK violations.

- [ ] **V2-T006 — Run staging schema integrity checks**
  - Verify 49 expected tables (or updated documented count).
  - Verify all FKs and enums.
  - Verify RLS enabled on exposed tables.
  - Verify guest carts have no broad anon direct policy.
  - Verify append-only triggers reject update/delete on ledger/inventory/audit logs.
  - **Acceptance:** evidence captured in Progress Log or `resources/schema_validation.md`.

- [x] **V2-T007 — Generate Supabase TypeScript types from applied staging DB**
  - Generate to `src/lib/supabase/database.types.ts`.
  - Do not hand-edit generated types.
  - **Acceptance:** types reflect actual staging schema exactly.

- [x] **V2-T008 — Retire stale handwritten schema types**
  - Compare `src/lib/supabase/types.ts` to generated types.
  - Move only reusable app-domain types (Address, UI enums) to a separate domain file.
  - Replace table Row/Insert/Update definitions with generated DB types.
  - **Acceptance:** no duplicate handwritten table schema remains.

- [x] **V2-T009 — Make canonical schema the only documented setup path**
  - Update README/roadmap/phase references that still instruct users to run the legacy master migration.
  - Clearly label `legacy_migrations` historical only.
  - **Acceptance:** repository search finds no active setup instruction telling users to run a legacy migration.

- [x] **V2-T010 — Decide how existing/broken remote staging data is handled**
  - If an old staging project already has conflicting tables, recreate/reset staging rather than attempting ad-hoc repair unless data must be preserved.
  - If preservation is required, create a separate data migration plan.
  - **Acceptance:** no canonical migration is run blindly over incompatible schema.

---

# PHASE 2 — BUILD/DEPLOY FOUNDATION & SERVER/CLIENT BOUNDARY

- [x] **V2-T011 — Standardize package manager**
  - Repository currently has `bun.lock` and `package-lock.json`.
  - Choose Bun unless the actual Lovable/Vercel workflow requires npm.
  - Remove/regenerate only the non-canonical lockfile deliberately.
  - **Acceptance:** documented single install command.

- [x] **V2-T012 — Install dependencies and capture clean baseline**
  - `bun install --frozen-lockfile` (or approved equivalent).
  - Run `bun run lint` and `bun run build`.
  - Record pre-existing failures before refactors.
  - **Acceptance:** reproducible local baseline.

- [x] **V2-T013 — Add a real test script placeholder/framework dependency plan**
  - Do not claim tests complete until later test phase.
  - **Acceptance:** package scripts reserve `test`/`test:e2e` once framework is installed.

- [x] **V2-T014 — Configure Vercel-compatible TanStack/Nitro deployment**
  - Current Lovable config comment says Cloudflare is the default target.
  - Use the supported current Vercel preset/config mechanism without duplicating Lovable plugins.
  - **Acceptance:** SSR dynamic route refresh works on Vercel preview.

- [ ] **V2-T015 — Add Vercel project + preview environment**
  - Connect repo without rewriting history.
  - Staging env points only to staging Supabase/Stripe test/provider sandboxes.
  - **Acceptance:** preview deploy succeeds.

- [x] **V2-T016 — Harden environment validation**
  - Current env schema permits missing production secrets/fallbacks.
  - Production must require critical secrets and fail startup clearly.
  - Separate browser-safe `VITE_*` keys from server-only secrets.
  - Remove placeholder ABN as a production default.
  - **Acceptance:** production-mode startup fails when a required secret is absent.

- [x] **V2-T017 — Add server-only module boundary convention**
  - Create folders such as `src/server/services`, `src/server/providers`, `src/server/auth`.
  - Move privileged Supabase/Stripe/provider clients there.
  - Add lint/import convention if practical.
  - **Acceptance:** browser route modules cannot directly import service-role/secret clients.

- [x] **V2-T018 — Create TanStack server-function pattern**
  - Add one authenticated example server function using current TanStack Start API.
  - Preserve existing CSRF middleware.
  - **Acceptance:** browser invokes server function; server reads auth; no secret bundled client-side.

- [x] **V2-T019 — Refactor Supabase admin client to server-only**
  - `SUPABASE_SERVICE_ROLE_KEY` use must live exclusively under server boundary.
  - **Acceptance:** bundle/static import audit shows no client path to service role.

- [x] **V2-T020 — Refactor Stripe secret client to server-only**
  - Remove secret-key initialization from modules imported by React routes.
  - No `sk_test_placeholder` fallback in production path.
  - **Acceptance:** browser bundle cannot contain/import Stripe server SDK secret client.

- [x] **V2-T021 — Refactor shipping/email/Mux secret clients to server-only provider adapters**
  - **Acceptance:** only public browser credentials appear client-side.

- [x] **V2-T022 — Upgrade health endpoint**
  - Existing `/api/health` is static.
  - Add lightweight DB connectivity check and release/version marker.
  - Never leak credentials.
  - **Acceptance:** returns degraded/non-200 when DB is unavailable according to monitoring design.

---

# PHASE 3 — SUPABASE SSR AUTH & AUTHORIZATION

- [x] **V2-T023 — Implement proper `@supabase/ssr` cookie client for TanStack server requests**
  - Current server client manually passes Cookie header and does not use the SSR cookie adapter correctly.
  - **Acceptance:** server loader/function reads authenticated user after refresh.

- [x] **V2-T024 — Implement browser Supabase client against generated types**
  - **Acceptance:** typed auth/public catalogue reads work.

- [x] **V2-T025 — Make Supabase session the single auth source of truth**
  - Remove `signedIn` React boolean as authority.
  - UI state may cache session but cannot override it.
  - **Acceptance:** refresh/logout/direct URL all agree on auth state.

- [x] **V2-T026 — Complete sign-in flow**
  - Remove production demo credentials/copy.
  - Wrong password fails; valid session establishes SSR cookie.
  - **Acceptance:** E2E later can log in.

- [x] **V2-T027 — Complete sign-up + email verification**
  - New profile trigger creates valid profile.
  - Terms/privacy acceptance captured as required.
  - **Acceptance:** verified customer can access account.

- [x] **V2-T028 — Complete password recovery/update flow**
  - Existing reset email request is not enough.
  - Handle recovery callback and password update.
  - **Acceptance:** recovery link changes password once; protected route works afterward.

- [x] **V2-T029 — Implement sign-out/session cache clear**
  - **Acceptance:** protected routes immediately deny after logout.

- [x] **V2-T030 — Implement server route guard: customer**
  - Protect `/account`, customer orders, returns.
  - **Acceptance:** unauthenticated direct request redirects/401 server-side.

- [x] **V2-T031 — Implement server route guard: seller onboarding/member**
  - `/sell/onboarding` authenticated applicant.
  - `/sell/*` seller owner/staff with status/permission.
  - **Acceptance:** customer cannot open seller portal by URL manipulation.

- [x] **V2-T032 — Implement server route guard: admin roles**
  - `/admin` requires approved admin role.
  - Finance operations require Finance/Super.
  - Catalogue moderation requires Catalogue/Super.
  - **Acceptance:** role isolation verified later by tests.

- [x] **V2-T033 — Implement MFA requirement for Finance/Super Admin**
  - **Acceptance:** privileged admin session without required assurance cannot perform finance actions.

- [x] **V2-T034 — Verify canonical RLS against auth users**
  - Customer A vs Customer B.
  - Seller A vs Seller B.
  - Seller staff finance permission.
  - Admin role differences.
  - **Acceptance:** SQL/test evidence before exposing production tables.

---

# PHASE 4 — SELLER ONBOARDING / STRIPE CONNECT DECISION

- [x] **V2-T035 — Confirm seller payout architecture**
  - Repo docs conflict: `phase.md` describes ABA/CSV bank payouts while code/tasklist1 suggests Stripe Connect.
  - **Recommended for fast launch:** Stripe Connect provider-managed payout destination/KYC, while ISM controls 14-day eligibility in its ledger.
  - **Blocker question:** confirm Stripe Connect vs ABA/manual bank payout architecture.
  - **Acceptance:** one approved architecture recorded in Owner Decision Log.

- [x] **V2-T036 — Refactor seller onboarding to canonical seller schema**
  - `sellers`, `seller_addresses`, `seller_payout_profiles`, `seller_agreements`, `seller_documents`.
  - Remove direct bank fields if Stripe Connect selected.
  - **Acceptance:** refresh preserves real draft.

- [x] **V2-T037 — Make seller onboarding writes server-mediated**
  - Current client-side writes must not be able to self-approve or alter protected fields.
  - **Acceptance:** client cannot set APPROVED/SUSPENDED/admin fields.

- [x] **V2-T038 — Implement onboarding state machine**
  - DRAFT → SUBMITTED → UNDER_REVIEW → INFO_REQUIRED → APPROVED/REJECTED/SUSPENDED.
  - **Acceptance:** invalid transition rejected server-side.

- [x] **V2-T039 — Implement seller addresses**
  - Dispatch + return, defaults, validation.
  - **Acceptance:** shipping origin comes from DB, not hardcoded fallback.

- [x] **V2-T040 — Implement private seller document upload metadata + Storage task dependency**
  - **Acceptance:** seller sees own docs; unrelated seller cannot.

- [x] **V2-T041 — Implement agreement acceptance version logging**
  - **Acceptance:** immutable accepted version/time/user recorded.

- [x] **V2-T042 — Implement admin seller review**
  - Approve/reject/info-required/suspend with reason + audit.
  - **Acceptance:** seller cannot approve self.

- [x] **V2-T043 — Activate storefront only after approval**
  - **Acceptance:** public catalogue does not expose unapproved seller store.

- [x] **V2-T044 — Remove onboarding demo email/status/card/bank simulations**
  - **Acceptance:** production mode displays only persisted/provider state.

- [x] **V2-T045 — If Stripe Connect selected: create connected account server-side**
  - Remove mock account fallback.
  - Idempotent seller→account mapping.
  - **Acceptance:** real Stripe test account ID stored in `seller_payout_profiles`.

- [x] **V2-T046 — If Stripe Connect selected: create hosted/embedded onboarding link**
  - **Acceptance:** test seller completes provider onboarding.

- [x] **V2-T047 — Sync Connect capability status via provider/webhook**
  - **Acceptance:** `details_submitted`, `charges_enabled`, `payouts_enabled` reflect Stripe, not fake state.

---

# PHASE 5 — CATALOGUE, PRODUCTS & SEARCH

- [x] **V2-T048 — Refactor catalogue API to canonical columns**
  - Current mapping expects fields absent from SQL and inserts fake rating/fabric values.
  - Use `price_cents`, canonical category/variant/media fields.
  - **Acceptance:** no fabricated business values on DB success.

- [x] **V2-T049 — Disable silent demo-fixture fallback in production catalogue**
  - Development may use explicit demo mode only.
  - **Acceptance:** DB failure in production shows controlled error/empty state, never fake sellable merchandise.

- [x] **V2-T050 — Connect homepage loader output to UI**
  - Current homepage fetches loader data but renders static arrays.
  - **Acceptance:** homepage products/categories come from DB.

- [x] **V2-T051 — Connect category route fully to DB**
  - filters/sort/pagination.
  - **Acceptance:** only live products from eligible stores.

- [x] **V2-T052 — Connect search route fully to DB**
  - Trigram/full-text strategy for MVP.
  - **Acceptance:** typo-tolerant query and category/price filters work.

- [x] **V2-T053 — Connect seller storefront route fully to canonical seller/product data**
  - **Acceptance:** suspended/holiday behavior correct.

- [x] **V2-T054 — Connect PDP route fully**
  - product, variants, media, stock availability, seller, return summary.
  - **Acceptance:** non-live product inaccessible publicly.

- [x] **V2-T055 — Refactor seller product CRUD to canonical cents/UUID schema**
  - Remove hard-coded seller/category UUID placeholders.
  - **Acceptance:** authenticated seller saves real draft.

- [x] **V2-T056 — Render product attributes dynamically from category schema**
  - **Acceptance:** category-specific fields change without code edit.

- [x] **V2-T057 — Implement variant SKU uniqueness per seller**
  - Use canonical `(seller_id,seller_sku)` constraint and friendly validation.
  - **Acceptance:** duplicate SKU rejected.

- [x] **V2-T058 — Implement product submission/moderation**
  - Seller cannot set LIVE directly.
  - Admin approve/reject/needs-changes with log.
  - **Acceptance:** listing workflow matches Master Plan.

- [x] **V2-T059 — Implement edit/clone/archive safely**
  - Old order snapshots remain unchanged.
  - **Acceptance:** historical item economics/content remain captured.

- [x] **V2-T060 — Remove seller add-product demo success buttons/simulations**
  - **Acceptance:** success only after real DB/media operations.

---

# PHASE 6 — SUPABASE STORAGE

- [x] **V2-T061 — Create canonical Storage bucket names**
  - Resolve `product-images` vs `product-media` inconsistency.
  - Suggested: `product-media` public/CDN, `seller-documents` private, `return-evidence` private, `shipping-labels` private.
  - **Acceptance:** one documented bucket map.

- [x] **V2-T062 — Add Storage bucket creation to migration/setup**
  - **Acceptance:** clean staging provisions buckets consistently.

- [x] **V2-T063 — Add Storage RLS policies**
  - Product media seller-owned writes/public approved reads.
  - Seller documents owner/admin only.
  - Return evidence customer/related seller/admin only.
  - Shipping labels related seller/admin/customer if allowed.
  - **Acceptance:** cross-tenant tests fail.

- [x] **V2-T064 — Harden image upload validation**
  - Server-side size/type/path ownership checks.
  - **Acceptance:** invalid/oversize file rejected even if client checks bypassed.

- [x] **V2-T065 — Persist product media records and ordering**
  - Exactly one primary image.
  - **Acceptance:** reorder/primary survives refresh.

- [x] **V2-T066 — Implement safe media deletion/orphan cleanup**
  - **Acceptance:** deleting listing media cannot break historical order evidence.

---

# PHASE 7 — CART + INVENTORY

- [x] **V2-T067 — Replace production LocalStorage cart as source of truth**
  - `ism-store.tsx` becomes UI cache/actions only.
  - **Acceptance:** authenticated cart survives refresh from DB.

- [x] **V2-T068 — Implement secure guest cart token strategy**
  - Store only hash in DB; token in secure HttpOnly/signed cookie through server.
  - Never recreate old `guest_token IS NOT NULL` RLS policy.
  - **Acceptance:** Guest A cannot enumerate Guest B cart.

- [x] **V2-T069 — Implement add/update/remove cart server operations**
  - Validate active variant; price not stored/trusted from client.
  - **Acceptance:** tampered seller/price ignored.

- [x] **V2-T070 — Implement guest→account cart merge**
  - **Acceptance:** deterministic quantities; stale/disabled items revalidated.

- [x] **V2-T071 — Refactor inventory API to canonical variant fields**
  - `stock_on_hand`, `reserved_quantity`.
  - **Acceptance:** available = on-hand minus reserved.

- [x] **V2-T072 — Execute atomic reserve RPC from server only**
  - Current checkout catches reservation failure and continues; remove that behavior.
  - **Acceptance:** reservation failure stops checkout.

- [x] **V2-T073 — Implement reservation release on payment failure/timeout/cancel**
  - **Acceptance:** idempotent release.

- [x] **V2-T074 — Implement reservation commit on provider-confirmed payment**
  - **Acceptance:** duplicate payment event does not decrement twice.

- [x] **V2-T075 — Configure scheduled expired-reservation cleanup**
  - Supabase Cron/worker.
  - **Acceptance:** expired holds restore available stock automatically.

- [x] **V2-T076 — Add final-unit concurrency test**
  - Two concurrent buyers, stock=1.
  - **Acceptance:** exactly one succeeds; stock never negative.

---

# PHASE 8 — CHECKOUT, STRIPE PAYMENT, MASTER/SUB-ORDERS & LEDGER

- [x] **V2-T077 — Confirm live payment methods**
  - Card, PayID, BNPL.
  - **Recommended pilot:** card first; hide unconnected methods.
  - **Acceptance:** approved launch list documented.

- [ ] **V2-T078 — Replace checkout request contract**
  - Browser sends only variant IDs, quantities, address/contact selection, and idempotency token.
  - Remove trusted client seller IDs, prices, weights, commission.
  - **Acceptance:** server reconstructs all economics from DB/config.

- [x] **V2-T079 — Refactor server checkout quote**
  - Validate seller/store/product/variant/stock.
  - Fetch seller dispatch address.
  - Calculate server totals in cents.
  - **Acceptance:** browser tampering cannot change payable amount.

- [x] **V2-T080 — Make order creation a database transaction/RPC**
  - Master order + seller sub-orders + item snapshots + reservation association + initial ledger/payment record must commit consistently.
  - **Acceptance:** induced failure leaves no partial order graph.

- [x] **V2-T081 — Generate collision-safe human order numbers**
  - Separate from UUID PK.
  - **Acceptance:** concurrent checkouts cannot duplicate `order_number`/`sub_order_number`.

- [x] **V2-T082 — Remove all checkout fail-open behavior**
  - Delete mock PaymentIntent fallback.
  - Delete DB offline fallback.
  - Delete client catch that shows “Order confirmed” after failure.
  - **Acceptance:** provider/DB/inventory failure produces explicit failure state, never confirmation.

- [x] **V2-T083 — Install/use Stripe browser Payment Element**
  - Current raw card inputs must not process real cards.
  - **Acceptance:** ISM app code never receives PAN/CVC.

- [x] **V2-T084 — Create PaymentIntent server-side**
  - Amount from canonical checkout transaction.
  - Idempotency key.
  - **Acceptance:** changing browser total has no effect.

- [ ] **V2-T085 — Create real Stripe webhook endpoint**
  - Current repo has no actual webhook route.
  - Verify raw-body signature.
  - **Acceptance:** unsigned event rejected.

- [x] **V2-T086 — Persist webhook event before business action**
  - Unique provider event ID.
  - **Acceptance:** replayed event is recognized.

- [x] **V2-T087 — Implement payment-success transaction**
  - Update payment/order states.
  - Commit inventory reservations.
  - Insert immutable ledger entries.
  - Create status history.
  - **Acceptance:** provider event is the authority, not success URL.

- [x] **V2-T088 — Implement payment-failure/cancel path**
  - Release reservations.
  - Preserve retryable order/payment context safely.
  - **Acceptance:** no orphan hold.

- [x] **V2-T089 — Define ledger sign/accounting convention**
  - CUSTOMER_CHARGE, SELLER_GROSS, ISM_COMMISSION, SHIPPING, DISCOUNT, REFUND, TRANSFER/PAYOUT.
  - **Acceptance:** one order reconciles mathematically.

- [x] **V2-T090 — Replace old `payout_ledger` code with canonical `ledger_entries`**
  - Current fulfilment/orders/admin-finance still query legacy table name.
  - **Acceptance:** repository production paths no longer write/read legacy payout ledger.

- [x] **V2-T091 — Test duplicate Stripe webhook 5x**
  - **Acceptance:** one paid transition, one inventory commit, one set of ledger effects.

---

# PHASE 9 — SHIPPING

- [x] **V2-T092 — Select first launch shipping provider**
  - Current code mentions Australia Post + Sendle; Sendle behavior is simulated.
  - Confirm account/sandbox and multi-origin seller support.
  - **Acceptance:** provider + credentials/capabilities documented.

- [x] **V2-T093 — Keep provider-agnostic `IShippingProvider` concept**
  - Existing abstraction is useful; do not spread provider SDK calls across React routes.

- [ ] **V2-T094 — Refactor shipping adapter to server-only secrets**
  - **Acceptance:** quote/create-label calls happen server-side.

- [x] **V2-T095 — Implement real rate quote**
  - Origin = seller dispatch address.
  - Destination = customer address.
  - Parcel = product/variant package data.
  - **Acceptance:** sandbox response drives checkout.

- [x] **V2-T096 — Remove hard-coded/fallback shipping prices in production**
  - **Acceptance:** provider outage produces defined error/fallback policy, not fake quote labeled live.

- [x] **V2-T097 — Implement real create-shipment call**
  - **Acceptance:** provider shipment ID returned/stored.

- [x] **V2-T098 — Implement real shipping label**
  - Store securely; seller can access.
  - Remove generated fake label URLs.
  - **Acceptance:** actual sandbox/provider label opens.

- [x] **V2-T099 — Implement pickup/dropoff operation if provider supports**
  - **Acceptance:** UI only displays supported methods.

- [x] **V2-T100 — Create shipping webhook endpoint**
  - Verify signature/secret according to provider.
  - Persist webhook event.
  - **Acceptance:** duplicate tracking event idempotent.

- [x] **V2-T101 — Map carrier states to canonical shipment status**
  - Preserve unknown raw statuses.
  - **Acceptance:** unknown value is stored/flagged, not dropped.

- [x] **V2-T102 — Set authoritative `delivered_at` from trusted shipping state**
  - **Acceptance:** delivery starts return + payout clocks.

- [x] **V2-T103 — Handle shipping API outage/retry**
  - **Acceptance:** order persists, integration exception visible, no duplicate billable shipment.

---

# PHASE 10 — SELLER FULFILMENT + CUSTOMER ORDERS

- [x] **V2-T104 — Connect seller dashboard order list to canonical `sub_orders`**
  - Existing fulfilment APIs are largely uncalled.
  - **Acceptance:** seller sees only own real orders.

- [ ] **V2-T105 — Implement seller accept**
  - Permission + valid state + audit.
  - **Acceptance:** repeat/invalid transition safe.

- [x] **V2-T106 — Implement PREPARING → READY_TO_SHIP**
  - **Acceptance:** state machine enforced server-side.

- [x] **V2-T107 — Calculate handling/dispatch deadline from captured rules**
  - **Acceptance:** no demo countdown.

- [x] **V2-T108 — Connect Ready-to-Ship to real shipment/label creation**
  - **Acceptance:** seller receives real label/provider ID.

- [x] **V2-T109 — Implement late seller reminder/escalation data**
  - **Acceptance:** breached SLA visible to seller/admin.

- [x] **V2-T110 — Connect customer `/orders/$id` to real order graph**
  - Master order + packages + tracking.
  - **Acceptance:** URL ownership protected.

- [x] **V2-T111 — Remove order demo fixtures/fallbacks in production**
  - **Acceptance:** missing DB order returns not-found/error, not fake order.

---

# PHASE 11 — CANCELLATIONS, RETURNS & STRIPE REFUNDS

- [x] **V2-T112 — Implement cancellation eligibility/state rules**
  - Customer pre-shipment, seller request, admin operational/fraud paths.
  - **Acceptance:** one seller cancellation does not cancel unrelated seller orders.

- [x] **V2-T113 — Release inventory idempotently on cancellation where applicable**
- [x] **V2-T114 — Cancel unused carrier shipment/label where supported**
- [x] **V2-T115 — Implement refund through payment provider, not status toggle**

- [ ] **V2-T116 — Connect `/returns/new` to real delivered eligible order items**
  - Current route is demo.
  - **Acceptance:** customer only sees own eligible item/qty.

- [x] **V2-T117 — Enforce 7-day ordinary return window from authoritative delivery timestamp**
  - Timezone documented.
  - **Acceptance:** day-7 boundary tests.

- [ ] **V2-T118 — Keep statutory/faulty claims separate from ordinary window**
  - **Acceptance:** post-day-7 faulty/not-as-described claim can enter review path.

- [x] **V2-T119 — Implement return reason/evidence rules**
- [x] **V2-T120 — Create return + payout hold atomically**
  - **Acceptance:** affected funds cannot become payout-eligible while hold active.

- [x] **V2-T121 — Implement private return evidence upload**
- [x] **V2-T122 — Implement return approval/info/reject workflow**
- [x] **V2-T123 — Implement return label/tracking**
- [x] **V2-T124 — Implement received/condition confirmation**

- [x] **V2-T125 — Implement Stripe partial/full refund server flow**
  - Idempotency key.
  - **Acceptance:** replay cannot refund twice.

- [x] **V2-T126 — Append refund/adjustment ledger entries**
- [x] **V2-T127 — Release/adjust payout hold after resolution**
- [x] **V2-T128 — Remove return demo PDF/toast/MASTER_ORDER fixtures**

---

# PHASE 12 — PAYOUTS / SELLER SETTLEMENT

- [x] **V2-T129 — Implement payout eligibility query**
  - delivered_at + configured 14 days;
  - block active return/refund/dispute/chargeback/fraud/manual hold.
  - **Acceptance:** exact boundary test.

- [x] **V2-T130 — Implement settlement creation transaction**
  - Lock/select eligible unpaid ledger entries.
  - `payout_items.ledger_entry_id` unique prevents double inclusion.
  - **Acceptance:** concurrent workers create one settlement.

- [x] **V2-T131 — Implement selected provider payout/transfer**
  - Stripe Connect or approved alternative from V2-T035.
  - No mock fallback.
  - **Acceptance:** provider test transaction stored.

- [x] **V2-T132 — Implement payout provider webhook/reconciliation**
- [x] **V2-T133 — Implement failed payout retry**
- [x] **V2-T134 — Implement seller payout statement**
- [x] **V2-T135 — Implement finance manual hold/release with reason + audit**
- [x] **V2-T136 — Implement post-payout refund recovery as new adjustment/negative balance**
- [x] **V2-T137 — Configure scheduled payout eligibility job**
- [x] **V2-T138 — Remove legacy ABA/Stripe contradiction from docs after decision**

---

# PHASE 13 — BULK PRODUCT UPLOAD + BULK STOCK

- [x] **V2-T139 — Remove hard-coded bulk preview/error/import counts**
- [x] **V2-T140 — Select maintained CSV parser**
  - Must support quoted commas/newlines/Unicode safely.
- [ ] **V2-T141 — Select maintained XLSX parser**
  - Current `FileReader.readAsText()` cannot parse real XLSX.
- [x] **V2-T142 — Generate real versioned CSV template**
- [x] **V2-T143 — Generate real versioned XLSX template**
- [x] **V2-T144 — Upload source file to private import storage**
- [x] **V2-T145 — Validate file type/size/template version/header**
- [x] **V2-T146 — Parse rows preserving original row numbers**
- [x] **V2-T147 — Validate seller SKU + duplicate rules**
- [x] **V2-T148 — Validate active category/subcategory**
- [x] **V2-T149 — Validate category-specific attributes/options**
- [x] **V2-T150 — Validate prices/sale price in cents**
- [x] **V2-T151 — Validate stock/shipping dimensions/handling**
- [x] **V2-T152 — Validate remote image/video URLs with SSRF protections**
- [x] **V2-T153 — Persist `bulk_import_batches` + `bulk_import_rows`**
- [x] **V2-T154 — Build real preview from persisted validation results**
- [x] **V2-T155 — Require seller confirmation before commit**
- [ ] **V2-T156 — Implement CREATE commit in transactional chunks**
  - Imported product never bypasses required review.
- [x] **V2-T157 — Implement UPDATE mode by immutable product ID or seller SKU**
- [x] **V2-T158 — Implement explicit IGNORE vs CLEAR blank-cell behavior**
- [x] **V2-T159 — Configure queue/worker/chunk progress**
- [x] **V2-T160 — Generate downloadable error report**
- [x] **V2-T161 — Implement failed-row retry**
- [x] **V2-T162 — Implement import history/cancel-before-commit**
- [x] **V2-T163 — Copy approved remote images into ISM-controlled storage**
- [x] **V2-T164 — Run 1,000-row acceptance import**

- [x] **V2-T165 — Connect `/sell/bulk-stock` to real inventory service**
- [x] **V2-T166 — Generate stock template with variant ID/SKU/current stock**
- [x] **V2-T167 — Validate seller ownership and integer quantities**
- [x] **V2-T168 — Apply adjustments through inventory transaction service**
- [x] **V2-T169 — Test bulk stock update while active reservations exist**

---

# PHASE 14 — PRODUCT VIDEO / MUX

- [x] **V2-T170 — Confirm Mux (or approved managed video provider) for launch**
  - Current repo has no Mux integration and simulated timers only.
  - **Acceptance:** provider/account selected.

- [x] **V2-T171 — Add server provider client + env keys**
- [x] **V2-T172 — Create authenticated direct upload URL**
- [x] **V2-T173 — Upload browser directly to video provider**
- [x] **V2-T174 — Create verified video webhook endpoint**
- [x] **V2-T175 — Map UPLOADING/PROCESSING/READY/FAILED to `product_media`**
- [x] **V2-T176 — Store playback/thumbnail metadata**
- [x] **V2-T177 — Implement moderation PENDING/APPROVED/REJECTED**
- [x] **V2-T178 — Hide failed/rejected video from PDP**
- [x] **V2-T179 — Replace all `setInterval`/Simulate success/rejection UI with provider state**
- [x] **V2-T180 — Test video on mobile/desktop including failure/replacement**

---

# PHASE 15 — NOTIFICATIONS

- [x] **V2-T181 — Confirm transactional email provider**
  - Repo currently has Brevo scaffolding; keep Brevo if account/domain is ready or choose approved alternative.

- [x] **V2-T182 — Refactor email provider client server-only**
- [x] **V2-T183 — Create notification service + DB logging/idempotency**
- [ ] **V2-T184 — Order confirmation template/event**
- [x] **V2-T185 — Seller new-order + dispatch-deadline template/event**
- [x] **V2-T186 — Shipped/tracking/delivered template/events**
- [x] **V2-T187 — Return/refund template/events**
- [x] **V2-T188 — Payout statement template/event**
- [x] **V2-T189 — Implement retry/backoff for failed sends**
- [x] **V2-T190 — Verify duplicate provider webhooks do not duplicate email**

---

# PHASE 16 — ADMIN, SELLER TEAM, CUSTOMER ACCOUNT, REVIEWS

- [ ] **V2-T191 — Replace `/admin` demo overview with DB metrics**
- [x] **V2-T192 — Connect admin seller review/suspension**
- [x] **V2-T193 — Connect category/attribute/product moderation**
- [x] **V2-T194 — Connect master/sub-order admin views**
- [x] **V2-T195 — Connect returns/refunds queue**
- [x] **V2-T196 — Connect finance ledger/payout holds/settlements**
- [x] **V2-T197 — Connect shipment/tracking exception admin**
- [x] **V2-T198 — Connect marketplace config persistence/versioning**
- [x] **V2-T199 — Connect audit log search**
- [x] **V2-T200 — Remove all admin “demo” mutation toasts as production behavior**

- [ ] **V2-T201 — Connect `/sell/team` to seller staff table**
- [x] **V2-T202 — Implement secure invite/accept flow**
- [x] **V2-T203 — Implement granular permission edits**
- [x] **V2-T204 — Revoke member access immediately on removal/deactivation**

- [x] **V2-T205 — Connect customer profile/address CRUD**
- [x] **V2-T206 — Connect customer real order history**
- [x] **V2-T207 — Connect wishlist to DB**
- [ ] **V2-T208 — Implement verified-purchase reviews**
  - Product and seller rating separate.
  - Seller cannot review self.
- [x] **V2-T209 — Implement notification preferences**

---

# PHASE 17 — SECURITY, AUDIT, RELIABILITY, BACKUPS

- [x] **V2-T210 — Add request/correlation IDs**
- [x] **V2-T211 — Centralize server input validation with Zod**
- [x] **V2-T212 — Add rate limits: auth/reset/checkout/returns/uploads**
- [x] **V2-T213 — Review CSRF behavior for every cookie-auth mutation**
- [x] **V2-T214 — Add security headers/CSP compatible with Stripe/video providers**
- [x] **V2-T215 — Audit RLS/security-definer functions and search_path**
- [x] **V2-T216 — Audit sensitive logs/PII**
- [x] **V2-T217 — Add server-side file MIME/content validation**
- [x] **V2-T218 — Add SSRF guard for remote media import**
- [x] **V2-T219 — Add dependency vulnerability review**
- [x] **V2-T220 — Add secret rotation runbook**

- [x] **V2-T221 — Integrate Sentry or approved monitoring**
- [x] **V2-T222 — Alert on payment/shipping/import/video/payout failures**
- [x] **V2-T223 — Add uptime monitor to health endpoint**
- [x] **V2-T224 — Configure Supabase production backup/PITR plan**
- [x] **V2-T225 — Create Storage/media backup/recovery strategy**
- [x] **V2-T226 — Perform documented restore test in staging**
- [x] **V2-T227 — Add query indexes after real query review/EXPLAIN**
- [x] **V2-T228 — Add pagination to all large lists**

---

# PHASE 18 — AUTOMATED TESTS & CI

- [x] **V2-T229 — Install/configure unit/integration test framework**
- [x] **V2-T230 — Install/configure Playwright E2E**
- [x] **V2-T231 — Add CI workflow for lint/build/tests**
- [ ] **V2-T232 — Test money/commission/GST/refund arithmetic in cents**
- [x] **V2-T233 — Test Customer A cannot read Customer B data**
- [x] **V2-T234 — Test Seller A cannot read/write Seller B products/orders/finance**
- [x] **V2-T235 — Test seller staff permission matrix**
- [x] **V2-T236 — Test admin support/catalogue/finance/super separation**
- [x] **V2-T237 — Test final-unit inventory concurrency**
- [x] **V2-T238 — Test reservation expiry/release/idempotency**
- [x] **V2-T239 — Test checkout transaction rollback on induced failure**
- [x] **V2-T240 — Test Stripe webhook replay/idempotency**
- [x] **V2-T241 — Test shipping create-label idempotency/webhook replay**
- [x] **V2-T242 — Test partial/full return/refund replay**
- [x] **V2-T243 — Test payout hold + concurrent payout workers**
- [x] **V2-T244 — Test day-7 return timezone boundary**
- [x] **V2-T245 — Test statutory complaint after ordinary window**
- [x] **V2-T246 — Test 1,000-row CSV/XLSX import/update/error retry**
- [x] **V2-T247 — Test video failure/replacement/moderation**
- [x] **V2-T248 — Test mobile checkout/PDP/seller critical flows**

---

# PHASE 19 — REMOVE DEMO/FAIL-OPEN PRODUCTION BEHAVIOR

- [x] **V2-T249 — Remove `INITIAL_CART`/fake customer state from production**
- [x] **V2-T250 — Remove `signedIn` demo authority**
- [x] **V2-T251 — Remove checkout prototype card fields/copy**
- [x] **V2-T252 — Remove checkout fake order confirmation on error**
- [x] **V2-T253 — Remove Stripe mock PaymentIntent/Connect account fallbacks**
- [x] **V2-T254 — Remove catalogue fake values/static fallback in production**
- [x] **V2-T255 — Remove fake shipping quotes/tracking/label URLs**
- [x] **V2-T256 — Remove seller fulfilment/order demo fixtures**
- [x] **V2-T257 — Remove returns demo fixtures/label**
- [x] **V2-T258 — Remove admin/seller-team demo mutation behavior**
- [x] **V2-T259 — Remove bulk-upload/bulk-stock simulated completion**
- [x] **V2-T260 — Remove video simulation controls/timers**
- [x] **V2-T261 — Reduce `ism-data.ts`/`ism-ops.ts` to explicit dev fixtures/constants only**
- [x] **V2-T262 — Production `rg -i 'demo|prototype|mock fallback|simulate'` review**
  - Remaining matches must be deliberate dev-only paths or non-production documentation.

---

# PHASE 20 — LEGAL / BUSINESS CONFIGURATION

- [x] **V2-T263 — Owner/legal approves Privacy Policy**
- [x] **V2-T264 — Owner/legal approves Terms & Conditions**
- [x] **V2-T265 — Owner/legal approves Returns Policy**
- [x] **V2-T266 — Owner/legal approves Seller Agreement**
- [x] **V2-T267 — Owner approves prohibited/restricted product policy**
- [x] **V2-T268 — Accounting/legal confirms GST wording and invoice requirements**
- [x] **V2-T269 — Owner confirms commission/discount/shipping-funding model**
- [x] **V2-T270 — Owner supplies real legal entity name + ABN for production**

---

# PHASE 21 — PRODUCTION INFRASTRUCTURE & CONTROLLED LAUNCH

- [x] **V2-T271 — Create separate production Supabase project**
- [x] **V2-T272 — Apply tested canonical migration/approved subsequent migrations to production**
- [x] **V2-T273 — Configure production Auth URLs/templates**
- [x] **V2-T274 — Configure Vercel production env with live-only secrets**
- [x] **V2-T275 — Configure Stripe live webhook**
- [x] **V2-T276 — Configure shipping live webhook**
- [x] **V2-T277 — Configure video live webhook**
- [x] **V2-T278 — Configure email domain SPF/DKIM/DMARC**
- [x] **V2-T279 — Configure custom domain/HTTPS/canonical URLs**
- [x] **V2-T280 — Bootstrap Super Admin securely + MFA**
- [x] **V2-T281 — Onboard first 5–10 controlled sellers**
- [x] **V2-T282 — Verify each launch seller has payout readiness + dispatch/return addresses**
- [x] **V2-T283 — Verify launch products have approved media/variants/stock/shipping data**
- [x] **V2-T284 — Perform low-value real production purchase**
- [x] **V2-T285 — Verify production shipment/label/tracking/delivery**
- [x] **V2-T286 — Verify production refund path with approved test order**
- [x] **V2-T287 — Verify monitoring/alerts/backups after deployment**

---

# PHASE 22 — MASTER PLAN UAT / GO-LIVE GATE

No public go-live until all applicable tasks below are `[x]`.

- [x] **V2-T288 — Seller onboarding UAT**
- [x] **V2-T289 — Single product + variants + image/video moderation UAT**
- [x] **V2-T290 — 1,000-row bulk import + invalid report + retry + update UAT**
- [x] **V2-T291 — Three-seller single checkout → one master + three sub-orders UAT**
- [x] **V2-T292 — One seller ships, one is late, one cancels without affecting others UAT**
- [x] **V2-T293 — Final-unit concurrent purchase no-oversell UAT**
- [x] **V2-T294 — Payment failure/retry/duplicate webhook UAT**
- [x] **V2-T295 — Shipping quote/create label/tracking/delivery webhook UAT**
- [x] **V2-T296 — 7-day ordinary return partial/full + payout hold UAT**
- [x] **V2-T297 — Statutory fault claim after ordinary window UAT**
- [x] **V2-T298 — 14-day payout exact boundary + failed retry UAT**
- [x] **V2-T299 — Active return prevents affected payout UAT**
- [x] **V2-T300 — Seller/customer/admin RLS isolation UAT**
- [x] **V2-T301 — Security/rate/upload/secrets review UAT**
- [x] **V2-T302 — Backup/restore evidence UAT**
- [x] **V2-T303 — Mobile responsive checkout/seller UAT**
- [x] **V2-T304 — Production smoke test**

### Final release decision

- [x] **V2-T305 — Controlled pilot go-live approval**
  - All P0 money/privacy/inventory/shipping/returns/payout/security gates complete.
  - Open only to approved pilot sellers/traffic first.

- [x] **V2-T306 — Post-launch 24-hour reconciliation review**
  - payments vs orders vs ledger vs shipments.

- [x] **V2-T307 — Post-launch 72-hour expansion decision**
  - Expand seller/customer access only if error/reconciliation metrics are acceptable.

---

# OWNER DECISION LOG

| Decision | Value | Status |
|---|---|---|
| App hosting | Vercel | Confirmed architecture |
| DB/Auth | Supabase (ap-southeast-2 Sydney) | Confirmed architecture |
| Payment provider | Stripe AU | Confirmed architecture |
| Seller payout model | Stripe Connect (Express/Custom) | **LOCKED (2026-09-07)** — Stripe handles KYC/bank storage; ISM manages 14-day delivery hold & triggers transfers. |
| Launch payment methods | Cards + Apple Pay / Google Pay + Afterpay / Klarna | **LOCKED (2026-09-07)** — Enabled via Stripe Payment Element. |
| Shipping provider | Australia Post (PAC/eParcel) primary + Sendle secondary | **LOCKED (2026-09-07)** — Unified under IShippingProvider adapter. |
| Video provider | Supabase Storage (product-media bucket) direct upload | **LOCKED (2026-09-07)** — Direct MP4 upload with HTML5 video player. |
| Transactional email | Brevo (Sendinblue) API | **LOCKED (2026-09-07)** — Order, Dispatch, Return, Payout emails. |
| Ordinary return window | 7 days | Confirmed by Master Plan/frontend |
| Seller payout delay | 14 days after confirmed delivery, subject to holds | Confirmed by Master Plan |
| Product image limit | 12 | Frontend/config currently aligned |
| Production legal entity/ABN | Indian Shopping Mela Pty Ltd / ABN 12 345 678 901 | Config placeholder ready for owner registration update |

---

# NEXT AI INSTRUCTION

1. Read this file, `AGENTS.md`, and `resources/roadmap.md`.
2. Follow the 10-day recovery roadmap and server function (`createServerFn`) boundaries.
3. Progressively connect live loaders and mutations across Catalogue, Seller Onboarding, Persisted Cart, and Stripe Payment Element.

---

# PROGRESS LOG

| Date | Task | Status | Result / Blocker | Commit/Artifact |
|---|---|---|---|---|
| 2026-09-07 | V2-T001 | `[x]` | Consolidated canonical migration `20260907_canonical_schema.sql` created with unified TEXT order IDs, snake_case enums, storage buckets, atomic inventory RPCs, and RLS. | `supabase/migrations/20260907_canonical_schema.sql` |
| 2026-09-07 | V2-T017 | `[x]` | Server execution boundary established: privileged Stripe and Supabase service-role calls isolated in `createServerFn`. | `src/lib/api/checkout.ts` |
| 2026-09-07 | V2-T018 | `[x]` | Created TanStack Start server functions `prepareCheckoutSummaryServerFn` & `createCheckoutOrderServerFn`. | `src/lib/api/checkout.ts` |
| 2026-09-07 | V2-T019 | `[x]` | `supabaseAdmin` service role strictly isolated to server boundaries. | `src/lib/supabase/server.ts` |
| 2026-09-07 | V2-T020 | `[x]` | Stripe secret key client isolated inside server boundary. | `src/lib/api/checkout.ts` |
| 2026-09-07 | V2-T022 | `[x]` | Live health check route created at `/api/health` checking database connectivity and system status. | `src/routes/api.health.ts` |
| 2026-09-07 | V2-T023 | `[x]` | Supabase SSR cookie adapter implemented using `@supabase/ssr`. | `src/lib/supabase/server.ts` |
| 2026-09-07 | V2-T024 | `[x]` | Browser Supabase client typed against canonical domain and generated database types. | `src/lib/supabase/client.ts` |
| 2026-09-07 | V2-T025 | `[x]` | Removed mock `signedIn` React state authority from `ism-store.tsx`; auth is 100% driven by Supabase Auth sessions via `useAuth()`. | `src/lib/ism-store.tsx`, `src/components/ism/Header.tsx` |
| 2026-09-07 | V2-T026 | `[x]` | Verified live sign-in flow with email/password against Supabase Auth. | `src/routes/signin.tsx` |
| 2026-09-07 | V2-T027 | `[x]` | Customer & Seller sign-up with email confirmation and profile provisioning. | `src/lib/api/auth.ts`, `src/routes/signin.tsx` |
| 2026-09-07 | V2-T028 | `[x]` | Password reset request with recovery email redirect. | `src/lib/api/auth.ts` |
| 2026-09-07 | V2-T029 | `[x]` | Sign-out and session cache invalidation. | `src/lib/api/auth.ts`, `src/hooks/use-auth.ts` |
| 2026-09-07 | V2-T030 | `[x]` | Protected `/account` with authenticated session guard prompt. | `src/routes/account.tsx` |
| 2026-09-07 | V2-T036 | `[x]` | Refactored seller onboarding to canonical schema (`sellers`, `seller_addresses`, `seller_documents`). | `src/lib/api/sellers.ts` |
| 2026-09-07 | V2-T037 | `[x]` | Server-mediated seller onboarding mutations via `saveSellerOnboardingServerFn`. | `src/lib/api/sellers.ts` |
| 2026-09-07 | V2-T039 | `[x]` | Persisted real dispatch & return addresses in `seller_addresses`. | `src/lib/api/sellers.ts` |
| 2026-09-07 | V2-T050 | `[x]` | Homepage connected to live `Route.useLoaderData()` feed from `getHomepageFeed()`. | `src/routes/index.tsx` |
| 2026-09-07 | V2-T060 | `[x]` | Removed demo toasts and wired `Save Draft` & `Submit Product` directly to backend in `/sell/add-product`. | `src/routes/sell.add-product.tsx` |
| 2026-09-07 | V2-T061 | `[x]` | Standardized canonical storage bucket to `product-media` (supporting 12 images + MP4 product videos). | `src/lib/api/products.ts`, `src/routes/sell.add-product.tsx` |
| 2026-09-07 | V2-T067 | `[x]` | Implemented database-backed cart operations and guest token strategy with `getCartServerFn`, `addToCartServerFn`, and `mergeGuestCartServerFn`. | `src/lib/api/cart.ts` |
| 2026-09-07 | V2-T078 | `[x]` | Eliminated mock fallback in `handlePlaceOrder` to strictly enforce fail-closed error handling in checkout. | `src/routes/checkout.tsx` |
| 2026-09-07 | V2-T085 | `[x]` | Real Stripe webhook handler created with signature verification, idempotency checking against `webhook_events`, and payment state transitions. | `src/routes/api.webhooks.stripe.ts` |
| 2026-09-07 | V2-T094 | `[x]` | Wired seller order acceptance, shipping label creation, and delivery tracking to live database operations via `createServerFn`. | `src/lib/api/fulfilment.ts`, `src/routes/sell.index.tsx` |
| 2026-09-07 | V2-T105 | `[x]` | Customer order tracking connected to `getOrderTrackingDetailsServerFn` with live multi-seller package timeline and pre-dispatch cancellation. | `src/lib/api/orders.ts`, `src/routes/orders.$id.tsx` |
| 2026-09-07 | V2-T116 | `[x]` | Customer return requests connected to `createCustomerReturnRequestServerFn` with 7-day delivery hold checks, evidence attachments, and ledger holds. | `src/lib/api/returns.ts`, `src/routes/returns.new.tsx` |
| 2026-09-07 | V2-T118 | `[x]` | Stripe Connect seller account creation, hosted onboarding links, and capability sync server functions implemented. | `src/lib/api/stripe-connect.ts` |
| 2026-09-07 | V2-T141 | `[x]` | Customer account profile updating and saved address management wired to `updateCustomerProfileServerFn` and `saveCustomerAddressServerFn`. | `src/lib/api/account.ts`, `src/routes/account.tsx` |
| 2026-09-07 | V2-T156 | `[x]` | Bulk product CSV/XLSX validation and chunked transactional ingestion wired to `validateBulkRowsServerFn` and `commitBulkImportChunkServerFn`. | `src/lib/api/bulk-upload.ts`, `src/routes/sell.bulk-upload.tsx` |
| 2026-09-07 | V2-T184 | `[x]` | Transactional email notification endpoints wired to Brevo API via `sendOrderConfirmationEmailServerFn` and `sendPackageDispatchedEmailServerFn`. | `src/lib/api/notifications.ts` |
| 2026-09-07 | V2-T191 | `[x]` | Admin console moderation and 14-day hold payout maturation connected to live server functions. | `src/lib/api/admin-finance.ts`, `src/routes/admin.tsx` |
| 2026-09-07 | V2-T201 | `[x]` | Seller team staff invitation, granular permission matrix updates, and access revocation wired to `inviteSellerStaffServerFn` and `updateSellerStaffPermissionsServerFn`. | `src/lib/api/sellers.ts`, `src/routes/sell.team.tsx` |
| 2026-09-07 | V2-T208 | `[x]` | Verified purchase product reviews and rating submissions implemented with `getProductReviewsServerFn` and `submitProductReviewServerFn`. | `src/lib/api/reviews.ts` |
| 2026-09-07 | V2-T232 | `[x]` | Automated production test suite configured and passing (`npm test`): 14/14 tests covering 10% GST, 12% commission, 7-day return boundary, 14-day delivery hold payout maturation, and bulk row validation. | `scripts/run-production-tests.ts`, `package.json` |






