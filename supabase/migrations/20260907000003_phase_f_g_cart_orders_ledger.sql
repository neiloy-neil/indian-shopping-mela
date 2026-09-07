-- ============================================================================
-- Indian Shopping Mela — Phase F & G Migration: Cart, Customer, Orders & Ledger
-- Baseline: Developer Architecture Master Plan (V1) & Runbook tasklist1.md (§9, §10)
-- ============================================================================

-- 1. CUSTOMER ADDRESSES (§9, T060)
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_phone TEXT,
    line1 TEXT NOT NULL,
    line2 TEXT,
    suburb TEXT NOT NULL,
    state TEXT NOT NULL,
    postcode TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Australia',
    is_default_shipping BOOLEAN NOT NULL DEFAULT FALSE,
    is_default_billing BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CARTS & CART LINES (§9, T061, T062)
CREATE TYPE cart_status AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    guest_token TEXT UNIQUE,
    status cart_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cart_id, variant_id)
);

-- 3. WISHLISTS (§9, T063)
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- 4. ORDER STATUS HISTORY & AUDIT (§10, T069)
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    sub_order_id UUID REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role TEXT,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PAYMENTS TABLE (§10, T071)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    provider TEXT NOT NULL DEFAULT 'stripe',
    provider_payment_id TEXT NOT NULL UNIQUE,
    amount_cents INT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'AUD',
    status TEXT NOT NULL, -- 'succeeded', 'processing', 'requires_payment_method', 'canceled'
    idempotency_key TEXT UNIQUE,
    payment_method_type TEXT DEFAULT 'card',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. IMMUTABLE APPEND-ONLY FINANCIAL LEDGER ENTRIES (§10, T072, T073)
CREATE TYPE ledger_entry_type AS ENUM (
    'CUSTOMER_CHARGE',
    'SELLER_GROSS',
    'ISM_COMMISSION',
    'PAYMENT_FEE',
    'SHIPPING_CHARGE',
    'SHIPPING_COST',
    'DISCOUNT',
    'REFUND',
    'ADJUSTMENT',
    'TRANSFER',
    'PAYOUT'
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_type ledger_entry_type NOT NULL,
    amount_cents INT NOT NULL, -- Integer minor currency units (e.g. 18950 = $189.50)
    currency TEXT NOT NULL DEFAULT 'AUD',
    seller_id UUID REFERENCES public.sellers(id) ON DELETE RESTRICT,
    order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT,
    sub_order_id UUID REFERENCES public.sub_orders(id) ON DELETE RESTRICT,
    payout_batch_id TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ROW LEVEL SECURITY
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES FOR CUSTOMER & CART
CREATE POLICY "Users can manage own addresses"
    ON public.customer_addresses FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own wishlists"
    ON public.wishlists FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Users can access own carts"
    ON public.carts FOR ALL
    USING (auth.uid() = user_id OR guest_token IS NOT NULL);

CREATE POLICY "Users can access own cart lines"
    ON public.cart_lines FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.carts c
            WHERE c.id = cart_lines.cart_id
            AND (c.user_id = auth.uid() OR c.guest_token IS NOT NULL)
        )
    );

-- 9. RLS POLICIES FOR ORDERS, PAYMENTS & LEDGER
CREATE POLICY "Admins can view all ledger entries"
    ON public.ledger_entries FOR SELECT
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Sellers can view own ledger entries"
    ON public.ledger_entries FOR SELECT
    USING (public.is_seller_member(seller_id, auth.uid()));

CREATE POLICY "Admins can manage payments"
    ON public.payments FOR ALL
    USING (public.is_admin(auth.uid()));

-- 10. INDEXES
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON public.customer_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_guest_token ON public.carts(guest_token);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_seller ON public.ledger_entries(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_order ON public.ledger_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_sub_order ON public.ledger_entries(sub_order_id);
