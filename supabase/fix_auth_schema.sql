-- ============================================================================
-- INDIAN SHOPPING MELA — COMPLETE AUTH CLEANUP & DIAGNOSTIC FIX
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/njqejotcqldimlyxwfrn/sql/new
-- ============================================================================

-- 1. Drop all potentially failing triggers on auth.users
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_schema = 'auth' AND event_object_table = 'users'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trg.trigger_name) || ' ON auth.users CASCADE;';
    END LOOP;
END $$;

-- 2. Drop all conflicting is_admin / is_super_admin overloaded functions
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin(UUID) CASCADE;

-- 3. Ensure user_role enum exists
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'customer',
        'seller_owner',
        'seller_staff',
        'admin_support',
        'admin_catalogue',
        'admin_finance',
        'admin_super'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Ensure profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    phone TEXT,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Hardened, non-recursive is_admin & is_super_admin functions
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF user_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid
          AND role IN ('admin_support', 'admin_catalogue', 'admin_finance', 'admin_super')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    IF user_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND role = 'admin_super'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off;

-- 6. Provide fail-safe Custom Access Token (JWT) hook if enabled in Dashboard
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
  DECLARE
    claims jsonb;
    user_role text;
  BEGIN
    SELECT role::text INTO user_role FROM public.profiles WHERE id = (event->>'user_id')::uuid;
    claims := event->'claims';
    IF user_role IS NOT NULL THEN
      claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
      claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(user_role));
    END IF;
    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
  EXCEPTION WHEN OTHERS THEN
    RETURN event;
  END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 7. Safe non-recursive RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile; admins read all" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "System insert profile on signup" ON public.profiles;

CREATE POLICY "Users read own profile; admins read all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "System insert profile on signup"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 8. Sync all auth.users into profiles table with admin_super for admin email
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Priya Sharma (ISM Admin)'), 
    CASE 
        WHEN email = 'admin@indianshoppingmela.com.au' THEN 'admin_super'::user_role
        ELSE 'customer'::user_role
    END
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    role = CASE 
        WHEN public.profiles.email = 'admin@indianshoppingmela.com.au' THEN 'admin_super'::user_role
        ELSE public.profiles.role
    END;
