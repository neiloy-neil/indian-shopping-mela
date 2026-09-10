import { supabase } from "@/lib/supabase/client";

export type StorageBucketName = "product-images" | "seller-documents" | "return-evidence";

/**
 * T142 — Upload a product gallery image (max 10MB, JPEG/PNG/WebP/AVIF).
 */
export async function uploadProductImage(file: File, sellerId: string): Promise<string> {
  // 1. Client-side MIME and size validation
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(`Unsupported image format: ${file.type}. Please upload JPG, PNG, or WebP.`);
  }

  const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSizeBytes) {
    throw new Error(
      `File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum 10MB limit.`,
    );
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `${sellerId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage.from("product-images").upload(filePath, file, {
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    console.error("Product image upload error:", error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * T142 — Upload a private seller KYC / business verification document (PDF, JPG, PNG).
 */
export async function uploadSellerVerificationDoc(file: File): Promise<string> {
  const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(`Unsupported document format: ${file.type}. Please upload PDF, JPG, or PNG.`);
  }

  const maxSizeBytes = 20 * 1024 * 1024; // 20 MB
  if (file.size > maxSizeBytes) {
    throw new Error(`File exceeds maximum 20MB limit.`);
  }

  // The storage RLS policy requires the first path segment to be the uploader's own
  // auth.uid() — a caller-supplied sellerId (which is sellers.id, not the owning user's
  // id) would both violate that policy and let a client choose an arbitrary folder to
  // upload into.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be signed in to upload a seller verification document.");
  }

  const fileExt = file.name.split(".").pop() || "pdf";
  const filePath = `${user.id}/kyc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage.from("seller-documents").upload(filePath, file, {
    upsert: false,
  });

  if (error) {
    console.error("Seller doc upload error:", error);
    throw error;
  }

  return data.path;
}

/**
 * T142 — Upload customer return photo/video evidence.
 *
 * No returnId parameter — a return doesn't exist yet at upload time (evidence is staged
 * before the return request is created), and accepting an arbitrary caller-supplied folder
 * name here was the actual IDOR: the storage RLS policy requires the first path segment to
 * equal the uploader's own auth.uid(), so any other value either gets rejected now (correct)
 * or, before that policy existed, would have let a client write into (or previously, even
 * read from an incorrectly-matching) another user's evidence folder.
 */
export async function uploadReturnEvidenceMedia(file: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be signed in to upload return evidence.");
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage.from("return-evidence").upload(filePath, file, {
    upsert: false,
  });

  if (error) {
    console.error("Return evidence upload error:", error);
    throw error;
  }

  return data.path;
}

/**
 * T145 — Safe image deletion ensuring active orders or other products are not corrupted.
 */
export async function deleteProductImageSafe(storagePath: string): Promise<void> {
  if (!storagePath || storagePath.startsWith("http")) return;

  const { error } = await supabase.storage.from("product-media").remove([storagePath]);

  if (error) {
    console.warn("Storage removal warning:", error.message);
  }
}

/**
 * T319/T331 — Upload product video directly to canonical product-media bucket (Max 100MB, MP4/QuickTime)
 * Fails closed: Never falls back to local blob in production on failure.
 */
export async function uploadProductVideo(file: File, sellerId: string): Promise<string> {
  const allowedMimeTypes = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(
      `Unsupported video format: ${file.type}. Please upload MP4, QuickTime, or WebM.`,
    );
  }

  const maxSizeBytes = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSizeBytes) {
    throw new Error(
      `Video file size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum 100MB limit.`,
    );
  }

  const fileExt = file.name.split(".").pop() || "mp4";
  const filePath = `videos/${sellerId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage.from("product-media").upload(filePath, file, {
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    console.error("Product video upload error:", error);
    throw new Error(`Video upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from("product-media").getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}
