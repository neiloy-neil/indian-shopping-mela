# Indian Shopping Mela — Production Deployment & Go-Live Runbook

**Document:** `resources/production_deployment_runbook.md`  
**Scope:** Phase 34 (`T534–T554`)  
**Target Environment:** Production (`https://indianshoppingmela.com.au`)  
**Architecture Source:** `resources/Indian_Shopping_Mela_Developer_Architecture_Master_Plan_V1.pdf`

---

## 1. Executive Summary & Pre-Flight Checklist

This runbook details the end-to-end execution requirements for deploying Indian Shopping Mela (ISM) to production. The production environment strictly separates staging test data from live commerce, enforcing zero-trust boundaries, fail-closed third-party integrations, and append-only financial ledgers.

---

## 2. Infrastructure & Service Provisioning Matrix

| Step   | Task ID | Service / Component         | Configuration / Requirement                                                                                                          | Status             |
| ------ | ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| **1**  | `T534`  | **Supabase Production**     | Create dedicated project in `ap-southeast-2` (Sydney). Set PITR retention to 7+ days.                                                | Owner Action `[!]` |
| **2**  | `T535`  | **Canonical Migrations**    | Apply `supabase/migrations/20260907_canonical_schema.sql`. Verify all 42 tables, RLS policies, and triggers compile.                 | Ready              |
| **3**  | `T536`  | **Production Seed**         | Apply `supabase/production_seed.sql`. Seeds taxonomy and marketplace configs only. Zero synthetic demo users/products.               | Ready              |
| **4**  | `T537`  | **Vercel Production**       | Configure production Vercel project with Node.js 20+ runtime, `npm run build`, and `vercel.json` security headers.                   | Ready              |
| **5**  | `T538`  | **Auth Redirect URLs**      | Configure Supabase Auth Site URL `https://indianshoppingmela.com.au` and redirect whitelist (`/auth/callback`, `/account`, `/sell`). | Owner Action `[!]` |
| **6**  | `T539`  | **Live Stripe Keys**        | Input `STRIPE_SECRET_KEY` (`rk_live_...` or `sk_live_...`) and `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_live_...`).                        | Owner Action `[!]` |
| **7**  | `T540`  | **Live Stripe Webhook**     | Register `https://indianshoppingmela.com.au/api/webhooks/stripe` in Stripe Dashboard. Set `STRIPE_WEBHOOK_SECRET` (`whsec_...`).     | Owner Action `[!]` |
| **8**  | `T541`  | **Live Stripe Connect**     | Configure Stripe Connect Custom platform profile for Australian marketplace distribution.                                            | Owner Action `[!]` |
| **9**  | `T542`  | **Live Shipping (AusPost)** | Input live Australia Post Developer Centre Merchant API key and account number.                                                      | Owner Action `[!]` |
| **10** | `T543`  | **Live Email (Brevo)**      | Input live `BREVO_API_KEY` and verify sender domain `@indianshoppingmela.com.au`.                                                    | Owner Action `[!]` |
| **11** | `T544`  | **Live Video (Mux)**        | Input live `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, and `MUX_WEBHOOK_SECRET`.                                                             | Owner Action `[!]` |
| **12** | `T545`  | **Monitoring (Sentry)**     | Configure `SENTRY_DSN` in Vercel production environment for error and performance telemetry.                                         | Owner Action `[!]` |
| **13** | `T546`  | **Custom Domain & SSL**     | Configure DNS A/CNAME records for `indianshoppingmela.com.au` pointing to Vercel edge. SSL managed via Let's Encrypt.                | Owner Action `[!]` |
| **14** | `T547`  | **Email DNS Verification**  | Publish SPF (`v=spf1 include:sendinblue.com ~all`), DKIM (`mail._domainkey`), and DMARC (`p=quarantine`) TXT records.                | Owner Action `[!]` |
| **15** | `T548`  | **Robots & Sitemap**        | `public/robots.txt` and `public/sitemap.xml` restrict admin/seller/checkout routes while indexing public catalogue.                  | Ready              |
| **16** | `T549`  | **Super Admin Bootstrap**   | Run secure Super Admin CLI/SQL provisioning script for primary operator.                                                             | Ready              |
| **17** | `T550`  | **Admin MFA Enrollment**    | Enroll TOTP Multi-Factor Authentication for Super Admin and Finance Admin accounts before public access.                             | Ready              |
| **18** | `T551`  | **Secret Audit Scanner**    | Run `scripts/check-production-fallbacks.ts` to ensure 0 placeholder keys or demo cards exist in codebase.                            | Verified `[x]`     |
| **19** | `T552`  | **Staging/Prod Isolation**  | Verify production environment variables contain 0 references to staging Supabase URLs or test credentials.                           | Verified `[x]`     |
| **20** | `T553`  | **Backup Verification**     | Verify automated daily database backups and Point-In-Time-Recovery (PITR) in Supabase dashboard.                                     | Owner Action `[!]` |
| **21** | `T554`  | **Production Smoke Test**   | Execute `npm run test:smoke` against production build output.                                                                        | Verified `[x]`     |

---

## 3. Step-by-Step Production Execution Runbook

### Step 3.1: Canonical Database Migration

Run against the production Supabase PostgreSQL instance:

```bash
supabase db push --db-url "postgresql://postgres:[PROD_PASSWORD]@db.[PROD_PROJECT].supabase.co:5432/postgres"
# Or apply canonical migration file directly:
psql "$PROD_DATABASE_URL" -f supabase/migrations/20260907_canonical_schema.sql
```

### Step 3.2: Production Seed Application

Apply the clean taxonomy and operational configuration seed:

```bash
psql "$PROD_DATABASE_URL" -f supabase/production_seed.sql
```

_Note: This script seeds 5 departments, 18 categories, 7 marketplace configs, and 3 storage buckets. It inserts zero test users, fake orders, or placeholder products._

### Step 3.3: Super Admin Secure Bootstrap

To bootstrap the initial production Super Admin account without exposing credentials in git:

```sql
DO $$
DECLARE
    v_admin_id UUID := gen_random_uuid();
    v_admin_email TEXT := 'admin@indianshoppingmela.com.au';
    v_admin_password TEXT := '[SECURE_GENERATED_PASSPHRASE]';
BEGIN
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
        v_admin_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_admin_email,
        crypt(v_admin_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"ISM Operations Admin"}'::jsonb,
        NOW(),
        NOW()
    );

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_admin_id, v_admin_email, 'ISM Operations Admin', 'super_admin');
END $$;
```

### Step 3.4: Production Environment Variables on Vercel

Set the following environment variables in Vercel (Production Environment only):

```env
# Application Core
NODE_ENV=production
APP_URL=https://indianshoppingmela.com.au

# Supabase Production
VITE_SUPABASE_URL=https://[PROD_PROJECT].supabase.co
VITE_SUPABASE_ANON_KEY=[PROD_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[PROD_SERVICE_ROLE_KEY]

# Stripe Live
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_[KEY]
STRIPE_SECRET_KEY=sk_live_[KEY]
STRIPE_WEBHOOK_SECRET=whsec_[KEY]
STRIPE_CONNECT_CLIENT_ID=ca_[KEY]

# Australia Post Live Merchant
AUSPOST_API_KEY=[LIVE_KEY]
AUSPOST_API_SECRET=[LIVE_SECRET]
AUSPOST_ACCOUNT_NUMBER=[LIVE_ACCOUNT]

# Brevo Live Email
BREVO_API_KEY=[LIVE_BREVO_KEY]
BREVO_SENDER_EMAIL=orders@indianshoppingmela.com.au
BREVO_SENDER_NAME=Indian Shopping Mela

# Mux Video
MUX_TOKEN_ID=[LIVE_MUX_TOKEN_ID]
MUX_TOKEN_SECRET=[LIVE_MUX_TOKEN_SECRET]
MUX_WEBHOOK_SECRET=[LIVE_MUX_WEBHOOK_SECRET]

# Sentry Monitoring
SENTRY_DSN=[LIVE_SENTRY_DSN]
```

### Step 3.5: Smoke Testing & Pre-Flight Validation

Before pointing public DNS traffic, run the automated production test suites:

```bash
npm run check:schema
npm run check:fallbacks
npm run test:smoke
npm run test:unit
npm run test:integration
```

All suites must return 100% PASS (0 failures).
