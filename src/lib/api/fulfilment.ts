import { supabaseAdmin } from "@/lib/supabase/server";
import { AusPostShippingProvider, type ParcelDetails } from "./shipping";

/**
 * Seller accepts a sub-order and begins packaging.
 */
export async function acceptSubOrder(subOrderId: string, sellerId: string): Promise<boolean> {
  const { error } = await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "SELLER_ACCEPTED",
      seller_accepted_at: new Date().toISOString(),
    })
    .eq("id", subOrderId)
    .eq("seller_id", sellerId);

  if (error) {
    console.error(`Error accepting sub-order ${subOrderId}:`, error);
    throw error;
  }
  return true;
}

/**
 * Seller marks order Ready to Ship and generates a courier shipping label.
 */
export async function generateShippingLabelForSubOrder(params: {
  subOrderId: string;
  sellerId: string;
  parcel: ParcelDetails;
  manualTrackingNumber?: string | undefined;
}): Promise<{ trackingNumber: string; labelPdfUrl: string }> {
  // 1. Fetch sub-order & master order customer address
  const { data: subOrder } = await (supabaseAdmin.from("sub_orders") as any)
    .select("*, master_order:orders(*), seller:sellers(*)")
    .eq("id", params.subOrderId)
    .eq("seller_id", params.sellerId)
    .single();

  if (!subOrder) throw new Error("Sub-order not found or unauthorized.");

  let trackingNumber = params.manualTrackingNumber;
  let labelPdfUrl = `https://storage.indianshoppingmela.com.au/labels/${params.subOrderId}.pdf`;
  let carrier = "Australia Post";

  // 2. Generate label via AusPost provider if no manual tracking provided
  if (!trackingNumber) {
    const provider = new AusPostShippingProvider();
    const shipmentResult = await provider.createShipment(
      params.subOrderId,
      subOrder.seller.dispatch_address,
      subOrder.master_order.shipping_address,
      params.parcel,
      subOrder.master_order.customer_name,
      subOrder.master_order.customer_phone
    );
    trackingNumber = shipmentResult.trackingNumber;
    labelPdfUrl = shipmentResult.labelPdfUrl;
    carrier = shipmentResult.carrier;
  }

  // 3. Save shipping label record
  await (supabaseAdmin.from("shipping_labels") as any).insert({
    sub_order_id: params.subOrderId,
    carrier,
    tracking_number: trackingNumber,
    label_pdf_url: labelPdfUrl,
  });

  // 4. Update sub-order state to LABEL_CREATED & SHIPPED
  await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "SHIPPED",
      carrier,
      tracking_number: trackingNumber,
      tracking_url: `https://auspost.com.au/mypost/track/#/details/${trackingNumber}`,
      shipped_at: new Date().toISOString(),
    })
    .eq("id", params.subOrderId);

  // 5. Append audit log
  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "SHIPMENT_DISPATCHED",
    entity_type: "SUB_ORDER",
    entity_id: params.subOrderId,
    after_data: { trackingNumber, carrier, labelPdfUrl },
  });

  return { trackingNumber, labelPdfUrl };
}

/**
 * Handle courier delivery webhook confirmation (Starts 7-day return & 14-day payout clocks).
 */
export async function processCarrierDeliveryConfirmation(subOrderId: string, deliveryTimestamp?: string): Promise<boolean> {
  const deliveredAt = deliveryTimestamp ? new Date(deliveryTimestamp) : new Date();
  const canReturnUntil = new Date(deliveredAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
  const eligiblePayoutAt = new Date(deliveredAt.getTime() + 14 * 24 * 60 * 60 * 1000); // +14 days

  // 1. Update sub-order delivery states
  await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "DELIVERED",
      delivered_at: deliveredAt.toISOString(),
      can_return_until: canReturnUntil.toISOString(),
    })
    .eq("id", subOrderId);

  // 2. Set authoritative payout eligibility date in ledger (§7, §21)
  await (supabaseAdmin.from("payout_ledger") as any)
    .update({
      eligible_at: eligiblePayoutAt.toISOString(),
      hold_reason: "Eligible 14 days after confirmed delivery (subject to returns/disputes)",
    })
    .eq("sub_order_id", subOrderId);

  return true;
}
