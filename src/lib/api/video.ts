import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import crypto from "crypto";

export type VideoModerationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type VideoProcessingStatus = "PREPARING" | "PROCESSING" | "READY" | "FAILED";

export interface ProductVideoMetadata {
  id?: string;
  productId: string;
  mediaType: "video";
  url: string;
  playbackId?: string | undefined;
  thumbnailUrl?: string | undefined;
  durationSeconds?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  processingStatus: VideoProcessingStatus;
  moderationStatus: VideoModerationStatus;
  rejectionReason?: string | undefined;
}

/**
 * Server Function: Initialize Direct Video Upload (Mux or Supabase Storage)
 */
export const createVideoDirectUploadServerFn = createServerFn({ method: "POST" })
  .validator((data: { productId: string; sellerId: string; fileName: string; fileSize: number }) => data)
  .handler(async ({ data }) => {
    // 1. Validate file constraints (Max 100MB)
    const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
    if (data.fileSize > MAX_VIDEO_BYTES) {
      throw new Error(`Video file size ${(data.fileSize / (1024 * 1024)).toFixed(1)}MB exceeds maximum 100MB limit.`);
    }

    // 2. Check if product belongs to seller
    const { data: product, error: pErr } = await (supabaseAdmin.from("products") as any)
      .select("id, seller_id")
      .eq("id", data.productId)
      .single();

    if (pErr || !product || product.seller_id !== data.sellerId) {
      throw new Error("Unauthorized: Product does not belong to your seller store.");
    }

    // 3. Generate signed upload path in canonical 'product-media' bucket
    const fileExt = data.fileName.split(".").pop() || "mp4";
    const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!["mp4", "mov", "webm", "m4v"].includes(cleanExt)) {
      throw new Error("Unsupported video format. Please upload MP4, MOV, or WebM.");
    }

    const storagePath = `videos/${data.sellerId}/${data.productId}_${Date.now()}.${cleanExt}`;

    return {
      provider: "supabase_storage",
      bucket: "product-media",
      storagePath,
      maxSizeBytes: MAX_VIDEO_BYTES,
    };
  });

/**
 * Server Function: Register or Replace Uploaded Product Video
 */
export const registerProductVideoServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    productId: string;
    sellerId: string;
    videoUrl: string;
    thumbnailUrl?: string | undefined;
    durationSeconds?: number | undefined;
    autoApprove?: boolean | undefined;
  }) => data)
  .handler(async ({ data }) => {
    // 1. Verify seller ownership
    const { data: product, error: pErr } = await (supabaseAdmin.from("products") as any)
      .select("id, seller_id")
      .eq("id", data.productId)
      .single();

    if (pErr || !product || product.seller_id !== data.sellerId) {
      throw new Error("Unauthorized: Cannot attach video to another seller's product.");
    }

    // 2. Remove any previous video for this product to enforce exactly 1 video per product
    await (supabaseAdmin.from("product_media") as any)
      .delete()
      .eq("product_id", data.productId)
      .eq("media_type", "video");

    // 3. Insert canonical video record
    const moderationStatus: VideoModerationStatus = data.autoApprove ? "APPROVED" : "PENDING";

    const { data: insertedMedia, error: insErr } = await (supabaseAdmin.from("product_media") as any)
      .insert({
        product_id: data.productId,
        media_type: "video",
        url: data.videoUrl,
        alt_text: "Product demonstration video",
        sort_order: 99, // place video after primary images
        is_primary: false,
      })
      .select()
      .single();

    if (insErr) {
      throw new Error(`Failed to save product video: ${insErr.message}`);
    }

    return {
      success: true,
      mediaId: insertedMedia.id,
      moderationStatus,
      videoUrl: data.videoUrl,
    };
  });

/**
 * Server Function: Admin Moderation of Product Video
 */
export const moderateProductVideoServerFn = createServerFn({ method: "POST" })
  .validator((data: { mediaId: string; status: VideoModerationStatus; rejectionReason?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { data: media, error } = await (supabaseAdmin.from("product_media") as any)
      .select("id, media_type, url, product_id")
      .eq("id", data.mediaId)
      .single();

    if (error || !media || media.media_type !== "video") {
      throw new Error("Product video not found.");
    }

    if (data.status === "REJECTED") {
      // Hide or remove rejected video from public display
      await (supabaseAdmin.from("product_media") as any)
        .delete()
        .eq("id", data.mediaId);

      return {
        success: true,
        status: "REJECTED",
        rejectionReason: data.rejectionReason ?? "Does not meet marketplace content guidelines.",
      };
    }

    return {
      success: true,
      status: data.status,
    };
  });

/**
 * Mux Webhook Signature Verifier (HMAC-SHA256)
 */
export function verifyMuxWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  signingSecret: string | undefined
): boolean {
  if (!signatureHeader || !signingSecret) return false;

  try {
    // Header format: t=1610000000,v1=abcdef...
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let signature = "";

    for (const part of parts) {
      const [k, v] = part.split("=");
      if (k === "t") timestamp = v || "";
      if (k === "v1") signature = v || "";
    }

    if (!timestamp || !signature) return false;

    // Check timestamp freshness (5 minutes tolerance)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) {
      return false;
    }

    const payload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", signingSecret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}
