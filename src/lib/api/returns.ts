import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-server";
import { postLedgerEntry } from "./ledger";
import { restockVariantInventory } from "./inventory";
import {
  getVerifiedSessionUserId,
  requireFinanceAdminSession,
  requireVerifiedSellerAccess,
} from "./server-auth";
import type { Database, ReturnReasonCode, ReturnStatus } from "@/lib/supabase/types";

export interface CreateReturnPayload {
  subOrderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  customerId: string;
  reason: string;
  reasonCode:
    | "CHANGED_MIND"
    | "WRONG_SIZE"
    | "WRONG_ITEM"
    | "DAMAGED_IN_TRANSIT"
    | "DEFECTIVE_FAULTY"
    | "NOT_AS_DESCRIBED";
  customerNotes?: string | undefined;
  evidenceUrls?: string[] | undefined;
}

export interface ReturnableOrderItem {
  orderItemId: string;
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
}

export interface ReturnableSubOrder {
  subOrderId: string;
  masterOrderId: string;
  sellerId: string;
  sellerName: string;
  deliveredAt: string;
  canReturnUntil: string | null;
  items: ReturnableOrderItem[];
}

/**
 * Server Function: Fetch a customer's delivered sub-orders and their line items,
 * eligible for a return request. Optionally scoped to a single sub-order.
 */
export const getReturnableOrderItemsServerFn = createServerFn({ method: "POST" })
  .validator((data: { subOrderId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const verifiedUserId = await getVerifiedSessionUserId();
    if (!verifiedUserId) {
      throw new Error("UNAUTHORIZED: Sign in to view your returnable orders.");
    }
    return getReturnableOrderItems(verifiedUserId, data.subOrderId);
  });

export async function getReturnableOrderItems(
  customerId: string,
  subOrderId?: string | undefined,
): Promise<ReturnableSubOrder[]> {
  let query = supabaseAdmin
    .from("sub_orders")
    .select(
      `
      id,
      master_order_id,
      seller_id,
      delivered_at,
      can_return_until,
      status,
      orders:master_order_id!inner (
        customer_id
      ),
      seller:seller_id (
        business_name
      ),
      order_items (
        id,
        product_id,
        variant_id,
        product_name,
        variant_name,
        sku,
        unit_price,
        quantity
      )
    `,
    )
    .eq("orders.customer_id", customerId)
    .eq("status", "DELIVERED");

  if (subOrderId) {
    query = query.eq("id", subOrderId);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return [];

  return (rows as unknown as Array<{
    id: string;
    master_order_id: string;
    seller_id: string;
    delivered_at: string;
    can_return_until: string | null;
    seller: { business_name: string | null } | null;
    order_items: Array<{
      id: string;
      product_id: string | null;
      variant_id: string | null;
      product_name: string;
      variant_name: string;
      sku: string | null;
      unit_price: number;
      quantity: number;
    }> | null;
  }>).map((row) => ({
    subOrderId: row.id,
    masterOrderId: row.master_order_id,
    sellerId: row.seller_id,
    sellerName: row.seller?.business_name ?? "Marketplace Seller",
    deliveredAt: row.delivered_at,
    canReturnUntil: row.can_return_until,
    items: (row.order_items ?? []).map((item) => ({
      orderItemId: item.id,
      productId: item.product_id,
      variantId: item.variant_id,
      productName: item.product_name,
      variantName: item.variant_name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
  }));
}

export interface ReturnDetail {
  id: string;
  subOrderId: string;
  customerId: string;
  sellerId: string;
  reason: string;
  reasonCode: string;
  status: ReturnStatus;
  refundAmountCents: number;
  refundAmount: number;
  customerNotes?: string | null;
  sellerNotes?: string | null;
  adminNotes?: string | null;
  evidenceUrls?: string[] | null;
  payoutHoldPlaced: boolean;
  requestedAt: string;
  approvedAt?: string | null;
  receivedAt?: string | null;
  resolvedAt?: string | null;
  items: Array<{
    id: string;
    orderItemId: string;
    quantity: number;
    conditionReported?: string | null;
    refundAmountCents?: number | null;
  }>;
}

/**
 * Server Function: Customer initiates a return request.
 */
export const createCustomerReturnRequestServerFn = createServerFn({ method: "POST" })
  .validator((data: CreateReturnPayload) => data)
  .handler(async ({ data }) => {
    const verifiedUserId = await getVerifiedSessionUserId();
    if (!verifiedUserId) {
      throw new Error("UNAUTHORIZED: Sign in before submitting a return request.");
    }
    // The verified session is authoritative — a client-supplied customerId that didn't
    // match would previously only fail the sub-order ownership check below, but nothing
    // stopped a client from supplying someone else's real customerId along with that
    // customer's real subOrderId/orderItemIds to file a return "as" them.
    return createCustomerReturnRequest({ ...data, customerId: verifiedUserId });
  });

/**
 * Resolve the seller_id (via sub_orders) and customer_id for a return, for authorization
 * checks. Every seller/admin-facing return action below needs to verify the caller is
 * actually the seller involved (or an admin) before acting on someone else's return.
 */
async function getReturnPartyIds(
  returnId: string,
): Promise<{ sellerId: string | null; customerId: string | null }> {
  const { data } = await supabaseAdmin
    .from("returns")
    .select("customer_id, sub_orders:sub_order_id(seller_id)")
    .eq("id", returnId)
    .maybeSingle();

  const row = data as unknown as {
    customer_id?: string | null;
    sub_orders?: { seller_id?: string | null } | null;
  } | null;

  return {
    sellerId: row?.sub_orders?.seller_id ?? null,
    customerId: row?.customer_id ?? null,
  };
}

async function requireSellerOrAdminForReturn(returnId: string): Promise<void> {
  const { sellerId } = await getReturnPartyIds(returnId);
  if (!sellerId) {
    // Return not found — let the underlying function's own "not found" error surface
    // rather than a confusing authorization error for a nonexistent resource.
    return;
  }
  await requireVerifiedSellerAccess(sellerId, "returns:manage");
}

/**
 * Server Function: Admin or Seller approves return request.
 */
export const approveReturnServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string; adminNotes?: string | undefined }) => data)
  .handler(async ({ data }) => {
    await requireSellerOrAdminForReturn(data.returnId);
    return approveReturn(data.returnId, data.adminNotes);
  });

/**
 * Server Function: Admin or Seller rejects return request with reason.
 */
export const rejectReturnServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string; rejectionReason: string }) => data)
  .handler(async ({ data }) => {
    await requireSellerOrAdminForReturn(data.returnId);
    return rejectReturn(data.returnId, data.rejectionReason);
  });

/**
 * Server Function: Mark return package in transit with carrier tracking.
 */
export const markReturnInTransitServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string; trackingNumber?: string | undefined }) => data)
  .handler(async ({ data }) => {
    await requireSellerOrAdminForReturn(data.returnId);
    return markReturnInTransit(data.returnId, data.trackingNumber);
  });

/**
 * Server Function: Mark return received and inspected.
 */
export const markReturnReceivedServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      returnId: string;
      condition: "PERFECT" | "DAMAGED" | "UNACCEPTABLE";
      notes?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireSellerOrAdminForReturn(data.returnId);
    return markReturnReceived(data.returnId, data.condition, data.notes);
  });

/**
 * Server Function: Execute Stripe refund and ledger reconciliation upon return inspection.
 * Money-moving — requires platform admin (finance/super), not just the seller involved.
 */
export const executeReturnRefundServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      returnId: string;
      refundAmount?: number | undefined;
      restockItems?: boolean | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    // Real Stripe refund — same tier as executeSellerPayoutTransfer/setManualFinanceHold,
    // not just any admin_support/admin_catalogue role.
    await requireFinanceAdminSession();
    return executeReturnRefund(data.returnId, data.refundAmount, data.restockItems ?? true);
  });

/**
 * Server Function: Fetch return details by ID.
 */
export const getReturnDetailServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string }) => data)
  .handler(async ({ data }) => {
    const verifiedUserId = await getVerifiedSessionUserId();
    if (!verifiedUserId) {
      throw new Error("UNAUTHORIZED: Sign in to view this return.");
    }
    const { sellerId, customerId } = await getReturnPartyIds(data.returnId);
    if (customerId && customerId !== verifiedUserId) {
      // Not the customer who filed it — must be the seller involved, or an admin.
      await requireVerifiedSellerAccess(sellerId ?? "", "returns:manage");
    }
    return getReturnDetail(data.returnId);
  });

/**
 * Server Function: Fetch all returns for a customer.
 */
export const getReturnsForCustomerServerFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const verifiedUserId = await getVerifiedSessionUserId();
    if (!verifiedUserId) {
      throw new Error("UNAUTHORIZED: Sign in to view your returns.");
    }
    return getReturnsForCustomer(verifiedUserId);
  },
);

/**
 * Server Function: Fetch all returns for a seller.
 */
export const getReturnsForSellerServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    await requireVerifiedSellerAccess(data.sellerId, "returns:manage");
    return getReturnsForSeller(data.sellerId);
  });

/**
 * Customer initiates a return request.
 * Enforces the 7-day change-of-mind window rule from confirmed delivery.
 * Allows statutory claims (faulty, damaged, not as described) beyond 7 days under ACL.
 * Places atomic DISPUTE_HOLD on seller ledger balance.
 */
interface ReturnSubOrderJoinedRow {
  id: string;
  master_order_id: string;
  seller_id: string;
  status: string;
  delivered_at: string | null;
  net_seller_amount: number | null;
  orders: {
    id: string;
    customer_id: string | null;
    payment_intent_id: string | null;
  } | null;
}

interface ReturnJoinedRow {
  id: string;
  sub_order_id: string;
  customer_id: string;
  reason: string;
  reason_code: ReturnReasonCode;
  status: Database["public"]["Enums"]["return_status"];
  seller_notes: string | null;
  admin_notes: string | null;
  evidence_urls: string[] | null;
  payout_hold_placed: boolean | null;
  created_at: string;
  approved_at: string | null;
  received_at: string | null;
  resolved_at: string | null;
  sub_orders: {
    seller_id: string;
    master_order_id?: string;
    orders?: {
      id: string;
      payment_intent_id: string | null;
    } | null;
  } | null;
  return_items: Array<{
    id: string;
    order_item_id: string;
    quantity: number;
    condition_reported: string | null;
    refund_amount_cents: number;
    order_items?: {
      variant_id: string | null;
      unit_price: number;
    } | null;
  }> | null;
}

/**
 * T102 — Customer Return Request Initiation with 7-day enforcement.
 * Places atomic DISPUTE_HOLD on seller ledger balance.
 */
export async function createCustomerReturnRequest(payload: CreateReturnPayload): Promise<{
  success: boolean;
  returnId: string;
  refundAmount: number;
  refundAmountCents: number;
  message: string;
}> {
  // 1. Fetch sub-order delivery and items
  const { data: rawSubOrder, error: subOrderErr } = await supabaseAdmin
    .from("sub_orders")
    .select(
      `
      id,
      master_order_id,
      seller_id,
      status,
      delivered_at,
      net_seller_amount,
      orders:master_order_id (
        id,
        customer_id,
        payment_intent_id
      )
    `,
    )
    .eq("id", payload.subOrderId)
    .single();

  if (subOrderErr || !rawSubOrder) {
    throw new Error(`Sub-order ${payload.subOrderId} not found.`);
  }

  const subOrder = rawSubOrder as unknown as ReturnSubOrderJoinedRow;

  // Customer ownership check
  if (subOrder.orders?.customer_id && subOrder.orders.customer_id !== payload.customerId) {
    throw new Error("Unauthorized: You do not have permission to initiate returns for this order.");
  }

  if (subOrder.status !== "DELIVERED" || !subOrder.delivered_at) {
    throw new Error("Returns are only permitted on confirmed delivered orders.");
  }

  // 2. Fetch the target order items (supports partial/multi-item returns)
  if (!payload.items || payload.items.length === 0) {
    throw new Error("At least one item must be selected for return.");
  }

  const orderItemIds = payload.items.map((i) => i.orderItemId);
  const { data: orderItems, error: itemErr } = await supabaseAdmin
    .from("order_items")
    .select("id, unit_price, quantity, variant_id, product_name, sub_order_id")
    .in("id", orderItemIds);

  if (itemErr || !orderItems || orderItems.length !== orderItemIds.length) {
    throw new Error("One or more selected order items could not be found.");
  }

  if (orderItems.some((item) => item.sub_order_id !== payload.subOrderId)) {
    throw new Error("Selected items do not belong to this sub-order.");
  }

  const returnLines = payload.items.map((requested) => {
    const orderItem = orderItems.find((i) => i.id === requested.orderItemId)!;
    const returnQty = Math.min(requested.quantity || 1, orderItem.quantity || 1);
    const lineRefundCents = Math.round(Number(orderItem.unit_price) * returnQty * 100);
    return { orderItem, returnQty, lineRefundCents };
  });

  const refundAmountCents = returnLines.reduce((sum, l) => sum + l.lineRefundCents, 0);
  const refundAmount = Number((refundAmountCents / 100).toFixed(2));

  // 3. Validate 7-day return window for CHANGE_OF_MIND / WRONG_SIZE
  const deliveredAt = new Date(subOrder.delivered_at);
  const now = new Date();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isPast7Days = now.getTime() - deliveredAt.getTime() > SEVEN_DAYS_MS;

  const isChangeOfMind =
    payload.reasonCode === "CHANGED_MIND" || payload.reasonCode === "WRONG_SIZE";

  if (isChangeOfMind && isPast7Days) {
    throw new Error(
      "The 7-day change-of-mind return window has expired for this package. Statutory claims under Australian Consumer Law require a valid fault or damage reason.",
    );
  }

  // 4. For statutory claims, require reason and evidence
  if (!isChangeOfMind) {
    if (!payload.customerNotes && !payload.reason) {
      throw new Error(
        "Statutory warranty and damage claims require a description of the defect or issue.",
      );
    }
  }

  // 4b. Defense in depth: the return-evidence storage bucket's RLS already restricts
  // uploads to the caller's own auth.uid() folder, but verify it here too rather than
  // trusting a client-supplied evidence_urls array to only ever contain the caller's own
  // paths — a client could otherwise reference any storage path (guessed, leaked, or an
  // admin/unrelated file) and have it recorded as "evidence" on their return.
  const validatedEvidenceUrls = (payload.evidenceUrls ?? []).filter((path) => {
    const ownFolder = `${payload.customerId}/`;
    if (!path.startsWith(ownFolder)) {
      console.warn(
        `Rejected evidence path not owned by customer ${payload.customerId}: ${path}`,
      );
      return false;
    }
    return true;
  });

  // 5. Insert return record in canonical public.returns table
  const { data: returnRecord, error: returnError } = await supabaseAdmin
    .from("returns")
    .insert({
      sub_order_id: payload.subOrderId,
      customer_id: payload.customerId,
      reason: payload.reason || payload.reasonCode,
      reason_code: payload.reasonCode,
      evidence_urls: validatedEvidenceUrls.length > 0 ? validatedEvidenceUrls : null,
      status: "RETURN_REQUESTED",
      seller_notes: null,
      admin_notes: payload.customerNotes ?? null,
      payout_hold_placed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (returnError || !returnRecord) {
    console.error("Error creating return record:", returnError);
    throw new Error(`Failed to create return record: ${returnError?.message}`);
  }

  // 6. Insert one return_items row per selected order item (partial/multi-item support)
  const { error: itemInsertErr } = await supabaseAdmin.from("return_items").insert(
    returnLines.map((line) => ({
      return_id: returnRecord.id,
      order_item_id: line.orderItem.id,
      quantity: line.returnQty,
      condition_reported: payload.reasonCode,
      refund_amount_cents: line.lineRefundCents,
    })),
  );

  if (itemInsertErr) {
    console.error("Error creating return items:", itemInsertErr);
  }

  // 7. Update sub-order state to DISPUTED
  await supabaseAdmin
    .from("sub_orders")
    .update({
      status: "DISPUTED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.subOrderId);

  // 8. Place automatic DISPUTE_HOLD on seller ledger
  await postLedgerEntry({
    orderId: subOrder.master_order_id,
    subOrderId: payload.subOrderId,
    sellerId: subOrder.seller_id,
    entryType: "DISPUTE_HOLD",
    amountCents: refundAmountCents,
    description: `Active return request (${payload.reasonCode}) for Return #${returnRecord.id}`,
    metadata: { returnId: returnRecord.id, reasonCode: payload.reasonCode },
  });

  // 9. Audit log
  await supabaseAdmin.from("audit_logs").insert({
    action: "RETURN_REQUESTED",
    entity_type: "RETURN",
    entity_id: returnRecord.id,
    actor_id: payload.customerId,
    actor_role: "customer",
    after_data: {
      subOrderId: payload.subOrderId,
      reasonCode: payload.reasonCode,
      refundAmountCents,
    },
  });

  return {
    success: true,
    returnId: returnRecord.id,
    refundAmount,
    refundAmountCents,
    message: "Return request submitted successfully and is pending review.",
  };
}

/**
 * Approve return and set status to RETURN_APPROVED.
 */
export async function approveReturn(
  returnId: string,
  adminNotes?: string | undefined,
): Promise<{ success: boolean }> {
  const { error } = await supabaseAdmin
    .from("returns")
    .update({
      status: "RETURN_APPROVED",
      admin_notes: adminNotes ?? null,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (error) {
    throw new Error(`Failed to approve return: ${error.message}`);
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: "RETURN_APPROVED",
    entity_type: "RETURN",
    entity_id: returnId,
    after_data: { adminNotes },
  });

  return { success: true };
}

/**
 * Reject return request with reason, release payout hold, and restore sub-order to DELIVERED.
 */
export async function rejectReturn(
  returnId: string,
  rejectionReason: string,
): Promise<{ success: boolean }> {
  const { data: rawRet, error: fetchErr } = await supabaseAdmin
    .from("returns")
    .select(
      `
      id,
      sub_order_id,
      payout_hold_placed,
      return_items (
        refund_amount_cents
      ),
      sub_orders:sub_order_id (
        id,
        master_order_id,
        seller_id
      )
    `,
    )
    .eq("id", returnId)
    .single();

  if (fetchErr || !rawRet) {
    throw new Error(`Return ${returnId} not found.`);
  }

  const ret = rawRet as unknown as ReturnJoinedRow;

  await supabaseAdmin
    .from("returns")
    .update({
      status: "REJECTED",
      admin_notes: rejectionReason,
      resolved_at: new Date().toISOString(),
      payout_hold_placed: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  // Restore sub-order status back to DELIVERED
  await supabaseAdmin
    .from("sub_orders")
    .update({
      status: "DELIVERED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ret.sub_order_id);

  // Release DISPUTE_HOLD on seller ledger if hold was placed
  if (ret.payout_hold_placed) {
    const totalRefundCents = (ret.return_items || []).reduce(
      (acc: number, item) => acc + (Number(item.refund_amount_cents) || 0),
      0,
    );

    if (totalRefundCents > 0 && ret.sub_orders && ret.sub_orders.master_order_id) {
      await postLedgerEntry({
        orderId: ret.sub_orders.master_order_id,
        subOrderId: ret.sub_order_id,
        sellerId: ret.sub_orders.seller_id,
        entryType: "DISPUTE_RELEASE",
        amountCents: totalRefundCents,
        description: `Dispute hold released for rejected Return #${returnId}`,
        metadata: { returnId, rejectionReason },
      });
    }
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: "RETURN_REJECTED",
    entity_type: "RETURN",
    entity_id: returnId,
    after_data: { rejectionReason },
  });

  return { success: true };
}

/**
 * Mark return in transit.
 */
export async function markReturnInTransit(
  returnId: string,
  _trackingNumber?: string | undefined,
): Promise<{ success: boolean }> {
  const { error } = await supabaseAdmin
    .from("returns")
    .update({
      status: "RETURN_IN_TRANSIT",
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (error) {
    throw new Error(`Failed to update return tracking: ${error.message}`);
  }

  return { success: true };
}

/**
 * Mark return received at seller facility with condition inspection.
 */
export async function markReturnReceived(
  returnId: string,
  condition: "PERFECT" | "DAMAGED" | "UNACCEPTABLE",
  notes?: string | undefined,
): Promise<{ success: boolean }> {
  const { error } = await supabaseAdmin
    .from("returns")
    .update({
      status: "RETURN_RECEIVED",
      received_at: new Date().toISOString(),
      seller_notes: notes ?? `Condition: ${condition}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (error) {
    throw new Error(`Failed to update return received state: ${error.message}`);
  }

  // Update return items condition_reported
  await supabaseAdmin
    .from("return_items")
    .update({ condition_reported: condition })
    .eq("return_id", returnId);

  return { success: true };
}

/**
 * Execute Stripe partial/full refund, post compensating ledger entries, release dispute hold, and restock inventory.
 */
export async function executeReturnRefund(
  returnId: string,
  customRefundAmount?: number | undefined,
  restockItems: boolean = true,
): Promise<{ success: boolean; refundId: string; refundAmount: number; refundAmountCents: number }> {
  // 1. Fetch return details and order
  const { data: rawRet, error: retErr } = await supabaseAdmin
    .from("returns")
    .select(
      `
      id,
      sub_order_id,
      customer_id,
      return_items (
        id,
        quantity,
        refund_amount_cents,
        order_item_id,
        order_items:order_item_id (
          variant_id,
          unit_price
        )
      ),
      sub_orders:sub_order_id (
        id,
        seller_id,
        master_order_id,
        orders:master_order_id (
          id,
          payment_intent_id
        )
      )
    `,
    )
    .eq("id", returnId)
    .single();

  if (retErr || !rawRet) {
    throw new Error(`Return record ${returnId} not found.`);
  }

  const ret = rawRet as unknown as ReturnJoinedRow;

  const calculatedRefundCents = (ret.return_items || []).reduce(
    (acc: number, item) => acc + (Number(item.refund_amount_cents) || 0),
    0,
  );

  const refundAmountCents = customRefundAmount
    ? Math.round(customRefundAmount * 100)
    : calculatedRefundCents > 0
      ? calculatedRefundCents
      : 0;

  const refundAmount = Number((refundAmountCents / 100).toFixed(2));
  const masterOrderId = ret.sub_orders?.master_order_id;
  const sellerId = ret.sub_orders?.seller_id;
  const paymentIntentId = ret.sub_orders?.orders?.payment_intent_id;

  // 2. Trigger Stripe Refund if payment intent exists
  const isProduction = process.env["NODE_ENV"] === "production";
  if (!paymentIntentId && isProduction) {
    throw new Error(
      `Cannot process refund for return ${returnId}: Order ${masterOrderId} lacks an authoritative Stripe PaymentIntent.`,
    );
  }

  let stripeRefundId: string;
  const idempotencyKey = `return_refund_${returnId}`;

  if (paymentIntentId) {
    try {
      const stripeRefund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: refundAmountCents,
          reason: "requested_by_customer",
          metadata: {
            returnId,
            subOrderId: ret.sub_order_id,
            masterOrderId: masterOrderId ?? "",
          },
        },
        {
          idempotencyKey,
        },
      );
      stripeRefundId = stripeRefund.id;
    } catch (stripeErr: unknown) {
      const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
      if (
        !isProduction &&
        (!process.env["STRIPE_SECRET_KEY"] || process.env["STRIPE_SECRET_KEY"].includes("dummy"))
      ) {
        stripeRefundId = `re_dev_${Date.now()}`;
      } else {
        console.error("Stripe refund error:", msg);
        throw new Error(`Payment refund failed via Stripe: ${msg}`);
      }
    }
  } else {
    stripeRefundId = `re_dev_${Date.now()}`;
  }

  // 3. Insert record in canonical public.refunds table
  const { data: refundRecord, error: refundDbErr } = await supabaseAdmin
    .from("refunds")
    .insert({
      order_id: masterOrderId ?? "",
      sub_order_id: ret.sub_order_id,
      return_id: returnId,
      provider_refund_id: stripeRefundId,
      amount_cents: refundAmountCents,
      currency: "AUD",
      status: "succeeded",
      reason: `Customer return refund for Return #${returnId}`,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (refundDbErr) {
    console.error("Error writing refund record:", refundDbErr);
  }

  // 4. Append compensating double-entry ledger entries: CUSTOMER_REFUND and DISPUTE_RELEASE
  await postLedgerEntry({
    orderId: masterOrderId,
    subOrderId: ret.sub_order_id,
    sellerId,
    entryType: "CUSTOMER_REFUND",
    amountCents: refundAmountCents,
    description: `Refund to customer for returned items (Return #${returnId})`,
    metadata: { returnId, refundId: refundRecord?.id ?? stripeRefundId },
  });

  await postLedgerEntry({
    orderId: masterOrderId,
    subOrderId: ret.sub_order_id,
    sellerId,
    entryType: "DISPUTE_RELEASE",
    amountCents: refundAmountCents,
    description: `Dispute hold released upon refund execution for Return #${returnId}`,
    metadata: { returnId, refundId: refundRecord?.id ?? stripeRefundId },
  });

  // 5. Restock returned items if requested
  if (restockItems) {
    for (const item of ret.return_items || []) {
      const variantId = item.order_items?.variant_id;
      if (variantId) {
        await restockVariantInventory({
          variantId,
          quantity: item.quantity || 1,
          reason: "RETURN_RESTOCK",
          referenceId: ret.sub_order_id,
          note: `Restocked after return inspection #${returnId}`,
        }).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`Restock variant failed: ${msg}`);
        });
      }
    }
  }

  // 6. Update return record to REFUNDED
  await supabaseAdmin
    .from("returns")
    .update({
      status: "REFUNDED",
      resolved_at: new Date().toISOString(),
      payout_hold_placed: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  // 7. Update sub-order to CANCELLED
  await supabaseAdmin
    .from("sub_orders")
    .update({
      status: "CANCELLED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ret.sub_order_id);

  // 8. Audit log
  await supabaseAdmin.from("audit_logs").insert({
    action: "RETURN_REFUND_EXECUTED",
    entity_type: "RETURN",
    entity_id: returnId,
    after_data: { refundAmountCents, stripeRefundId },
  });

  return {
    success: true,
    refundId: refundRecord?.id ?? stripeRefundId,
    refundAmount,
    refundAmountCents,
  };
}

/**
 * Fetch detailed return information by ID.
 */
export async function getReturnDetail(returnId: string): Promise<ReturnDetail | null> {
  const { data: rawData, error } = await supabaseAdmin
    .from("returns")
    .select(
      `
      id,
      sub_order_id,
      customer_id,
      reason,
      reason_code,
      status,
      seller_notes,
      admin_notes,
      evidence_urls,
      payout_hold_placed,
      created_at,
      approved_at,
      received_at,
      resolved_at,
      sub_orders:sub_order_id (
        seller_id
      ),
      return_items (
        id,
        order_item_id,
        quantity,
        condition_reported,
        refund_amount_cents
      )
    `,
    )
    .eq("id", returnId)
    .single();

  if (error || !rawData) return null;

  const data = rawData as unknown as ReturnJoinedRow;

  const totalRefundCents = (data.return_items || []).reduce(
    (acc: number, item) => acc + (Number(item.refund_amount_cents) || 0),
    0,
  );

  return {
    id: data.id,
    subOrderId: data.sub_order_id,
    customerId: data.customer_id,
    sellerId: data.sub_orders?.seller_id ?? "",
    reason: data.reason,
    reasonCode: data.reason_code,
    status: data.status,
    refundAmountCents: totalRefundCents,
    refundAmount: Number((totalRefundCents / 100).toFixed(2)),
    customerNotes: data.admin_notes,
    sellerNotes: data.seller_notes,
    adminNotes: data.admin_notes,
    evidenceUrls: data.evidence_urls ?? [],
    payoutHoldPlaced: !!data.payout_hold_placed,
    requestedAt: data.created_at,
    approvedAt: data.approved_at,
    receivedAt: data.received_at,
    resolvedAt: data.resolved_at,
    items: (data.return_items || []).map((item) => ({
      id: item.id,
      orderItemId: item.order_item_id,
      quantity: item.quantity,
      conditionReported: item.condition_reported ?? "STANDARD",
      refundAmountCents: item.refund_amount_cents,
    })),
  };
}

/**
 * Fetch all returns initiated by a specific customer.
 */
export async function getReturnsForCustomer(customerId: string): Promise<ReturnDetail[]> {
  const { data: rawData, error } = await supabaseAdmin
    .from("returns")
    .select(
      `
      id,
      sub_order_id,
      customer_id,
      reason,
      reason_code,
      status,
      seller_notes,
      admin_notes,
      evidence_urls,
      payout_hold_placed,
      created_at,
      approved_at,
      received_at,
      resolved_at,
      sub_orders:sub_order_id (
        seller_id
      ),
      return_items (
        id,
        order_item_id,
        quantity,
        condition_reported,
        refund_amount_cents
      )
    `,
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error || !rawData) return [];

  const returns = rawData as unknown as ReturnJoinedRow[];

  return returns.map((d) => {
    const totalRefundCents = (d.return_items || []).reduce(
      (acc: number, item) => acc + (Number(item.refund_amount_cents) || 0),
      0,
    );
    return {
      id: d.id,
      subOrderId: d.sub_order_id,
      customerId: d.customer_id,
      sellerId: d.sub_orders?.seller_id ?? "",
      reason: d.reason,
      reasonCode: d.reason_code,
      status: d.status,
      refundAmountCents: totalRefundCents,
      refundAmount: Number((totalRefundCents / 100).toFixed(2)),
      customerNotes: d.admin_notes,
      sellerNotes: d.seller_notes,
      adminNotes: d.admin_notes,
      evidenceUrls: d.evidence_urls ?? [],
      payoutHoldPlaced: !!d.payout_hold_placed,
      requestedAt: d.created_at,
      approvedAt: d.approved_at,
      receivedAt: d.received_at,
      resolvedAt: d.resolved_at,
      items: (d.return_items || []).map((item) => ({
        id: item.id,
        orderItemId: item.order_item_id,
        quantity: item.quantity,
        conditionReported: item.condition_reported ?? "STANDARD",
        refundAmountCents: item.refund_amount_cents,
      })),
    };
  });
}

/**
 * Fetch all returns submitted for a seller's sub-orders.
 */
export async function getReturnsForSeller(sellerId: string): Promise<ReturnDetail[]> {
  const { data: rawData, error } = await supabaseAdmin
    .from("returns")
    .select(
      `
      id,
      sub_order_id,
      customer_id,
      reason,
      reason_code,
      status,
      seller_notes,
      admin_notes,
      evidence_urls,
      payout_hold_placed,
      created_at,
      approved_at,
      received_at,
      resolved_at,
      sub_orders:sub_order_id!inner (
        seller_id
      ),
      return_items (
        id,
        order_item_id,
        quantity,
        condition_reported,
        refund_amount_cents
      )
    `,
    )
    .eq("sub_orders.seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error || !rawData) return [];

  const returns = rawData as unknown as ReturnJoinedRow[];

  return returns.map((d) => {
    const totalRefundCents = (d.return_items || []).reduce(
      (acc: number, item) => acc + (Number(item.refund_amount_cents) || 0),
      0,
    );
    return {
      id: d.id,
      subOrderId: d.sub_order_id,
      customerId: d.customer_id,
      sellerId: d.sub_orders?.seller_id ?? "",
      reason: d.reason,
      reasonCode: d.reason_code,
      status: d.status,
      refundAmountCents: totalRefundCents,
      refundAmount: Number((totalRefundCents / 100).toFixed(2)),
      customerNotes: d.admin_notes,
      sellerNotes: d.seller_notes,
      adminNotes: d.admin_notes,
      evidenceUrls: d.evidence_urls ?? [],
      payoutHoldPlaced: !!d.payout_hold_placed,
      requestedAt: d.created_at,
      approvedAt: d.approved_at,
      receivedAt: d.received_at,
      resolvedAt: d.resolved_at,
      items: (d.return_items || []).map((item) => ({
        id: item.id,
        orderItemId: item.order_item_id,
        quantity: item.quantity,
        conditionReported: item.condition_reported ?? "STANDARD",
        refundAmountCents: item.refund_amount_cents,
      })),
    };
  });
}
