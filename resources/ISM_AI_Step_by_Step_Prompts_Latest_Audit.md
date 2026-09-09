# Indian Shopping Mela — Latest Audit Step-by-Step AI Prompt Pack

Use these prompts **one at a time, in order**. Every prompt below contains the **full Master Prompt**, exactly as requested.

Do not send all prompts to the coding AI at once. Complete each step, verify the acceptance criteria, update `tasklist3.md`, then move to the next prompt.

---

# PROMPT 0 — Baseline and verify the current repo before further work

**Tasklist scope:** `T013–T019`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute the repository baseline phase.

Required actions:

- Read `AGENTS.md`, `tasklist3.md`, `roadmap.md`, `README.md`.
- Run `git status`.
- Record branch and latest commit.
- Verify which package manager is actually authoritative.
- Install dependencies reproducibly.
- Run:
  - lint;
  - TypeScript typecheck;
  - build;
  - tests.
- Record real failures instead of hiding them.
- Search for active old tasklists that still claim inaccurate completion counts and mark them superseded/history where appropriate.
- Verify production demo/fallback policy is explicit.

Do not touch core business logic in this step.

---

# PROMPT 1 — Make the canonical Supabase schema truly canonical

**Tasklist scope:** `T020–T045`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

This is the highest-priority task. Do not continue to checkout/payment/shipping until this is correct.

Required actions:

1. Confirm only intended migration files are active.
2. Audit `20260907_canonical_schema.sql` against:
   - all generated DB types;
   - all `src/lib/api/*.ts`;
   - all server functions;
   - current seed;
   - Master Plan.
3. Fix SQL object creation order.
4. Make one canonical model for:
   - profiles/user roles;
   - sellers/members/permissions/addresses/payout profiles/agreements/documents;
   - departments/categories/attributes/options/collections;
   - products/variants/variant-options/media;
   - inventory/reservations/transactions;
   - carts/cart items/wishlists;
   - master orders/seller orders/order items/status history;
   - payments;
   - immutable ledger;
   - shipments/tracking;
   - returns/return items/refunds;
   - payouts/payout items;
   - marketplace config/audit/webhooks/notifications/imports/reviews.
5. Resolve current known mismatches:
   - product variant fields;
   - `amount` vs `amount_cents`;
   - ledger amount column;
   - ledger enum values;
   - `seller_staff` vs `seller_members`;
   - `return_requests` vs `returns`;
   - `payout_ledger` vs canonical ledger/payout tables.
6. Choose one money representation and use it everywhere.
7. Rebuild inventory RPCs against actual columns.
8. Harden `SECURITY DEFINER` functions with explicit `search_path`.
9. Rebuild RLS helper signatures and policies.
10. Fix unsafe guest cart access.
11. Ensure tracking is not globally public.
12. Add append-only protections.
13. Standardize Storage bucket names and policies.
14. Repair `supabase/seed.sql` so all enum values, columns, UUIDs, and FKs are valid.
15. Strengthen the schema checker to detect schema/type/seed drift.

Do not mark this complete based only on static review. The next prompt will prove it on clean staging.

---

# PROMPT 2 — Prove the schema on clean staging and regenerate DB types

**Tasklist scope:** `T046–T055`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute the staging-schema verification phase.

Required actions:

- Use a clean staging Supabase project.
- Link Supabase CLI.
- Apply canonical migration from scratch.
- Apply seed.
- Verify all expected tables, enums, functions, triggers, RLS policies, and Storage buckets.
- Run RLS smoke tests for:
  - anon;
  - customer A/B;
  - seller A/B;
  - seller staff;
  - admin.
- Generate actual TypeScript DB types from this staging DB into:
  `src/lib/supabase/database.types.ts`
- Retire stale handwritten types.
- Fix all code to compile against generated types.
- Remove `as any` from critical database/payment/security paths.
- Add migration/schema drift checks to CI.

Exit criteria:
The canonical SQL, seed, generated types, and application DB queries must represent exactly the same schema.

---

# PROMPT 3 — Fix production env validation, server boundaries, Vercel, and health

**Tasklist scope:** `T056–T063`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute infrastructure hardening.

Required actions:

- Make production-critical env vars required.
- Remove:
  - placeholder service-role key;
  - fake Stripe secret;
  - placeholder ABN;
  - silent provider mock fallback.
- Missing production secret must fail startup or explicitly disable that feature.
- Ensure privileged modules are server-only.
- Ensure React routes never directly import admin Supabase/Stripe server implementation.
- Route privileged actions through `createServerFn` or true HTTP server endpoints.
- Configure the correct TanStack/Nitro Vercel target.
- Verify preview deployment.
- Fix `/api/health` so it performs the real DB-aware health check instead of being intercepted by an always-healthy response.
- Add safe release metadata.

Verify on Vercel preview:

- SSR;
- dynamic route refresh;
- server functions;
- auth cookies;
- DB health.

---

# PROMPT 4 — Finish SSR auth, server-side route protection, and MFA

**Tasklist scope:** `T064–T078`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute auth and authorization.

Required actions:

- Verify Supabase SSR cookies/session across hard refresh.
- Make Supabase session the only auth authority.
- Complete:
  - sign-in;
  - sign-up;
  - email verification;
  - password recovery/update;
  - sign-out.
- Add server-side guards for:
  - customer routes;
  - seller routes;
  - admin routes.
- Implement reusable helpers:
  - requireUser
  - requireSellerMember
  - requireSellerPermission
  - requireAdminRole
  - requireFinanceAdmin
- Implement real Supabase MFA assurance-level checks for Finance/Super Admin.
- Test:
  - customer A vs B;
  - seller A vs B;
  - seller staff permissions;
  - admin role isolation.

UI-only protection is not sufficient.

---

# PROMPT 5 — Make catalogue fully DB-driven and remove production fixtures

**Tasklist scope:** `T079–T087`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute catalogue cleanup.

Required actions:

- Align catalogue queries to generated DB types.
- Remove fabricated mapper defaults.
- Disable fixture fallback in production.
- Fully connect:
  - homepage;
  - category;
  - search;
  - seller storefront;
  - PDP.
- Use controlled error/empty states if DB fails.
- Add pagination.
- Add/verify indexes.
- Ensure only LIVE/eligible products show publicly.

Acceptance:
Changing staging DB data changes the frontend. A DB failure never shows fake purchasable products.

---

# PROMPT 6 — Complete seller onboarding and Stripe Connect onboarding

**Tasklist scope:** `T088–T103`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute seller onboarding.

Required actions:

- Align seller APIs to canonical schema/types.
- Never assume seller ID equals auth user ID.
- Persist onboarding draft.
- Submit application.
- Implement review states.
- Remove simulated verification states.
- Implement private seller documents with validation/RLS.
- Add ABN validation/manual verification state.
- Store seller agreement version acceptance.
- Create/get Stripe Connect account server-side.
- Generate onboarding link.
- Connect UI to Stripe onboarding.
- Sync Stripe capabilities.
- Gate activation/payout readiness correctly.
- Audit actions.

End-to-end staging proof required.

---

# PROMPT 7 — Finish product CRUD, dynamic attributes, media, and moderation

**Tasklist scope:** `T104–T124`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute product backend completion.

Required actions:

- Align product APIs to generated types.
- Remove hard-coded seller/category IDs.
- Build category-driven attributes from DB.
- Implement:
  - save draft;
  - submit for review;
  - validation;
  - variant matrix;
  - unique seller SKU;
  - product list;
  - edit;
  - clone;
  - archive;
  - admin moderation.
- Add moderation history/audit.
- Standardize product media bucket.
- Validate image content server-side.
- Persist media order/primary/alt text.
- Remove blob/local success fallback.
- Remove success toast after backend failure.

Prove a full staging product lifecycle.

---

# PROMPT 8 — Make cart and wishlist server-authoritative

**Tasklist scope:** `T125–T135`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute cart/wishlist backend.

Required actions:

- Database becomes source of truth.
- LocalStorage may cache only, never override DB authority.
- Implement authenticated cart.
- Implement secure guest cart token/hash.
- Implement:
  - get;
  - add;
  - update quantity;
  - remove;
  - merge guest→account.
- Revalidate product/stock during merge.
- Implement DB wishlist.
- Remove `INITIAL_CART`.
- Add ownership/RLS tests.

Acceptance:
Cart persists correctly and cannot leak across users/guests.

---

# PROMPT 9 — Complete atomic inventory lifecycle

**Tasklist scope:** `T136–T147`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute inventory completion.

Required actions:

- Align RPCs to canonical schema.
- Remove any `catch(console.warn)` that lets checkout continue after reservation failure.
- Reserve all lines atomically.
- Release reservations if prepare-order fails.
- Implement expiry job.
- Release on payment failure/timeout/cancel.
- Commit on trusted payment success only.
- Make release/commit idempotent.
- Record inventory transactions.
- Handle cancellation/return restock policy.
- Run final-unit concurrency test.

Acceptance:
Stock=1, two simultaneous buyers → one success only.

---

# PROMPT 10 — Build true atomic zero-trust checkout

**Tasklist scope:** `T148–T162`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute checkout hardening.

Required actions:

- Client sends only:
  - variant IDs;
  - quantities;
  - address;
  - selected shipping service;
  - coupon;
  - idempotency key.
- Server fetches authoritative:
  - seller;
  - price;
  - stock;
  - weight;
  - tax;
  - commission.
- Remove fake product fallback entirely.
- Compute GST/discount/shipping/total on server.
- Build one actual PostgreSQL transaction/RPC for:
  - reservation;
  - master order;
  - seller orders;
  - item snapshots;
  - pending payment.
- Remove sequential partial-order writes.
- Remove fake order success.
- Ensure stale stock/price fails cleanly.

Do not mark complete until an injected mid-transaction failure leaves no partial order.

---

# PROMPT 11 — Finish Stripe Payment Element and build a real external Stripe webhook

**Tasklist scope:** `T163–T179`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute Stripe payment completion.

Required actions:

- Keep Payment Element.
- Remove fake `pi_...` fallback.
- Create PaymentIntent only with real Stripe test/live secret.
- Use idempotency key.
- Build a real external HTTP POST endpoint for Stripe:
  - raw body;
  - Stripe-Signature;
  - required signature verification.
- Reject unsigned webhook in production.
- Persist unique Stripe event before business action.
- On success:
  - payment PAID;
  - inventory commit;
  - order paid;
  - seller orders move to correct pre-accept state;
  - ledger;
  - notifications.
- Do not auto-accept seller fulfilment.
- Handle payment failure/refund/dispute.
- Add recovery/retry.
- Replay same event 5 times.
- Test browser closes after payment.
- Test provider succeeds while DB finalization initially fails.

Acceptance must be proven in Stripe test mode.

---

# PROMPT 12 — Rebuild ledger to one canonical model and reconcile every cent

**Tasklist scope:** `T180–T192`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute ledger cleanup.

Required actions:

- Make application ledger enums exactly match DB enum values.
- Make amount field names exactly match DB schema.
- Remove old conflicting `payout_ledger` path.
- Post:
  - customer charge;
  - seller gross;
  - commission;
  - shipping;
  - discount;
  - GST where model requires;
  - refunds;
  - payout transfers.
- Append-only protections.
- Build reconciliation queries.
- Test rounding/cents.
- Prove one test order reconciles exactly.

---

# PROMPT 13 — Connect one real shipping provider end-to-end

**Tasklist scope:** `T193–T211`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute shipping.

Required actions:

- Use one selected provider.
- Remove fake rates/tracking/labels.
- Real:
  - rates;
  - seller dispatch origin;
  - package dimensions;
  - service selection;
  - shipment creation;
  - label;
  - pickup/dropoff;
  - webhook/polling;
  - tracking normalization;
  - delivered_at;
  - cancellation;
  - return label;
  - retries.
- Prevent duplicate shipment creation.
- Run sandbox full flow.

No fake tracking IDs or fake label URLs.

---

# PROMPT 14 — Replace fulfilment/order tracking fixtures with live backend

**Tasklist scope:** `T212–T227`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute fulfilment.

Required actions:

- Remove `INITIAL_ORDERS`.
- Query seller orders from authenticated seller membership.
- Implement:
  - accept;
  - preparing;
  - ready-to-ship;
  - shipment/label;
  - shipped.
- SLA/deadline.
- late seller alerts.
- seller cancellation performance.
- Customer order tracking from real seller packages and carrier events.
- Enforce order ownership.
- Test 3 sellers in one checkout with independent fulfilment.

---

# PROMPT 15 — Complete cancellations safely

**Tasklist scope:** `T228–T237`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute cancellations.

Required actions:

- Define eligibility by state.
- Implement customer/seller/admin cancellation.
- Release stock idempotently.
- Cancel unused shipping label when supported.
- Trigger real refund when money captured.
- Append ledger adjustments.
- One seller cancellation must not cancel unrelated sellers.
- Require and audit reason.

---

# PROMPT 16 — Complete returns, evidence, refunds, disputes, and payout holds

**Tasklist scope:** `T238–T257`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute returns/refunds.

Required actions:

- Use canonical `returns` + `return_items`.
- Remove any legacy `return_requests` usage.
- Load eligible delivered items only.
- 7-day ordinary window from trusted delivered_at.
- statutory/fault pathway outside ordinary window.
- private evidence upload.
- return + payout hold atomically.
- review.
- return label/tracking.
- return received/condition.
- real Stripe partial/full refund.
- remove demo refund IDs.
- refund idempotency.
- ledger adjustments.
- release/adjust hold.
- disputes.
- day-7 and statutory tests.

---

# PROMPT 17 — Complete Stripe Connect seller payouts

**Tasklist scope:** `T258–T273`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute payouts only after owner confirms Stripe Connect is the chosen architecture.

Required actions:

- Remove manual ABA payout as active primary flow.
- Remove demo transfer IDs.
- Avoid raw bank data where unnecessary.
- Calculate eligibility from delivered_at + configured delay.
- Exclude held/refunded/disputed/fraud amounts.
- Select eligible ledger entries transactionally.
- Create settlement.
- Execute real Stripe Connect transfer.
- Idempotency.
- Reconcile status.
- Failed transfer retry.
- manual finance hold + audit.
- seller statement.
- post-payout refund recovery.
- concurrent worker test.
- exact 14-day test.
- active return hold test.

---

# PROMPT 18 — Finish real CSV/XLSX bulk product import

**Tasklist scope:** `T274–T308`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute bulk import.

Required actions:

- Remove demo counts/timers.
- Generate versioned CSV and real XLSX templates.
- Use maintained CSV/XLSX parsers.
- Upload source privately.
- Validate template/file.
- Parse server-side/background.
- Preserve row numbers.
- Validate SKU/category/attributes/price/stock/shipping/media.
- SSRF-protect remote media fetching.
- Persist batch + row validation.
- Real preview counts.
- Seller confirmation.
- CREATE/UPDATE.
- IGNORE/CLEAR blanks.
- async/chunked worker.
- progress after refresh.
- error report.
- failed-row retry.
- copy valid remote media to ISM storage.
- never publish malformed product.
- Test 1,000 rows, real XLSX, update/retry.

---

# PROMPT 19 — Complete bulk stock

**Tasklist scope:** `T309–T316`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute bulk stock.

Required actions:

- Remove static metrics.
- Generate stock template.
- Validate seller ownership.
- Validate quantity.
- Apply via inventory service.
- Record inventory transaction.
- Respect active reservations.
- Test checkout concurrency vs stock upload.

---

# PROMPT 20 — Complete product video according to the chosen architecture

**Tasklist scope:** `T317–T335`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute video.

If Mux:

- direct upload;
- processing;
- signed webhook;
- playback;
- thumbnail;
- READY/FAILED;
- moderation;
- replacement;
- no simulation.

If direct Supabase MP4:

- document limitations;
- validate MP4/size/duration;
- canonical bucket;
- moderation;
- thumbnail;
- no local blob success fallback.

In all cases, a failed/rejected video must never be public.

---

# PROMPT 21 — Build event-driven notifications

**Tasklist scope:** `T336–T351`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute notifications.

Required actions:

- Configure provider/domain.
- Create outbox/notification record.
- Idempotency.
- Wire:
  - order confirmation;
  - seller new order;
  - SLA reminder;
  - shipped;
  - delivered;
  - return;
  - refund;
  - payout.
- send log;
- retry/backoff;
- remove fake send success when provider missing.
- duplicate payment webhook → one order email.

---

# PROMPT 22 — Replace admin, seller-team, and customer-account demo data

**Tasklist scope:** `T352–T386`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute admin/team/account integration.

ADMIN:

- real metrics;
- seller approval;
- moderation;
- orders;
- returns;
- refunds;
- ledger;
- payouts;
- shipping exceptions;
- config;
- roles;
- audit;
- MFA for finance;
- pagination;
- remove demo toasts/data.

SELLER TEAM:

- real members;
- invite;
- accept;
- permission update;
- revoke;
- audit;
- immediate access removal.

CUSTOMER:

- real orders;
- packages/tracking;
- addresses;
- wishlist;
- returns;
- notifications;
- verified purchase reviews;
- no self/duplicate reviews.

---

# PROMPT 23 — Standardize jobs and webhook processing

**Tasklist scope:** `T387–T397`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute background processing.

Required actions:

- shared webhook processing convention;
- correlation IDs;
- background job abstraction;
- reservation expiry;
- payout eligibility;
- import worker;
- notification retry;
- provider retry;
- dead-letter visibility;
- every job idempotent;
- duplicate job execution test.

---

# PROMPT 24 — Security hardening

**Tasklist scope:** `T398–T418`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute security phase.

Required actions:

- CSP;
- security headers;
- CSRF strategy;
- rate limits for auth/checkout/returns/uploads;
- validate every server payload;
- authorize every mutation;
- harden private files;
- SSRF protection;
- template sanitization;
- sensitive audit;
- remove secrets/PII from logs;
- review raw bank data;
- dependency audit;
- secret rotation;
- session revocation;
- IDOR tests.

---

# PROMPT 25 — Monitoring, backups, restore, and operations

**Tasklist scope:** `T419–T435`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute operations phase.

Required actions:

- Sentry/approved monitoring;
- server/client capture;
- PII redaction;
- alerts for payment/shipping/import/payout/video;
- uptime;
- Supabase backups;
- PITR decision;
- Storage recovery;
- DB restore runbook;
- staging restore test;
- evidence;
- incident checklist.

Do not mark backup/restore complete from source code alone.

---

# PROMPT 26 — Proper unit/integration/E2E tests and CI gates

**Tasklist scope:** `T436–T464`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute test phase.

Required actions:

- proper unit/integration runner;
- Playwright;
- pinned test tooling;
- scripts;
- CI lint/typecheck/build/tests/schema checker;
- staging E2E gate.
- Tests for:
  - money;
  - RLS;
  - roles;
  - inventory concurrency;
  - payment webhook replay;
  - shipping replay;
  - refund idempotency;
  - payout concurrency;
  - reservation expiry;
  - return boundaries;
  - 1,000-row import;
  - real XLSX;
  - video failure;
  - suspended seller;
  - admin MFA.

---

# PROMPT 27 — Performance and reliability

**Tasklist scope:** `T465–T476`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute performance phase.

Required actions:

- DB indexes;
- pagination;
- eliminate N+1;
- review heavy seller/admin queries;
- image/CDN optimization;
- lazy media;
- video non-blocking;
- load test catalogue;
- load test checkout concurrency;
- load test 1,000-row import;
- provider timeout/retry tests;
- long-running work independent of browser request.

---

# PROMPT 28 — Remove every remaining demo/mock/fallback path

**Tasklist scope:** `T477–T493`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute production cleanup.

Repository-wide search for:
`demo`, `prototype`, `mock`, `fallback`, `offline`, `fake`, `INITIAL_`, `setTimeout`, `setInterval`, `4242 4242`, `sk_test_placeholder`, `placeholder-service-key`, `tr_demo`, `re_demo`, `pi_`.

Remove/isolate development-only:

- fake products;
- fake PaymentIntent;
- fake refunds;
- fake transfers;
- static cart/orders/admin;
- fake shipping;
- fake bulk import;
- fake bulk stock;
- fake video;
- fake notifications;
- fake seller verification;
- placeholder business IDs.

Add a CI check where practical.

Acceptance:
Production cannot simulate a successful business transaction.

---

# PROMPT 29 — Legal/config finalization

**Tasklist scope:** `T494–T503`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute legal/config integration.

Use only owner/legal-approved text:

- Privacy;
- Terms;
- Returns;
- Seller Agreement;
- prohibited goods;
- GST;
- commission;
- payout wording.

Store accepted versions.
Configure real DB marketplace settings.

If approval is missing, mark `[!]`; do not invent approval.

---

# PROMPT 30 — Full staging UAT against the Master Plan

**Tasklist scope:** `T504–T533`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute full staging UAT.

Run actual scenarios:

- onboarding;
- seller approval;
- product listing;
- video;
- 500 and 1,000 product imports;
- multi-seller checkout;
- final-unit concurrency;
- Stripe success/failure/replay;
- mixed seller fulfilment;
- shipping;
- cancellation;
- returns/refunds;
- statutory fault;
- payout hold;
- payout timing;
- failed payout retry;
- seller/admin isolation;
- audit;
- mobile;
- monitoring;
- backup/restore.

Record evidence for every scenario.

---

# PROMPT 31 — Production deployment

**Tasklist scope:** `T534–T554`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute production deployment only after staging UAT is green.

Required:

- production Supabase;
- canonical migrations;
- production config;
- production Vercel;
- auth URLs;
- live Stripe/webhook/Connect;
- live shipping;
- live email/video;
- monitoring;
- domain/SSL;
- email DNS;
- robots/sitemap;
- secure Super Admin;
- MFA;
- secret review;
- environment isolation;
- backups;
- production smoke test.

Do not copy staging fake users/orders into production.

---

# PROMPT 32 — Controlled pilot and final go-live gate

**Tasklist scope:** `T555–T568 + G001–G042`

## MASTER PROMPT — COPY THIS ENTIRE BLOCK WITH EVERY STEP

You are the senior full-stack engineer, PostgreSQL/Supabase architect, payments engineer, security engineer, QA lead, and release owner for **Indian Shopping Mela (ISM)**.

You are working on the **latest repository version currently provided by the owner**. The current active planning documents are:

- `AGENTS.md`
- `resources/tasklist3.md`
- `resources/roadmap.md`
- `README.md`
- `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

Treat `resources/tasklist3.md` as the current execution plan, but **do not trust old `[x]` checkboxes blindly**. Verify every task against the actual code, actual staging database, actual provider behavior, and actual tests.

### Current audited facts you must keep in mind

The latest audit found these important unresolved issues:

1. `supabase/migrations/20260907_canonical_schema.sql` and `src/lib/supabase/database.types.ts` are not describing the same database.
2. The canonical SQL and application code still disagree on:
   - product variant fields;
   - payment fields such as `amount` vs `amount_cents`;
   - ledger field names and ledger enum values;
   - seller/member/staff table naming;
   - payout/return model naming.
3. Checkout is improved, but still needs:
   - one truly atomic PostgreSQL transaction for order preparation;
   - complete fail-closed inventory reservation;
   - removal of fake product fallback;
   - removal of fake PaymentIntent fallback.
4. Stripe Payment Element exists, but the Stripe webhook still needs to be proven as a real external raw-body HTTP POST endpoint with required signature verification.
5. Production environment validation is still too permissive and contains placeholder/fallback behavior.
6. `/api/health` is currently masked by an always-healthy handler and must be corrected.
7. Route authorization and MFA must be verified server-side, not inferred from UI.
8. Cart still has LocalStorage participation and must be server-authoritative.
9. Shipping, fulfilment, bulk import, admin, payouts, notifications, video, and UAT still require end-to-end verification.
10. `tasklist3.md` completion counts are not reliable until re-verified.

### Non-negotiable execution rules

1. **Inspect before changing.**
   - Run `git status`.
   - Read the exact current files relevant to the step.
   - Search for duplicate/legacy implementations before adding new code.
   - Never assume previous AI work is correct.

2. **Do not redesign the frontend.**
   Preserve approved pages, route structure, visual design, and responsiveness except for necessary real-data/loading/error/provider/security changes.

3. **A helper file is not a completed feature.**
   A task is complete only when:
   - schema supports it;
   - code exists;
   - intended route/job/webhook actually calls it;
   - authorization is correct;
   - failure is handled safely;
   - tests pass;
   - staging behavior is verified.

4. **No server secret may enter browser code.**
   Never expose:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - Stripe secret key
   - Stripe webhook secret
   - shipping API secret
   - email API secret
   - video provider secret
   - admin Supabase client

5. **All privileged operations must use a trusted server boundary.**
   Required path:
   `React route/component → TanStack createServerFn or real HTTP server route → authenticate → authorize → validate → server service → DB/provider`.

6. **Zero-trust checkout.**
   The browser must never be authoritative for:
   - price;
   - seller ID;
   - GST/tax;
   - commission;
   - shipping price;
   - inventory;
   - refund amount;
   - payout amount.
     Browser sends only IDs/quantity/address/service choices/idempotency key. The server loads all authoritative business data.

7. **Fail closed.**
   Forbidden production behavior:
   - backend failure → success toast;
   - missing Stripe key → fake PaymentIntent;
   - unknown product → fake product fallback;
   - shipping failure → fake label/tracking;
   - upload failure → fake/local success;
   - unsigned webhook accepted because secret is missing.
     Development fixtures are allowed only behind an explicit development-only flag that cannot silently activate in production.

8. **Financial correctness.**
   - Use one canonical monetary representation across DB and code.
   - Ledger history is append-only.
   - All payment/refund/payout/webhook workflows must be idempotent.
   - Payout eligibility is based on confirmed delivery + configured delay (default 14 days) and active holds.
   - Ordinary change-of-mind return window defaults to 7 days from confirmed delivery; statutory rights are separate.

9. **Inventory correctness.**
   - Inventory reservation must be atomic.
   - Reservation failure stops checkout.
   - Stock can never become negative.
   - Duplicate webhook/retry cannot double-deduct inventory.
   - Reservation commit/release must be idempotent.

10. **Database types must come from the real staging schema.**
    Do not maintain fictional handwritten DB types. Remove `as any` from critical DB code.

11. **Git/Lovable safety.**
    - Never force-push.
    - Never rewrite published history.
    - Do not delete unknown user work.
    - Keep commits small and reversible.
    - Do not make unrelated changes.

12. **Before marking any task `[x]`, run applicable checks:**

    ```bash
    bun run lint
    npx tsc --noEmit
    bun run build
    bun run test
    ```

    Also run any DB/provider/E2E test required for the task.

13. **Update `resources/tasklist3.md` accurately.**
    - `[ ]` not started
    - `[~]` partial
    - `[x]` verified
    - `[!]` blocked
    - `[-]` intentionally deferred
      Update the Progress Log with evidence and commit hash.

14. **If an external decision/credential is missing, mark only that task `[!]`.**
    State exactly what is needed. Continue only with independent tasks whose dependencies are already satisfied.

15. **Do not claim production readiness until all applicable final go-live gates pass.**

### Required final report after every step

At the end of the step, report:

1. Tasks worked on
2. Files changed
3. What was implemented
4. Exact tests/commands run and results
5. Tasklist status changes
6. Remaining blockers
7. Exact next step
8. Commit hash, if committed

Do the implementation. Do not only explain what should be done.

## STEP-SPECIFIC INSTRUCTION

Execute controlled pilot and final gate.

Recommended:

- 5–10 approved sellers;
- limited real catalogue;
- one shipping provider;
- only tested payment methods;
- controlled traffic.

Verify:

- seller readiness;
- payout readiness;
- addresses;
- products/media;
- real payment;
- ledger;
- shipment;
- tracking/delivery;
- controlled refund if safe;
- settlement;
- 24h monitoring;
- first-day reconciliation;
- support issues.

Then verify every final gate G001–G042.

Do not declare public launch until every applicable gate is `[x]`.
