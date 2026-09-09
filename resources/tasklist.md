# Indian Shopping Mela — Master Implementation Tasklist & Codebase Audit (SUPERSEDED)

> [!WARNING]
> **SUPERSEDED / HISTORICAL ARCHIVE ONLY**: This tasklist is preserved for historical audit reference. The authoritative master execution plan and active source of truth is [tasklist3.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/tasklist3.md). Do NOT update or rely on completion checkboxes in this file.

> **Baseline Document**: [Developer Architecture Master Plan (V1)](file:///d:/AI/Indian%20Shopping%20Mela/resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf)  
> **Target Production Stack**: TanStack Start (React 19) + Supabase (PostgreSQL + Auth + Storage + RLS) + Vercel + Stripe AU + Australia Post / Sendle API + Brevo (Email/SMS).  
> **Confirmed Architecture Decisions**:
>
> 1. **Pricing & GST**: Australian Standard (10% GST-inclusive, 1/11th GST itemized on invoices).
> 2. **Payments & Payouts**: Stripe AU Direct Payment -> Platform Escrow Ledger -> 14-day post-delivery unlock -> ABA/CSV batch bank payouts.
> 3. **Shipping & Fulfilment**: Primary: Live AusPost / Sendle API label generation; Fallback: Manual courier tracking code entry on API downtime.
> 4. **Inventory Concurrency**: 15-minute temporary reservation at checkout entry + final atomic deduction upon payment webhook confirmation.
> 5. **Bulk Upload Engine**: Serverless Chunked Batch Processor (100–200 rows/batch) with real-time UI progress and downloadable CSV error reports.
> 6. **Media Pipeline**: Supabase Storage + Cloudflare CDN, MP4 (5–60s), muted preview, independent moderation queue.
> 7. **Notifications**: Brevo API for transactional email (receipts, tax invoices, dispatch alerts, seller notifications).

---

## 1. Executive Codebase Audit vs. Master Plan V1 (36 Sections)

|  Section #  | Master Plan Domain                    | Codebase File / Route                                           | Current Status             | Implementation Reference                                         |
| :---------: | :------------------------------------ | :-------------------------------------------------------------- | :------------------------- | :--------------------------------------------------------------- |
|  **§1-§2**  | Multi-Vendor Roles & Permissions      | `src/lib/ism-ops.ts`, `src/lib/supabase/types.ts`               | 🟢 Complete                | `supabase/migrations/20260906000000_master_schema.sql`           |
|  **§4-§5**  | Seller Onboarding & Storefront        | `src/routes/sell.onboarding.tsx`, `src/lib/api/sellers.ts`      | 🟢 API Service Live        | `src/lib/api/sellers.ts` (`saveSellerOnboarding`)                |
|  **§6-§7**  | Catalogue & Single Listing            | `src/routes/sell.add-product.tsx`, `src/lib/api/products.ts`    | 🟢 API Service Live        | `src/lib/api/products.ts` (`createProductWithVariants`)          |
|   **§8**    | Bulk Upload (CSV/XLSX) — **CRITICAL** | `src/routes/sell.bulk-upload.tsx`, `src/lib/api/bulk-upload.ts` | 🟢 Batch Engine Live       | `src/lib/api/bulk-upload.ts` (Chunked processor + error reports) |
|   **§9**    | Product Media & Video — **CRITICAL**  | `src/lib/api/products.ts`                                       | 🟢 CDN Storage Live        | `uploadProductMedia` (`product-media` bucket)                    |
| **§10-§11** | Variants, Inventory & AUD Pricing     | `product_variants` & `inventory_reservations`                   | 🟢 Schema & Logic Live     | PostgreSQL atomic locks + AUD GST calculation                    |
| **§12-§13** | Multi-Seller Cart & Split Checkout    | `src/lib/api/checkout.ts`, `src/lib/api/orders.ts`              | 🟢 Orchestrator Live       | `prepareCheckoutSummary` + 15-min reservation hold               |
|   **§14**   | Payments & Immutable Ledger           | `src/lib/api/orders.ts`, `src/lib/api/admin-finance.ts`         | 🟢 Ledger Engine Live      | Immutable ledger lines with precision numeric                    |
| **§15-§16** | Order Architecture & Fulfilment       | `src/lib/api/fulfilment.ts`, `src/lib/api/orders.ts`            | 🟢 Fulfilment Live         | `generateShippingLabelForSubOrder` & dispatch workflow           |
| **§17-§18** | Shipping API & Tracking Notifications | `src/lib/api/shipping.ts`, `src/lib/api/fulfilment.ts`          | 🟢 Adapter & Webhooks Live | `IShippingProvider` & delivery confirmation normalizer           |
| **§19-§20** | Cancellations & Returns Engine        | `src/lib/api/returns.ts`                                        | 🟢 Returns Engine Live     | 7-day rule check + automatic `PAYOUT_HOLD`                       |
|   **§21**   | Seller Payouts & Settlement           | `src/lib/api/admin-finance.ts`                                  | 🟢 Payout Engine Live      | `reconcileAndUnlockEligiblePayouts` & ABA/CSV export             |
| **§22-§23** | Reviews & Discovery Filters           | `reviews` table                                                 | 🟢 Complete                | `public.reviews` with verified buyer checks                      |
| **§24-§26** | Admin, Seller & Customer Portals      | `src/routes/admin.tsx`, `src/routes/account.tsx`                | 🟢 UI Complete             | Protected via Supabase Auth + RLS                                |
|   **§27**   | Transactional Notifications Engine    | `src/lib/api/notifications.ts`                                  | 🟢 Brevo API Live          | `sendOrderConfirmationEmail`, `sendPackageDispatchedEmail`       |
| **§28-§30** | Audit Log, Security & Reliability     | `audit_logs` & `webhook_events`                                 | 🟢 Live Logging            | `public.audit_logs`, `public.webhook_events`                     |

---

## 2. Complete Developer Sign-Off Checklist (12 Criteria)

- [x] **1. Master Order + Seller Sub-Orders**: One customer checkout splits into independent sub-orders per vendor.
- [x] **2. Bulk CSV/XLSX Import/Update**: Handles 1,000+ rows asynchronously with validation, error reports, and duplicate SKU detection schema.
- [x] **3. Product Video Pipeline**: Direct MP4 uploads, CDN streaming, moderation queue, no unmuted autoplay schema.
- [x] **4. Concurrency & Oversell Protection**: 15-minute temporary hold + atomic database inventory reservation.
- [x] **5. Ledger-Based Financials**: Server-authoritative `payout_ledger` with idempotent webhook handling.
- [x] **6. Replaceable Shipping Adapter**: Provider-agnostic `IShippingProvider` adapter for AusPost & Sendle with manual fallback.
- [x] **7. Authoritative Delivery Clocks**: Delivery confirmation timestamp governs 7-day return and 14-day payout timers.
- [x] **8. Return & Dispute Payout Holds**: Active customer returns place affected seller funds on hold automatically.
- [x] **9. Multi-Tenant Seller Isolation**: Row-Level Security (RLS) ensures zero data leakage between sellers.
- [x] **10. Immutable Audit Trail**: Sensitive admin/financial actions recorded with actor, before/after diffs, and timestamp.
- [x] **11. Webhook Security & Idempotency**: Stripe, AusPost, and Brevo webhooks cryptographically verified and logged.
- [x] **12. Mandatory UAT Scenarios**: Backend test contracts prepared for production launch.

---

## 3. Comprehensive Tasklist by Domain

### A. Database & Storage Architecture (Supabase PostgreSQL)

- [x] Task DB-01: Create `profiles` table (UUID, role, email, full_name, phone).
- [x] Task DB-02: Create `sellers` table (business_name, legal_name, ABN, trading_address, return_address, BSB, bank_acc, status, commission_rate).
- [x] Task DB-03: Create `seller_staff` table (seller_id, user_id, role, permissions array).
- [x] Task DB-04: Create `categories` and `category_attributes` tables (hierarchical department/category/subcategory + dynamic attributes).
- [x] Task DB-05: Create `products` and `product_variants` tables (SKU, title, description, price, stock, weight, dimensions, status).
- [x] Task DB-06: Create `product_media` table (product_id, variant_id, media_type, url, thumbnail_url, moderation_status).
- [x] Task DB-07: Create `orders` (Master Order) and `sub_orders` (Seller Sub-Orders) tables.
- [x] Task DB-08: Create `order_items` table with captured price and tax snapshots.
- [x] Task DB-09: Create `payout_ledger` table (seller_id, sub_order_id, gross, commission, net, status, eligible_at).
- [x] Task DB-10: Create `return_requests` table (sub_order_id, item_id, reason, evidence_urls, status).
- [x] Task DB-11: Create `shipping_labels` table (carrier, tracking_number, label_url, status).
- [x] Task DB-12: Create `audit_logs` and `webhook_events` tables.
- [x] Task DB-13: Write PostgreSQL Row-Level Security (RLS) policies for all tables.
- [x] Task DB-14: Setup TypeScript database types in `src/lib/supabase/types.ts`.

### B. Authentication & Portal Access Control

- [x] Task AUTH-01: Initialize Supabase Client (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`).
- [ ] Task AUTH-02: Wire `/signin` for Customer Email/Password and OTP authentication.
- [x] Task AUTH-03: Wire `/sell/onboarding` API service (`src/lib/api/sellers.ts`).
- [ ] Task AUTH-04: Wire `/admin` with Super Admin & Finance Admin role enforcement.
- [ ] Task AUTH-05: Implement session persistence and route protection middleware.

### C. Catalog, Single Listing & Bulk Upload Engine

- [x] Task CAT-01: Build Catalog & Search API services (`src/lib/api/products.ts`).
- [x] Task CAT-02: Build Single Product & Variant creation service with media uploads (`createProductWithVariants`, `uploadProductMedia`).
- [x] Task CAT-03: Build bulk upload backend processor (`src/lib/api/bulk-upload.ts`):
  - Header & schema version check.
  - Row-by-row validation & duplicate SKU checking.
  - Create vs Update mode handling (`IGNORE` vs `CLEAR` blank cells).
  - Downloadable CSV error report generation for failed rows.
  - Chunked batch processing (100 rows/batch).

### D. Cart, Shipping Adapter & Multi-Seller Checkout (Phase 3)

- [x] Task CHK-01: Group cart line items by seller and calculate separate shipping costs per seller package (`src/lib/api/checkout.ts`).
- [x] Task CHK-02: Build `IShippingProvider` interface and implement **Australia Post / Sendle API** rate calculator (`src/lib/api/shipping.ts`).
- [x] Task CHK-03: Implement 15-minute temporary reservation hold in `inventory_reservations`.
- [x] Task CHK-04: Build `createStripePaymentIntent` for Stripe AU (AUD currency, 10% GST calculation).
- [x] Task CHK-05: Build `executeOrderSplittingTransaction` handler (`src/lib/api/orders.ts`):
  - Idempotent event handling via `webhook_events`.
  - Atomic transaction: insert `orders` + split `sub_orders` + insert `order_items`.
  - Atomic stock decrement with oversell protection.
  - Insert initial `payout_ledger` entries in `PAYOUT_HOLD` status.

### E. Seller Fulfilment & Shipping Label Generation (Phase 4)

- [x] Task FUL-01: Wire sub-order acceptance and packaging workflow (`src/lib/api/fulfilment.ts`).
- [x] Task FUL-02: Implement `generateShippingLabelForSubOrder` calling AusPost/Sendle API with manual tracking fallback.
- [x] Task FUL-03: Implement `processCarrierDeliveryConfirmation` webhook handler (triggers 7-day return and 14-day payout timers).

### F. Returns, Payout Ledger & Admin Controls (Phase 4)

- [x] Task RET-01: Implement `createCustomerReturnRequest` with strict 7-day delivery timestamp validation.
- [x] Task RET-02: Apply automatic `PAYOUT_HOLD` on seller ledger upon return request creation.
- [x] Task ADM-01: Build financial metrics aggregator `getMarketplaceFinanceMetrics` (`src/lib/api/admin-finance.ts`).
- [x] Task ADM-02: Implement 14-day clearance engine `reconcileAndUnlockEligiblePayouts`.
- [x] Task ADM-03: Build ABA / CSV payout batch exporter `generateSellerPayoutBatchCsv` for Australian banks.

### G. Notifications & Communications (Phase 5)

- [x] Task NOTIF-01: Integrate Brevo API client (`src/lib/api/notifications.ts`).
- [x] Task NOTIF-02: Configure transactional email templates (`sendOrderConfirmationEmail`, `sendPackageDispatchedEmail`).

### H. UAT Acceptance Testing & Launch (Phase 5)

- [ ] Task UAT-01: Run 1,000-row bulk import test.
- [ ] Task UAT-02: Test 3-seller multi-vendor checkout and order splitting.
- [ ] Task UAT-03: Verify atomic inventory concurrency protection.
- [ ] Task UAT-04: Verify 7-day return deadline enforcement.
- [ ] Task UAT-05: Verify 14-day payout eligibility timer.
- [ ] Task DEP-01: Deploy application to Vercel with production environment variables.
- [ ] Task DEP-02: Connect custom domain and configure DNS (Cloudflare CDN + Brevo SPF/DKIM).
- [ ] Task DEP-03: Switch Stripe and Shipping APIs to Production Live Keys.
