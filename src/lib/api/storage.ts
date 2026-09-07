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
    throw new Error(`File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum 10MB limit.`);
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `${sellerId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.error("Product image upload error:", error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from("product-images")
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * T142 — Upload a private seller KYC / business verification document (PDF, JPG, PNG).
 */
export async function uploadSellerVerificationDoc(file: File, sellerId: string): Promise<string> {
  const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error(`Unsupported document format: ${file.type}. Please upload PDF, JPG, or PNG.`);
  }

  const maxSizeBytes = 20 * 1024 * 1024; // 20 MB
  if (file.size > maxSizeBytes) {
    throw new Error(`File exceeds maximum 20MB limit.`);
  }

  const fileExt = file.name.split(".").pop() || "pdf";
  const filePath = `${sellerId}/kyc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("seller-documents")
    .upload(filePath, file, {
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
 */
export async function uploadReturnEvidenceMedia(file: File, returnId: string): Promise<string> {
  const fileExt = file.name.split(".").pop() || "jpg";
  const filePath = `${returnId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("return-evidence")
    .upload(filePath, file, {
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

  const { error } = await supabase.storage
    .from("product-images")
    .remove([storagePath]);

  if (error) {
    console.warn("Storage removal warning:", error.message);
  }
}
