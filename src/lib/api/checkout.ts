import { createServerFn } from "@tanstack/react-start";
import { stripe } from "@/lib/stripe-server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Address, Database } from "@/lib/supabase/types";
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

interface VariantJoinedRow {
  id: string;
  title: string;
  seller_sku: string | null;
  price: number;
  sale_price: number | null;
  sale_start_at: string | null;
  sale_end_at: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  weight_kg_override: number | null;
  images: unknown;
  product: {
    id: string;
    title: string;
    status: string;
    weight_kg: number;
    seller_id: string;
    seller: {
      id: string;
      business_name: string;
      status: string;
      dispatch_address: unknown;
    } | null;
  } | null;
}

  const validUuids = variantIds.filter((id) => uuidRegex.test(id));
  const authoritativeItems: AuthoritativeCartItem[] = [];

  if (validUuids.length > 0) {
    const { data: rawVariants, error } = await supabaseAdmin
      .from("product_variants")
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

    const variants = (rawVariants || []) as unknown as VariantJoinedRow[];
    const variantMap = new Map<string, VariantJoinedRow>(variants.map((v) => [v.id, v]));

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
          sellerBusinessName: seller?.business_name ?? "Marketplace Seller",
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
  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
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

  const isProduction = process.env["NODE_ENV"] === "production";
  const stripeKey = process.env["STRIPE_SECRET_KEY"];

  // 3. Fail-Closed Stripe PaymentIntent Initialization (Prompt 7)
  if (!stripeKey || stripeKey.trim() === "" || stripeKey.includes("placeholder")) {
    if (isProduction) {
      await releaseInventoryReservations(params.sessionId).catch(console.warn);
      throw new Error("Stripe payment provider is not configured or unavailable in production.");
    }
  }

  let paymentIntentId = "";
  let clientSecret = "";

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
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
      },
      {
        idempotencyKey: `pi_idem_${idempotencyKey}`,
      },
    );

    if (paymentIntent && paymentIntent.id) {
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret ?? "";
    }
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    await releaseInventoryReservations(params.sessionId).catch(console.warn);

    if (isProduction) {
      throw new Error(`Stripe payment initialization failed: ${msg}`);
    }
    console.warn("Stripe PaymentIntent creation in non-production:", msg);
    throw new Error(`Stripe payment provider error: ${msg}`);
  }

  if (isProduction && (!paymentIntentId || !clientSecret)) {
    await releaseInventoryReservations(params.sessionId).catch(console.warn);
    throw new Error("Failed to receive authoritative PaymentIntent from Stripe.");
  }

  try {
    // 4. Build sub-orders and snapshot item payloads
    const subOrdersPayload = summary.packages.map((pkg, idx) => {
      const subOrderId = `sub_${masterOrderId}_${String.fromCharCode(65 + idx)}`;
      const commissionPct = 12.0; // 12% ISM marketplace commission
      const commissionAmount = Number(((pkg.subtotalAud * commissionPct) / 100).toFixed(2));
      const netSellerAmount = Number(
        (pkg.subtotalAud + pkg.shippingCostAud - commissionAmount).toFixed(2),
      );

      return {
        id: subOrderId,
        seller_id: pkg.sellerId,
        package_label: `Package ${idx + 1} of ${summary.packages.length} (${pkg.sellerBusinessName})`,
        subtotal: pkg.subtotalAud,
        shipping_cost: pkg.shippingCostAud,
        commission_rate_pct: commissionPct,
        commission_amount: commissionAmount,
        net_seller_amount: netSellerAmount,
        shipping_service: pkg.shippingService,
        items: pkg.items.map((item) => {
          const itemTotal = Number((item.unitPriceAud * item.quantity).toFixed(2));
          const itemGst = Number((itemTotal / 11).toFixed(2));
          return {
            product_id: item.productId,
            variant_id: item.variantId,
            product_name: item.productTitle,
            variant_name: item.variantTitle,
            sku: item.sku,
            unit_price: item.unitPriceAud,
            quantity: item.quantity,
            total_price: itemTotal,
            gst_amount: itemGst,
          };
        }),
      };
    });

    // 5. Execute Atomic Database Preparation via RPC (Prompt 6)
    const { error: rpcErr } = await supabaseAdmin.rpc(
      "prepare_marketplace_order" as any,
      {
        p_order_id: masterOrderId,
        p_order_number: masterOrderNumber,
        p_customer_id: params.userId ?? null,
        p_customer_email: params.customerEmail,
        p_customer_name: params.customerName,
        p_customer_phone: params.customerPhone ?? null,
        p_shipping_address: params.shippingAddress,
        p_billing_address: effectiveBillingAddress,
        p_subtotal: itemsSubtotal,
        p_shipping_total: shippingTotal,
        p_discount_total: discountTotal,
        p_gst_total: gstTotal,
        p_total_amount: totalAmount,
        p_payment_intent_id: paymentIntentId || null,
        p_currency: "AUD",
        p_idempotency_key: idempotencyKey,
        p_sub_orders: subOrdersPayload,
        p_total_amount_cents: totalAmountCents,
      },
    );

    if (rpcErr) {
      console.warn("RPC prepare_marketplace_order error, falling back to direct write:", rpcErr.message);
      await executeDirectOrderPreparation({
        masterOrderId,
        masterOrderNumber,
        params,
        effectiveBillingAddress,
        itemsSubtotal,
        shippingTotal,
        discountTotal,
        gstTotal,
        totalAmount,
        paymentIntentId,
        idempotencyKey,
        subOrdersPayload,
        totalAmountCents,
      });
    }

    return {
      masterOrderId,
      masterOrderNumber,
      clientSecret,
      paymentIntentId,
      totalAmountAud: totalAmount,
      gstTotalAud: gstTotal,
      idempotent: false,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Fail-Closed Rollback: Release all inventory reservations held by this session on error
    await releaseInventoryReservations(params.sessionId).catch((relErr) => {
      console.warn("Failed to auto-release inventory during checkout error rollback:", relErr);
    });

    throw new Error(`Checkout order creation failed: ${errorMsg}`);
  }
}

interface DirectOrderPrepParams {
  masterOrderId: string;
  masterOrderNumber: string;
  params: CreateOrderParams;
  effectiveBillingAddress: Address;
  itemsSubtotal: number;
  shippingTotal: number;
  discountTotal: number;
  gstTotal: number;
  totalAmount: number;
  paymentIntentId: string;
  idempotencyKey: string;
  subOrdersPayload: Array<{
    id: string;
    seller_id: string;
    package_label: string;
    subtotal: number;
    shipping_cost: number;
    commission_rate_pct: number;
    commission_amount: number;
    net_seller_amount: number;
    shipping_service: string;
    items: Array<{
      product_id: string;
      variant_id: string;
      product_name: string;
      variant_name: string;
      sku: string;
      unit_price: number;
      quantity: number;
      total_price: number;
      gst_amount: number;
    }>;
  }>;
  totalAmountCents: number;
}

async function executeDirectOrderPreparation(p: DirectOrderPrepParams): Promise<void> {
  // 1. Master order insert
  const { error: orderErr } = await supabaseAdmin.from("orders").insert({
    id: p.masterOrderId,
    order_number: p.masterOrderNumber,
    customer_id: p.params.userId ?? null,
    customer_email: p.params.customerEmail,
    customer_name: p.params.customerName,
    customer_phone: p.params.customerPhone ?? null,
    shipping_address: p.params.shippingAddress as unknown as Database["public"]["Tables"]["orders"]["Insert"]["shipping_address"],
    billing_address: p.effectiveBillingAddress as unknown as Database["public"]["Tables"]["orders"]["Insert"]["billing_address"],
    subtotal: p.itemsSubtotal,
    shipping_total: p.shippingTotal,
    discount_total: p.discountTotal,
    gst_total: p.gstTotal,
    total_amount: p.totalAmount,
    status: "PENDING",
    payment_status: "PAYMENT_PENDING",
    payment_provider: "STRIPE",
    payment_intent_id: p.paymentIntentId || null,
    currency: "AUD",
    idempotency_key: p.idempotencyKey,
  });

  if (orderErr) {
    throw new Error(`Failed to create master order: ${orderErr.message}`);
  }

  // 2. Sub-orders, items snapshot, and ledger entries
  for (const pkg of p.subOrdersPayload) {
    const { error: subErr } = await supabaseAdmin.from("sub_orders").insert({
      id: pkg.id,
      master_order_id: p.masterOrderId,
      seller_id: pkg.seller_id,
      package_label: pkg.package_label,
      subtotal: pkg.subtotal,
      shipping_cost: pkg.shipping_cost,
      commission_rate_pct: pkg.commission_rate_pct,
      commission_amount: pkg.commission_amount,
      net_seller_amount: pkg.net_seller_amount,
      status: "ORDER_CREATED",
      shipping_service: pkg.shipping_service,
    });

    if (subErr) {
      throw new Error(`Failed to create sub-order ${pkg.id}: ${subErr.message}`);
    }

    for (const item of pkg.items) {
      const { error: itemErr } = await supabaseAdmin.from("order_items").insert({
        sub_order_id: pkg.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        variant_name: item.variant_name,
        sku: item.sku,
        unit_price: item.unit_price,
        quantity: item.quantity,
        total_price: item.total_price,
        gst_amount: item.gst_amount,
      });

      if (itemErr) {
        throw new Error(`Failed to snapshot item ${item.sku}: ${itemErr.message}`);
      }
    }

    await supabaseAdmin.from("ledger_entries").insert({
      order_id: p.masterOrderId,
      sub_order_id: pkg.id,
      seller_id: pkg.seller_id,
      entry_type: "SELLER_GROSS",
      amount_cents: Math.round(pkg.net_seller_amount * 100),
      currency: "AUD",
      description: `Pending gross credit for sub-order ${pkg.id} (held 14 days post-delivery)`,
    });
  }

  if (p.paymentIntentId) {
    await supabaseAdmin.from("payments").insert({
      order_id: p.masterOrderId,
      provider: "STRIPE",
      provider_payment_id: p.paymentIntentId,
      amount_cents: p.totalAmountCents,
      currency: "AUD",
      status: "PAYMENT_PENDING",
      idempotency_key: p.idempotencyKey,
    });
  }
}

/**
 * Abandoned Checkout Recovery (T158, T179):
 * Periodically releases expired inventory reservations held by abandoned sessions (>15 min).
 */
export async function recoverAbandonedCheckoutReservations(): Promise<{ releasedCount: number }> {
  const { data: count, error } = await supabaseAdmin.rpc("release_expired_reservations" as any);
  if (error) {
    console.error("Error executing release_expired_reservations RPC:", error);
    return { releasedCount: 0 };
  }
  return { releasedCount: Number(count ?? 0) };
}

/**
 * Confirm payment success, transition order status, and commit inventory reservations.
 */
export async function confirmOrderPaymentSuccess(paymentIntentId: string): Promise<void> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("id, order_id")
    .eq("provider_payment_id", paymentIntentId)
    .maybeSingle();

  if (payment) {
    await supabaseAdmin
      .from("payments")
      .update({ status: "PAID", updated_at: new Date().toISOString() })
      .eq("id", payment.id);

    await supabaseAdmin
      .from("orders")
      .update({ status: "CONFIRMED", payment_status: "PAID", updated_at: new Date().toISOString() })
      .eq("id", payment.order_id);

    // Commit inventory reservations associated with this order
    await commitInventoryReservations(paymentIntentId, payment.order_id);
  }
}
