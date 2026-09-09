# Indian Shopping Mela (ISM) — Multi-Vendor E-Commerce Platform

Indian Shopping Mela is a full-stack, multi-vendor marketplace tailored specifically for the Australian market (AUD currency, 10% GST compliance, ACL 7-day return compliance, Australia Post/Sendle shipping, and Stripe AU payments).

## Architecture & Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/router/latest/docs/framework/react/overview) with React 19 & TypeScript
- **Styling**: Tailwind CSS v4
- **Database & Auth**: [Supabase](https://supabase.com) (PostgreSQL, Row-Level Security, Database Migrations)
- **Deployment**: [Vercel](https://vercel.com) (Serverless & Edge SSR via Nitro)
- **Payments**: Stripe & Stripe Connect Australia (Custom Connect onboarding, transfer lifecycle, automated 14-day hold maturity)
- **Shipping**: Australia Post & Sendle API integration with weight-bracket calculations and PDF consignment labels
- **Email**: Brevo transactional email engine

## Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/neiloy-neil/indian-shopping-mela.git
   cd indian-shopping-mela
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and provide your Supabase, Stripe, and external API keys:
   ```bash
   cp .env.example .env
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## Production Quality & Test Gates

Before deploying or committing changes, run the automated verification pipeline:

```bash
# Run all automated tests (schema alignment, enum parity, fallback checks, typed boundaries, unit, integration & UAT)
npm test

# Run production pre-flight smoke test
npm run test:smoke

# Type check
npx tsc --noEmit

# Production build
npm run build
```

## Deployment to Vercel

The project uses Nitro with the Vercel preset (`preset: "vercel"` in `vite.config.ts`), creating zero-configuration output for Vercel:

```bash
vercel deploy --prod
```
