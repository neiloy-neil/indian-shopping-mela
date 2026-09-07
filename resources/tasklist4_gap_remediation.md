# Indian Shopping Mela — Master Gap Remediation Runbook V4
**Comprehensive Audit & Remediation Plan against Developer Architecture Master Plan V1 & Tasklist 3**

**Audit Date:** September 2026  
**Document Source:** `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`  
**Baseline Runbook:** `resources/tasklist3.md`  
**Repository State:** Lovable-connected full-stack TanStack Start application on Supabase & Stripe AU  

---

## Executive Summary of Audit Findings

| Domain Area | Master Plan Spec (PDF) | Current Codebase State | Status | Primary Remediation Target |
|---|---|---|---|---|
| **1. Database Schema & Migration** | Unified canonical schema, 41 tables, atomic RPCs, strict RLS | `20260907_canonical_schema.sql` active with 41 tables, legacy isolated. `check-canonical-schema.ts` passes 100%. | **PASS** | Apply and verify on live Supabase staging instance. |
| **2. Cart & Guest Persistence** | DB-backed carts (`carts`, `cart_lines`) with guest session token, merge on auth | Client React context (`ism-store.tsx`) uses LocalStorage. Server cart functions exist in `api/cart.ts` but are not wired into UI components. | **GAP** | Wire `useIsm()` store to call `getCartServerFn`, `addToCartServerFn`, `mergeGuestCartServerFn`. |
| **3. Checkout & Zero-Trust Stripe** | Zero-trust server calculation, Stripe Payment Element (`@stripe/react-stripe-js`), atomic stock hold | `routes/checkout.tsx` uses custom card inputs and calls checkout with client-supplied values. | **GAP** | Mount Stripe Payment Element, pass only `{ variantId, qty, addressId }`, call server calculations. |
| **4. Bulk Product Upload & Stock** | Real CSV & XLSX parsing, 1,000+ rows, preview, validation, chunked DB commit, batch history | `routes/sell.bulk-upload.tsx` and `sell.bulk-stock.tsx` use static fixtures for preview/history; `handleCommitImport` lacks DB mutation. | **GAP** | Integrate `sheetjs`/`xlsx` for real Excel/CSV binary parsing; wire `commitBulkImportChunkServerFn` and live stock updates. |
| **5. Product Video Pipeline** | MP4/H.264 upload (5-60s, max 100MB), moderation status (`pending`, `approved`, `rejected`), muted player | Direct Supabase storage upload exists in `sell.add-product.tsx` but lacks duration/size validation and moderation workflow. | **GAP** | Add video file duration validator, store video metadata in `product_media`, wire admin video moderation tab. |
| **6. Multi-Seller Fulfilment** | Seller sub-orders, AusPost/Sendle shipping labels, tracking webhook updates, dispatch deadlines | Scaffolding in `api/fulfilment.ts` and `api/shipping.ts`; `routes/sell.index.tsx` contains static fallback metrics and mock orders. | **GAP** | Wire `routes/sell.index.tsx` sub-order queries and live label downloads to real database tables. |
| **7. Returns & Statutory Rights** | 7-day change of mind, statutory defect exemption, partial item returns, photo evidence, payout hold | `api/returns.ts` contains core logic; `routes/returns.new.tsx` requires live order-item selection and evidence upload to `return-evidence`. | **GAP** | Connect return form to real user order items and attach evidence URLs to `return_requests`. |
| **8. Double-Entry Payouts** | 14-day delivery hold, Stripe Connect transfers, ledger immutability, failed retry, payout statements | Calculations and test assertions pass; `routes/admin.tsx` and `api/admin-finance.ts` need live Stripe Connect Transfer execution. | **GAP** | Wire `stripe.transfers.create` in `reconcileAndUnlockEligiblePayoutsServerFn` with `payouts` records. |
| **9. Admin Console Live Wiring** | Live GMV, sellers, products, categories, orders, returns, finance, audit log, config | `routes/admin.tsx` renders static constants from `lib/ism-ops.ts` across all 18 tabs. | **GAP** | Connect each admin section (Sellers, Products, Orders, Returns, Finance) to live TanStack server queries. |
| **10. Reviews & Trust** | Verified purchase check, 1-5 star ratings, moderation queue, separate seller/product ratings | `api/reviews.ts` and schema exist; `routes/product.$id.tsx` needs review submission form and verified review list. | **GAP** | Wire `<ProductReviews />` component to `getProductReviewsServerFn` and `submitProductReviewServerFn`. |

---

# Detailed Gap Remediation Tasklist (Phase-by-Phase)

```
===================================================================================
STATUS LEGEND:
[ ] = Not started / Gap identified
[~] = Partially wired / Scaffolding exists
[x] = Verified complete end-to-end
===================================================================================
```

---

## Phase 1 — Database Staging Sync & Type Safety

- [x] **GAP-01: Canonical Schema Verification**
  - Verify `supabase/migrations/20260907_canonical_schema.sql` contains all 41 tables, enums, RPCs, and buckets.
  - Verification: `scripts/check-canonical-schema.ts` exits 0.

- [ ] **GAP-02: Live Supabase Staging Migration Execution**
  - Apply `20260907_canonical_schema.sql` to live Supabase staging project.
  - Run `supabase/seed.sql` to populate canonical departments, categories, attributes, and marketplace config.
  - **Acceptance:** Zero SQL errors; live database tables match generated types.

- [ ] **GAP-03: Eliminate Untyped Query Access in Catalog Service**
  - Refactor `src/lib/api/catalogue.ts` (`mapDbProductToIsm`) to use exact canonical column names (`price_aud_cents`, `stock_quantity`, `rating_average`, `rating_count`, `product_media`).
  - Remove fallback static fixtures when live database connection is active.
  - **Acceptance:** Live products fetched from Supabase display with accurate prices, stock, and images.

---

## Phase 2 — Cart & Guest-to-User State Persistence

- [ ] **GAP-04: Guest Session Token Management**
  - Generate a secure UUID `guest_token` in cookies/localStorage on first visit.
  - Ensure guest carts persist in `public.carts` with `guest_token` and line items in `public.cart_lines`.
  - **Acceptance:** Guest can add items to cart, refresh page, and cart contents remain intact from DB.

- [ ] **GAP-05: Wire `IsmProvider` to Server Cart Functions**
  - Update `src/lib/ism-store.tsx` to invoke `getCartServerFn`, `addToCartServerFn`, `updateCartQtyServerFn`, and `removeFromCartServerFn`.
  - Wire `mergeGuestCartServerFn` upon successful customer login in `src/routes/signin.tsx`.
  - **Acceptance:** Adding an item from PDP immediately creates/updates `cart_lines` in Supabase.

---

## Phase 3 — Zero-Trust Checkout & Stripe Payment Element

- [ ] **GAP-06: Zero-Trust Server Checkout Preparation**
  - Refactor `src/routes/checkout.tsx` to send only `{ items: [{ variantId, quantity }], shippingAddress, idempotencyKey }` to `prepareCheckoutSummaryServerFn`.
  - Server authoritatively fetches prices from `product_variants`, calculates 1/11th GST, computes 12% commission, and reserves inventory for 15 minutes via `reserve_inventory_atomic`.
  - **Acceptance:** Manipulating client price or stock has zero effect on the checkout calculation.

- [ ] **GAP-07: Integrate Stripe Payment Element in Checkout UI**
  - Install `@stripe/react-stripe-js` and initialize Stripe Elements using `clientSecret` returned from `prepareCheckoutSummaryServerFn`.
  - Mount `<PaymentElement />` in Step 3 (Payment) of `src/routes/checkout.tsx`.
  - Use `stripe.confirmPayment()` on order submission; listen for `payment_intent.succeeded` in `src/routes/api.webhooks.stripe.ts`.
  - **Acceptance:** Real card, Apple Pay, and Google Pay flows succeed; raw card text inputs are completely removed.

---

## Phase 4 — Bulk Product Upload & Bulk Stock Real Engine

- [ ] **GAP-08: Real CSV/XLSX Binary Parsing (SheetJS)**
  - Integrate `xlsx` / `papaparse` parser in `src/lib/api/bulk-upload.ts` to parse uploaded `.csv` and `.xlsx` files into structured row objects.
  - Provide real `.xlsx` and `.csv` template downloads with dropdown category validation and column headers.
  - **Acceptance:** Uploading a real Excel `.xlsx` file with 500+ rows parses correctly in under 2 seconds.

- [ ] **GAP-09: Live Import Batch Persistence & Error Report**
  - Wire `handleCommitImport` in `src/routes/sell.bulk-upload.tsx` to call `commitBulkImportChunkServerFn`.
  - Insert import batch metadata into `public.bulk_import_batches` and failed rows into `public.bulk_import_rows`.
  - Enable downloading real error CSV generated from actual failed rows.
  - **Acceptance:** Valid listings immediately appear in the seller's active catalog in the database.

- [ ] **GAP-10: Live Bulk Stock Adjustments**
  - Wire `handleSaveStockChanges` in `src/routes/sell.bulk-stock.tsx` to batch-update `product_variants.stock_quantity` and record `inventory_transactions` (`MANUAL_ADJUSTMENT`).
  - **Acceptance:** Modifying stock in bulk stock screen persists to Supabase and updates available quantities.

---

## Phase 5 — Product Media & Video Pipeline

- [ ] **GAP-11: Product Video Upload & Format Validation**
  - In `src/routes/sell.add-product.tsx`, enforce client-side and server-side video validation: MP4/H.264 format, maximum duration 60 seconds, maximum file size 100MB.
  - Upload video to `product-media` bucket and save record in `public.product_media` with `media_type: 'video'`, `status: 'pending'`.
  - **Acceptance:** Uploading an invalid video (>100MB or >60s) fails with a clear validation error.

- [ ] **GAP-12: Video Playback & Muted Preview on Product Detail Page**
  - In `src/routes/product.$id.tsx`, render video player when `product_media` has an approved video.
  - Default video to muted with visible play/pause controls; never autoplay with sound.
  - **Acceptance:** Customers can toggle between photos and video smoothly on desktop and mobile.

---

## Phase 6 — Multi-Seller Fulfilment & Shipping Tracking

- [ ] **GAP-13: Live Seller Fulfilment Dashboard**
  - Update `src/routes/sell.index.tsx` to query live `public.sub_orders` and `public.order_items` for the authenticated seller.
  - Wire actions: Accept Order (`SELLER_ACCEPTED`), Mark Ready to Ship (`READY_TO_SHIP`), Download Label (`generateShippingLabelServerFn`).
  - **Acceptance:** Sub-orders transition through valid states; Australia Post test label PDF is generated and downloadable.

- [ ] **GAP-14: Order Tracking & Customer View**
  - Update `src/routes/orders.$id.tsx` to query live `public.orders`, `public.sub_orders`, `public.shipments`, and `public.tracking_events`.
  - Display live carrier tracking milestones (Label Created → Picked Up → In Transit → Delivered).
  - **Acceptance:** Customer can view tracking events and cancel unpaid/unfulfilled sub-orders.

---

## Phase 7 — Customer Returns & ACL Statutory Protections

- [ ] **GAP-15: Live Return Request Submission**
  - In `src/routes/returns.new.tsx`, fetch customer's delivered order items from `public.order_items`.
  - Enforce 7-day change-of-mind validation while allowing statutory defect claims beyond 7 days per Australian Consumer Law.
  - Upload return photos to private `return-evidence` bucket and persist to `public.return_requests` and `public.return_items`.
  - **Acceptance:** Submitting a return places the corresponding seller sub-order ledger entry on `PAYOUT_HOLD`.

---

## Phase 8 — Financial Settlements & Stripe Connect Payouts

- [ ] **GAP-16: Automated 14-Day Payout Maturation & Stripe Transfers**
  - In `src/lib/api/admin-finance.ts`, implement `executeSellerStripePayoutServerFn` utilizing `stripe.transfers.create({ amount, currency: 'aud', destination: sellerStripeAccountId })`.
  - Update `payout_ledger` / `ledger_entries` to mark entries `PAID_TO_SELLER` and insert `public.payouts` records.
  - Prevent transfers if seller has active disputes or return holds.
  - **Acceptance:** Payout transfer executes idempotently; duplicate trigger does not double-pay.

---

## Phase 9 — Admin Console Live Data Wiring

- [ ] **GAP-17: Wire Live Admin Sections**
  - In `src/routes/admin.tsx`, replace static fixtures with live server functions:
    - **Sellers Tab:** Query `public.sellers`, wire Approve/Reject/Suspend actions.
    - **Products Tab:** Query `public.products`, wire Live/Reject/Moderate Video actions.
    - **Orders Tab:** Query `public.orders` and `public.sub_orders` with status filters.
    - **Returns Tab:** Query `public.return_requests`, wire Approve Return / Issue Refund actions.
    - **Finance Tab:** Query `public.ledger_entries` and `public.payouts`, wire Payout Release action.
    - **Audit Log:** Query `public.audit_logs` with actor and timestamp search.
  - **Acceptance:** All 18 admin navigation tabs reflect real database state and mutate records authoritatively.

---

## Phase 10 — Verified Reviews & Social Trust

- [ ] **GAP-18: Verified Purchase Product Reviews**
  - In `src/routes/product.$id.tsx`, add `<ProductReviews />` component.
  - Fetch approved reviews via `getProductReviewsServerFn`.
  - Provide review submission modal calling `submitProductReviewServerFn` (verified against `order_items` ownership).
  - **Acceptance:** Only authenticated customers who purchased the product can submit verified reviews.

---

# Verification Plan for Remediated Tasks

### 1. Automated Test Suite
- Run `npm test` after each phase:
  - Canonical Schema integrity (41 tables, 3 RPCs, 3 buckets)
  - 10% Australian GST & 12% commission arithmetic
  - 7-day return window & ACL statutory bypass
  - 14-day post-delivery payout hold maturation
  - Bulk import row validation (missing SKU, duplicate SKU, invalid price)
  - Seller onboarding state machine

### 2. Strict Type Safety & Clean Build
- Run `npx tsc --noEmit` (Must pass with 0 errors).
- Run `npm run build` (Must compile Nitro SSR and client bundles cleanly with zero secret leakage).
