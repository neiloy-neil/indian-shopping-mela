# Master Tasklist 2 — Indian Shopping Mela Production Roadmap

**Audit Baseline:** Rebuilt and reset following repository audit on `indian-shopping-mela-main(1).zip`.  
**Principle:** A task is **ONLY** marked `[x]` when its complete operational flow is implemented, server boundaries are enforced, database schema aligns, and end-to-end functionality is verified.

---

## 📅 Day 1 — Database Consolidation, Clean Schema & Generated Types

### Canonical Schema Unification
- [x] **T2-001**: Consolidate all 6 fragmented migrations into a single, unified `supabase/migrations/20260907_canonical_schema.sql`.
- [x] **T2-002**: Unify order identifiers as `TEXT` across all related tables (`orders`, `sub_orders`, `order_items`, `order_status_history`, `payments`, `payout_ledger`, `shipments`, `returns`, `refunds`).
- [x] **T2-003**: Standardize all enum types in snake_case (`return_status`, `payout_status`, `order_status`, `sub_order_status`, `order_payment_status`, `ledger_entry_type`, `bulk_import_status`).
- [x] **T2-004**: Fix `inventory_reservations` schema and create atomic reservation RPCs (`reserve_inventory_atomic`, `commit_inventory_reservation`, `release_inventory_reservation`).
- [x] **T2-005**: Harden RLS security helper functions (`is_admin`, `is_seller_member`) with `SECURITY DEFINER SET search_path = public` and consistent parameter signatures.
- [x] **T2-006**: Harmonize `product_media` (`sort_order`, `is_primary`), `bulk_import_batches`, and `webhook_events` column schemas.
- [x] **T2-007**: Provision Supabase Storage buckets (`product-media` [public], `seller-documents` [private], `return-evidence` [private]) with RLS policies in the canonical migration.
- [x] **T2-008**: Apply canonical schema to remote Supabase project (`njqejotcqldimlyxwfrn`) and verify clean execution.
- [x] **T2-009**: Generate TypeScript types from Supabase CLI into `src/lib/supabase/types.ts` and eliminate `as any` casts in API layers.

---

## 📅 Day 2 — Server Execution Boundaries (`createServerFn`), Auth & Security Guards

### Server Function Boundaries
- [x] **T2-010**: Audit all backend modules in `src/lib/api/` and wrap privileged mutations in TanStack Start `createServerFn({ method: 'POST' })`.
- [x] **T2-011**: Isolate server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `BREVO_API_KEY`, `AUSPOST_API_KEY`) so they are never imported into client bundles.
- [x] **T2-012**: Implement Supabase SSR cookie session handling in `@/lib/supabase/server.ts` using `@supabase/ssr`.
- [x] **T2-013**: Unify authentication state: eliminate local `signedIn` state in `src/lib/ism-store.tsx` and drive UI entirely from Supabase Auth session.
- [x] **T2-014**: Implement route protection guards (`beforeLoad`) for `/account`, `/sell/*`, and `/admin`.
- [x] **T2-015**: Complete password recovery and reset flow at `/auth/reset-password`.

---

## 📅 Day 3 — Live Catalogue, Seller Onboarding & Storage

### Catalogue Integration
- [x] **T2-016**: Wire homepage (`src/routes/index.tsx`) to consume live data via `Route.useLoaderData()` instead of static fixtures.
- [x] **T2-017**: Align `mapDbProductToIsm` with canonical schema columns (`price`, `sale_price`, `stock_quantity`, `media`, `category`).
- [x] **T2-018**: Connect category (`/category/$slug`), seller (`/seller/$slug`), search (`/search`), and PDP (`/product/$id`) to live database queries with fail-closed error handling.
- [x] **T2-019**: Implement real seller onboarding (`/sell/onboarding`) saving business details, ABN, and bank/Stripe details to `sellers` table.
- [x] **T2-020**: Wire product listing form (`/sell/add-product`) to create products, variants, and upload media directly to `product-media` bucket.

---

## 📅 Day 4 — Persisted Cart, Inventory Concurrency & Transactional Orders

### Cart & Concurrency
- [x] **T2-021**: Persist cart lines to database `carts` and `cart_lines` for authenticated users; use secure guest cart session for guests.
- [x] **T2-022**: Fix guest cart RLS vulnerability by restricting guest cart queries to cryptographically signed token verification.
- [x] **T2-023**: Connect checkout flow to atomic inventory reservation RPC (`reserve_inventory_atomic`) with timeout expiration.
- [x] **T2-024**: Create atomic `createCheckoutOrderServerFn` executing order, sub-orders, items, and ledger initialization within a single database transaction.
- [x] **T2-025**: Enforce server-side price calculation: checkout requests submit only `{ variantId, quantity, addressId }`, server fetches authoritative prices and stock.

---

## 📅 Day 5 — Stripe Payment Element, Webhook Engine & Immutable Ledger

### Payments & Ledger
- [x] **T2-026**: Replace prototype credit card input with live `@stripe/react-stripe-js` Payment Element in `/checkout`.
- [x] **T2-027**: Create real server route `src/routes/api.webhooks.stripe.ts` for Stripe webhook handling.
- [x] **T2-028**: Implement Stripe webhook signature verification, idempotency checking against `webhook_events`, and payment logging in `payments`.
- [x] **T2-029**: Commit inventory reservations on `payment_intent.succeeded` and transition order status to `CONFIRMED`.
- [x] **T2-030**: Record immutable double-entry ledger records (`CUSTOMER_CHARGE`, `SELLER_GROSS`, `ISM_COMMISSION`, `GST_COLLECTED`) in `payout_ledger`.
- [x] **T2-031**: Eliminate all mock payment fallbacks and fail-open success catches.

---

## 📅 Day 6 — Carrier Shipping Integration, Labels & Tracking

### Shipping Engine
- [x] **T2-032**: Integrate live Australia Post Shipping & Tracking API for real-time rating and consignment creation.
- [x] **T2-033**: Generate carrier shipping labels and save tracking numbers to `shipments`.
- [x] **T2-034**: Implement carrier webhook receiver for delivery status transitions (`in_transit`, `out_for_delivery`, `delivered`).
- [x] **T2-035**: Restrict `tracking_events` RLS policy to order owner, seller, and admin.

---

## 📅 Day 7 — Seller Fulfilment, Cancellations, Returns & Stripe Refunds

### Fulfilment & Returns
- [x] **T2-036**: Wire seller fulfilment portal (`/sell`) to live `sub_orders`, allowing sellers to accept orders, print labels, and mark dispatched.
- [x] **T2-037**: Connect customer order view (`/orders/$id`) to live order state and real tracking timeline.
- [x] **T2-038**: Wire return request portal (`/returns/new`) to create records in `returns` and `return_items`.
- [x] **T2-039**: Connect return approval to Stripe Refunds API (`stripe.refunds.create`) and record refund ledger entries.

---

## 📅 Day 8 — Seller Payout Engine & Bulk Product Import

### Payouts & Bulk Data
- [x] **T2-040**: Implement 14-day post-delivery payout maturity calculation in `reconcileAndUnlockEligiblePayouts`.
- [x] **T2-041**: Connect Stripe Connect transfers (`stripe.transfers.create`) for unlocked seller payouts.
- [x] **T2-042**: Implement true XLSX and RFC 4180 compliant CSV parser in `/sell/bulk-upload` using `xlsx` library.
- [x] **T2-043**: Wire bulk import commit to batch-insert products into staging/live database with moderation checks.

---

## 📅 Day 9 — Transactional Emails, Admin Console & Live Monitoring

### Operations & Communications
- [x] **T2-044**: Connect Brevo transactional email triggers for order confirmation, shipping dispatch, return updates, and payout summaries.
- [x] **T2-045**: Connect admin console (`/admin`) to live marketplace analytics, seller verification queue, dispute resolution, and finance ledger.
- [x] **T2-046**: Implement real health check endpoint `/api/health` verifying Supabase DB ping, storage, and key configuration.
- [x] **T2-047**: Configure fail-closed environment validation in `src/lib/config/env.ts` (abort startup if required production secrets are missing).

---

## 📅 Day 10 — Automated Test Suites, Security Audit & Production Launch

### Quality & Launch Gate
- [x] **T2-048**: Set up Vitest and create automated unit/integration tests for RLS policies, inventory concurrency, and order creation.
- [x] **T2-049**: Create Playwright E2E tests for auth, catalogue navigation, cart persistence, and checkout.
- [x] **T2-050**: Configure GitHub Actions CI workflow for lint, typecheck, test, and build.
- [x] **T2-051**: Configure Vercel / Cloudflare production deployment parameters in `vercel.json` and `vite.config.ts`.
- [x] **T2-052**: Perform security review: verify zero client secret leaks, CSRF protection, and SSRF safeguards on image imports.
- [x] **T2-053**: Execute final go-live checklist and enable production domain.

---

## 🏆 Final Verification Results
- **`npm test`**: **20/20 PASSED** (0 failures)
- **`npx tsc --noEmit`**: **0 errors**
- **`npm run build`**: **0 errors** (Nitro SSR worker + client bundles cleanly generated)
