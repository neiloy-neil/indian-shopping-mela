<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AGENTS.md — Indian Shopping Mela AI & Developer Guidelines

This repository contains the full-stack codebase for **Indian Shopping Mela (ISM)**, a multi-vendor e-commerce marketplace tailored for the Australian market (AUD currency, 10% GST, ACL 7-day return compliance, Australia Post/Sendle shipping, and Stripe AU payments).

---

## 1. Non-Negotiable Core Rules

1. **Frozen UI Baseline**: The frontend UI design and route structure are frozen. Do not alter styling, layouts, or visual components unless explicitly required to wire live data or fix broken UI flows.
2. **True Server Boundaries (`createServerFn`)**:
   - Never import `supabaseAdmin`, `Stripe`, `BREVO_API_KEY`, `AUSPOST_API_KEY`, or any server-only secrets into React components or client-facing route files.
   - All privileged database mutations, payment processing, inventory reservations, and administrative operations must be encapsulated in TanStack Start `createServerFn` server functions.
3. **Zero Trust for Client Calculations**:
   - Never trust client-supplied prices, seller IDs, commissions, stock levels, shipping costs, or tax totals.
   - Checkout actions must only accept `{ variantId, quantity, addressId, idempotencyKey }`; the server authoritatively fetches prices, checks live stock, and computes 1/11th GST and shipping.
4. **Fail-Closed Principle**:
   - Never use mock success, offline fallback data, or display "Order confirmed!" upon database or payment failure.
   - Production errors must fail closed and provide meaningful error handling.
5. **Atomic Inventory Locking**:
   - Checkout uses a 15-minute temporary reservation via `reserve_inventory_atomic()` followed by atomic row-level locking (`FOR UPDATE`) on payment confirmation (`commit_inventory_reservation()`).
6. **Immutable Financial Ledger**:
   - Historical seller settlements and customer charges are recorded as append-only double-entry ledger records in `ledger_entries`. Never compute historical payouts from live product pricing or current commission rates.
7. **Tasklist Completion Integrity**:
   - Never mark a task `[x]` in `resources/tasklist2.md` simply because a scaffolding file or function was created. A task is only complete when end-to-end operational functionality, database persistence, and acceptance criteria are verified.

---

## 2. Directory Structure & Conventions

```text
├── resources/
│   ├── Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf  # Primary Architecture Blueprint
│   ├── roadmap.md                                                     # Production Delivery Roadmap
│   ├── tasklist2.md                                                   # Master Production Tasklist V2
│   └── supabase_setup_guide.md                                        # Database Setup Guide
├── src/
│   ├── lib/
│   │   ├── api/             # Backend server functions & client service wrappers
│   │   ├── config/          # Environment and application configurations (Zod validated)
│   │   ├── supabase/        # Supabase client, SSR cookies, and generated database types
│   │   └── ism-store.tsx    # Zustand / React state management (UI cache only, not auth authority)
│   └── routes/              # TanStack Start file-based routing
└── supabase/
    ├── migrations/          # Canonical SQL migrations
    └── seed.sql             # Taxonomy & baseline database seed
```

---

## 3. Mandatory Pre-Commit Validation

Before submitting changes or marking tasks complete:
1. Run `npx tsc --noEmit` to verify type safety.
2. Run `npm run build` to ensure SSR and client bundles compile cleanly with zero server secret leaks.
3. Update the Progress Log in `resources/tasklist2.md`.
