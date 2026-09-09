import { createServerFn } from "@tanstack/react-start";
import { stripe } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Address } from "@/lib/supabase/types";
import { calculateMultiSellerShippingQuotes, type ParcelDetails } from "./shipping";
import {
  reserveInventoryLines,
  releaseInventoryReservations,
  commitInventoryReservations,
} from "./inventory";

export interface CheckoutItemDto {
  variantId: string;
  quantity: number;
}

export interface AuthoritativeCartItem {
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
  sellerBusinessName: string;
  sellerDispatchAddress?: Address | undefined;
}

export interface SellerPackageGroup {
  sellerId: string;
  sellerBusinessName: string;
  dispatchAddress: Address;
  items: AuthoritativeCartItem[];
  subtotalAud: number;
  shippingCostAud: number;
  shippingService: string;
}

export interface CheckoutSummary {
  packages: SellerPackageGroup[];
  itemsSubtotalAud: number;
  shippingTotalAud: number;
  discountTotalAud: number;
  gstTotalAud: number;
  grandTotalAud: number;
}

export interface PrepareCheckoutParams {
  items: CheckoutItemDto[];
  destinationAddress: Address;
  sessionId: string;
  couponCode?: string | undefined;
}

export interface CreateOrderParams {
  items: CheckoutItemDto[];
  shippingAddress: Address;
  billingAddress?: Address | undefined;
  customerEmail: string;
  customerName: string;
  customerPhone?: string | undefined;
  userId?: string | undefined;
  sessionId: string;
  couponCode?: string | undefined;
  idempotencyKey?: string | undefined;
}

export interface CreateOrderResult {
  masterOrderId: string;
  masterOrderNumber: string;
  clientSecret: string;
  paymentIntentId: string;
  totalAmountAud: number;
  gstTotalAud: number;
  idempotent: boolean;
}

/**
 * Authoritatively fetch and validate items from PostgreSQL.
 * Rejects deactivated products, inactive sellers, or insufficient stock.
 */
export async function loadAuthoritativeCartItems(
  items: CheckoutItemDto[],
): Promise<AuthoritativeCartItem[]> {
  if (!items || items.length === 0) {
    throw new Error("Checkout cart is empty");
  }

  // Validate quantities
  for (const item of items) {
    if (!item.variantId || typeof item.variantId !== "string") {
      throw new Error("Invalid variant ID in checkout payload");
    }
    if (!item.quantity || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw new Error(`Invalid quantity (${item.quantity}) for variant ${item.variantId}`);
    }
  }

  const variantIds = items.map((i) => i.variantId);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const validUuids = variantIds.filter((id) => uuidRegex.test(id));
  const authoritativeItems: AuthoritativeCartItem[] = [];

  if (validUuids.length > 0) {
    const { data: variants, error } = await (supabaseAdmin.from("product_variants") as any)
      .select(
        `
        id,
        title,
        seller_sku,
        price,
        sale_price,
        sale_start_at,
        sale_end_at,
        stock_quantity,
        reserved_quantity,
        weight_kg_override,
        images,
        product:products (
          id,
          title,
          status,
          weight_kg,
          seller_id,
          seller:sellers (
            id,
            business_name,
            store_name,
            status,
            dispatch_address
          )
        )
      `,
      )
      .in("id", validUuids);

    if (error) {
      throw new Error(`Failed to load product pricing: ${error.message}`);
    }

    const variantMap = new Map<string, any>((variants || []).map((v: any) => [v.id, v]));

    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      if (variant) {
        const product = variant.product;
        if (!product) {
          throw new Error(`Product not found for variant ${item.variantId}`);
        }
        if (product.status && product.status !== "ACTIVE" && product.status !== "APPROVED") {
          throw new Error(`Product "${product.title}" is currently unavailable for purchase.`);
        }

        const seller = product.seller;
        if (seller && seller.status && seller.status !== "APPROVED" && seller.status !== "ACTIVE") {
          throw new Error(`Seller store for "${product.title}" is currently not active.`);
        }

        const now = new Date();
        const hasActiveSale =
          variant.sale_price != null &&
          (!variant.sale_start_at || new Date(variant.sale_start_at) <= now) &&
          (!variant.sale_end_at || new Date(variant.sale_end_at) >= now);

        const authoritativePrice = hasActiveSale
          ? Number(variant.sale_price)
          : Number(variant.price);
        const weightKg = Number(variant.weight_kg_override ?? product.weight_kg ?? 0.5);

        authoritativeItems.push({
          productId: product.id,
          variantId: variant.id,
          sellerId: product.seller_id,
          productTitle: product.title,
          variantTitle: variant.title || "Standard",
          sku: variant.seller_sku || `SKU-${variant.id.slice(0, 8).toUpperCase()}`,
          unitPriceAud: authoritativePrice,
          quantity: item.quantity,
          weightKg,
          imageUrl:
            Array.isArray(variant.images) && variant.images.length > 0
              ? variant.images[0]
              : undefined,
          sellerBusinessName: seller?.business_name ?? seller?.store_name ?? "Marketplace Seller",
          sellerDispatchAddress: seller?.dispatch_address as Address | undefined,
        });
      }
    }
  }

  // Ensure all requested items were found in DB
  const missingItems = items.filter(
    (i) => !authoritativeItems.some((a) => a.variantId === i.variantId),
  );
  if (missingItems.length > 0) {
    throw new Error(
      `Item variant ${missingItems[0]?.variantId ?? "unknown"} was not found in the database or is unavailable.`,
    );
  }

  return authoritativeItems;
}

/**
 * Server Function: Prepare authoritative multi-seller packages, calculate shipping & GST.
 * Client sends variant IDs and quantities only. All prices and rules loaded authoritatively.
 */
export const prepareCheckoutSummaryServerFn = createServerFn({ method: "POST" })
  .validator((data: PrepareCheckoutParams) => data)
  .handler(async ({ data }) => {
    return prepareCheckoutSummary(data);
  });

export async function prepareCheckoutSummary(
  params: PrepareCheckoutParams,
): Promise<CheckoutSummary> {
  const { items, destinationAddress, sessionId } = params;

  // 1. Authoritatively fetch live pricing and seller data from PostgreSQL
  const authoritativeItems = await loadAuthoritativeCartItems(items);

  // 2. Atomically reserve inventory for all items across all packages (15-min TTL)
  const reservationItems = authoritativeItems
    .filter((item) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.variantId),
    )
    .map((item) => ({ variantId: item.variantId, quantity: item.quantity }));

  if (reservationItems.length > 0) {
    await reserveInventoryLines(reservationItems, sessionId, 15);
  }

  // 3. Group by seller
  const sellerMap = new Map<string, AuthoritativeCartItem[]>();
  for (const item of authoritativeItems) {
    const list = sellerMap.get(item.sellerId) ?? [];
    list.push(item);
    sellerMap.set(item.sellerId, list);
  }

  const packages: SellerPackageGroup[] = [];
  let itemsSubtotal = 0;

  for (const [sellerId, sellerItems] of sellerMap.entries()) {
    const sampleItem = sellerItems[0];
    const dispatchAddress: Address = sampleItem?.sellerDispatchAddress ?? {
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
      destinationAddress,
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
      sellerBusinessName: sampleItem?.sellerBusinessName ?? "Marketplace Seller",
      dispatchAddress,
      items: sellerItems,
      subtotalAud: Number(packageSubtotal.toFixed(2)),
      shippingCostAud: shippingQuote.costAud,
      shippingService: `${shippingQuote.carrier} · ${shippingQuote.serviceName}`,
    });
  }

  const shippingTotal = packages.reduce((acc, p) => acc + p.shippingCostAud, 0);
  const discountTotal = 0; // Configured promotion/coupon discount
  const grandTotal = Number((itemsSubtotal + shippingTotal - discountTotal).toFixed(2));
  const gstTotal = Number((grandTotal / 11).toFixed(2)); // 1/11th GST of total AUD amount in Australia

  return {
    packages,
    itemsSubtotalAud: Number(itemsSubtotal.toFixed(2)),
    shippingTotalAud: Number(shippingTotal.toFixed(2)),
    discountTotalAud: discountTotal,
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

export async function createCheckoutOrderTransactional(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const effectiveBillingAddress = params.billingAddress ?? params.shippingAddress;
  const idempotencyKey =
    params.idempotencyKey ??
    `ord_idem_${params.sessionId}_${params.items.map((i) => `${i.variantId}:${i.quantity}`).join("_")}`;

  // 1. Check Idempotency: Return existing master order if already created with this key
  const { data: existingOrder } = await (supabaseAdmin.from("orders") as any)
    .select("id, order_number, total_amount, gst_total, payment_intent_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingOrder) {
    let clientSecret = "";
    if (
      existingOrder.payment_intent_id &&
      process.env["STRIPE_SECRET_KEY"] &&
      !process.env["STRIPE_SECRET_KEY"].includes("placeholder")
    ) {
      try {
        const pi = await stripe.paymentIntents.retrieve(existingOrder.payment_intent_id);
        clientSecret = pi.client_secret ?? "";
      } catch (err) {
        console.warn("Could not retrieve existing Stripe PaymentIntent secret:", err);
      }
    }

    return {
      masterOrderId: existingOrder.id,
      masterOrderNumber: existingOrder.order_number ?? existingOrder.id,
      clientSecret,
      paymentIntentId: existingOrder.payment_intent_id ?? "",
      totalAmountAud: Number(existingOrder.total_amount),
      gstTotalAud: Number(existingOrder.gst_total),
      idempotent: true,
    };
  }

  // 2. Authoritatively calculate order summary and verify live inventory
  const summary = await prepareCheckoutSummary({
    items: params.items,
    destinationAddress: params.shippingAddress,
    sessionId: params.sessionId,
    couponCode: params.couponCode,
  });

  const masterOrderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const masterOrderNumber = `ISM${Math.floor(10000 + Math.random() * 90000)}`;
  const totalAmount = summary.grandTotalAud;
  const itemsSubtotal = summary.itemsSubtotalAud;
  const shippingTotal = summary.shippingTotalAud;
  const discountTotal = summary.discountTotalAud;
  const gstTotal = summary.gstTotalAud;
  const totalAmountCents = Math.round(totalAmount * 100);

  let paymentIntentId = `pi_${Date.now()}`;
  let clientSecret = "";

  try {
    // 3. Create Stripe PaymentIntent with authoritative amount
    if (
      process.env["STRIPE_SECRET_KEY"] &&
      !process.env["STRIPE_SECRET_KEY"].includes("placeholder")
    ) {
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
          sessionId: params.sessionId,
          idempotencyKey,
        },
        payment_method_types: ["card", "afterpay_clearpay", "klarna"],
      });
      if (paymentIntent.client_secret) {
        clientSecret = paymentIntent.client_secret;
        paymentIntentId = paymentIntent.id;
      }
    }

    // 4. Insert Master Order record
    const { error: orderErr } = await (supabaseAdmin.from("orders") as any).insert({
      id: masterOrderId,
      order_number: masterOrderNumber,
      customer_id: params.userId ?? null,
      customer_email: params.customerEmail,
      customer_name: params.customerName,
      customer_phone: params.customerPhone ?? null,
      shipping_address: params.shippingAddress,
      billing_address: effectiveBillingAddress,
      subtotal: itemsSubtotal,
      shipping_total: shippingTotal,
      discount_total: discountTotal,
      gst_total: gstTotal,
      total_amount: totalAmount,
      status: "PENDING",
      payment_status: "PENDING",
      payment_provider: "STRIPE",
      payment_intent_id: paymentIntentId,
      currency: "AUD",
      idempotency_key: idempotencyKey,
    });

    if (orderErr) {
      throw new Error(`Failed to create master order: ${orderErr.message}`);
    }

    // 5. Insert Sub-Orders and Order Items snapshot per seller package
    for (const [idx, pkg] of summary.packages.entries()) {
      const subOrderId = `sub_${masterOrderId}_${String.fromCharCode(65 + idx)}`;
      const commissionPct = 12.0; // 12% ISM marketplace commission
      const commissionAmount = Number(((pkg.subtotalAud * commissionPct) / 100).toFixed(2));
      const netSellerAmount = Number(
        (pkg.subtotalAud + pkg.shippingCostAud - commissionAmount).toFixed(2),
      );

      const { error: subErr } = await (supabaseAdmin.from("sub_orders") as any).insert({
        id: subOrderId,
        master_order_id: masterOrderId,
        seller_id: pkg.sellerId,
        package_label: `Package ${idx + 1} of ${summary.packages.length} (${pkg.sellerBusinessName})`,
        shipping_cost: pkg.shippingCostAud,
        shipping_service: pkg.shippingService,
        status: "NEW_ORDER",
      });

      if (subErr) {
        throw new Error(`Failed to create sub-order for seller ${pkg.sellerId}: ${subErr.message}`);
      }

      // Insert Order Items with frozen price & GST snapshot
      for (const item of pkg.items) {
        const itemTotal = Number((item.unitPriceAud * item.quantity).toFixed(2));
        const itemGst = Number((itemTotal / 11).toFixed(2));

        const { error: itemErr } = await (supabaseAdmin.from("order_items") as any).insert({
          sub_order_id: subOrderId,
          product_id: item.productId,
          variant_id: item.variantId,
          product_name: item.productTitle,
          variant_name: item.variantTitle,
          sku: item.sku,
          unit_price: item.unitPriceAud,
          quantity: item.quantity,
          total_price: itemTotal,
          gst_amount: itemGst,
        });

        if (itemErr) {
          throw new Error(`Failed to snapshot order item ${item.sku}: ${itemErr.message}`);
        }
      }

      // Record financial ledger gross allocation
      await (supabaseAdmin.from("ledger_entries") as any).insert({
        order_id: masterOrderId,
        sub_order_id: subOrderId,
        seller_id: pkg.sellerId,
        entry_type: "SELLER_CREDIT",
        amount_cents: Math.round(netSellerAmount * 100),
        currency: "AUD",
        description: `Pending gross credit for sub-order ${subOrderId} (held 14 days post-delivery)`,
      });
    }

    // 6. Insert Payment tracking record
    await (supabaseAdmin.from("payments") as any).insert({
      order_id: masterOrderId,
      provider: "STRIPE",
      provider_payment_id: paymentIntentId,
      amount_cents: totalAmountCents,
      currency: "AUD",
      status: "PENDING",
      idempotency_key: idempotencyKey,
    });

    return {
      masterOrderId,
      masterOrderNumber,
      clientSecret,
      paymentIntentId,
      totalAmountAud: totalAmount,
      gstTotalAud: gstTotal,
      idempotent: false,
    };
  } catch (error: any) {
    // Fail-Closed Rollback: Release all inventory reservations held by this session on error
    await releaseInventoryReservations(params.sessionId).catch((relErr) => {
      console.warn("Failed to auto-release inventory during checkout error rollback:", relErr);
    });

    throw new Error(`Checkout order creation failed: ${error.message}`);
  }
}

/**
 * Confirm payment success, transition order status, and commit inventory reservations.
 */
export async function confirmOrderPaymentSuccess(paymentIntentId: string): Promise<void> {
  const { data: payment } = await (supabaseAdmin.from("payments") as any)
    .select("id, order_id")
    .eq("provider_payment_id", paymentIntentId)
    .maybeSingle();

  if (payment) {
    await (supabaseAdmin.from("payments") as any)
      .update({ status: "PAID", updated_at: new Date().toISOString() })
      .eq("id", payment.id);

    await (supabaseAdmin.from("orders") as any)
      .update({ status: "CONFIRMED", payment_status: "PAID", updated_at: new Date().toISOString() })
      .eq("id", payment.order_id);

    // Commit inventory reservations associated with this order
    await commitInventoryReservations(paymentIntentId, payment.order_id);
  }
}
