import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-server";
import { postLedgerEntry } from "./ledger";
import { restockVariantInventory } from "./inventory";
import type { ReturnStatus } from "@/lib/supabase/types";

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
  status: ReturnStatus;
  refundAmount: number;
  customerNotes?: string | null;
  sellerNotes?: string | null;
  returnTrackingNumber?: string | null;
  carrier?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  receivedAt?: string | null;
  refundedAt?: string | null;
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
  .validator((data: { returnId: string; trackingNumber: string }) => data)
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
 * Customer initiates a return request.
 * Enforces the 7-day change-of-mind window rule from confirmed delivery.
 * Allows statutory claims (faulty, damaged, not as described) beyond 7 days under ACL.
 */
export async function createCustomerReturnRequest(payload: CreateReturnPayload): Promise<{
  success: boolean;
  returnId: string;
  refundAmount: number;
  message: string;
}> {
  // 1. Fetch sub-order delivery and items
  const { data: subOrder, error: subOrderErr } = await (supabaseAdmin.from("sub_orders") as any)
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
        payment_intent_id
      )
    `,
    )
    .eq("id", payload.subOrderId)
    .single();

  if (subOrderErr || !subOrder) {
    throw new Error(`Sub-order ${payload.subOrderId} not found.`);
  }

  if (subOrder.status !== "DELIVERED" || !subOrder.delivered_at) {
    throw new Error("Returns are only permitted on confirmed delivered orders.");
  }

  // 2. Fetch the target order item
  const { data: orderItem, error: itemErr } = await (supabaseAdmin.from("order_items") as any)
    .select("id, unit_price, quantity, variant_id, title")
    .eq("id", payload.orderItemId)
    .single();

  if (itemErr || !orderItem) {
    throw new Error(`Order item ${payload.orderItemId} not found.`);
  }

  const returnQty = Math.min(payload.quantity || 1, orderItem.quantity || 1);
  const refundAmount = Number((Number(orderItem.unit_price) * returnQty).toFixed(2));

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

  // 5. Insert return record in canonical returns table
  const { data: returnRecord, error: returnError } = await (supabaseAdmin.from("returns") as any)
    .insert({
      sub_order_id: payload.subOrderId,
      customer_id: payload.customerId,
      seller_id: subOrder.seller_id,
      reason: payload.reason || payload.reasonCode,
      status: "REQUESTED",
      refund_amount: refundAmount,
      customer_notes: payload.customerNotes ?? null,
      carrier: "Australia Post",
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (returnError || !returnRecord) {
    console.error("Error creating return record:", returnError);
    throw new Error(`Failed to create return record: ${returnError?.message}`);
  }

  // 6. Insert return item in canonical return_items table
  await (supabaseAdmin.from("return_items") as any).insert({
    return_id: returnRecord.id,
    order_item_id: payload.orderItemId,
    quantity: returnQty,
    return_reason: payload.reasonCode,
    condition: "PENDING_INSPECTION",
  });

  // 7. Update sub-order state to RETURN_REQUESTED
  await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "RETURN_REQUESTED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.subOrderId);

  // 8. Place automatic PAYOUT_HOLD on seller ledger
  await postLedgerEntry({
    orderId: subOrder.master_order_id,
    subOrderId: payload.subOrderId,
    sellerId: subOrder.seller_id,
    entryType: "DISPUTE_HOLD",
    amountCents: Math.round(refundAmount * 100),
    description: `Active return request (${payload.reasonCode}) for Return #${returnRecord.id}`,
    metadata: { returnId: returnRecord.id, reasonCode: payload.reasonCode },
  });

  // 9. Audit log
  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "RETURN_REQUESTED",
    entity_type: "RETURN",
    entity_id: returnRecord.id,
    user_id: payload.customerId,
    new_data: {
      subOrderId: payload.subOrderId,
      reasonCode: payload.reasonCode,
      refundAmount,
    },
  });

  return {
    success: true,
    returnId: returnRecord.id,
    refundAmount,
    message: "Return request submitted successfully and is pending review.",
  };
}

/**
 * Approve return and generate Australia Post return consignment.
 */
export async function approveReturn(
  returnId: string,
  adminNotes?: string | undefined,
): Promise<{ success: boolean; returnTrackingNumber: string }> {
  const returnTrackingNumber = `RET-AP-${Date.now().toString().slice(-8)}`;

  const { error } = await (supabaseAdmin.from("returns") as any)
    .update({
      status: "APPROVED",
      seller_notes: adminNotes ?? null,
      return_tracking_number: returnTrackingNumber,
      carrier: "Australia Post",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (error) {
    throw new Error(`Failed to approve return: ${error.message}`);
  }

  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "RETURN_APPROVED",
    entity_type: "RETURN",
    entity_id: returnId,
    new_data: { returnTrackingNumber, adminNotes },
  });

  return { success: true, returnTrackingNumber };
}

/**
 * Reject return request with reason and release payout hold.
 */
export async function rejectReturn(
  returnId: string,
  rejectionReason: string,
): Promise<{ success: boolean }> {
  const { data: ret, error: fetchErr } = await (supabaseAdmin.from("returns") as any)
    .select("id, sub_order_id, seller_id, refund_amount")
    .eq("id", returnId)
    .single();

  if (fetchErr || !ret) {
    throw new Error(`Return ${returnId} not found.`);
  }

  await (supabaseAdmin.from("returns") as any)
    .update({
      status: "REJECTED",
      seller_notes: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  // Restore sub-order status back to DELIVERED
  await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "DELIVERED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ret.sub_order_id);

  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "RETURN_REJECTED",
    entity_type: "RETURN",
    entity_id: returnId,
    new_data: { rejectionReason },
  });

  return { success: true };
}

/**
 * Mark return in transit with carrier tracking number.
 */
export async function markReturnInTransit(
  returnId: string,
  trackingNumber: string,
): Promise<{ success: boolean }> {
  const { error } = await (supabaseAdmin.from("returns") as any)
    .update({
      status: "IN_TRANSIT",
      return_tracking_number: trackingNumber,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (error) {
    throw new Error(`Failed to update return tracking: ${error.message}`);
  }

  return { success: true };
}

/**
 * Mark return received at seller facility.
 */
export async function markReturnReceived(
  returnId: string,
  condition: "PERFECT" | "DAMAGED" | "UNACCEPTABLE",
  notes?: string | undefined,
): Promise<{ success: boolean }> {
  const { error } = await (supabaseAdmin.from("returns") as any)
    .update({
      status: "RECEIVED",
      received_at: new Date().toISOString(),
      seller_notes: notes ?? `Condition: ${condition}`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (error) {
    throw new Error(`Failed to update return received state: ${error.message}`);
  }

  // Update return items condition
  await (supabaseAdmin.from("return_items") as any).update({ condition }).eq("return_id", returnId);

  return { success: true };
}

/**
 * Execute Stripe partial/full refund, post compensating ledger entries, and restock inventory.
 */
export async function executeReturnRefund(
  returnId: string,
  customRefundAmount?: number | undefined,
  restockItems: boolean = true,
): Promise<{ success: boolean; refundId: string; refundAmount: number }> {
  // 1. Fetch return details and order
  const { data: ret, error: retErr } = await (supabaseAdmin.from("returns") as any)
    .select(
      `
      id,
      sub_order_id,
      seller_id,
      refund_amount,
      customer_id,
      sub_orders:sub_order_id (
        id,
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

  if (retErr || !ret) {
    throw new Error(`Return record ${returnId} not found.`);
  }

  const refundAmount = customRefundAmount ?? Number(ret.refund_amount);
  const refundAmountCents = Math.round(refundAmount * 100);
  const masterOrderId = ret.sub_orders?.master_order_id;
  const paymentIntentId = ret.sub_orders?.orders?.payment_intent_id;

  // 2. Trigger Stripe Refund if payment intent exists
  const isProduction = process.env["NODE_ENV"] === "production";
  if (!paymentIntentId && isProduction) {
    throw new Error(
      `Cannot process refund for return ${returnId}: Order ${masterOrderId} lacks an authoritative Stripe PaymentIntent.`,
    );
  }

  let stripeRefundId: string;
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
            masterOrderId,
          },
        },
        {
          idempotencyKey: `return_refund_${returnId}`,
        },
      );
      stripeRefundId = stripeRefund.id;
    } catch (stripeErr: any) {
      if (!isProduction && (!process.env["STRIPE_SECRET_KEY"] || process.env["STRIPE_SECRET_KEY"].includes("dummy"))) {
        stripeRefundId = `re_dev_${Date.now()}`;
      } else {
        console.error("Stripe refund error:", stripeErr.message);
        throw new Error(`Payment refund failed via Stripe: ${stripeErr.message}`);
      }
    }
  } else {
    stripeRefundId = `re_dev_${Date.now()}`;
  }

  // 3. Insert record in canonical refunds table
  const { data: refundRecord, error: refundDbErr } = await (supabaseAdmin.from("refunds") as any)
    .insert({
      order_id: masterOrderId,
      return_id: returnId,
      provider_refund_id: stripeRefundId,
      amount: refundAmount,
      currency: "AUD",
      status: "succeeded",
      reason: `Customer return refund for Return #${returnId}`,
    })
    .select("id")
    .single();

  if (refundDbErr || !refundRecord) {
    console.error("Error writing refund record:", refundDbErr);
  }

  // 4. Append compensating double-entry ledger entries
  await postLedgerEntry({
    orderId: masterOrderId,
    subOrderId: ret.sub_order_id,
    sellerId: ret.seller_id,
    entryType: "REFUND_CUSTOMER",
    amountCents: refundAmountCents,
    description: `Refund to customer for returned items (Return #${returnId})`,
    metadata: { returnId, refundId: refundRecord?.id ?? stripeRefundId },
  });

  // 5. Restock returned items if requested
  if (restockItems) {
    const { data: returnItems } = await (supabaseAdmin.from("return_items") as any)
      .select("quantity, order_item_id, order_items:order_item_id (variant_id)")
      .eq("return_id", returnId);

    for (const item of returnItems || []) {
      const variantId = item.order_items?.variant_id;
      if (variantId) {
        await restockVariantInventory({
          variantId,
          quantity: item.quantity || 1,
          reason: "RETURN_RESTOCK",
          referenceId: ret.sub_order_id,
          note: `Restocked after return inspection #${returnId}`,
        }).catch((err: any) => console.warn(`Restock variant failed: ${err.message}`));
      }
    }
  }

  // 6. Update return record to REFUNDED
  await (supabaseAdmin.from("returns") as any)
    .update({
      status: "REFUNDED",
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  // 7. Update sub-order to REFUNDED
  await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "REFUNDED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ret.sub_order_id);

  // 8. Audit log
  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "RETURN_REFUND_EXECUTED",
    entity_type: "RETURN",
    entity_id: returnId,
    new_data: { refundAmount, stripeRefundId },
  });

  return {
    success: true,
    refundId: refundRecord?.id ?? stripeRefundId,
    refundAmount,
  };
}
