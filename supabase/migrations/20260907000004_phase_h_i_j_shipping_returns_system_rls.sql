-- ============================================================================
-- Indian Shopping Mela — Phase H, I, J Migration: Shipping, Returns, Payouts, System Config & Full RLS
-- Baseline: Developer Architecture Master Plan (V1) & Runbook tasklist1.md (§11, §12, §13)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SHIPPING & CARRIER TRACKING (§11, T075, T076)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id UUID NOT NULL REFERENCES public.sub_orders(id) ON DELETE CASCADE,
    carrier TEXT NOT NULL DEFAULT 'Australia Post',
    shipping_service TEXT NOT NULL,
    provider_shipment_id TEXT,
    tracking_number TEXT,
    label_url TEXT,
    shipping_cost_cents INT NOT NULL DEFAULT 995,
    status TEXT NOT NULL DEFAULT 'LABEL_CREATED', -- 'LABEL_CREATED', 'PICKUP_SCHEDULED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    pod_signature_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    carrier_status TEXT NOT NULL,
    ism_status TEXT NOT NULL,
    event_description TEXT NOT NULL,
    location TEXT,
    event_timestamp TIMESTAMPTZ NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. RETURNS & REFUNDS (§11, T077, T078, T080)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_order_id UUID NOT NULL REFERENCES public.sub_orders(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status ReturnStatus NOT NULL DEFAULT 'RETURN_REQUESTED',
    reason TEXT NOT NULL,
    reason_code TEXT NOT NULL DEFAULT 'CHANGE_OF_MIND',
    payout_hold_placed BOOLEAN NOT NULL DEFAULT TRUE,
    evidence_urls TEXT[] DEFAULT ARRAY[]::text[],
    seller_notes TEXT,
    admin_notes TEXT,
    approved_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    condition_reported TEXT,
    refund_amount_cents INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    sub_order_id UUID REFERENCES public.sub_orders(id) ON DELETE RESTRICT,
    provider_refund_id TEXT UNIQUE,
    amount_cents INT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUCCEEDED',
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. PAYOUT SETTLEMENT & BATCHES (§11, T081, T082, T083)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
    amount_cents INT NOT NULL,
    status PayoutStatus NOT NULL DEFAULT 'PAYOUT_HOLD',
    provider_transfer_id TEXT,
    payout_batch_id TEXT,
    cleared_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payout_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
    ledger_entry_id UUID NOT NULL REFERENCES public.ledger_entries(id) ON DELETE RESTRICT,
    amount_cents INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (payout_id, ledger_entry_id)
);

-- ----------------------------------------------------------------------------
-- 4. SYSTEM CONFIG, AUDIT, WEBHOOKS & NOTIFICATIONS (§12, T084, T086, T087)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version INT NOT NULL DEFAULT 1,
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL, -- 'stripe', 'auspost', 'sendle', 'mux', 'brevo'
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECEIVED', -- 'RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT,
    recipient_phone TEXT,
    channel TEXT NOT NULL DEFAULT 'EMAIL', -- 'EMAIL', 'SMS'
    template_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'SENT', 'FAILED'
    idempotency_key TEXT UNIQUE,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. BULK IMPORT BATCHES & ROWS (§12, T088, T089)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bulk_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    template_version TEXT NOT NULL DEFAULT 'V1_2026',
    import_mode TEXT NOT NULL DEFAULT 'UPSERT',
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows INT NOT NULL DEFAULT 0,
    error_rows INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED'
    error_report_url TEXT,
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
    validation_errors TEXT[] DEFAULT ARRAY[]::text[],
    imported_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    imported_variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_id, row_number)
);

-- ----------------------------------------------------------------------------
-- 6. FULL ROW LEVEL SECURITY ENABLEMENT & POLICIES (§13, T090 - T099)
-- ----------------------------------------------------------------------------
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_import_rows ENABLE ROW LEVEL SECURITY;

-- Shipment & Tracking RLS
CREATE POLICY "Sellers can view own sub-order shipments"
    ON public.shipments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sub_orders so
            WHERE so.id = shipments.sub_order_id
            AND (public.is_seller_member(so.seller_id, auth.uid()) OR public.is_admin(auth.uid()))
        )
    );

CREATE POLICY "Public/Customers can view tracking events"
    ON public.tracking_events FOR SELECT
    USING (TRUE);

-- Returns & Refunds RLS
CREATE POLICY "Customers and Sellers can view related returns"
    ON public.returns FOR SELECT
    USING (
        customer_id = auth.uid()
        OR public.is_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.sub_orders so
            WHERE so.id = returns.sub_order_id
            AND public.is_seller_member(so.seller_id, auth.uid())
        )
    );

CREATE POLICY "Customers can request returns"
    ON public.returns FOR INSERT
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers and Sellers can view return items"
    ON public.return_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.returns r
            WHERE r.id = return_items.return_id
            AND (r.customer_id = auth.uid() OR public.is_admin(auth.uid()))
        )
    );

-- Payouts RLS
CREATE POLICY "Sellers can view own payouts"
    ON public.payouts FOR SELECT
    USING (public.is_seller_member(seller_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Sellers can view own payout items"
    ON public.payout_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.payouts p
            WHERE p.id = payout_items.payout_id
            AND (public.is_seller_member(p.seller_id, auth.uid()) OR public.is_admin(auth.uid()))
        )
    );

-- Bulk Import RLS
CREATE POLICY "Sellers can manage own bulk import batches"
    ON public.bulk_import_batches FOR ALL
    USING (public.is_seller_member(seller_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Sellers can view own bulk import rows"
    ON public.bulk_import_rows FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.bulk_import_batches b
            WHERE b.id = bulk_import_rows.batch_id
            AND (public.is_seller_member(b.seller_id, auth.uid()) OR public.is_admin(auth.uid()))
        )
    );

-- Admin Global Security Policies
CREATE POLICY "Admins can view and manage system configs"
    ON public.marketplace_configs FOR ALL
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage webhook logs"
    ON public.webhook_events FOR ALL
    USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage notification logs"
    ON public.notifications FOR ALL
    USING (public.is_admin(auth.uid()));

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_sub_order ON public.shipments(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_returns_sub_order ON public.returns(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON public.returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_seller_status ON public.payouts(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON public.webhook_events(provider, status);
CREATE INDEX IF NOT EXISTS idx_bulk_import_batch_status ON public.bulk_import_batches(seller_id, status);
