# Indian Shopping Mela — Comprehensive Project Roadmap

> **Source of Truth**: [Developer Architecture Master Plan (V1)](file:///d:/AI/Indian%20Shopping%20Mela/resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf)  
> **Detailed Tasklist**: [resources/tasklist.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/tasklist.md)  
> **Phase Execution Plan**: [resources/phase.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/phase.md)  
> **Target Production Stack**: TanStack Start (React 19) + Supabase (PostgreSQL + Auth + Storage + RLS) + Vercel + Stripe AU + Australia Post / Sendle API + Brevo (Email/SMS).

---

## 1. Subsystem Status & Delivery Schedule

| Domain | Prototype UI Status | Backend & Integration Roadmap Status | Target Launch Day |
| :--- | :--- | :--- | :---: |
| **1. System Foundations & DB** | 🟢 Complete | 🔄 Ready for Supabase Schema & RLS deployment | Day 1–2 |
| **2. Auth & Portals** | 🟢 Complete | 🔄 Supabase Auth + Discrete portal guards (`/signin`, `/sell`, `/admin`) | Day 2 |
| **3. Catalog & Search** | 🟢 Complete | 🔄 Postgres Full-Text Search + Media CDN Storage | Day 3 |
| **4. Bulk Ingestion (CSV/XLSX)** | 🟢 Complete | 🔄 Serverless Chunked Batch Processor (100–200 rows/batch, 1,000+ total) | Day 4 |
| **5. Shipping API (AusPost/Sendle)**| 🟡 Adapter UI ready | 🔄 Live Rates, PDF Label Generation + Manual fallback on downtime | Day 5 |
| **6. Stripe Payments & Orders** | 🟢 Complete | 🔄 15-min hold + PaymentIntent + Atomic Multi-Seller Sub-Order Splitting | Day 5–6 |
| **7. Seller Fulfilment** | 🟢 Complete | 🔄 Courier Label Generation & Real-Time Tracking Webhooks | Day 6 |
| **8. Returns & 14-day Ledger** | 🟢 Complete | 🔄 7-day rule engine & Escrow Payouts (14-day post-delivery unlock) | Day 7–8 |
| **9. Brevo Email/SMS Engine** | 🟡 UI mock logs | 🔄 Live Brevo Transactional Email & Tax Invoicing (10% GST itemized) | Day 8–9 |
| **10. UAT & Production Launch** | 🟢 Ready | 🔄 8 UAT Scenarios, Domain/DNS Verification & Vercel Production | Day 9–10 |

---

## 2. Master Guardrails & Architecture Rules (From Master Plan V1)

1. **True Multi-Vendor Marketplace**: Every seller has an independent store identity, product catalog, sub-order fulfilment queue, and isolated financial ledger.
2. **Immutable Financial Ledger**: Historical seller settlements are never computed from current product prices or current commission percentages. Every financial record is stored as an immutable ledger transaction.
3. **No Negative Inventory**: All checkout purchases use a **15-minute temporary reservation hold** followed by **atomic database locking** at payment confirmation to prevent race-condition overselling.
4. **Authoritative Delivery Clocks**: Delivery confirmation timestamp starts the **7-day return clock** and **14-day seller payout eligibility timer**.
5. **No Data Leakage**: Row-Level Security (RLS) guarantees that sellers can never access another seller's customer details, commercial metrics, or order data.
6. **No Phantom Imports**: Bulk uploads never silently import malformed data; invalid rows produce downloadable CSV error reports.
7. **Safe Video Pipeline**: Product videos (5–60s) must be validated, served via CDN, and support moderation without breaking the frontend player.
8. **Replaceable Carrier Adapter**: Australia Post and Sendle APIs sit behind an `IShippingProvider` adapter, with manual tracking number entry fallback.
9. **Tax Compliance**: 10% Australian GST is included in retail product pricing and itemized (1/11th) on tax invoices along with the Marketplace ABN.

---

## 3. Post-Launch Roadmap (Phase 2)

- [ ] Automated Shopify / WooCommerce product catalog sync.
- [ ] Direct seller API feeds.
- [ ] Sponsored products & boosted marketplace listings.
- [ ] Marketplace digital wallet & gift card system.
- [ ] Same-day local delivery integrations in Sydney & Melbourne.
- [ ] Advanced AI description and category tag mapping.
- [ ] Native Mobile App (iOS / Android) powered by the core TanStack API.
