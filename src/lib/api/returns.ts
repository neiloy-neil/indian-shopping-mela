import { supabaseAdmin } from "@/lib/supabase/server";
import type { ReturnStatus } from "@/lib/supabase/types";

export interface CreateReturnPayload {
  subOrderId: string;
  orderItemId: string;
  customerId: string;
  quantity: number;
  reason: string;
  reasonCode: "CHANGED_MIND" | "WRONG_SIZE" | "WRONG_ITEM" | "DAMAGED_IN_TRANSIT" | "DEFECTIVE_FAULTY" | "NOT_AS_DESCRIBED";
  evidenceUrls?: string[] | undefined;
}

/**
 * Customer initiates a return request.
 * Enforces the 7-day change-of-mind window rule from confirmed delivery.
 */
export async function createCustomerReturnRequest(payload: CreateReturnPayload): Promise<{
  success: boolean;
  returnId: string;
  message: string;
}> {
  // 1. Fetch sub-order delivery and return eligibility window
  const { data: subOrder } = await (supabaseAdmin.from("sub_orders") as any)
    .select("status, delivered_at, can_return_until")
    .eq("id", payload.subOrderId)
    .single();

  if (!subOrder || subOrder.status !== "DELIVERED") {
    throw new Error("Returns are only permitted on confirmed delivered orders.");
  }

  // 2. Validate 7-day return window for CHANGE_OF_MIND / WRONG_SIZE
  if (payload.reasonCode === "CHANGED_MIND" || payload.reasonCode === "WRONG_SIZE") {
    if (subOrder.can_return_until && new Date() > new Date(subOrder.can_return_until)) {
      throw new Error("The 7-day change-of-mind return window has expired for this package.");
    }
  }

  // 3. Insert return request record
  const { data: returnRecord, error: returnError } = await (supabaseAdmin.from("return_requests") as any)
    .insert({
      sub_order_id: payload.subOrderId,
      order_item_id: payload.orderItemId,
      customer_id: payload.customerId,
      quantity: payload.quantity,
      reason: payload.reason,
      reason_code: payload.reasonCode,
      evidence_urls: payload.evidenceUrls ?? [],
      status: "RETURN_REQUESTED",
    })
    .select()
    .single();

  if (returnError || !returnRecord) {
    console.error("Error creating return request:", returnError);
    throw returnError;
  }

  // 4. Place immediate automatic PAYOUT_HOLD on the affected seller ledger entry (§8, §21)
  await (supabaseAdmin.from("payout_ledger") as any)
    .update({
      status: "PAYOUT_HOLD",
      hold_reason: `Active customer return request (${payload.reasonCode}): Return #${returnRecord.id}`,
    })
    .eq("sub_order_id", payload.subOrderId);

  // 5. Audit log
  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "RETURN_REQUESTED",
    entity_type: "RETURN_REQUEST",
    entity_id: returnRecord.id,
    after_data: { subOrderId: payload.subOrderId, reasonCode: payload.reasonCode },
  });

  return {
    success: true,
    returnId: returnRecord.id,
    message: "Return request submitted successfully and is pending review.",
  };
}

/**
 * Admin approves return or processes refund upon item receipt.
 */
export async function updateReturnRequestStatus(
  returnId: string,
  newStatus: ReturnStatus,
  adminNotes?: string | undefined,
  refundAmount?: number | undefined
): Promise<boolean> {
  const { data: ret } = await (supabaseAdmin.from("return_requests") as any)
    .update({
      status: newStatus,
      admin_notes: adminNotes ?? null,
      refund_amount: refundAmount ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId)
    .select("sub_order_id")
    .single();

  if (ret && newStatus === "REFUNDED") {
    // If refunded, deduct refund from seller ledger
    await (supabaseAdmin.from("payout_ledger") as any)
      .update({
        status: "CANCELLED",
        hold_reason: `Order refunded to customer following return #${returnId}`,
      })
      .eq("sub_order_id", ret.sub_order_id);
  }

  return true;
}
