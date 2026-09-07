-- ============================================================================
-- Indian Shopping Mela — Phase D & E Migration: Catalogue, Products, Media & Inventory
-- Baseline: Developer Architecture Master Plan (V1) & Runbook tasklist1.md
-- ============================================================================

-- 1. DEPARTMENTS (§6, T043)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_name TEXT,
    banner_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    seo_title TEXT,
    seo_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ATTRIBUTE OPTIONS FOR CATEGORIES (§6, T046)
CREATE TABLE IF NOT EXISTS public.attribute_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attribute_id UUID NOT NULL REFERENCES public.category_attributes(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    label TEXT NOT NULL,
    color_hex TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (attribute_id, code)
);

-- 3. COLLECTIONS & TAGS MODEL (§6, T047)
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    banner_url TEXT,
    tagline TEXT,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_collections (
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, collection_id)
);

-- 4. VARIANT ATTRIBUTE VALUE MAPPINGS (§7, T050)
CREATE TABLE IF NOT EXISTS public.product_variant_options (
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    attribute_id UUID NOT NULL REFERENCES public.category_attributes(id) ON DELETE RESTRICT,
    option_id UUID REFERENCES public.attribute_options(id) ON DELETE RESTRICT,
    custom_value TEXT,
    PRIMARY KEY (variant_id, attribute_id)
);

-- 5. PRODUCT MODERATION HISTORY (§7, T053)
CREATE TABLE IF NOT EXISTS public.product_moderation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    from_status product_status,
    to_status product_status NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.1 Ensure inventory_reservations columns
ALTER TABLE public.inventory_reservations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RESERVED';
ALTER TABLE public.inventory_reservations ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE public.inventory_reservations ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id);

-- 6. APPEND-ONLY INVENTORY AUDIT LEDGER (§8, T056)
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
    delta INT NOT NULL, -- Positive for restock, negative for sale/reservation/loss
    balance_after INT NOT NULL,
    reason TEXT NOT NULL, -- 'INITIAL_STOCK', 'SALE_DECREMENT', 'MANUAL_ADJUSTMENT', 'RESTOCK', 'RETURN_RESTOCK', 'RESERVATION_HOLD'
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id UUID,
    batch_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ENABLE ROW LEVEL SECURITY ON NEW TABLES
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES FOR PUBLIC DISCOVERY & CATALOGUE
CREATE POLICY "Public can view active departments"
    ON public.departments FOR SELECT
    USING (is_active = TRUE OR public.is_admin(auth.uid()));

CREATE POLICY "Public can view active attribute options"
    ON public.attribute_options FOR SELECT
    USING (is_active = TRUE OR public.is_admin(auth.uid()));

CREATE POLICY "Public can view active collections"
    ON public.collections FOR SELECT
    USING (is_active = TRUE OR public.is_admin(auth.uid()));

CREATE POLICY "Public can view product collections"
    ON public.product_collections FOR SELECT
    USING (TRUE);

CREATE POLICY "Public can view variant options"
    ON public.product_variant_options FOR SELECT
    USING (TRUE);

-- 9. RLS POLICIES FOR INVENTORY & MODERATION
CREATE POLICY "Sellers can view own inventory transactions"
    ON public.inventory_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.product_variants pv
            JOIN public.products p ON p.id = pv.product_id
            WHERE pv.id = inventory_transactions.variant_id
            AND (public.is_seller_member(p.seller_id, auth.uid()) OR public.is_admin(auth.uid()))
        )
    );

CREATE POLICY "Admins can view product moderation history"
    ON public.product_moderation_logs FOR SELECT
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert moderation logs"
    ON public.product_moderation_logs FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

-- 10. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_categories_dept_sort ON public.categories(department, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_dept_status ON public.products(department, status);
CREATE INDEX IF NOT EXISTS idx_products_cat_status ON public.products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(seller_sku);
CREATE INDEX IF NOT EXISTS idx_product_media_prod_pos ON public.product_media(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_inventory_res_exp ON public.inventory_reservations(expires_at) WHERE status = 'RESERVED';
CREATE INDEX IF NOT EXISTS idx_inventory_tx_variant ON public.inventory_transactions(variant_id, created_at DESC);
