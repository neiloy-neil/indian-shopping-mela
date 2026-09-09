# Indian Shopping Mela — Operational Incident Response Checklist & SOP

**Document Owner:** Operations, Security & On-Call Engineering  
**Version:** 1.0  
**Target Resolution Time:** P1 < 1 Hour, P2 < 4 Hours, P3 < 24 Hours

---

## 1. Incident Severity Matrix

| Severity          | Definition                                                    | Examples                                                                                      | Escalation Target                                           |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **P1 — Critical** | Total outage or financial data corruption impacting all users | Checkout down, Stripe payment webhook failure, double-deduction bug, ledger imbalance         | Super Admin, Lead Architect, Finance Admin (Immediate page) |
| **P2 — High**     | Core feature degraded with no immediate workaround            | Australia Post label generation failing, seller payout processing blocked, bulk upload halted | Tech Lead, On-Call Engineer (15 min response)               |
| **P3 — Medium**   | Non-critical component broken with temporary workaround       | Product video transcoding delay, non-critical notification email queued, review reporting bug | On-Call Engineer (Within business hours)                    |
| **P4 — Low**      | Cosmetic bug, minor admin UI glitch                           | Analytics graph misaligned, typo in admin logs                                                | Backlog triage                                              |

---

## 2. P1/P2 Incident Execution Checklist (T435)

### Step 1: Detect & Triage (0 – 10 mins)

- [ ] Receive automated alert from `dispatchOperationalAlert()` or monitoring dashboard.
- [ ] Verify severity and declare incident (e.g. `#incident-20260909-checkout-down`).
- [ ] Assign Incident Commander (IC) and Communications Lead.

### Step 2: Containment & Mitigation (10 – 30 mins)

- [ ] Enable maintenance banner / fail-closed safe state if data corruption risk is present.
- [ ] If payment/webhook bug: Pause webhook ingestion queue, verify ledger reconciliation.
- [ ] If shipping provider outage: Fall back to manual consignment entry queue.
- [ ] If database latency spike: Check active connections (`pg_stat_activity`) and terminate stuck locks.

### Step 3: Resolution & Verification (30 – 60 mins)

- [ ] Deploy hotfix or execute rollback to last verified release.
- [ ] Verify database integrity using `npm run schema:check` and `npm test`.
- [ ] Perform end-to-end checkout smoke test in staging/pilot environment.
- [ ] Remove maintenance banner and monitor error rates for 30 minutes.

### Step 4: Post-Mortem & Remediation (Within 48 hours)

- [ ] Publish blameless post-mortem document.
- [ ] Record root cause (5 Whys), impact duration, and timeline of actions.
- [ ] File preventative engineering tickets in backlog.

---

## 3. Post-Mortem Template

```markdown
# Incident Post-Mortem: [Incident Title]

**Date:** YYYY-MM-DD  
**Duration:** XX minutes  
**Impact:** Total orders affected: XX | Revenue impacted: $XX AUD  
**Incident Commander:** [Name]

### 1. Summary

Brief overview of what occurred and how it was detected.

### 2. Root Cause

Detailed technical analysis of the underlying failure.

### 3. Timeline (UTC)

- HH:MM — Event triggered
- HH:MM — Alert fired
- HH:MM — Incident declared
- HH:MM — Mitigation applied
- HH:MM — Full recovery verified

### 4. Corrective Actions

- [ ] Action item 1 (Owner, Due Date)
- [ ] Action item 2 (Owner, Due Date)
```
