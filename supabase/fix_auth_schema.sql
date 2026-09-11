-- ============================================================================
-- INDIAN SHOPPING MELA — PASSWORD RESET & AUTH REPAIR (NO DELETION NEEDED)
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

-- 2. Drop all triggers on auth.users to eliminate potential failures during sign-in
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

-- 3. Drop conflicting functions with CASCADE
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin(UUID) CASCADE;

-- 4. Recreate non-recursive is_admin & is_super_admin functions
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

-- 5. Ensure profiles table structure is exact
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

-- 7. Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

-- 8. Direct update of existing admin in auth.users and auth.identities
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'admin@indianshoppingmela.com.au';
    v_password TEXT := 'Mela2026!Admin#';
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    IF v_user_id IS NULL THEN
        v_user_id := '00000000-0000-0000-0000-000000000001';
        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
        ) VALUES (
            v_user_id,
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
        );
    ELSE
        UPDATE auth.users
        SET 
            encrypted_password = crypt(v_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin_super"'),
            raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin_super"'),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Upsert into auth.identities
    DELETE FROM auth.identities WHERE user_id = v_user_id;
    
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
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_email,
        NOW(),
        NOW(),
        NOW()
    );

    -- Upsert profile
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_user_id, v_email, 'Priya Sharma (ISM Admin)', 'admin_super')
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin_super',
        full_name = 'Priya Sharma (ISM Admin)',
        email = v_email,
        updated_at = NOW();
END $$;
