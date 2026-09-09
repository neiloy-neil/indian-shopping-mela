import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface InventoryReservationItem {
  variantId: string;
  quantity: number;
}

export interface ReservationResult {
  reservationId: string;
  variantId: string;
  quantity: number;
  expiresAt: string;
}

/**
 * Server Function: Atomically reserve stock for checkout lines.
 * Fails closed: If ANY item cannot be reserved, all previously acquired reservations
 * for this session are immediately rolled back/released, and an error is thrown.
 */
export const reserveInventoryLinesServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      items: InventoryReservationItem[];
      sessionId: string;
      ttlMinutes?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    return reserveInventoryLines(data.items, data.sessionId, data.ttlMinutes ?? 15);
  });

export async function reserveInventoryLines(
  items: InventoryReservationItem[],
  sessionId: string,
  ttlMinutes: number = 15,
): Promise<ReservationResult[]> {
  if (!items || items.length === 0) {
    return [];
  }

  const acquiredReservations: ReservationResult[] = [];

  for (const item of items) {
    if (item.quantity <= 0) {
      // Rollback previous holds
      await rollbackReservations(acquiredReservations);
      throw new Error(`Invalid requested quantity: ${item.quantity} for variant ${item.variantId}`);
    }

    const { data: rpcResult, error: rpcError } = await (supabaseAdmin.rpc as any)(
      "reserve_inventory_atomic",
      {
        p_variant_id: item.variantId,
        p_quantity: item.quantity,
        p_session_id: sessionId,
        p_ttl_minutes: ttlMinutes,
      },
    );

    if (rpcError) {
      await rollbackReservations(acquiredReservations);
      throw new Error(
        `Inventory reservation system error for variant ${item.variantId}: ${rpcError.message}`,
      );
    }

    const res = typeof rpcResult === "string" ? JSON.parse(rpcResult) : rpcResult;

    if (!res || !res.success) {
      await rollbackReservations(acquiredReservations);
      const available = res?.available ?? 0;
      throw new Error(
        `Insufficient stock for item (${item.variantId}). Requested: ${item.quantity}, Available: ${available}. Checkout cannot proceed.`,
      );
    }

    acquiredReservations.push({
      reservationId: res.reservation_id,
      variantId: item.variantId,
      quantity: item.quantity,
      expiresAt: res.expires_at,
    });
  }

  return acquiredReservations;
}

/**
 * Helper to roll back acquired reservations when any line fails.
 */
async function rollbackReservations(reservations: ReservationResult[]): Promise<void> {
  for (const r of reservations) {
    try {
      await (supabaseAdmin.rpc as any)("release_inventory_reservation", {
        p_reservation_id: r.reservationId,
      });
    } catch (err: any) {
      console.error(`Failed to rollback reservation ${r.reservationId}:`, err.message);
    }
  }
}

/**
 * Server Function: Commit reservations on confirmed provider payment (Idempotent)
 */
export const commitInventoryReservationsServerFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string; orderId: string }) => data)
  .handler(async ({ data }) => {
    return commitInventoryReservations(data.sessionId, data.orderId);
  });

export async function commitInventoryReservations(
  sessionId: string,
  orderId: string,
): Promise<{ committed: number }> {
  // Find all active reservations for this session
  const { data: reservations, error } = await (supabaseAdmin.from("inventory_reservations") as any)
    .select("id, status")
    .eq("session_id", sessionId);

  if (error || !reservations || reservations.length === 0) {
    return { committed: 0 };
  }

  let committedCount = 0;

  for (const res of reservations) {
    if (res.status === "active") {
      const { data: rpcRes, error: rpcErr } = await (supabaseAdmin.rpc as any)(
        "commit_inventory_reservation",
        {
          p_reservation_id: res.id,
          p_order_id: orderId,
        },
      );

      if (!rpcErr) {
        const result = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
        if (result?.success) {
          committedCount++;
        }
      }
    } else if (res.status === "fulfilled") {
      // Already committed idempotently
      committedCount++;
    }
  }

  return { committed: committedCount };
}

/**
 * Server Function: Explicitly release reservations on payment cancellation, failure, or timeout
 */
export const releaseInventoryReservationsServerFn = createServerFn({ method: "POST" })
  .validator((data: { sessionId: string }) => data)
  .handler(async ({ data }) => {
    return releaseInventoryReservations(data.sessionId);
  });

export async function releaseInventoryReservations(
  sessionId: string,
): Promise<{ released: number }> {
  const { data: reservations } = await (supabaseAdmin.from("inventory_reservations") as any)
    .select("id")
    .eq("session_id", sessionId)
    .eq("status", "active");

  if (!reservations || reservations.length === 0) {
    return { released: 0 };
  }

  let releasedCount = 0;

  for (const res of reservations) {
    const { data: rpcRes } = await (supabaseAdmin.rpc as any)("release_inventory_reservation", {
      p_reservation_id: res.id,
    });
    const result = typeof rpcRes === "string" ? JSON.parse(rpcRes) : rpcRes;
    if (result?.success) {
      releasedCount++;
    }
  }

  return { released: releasedCount };
}

/**
 * Server Function: Periodic or cron job to release expired inventory holds
 */
export const releaseExpiredReservationsServerFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { data: count, error } = await (supabaseAdmin.rpc as any)("release_expired_reservations");
    if (error) {
      throw new Error(`Failed to release expired reservations: ${error.message}`);
    }
    return { expiredCount: Number(count) || 0 };
  },
);

/**
 * Restock variant inventory on return or order cancellation
 */
export async function restockVariantInventory(data: {
  variantId: string;
  quantity: number;
  reason: "RETURN_RESTOCK" | "CANCELLED_ORDER" | "MANUAL_ADJUSTMENT";
  referenceId?: string | undefined;
  actorId?: string | undefined;
  note?: string | undefined;
}): Promise<{
  success: boolean;
  variantId: string;
  newStock: number;
  parentTotalStock: number;
}> {
  const qty = Math.max(1, data.quantity);

  // Fetch current variant stock
  const { data: variant, error: fetchErr } = await (supabaseAdmin.from("product_variants") as any)
    .select("id, product_id, stock_quantity")
    .eq("id", data.variantId)
    .single();

  if (fetchErr || !variant) {
    throw new Error(`Variant not found: ${data.variantId}`);
  }

  const newStock = Number(variant.stock_quantity) + qty;

  // Update variant stock
  await (supabaseAdmin.from("product_variants") as any)
    .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
    .eq("id", data.variantId);

  // Recalculate and update parent product total stock
  const { data: allVariants } = await (supabaseAdmin.from("product_variants") as any)
    .select("stock_quantity")
    .eq("product_id", variant.product_id);

  const totalProductStock = (allVariants || []).reduce(
    (acc: number, v: any) => acc + (Number(v.stock_quantity) || 0),
    0,
  );

  await (supabaseAdmin.from("products") as any)
    .update({ stock_quantity: totalProductStock, updated_at: new Date().toISOString() })
    .eq("id", variant.product_id);

  // Append-only audit record in inventory_transactions
  await (supabaseAdmin.from("inventory_transactions") as any).insert({
    variant_id: data.variantId,
    delta: qty,
    balance_after: newStock,
    reason: data.reason,
    order_id: data.referenceId ?? null,
    actor_id: data.actorId ?? null,
    note: data.note ?? `Stock restored via ${data.reason}`,
  });

  return {
    success: true,
    variantId: data.variantId,
    newStock,
    parentTotalStock: totalProductStock,
  };
}

/**
 * Server Function: Restock variant inventory on return or order cancellation
 */
export const restockVariantInventoryServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      variantId: string;
      quantity: number;
      reason: "RETURN_RESTOCK" | "CANCELLED_ORDER" | "MANUAL_ADJUSTMENT";
      referenceId?: string | undefined;
      actorId?: string | undefined;
      note?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    return restockVariantInventory(data);
  });
