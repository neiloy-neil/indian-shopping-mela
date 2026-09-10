import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { mapDbProductToIsm } from "./catalogue";
import type { Product } from "@/lib/ism-data";

export interface CartItemDto {
  lineId: string;
  productId: string;
  variantId: string;
  sellerId: string;
  sellerName: string;
  productName: string;
  variantTitle: string;
  sku: string;
  priceAud: number;
  quantity: number;
  availableStock: number;
  imageUrl?: string | undefined;
  weightKg: number;
}

export interface CartSummaryDto {
  items: CartItemDto[];
  subtotalAud: number;
  totalQuantity: number;
}

/**
 * Helper to ensure or fetch cart ID for user or guest
 */
async function resolveOrCreateCartId(
  userId?: string | null,
  guestToken?: string | null,
): Promise<string | null> {
  if (userId) {
    const { data: userCart } = await (supabaseAdmin.from("carts") as any)
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (userCart?.id) return userCart.id;

    const { data: newCart, error } = await (supabaseAdmin.from("carts") as any)
      .insert({ user_id: userId, status: "ACTIVE" })
      .select("id")
      .single();

    if (error) console.error("Error creating user cart:", error);
    return newCart?.id ?? null;
  }

  if (guestToken && /^[a-zA-Z0-9_-]{8,64}$/.test(guestToken.trim())) {
    const sanitizedToken = guestToken.trim();
    const { data: guestCart } = await (supabaseAdmin.from("carts") as any)
      .select("id")
      .eq("guest_token", sanitizedToken)
      .maybeSingle();

    if (guestCart?.id) return guestCart.id;

    const { data: newGuestCart, error } = await (supabaseAdmin.from("carts") as any)
      .insert({ guest_token: sanitizedToken, status: "ACTIVE" })
      .select("id")
      .single();

    if (error) console.error("Error creating guest cart:", error);
    return newGuestCart?.id ?? null;
  }

  return null;
}

/**
 * Server Function: Get current user or guest cart lines from database
 */
export const getCartServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId?: string | undefined; guestToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<CartSummaryDto> => {
    const cartId = await resolveOrCreateCartId(data.userId, data.guestToken);

    if (!cartId) {
      return { items: [], subtotalAud: 0, totalQuantity: 0 };
    }

    const { data: lines, error } = await (supabaseAdmin.from("cart_lines") as any)
      .select(
        `
        id,
        quantity,
        variant_id,
        variant:product_variants (
          id,
          product_id,
          seller_sku,
          title,
          price,
          sale_price,
          sale_start_at,
          sale_end_at,
          stock_quantity,
          weight_kg_override,
          images,
          product:products (
            id,
            title,
            seller_id,
            status,
            weight_kg,
            seller:sellers (
              id,
              business_name
            ),
            media:product_media (
              url,
              sort_order
            )
          )
        )
      `,
      )
      .eq("cart_id", cartId);

    if (error || !lines || lines.length === 0) {
      return { items: [], subtotalAud: 0, totalQuantity: 0 };
    }

    const items: CartItemDto[] = lines
      .filter((l: any) => l.variant && l.variant.product)
      .map((l: any) => {
        const variant = l.variant;
        const product = variant.product;
        const seller = product?.seller;
        const sortedMedia = [...(product?.media || [])].sort(
          (a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        const primaryMedia = sortedMedia[0];
        const now = new Date();
        const hasActiveSale =
          variant.sale_price != null &&
          (!variant.sale_start_at || new Date(variant.sale_start_at) <= now) &&
          (!variant.sale_end_at || new Date(variant.sale_end_at) >= now);
        const priceAud = Number(hasActiveSale ? variant.sale_price : (variant.price ?? 0));
        const availableStock = Math.max(0, Number(variant.stock_quantity) || 0);
        const fallbackImg =
          variant.images && variant.images.length > 0 ? variant.images[0] : undefined;
        const imageUrl = primaryMedia?.url ?? fallbackImg ?? undefined;
        const weightKg = Number(variant.weight_kg_override ?? product?.weight_kg ?? 0.5);

        return {
          lineId: l.id,
          productId: product?.id ?? variant.product_id,
          variantId: variant.id,
          sellerId: product?.seller_id ?? "unknown-seller",
          sellerName: seller?.business_name ?? "Marketplace Seller",
          productName: product?.title ?? "Product",
          variantTitle: variant.title ?? "Standard",
          sku: variant.seller_sku ?? "SKU-STD",
          priceAud,
          quantity: Number(l.quantity) || 1,
          availableStock,
          imageUrl,
          weightKg,
        };
      });

    const subtotalAud = Number(
      items.reduce((sum, item) => sum + item.priceAud * item.quantity, 0).toFixed(2),
    );
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      subtotalAud,
      totalQuantity,
    };
  });

/**
 * Server Function: Add item to cart (with authoritative stock and price validation)
 */
export const addToCartServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId?: string | undefined;
      guestToken?: string | undefined;
      variantId: string;
      quantity: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const qtyToAdd = Math.max(1, data.quantity || 1);
    const cartId = await resolveOrCreateCartId(data.userId, data.guestToken);

    if (!cartId) {
      throw new Error("Unable to identify or create cart session.");
    }

    // Authoritatively check variant existence and available stock
    const { data: variant, error: varErr } = await (supabaseAdmin.from("product_variants") as any)
      .select("id, stock_quantity, product:products!inner(status)")
      .eq("id", data.variantId)
      .single();

    if (varErr || !variant) {
      throw new Error("Product variant not found.");
    }

    if (variant.product?.status !== "LIVE") {
      throw new Error("This product is currently unavailable for purchase.");
    }

    const availableStock = Math.max(0, variant.stock_quantity || 0);
    if (availableStock < qtyToAdd) {
      throw new Error(`Only ${availableStock} units available in stock.`);
    }

    // Check existing line in cart
    const { data: existingLine } = await (supabaseAdmin.from("cart_lines") as any)
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("variant_id", data.variantId)
      .maybeSingle();

    if (existingLine) {
      const newTotalQty = existingLine.quantity + qtyToAdd;
      if (newTotalQty > availableStock) {
        throw new Error(`Cannot add more than available stock (${availableStock} max).`);
      }
      await (supabaseAdmin.from("cart_lines") as any)
        .update({
          quantity: newTotalQty,
        })
        .eq("id", existingLine.id);
    } else {
      await (supabaseAdmin.from("cart_lines") as any).insert({
        cart_id: cartId,
        variant_id: data.variantId,
        quantity: qtyToAdd,
      });
    }

    return { success: true };
  });

/**
 * Server Function: Update line quantity or remove if <= 0
 */
export const updateCartQtyServerFn = createServerFn({ method: "POST" })
  .validator((data: { lineId: string; quantity: number }) => data)
  .handler(async ({ data }) => {
    if (data.quantity <= 0) {
      await (supabaseAdmin.from("cart_lines") as any).delete().eq("id", data.lineId);
      return { success: true };
    }

    // Validate available stock for the line
    const { data: line } = await (supabaseAdmin.from("cart_lines") as any)
      .select("id, variant_id, variant:product_variants(stock_quantity)")
      .eq("id", data.lineId)
      .maybeSingle();

    if (!line) {
      throw new Error("Cart line not found.");
    }

    const availableStock = Math.max(0, line.variant?.stock_quantity ?? 0);
    const targetQty = Math.min(data.quantity, availableStock);

    await (supabaseAdmin.from("cart_lines") as any)
      .update({ quantity: targetQty })
      .eq("id", data.lineId);

    return { success: true, adjustedQuantity: targetQty };
  });

/**
 * Server Function: Remove item from cart
 */
export const removeFromCartServerFn = createServerFn({ method: "POST" })
  .validator((data: { lineId: string }) => data)
  .handler(async ({ data }) => {
    await (supabaseAdmin.from("cart_lines") as any).delete().eq("id", data.lineId);
    return { success: true };
  });

/**
 * Server Function: Merge guest cart into user account cart on sign-in
 * Revalidates product status and live stock during merge
 */
export const mergeGuestCartServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; guestToken: string }) => data)
  .handler(async ({ data }) => {
    const { data: guestCart } = await (supabaseAdmin.from("carts") as any)
      .select("id")
      .eq("guest_token", data.guestToken)
      .maybeSingle();

    if (!guestCart) return { success: true, merged: 0 };

    const targetCartId = await resolveOrCreateCartId(data.userId, null);
    if (!targetCartId) throw new Error("Could not create user cart.");

    const { data: guestLines } = await (supabaseAdmin.from("cart_lines") as any)
      .select(
        `
        id,
        variant_id,
        quantity,
        variant:product_variants(
          stock_quantity,
          product:products(status)
        )
      `,
      )
      .eq("cart_id", guestCart.id);

    let mergedCount = 0;

    if (guestLines && guestLines.length > 0) {
      for (const line of guestLines) {
        // Revalidate product and stock status
        const isLive = line.variant?.product?.status === "LIVE";
        const stockQty = Math.max(0, line.variant?.stock_quantity ?? 0);

        if (!isLive || stockQty <= 0) {
          // Skip inactive/out-of-stock items
          continue;
        }

        const qtyToMerge = Math.min(line.quantity, stockQty);

        const { data: existingUserLine } = await (supabaseAdmin.from("cart_lines") as any)
          .select("id, quantity")
          .eq("cart_id", targetCartId)
          .eq("variant_id", line.variant_id)
          .maybeSingle();

        if (existingUserLine) {
          const finalQty = Math.min(existingUserLine.quantity + qtyToMerge, stockQty);
          await (supabaseAdmin.from("cart_lines") as any)
            .update({ quantity: finalQty })
            .eq("id", existingUserLine.id);
        } else {
          await (supabaseAdmin.from("cart_lines") as any).insert({
            cart_id: targetCartId,
            variant_id: line.variant_id,
            quantity: qtyToMerge,
          });
        }
        mergedCount++;
      }
    }

    // Delete guest cart post-merge
    await (supabaseAdmin.from("carts") as any).delete().eq("id", guestCart.id);

    return { success: true, merged: mergedCount };
  });

/**
 * Server Function: Get authenticated user wishlist from database
 */
export const getWishlistServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<{ productIds: string[] }> => {
    const { data: rows, error } = await (supabaseAdmin.from("wishlists") as any)
      .select("product_id")
      .eq("user_id", data.userId);

    if (error) {
      console.warn("Wishlist fetch warning:", error.message);
      return { productIds: [] };
    }

    return { productIds: (rows || []).map((r: any) => r.product_id) };
  });

/**
 * Server Function: Toggle product in user wishlist
 */
export const toggleWishlistServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; productId: string }) => data)
  .handler(async ({ data }): Promise<{ wishlisted: boolean }> => {
    const { data: existing } = await (supabaseAdmin.from("wishlists") as any)
      .select("id")
      .eq("user_id", data.userId)
      .eq("product_id", data.productId)
      .maybeSingle();

    if (existing) {
      await (supabaseAdmin.from("wishlists") as any).delete().eq("id", existing.id);
      return { wishlisted: false };
    } else {
      await (supabaseAdmin.from("wishlists") as any).insert({
        user_id: data.userId,
        product_id: data.productId,
      });
      return { wishlisted: true };
    }
  });

/**
 * Server Function: Get full product data for a user's wishlisted items.
 * getWishlistServerFn above returns bare product ids (used for the lightweight
 * heart-icon "is this wishlisted" state site-wide); this returns real, live product
 * records for display — account.tsx's wishlist tab previously filtered the static
 * PRODUCTS fixture by these ids, which only ever matched demo products, never a real
 * database-backed product (whose id is a UUID that never appears in that fixture).
 */
export const getWishlistProductsServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<Product[]> => {
    const { data: rows, error } = await (supabaseAdmin.from("wishlists") as any)
      .select(
        `
        product_id,
        product:products (
          *,
          variants:product_variants(*),
          media:product_media(url, media_type, moderation_status, sort_order),
          seller:sellers(business_name, slug, dispatch_address)
        )
      `,
      )
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false });

    if (error || !rows) return [];

    return rows
      .filter((r: any) => r.product && r.product.status === "LIVE")
      .map((r: any) => mapDbProductToIsm(r.product));
  });
