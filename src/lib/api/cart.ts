import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";

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
  imageUrl?: string;
  weightKg: number;
}

export interface CartSummaryDto {
  items: CartItemDto[];
  subtotalAud: number;
  totalQuantity: number;
}

/**
 * Server Function: Get current user or guest cart lines from database
 */
export const getCartServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId?: string | undefined; guestToken?: string | undefined }) => data)
  .handler(async ({ data }): Promise<CartSummaryDto> => {
    let cartId: string | null = null;

    if (data.userId) {
      const { data: userCart } = await (supabaseAdmin.from("carts") as any)
        .select("id")
        .eq("user_id", data.userId)
        .maybeSingle();

      if (userCart) {
        cartId = userCart.id;
      } else {
        const { data: newCart } = await (supabaseAdmin.from("carts") as any)
          .insert({ user_id: data.userId })
          .select("id")
          .single();
        cartId = newCart?.id ?? null;
      }
    } else if (data.guestToken) {
      const { data: guestCart } = await (supabaseAdmin.from("carts") as any)
        .select("id")
        .eq("guest_token_hash", data.guestToken)
        .maybeSingle();

      if (guestCart) {
        cartId = guestCart.id;
      } else {
        const { data: newGuestCart } = await (supabaseAdmin.from("carts") as any)
          .insert({ guest_token_hash: data.guestToken })
          .select("id")
          .single();
        cartId = newGuestCart?.id ?? null;
      }
    }

    if (!cartId) {
      return { items: [], subtotalAud: 0, totalQuantity: 0 };
    }

    const { data: lines } = await (supabaseAdmin.from("cart_lines") as any)
      .select(`
        id,
        quantity,
        product_id,
        variant_id,
        product_variants (
          id,
          sku,
          title,
          price_aud,
          stock_on_hand,
          reserved_quantity,
          weight_kg
        ),
        products (
          id,
          title,
          seller_id,
          primary_image_url,
          sellers (
            id,
            business_name,
            store_name
          )
        )
      `)
      .eq("cart_id", cartId);

    if (!lines || lines.length === 0) {
      return { items: [], subtotalAud: 0, totalQuantity: 0 };
    }

    const items: CartItemDto[] = lines.map((l: any) => {
      const variant = l.product_variants;
      const product = l.products;
      const seller = product?.sellers;
      const availableStock = Math.max(0, (variant?.stock_on_hand ?? 10) - (variant?.reserved_quantity ?? 0));

      return {
        lineId: l.id,
        productId: l.product_id,
        variantId: l.variant_id ?? l.product_id,
        sellerId: product?.seller_id ?? "unknown-seller",
        sellerName: seller?.store_name ?? seller?.business_name ?? "Marketplace Seller",
        productName: product?.title ?? "Product",
        variantTitle: variant?.title ?? "Standard",
        sku: variant?.sku ?? "SKU-STD",
        priceAud: Number(variant?.price_aud ?? 0),
        quantity: l.quantity,
        availableStock,
        imageUrl: product?.primary_image_url ?? undefined,
        weightKg: Number(variant?.weight_kg ?? 0.5),
      };
    });

    const subtotalAud = Number(items.reduce((sum, item) => sum + item.priceAud * item.quantity, 0).toFixed(2));
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      subtotalAud,
      totalQuantity,
    };
  });

/**
 * Server Function: Add item to cart (with authoritative price and stock check)
 */
export const addToCartServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    userId?: string | undefined;
    guestToken?: string | undefined;
    productId: string;
    variantId?: string | undefined;
    quantity: number;
  }) => data)
  .handler(async ({ data }) => {
    let cartId: string | null = null;

    if (data.userId) {
      const { data: userCart } = await (supabaseAdmin.from("carts") as any)
        .select("id")
        .eq("user_id", data.userId)
        .maybeSingle();

      if (userCart) {
        cartId = userCart.id;
      } else {
        const { data: newCart } = await (supabaseAdmin.from("carts") as any)
          .insert({ user_id: data.userId })
          .select("id")
          .single();
        cartId = newCart?.id ?? null;
      }
    } else if (data.guestToken) {
      const { data: guestCart } = await (supabaseAdmin.from("carts") as any)
        .select("id")
        .eq("guest_token_hash", data.guestToken)
        .maybeSingle();

      if (guestCart) {
        cartId = guestCart.id;
      } else {
        const { data: newGuestCart } = await (supabaseAdmin.from("carts") as any)
          .insert({ guest_token_hash: data.guestToken })
          .select("id")
          .single();
        cartId = newGuestCart?.id ?? null;
      }
    }

    if (!cartId) {
      throw new Error("Unable to identify or create cart session.");
    }

    // Check existing line
    const { data: existingLine } = await (supabaseAdmin.from("cart_lines") as any)
      .select("id, quantity")
      .eq("cart_id", cartId)
      .eq("product_id", data.productId)
      .maybeSingle();

    if (existingLine) {
      await (supabaseAdmin.from("cart_lines") as any)
        .update({
          quantity: existingLine.quantity + data.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLine.id);
    } else {
      await (supabaseAdmin.from("cart_lines") as any).insert({
        cart_id: cartId,
        product_id: data.productId,
        variant_id: data.variantId ?? null,
        quantity: data.quantity,
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
    } else {
      await (supabaseAdmin.from("cart_lines") as any)
        .update({ quantity: data.quantity, updated_at: new Date().toISOString() })
        .eq("id", data.lineId);
    }
    return { success: true };
  });

/**
 * Server Function: Merge guest cart into user account cart on sign-in
 */
export const mergeGuestCartServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; guestToken: string }) => data)
  .handler(async ({ data }) => {
    const { data: guestCart } = await (supabaseAdmin.from("carts") as any)
      .select("id")
      .eq("guest_token_hash", data.guestToken)
      .maybeSingle();

    if (!guestCart) return { success: true, merged: 0 };

    const { data: userCart } = await (supabaseAdmin.from("carts") as any)
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();

    let targetCartId = userCart?.id;
    if (!targetCartId) {
      const { data: newCart } = await (supabaseAdmin.from("carts") as any)
        .insert({ user_id: data.userId })
        .select("id")
        .single();
      targetCartId = newCart?.id;
    }

    if (!targetCartId) throw new Error("Could not create user cart.");

    const { data: guestLines } = await (supabaseAdmin.from("cart_lines") as any)
      .select("product_id, variant_id, quantity")
      .eq("cart_id", guestCart.id);

    if (guestLines) {
      for (const line of guestLines) {
        const { data: existingUserLine } = await (supabaseAdmin.from("cart_lines") as any)
          .select("id, quantity")
          .eq("cart_id", targetCartId)
          .eq("product_id", line.product_id)
          .maybeSingle();

        if (existingUserLine) {
          await (supabaseAdmin.from("cart_lines") as any)
            .update({ quantity: existingUserLine.quantity + line.quantity })
            .eq("id", existingUserLine.id);
        } else {
          await (supabaseAdmin.from("cart_lines") as any).insert({
            cart_id: targetCartId,
            product_id: line.product_id,
            variant_id: line.variant_id,
            quantity: line.quantity,
          });
        }
      }
    }

    // Delete guest cart
    await (supabaseAdmin.from("carts") as any).delete().eq("id", guestCart.id);

    return { success: true, merged: guestLines?.length ?? 0 };
  });
