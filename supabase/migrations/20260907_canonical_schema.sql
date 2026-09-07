-- ============================================================================
-- INDIAN SHOPPING MELA: CANONICAL PRODUCTION DATABASE SCHEMA
-- Migration: 20260907_canonical_schema.sql
-- Description: Unified, consistent marketplace schema resolving all audit conflicts.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUM DEFINITIONS (Standardized snake_case)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'seller', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE seller_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'suspended', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('DRAFT', 'PENDING_REVIEW', 'LIVE', 'REJECTED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE sub_order_status AS ENUM ('NEW_ORDER', 'ACCEPTED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE order_payment_status AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('STRIPE', 'AFTERPAY', 'ZIP', 'KLARNA', 'BANK_TRANSFER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE shipment_status AS ENUM ('PENDING', 'LABEL_CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_ATTEMPT', 'EXCEPTION', 'RETURNED_TO_SENDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE return_status AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'RECEIVED', 'INSPECTED', 'REFUNDED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payout_status AS ENUM ('PENDING', 'SCHEDULED', 'PROCESSING', 'TRANSFERRED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE ledger_entry_type AS ENUM ('CUSTOMER_CHARGE', 'SELLER_GROSS', 'ISM_COMMISSION', 'GST_COLLECTED', 'SHIPPING_FEE', 'SELLER_PAYOUT', 'CUSTOMER_REFUND', 'DISPUTE_HOLD', 'DISPUTE_RELEASE', 'ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE inventory_tx_type AS ENUM ('INITIAL_STOCK', 'RESERVATION_HOLD', 'RESERVATION_RELEASE', 'ORDER_FULFILLMENT', 'MANUAL_ADJUSTMENT', 'RETURN_RESTOCK', 'DAMAGE_WRITE_OFF', 'BULK_IMPORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE bulk_import_status AS ENUM ('PENDING', 'PARSING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'CANCELLED');
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
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hardened Security Definer Functions
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 3. SELLERS & VENDOR IDENTITY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    store_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    abn TEXT,
    gstin TEXT,
    phone TEXT,
    email TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    return_policy TEXT,
    shipping_policy TEXT,
    commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    status seller_status NOT NULL DEFAULT 'draft',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    onboarding_step INT NOT NULL DEFAULT 1,
    stripe_account_id TEXT,
    payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    bank_bsb TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(seller_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_seller_member(seller_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.seller_members
        WHERE seller_id = seller_uuid AND user_id = user_uuid
    ) OR EXISTS (
        SELECT 1 FROM public.sellers
        WHERE id = seller_uuid AND user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.seller_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    address_type TEXT NOT NULL DEFAULT 'dispatch',
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    suburb TEXT NOT NULL,
    state TEXT NOT NULL,
    postcode TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'AU',
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_url TEXT NOT NULL,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    reviewer_notes TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. TAXONOMY & CATALOGUE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    banner_url TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collection_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.category_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    attribute_name TEXT NOT NULL,
    attribute_type TEXT NOT NULL DEFAULT 'select',
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    filterable BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attribute_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID NOT NULL REFERENCES public.category_attributes(id) ON DELETE CASCADE,
    option_value TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);



CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    sale_price NUMERIC(10,2) CHECK (sale_price IS NULL OR sale_price >= 0),
    cost_price NUMERIC(10,2),
    sku TEXT,
    barcode TEXT,
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    status product_status NOT NULL DEFAULT 'DRAFT',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
    is_ready_to_ship BOOLEAN NOT NULL DEFAULT FALSE,
    fabric TEXT,
    material TEXT,
    craft_region TEXT,
    occassion TEXT,
    care_instructions TEXT,
    weight_grams INT NOT NULL DEFAULT 500,
    dimensions_cm JSONB,
    tags TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0,
    rating_count INT NOT NULL DEFAULT 0,
    views_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sku TEXT UNIQUE,
    price NUMERIC(10,2),
    compare_at_price NUMERIC(10,2),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    weight_grams INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variant_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    option_name TEXT NOT NULL,
    option_value TEXT NOT NULL,
    UNIQUE(variant_id, option_name)
);

CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL DEFAULT 'image',
    url TEXT NOT NULL,
    alt_text TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_media_sort ON public.product_media(product_id, sort_order);

-- ----------------------------------------------------------------------------
-- 5. INVENTORY & CONCURRENCY RESERVATIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    session_id TEXT,
    order_id TEXT,
    quantity INT NOT NULL CHECK (quantity > 0),
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_res_active ON public.inventory_reservations(variant_id, expires_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    transaction_type inventory_tx_type NOT NULL,
    quantity INT NOT NULL,
    balance_after INT NOT NULL,
    reference_id TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic Inventory Reservation RPC
CREATE OR REPLACE FUNCTION public.reserve_inventory_atomic(
    p_variant_id UUID,
    p_quantity INT,
    p_session_id TEXT,
    p_ttl_minutes INT DEFAULT 15
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

    -- Lock variant row for concurrency
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

    v_expires_at := NOW() + (p_ttl_minutes || ' minutes')::INTERVAL;

    INSERT INTO public.inventory_reservations (
        variant_id, session_id, quantity, status, expires_at
    ) VALUES (
        p_variant_id, p_session_id, p_quantity, 'active', v_expires_at
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

-- Commit Inventory Reservation on Order Placement
CREATE OR REPLACE FUNCTION public.commit_inventory_reservation(
    p_reservation_id UUID,
    p_order_id TEXT
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

    -- Deduct stock from variant
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity - v_res.quantity,
        updated_at = NOW()
    WHERE id = v_res.variant_id
    RETURNING stock_quantity INTO v_new_stock;

    -- Deduct stock from main product
    UPDATE public.products p
    SET stock_quantity = (
        SELECT COALESCE(SUM(stock_quantity), 0)
        FROM public.product_variants
        WHERE product_id = p.id
    ),
    updated_at = NOW()
    FROM public.product_variants pv
    WHERE pv.id = v_res.variant_id AND p.id = pv.product_id;

    -- Record transaction
    INSERT INTO public.inventory_transactions (
        variant_id, transaction_type, quantity, balance_after, reference_id, notes
    ) VALUES (
        v_res.variant_id, 'ORDER_FULFILLMENT', -v_res.quantity, v_new_stock, p_order_id, 'Order committed'
    );

    -- Mark reservation fulfilled
    UPDATE public.inventory_reservations
    SET status = 'fulfilled', order_id = p_order_id
    WHERE id = p_reservation_id;

    RETURN jsonb_build_object('success', true, 'balance_after', v_new_stock);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Explicitly Release a Specific Reservation
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

-- Release Expired Reservations
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
-- 6. CUSTOMER CARTS & ADDRESSES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    address_type TEXT NOT NULL DEFAULT 'shipping',
    full_name TEXT NOT NULL,
    phone TEXT,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    suburb TEXT NOT NULL,
    state TEXT NOT NULL,
    postcode TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'AU',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    guest_token TEXT,
    currency TEXT NOT NULL DEFAULT 'AUD',
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
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
-- 7. ORDERS, SPLIT SUB-ORDERS & PAYMENTS
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
    gst_total NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    status order_status NOT NULL DEFAULT 'PENDING',
    payment_status order_payment_status NOT NULL DEFAULT 'PENDING',
    payment_intent_id TEXT,
    payment_method payment_method DEFAULT 'STRIPE',
    currency TEXT NOT NULL DEFAULT 'AUD',
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sub_orders (
    id TEXT PRIMARY KEY,
    master_order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    net_seller_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    status sub_order_status NOT NULL DEFAULT 'NEW_ORDER',
    shipping_method TEXT NOT NULL DEFAULT 'standard',
    carrier TEXT,
    tracking_number TEXT,
    estimated_delivery TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    variant_title TEXT,
    sku TEXT,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    sub_order_id TEXT REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'STRIPE',
    provider_payment_id TEXT UNIQUE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'AUD',
    status order_payment_status NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'STRIPE',
    card_brand TEXT,
    card_last4 TEXT,
    error_message TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
    sub_order_id TEXT REFERENCES public.sub_orders(id) ON DELETE SET NULL,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
    entry_type ledger_entry_type NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'AUD',
    description TEXT,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. SHIPPING & CARRIER LOGISTICS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    carrier TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    label_url TEXT,
    status shipment_status NOT NULL DEFAULT 'LABEL_CREATED',
    shipping_service TEXT NOT NULL DEFAULT 'Standard Parcel Post',
    weight_grams INT,
    cost NUMERIC(10,2),
    label_generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_at TIMESTAMPTZ,
    estimated_delivery TIMESTAMPTZ,
    actual_delivery TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    status shipment_status NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    location TEXT,
    description TEXT,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. RETURNS & REFUNDS (7-Day Change of Mind / ACL)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    status return_status NOT NULL DEFAULT 'REQUESTED',
    refund_amount NUMERIC(10,2) NOT NULL CHECK (refund_amount >= 0),
    customer_notes TEXT,
    seller_notes TEXT,
    return_tracking_number TEXT,
    carrier TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    return_reason TEXT,
    condition TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL,
    provider_refund_id TEXT UNIQUE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'AUD',
    status TEXT NOT NULL DEFAULT 'succeeded',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. PAYOUTS & SELLER SETTLEMENT (14-Day Delivery Hold Maturity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    payout_batch_id TEXT,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'AUD',
    status payout_status NOT NULL DEFAULT 'PENDING',
    transfer_id TEXT,
    failure_reason TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    scheduled_date DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE RESTRICT,
    gross_amount NUMERIC(10,2) NOT NULL,
    commission_amount NUMERIC(10,2) NOT NULL,
    net_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. COMMUNICATIONS, AUDIT & WEBHOOK EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
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

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bulk_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT,
    import_mode TEXT NOT NULL DEFAULT 'standard',
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    status bulk_import_status NOT NULL DEFAULT 'PENDING',
    error_report_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.bulk_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.bulk_import_batches(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    raw_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    errors JSONB,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.marketplace_configs (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 12. STORAGE BUCKETS & RLS POLICIES
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
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_configs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can read own profile or admin can read all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Sellers Policies
CREATE POLICY "Public can view approved sellers"
ON public.sellers FOR SELECT
USING (status = 'approved' OR public.is_seller_member(id) OR public.is_admin());

CREATE POLICY "Sellers can update own store"
ON public.sellers FOR UPDATE
USING (public.is_seller_member(id) OR public.is_admin());

-- Catalogue Policies (Public Read for Live Products)
CREATE POLICY "Public read departments" ON public.departments FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (is_active = true OR public.is_admin());
CREATE POLICY "Public read collections" ON public.collections FOR SELECT USING (is_active = true OR public.is_admin());

CREATE POLICY "Public can view live products"
ON public.products FOR SELECT
USING (status = 'LIVE' OR public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Sellers can manage own products"
ON public.products FOR ALL
USING (public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Public can view variants of live products"
ON public.product_variants FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id AND (p.status = 'LIVE' OR public.is_seller_member(p.seller_id) OR public.is_admin())
));

CREATE POLICY "Sellers can manage own variants"
ON public.product_variants FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id AND (public.is_seller_member(p.seller_id) OR public.is_admin())
));

CREATE POLICY "Public can view media of live products"
ON public.product_media FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_media.product_id AND (p.status = 'LIVE' OR public.is_seller_member(p.seller_id) OR public.is_admin())
));

CREATE POLICY "Sellers can manage own product media"
ON public.product_media FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_media.product_id AND (public.is_seller_member(p.seller_id) OR public.is_admin())
));

-- Carts Policies (Strict user isolation, server handles guest carts)
CREATE POLICY "Users can manage own cart"
ON public.carts FOR ALL
USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can manage own cart lines"
ON public.cart_lines FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.carts c
    WHERE c.id = cart_lines.cart_id AND (c.user_id = auth.uid() OR public.is_admin())
));

-- Orders & Sub-orders Policies
CREATE POLICY "Customers can view own orders"
ON public.orders FOR SELECT
USING (auth.uid() = customer_id OR public.is_admin());

CREATE POLICY "Sellers can view own sub-orders"
ON public.sub_orders FOR SELECT
USING (public.is_seller_member(seller_id) OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = sub_orders.master_order_id AND o.customer_id = auth.uid()
) OR public.is_admin());

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

-- Tracking Events Policy (Restricted to Order Owner, Seller, Admin)
CREATE POLICY "Authorized parties can view tracking"
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

-- Notifications Policy
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR ALL
USING (auth.uid() = user_id OR public.is_admin());

-- Product Reviews Policy
CREATE POLICY "Public can view approved reviews"
ON public.product_reviews FOR SELECT
USING (status = 'APPROVED' OR auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Authenticated users can submit reviews"
ON public.product_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Collection Products Policy
CREATE POLICY "Public read collection products"
ON public.collection_products FOR SELECT
USING (true);

-- Storage Bucket RLS Policies
CREATE POLICY "Public Access for Product Media"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

CREATE POLICY "Sellers can upload product media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-media' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id IN ('seller-documents', 'return-evidence') AND auth.role() = 'authenticated');

CREATE POLICY "Restricted access to seller documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'seller-documents' AND (
    public.is_admin() OR
    (storage.foldername(name))[1] = auth.uid()::text
));
