# Indian Shopping Mela — Controlled Pilot Protocol & Execution Guide

**Document:** `resources/controlled_pilot_runbook.md`  
**Scope:** Phase 35 (`T555–T568`)  
**Target Environment:** Production (`https://indianshoppingmela.com.au`)  
**Architecture Source:** `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

---

## 1. Controlled Pilot Objectives & Scope

The controlled pilot establishes a ring-fenced operational verification period before broad public marketing.

### Pilot Parameters:
- **Seller Cohort:** 5–10 curated Australian-based Indian boutiques (e.g. Sydney & Melbourne ethnic wear, brassware, and home decor artisans).
- **Product Scope:** 50–100 live listings with verified high-resolution imagery and accurate stock counts.
- **Payment Gateway:** Live Stripe Australia (Credit/Debit Card, Apple Pay, Google Pay).
- **Shipping Integration:** Live Australia Post eParcel / Parcel Post with automatic consignment and tracking generation.
- **Support & Operations:** Daily ledger reconciliation, 24-hour Sentry/monitoring oversight, and zero synthetic fallbacks.

---

## 2. Step-by-Step Pilot Execution Matrix

### Step 2.1: Seller Onboarding & KYC Verification (T555)
- Invite the first cohort of 5–10 boutique owners via `/sell/onboarding`.
- Verify Australian Business Number (ABN), business address, phone number, and director identification.
- Super Admin approves seller accounts in `/admin/sellers`.

### Step 2.2: Stripe Connect Onboarding & Payout Readiness (T556)
- Each approved seller completes Stripe Connect Custom onboarding in `/sell/settings/payouts`.
- Verify bank account currency is `AUD` and Stripe account capability `transfers` is active (`charges_enabled: true`, `payouts_enabled: true`).

### Step 2.3: Dispatch & Return Address Verification (T557)
- Validate each seller's physical Australian dispatch address and return depot in `public.seller_addresses`.
- Verify valid Australian postcodes (`NSW 2000-2999`, `VIC 3000-3999`, `QLD 4000-4999`, etc.) for real-time Australia Post rating.

### Step 2.4: Catalogue & Media Moderation (T558)
- Sellers publish real products with variants (sizes, fabrics, colors) and primary imagery.
- Admin verifies zero prohibited goods (no unapproved TGA health claims, no unhallmarked jewellery, no counterfeit designer replicas).

### Step 2.5: Live Test Transaction (T559)
- Conduct one real $1.00–$50.00 AUD customer checkout with a live Australian payment card.
- Verify atomic reservation commit, zero inventory drift, and customer order confirmation email delivery via Brevo.

### Step 2.6: Immutable Ledger Verification (T560)
- Query `public.payout_ledger` to verify double-entry accounting records:
  1. `CHARGE` credit for total customer payment.
  2. `COMMISSION` debit for platform 10% marketplace fee.
  3. `SELLER_PAYABLE` credit for net seller balance held under 14-day delivery rule.

### Step 2.7: Live Shipment & Australia Post Consignment (T561)
- Seller clicks **Accept & Generate Courier Label** in `/sell/orders`.
- Verify live Australia Post consignment creation, PDF shipping label download, and tracking number assignment (`AP-AU-...`).

### Step 2.8: Courier Tracking & Delivery Timestamp Anchor (T562)
- Courier tracking webhook receives `DELIVERED` event.
- System anchors `delivered_at` timestamp on `sub_orders`, starting the 7-day return and 14-day payout maturity countdown.

### Step 2.9: Controlled Return & Refund Verification (T563)
- If tested, submit a sample return request via `/returns/new`.
- Verify seller payout balance placed on financial hold.
- Verify Stripe partial refund processing and atomic inventory restocking.

### Step 2.10: 14-Day Delivery Maturity Settlement (T564)
- Run `payout-eligibility` background job after maturity clearance.
- Verify Stripe Connect transfer creation and settlement entry in `payout_ledger`.

### Step 2.11: 24-Hour Telemetry & Operational Review (T565, T566, T567)
- Monitor Sentry error streams and failed webhook alerts.
- Perform daily order and payout ledger reconciliation.
- Review seller feedback and customer support tickets.

### Step 2.12: Public Launch Gate Approval (T568)
- Super Admin and Release Owner sign off on the 42 Final Go-Live Gates before opening public marketing traffic.
