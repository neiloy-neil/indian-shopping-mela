import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-server";
import { postLedgerEntry } from "./ledger";
import { restockVariantInventory } from "./inventory";
import type { Database, ReturnReasonCode, ReturnStatus } from "@/lib/supabase/types";

export interface CreateReturnPayload {
  subOrderId: string;
  orderItemId: string;
  customerId: string;
  quantity: number;
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
    return createCustomerReturnRequest(data);
  });

/**
 * Server Function: Admin or Seller approves return request.
 */
export const approveReturnServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string; adminNotes?: string | undefined }) => data)
  .handler(async ({ data }) => {
    return approveReturn(data.returnId, data.adminNotes);
  });

/**
 * Server Function: Admin or Seller rejects return request with reason.
 */
export const rejectReturnServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string; rejectionReason: string }) => data)
  .handler(async ({ data }) => {
    return rejectReturn(data.returnId, data.rejectionReason);
  });

/**
 * Server Function: Mark return package in transit with carrier tracking.
 */
export const markReturnInTransitServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string; trackingNumber?: string | undefined }) => data)
  .handler(async ({ data }) => {
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
    return markReturnReceived(data.returnId, data.condition, data.notes);
  });

/**
 * Server Function: Execute Stripe refund and ledger reconciliation upon return inspection.
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
    return executeReturnRefund(data.returnId, data.refundAmount, data.restockItems ?? true);
  });

/**
 * Server Function: Fetch return details by ID.
 */
export const getReturnDetailServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string }) => data)
  .handler(async ({ data }) => {
    return getReturnDetail(data.returnId);
  });

/**
 * Server Function: Fetch all returns for a customer.
 */
export const getReturnsForCustomerServerFn = createServerFn({ method: "POST" })
  .validator((data: { customerId: string }) => data)
  .handler(async ({ data }) => {
    return getReturnsForCustomer(data.customerId);
  });

/**
 * Server Function: Fetch all returns for a seller.
 */
export const getReturnsForSellerServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
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

  // 2. Fetch the target order item
  const { data: orderItem, error: itemErr } = await supabaseAdmin
    .from("order_items")
    .select("id, unit_price, quantity, variant_id, product_name")
    .eq("id", payload.orderItemId)
    .single();

  if (itemErr || !orderItem) {
    throw new Error(`Order item ${payload.orderItemId} not found.`);
  }

  const returnQty = Math.min(payload.quantity || 1, orderItem.quantity || 1);
  const refundAmount = Number((Number(orderItem.unit_price) * returnQty).toFixed(2));
  const refundAmountCents = Math.round(refundAmount * 100);

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

  // 5. Insert return record in canonical public.returns table
  const { data: returnRecord, error: returnError } = await supabaseAdmin
    .from("returns")
    .insert({
      sub_order_id: payload.subOrderId,
      customer_id: payload.customerId,
      reason: payload.reason || payload.reasonCode,
      reason_code: payload.reasonCode,
      evidence_urls: payload.evidenceUrls ?? null,
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

  // 6. Insert return item in canonical public.return_items table
  const { error: itemInsertErr } = await supabaseAdmin.from("return_items").insert({
    return_id: returnRecord.id,
    order_item_id: payload.orderItemId,
    quantity: returnQty,
    condition_reported: payload.reasonCode,
    refund_amount_cents: refundAmountCents,
  });

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
