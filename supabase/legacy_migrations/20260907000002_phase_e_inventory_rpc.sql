-- ============================================================================
-- Indian Shopping Mela — Phase E Migration: Transactional Inventory RPC
-- Baseline: Master Architecture Plan V1 & Runbook tasklist1.md (§8, T057, T058)
-- ============================================================================

-- 1. ATOMIC INVENTORY RESERVATION (T057)
-- Locks the variant row with FOR UPDATE, verifies available stock, increments reserved count,
-- and inserts a temporary hold reservation (default 15 minutes).
CREATE OR REPLACE FUNCTION public.reserve_inventory_atomic(
    p_variant_id UUID,
    p_quantity INT,
    p_reference_type TEXT, -- e.g. 'CART_CHECKOUT', 'ORDER_PENDING'
    p_reference_id TEXT,
    p_hold_minutes INT DEFAULT 15
)
RETURNS JSONB AS $$
DECLARE
    v_stock_quantity INT;
    v_reserved_quantity INT;
    v_available_stock INT;
    v_reservation_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Quantity must be greater than zero');
    END IF;

    -- Row lock to prevent race conditions during checkout
    SELECT stock_quantity, reserved_quantity
    INTO v_stock_quantity, v_reserved_quantity
    FROM public.product_variants
    WHERE id = p_variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Product variant not found');
    END IF;

    v_available_stock := v_stock_quantity - v_reserved_quantity;

    IF v_available_stock < p_quantity THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Insufficient available stock',
            'available', v_available_stock,
            'requested', p_quantity
        );
    END IF;

    -- Compute expiration timestamp
    v_expires_at := NOW() + (p_hold_minutes || ' minutes')::interval;

    -- Update variant reserved quantity
    UPDATE public.product_variants
    SET reserved_quantity = reserved_quantity + p_quantity,
        updated_at = NOW()
    WHERE id = p_variant_id;

    -- Create reservation hold
    INSERT INTO public.inventory_reservations (
        variant_id,
        reference_type,
        reference_id,
        quantity,
        status,
        expires_at
    ) VALUES (
        p_variant_id,
        p_reference_type,
        p_reference_id,
        p_quantity,
        'RESERVED',
        v_expires_at
    ) RETURNING id INTO v_reservation_id;

    -- Record transaction audit
    INSERT INTO public.inventory_transactions (
        variant_id,
        delta,
        balance_after,
        reason,
        note
    ) VALUES (
        p_variant_id,
        -p_quantity,
        v_available_stock - p_quantity,
        'RESERVATION_HOLD',
        'Hold ID: ' || v_reservation_id::text || ' for ref: ' || p_reference_id
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'reservation_id', v_reservation_id,
        'variant_id', p_variant_id,
        'quantity', p_quantity,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. COMMIT INVENTORY RESERVATION (Payment Confirmed)
-- Converts reservation hold into final stock decrement upon Stripe payment webhook confirmation.
CREATE OR REPLACE FUNCTION public.commit_inventory_reservation(
    p_reservation_id UUID,
    p_order_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_res RECORD;
    v_new_stock INT;
BEGIN
    SELECT * INTO v_res
    FROM public.inventory_reservations
    WHERE id = p_reservation_id AND status = 'RESERVED'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Valid active reservation not found');
    END IF;

    -- Decrement actual stock and clear reservation hold
    UPDATE public.product_variants
    SET stock_quantity = stock_quantity - v_res.quantity,
        reserved_quantity = GREATEST(0, reserved_quantity - v_res.quantity),
        updated_at = NOW()
    WHERE id = v_res.variant_id
    RETURNING stock_quantity INTO v_new_stock;

    -- Mark reservation as confirmed
    UPDATE public.inventory_reservations
    SET status = 'CONFIRMED',
        confirmed_at = NOW()
    WHERE id = p_reservation_id;

    -- Record transaction audit
    INSERT INTO public.inventory_transactions (
        variant_id,
        delta,
        balance_after,
        reason,
        order_id,
        note
    ) VALUES (
        v_res.variant_id,
        -v_res.quantity,
        v_new_stock,
        'SALE_DECREMENT',
        p_order_id,
        'Committed from reservation ' || p_reservation_id::text
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'variant_id', v_res.variant_id,
        'new_stock_quantity', v_new_stock
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RELEASE EXPIRED RESERVATIONS (Worker / Background Cleaner - T058)
-- Finds and unlocks stock reservations that expired before payment was completed.
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS INT AS $$
DECLARE
    v_released_count INT := 0;
    v_res RECORD;
BEGIN
    FOR v_res IN
        SELECT id, variant_id, quantity
        FROM public.inventory_reservations
        WHERE status = 'RESERVED' AND expires_at < NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Restore reserved count on variant
        UPDATE public.product_variants
        SET reserved_quantity = GREATEST(0, reserved_quantity - v_res.quantity),
            updated_at = NOW()
        WHERE id = v_res.variant_id;

        -- Update reservation status
        UPDATE public.inventory_reservations
        SET status = 'EXPIRED'
        WHERE id = v_res.id;

        -- Record transaction audit
        INSERT INTO public.inventory_transactions (
            variant_id,
            delta,
            balance_after,
            reason,
            note
        ) VALUES (
            v_res.variant_id,
            v_res.quantity,
            (SELECT stock_quantity - reserved_quantity FROM public.product_variants WHERE id = v_res.variant_id),
            'HOLD_EXPIRED',
            'Released expired hold: ' || v_res.id::text
        );

        v_released_count := v_released_count + 1;
    END LOOP;

    RETURN v_released_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
