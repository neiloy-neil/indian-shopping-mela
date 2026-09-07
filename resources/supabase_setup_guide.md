# Indian Shopping Mela — Supabase Live Connection Guide

Follow these 4 simple steps to connect your live Supabase cloud database and replace all mock data with real PostgreSQL tables:

---

## 🛠️ Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in / sign up.
2. Click **New Project**.
3. Choose:
   * **Name**: `Indian Shopping Mela`
   * **Region**: `Oceania (Sydney) - ap-southeast-2` *(Recommended for low Australian latency)*
   * **Database Password**: *(Save securely)*

---

## 🗄️ Step 2: Run Database Migrations
1. In your Supabase project dashboard, open the **SQL Editor** from the left sidebar.
2. Open the file [`supabase/migrations/20260906000000_master_schema.sql`](file:///d:/AI/Indian%20Shopping%20Mela/supabase/migrations/20260906000000_master_schema.sql) in this repository.
3. Copy the entire SQL content, paste it into the Supabase SQL Editor, and click **Run**.
   * *This creates all 19 database tables, Row-Level Security (RLS) policies, and helper security functions.*

---

## 🌱 Step 3: Run Database Seed Data
1. In the Supabase **SQL Editor**, open a new query.
2. Open the file [`supabase/seed.sql`](file:///d:/AI/Indian%20Shopping%20Mela/supabase/seed.sql) in this repository.
3. Copy the entire SQL content, paste it into the SQL Editor, and click **Run**.
   * *This loads the 10 core bazaar departments, verified sample sellers (Mumbai Mirror Boutique, Jaipur Jewel House, Desi Ghar Homewares), starting products with variants, multi-seller split orders, and financial ledger entries.*

---

## 🔑 Step 4: Add Your Keys to `.env`
1. In your Supabase dashboard, navigate to **Project Settings** → **API**.
2. Copy your **Project URL** and **anon (public)** key.
3. Create a `.env` file in the root of this project (or update existing `.env`):

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Once added, restart Vite:
```bash
npm run dev
```

Your storefront, seller portal, bulk upload engine, checkout, and admin financial ledger will now query and write to your live PostgreSQL database!
