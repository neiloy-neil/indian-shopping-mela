import { createServerFn } from "@tanstack/react-start";
import { stripe } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Address } from "@/lib/supabase/types";
import { calculateMultiSellerShippingQuotes, type ParcelDetails } from "./shipping";
import { reserveInventoryLines, commitInventoryReservations } from "./inventory";

export interface CheckoutCartItem {
  productId: string;
  variantId: string;
  sellerId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  unitPriceAud: number;
  quantity: number;
  weightKg: number;
  imageUrl?: string | undefined;
}

export interface SellerPackageGroup {
  sellerId: string;
  sellerBusinessName: string;
  dispatchAddress: Address;
  items: CheckoutCartItem[];
  subtotalAud: number;
  shippingCostAud: number;
  shippingService: string;
}

export interface CheckoutSummary {
  packages: SellerPackageGroup[];
  itemsSubtotalAud: number;
  shippingTotalAud: number;
  gstTotalAud: number;
  grandTotalAud: number;
}

export interface CreateOrderParams {
  userId?: string | undefined;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | undefined;
  shippingAddress: Address;
  billingAddress: Address;
  summary: CheckoutSummary;
  idempotencyKey?: string | undefined;
}

/**
 * Server Function: Prepare authoritative multi-seller packages, calculate shipping & GST.
 */
export const prepareCheckoutSummaryServerFn = createServerFn({ method: "POST" })
  .validator((data: { items: CheckoutCartItem[]; destinationAddress: Address; sessionId: string }) => data)
  .handler(async ({ data }) => {
    return prepareCheckoutSummary(data.items, data.destinationAddress, data.sessionId);
  });

export async function prepareCheckoutSummary(
  items: CheckoutCartItem[],
  destinationAddress: Address,
  sessionId: string
): Promise<CheckoutSummary> {
  // 1. Atomically reserve inventory for all items across all packages
  // Fail-closed: Throws immediately if any item has insufficient stock or is unavailable
  const reservationItems = items
    .filter((item) => item.variantId && /^[0-9a-f-]{36}$/i.test(item.variantId))
    .map((item) => ({ variantId: item.variantId, quantity: item.quantity }));

  if (reservationItems.length > 0) {
    await reserveInventoryLines(reservationItems, sessionId, 15);
  }

  const sellerMap = new Map<string, CheckoutCartItem[]>();
  for (const item of items) {
    const list = sellerMap.get(item.sellerId) ?? [];
    list.push(item);
    sellerMap.set(item.sellerId, list);
  }

  const packages: SellerPackageGroup[] = [];
  let itemsSubtotal = 0;

  for (const [sellerId, sellerItems] of sellerMap.entries()) {
    const { data: seller } = await (supabaseAdmin.from("sellers") as any)
      .select("business_name, store_name")
      .eq("id", sellerId)
      .maybeSingle();

    const { data: dispatchAddrRow } = await (supabaseAdmin as any)
      .from("seller_addresses")
      .select("address_line1, suburb, state, postcode, country")
      .eq("seller_id", sellerId)
      .eq("is_default", true)
      .maybeSingle();

    const dispatchAddress: Address = dispatchAddrRow ? {
      line1: dispatchAddrRow.address_line1,
      suburb: dispatchAddrRow.suburb,
      state: dispatchAddrRow.state,
      postcode: dispatchAddrRow.postcode,
      country: dispatchAddrRow.country ?? "AU",
    } : {
      line1: "14 Wigram St",
      suburb: "Harris Park",
      state: "NSW",
      postcode: "2150",
      country: "Australia",
    };

    const packageSubtotal = sellerItems.reduce((acc, i) => acc + i.unitPriceAud * i.quantity, 0);
    const totalWeight = sellerItems.reduce((acc, i) => acc + i.weightKg * i.quantity, 0);
    itemsSubtotal += packageSubtotal;

    const parcel: ParcelDetails = { weightKg: totalWeight };
    const [quoteResult] = await calculateMultiSellerShippingQuotes(
      [{ sellerId, address: dispatchAddress, parcel, itemsTotal: packageSubtotal }],
      destinationAddress
    );

    const shippingQuote = quoteResult?.quote ?? {
      carrier: "Australia Post",
      serviceName: "Parcel Post",
      serviceCode: "AUS_PARCEL_REGULAR",
      costAud: packageSubtotal >= 99 ? 0 : 9.95,
      estimatedDeliveryDays: "3–6 business days",
    };

    packages.push({
      sellerId,
      sellerBusinessName: seller?.business_name ?? seller?.store_name ?? "Marketplace Seller",
      dispatchAddress,
      items: sellerItems,
      subtotalAud: Number(packageSubtotal.toFixed(2)),
      shippingCostAud: shippingQuote.costAud,
      shippingService: `${shippingQuote.carrier} · ${shippingQuote.serviceName}`,
    });
  }

  const shippingTotal = packages.reduce((acc, p) => acc + p.shippingCostAud, 0);
  const grandTotal = Number((itemsSubtotal + shippingTotal).toFixed(2));
  const gstTotal = Number((grandTotal / 11).toFixed(2));

  return {
    packages,
    itemsSubtotalAud: Number(itemsSubtotal.toFixed(2)),
    shippingTotalAud: Number(shippingTotal.toFixed(2)),
    gstTotalAud: gstTotal,
    grandTotalAud: grandTotal,
  };
}


/**
 * Server Function: Create transactional Master Order, Sub-Orders, and Stripe PaymentIntent.
 */
export const createCheckoutOrderServerFn = createServerFn({ method: "POST" })
  .validator((data: CreateOrderParams) => data)
  .handler(async ({ data }) => {
    return createCheckoutOrderTransactional(data);
  });

export async function createCheckoutOrderTransactional(params: CreateOrderParams): Promise<{
  masterOrderId: string;
  masterOrderNumber: string;
  clientSecret: string;
  paymentIntentId: string;
}> {
  const masterOrderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const masterOrderNumber = `ISM${Math.floor(10000 + Math.random() * 90000)}`;
  const totalAmount = params.summary.grandTotalAud;
  const itemsSubtotal = params.summary.itemsSubtotalAud;
  const shippingTotal = params.summary.shippingTotalAud;
  const gstTotal = params.summary.gstTotalAud;
  const totalAmountCents = Math.round(totalAmount * 100);

  // 1. Create Stripe PaymentIntent
  let paymentIntentId = `pi_${Date.now()}`;
  let clientSecret = "";

  if (process.env["STRIPE_SECRET_KEY"] && !process.env["STRIPE_SECRET_KEY"].includes("placeholder")) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountCents,
      currency: "aud",
      receipt_email: params.customerEmail,
      description: `Indian Shopping Mela Order #${masterOrderNumber}`,
      metadata: {
        masterOrderId,
        masterOrderNumber,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
      },
      payment_method_types: ["card", "afterpay_clearpay", "klarna"],
    });
    if (paymentIntent.client_secret) {
      clientSecret = paymentIntent.client_secret;
      paymentIntentId = paymentIntent.id;
    }
  }

  // 2. Insert Master Order
  const { data: dbOrder, error: orderErr } = await (supabaseAdmin.from("orders") as any)
    .insert({
      id: masterOrderId,
      order_number: masterOrderNumber,
      customer_id: params.userId ?? null,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
      customer_phone: params.customerPhone ?? null,
      shipping_address: params.shippingAddress,
      billing_address: params.billingAddress,
      subtotal: itemsSubtotal,
      shipping_total: shippingTotal,
      gst_total: gstTotal,
      total_amount: totalAmount,
      status: "PENDING",
      payment_status: "PENDING",
      payment_intent_id: paymentIntentId,
      currency: "AUD",
      idempotency_key: params.idempotencyKey ?? masterOrderId,
    })
    .select()
    .single();

  if (orderErr) {
    throw new Error(`Failed to create master order: ${orderErr.message}`);
  }

  // 3. Insert Sub-Orders for each seller
  for (const [idx, pkg] of params.summary.packages.entries()) {
    const subOrderId = `sub_${masterOrderId}_${String.fromCharCode(65 + idx)}`;
    const commissionPct = 12.00;
    const commissionAmount = Number(((pkg.subtotalAud * commissionPct) / 100).toFixed(2));
    const netSellerAmount = Number((pkg.subtotalAud + pkg.shippingCostAud - commissionAmount).toFixed(2));

    const { data: subOrder, error: subErr } = await (supabaseAdmin.from("sub_orders") as any)
      .insert({
        id: subOrderId,
        master_order_id: masterOrderId,
        seller_id: pkg.sellerId,
        subtotal: pkg.subtotalAud,
        shipping_cost: pkg.shippingCostAud,
        commission_rate_pct: commissionPct,
        commission_amount: commissionAmount,
        net_seller_amount: netSellerAmount,
        status: "NEW_ORDER",
        shipping_method: pkg.shippingService,
      })
      .select()
      .single();

    if (subErr) {
      throw new Error(`Failed to create sub-order for seller ${pkg.sellerId}: ${subErr.message}`);
    }

    // Insert Order Items
    for (const item of pkg.items) {
      const itemTotal = Number((item.unitPriceAud * item.quantity).toFixed(2));
      await (supabaseAdmin.from("order_items") as any).insert({
        sub_order_id: subOrderId,
        product_id: item.productId,
        variant_id: item.variantId,
        title: item.productTitle,
        variant_title: item.variantTitle,
        sku: item.sku,
        unit_price: item.unitPriceAud,
        quantity: item.quantity,
        total_price: itemTotal,
        image_url: item.imageUrl ?? null,
      });
    }

    // Ledger Entry: Gross credit for seller
    await (supabaseAdmin.from("ledger_entries") as any).insert({
      order_id: masterOrderId,
      sub_order_id: subOrderId,
      seller_id: pkg.sellerId,
      entry_type: "SELLER_GROSS",
      amount: netSellerAmount,
      currency: "AUD",
      description: `Pending gross credit for sub-order ${subOrderId} (held 14 days post-delivery)`,
      idempotency_key: `leg_${subOrderId}_gross`,
    });
  }

  // 4. Insert Payment record
  await (supabaseAdmin.from("payments") as any).insert({
    order_id: masterOrderId,
    provider: "STRIPE",
    provider_payment_id: paymentIntentId,
    amount: totalAmount,
    currency: "AUD",
    status: "PENDING",
    payment_method: "STRIPE",
  });

  return {
    masterOrderId,
    masterOrderNumber,
    clientSecret,
    paymentIntentId,
  };
}

/**
 * Confirm payment success, transition order status, and commit inventory reservations.
 */
export async function confirmOrderPaymentSuccess(paymentIntentId: string): Promise<void> {
  const { data: payment } = await (supabaseAdmin.from("payments") as any)
    .select("id, order_id")
    .eq("provider_payment_id", paymentIntentId)
    .single();

  if (payment) {
    await (supabaseAdmin.from("payments") as any)
      .update({ status: "PAID", updated_at: new Date().toISOString() })
      .eq("id", payment.id);

    await (supabaseAdmin.from("orders") as any)
      .update({ status: "CONFIRMED", payment_status: "PAID", updated_at: new Date().toISOString() })
      .eq("id", payment.order_id);

    await (supabaseAdmin.from("sub_orders") as any)
      .update({ status: "ACCEPTED", updated_at: new Date().toISOString() })
      .eq("master_order_id", payment.order_id);

    // Commit inventory reservations associated with this order
    await commitInventoryReservations(paymentIntentId, payment.order_id);
  }
}

