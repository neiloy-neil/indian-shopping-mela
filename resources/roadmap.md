# Indian Shopping Mela — Master Delivery Roadmap V2

> **Source of Truth**: [Developer Architecture Master Plan (V1)](file:///d:/AI/Indian%20Shopping%20Mela/resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf)  
> **Master Tasklist**: [resources/tasklist3.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/tasklist3.md) _(tasklist2.md is superseded history — do not trust its completion counts)_  
> **Target Production Stack**: TanStack Start (React 19) + Supabase (PostgreSQL + Auth + Storage + RLS) + Vercel / Cloudflare Nitro + Stripe AU (AUD) + Australia Post / Sendle API + Brevo (Email/SMS).

---

## 1. 10-Day Production Recovery Schedule

| Day        | Milestone Focus                    | Deliverables & Verification Gates                                                                                                                                                        |    Status    |
| :--------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------: |
| **Day 1**  | **Database Consolidation & Types** | Consolidated canonical migration `20260907_canonical_schema.sql`, standardized `TEXT` order IDs, snake_case enums, atomic inventory RPCs, storage buckets, and generated database types. | 🟢 Completed |
| **Day 2**  | **Server Boundaries & Auth**       | TanStack `createServerFn` execution boundary, Supabase SSR cookie auth, elimination of client `signedIn` state, route guards (`/account`, `/sell/*`, `/admin`), password reset.          | 🟢 Completed |
| **Day 3**  | **Live Catalogue & Onboarding**    | Live homepage/category/search/PDP loaders, dynamic category attributes, real seller onboarding DB writes, Storage bucket uploads (`product-media`).                                      | 🟢 Completed |
| **Day 4**  | **Cart & Inventory Concurrency**   | Server-persisted cart, secure guest cart token verification, atomic 15-min reservation RPC (`reserve_inventory_atomic`), transactional order creation.                                   | 🟢 Completed |
| **Day 5**  | **Stripe Payments & Ledger**       | Stripe Elements embedded UI, `/api/webhooks/stripe` signature verification & idempotency, reservation commitment, immutable double-entry `payout_ledger`.                                | 🟢 Completed |
| **Day 6**  | **Shipping Integration**           | Australia Post & Sendle live rating, parcel consignment creation, carrier tracking webhooks, restricted `tracking_events` RLS.                                                           | 🟢 Completed |
| **Day 7**  | **Fulfilment, Returns & Refunds**  | Seller sub-order fulfilment queue, customer `/orders/$id` timeline, 7-day ACL return portal (`/returns/new`), Stripe refund execution.                                                   | 🟢 Completed |
| **Day 8**  | **Payouts & Bulk Upload**          | 14-day delivery hold payout maturation, Stripe Connect transfers, RFC 4180 CSV / XLSX parsing and transactional chunked product import.                                                  | 🟢 Completed |
| **Day 9**  | **Emails, Admin & Monitoring**     | Brevo transactional email triggers (Order, Shipped, Return, Payout), live Admin governance console, `/api/health` live checks, fail-closed env validation.                               | 🟢 Completed |
| **Day 10** | **Testing, Security & Go-Live**    | Production test suite (14/14 passed), TypeScript strict check (0 errors), GitHub Actions CI workflow, security headers (CSP/HSTS/nosniff), Nitro SSR build (0 errors).                   | 🟢 Completed |

---

## 2. Core Architecture Rules & Invariants

1. **Multi-Vendor Isolation**: Each vendor has an isolated store profile, product catalogue, sub-order dispatch queue, and independent ledger balances protected by RLS.
2. **Immutable Double-Entry Ledger**: All platform commissions, seller gross revenues, customer charges, refunds, and payouts are stored as permanent, immutable ledger records in `payout_ledger`.
3. **Fail-Closed & Concurrency-Safe**: Inventory is held via a 15-minute temporary reservation with row-level locking (`FOR UPDATE`). Payment confirmation atomically commits stock and transitions status. No fake order confirmations or mock fallbacks are permitted in production.
4. **Authoritative Delivery Clocks**: Courier webhook delivery confirmation sets `delivered_at`, initiating the **7-day statutory return window** and the **14-day seller settlement hold**.
5. **Tax & Legal Compliance (Australia)**: 10% Australian GST is calculated on gross sales (1/11th) and itemized on tax invoices with the registered Australian Business Number (ABN).
