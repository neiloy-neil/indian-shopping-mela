-- ============================================================================
-- INDIAN SHOPPING MELA — COMPLETE SUPABASE AUTH & IDENTITY RESTORATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/njqejotcqldimlyxwfrn/sql/new
-- ============================================================================

-- 1. Ensure user_role enum exists
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

-- 2. Drop all conflicting functions with CASCADE
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin(UUID) CASCADE;

-- 3. Recreate functions with row_security = off to prevent infinite RLS recursion
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

-- 4. Ensure profiles table structure is exact
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

-- 5. Automatic User Profile Provisioning Trigger (Safe & Fail-Safe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(
            NULLIF(NEW.raw_app_meta_data->>'role', '')::user_role,
            NULLIF(NEW.raw_user_meta_data->>'role', '')::user_role,
            'customer'::user_role
        )
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never crash auth.users insert if profile creation has a temporary issue
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. Safe RLS policies for profiles
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

-- 7. Grant full permissions to all Supabase internal roles including supabase_auth_admin
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 8. Provision Admin Account in auth.users, auth.identities, and public.profiles
DO $$
DECLARE
    v_admin_id UUID := '00000000-0000-0000-0000-000000000001';
    v_email TEXT := 'admin@indianshoppingmela.com.au';
    v_password TEXT := 'Mela2026!Admin#';
BEGIN
    -- 8a. Insert / Update auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
    ) VALUES (
        v_admin_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        crypt(v_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"],"role":"admin_super"}'::jsonb,
        '{"full_name":"Priya Sharma (ISM Admin)","role":"admin_super"}'::jsonb,
        FALSE,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        encrypted_password = crypt(v_password, gen_salt('bf')),
        email = v_email,
        email_confirmed_at = NOW(),
        raw_app_meta_data = '{"provider":"email","providers":["email"],"role":"admin_super"}'::jsonb,
        raw_user_meta_data = '{"full_name":"Priya Sharma (ISM Admin)","role":"admin_super"}'::jsonb,
        updated_at = NOW();

    -- 8b. Insert / Update auth.identities (MANDATORY for GoTrue password auth!)
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        v_admin_id,
        v_admin_id,
        jsonb_build_object('sub', v_admin_id::text, 'email', v_email),
        'email',
        v_email,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
        identity_data = jsonb_build_object('sub', v_admin_id::text, 'email', v_email),
        updated_at = NOW();

    -- 8c. Insert / Update public.profiles
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_admin_id, v_email, 'Priya Sharma (ISM Admin)', 'admin_super')
    ON CONFLICT (id) DO UPDATE SET
        email = v_email,
        role = 'admin_super',
        full_name = 'Priya Sharma (ISM Admin)',
        updated_at = NOW();
END $$;
