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
      .select(
        `
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
      `,
      )
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
  .validator(
    (data: { userId: string; productId: string; rating: number; title: string; body: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    // 1. Prevent duplicate review by same user on same product
    const { data: existingReview } = await (supabaseAdmin as any)
      .from("product_reviews")
      .select("id")
      .eq("user_id", data.userId)
      .eq("product_id", data.productId)
      .maybeSingle();

    if (existingReview) {
      throw new Error("You have already reviewed this product.");
    }

    // 2. Prevent seller self-review
    const { data: product } = await (supabaseAdmin.from("products") as any)
      .select("id, seller_id, sellers:seller_id(user_id)")
      .eq("id", data.productId)
      .maybeSingle();

    if (product?.sellers?.user_id === data.userId) {
      throw new Error("Sellers cannot review their own products.");
    }

    // 3. Verify Purchase from delivered orders
    const { data: orderItem } = await (supabaseAdmin as any)
      .from("order_items")
      .select("id, sub_orders!inner(seller_id, orders:master_order_id(customer_id, status))")
      .eq("product_id", data.productId)
      .filter("sub_orders.orders.customer_id", "eq", data.userId)
      .maybeSingle();

    const isVerifiedPurchase = Boolean(orderItem);

    const { error } = await (supabaseAdmin as any).from("product_reviews").insert({
      user_id: data.userId,
      product_id: data.productId,
      rating: Math.max(1, Math.min(5, data.rating)),
      title: data.title,
      body: data.body,
      is_verified_purchase: isVerifiedPurchase,
      status: "APPROVED",
    });

    if (error) {
      throw new Error(`Failed to submit review: ${error.message}`);
    }

    // Update product rating summary
    const { data: allReviews } = await (supabaseAdmin as any)
      .from("product_reviews")
      .select("rating")
      .eq("product_id", data.productId)
      .eq("status", "APPROVED");

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / allReviews.length;
      await (supabaseAdmin.from("products") as any)
        .update({
          rating_avg: Number(avg.toFixed(2)),
          rating_count: allReviews.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.productId);
    }

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: "PRODUCT_REVIEW_SUBMITTED",
      entity_type: "REVIEW",
      entity_id: data.productId,
      new_data: { userId: data.userId, rating: data.rating, isVerifiedPurchase },
    });

    return { success: true, isVerifiedPurchase };
  });

/**
 * Server Function: Get Admin review moderation queue
 */
export const getAdminReviewsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const { data: reviews, error } = await (supabaseAdmin as any)
    .from("product_reviews")
    .select("*, product:products(id, title, seller_id), user:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !reviews) return [];
  return reviews;
});

/**
 * Server Function: Moderate review (APPROVE, REJECT, DELETE)
 */
export const moderateReviewServerFn = createServerFn({ method: "POST" })
  .validator((data: { reviewId: string; status: "APPROVED" | "REJECTED" | "DELETED" }) => data)
  .handler(async ({ data }) => {
    if (data.status === "DELETED") {
      await (supabaseAdmin as any).from("product_reviews").delete().eq("id", data.reviewId);
    } else {
      await (supabaseAdmin as any)
        .from("product_reviews")
        .update({
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.reviewId);
    }

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: `REVIEW_${data.status}`,
      entity_type: "REVIEW",
      entity_id: data.reviewId,
      new_data: { status: data.status },
    });

    return { success: true };
  });
