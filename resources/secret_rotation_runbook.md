# Indian Shopping Mela — Production Secret Rotation Runbook

## 1. Overview & Scope

This runbook provides emergency and routine operational procedures for rotating critical credentials, API keys, and signing secrets across all production integrations of Indian Shopping Mela (ISM).

Target Secrets:

1. **Supabase Service Role Key & Database Password**
2. **Stripe Secret Key & Webhook Signing Secret (`whsec_...`)**
3. **Brevo Email API Key (`BREVO_API_KEY`)**
4. **Australia Post Shipping API Key & Secret**
5. **Mux Video Secret Key & Webhook Signing Secret**

---

## 2. Pre-Rotation Checklist

- [ ] Schedule rotation during low-traffic maintenance window (e.g. 02:00–04:00 AEST).
- [ ] Confirm access to Cloudflare Workers / Nitro deployment dashboard and environment variable manager.
- [ ] Notify On-Call Operations and Release Owner.
- [ ] Verify test suite `npm test` and `npx tsc --noEmit` pass prior to rotation.

---

## 3. Secret Rotation Procedures

### 3.1 Stripe Secret Key & Webhook Signing Secret

1. **Generate New Webhook Secret**:
   - Navigate to Stripe Dashboard → Developers → Webhooks → Endpoint `https://indianshoppingmela.com.au/api/webhooks/stripe`.
   - Click "Roll Secret" with a 24-hour expiration window for the old secret.
   - Copy the new `whsec_...`.
2. **Generate New Restricted Secret Key**:
   - Navigate to Stripe Dashboard → Developers → API keys → Create Restricted Key.
   - Grant write permissions: `PaymentIntents`, `Refunds`, `Transfers`, `Accounts`.
3. **Deploy Updated Secrets**:
   - Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in production environment.
   - Trigger deployment (`npm run build` + Cloudflare deploy).
4. **Verify**:
   - Run automated idempotency test: `npx tsx scripts/run-production-tests.ts`.
   - Confirm Stripe webhook deliveries succeed with 200 OK.
5. **Revoke Old Secret**:
   - Expire old Stripe API key and old webhook secret.

---

### 3.2 Supabase Service Role Key & JWT Secret

1. **Rotate Service Role Key**:
   - Navigate to Supabase Project Settings → API.
   - Click "Generate new Service Role key".
2. **Update Environment**:
   - Update `SUPABASE_SERVICE_ROLE_KEY` in deployment environment variables.
   - Redeploy the Nitro server bundle.
3. **Verify Auth & Database Queries**:
   - Verify SSR sessions, database mutations, and RLS policies.
4. **Revoke Previous Key**:
   - Delete the rotated key in Supabase console.

---

### 3.3 Brevo (Sendinblue) Email API Key

1. **Create New API Key**:
   - Log in to Brevo Dashboard → SMTP & API → API Keys → Generate a new API key (`ISM_PROD_BREVO_KEY_YYYYMMDD`).
2. **Deploy Updated Secret**:
   - Update `BREVO_API_KEY` in environment variables.
   - Deploy server bundle.
3. **Verify**:
   - Trigger order confirmation email test or check notification worker status.
4. **Revoke Old Key**:
   - Delete previous Brevo API key from Brevo console.

---

### 3.4 Australia Post Shipping Credentials

1. **Generate New API Credentials**:
   - Access Australia Post Developer Portal → Manage Apps → Generate New Key/Secret.
2. **Update Environment**:
   - Update `AUSPOST_API_KEY` and `AUSPOST_API_SECRET`.
3. **Verify Rates & Consignments**:
   - Test domestic parcel calculation and label creation on staging.
4. **Decommission Previous Key**:
   - Revoke old API key in AusPost portal.

---

## 4. Post-Rotation Audit & Sign-off

- [ ] Check server logs for unauthorized API exceptions (`401`, `403`).
- [ ] Confirm no plaintext secrets or credentials leaked into Git history or logs.
- [ ] Record rotation event, timestamp, and operator in security audit log.
