-- ============================================================================
-- INDIAN SHOPPING MELA: CANONICAL PRODUCTION DATABASE SCHEMA
-- Migration: 20260907_canonical_schema.sql
-- Description: Fully reconciled schema matching database.types.ts exactly.
--              Authoritative source of truth for all tables, enums, RPCs,
--              RLS policies, indexes, and storage buckets.
-- Monetary:    All money fields use BIGINT amount_cents (integer cents AUD).
-- Last audit:  2026-09-09 — full sync against database.types.ts
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUM DEFINITIONS
--    All enums match database.types.ts exactly.
--    Existing enums are handled idempotently.
-- ----------------------------------------------------------------------------

-- User roles (granular, matches DB types)
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

-- Seller onboarding status (SCREAMING_SNAKE, matches DB types onboarding_status)
DO $$ BEGIN
    CREATE TYPE onboarding_status AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'INFO_REQUIRED',
        'APPROVED',
        'REJECTED',
        'SUSPENDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Document verification
DO $$ BEGIN
    CREATE TYPE document_verification_status AS ENUM (
        'PENDING',
        'VERIFIED',
        'REJECTED',
        'EXPIRED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product status (richer set matching DB types)
DO $$ BEGIN
    CREATE TYPE product_status AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'NEEDS_CHANGES',
        'APPROVED',
        'LIVE',
        'PAUSED',
        'OUT_OF_STOCK',
        'REJECTED',
        'ARCHIVED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product media status
DO $$ BEGIN
    CREATE TYPE media_status AS ENUM (
        'UPLOADING',
        'PROCESSING',
        'READY',
        'FAILED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cart status
DO $$ BEGIN
    CREATE TYPE cart_status AS ENUM (
        'ACTIVE',
        'CONVERTED',
        'ABANDONED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order status (master order)
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'PENDING',
        'PAYMENT_PENDING',
        'CONFIRMED',
        'PROCESSING',
        'PARTIALLY_SHIPPED',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order payment status (matches Stripe semantics)
DO $$ BEGIN
    CREATE TYPE order_payment_status AS ENUM (
        'PAYMENT_PENDING',
        'PAID',
        'PAYMENT_FAILED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payment method
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'STRIPE',
        'AFTERPAY',
        'ZIP',
        'KLARNA',
        'BANK_TRANSFER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sub-order (seller fulfilment) status (granular, matches DB types)
DO $$ BEGIN
    CREATE TYPE sub_order_status AS ENUM (
        'ORDER_CREATED',
        'SELLER_NOTIFIED',
        'SELLER_ACCEPTED',
        'PREPARING',
        'READY_TO_SHIP',
        'LABEL_CREATED',
        'PICKUP_SCHEDULED',
        'SHIPPED',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'DISPUTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Shipment carrier status
DO $$ BEGIN
    CREATE TYPE shipment_status AS ENUM (
        'PENDING',
        'LABEL_CREATED',
        'PICKED_UP',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'FAILED_ATTEMPT',
        'EXCEPTION',
        'RETURNED_TO_SENDER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Return status (prefixed, matches DB types)
DO $$ BEGIN
    CREATE TYPE return_status AS ENUM (
        'RETURN_REQUESTED',
        'RETURN_APPROVED',
        'RETURN_IN_TRANSIT',
        'RETURN_RECEIVED',
        'REFUND_PENDING',
        'REFUNDED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Payout status (matches business semantics in DB types)
DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM (
        'PAYOUT_HOLD',
        'PAYOUT_ELIGIBLE',
        'PAYOUT_PROCESSING',
        'PAID_TO_SELLER',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ledger entry type (merged from both models — full set)
DO $$ BEGIN
    CREATE TYPE ledger_entry_type AS ENUM (
        'CUSTOMER_CHARGE',
        'SELLER_GROSS',
        'ISM_COMMISSION',
        'GST_COLLECTED',
        'PAYMENT_FEE',
        'SHIPPING_FEE',
        'SHIPPING_CHARGE',
        'SHIPPING_COST',
        'DISCOUNT',
        'SELLER_PAYOUT',
        'CUSTOMER_REFUND',
        'REFUND',
        'DISPUTE_HOLD',
        'DISPUTE_RELEASE',
        'ADJUSTMENT',
        'TRANSFER',
        'PAYOUT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Inventory transaction type
DO $$ BEGIN
    CREATE TYPE inventory_tx_type AS ENUM (
        'INITIAL_STOCK',
        'RESERVATION_HOLD',
        'RESERVATION_RELEASE',
        'ORDER_FULFILLMENT',
        'MANUAL_ADJUSTMENT',
        'RETURN_RESTOCK',
        'DAMAGE_WRITE_OFF',
        'BULK_IMPORT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bulk import status
DO $$ BEGIN
    CREATE TYPE bulk_import_status AS ENUM (
        'PENDING',
        'PARSING',
        'VALIDATED',
        'IMPORTING',
        'COMPLETED',
        'FAILED',
        'CANCELLED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. USER PROFILES & SECURITY HELPERS
-- ----------------------------------------------------------------------------
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

-- Hardened SECURITY DEFINER functions with explicit search_path and row_security disabled to eliminate RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
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
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND role = 'admin_super'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off;

-- Automatic User Profile Provisioning Trigger
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp SET row_security = off;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. SELLERS, STAFF, AGREEMENTS, ADDRESSES, DOCUMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Identity (owner is the primary seller user)
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    slug TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    abn TEXT NOT NULL,
    about_text TEXT,
    logo_url TEXT,
    banner_url TEXT,
    -- Business classification
    business_type TEXT NOT NULL DEFAULT 'sole_trader',
    -- Operational
    commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.10,  -- decimal fraction e.g. 0.10 = 10%
    holiday_mode BOOLEAN NOT NULL DEFAULT FALSE,
    handling_days_default INT NOT NULL DEFAULT 2,
    -- Onboarding & compliance
    status onboarding_status NOT NULL DEFAULT 'DRAFT',
    terms_accepted_at TIMESTAMPTZ,
    terms_accepted_version TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    risk_flag BOOLEAN,
    -- Stripe Connect
    stripe_account_id TEXT,
    payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- Banking (BSB/Account for manual payouts)
    bank_bsb TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    -- Structured dispatch/return addresses as JSONB for quick reads
    dispatch_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    return_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seller staff (was seller_members — renamed to match DB types)
CREATE TABLE IF NOT EXISTS public.seller_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    staff_role TEXT NOT NULL DEFAULT 'staff',
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(seller_id, user_id)
);

-- Pending seller staff invitations (for invitees without an existing account yet, or
-- who simply haven't accepted). Real invite table with expiry — a token that only ever
-- lived in an audit_logs JSON blob has no expiry and no reliable lookup path.
CREATE TABLE IF NOT EXISTS public.seller_staff_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    invited_name TEXT,
    staff_role TEXT NOT NULL DEFAULT 'staff',
    permissions TEXT[] NOT NULL DEFAULT '{}',
    invite_token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted' | 'revoked' | 'expired'
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seller_staff_invites_token ON public.seller_staff_invites(invite_token);

CREATE OR REPLACE FUNCTION public.is_seller_member(seller_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.seller_staff
        WHERE seller_id = seller_uuid AND user_id = user_uuid AND is_active = TRUE
    ) OR EXISTS (
        SELECT 1 FROM public.sellers
        WHERE id = seller_uuid AND owner_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Seller physical addresses (separate table for structured storage/validation)
CREATE TABLE IF NOT EXISTS public.seller_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    address_type TEXT NOT NULL DEFAULT 'dispatch', -- 'dispatch' | 'return' | 'billing'
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    suburb TEXT NOT NULL,
    state TEXT NOT NULL,
    postcode TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'AU',
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seller legal document uploads
CREATE TABLE IF NOT EXISTS public.seller_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,  -- 'abn_certificate' | 'id_document' | 'bank_statement' etc.
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,      -- Supabase storage path
    file_size_bytes BIGINT,
    mime_type TEXT,
    status document_verification_status NOT NULL DEFAULT 'PENDING',
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seller agreements (ToS, seller agreement, privacy — immutable audit trail)
CREATE TABLE IF NOT EXISTS public.seller_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agreement_type TEXT NOT NULL DEFAULT 'seller_agreement',
    version TEXT NOT NULL DEFAULT 'v1.0',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT
);

-- ----------------------------------------------------------------------------
-- 4. TAXONOMY & CATALOGUE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    banner_url TEXT,
    icon_name TEXT,
    seo_title TEXT,
    seo_description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- FK to departments (correct model — not free text)
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    banner_url TEXT,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.category_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    code TEXT NOT NULL,           -- machine-readable key e.g. 'color', 'size'
    name TEXT NOT NULL,           -- display name e.g. 'Color', 'Size'
    attribute_type TEXT NOT NULL DEFAULT 'select',  -- 'select' | 'multi_select' | 'text' | 'number'
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    options JSONB,                -- cached option list for quick reads
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_id, code)
);

CREATE TABLE IF NOT EXISTS public.attribute_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID NOT NULL REFERENCES public.category_attributes(id) ON DELETE CASCADE,
    code TEXT NOT NULL,           -- machine key e.g. 'red'
    label TEXT NOT NULL,          -- display label e.g. 'Red'
    color_hex TEXT,               -- for color swatches
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    UNIQUE(attribute_id, code)
);

-- ----------------------------------------------------------------------------
-- 5. PRODUCTS, VARIANTS, MEDIA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    -- Denormalised department for fast filtering (kept in sync by trigger or app)
    department TEXT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    -- Physical/shipping attributes
    weight_kg NUMERIC(8,3),
    height_cm NUMERIC(8,2),
    length_cm NUMERIC(8,2),
    width_cm NUMERIC(8,2),
    fragile BOOLEAN,
    handling_days INT,
    -- Product-level attributes
    care_instructions TEXT,
    country_of_origin TEXT,
    key_features TEXT[],
    subcategory TEXT,
    -- ACL compliance
    return_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    -- Catalogue
    status product_status NOT NULL DEFAULT 'DRAFT',
    -- Denormalised rating summary (maintained by app on review submission)
    rating_average NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating_average >= 0 AND rating_average <= 5),
    rating_count INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    seller_sku TEXT NOT NULL,             -- Seller's own SKU
    -- Pricing (all in AUD dollars, numeric for display; cents in payments)
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    sale_price NUMERIC(10,2) CHECK (sale_price IS NULL OR sale_price >= 0),
    sale_start_at TIMESTAMPTZ,
    sale_end_at TIMESTAMPTZ,
    -- Inventory
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INT NOT NULL DEFAULT 5,
    -- Physical
    weight_kg_override NUMERIC(8,3),
    -- Attributes stored as JSONB for flexible key-value pairs
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Variant images (subset of product_media)
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, seller_sku)
);

-- Variant option links (FK-based model — attribute_id + option_id or custom_value)
CREATE TABLE IF NOT EXISTS public.product_variant_options (
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES public.category_attributes(id) ON DELETE RESTRICT,
    option_id UUID REFERENCES public.attribute_options(id) ON DELETE SET NULL,
    custom_value TEXT,    -- For free-text options not in the option list
    PRIMARY KEY (variant_id, attribute_id)
);

-- Product media (images + videos, with moderation lifecycle)
CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    media_type TEXT NOT NULL DEFAULT 'image',   -- 'image' | 'video'
    url TEXT NOT NULL,
    status media_status NOT NULL DEFAULT 'UPLOADING',
    moderation_status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    thumbnail_url TEXT,
    duration_seconds NUMERIC(8,2),  -- for videos
    sort_order INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_media_sort ON public.product_media(product_id, sort_order);

-- Product moderation log (admin review trail)
CREATE TABLE IF NOT EXISTS public.product_moderation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    from_status product_status,
    to_status product_status NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Collections & collection membership
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    banner_url TEXT,
    tagline TEXT,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Named product_collections to match DB types
CREATE TABLE IF NOT EXISTS public.product_collections (
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (collection_id, product_id)
);

-- ----------------------------------------------------------------------------
-- 6. INVENTORY — ATOMIC RESERVATIONS & TRANSACTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT,
    order_id TEXT,
    quantity INT NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'fulfilled' | 'cancelled' | 'expired'
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_res_active ON public.inventory_reservations(variant_id, expires_at) WHERE status = 'active';

-- Inventory ledger (every stock movement)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    -- delta: positive = stock in, negative = stock out
    delta INT NOT NULL,
    balance_after INT NOT NULL,
    -- reason is a free-text label (maps to inventory_tx_type values)
    reason TEXT NOT NULL,
    note TEXT,
    order_id TEXT,
    batch_id UUID,   -- for bulk import tracking
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic Inventory Reservation RPC
-- Signature matches DB types: (p_variant_id, p_quantity, p_reference_id, p_reference_type, p_hold_minutes?)
CREATE OR REPLACE FUNCTION public.reserve_inventory_atomic(
    p_variant_id UUID,
    p_quantity INT,
    p_reference_id TEXT,
    p_reference_type TEXT,
    p_hold_minutes INT DEFAULT 15
)
RETURNS JSONB AS $$
DECLARE
    v_stock INT;
    v_reserved INT;
    v_available INT;
    v_reservation_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than 0');
    END IF;

    -- Lock variant row for concurrency safety
    SELECT stock_quantity INTO v_stock
    FROM public.product_variants
    WHERE id = p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product variant not found');
    END IF;

    -- Sum active unexpired reservations
    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM public.inventory_reservations
    WHERE variant_id = p_variant_id
      AND status = 'active'
      AND expires_at > NOW();

    v_available := v_stock - v_reserved;

    IF v_available < p_quantity THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient inventory',
            'available', v_available,
            'requested', p_quantity
        );
    END IF;

    v_expires_at := NOW() + (p_hold_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.inventory_reservations (
        variant_id, session_id, quantity, status, expires_at
    ) VALUES (
        p_variant_id,
        p_reference_id,
        p_quantity,
        'active',
        v_expires_at
    ) RETURNING id INTO v_reservation_id;

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'variant_id', p_variant_id,
        'quantity', p_quantity,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Commit Inventory Reservation on Order Placement (arg order matches DB types)
CREATE OR REPLACE FUNCTION public.commit_inventory_reservation(
    p_order_id TEXT,
    p_reservation_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_res RECORD;
    v_new_stock INT;
BEGIN
    SELECT * INTO v_res
    FROM public.inventory_reservations
    WHERE id = p_reservation_id AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Active reservation not found or expired');
    END IF;

    -- Check idempotency: already committed for this order?
    IF v_res.order_id IS NOT NULL AND v_res.order_id = p_order_id THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    -- Atomically deduct stock
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity - v_res.quantity,
        updated_at = NOW()
    WHERE id = v_res.variant_id
    RETURNING stock_quantity INTO v_new_stock;

    -- Record transaction
    INSERT INTO public.inventory_transactions (
        variant_id, delta, balance_after, reason, order_id, note
    ) VALUES (
        v_res.variant_id, -v_res.quantity, v_new_stock, 'ORDER_FULFILLMENT', p_order_id, 'Reservation committed'
    );

    -- Mark reservation fulfilled
    UPDATE public.inventory_reservations
    SET status = 'fulfilled', order_id = p_order_id
    WHERE id = p_reservation_id;

    RETURN jsonb_build_object('success', true, 'balance_after', v_new_stock);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Release a specific reservation
CREATE OR REPLACE FUNCTION public.release_inventory_reservation(
    p_reservation_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_updated INT;
BEGIN
    UPDATE public.inventory_reservations
    SET status = 'cancelled'
    WHERE id = p_reservation_id AND status = 'active';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reservation not found or not active');
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Release Expired Reservations (called by scheduled job)
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE public.inventory_reservations
    SET status = 'expired'
    WHERE status = 'active' AND expires_at <= NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 7. CUSTOMER ADDRESSES & CARTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_phone TEXT,
    line1 TEXT NOT NULL,
    line2 TEXT,
    suburb TEXT NOT NULL,
    state TEXT NOT NULL,
    postcode TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'AU',
    is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
    is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_token TEXT,
    status cart_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_carts_guest ON public.carts(guest_token) WHERE guest_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cart_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cart_id, variant_id)
);

CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- 8. ORDERS — MASTER ORDERS, SUB-ORDERS, ITEMS, STATUS HISTORY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    shipping_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_total >= 0),
    discount_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    gst_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gst_total >= 0),
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    status order_status NOT NULL DEFAULT 'PENDING',
    payment_status order_payment_status NOT NULL DEFAULT 'PAYMENT_PENDING',
    payment_provider TEXT NOT NULL DEFAULT 'STRIPE',
    payment_intent_id TEXT,
    payment_authorized_at TIMESTAMPTZ,
    currency TEXT NOT NULL DEFAULT 'AUD',
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sub_orders (
    id TEXT PRIMARY KEY,
    master_order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    package_label TEXT,
    -- Financial (computed server-side, stored for reporting)
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_seller_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Fulfilment
    status sub_order_status NOT NULL DEFAULT 'ORDER_CREATED',
    shipping_service TEXT,
    carrier TEXT,
    tracking_number TEXT,
    tracking_url TEXT,
    can_return_until TIMESTAMPTZ,   -- SET when delivered; = delivered_at + 7 days
    dispatch_deadline TIMESTAMPTZ,
    seller_accepted_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    sku TEXT,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
    gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    sub_order_id TEXT REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. PAYMENTS (integer cents — no floating point)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'STRIPE',
    provider_payment_id TEXT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'AUD',
    status TEXT NOT NULL,   -- maps to order_payment_status values
    payment_method_type TEXT,  -- 'card', 'afterpay_clearpay', etc.
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider_payment_id)
);

-- ----------------------------------------------------------------------------
-- 9.1 ATOMIC ORDER PREPARATION RPC (Prompt 6)
-- Atomically creates master order, sub-orders, order items snapshot, SELLER_GROSS ledger entries, and pending payment metadata
-- Returns JSON with order details, or raises exception to trigger 100% rollback
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_marketplace_order(
    p_order_id TEXT,
    p_order_number TEXT,
    p_customer_id UUID,
    p_customer_email TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_shipping_address JSONB,
    p_billing_address JSONB,
    p_subtotal NUMERIC,
    p_shipping_total NUMERIC,
    p_discount_total NUMERIC,
    p_gst_total NUMERIC,
    p_total_amount NUMERIC,
    p_payment_intent_id TEXT,
    p_currency TEXT,
    p_idempotency_key TEXT,
    p_sub_orders JSONB,
    p_total_amount_cents BIGINT
)
RETURNS JSONB
AS $$
DECLARE
    v_existing_order RECORD;
    v_sub RECORD;
    v_item RECORD;
    v_sub_order_id TEXT;
    v_subtotal NUMERIC;
    v_shipping_cost NUMERIC;
    v_commission_rate NUMERIC;
    v_commission_amount NUMERIC;
    v_net_seller_amount NUMERIC;
    v_seller_id UUID;
    v_sub_count INT := 0;
BEGIN
    -- 1. Idempotency Guard: Check if order with this idempotency key already exists
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, order_number, total_amount, gst_total, payment_intent_id
        INTO v_existing_order
        FROM public.orders
        WHERE idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'idempotent', true,
                'master_order_id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'total_amount', v_existing_order.total_amount,
                'gst_total', v_existing_order.gst_total,
                'payment_intent_id', v_existing_order.payment_intent_id
            );
        END IF;
    END IF;

    -- 2. Insert Master Order record
    INSERT INTO public.orders (
        id,
        order_number,
        customer_id,
        customer_email,
        customer_name,
        customer_phone,
        shipping_address,
        billing_address,
        subtotal,
        shipping_total,
        discount_total,
        gst_total,
        total_amount,
        status,
        payment_status,
        payment_provider,
        payment_intent_id,
        currency,
        idempotency_key,
        created_at,
        updated_at
    ) VALUES (
        p_order_id,
        p_order_number,
        p_customer_id,
        p_customer_email,
        p_customer_name,
        p_customer_phone,
        p_shipping_address,
        p_billing_address,
        p_subtotal,
        p_shipping_total,
        p_discount_total,
        p_gst_total,
        p_total_amount,
        'PENDING',
        'PAYMENT_PENDING',
        'STRIPE',
        p_payment_intent_id,
        COALESCE(p_currency, 'AUD'),
        p_idempotency_key,
        NOW(),
        NOW()
    );

    -- 3. Loop over Sub-Orders JSON
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_sub_orders)
    LOOP
        v_sub_count := v_sub_count + 1;
        v_sub_order_id := (v_sub.value->>'id');
        v_seller_id := (v_sub.value->>'seller_id')::UUID;
        v_subtotal := (v_sub.value->>'subtotal')::NUMERIC;
        v_shipping_cost := COALESCE((v_sub.value->>'shipping_cost')::NUMERIC, 0);
        v_commission_rate := COALESCE((v_sub.value->>'commission_rate_pct')::NUMERIC, 12.0);
        v_commission_amount := ROUND((v_subtotal * v_commission_rate / 100.0), 2);
        v_net_seller_amount := ROUND((v_subtotal + v_shipping_cost - v_commission_amount), 2);

        INSERT INTO public.sub_orders (
            id,
            master_order_id,
            seller_id,
            package_label,
            subtotal,
            shipping_cost,
            commission_rate_pct,
            commission_amount,
            net_seller_amount,
            status,
            shipping_service,
            created_at,
            updated_at
        ) VALUES (
            v_sub_order_id,
            p_order_id,
            v_seller_id,
            (v_sub.value->>'package_label'),
            v_subtotal,
            v_shipping_cost,
            v_commission_rate,
            v_commission_amount,
            v_net_seller_amount,
            'ORDER_CREATED',
            (v_sub.value->>'shipping_service'),
            NOW(),
            NOW()
        );

        -- 4. Loop over Order Items in this Sub-Order
        FOR v_item IN SELECT * FROM jsonb_array_elements(v_sub.value->'items')
        LOOP
            INSERT INTO public.order_items (
                id,
                sub_order_id,
                product_id,
                variant_id,
                product_name,
                variant_name,
                sku,
                unit_price,
                quantity,
                total_price,
                gst_amount,
                created_at
            ) VALUES (
                gen_random_uuid(),
                v_sub_order_id,
                (v_item.value->>'product_id')::UUID,
                (v_item.value->>'variant_id')::UUID,
                (v_item.value->>'product_name'),
                COALESCE(v_item.value->>'variant_name', 'Standard'),
                (v_item.value->>'sku'),
                (v_item.value->>'unit_price')::NUMERIC,
                (v_item.value->>'quantity')::INT,
                (v_item.value->>'total_price')::NUMERIC,
                COALESCE((v_item.value->>'gst_amount')::NUMERIC, ROUND((v_item.value->>'total_price')::NUMERIC / 11.0, 2)),
                NOW()
            );
        END LOOP;

        -- 5. Record initial SELLER_GROSS ledger entry
        INSERT INTO public.ledger_entries (
            id,
            order_id,
            sub_order_id,
            seller_id,
            entry_type,
            amount_cents,
            currency,
            description,
            created_at
        ) VALUES (
            gen_random_uuid(),
            p_order_id,
            v_sub_order_id,
            v_seller_id,
            'SELLER_GROSS',
            ROUND(v_net_seller_amount * 100)::BIGINT,
            COALESCE(p_currency, 'AUD'),
            'Pending gross allocation for sub-order ' || v_sub_order_id || ' (held 14 days post-delivery)',
            NOW()
        );
    END LOOP;

    -- 6. Insert Pending Payment record
    IF p_payment_intent_id IS NOT NULL THEN
        INSERT INTO public.payments (
            id,
            order_id,
            provider,
            provider_payment_id,
            amount_cents,
            currency,
            status,
            idempotency_key,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            p_order_id,
            'STRIPE',
            p_payment_intent_id,
            p_total_amount_cents,
            COALESCE(p_currency, 'AUD'),
            'PAYMENT_PENDING',
            p_idempotency_key,
            NOW(),
            NOW()
        );
    END IF;

    RETURN jsonb_build_object(
        'idempotent', false,
        'master_order_id', p_order_id,
        'order_number', p_order_number,
        'total_amount', p_total_amount,
        'gst_total', p_gst_total,
        'package_count', v_sub_count,
        'payment_intent_id', p_payment_intent_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 10. IMMUTABLE FINANCIAL LEDGER (append-only, integer cents)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    sub_order_id TEXT REFERENCES public.sub_orders(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
    payout_batch_id TEXT,
    entry_type ledger_entry_type NOT NULL,
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'AUD',
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- NO updated_at — ledger is append-only
);

-- Append-only protection: prevent UPDATE and DELETE on ledger_entries
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ledger_entries is append-only. Mutation of financial history is forbidden.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_ledger_no_update ON public.ledger_entries;
CREATE TRIGGER trg_ledger_no_update
    BEFORE UPDATE OR DELETE ON public.ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

-- ----------------------------------------------------------------------------
-- 11. PAYOUTS & PAYOUT LEDGER (integer cents)
-- ----------------------------------------------------------------------------
-- Payout ledger: one row per sub_order showing seller's gross, commission, net
CREATE TABLE IF NOT EXISTS public.payout_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE RESTRICT,
    gross_amount NUMERIC(10,2) NOT NULL,
    platform_commission NUMERIC(10,2) NOT NULL,
    shipping_cost_allocated NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_payout NUMERIC(10,2) NOT NULL,
    status payout_status NOT NULL DEFAULT 'PAYOUT_HOLD',
    eligible_at TIMESTAMPTZ,   -- SET to delivered_at + 14 days
    hold_reason TEXT,
    payout_batch_id TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sub_order_id)
);

-- Payout batches (seller transfer records)
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    payout_batch_id TEXT,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'AUD',
    status payout_status NOT NULL DEFAULT 'PAYOUT_HOLD',
    provider_transfer_id TEXT,
    failure_reason TEXT,
    paid_at TIMESTAMPTZ,
    cleared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payout items link payouts to ledger entries
CREATE TABLE IF NOT EXISTS public.payout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
    ledger_entry_id UUID NOT NULL REFERENCES public.ledger_entries(id) ON DELETE RESTRICT,
    amount_cents BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 12. RETURNS, REFUNDS (integer cents)
-- ----------------------------------------------------------------------------
-- Primary return record (ACL / change-of-mind)
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    reason_code TEXT NOT NULL DEFAULT 'CHANGE_OF_MIND',
    evidence_urls TEXT[],
    status return_status NOT NULL DEFAULT 'RETURN_REQUESTED',
    seller_notes TEXT,
    admin_notes TEXT,
    payout_hold_placed BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Return requests (individual item-level — maps to returns)
CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    refund_amount NUMERIC(10,2),
    evidence_urls TEXT[],
    status return_status NOT NULL DEFAULT 'RETURN_REQUESTED',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Return line items
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    condition_reported TEXT,
    refund_amount_cents BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refund records (linked to Stripe refund, idempotent)
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    sub_order_id TEXT REFERENCES public.sub_orders(id) ON DELETE SET NULL,
    return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL,
    provider_refund_id TEXT,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'AUD',
    status TEXT NOT NULL DEFAULT 'succeeded',
    reason TEXT NOT NULL,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider_refund_id)
);

-- ----------------------------------------------------------------------------
-- 13. SHIPPING & CARRIER LOGISTICS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    carrier TEXT NOT NULL DEFAULT 'AUSPOST',
    shipping_service TEXT NOT NULL DEFAULT 'Standard Parcel Post',
    tracking_number TEXT,
    provider_shipment_id TEXT,
    label_url TEXT,
    pod_signature_url TEXT,
    status TEXT NOT NULL DEFAULT 'LABEL_CREATED',   -- maps to shipment_status values
    shipping_cost_cents BIGINT NOT NULL DEFAULT 0,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    event_timestamp TIMESTAMPTZ NOT NULL,
    carrier_status TEXT NOT NULL,    -- raw carrier status string
    ism_status TEXT NOT NULL,        -- normalised ISM status (maps to shipment_status)
    event_description TEXT NOT NULL,
    location TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 14. PRODUCT REVIEWS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    body TEXT,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'APPROVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 15. COMMUNICATIONS & NOTIFICATIONS
-- ----------------------------------------------------------------------------

-- Outbound notification log (email/SMS — matches DB types model)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL,      -- 'order' | 'return' | 'payout' etc.
    entity_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',   -- 'email' | 'sms' | 'push'
    recipient_email TEXT,
    recipient_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent' | 'failed' | 'bounced'
    provider_message_id TEXT,
    error_message TEXT,
    idempotency_key TEXT,
    -- Render inputs preserved so a failed send can actually be retried with identical
    -- content, not just re-attempted with nothing to send.
    payload JSONB,
    attempts INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In-app bell notifications (separate from outbound log)
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications(user_id, is_read, created_at DESC);

-- ----------------------------------------------------------------------------
-- 16. AUDIT LOGS, WEBHOOK EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_data JSONB,
    after_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    error_message TEXT,
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider_event_id)
);

-- ----------------------------------------------------------------------------
-- 17. BULK IMPORT (matches DB types exactly)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bulk_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',  -- 'standard' | 'update_only' | 'create_only'
    template_version TEXT NOT NULL DEFAULT 'v1',
    total_rows INT NOT NULL DEFAULT 0,
    created_count INT NOT NULL DEFAULT 0,
    updated_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',  -- maps to bulk_import_status values
    error_report_csv_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.bulk_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.bulk_import_batches(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    sku TEXT,
    raw_data JSONB NOT NULL,
    is_valid BOOLEAN NOT NULL DEFAULT FALSE,
    validation_errors TEXT[],
    imported_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    imported_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 18. MARKETPLACE CONFIG (versioned, with audit trail)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 19. STORAGE BUCKETS
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('product-media', 'product-media', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']),
    ('seller-documents', 'seller-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
    ('return-evidence', 'return-evidence', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 20. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_configs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users read own profile; admins read all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "System insert profile on signup"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Sellers
CREATE POLICY "Public view approved sellers"
ON public.sellers FOR SELECT
USING (status = 'APPROVED' OR public.is_seller_member(id) OR public.is_admin());

CREATE POLICY "Sellers update own store"
ON public.sellers FOR UPDATE
USING (public.is_seller_member(id) OR public.is_admin());

CREATE POLICY "Users can create seller application"
ON public.sellers FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- Seller staff
CREATE POLICY "Seller members manage own staff"
ON public.seller_staff FOR ALL
USING (public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Seller members manage own staff invites"
ON public.seller_staff_invites FOR ALL
USING (public.is_seller_member(seller_id) OR public.is_admin());

-- Seller documents
CREATE POLICY "Sellers manage own documents; admins read all"
ON public.seller_documents FOR ALL
USING (public.is_seller_member(seller_id) OR public.is_admin());

-- Seller agreements (immutable — INSERT only for owner, no UPDATE/DELETE)
CREATE POLICY "Sellers insert own agreements"
ON public.seller_agreements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Sellers read own agreements; admins read all"
ON public.seller_agreements FOR SELECT
USING (public.is_seller_member(seller_id) OR public.is_admin());

-- Catalogue (public read for active, seller manage own)
CREATE POLICY "Public read active departments"
ON public.departments FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage departments"
ON public.departments FOR ALL USING (public.is_admin());

CREATE POLICY "Public read active categories"
ON public.categories FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins manage categories"
ON public.categories FOR ALL USING (public.is_admin());

CREATE POLICY "Public read category attributes"
ON public.category_attributes FOR SELECT USING (true);

CREATE POLICY "Admins manage category attributes"
ON public.category_attributes FOR ALL USING (public.is_admin());

CREATE POLICY "Public read attribute options"
ON public.attribute_options FOR SELECT USING (true);

CREATE POLICY "Public read active collections"
ON public.collections FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Public read collection products"
ON public.product_collections FOR SELECT USING (true);

-- Products
CREATE POLICY "Public view live products"
ON public.products FOR SELECT
USING (status = 'LIVE' OR public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Sellers manage own products"
ON public.products FOR ALL
USING (public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Public view variants of live products"
ON public.product_variants FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND (p.status = 'LIVE' OR public.is_seller_member(p.seller_id) OR public.is_admin())
));

CREATE POLICY "Sellers manage own variants"
ON public.product_variants FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id
      AND (public.is_seller_member(p.seller_id) OR public.is_admin())
));

CREATE POLICY "Public view product variant options"
ON public.product_variant_options FOR SELECT USING (true);

CREATE POLICY "Public view media of live products"
ON public.product_media FOR SELECT
USING (status = 'READY' OR EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_media.product_id
      AND (public.is_seller_member(p.seller_id) OR public.is_admin())
));

CREATE POLICY "Sellers manage own product media"
ON public.product_media FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_media.product_id
      AND (public.is_seller_member(p.seller_id) OR public.is_admin())
));

CREATE POLICY "Admins view moderation logs"
ON public.product_moderation_logs FOR SELECT USING (public.is_admin());

-- Carts (authenticated users — server handles guest carts via service role)
CREATE POLICY "Users manage own cart"
ON public.carts FOR ALL
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users manage own cart lines"
ON public.cart_lines FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.carts c
    WHERE c.id = cart_lines.cart_id AND (c.user_id = auth.uid() OR public.is_admin())
));

-- Customer addresses
CREATE POLICY "Users manage own addresses"
ON public.customer_addresses FOR ALL
USING (auth.uid() = user_id OR public.is_admin());

-- Wishlists
CREATE POLICY "Users manage own wishlist"
ON public.wishlists FOR ALL
USING (auth.uid() = user_id OR public.is_admin());

-- Orders
CREATE POLICY "Customers view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = customer_id OR public.is_admin());

CREATE POLICY "Sellers view own sub-orders"
ON public.sub_orders FOR SELECT
USING (public.is_seller_member(seller_id) OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = sub_orders.master_order_id AND o.customer_id = auth.uid()
) OR public.is_admin());

CREATE POLICY "Sellers update own sub-order status"
ON public.sub_orders FOR UPDATE
USING (public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Order items view policy"
ON public.order_items FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.sub_orders so
    WHERE so.id = order_items.sub_order_id AND (
        public.is_seller_member(so.seller_id) OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = so.master_order_id AND o.customer_id = auth.uid()) OR
        public.is_admin()
    )
));

-- Tracking: restricted to order owner, seller, admin
CREATE POLICY "Authorized parties view tracking"
ON public.tracking_events FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.shipments s
    JOIN public.sub_orders so ON so.id = s.sub_order_id
    WHERE s.id = tracking_events.shipment_id AND (
        public.is_seller_member(so.seller_id) OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = so.master_order_id AND o.customer_id = auth.uid()) OR
        public.is_admin()
    )
));

CREATE POLICY "Authorized parties view shipments"
ON public.shipments FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.sub_orders so
    WHERE so.id = shipments.sub_order_id AND (
        public.is_seller_member(so.seller_id) OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = so.master_order_id AND o.customer_id = auth.uid()) OR
        public.is_admin()
    )
));

-- Payments: admins and order owner
CREATE POLICY "Order owner and admin view payments"
ON public.payments FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = payments.order_id AND (o.customer_id = auth.uid() OR public.is_admin())
));

-- Ledger: admins and relevant sellers only
CREATE POLICY "Admins and sellers view own ledger entries"
ON public.ledger_entries FOR SELECT
USING (
    public.is_admin() OR
    (seller_id IS NOT NULL AND public.is_seller_member(seller_id))
);

CREATE POLICY "Ledger is append-only — no direct insert from client"
ON public.ledger_entries FOR INSERT
WITH CHECK (public.is_admin());  -- only service role bypasses; clients never insert directly

-- Payouts
CREATE POLICY "Sellers view own payout ledger"
ON public.payout_ledger FOR SELECT
USING (public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Sellers view own payouts"
ON public.payouts FOR SELECT
USING (public.is_seller_member(seller_id) OR public.is_admin());

-- Returns
CREATE POLICY "Customers view own returns; sellers view related returns"
ON public.returns FOR SELECT
USING (auth.uid() = customer_id OR EXISTS (
    SELECT 1 FROM public.sub_orders so
    WHERE so.id = returns.sub_order_id AND public.is_seller_member(so.seller_id)
) OR public.is_admin());

CREATE POLICY "Customers create returns"
ON public.returns FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Sellers and admins update return status"
ON public.returns FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.sub_orders so
    WHERE so.id = returns.sub_order_id AND public.is_seller_member(so.seller_id)
) OR public.is_admin());

CREATE POLICY "Customers view own return requests"
ON public.return_requests FOR SELECT
USING (auth.uid() = customer_id OR public.is_admin());

-- Notifications
CREATE POLICY "Admins view outbound notification log"
ON public.notifications FOR SELECT USING (public.is_admin());

CREATE POLICY "Users view own in-app notifications"
ON public.user_notifications FOR ALL
USING (auth.uid() = user_id OR public.is_admin());

-- Product reviews
CREATE POLICY "Public view approved reviews"
ON public.product_reviews FOR SELECT
USING (status = 'APPROVED' OR auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Authenticated users submit reviews"
ON public.product_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Audit logs (admins only)
CREATE POLICY "Admins view audit logs"
ON public.audit_logs FOR SELECT USING (public.is_admin());

-- Webhook events (admins only)
CREATE POLICY "Admins view webhook events"
ON public.webhook_events FOR SELECT USING (public.is_admin());

-- Bulk import (sellers manage own)
CREATE POLICY "Sellers manage own bulk imports"
ON public.bulk_import_batches FOR ALL
USING (public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Sellers view own import rows"
ON public.bulk_import_rows FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.bulk_import_batches b
    WHERE b.id = bulk_import_rows.batch_id
      AND (public.is_seller_member(b.seller_id) OR public.is_admin())
));

-- Marketplace config (admins manage, public read non-sensitive keys)
CREATE POLICY "Public read marketplace config"
ON public.marketplace_configs FOR SELECT USING (true);

CREATE POLICY "Admins manage marketplace config"
ON public.marketplace_configs FOR ALL USING (public.is_admin());

-- Inventory (server role manages; sellers view own)
CREATE POLICY "Sellers view own inventory transactions"
ON public.inventory_transactions FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.product_variants pv
    JOIN public.products p ON p.id = pv.product_id
    WHERE pv.id = inventory_transactions.variant_id
      AND (public.is_seller_member(p.seller_id) OR public.is_admin())
));

-- ----------------------------------------------------------------------------
-- 21. STORAGE BUCKET RLS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY "Public access for product media"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

CREATE POLICY "Authenticated sellers upload product media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-media' AND auth.role() = 'authenticated');

-- Upload is scoped to the caller's own folder, matching the SELECT policies below —
-- "any authenticated user" with no folder check would let anyone plant a file inside
-- another user's private evidence/document folder (they couldn't read it back given the
-- SELECT policy, but it's still an unauthorized write into someone else's private space).
CREATE POLICY "Users upload own seller documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'seller-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own return evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'return-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Restricted access to seller documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'seller-documents' AND (
    public.is_admin() OR
    (storage.foldername(name))[1] = auth.uid()::text
));

CREATE POLICY "Restricted access to return evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'return-evidence' AND (
    public.is_admin() OR
    (storage.foldername(name))[1] = auth.uid()::text
));

-- ----------------------------------------------------------------------------
-- 22. PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_status_category ON public.products(status, category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller_status ON public.products(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_seller_sku ON public.product_variants(seller_sku);
CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON public.orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_seller_status ON public.sub_orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_orders_master ON public.sub_orders(master_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sub_order ON public.order_items(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_variant ON public.inventory_reservations(variant_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_sub_order ON public.ledger_entries(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_type_created ON public.ledger_entries(entry_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_seller ON public.ledger_entries(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_ledger_seller ON public.payout_ledger(seller_id, status, eligible_at);
CREATE INDEX IF NOT EXISTS idx_returns_sub_order ON public.returns(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON public.notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_lookup ON public.webhook_events(provider, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_import_batches_seller ON public.bulk_import_batches(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON public.sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_owner ON public.sellers(owner_id);
