import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { AusPostShippingProvider, type ParcelDetails } from "./shipping";

/**
 * Server Function: Seller accepts a sub-order and begins packaging.
 */
export const acceptSubOrderServerFn = createServerFn({ method: "POST" })
  .validator((data: { subOrderId: string; sellerId: string }) => data)
  .handler(async ({ data }) => {
    return acceptSubOrder(data.subOrderId, data.sellerId);
  });

export async function acceptSubOrder(subOrderId: string, sellerId: string): Promise<boolean> {
  const { error } = await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "PROCESSING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", subOrderId)
    .eq("seller_id", sellerId);

  if (error) {
    console.error(`Error accepting sub-order ${subOrderId}:`, error);
    throw new Error(`Failed to accept sub-order: ${error.message}`);
  }
  return true;
}

/**
 * Server Function: Seller marks order Ready to Ship and generates courier shipping label.
 */
export const generateShippingLabelServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    subOrderId: string;
    sellerId: string;
    parcel?: ParcelDetails | undefined;
    manualTrackingNumber?: string | undefined;
  }) => data)
  .handler(async ({ data }) => {
    return generateShippingLabelForSubOrder({
      subOrderId: data.subOrderId,
      sellerId: data.sellerId,
      parcel: data.parcel ?? { weightKg: 0.5 },
      manualTrackingNumber: data.manualTrackingNumber,
    });
  });

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
      subOrder.seller?.dispatch_address ?? { line1: "14 Wigram St", suburb: "Harris Park", state: "NSW", postcode: "2150", country: "AU" },
      subOrder.master_order?.shipping_address ?? { line1: "1 Delivery Way", suburb: "Sydney", state: "NSW", postcode: "2000", country: "AU" },
      params.parcel,
      subOrder.master_order?.customer_name ?? "Customer",
      subOrder.master_order?.customer_phone ?? undefined
    );
    trackingNumber = shipmentResult.trackingNumber;
    labelPdfUrl = shipmentResult.labelPdfUrl;
    carrier = shipmentResult.carrier;
  }

  // 3. Save shipping label record
  await (supabaseAdmin.from("shipments") as any).insert({
    sub_order_id: params.subOrderId,
    carrier,
    tracking_number: trackingNumber,
    status: "LABEL_CREATED",
  });

  // 4. Update sub-order state to SHIPPED
  await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "SHIPPED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.subOrderId);

  // 5. Append audit log
  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "SHIPMENT_DISPATCHED",
    entity_type: "SUB_ORDER",
    entity_id: params.subOrderId,
    payload: { trackingNumber, carrier, labelPdfUrl },
  });

  return { trackingNumber, labelPdfUrl };
}

/**
 * Server Function: Handle courier delivery webhook confirmation (Starts 7-day return & 14-day payout clocks).
 */
export const processCarrierDeliveryConfirmationServerFn = createServerFn({ method: "POST" })
  .validator((data: { subOrderId: string; deliveryTimestamp?: string | undefined }) => data)
  .handler(async ({ data }) => {
    return processCarrierDeliveryConfirmation(data.subOrderId, data.deliveryTimestamp);
  });

export async function processCarrierDeliveryConfirmation(subOrderId: string, deliveryTimestamp?: string): Promise<boolean> {
  const deliveredAt = deliveryTimestamp ? new Date(deliveryTimestamp) : new Date();

  // 1. Update sub-order delivery states
  await (supabaseAdmin.from("sub_orders") as any)
    .update({
      status: "DELIVERED",
      updated_at: deliveredAt.toISOString(),
    })
    .eq("id", subOrderId);

  return true;
}
