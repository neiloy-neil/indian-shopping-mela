-- ============================================================================
-- INDIAN SHOPPING MELA — GOTRUE TOKEN SCAN ERROR FIX
-- Fixes: sql: Scan error on column index 3, name "confirmation_token": converting NULL to string is unsupported
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/njqejotcqldimlyxwfrn/sql/new
-- ============================================================================

-- 1. Fix all NULL token columns across auth.users to empty string '' (GoTrue requirement)
UPDATE auth.users
SET
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    reauthentication_token = COALESCE(reauthentication_token, ''),
    email_change = COALESCE(email_change, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, ''),
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE 
    confirmation_token IS NULL OR 
    recovery_token IS NULL OR 
    email_change_token_new IS NULL OR
    email = 'admin@indianshoppingmela.com.au';

-- 2. Ensure admin account in auth.users has exact non-null strings and confirmed status
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
            id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, confirmed_at,
            confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
            reauthentication_token, email_change, phone_change, phone_change_token,
            raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            v_email,
            crypt(v_password, gen_salt('bf')),
            NOW(),
            NOW(),
            '', '', '', '', '', '', '', '',
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
            confirmed_at = COALESCE(confirmed_at, NOW()),
            confirmation_token = '',
            recovery_token = '',
            email_change_token_new = '',
            email_change_token_current = '',
            reauthentication_token = '',
            email_change = '',
            phone_change = '',
            phone_change_token = '',
            raw_app_meta_data = jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{role}', '"admin_super"'),
            raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"admin_super"'),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- 3. Ensure auth.identities has valid matching record
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

    -- 4. Ensure public.profiles has admin_super role
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_user_id, v_email, 'Priya Sharma (ISM Admin)', 'admin_super')
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin_super',
        full_name = 'Priya Sharma (ISM Admin)',
        email = v_email,
        updated_at = NOW();
END $$;
