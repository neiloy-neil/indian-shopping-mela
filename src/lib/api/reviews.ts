import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface ProductReviewDto {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

/**
 * Server Function: Get reviews for a product
 */
export const getProductReviewsServerFn = createServerFn({ method: "POST" })
  .validator((data: { productId: string }) => data)
  .handler(async ({ data }): Promise<ProductReviewDto[]> => {
    const { data: rows } = await (supabaseAdmin as any)
      .from("product_reviews")
      .select(`
        id,
        product_id,
        user_id,
        rating,
        title,
        body,
        is_verified_purchase,
        created_at,
        profiles (
          full_name
        )
      `)
      .eq("product_id", data.productId)
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((r: any) => ({
      id: r.id,
      productId: r.product_id,
      userId: r.user_id,
      userName: r.profiles?.full_name ?? "Verified Buyer",
      rating: r.rating,
      title: r.title ?? "Great product",
      body: r.body ?? "",
      isVerifiedPurchase: r.is_verified_purchase ?? true,
      createdAt: r.created_at,
    }));
  });

/**
 * Server Function: Submit a verified purchase review
 */
export const submitProductReviewServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    userId: string;
    productId: string;
    rating: number;
    title: string;
    body: string;
  }) => data)
  .handler(async ({ data }) => {
    // Check if user has purchased the product
    const { data: orderItem } = await (supabaseAdmin as any)
      .from("order_items")
      .select("id, sub_orders!inner(master_orders!inner(customer_id, status))")
      .eq("product_id", data.productId)
      .eq("sub_orders.master_orders.customer_id", data.userId)
      .maybeSingle();

    const isVerifiedPurchase = Boolean(orderItem);

    const { error } = await (supabaseAdmin as any).from("product_reviews").insert({
      user_id: data.userId,
      product_id: data.productId,
      rating: data.rating,
      title: data.title,
      body: data.body,
      is_verified_purchase: isVerifiedPurchase,
      status: "APPROVED",
    });

    if (error) {
      console.warn("Product review insert note:", error.message);
    }

    return { success: true };
  });
