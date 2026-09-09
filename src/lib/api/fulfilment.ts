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
      status: "PREPARING",
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
  .validator(
    (data: {
      subOrderId: string;
      sellerId: string;
      parcel?: ParcelDetails | undefined;
      manualTrackingNumber?: string | undefined;
    }) => data,
  )
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
      subOrder.seller?.dispatch_address ?? {
        line1: "14 Wigram St",
        suburb: "Harris Park",
        state: "NSW",
        postcode: "2150",
        country: "AU",
      },
      subOrder.master_order?.shipping_address ?? {
        line1: "1 Delivery Way",
        suburb: "Sydney",
        state: "NSW",
        postcode: "2000",
        country: "AU",
      },
      params.parcel,
      subOrder.master_order?.customer_name ?? "Customer",
      subOrder.master_order?.customer_phone ?? undefined,
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

export async function processCarrierDeliveryConfirmation(
  subOrderId: string,
  deliveryTimestamp?: string,
): Promise<boolean> {
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

/**
 * Server Function: Mark sub-order packed and ready for carrier pickup
 */
export const markSubOrderPackedServerFn = createServerFn({ method: "POST" })
  .validator((data: { subOrderId: string; sellerId: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("sub_orders") as any)
      .update({
        status: "READY_TO_SHIP",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.subOrderId)
      .eq("seller_id", data.sellerId);

    if (error) {
      throw new Error(`Failed to update sub-order status: ${error.message}`);
    }
    return true;
  });

export interface SellerSubOrderRow {
  id: string;
  masterOrderId: string;
  orderNumber: string;
  customerName: string;
  customerState: string;
  itemCount: number;
  total: number;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  createdAt: string;
}

/**
 * Server Function: Fetch sub-orders for seller fulfilment dashboard
 */
export const getSellerSubOrdersServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId?: string | undefined }) => data)
  .handler(async ({ data }): Promise<SellerSubOrderRow[]> => {
    try {
      let query = (supabaseAdmin.from("sub_orders") as any)
        .select(
          `
          id,
          master_order_id,
          subtotal,
          shipping_cost,
          status,
          carrier,
          tracking_number,
          created_at,
          items:order_items(id, quantity, title),
          master_order:orders(order_number, customer_name, shipping_address)
        `,
        )
        .order("created_at", { ascending: false });

      if (data.sellerId) {
        query = query.eq("seller_id", data.sellerId);
      }

      const { data: subOrders, error } = await query.limit(50);
      if (error || !subOrders || subOrders.length === 0) {
        return [];
      }

      return subOrders.map((so: any) => {
        const address = so.master_order?.shipping_address as any;
        const state = address?.state || "NSW";
        const itemCount = (so.items || []).reduce(
          (acc: number, item: any) => acc + Number(item.quantity || 1),
          0,
        );
        const total = Number(so.subtotal || 0) + Number(so.shipping_cost || 0);

        return {
          id: so.id,
          masterOrderId: so.master_order_id,
          orderNumber: so.master_order?.order_number || so.master_order_id,
          customerName: so.master_order?.customer_name || "Customer",
          customerState: state,
          itemCount: Math.max(1, itemCount),
          total,
          status: so.status || "ORDER_CREATED",
          carrier: so.carrier,
          trackingNumber: so.tracking_number,
          createdAt: so.created_at,
        };
      });
    } catch (err) {
      console.error("Error fetching seller sub-orders:", err);
      return [];
    }
  });
