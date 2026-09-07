# Indian Shopping Mela — Master Roadmap & Technical Baseline

> **Master Plan Reference**: [Developer Architecture Master Plan (V1)](file:///C:/Users/USER/Downloads/gmmg/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf)  
> **Master Documentation in `/resources/`**:
> - 📋 **Full Tasklist & Audit**: [resources/tasklist.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/tasklist.md)
> - ⏱️ **Phased 5–10 Day Delivery Plan**: [resources/phase.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/phase.md)
> - 🗺️ **Comprehensive Roadmap**: [resources/roadmap.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/roadmap.md)

---

## 1. Project Overview & Current Readiness

The frontend is **100% built and styled** with all screens, states, and client logic representing the intended production behavior.

The backend implementation follows the **Supabase + Vercel + Stripe AU + AusPost/Sendle + Brevo** architecture to achieve full production go-live within **5–10 days**.

---

## 2. The 12 Mandatory Developer Sign-Off Rules (Master Plan V1)

1. **Master Order + Seller Sub-Orders**: One customer checkout; backend splits into independent seller sub-orders (`ISM10001-A`, `ISM10001-B`).
2. **Bulk CSV/XLSX Upload**: 1,000+ row asynchronous import, row-by-row error report, create & update modes.
3. **Product Video Support**: MP4/H.264 validation, CDN streaming, moderation queue, no unmuted autoplay.
4. **Atomic Inventory Reservation**: Server-authoritative concurrency control preventing negative inventory.
5. **Ledger-Based Payouts**: Immutable `payout_ledger` entries with idempotent webhook handling.
6. **Replaceable Shipping Adapter**: Provider-agnostic adapter for Australia Post & Sendle API.
7. **Authoritative Delivery Timestamps**: Delivery event drives 7-day return and 14-day payout clocks.
8. **Return & Dispute Payout Holds**: Active returns hold affected seller funds automatically.
9. **Role-Based Isolation (RLS)**: Row-Level Security ensuring zero data leakage between sellers.
10. **Immutable Audit Trail**: All financial and admin mutations logged with actor and timestamp.
11. **Webhook Security**: All external webhooks (Stripe, Shipping, Brevo) signature-verified and idempotent.
12. **Mandatory Acceptance Testing**: 8 end-to-end UAT scenarios proven before production deployment.

---

## 3. High-Level 5–10 Day Phase Timeline

- **Phase 1 (Days 1–2)**: Supabase PostgreSQL Schema, RLS Policies, Supabase Auth & Storage.
- **Phase 2 (Days 3–4)**: Seller Onboarding, Catalog CRUD & Bulk Upload Worker (CSV/XLSX).
- **Phase 3 (Days 5–6)**: Australia Post/Sendle Shipping Adapter, Stripe Checkout & Sub-Order Splitting.
- **Phase 4 (Days 7–8)**: Seller Fulfilment (PDF Labels), Returns Engine (7-day rule) & Financial Ledger.
- **Phase 5 (Days 9–10)**: Brevo Transactional Notifications, 8 UAT Scenarios, Vercel Production Deploy.

For granular tasks and sub-tasks, refer to [resources/tasklist.md](file:///d:/AI/Indian%20Shopping%20Mela/resources/tasklist.md).
