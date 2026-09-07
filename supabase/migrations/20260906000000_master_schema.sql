-- ============================================================================
-- Indian Shopping Mela — Master Database Schema & RLS Policies
-- Baseline: Developer Architecture Master Plan (V1)
-- Target: PostgreSQL / Supabase
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES & ROLES (§1, §2)
-- ----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('customer', 'seller_owner', 'seller_staff', 'admin_support', 'admin_catalogue', 'admin_finance', 'admin_super');

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    phone_verified BOOLEAN DEFAULT FALSE,
    role user_role NOT NULL DEFAULT 'customer',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. SELLERS & ONBOARDING (§4, §5)
-- ----------------------------------------------------------------------------
CREATE TYPE onboarding_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'APPROVED', 'REJECTED', 'SUSPENDED'
);

CREATE TABLE IF NOT EXISTS public.sellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    business_name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    abn TEXT NOT NULL,
    business_type TEXT NOT NULL DEFAULT 'Company',
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    banner_url TEXT,
    about_text TEXT,
    status onboarding_status NOT NULL DEFAULT 'DRAFT',
    risk_flag BOOLEAN DEFAULT FALSE,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    handling_days_default INT NOT NULL DEFAULT 2,
    holiday_mode BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Address information (JSONB for flexibility + validated structure)
    dispatch_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    return_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Bank / Payout details (masked in normal queries)
    bank_bsb TEXT,
    bank_account_number TEXT,
    bank_account_name TEXT,
    
    -- Agreed policy versions and audit
    terms_accepted_version TEXT,
    terms_accepted_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    admin_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seller Staff & Permissions (§2)
CREATE TABLE IF NOT EXISTS public.seller_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_role TEXT NOT NULL DEFAULT 'Manager', -- Owner, Manager, Dispatch, Finance
    permissions TEXT[] NOT NULL DEFAULT ARRAY['products', 'inventory', 'orders', 'shipping']::text[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (seller_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. CATEGORIES & DYNAMIC ATTRIBUTES (§6)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department TEXT NOT NULL, -- Women, Men, Kids, Jewellery, Home & Living, Pooja, Festivals, Gifts
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    description TEXT,
    image_url TEXT,
    banner_url TEXT,
    featured BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.category_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    attribute_type TEXT NOT NULL DEFAULT 'text', -- text, number, select, multi_select, color, size, boolean
    options JSONB DEFAULT '[]'::jsonb,
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, code)
);

-- ----------------------------------------------------------------------------
-- 4. PRODUCTS, VARIANTS & MEDIA (§7, §9, §10)
-- ----------------------------------------------------------------------------
CREATE TYPE product_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'APPROVED', 'LIVE', 'PAUSED', 'OUT_OF_STOCK', 'REJECTED', 'ARCHIVED'
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    department TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    subcategory TEXT,
    description TEXT NOT NULL,
    key_features TEXT[] DEFAULT ARRAY[]::text[],
    care_instructions TEXT,
    country_of_origin TEXT DEFAULT 'India',
    return_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    handling_days INT DEFAULT 2,
    weight_kg NUMERIC(8,3) DEFAULT 0.500,
    length_cm NUMERIC(8,2),
    width_cm NUMERIC(8,2),
    height_cm NUMERIC(8,2),
    fragile BOOLEAN DEFAULT FALSE,
    status product_status NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (seller_id, slug)
);

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_sku TEXT NOT NULL,
    title TEXT NOT NULL, -- e.g. 'Size M · Rani Pink'
    price NUMERIC(10,2) NOT NULL, -- AUD (GST-inclusive)
    sale_price NUMERIC(10,2),
    sale_start_at TIMESTAMPTZ,
    sale_end_at TIMESTAMPTZ,
    stock_quantity INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    low_stock_threshold INT NOT NULL DEFAULT 5,
    weight_kg_override NUMERIC(8,3),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"size": "M", "color": "Pink"}
    images TEXT[] DEFAULT ARRAY[]::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, seller_sku),
    CONSTRAINT positive_stock CHECK (stock_quantity >= 0),
    CONSTRAINT positive_reserved CHECK (reserved_quantity >= 0)
);

CREATE TYPE media_status AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'REJECTED');

CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    media_type TEXT NOT NULL DEFAULT 'IMAGE', -- 'IMAGE' | 'VIDEO'
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INT,
    sort_order INT DEFAULT 0,
    status media_status NOT NULL DEFAULT 'READY',
    moderation_status TEXT NOT NULL DEFAULT 'APPROVED', -- 'PENDING', 'APPROVED', 'REJECTED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. INVENTORY RESERVATION & CONCURRENCY (§10, §33)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservations_expires ON public.inventory_reservations(expires_at);

-- ----------------------------------------------------------------------------
-- 6. ORDERS & SUB-ORDERS (§13, §15)
-- ----------------------------------------------------------------------------
CREATE TYPE order_payment_status AS ENUM ('PAYMENT_PENDING', 'PAID', 'PAYMENT_FAILED');
CREATE TYPE sub_order_status AS ENUM (
    'ORDER_CREATED', 'SELLER_NOTIFIED', 'SELLER_ACCEPTED', 'PREPARING', 'READY_TO_SHIP',
    'LABEL_CREATED', 'PICKUP_SCHEDULED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY',
    'DELIVERED', 'CANCELLED', 'DISPUTED'
);

CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY, -- Customer order reference e.g. 'ISM10001'
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    
    subtotal NUMERIC(12,2) NOT NULL,
    shipping_total NUMERIC(12,2) NOT NULL,
    gst_total NUMERIC(12,2) NOT NULL, -- 1/11th of taxable total
    discount_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL,
    
    payment_provider TEXT NOT NULL DEFAULT 'STRIPE_AU',
    payment_intent_id TEXT UNIQUE,
    payment_status order_payment_status NOT NULL DEFAULT 'PAYMENT_PENDING',
    payment_authorized_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sub_orders (
    id TEXT PRIMARY KEY, -- e.g. 'ISM10001-A'
    master_order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    status sub_order_status NOT NULL DEFAULT 'ORDER_CREATED',
    
    package_label TEXT NOT NULL DEFAULT 'Package 1',
    carrier TEXT DEFAULT 'Australia Post',
    tracking_number TEXT,
    tracking_url TEXT,
    shipping_service TEXT DEFAULT 'Standard Parcel Post',
    shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    
    dispatch_deadline TIMESTAMPTZ,
    seller_accepted_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    can_return_until TIMESTAMPTZ, -- delivered_at + 7 days
    
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
    sku TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10,2) NOT NULL,
    gst_amount NUMERIC(10,2) NOT NULL
);

-- ----------------------------------------------------------------------------
-- 7. FINANCIAL LEDGER & SETTLEMENTS (§14, §21)
-- ----------------------------------------------------------------------------
CREATE TYPE payout_status AS ENUM (
    'PAYOUT_HOLD', 'PAYOUT_ELIGIBLE', 'PAYOUT_PROCESSING', 'PAID_TO_SELLER', 'CANCELLED'
);

CREATE TABLE IF NOT EXISTS public.payout_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    
    gross_amount NUMERIC(12,2) NOT NULL,
    platform_commission NUMERIC(12,2) NOT NULL,
    shipping_cost_allocated NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    net_payout NUMERIC(12,2) NOT NULL,
    
    status payout_status NOT NULL DEFAULT 'PAYOUT_HOLD',
    hold_reason TEXT,
    eligible_at TIMESTAMPTZ, -- delivered_at + 14 days
    paid_at TIMESTAMPTZ,
    payout_batch_id TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sub_order_id)
);

-- ----------------------------------------------------------------------------
-- 8. RETURNS, REFUNDS & DISPUTES (§20)
-- ----------------------------------------------------------------------------
CREATE TYPE return_status AS ENUM (
    'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED',
    'REFUND_PENDING', 'REFUNDED', 'REJECTED'
);

CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id TEXT NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    reason_code TEXT NOT NULL, -- CHANGED_MIND, WRONG_SIZE, DEFECTIVE_FAULTY, etc.
    evidence_urls TEXT[] DEFAULT ARRAY[]::text[],
    status return_status NOT NULL DEFAULT 'RETURN_REQUESTED',
    refund_amount NUMERIC(10,2),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. BULK UPLOADS & AUDIT LOGS (§8, §29)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bulk_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    template_version TEXT NOT NULL DEFAULT 'V1',
    mode TEXT NOT NULL DEFAULT 'CREATE', -- 'CREATE' | 'UPDATE'
    total_rows INT NOT NULL DEFAULT 0,
    created_count INT NOT NULL DEFAULT 0,
    updated_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PROCESSING',
    error_report_csv_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
    id TEXT PRIMARY KEY, -- e.g. Stripe event ID 'evt_123'
    provider TEXT NOT NULL, -- 'STRIPE', 'AUSPOST', 'SENDLE', 'BREVO'
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 10. ROW-LEVEL SECURITY (RLS) POLICIES (§2, §29)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role::text LIKE 'admin_%'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper security function: Check if current user owns or is staff of seller
CREATE OR REPLACE FUNCTION public.is_seller_member(seller_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.sellers WHERE id = seller_uuid AND owner_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.seller_staff WHERE seller_id = seller_uuid AND user_id = auth.uid() AND is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can view their own profile; admins can view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin());

-- Categories: Public read
CREATE POLICY "Public category view" ON public.categories FOR SELECT USING (TRUE);
CREATE POLICY "Admin category manage" ON public.categories FOR ALL USING (public.is_admin());

-- Products & Variants: Public can read LIVE products; Sellers manage their own
CREATE POLICY "Public can view live products" ON public.products FOR SELECT USING (status = 'LIVE' OR public.is_seller_member(seller_id) OR public.is_admin());
CREATE POLICY "Sellers can manage own products" ON public.products FOR ALL USING (public.is_seller_member(seller_id) OR public.is_admin());

CREATE POLICY "Public can view variants of live products" ON public.product_variants FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.status = 'LIVE' OR public.is_seller_member(p.seller_id) OR public.is_admin()))
);
CREATE POLICY "Sellers can manage own variants" ON public.product_variants FOR ALL USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (public.is_seller_member(p.seller_id) OR public.is_admin()))
);

-- Orders: Customer can see their own master order; Admin can see all
CREATE POLICY "Customers view own orders" ON public.orders FOR SELECT USING (customer_id = auth.uid() OR public.is_admin());

-- Sub-orders: Customer can see their own sub-orders; Seller sees only their assigned sub-orders
CREATE POLICY "Access sub-orders" ON public.sub_orders FOR SELECT USING (
    public.is_seller_member(seller_id) OR
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = master_order_id AND o.customer_id = auth.uid()) OR
    public.is_admin()
);
CREATE POLICY "Sellers update own sub-orders" ON public.sub_orders FOR UPDATE USING (
    public.is_seller_member(seller_id) OR public.is_admin()
);

-- Payout Ledger: Seller can see own ledger entries; Admins manage
CREATE POLICY "Sellers view own ledger" ON public.payout_ledger FOR SELECT USING (public.is_seller_member(seller_id) OR public.is_admin());
CREATE POLICY "Admins manage ledger" ON public.payout_ledger FOR ALL USING (public.is_admin());
