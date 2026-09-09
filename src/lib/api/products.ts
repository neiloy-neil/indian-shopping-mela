import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Database, ProductStatus } from "@/lib/supabase/types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
export type ProductMediaRow = Database["public"]["Tables"]["product_media"]["Row"];

export interface FullProduct extends ProductRow {
  variants: VariantRow[];
  media?: ProductMediaRow[];
  seller?: {
    business_name: string;
    slug: string;
    dispatch_address: Record<string, any> | null;
  };
}

export interface ProductMediaInput {
  url: string;
  thumbnailUrl?: string | undefined;
  variantId?: string | undefined;
  mediaType?: string | undefined;
  sortOrder?: number | undefined;
  isPrimary?: boolean | undefined;
}

export interface ProductVariantInput {
  id?: string | undefined;
  title: string;
  sku: string;
  price: number;
  salePrice?: number | undefined;
  stockQuantity: number;
  weightKgOverride?: number | undefined;
  attributes?: Record<string, any> | undefined;
  images?: string[] | undefined;
}

export interface SaveProductInput {
  id?: string | undefined;
  sellerId: string;
  title: string;
  categoryId?: string | null | undefined;
  department?: string | undefined;
  subcategory?: string | undefined;
  description: string;
  price: number;
  salePrice?: number | undefined;
  sku?: string | undefined;
  stockQuantity?: number | undefined;
  careInstructions?: string | undefined;
  countryOfOrigin?: string | undefined;
  weightKg?: number | undefined;
  lengthCm?: number | undefined;
  widthCm?: number | undefined;
  heightCm?: number | undefined;
  handlingDays?: number | undefined;
  keyFeatures?: string[] | undefined;
  returnEligible?: boolean | undefined;
  status?: ProductStatus | undefined;
  media?: ProductMediaInput[] | undefined;
  variants?: ProductVariantInput[] | undefined;
}

/**
 * Server Function: Save or update product listing as Draft
 */
export const saveProductDraftServerFn = createServerFn({ method: "POST" })
  .validator((data: SaveProductInput) => data)
  .handler(async ({ data }) => {
    return saveProductTransactional({
      ...data,
      status: "DRAFT",
    });
  });

/**
 * Server Function: Submit product listing for marketplace moderation
 */
export const submitProductForReviewServerFn = createServerFn({ method: "POST" })
  .validator((data: SaveProductInput) => data)
  .handler(async ({ data }) => {
    // Validate required fields for review submission
    if (!data.title || data.title.trim().length < 3) {
      throw new Error("Product title must be at least 3 characters.");
    }
    if (!data.description || data.description.trim().length < 20) {
      throw new Error("Product description must be at least 20 characters.");
    }
    if (data.price <= 0) {
      throw new Error("Product price must be greater than $0.00 AUD.");
    }

    return saveProductTransactional({
      ...data,
      status: "SUBMITTED",
    });
  });

/**
 * Server Function: Get all products belonging to a seller
 */
export const getSellerProductsServerFn = createServerFn({ method: "GET" })
  .validator((data: { sellerId: string; status?: ProductStatus | undefined }) => data)
  .handler(async ({ data }) => {
    let query = (supabaseAdmin.from("products") as any)
      .select(`
        *,
        variants:product_variants(*),
        media:product_media(*),
        seller:sellers(business_name, slug, dispatch_address)
      `)
      .eq("seller_id", data.sellerId)
      .order("created_at", { ascending: false });

    if (data.status) {
      query = query.eq("status", data.status);
    }

    const { data: products, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch seller products: ${error.message}`);
    }

    return (products as unknown as FullProduct[]) || [];
  });

/**
 * Server Function: Clone existing product with unique SKU suffix
 */
export const cloneProductServerFn = createServerFn({ method: "POST" })
  .validator((data: { productId: string; sellerId: string }) => data)
  .handler(async ({ data }) => {
    const original = await getProductByIdOrSlug(data.productId);
    if (!original) {
      throw new Error("Product to clone not found.");
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const newTitle = `${original.title} (Copy)`;
    const primaryVariant = original.variants?.[0];
    const baseSku = primaryVariant?.seller_sku ?? `SKU-${randomSuffix}`;
    const newSku = `${baseSku}-COPY-${randomSuffix}`;

    return saveProductTransactional({
      sellerId: data.sellerId,
      title: newTitle,
      categoryId: original.category_id,
      department: original.department ?? undefined,
      subcategory: original.subcategory ?? undefined,
      description: original.description,
      price: primaryVariant?.price ?? 99,
      salePrice: primaryVariant?.sale_price ? Number(primaryVariant.sale_price) : undefined,
      sku: newSku,
      careInstructions: original.care_instructions ?? undefined,
      countryOfOrigin: original.country_of_origin ?? undefined,
      weightKg: original.weight_kg ? Number(original.weight_kg) : undefined,
      lengthCm: original.length_cm ? Number(original.length_cm) : undefined,
      widthCm: original.width_cm ? Number(original.width_cm) : undefined,
      heightCm: original.height_cm ? Number(original.height_cm) : undefined,
      handlingDays: original.handling_days ?? 2,
      keyFeatures: original.key_features ?? [],
      returnEligible: original.return_eligible ?? true,
      status: "DRAFT",
      variants: (original.variants || []).map((v) => ({
        title: v.title,
        sku: `${v.seller_sku}-COPY-${Math.floor(100 + Math.random() * 900)}`,
        price: Number(v.price),
        salePrice: v.sale_price ? Number(v.sale_price) : undefined,
        stockQuantity: v.stock_quantity,
        weightKgOverride: v.weight_kg_override ? Number(v.weight_kg_override) : undefined,
        attributes: (v.attributes as Record<string, any>) ?? {},
        images: v.images ?? [],
      })),
      media: (original.media || []).map((m, idx) => ({
        url: m.url,
        thumbnailUrl: m.thumbnail_url ?? undefined,
        mediaType: m.media_type,
        sortOrder: m.sort_order ?? idx,
        isPrimary: idx === 0,
      })),
    });
  });

/**
 * Server Function: Archive a product non-destructively
 */
export const archiveProductServerFn = createServerFn({ method: "POST" })
  .validator((data: { productId: string; sellerId: string }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("products") as any)
      .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
      .eq("id", data.productId)
      .eq("seller_id", data.sellerId);

    if (error) {
      throw new Error(`Failed to archive product: ${error.message}`);
    }

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: "PRODUCT_ARCHIVED",
      entity_type: "PRODUCT",
      entity_id: data.productId,
      payload: { sellerId: data.sellerId },
    });

    return { success: true };
  });

/**
 * Server Function: Admin catalogue moderation action
 */
export const moderateProductServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    productId: string;
    toStatus: ProductStatus;
    reason?: string | undefined;
  }) => data)
  .handler(async ({ data }) => {
    const { data: currentProduct, error: fetchErr } = await (supabaseAdmin.from("products") as any)
      .select("status, title, seller_id")
      .eq("id", data.productId)
      .single();

    if (fetchErr || !currentProduct) {
      throw new Error(`Product not found: ${fetchErr?.message}`);
    }

    const { error: updateErr } = await (supabaseAdmin.from("products") as any)
      .update({ status: data.toStatus, updated_at: new Date().toISOString() })
      .eq("id", data.productId);

    if (updateErr) {
      throw new Error(`Failed to update product status: ${updateErr.message}`);
    }

    // Insert to product moderation logs
    await (supabaseAdmin.from("product_moderation_logs") as any).insert({
      product_id: data.productId,
      from_status: currentProduct.status,
      to_status: data.toStatus,
      reason: data.reason ?? null,
    });

    // Record in global audit logs
    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: `PRODUCT_MODERATED_${data.toStatus}`,
      entity_type: "PRODUCT",
      entity_id: data.productId,
      payload: {
        fromStatus: currentProduct.status,
        toStatus: data.toStatus,
        reason: data.reason ?? null,
        sellerId: currentProduct.seller_id,
      },
    });

    return { success: true, productId: data.productId, status: data.toStatus };
  });

/**
 * Server Function: Fetch category dynamic attributes from DB
 */
export const getCategoryAttributesServerFn = createServerFn({ method: "GET" })
  .validator((data: { categoryId: string }) => data)
  .handler(async ({ data }) => {
    const { data: attrs, error } = await (supabaseAdmin.from("category_attributes") as any)
      .select(`
        *,
        options:attribute_options(*)
      `)
      .eq("category_id", data.categoryId)
      .order("sort_order", { ascending: true });

    if (error) {
      console.warn("Category attributes query warning:", error.message);
      return [];
    }

    return attrs || [];
  });

/**
 * Core transactional persistence for products, variants, options, and media
 */
export async function saveProductTransactional(payload: SaveProductInput): Promise<FullProduct> {
  const cleanSlug = payload.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const generatedSlug = `${cleanSlug}-${Math.random().toString(36).substring(2, 7)}`;

  // 1. Verify seller SKU uniqueness for new products or new variants
  if (payload.variants && payload.variants.length > 0) {
    for (const v of payload.variants) {
      const { data: existingSku } = await (supabaseAdmin.from("product_variants") as any)
        .select("id, product:products!inner(seller_id)")
        .eq("seller_sku", v.sku)
        .eq("product.seller_id", payload.sellerId)
        .neq("id", v.id ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle();

      if (existingSku) {
        throw new Error(`SKU "${v.sku}" is already in use by your store.`);
      }
    }
  }

  // Fallback category ID if not provided
  let categoryId = payload.categoryId;
  if (!categoryId) {
    const { data: cat } = await (supabaseAdmin.from("categories") as any)
      .select("id")
      .limit(1)
      .maybeSingle();
    categoryId = cat?.id ?? "00000000-0000-0000-0000-000000000001";
  }

  // 2. Upsert Product Row adhering to canonical schema
  const productData: any = {
    seller_id: payload.sellerId,
    category_id: categoryId,
    department: payload.department ?? "General",
    subcategory: payload.subcategory ?? null,
    title: payload.title,
    description: payload.description,
    care_instructions: payload.careInstructions ?? null,
    country_of_origin: payload.countryOfOrigin ?? "India",
    weight_kg: payload.weightKg ?? 0.5,
    length_cm: payload.lengthCm ?? null,
    width_cm: payload.widthCm ?? null,
    height_cm: payload.heightCm ?? null,
    handling_days: payload.handlingDays ?? 2,
    key_features: payload.keyFeatures ?? [],
    return_eligible: payload.returnEligible ?? true,
    status: payload.status ?? "DRAFT",
    updated_at: new Date().toISOString(),
  };

  if (!payload.id) {
    productData.slug = generatedSlug;
  }

  let savedProduct: any;

  if (payload.id) {
    const { data, error } = await (supabaseAdmin.from("products") as any)
      .update(productData)
      .eq("id", payload.id)
      .eq("seller_id", payload.sellerId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update product: ${error?.message}`);
    }
    savedProduct = data;
  } else {
    const { data, error } = await (supabaseAdmin.from("products") as any)
      .insert(productData)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create product: ${error?.message}`);
    }
    savedProduct = data;
  }

  const productId = savedProduct.id as string;

  // 3. Upsert Variants
  const variantsToPersist = payload.variants && payload.variants.length > 0
    ? payload.variants
    : [
        {
          title: "Standard",
          sku: payload.sku || `SKU-${Date.now()}`,
          price: payload.price,
          salePrice: payload.salePrice,
          stockQuantity: payload.stockQuantity ?? 1,
          weightKgOverride: payload.weightKg,
          attributes: {},
        },
      ];

  for (const v of variantsToPersist) {
    const variantData: any = {
      product_id: productId,
      title: v.title,
      seller_sku: v.sku,
      price: v.price,
      sale_price: v.salePrice ?? null,
      stock_quantity: v.stockQuantity,
      weight_kg_override: v.weightKgOverride ?? null,
      attributes: v.attributes ?? {},
      images: v.images ?? [],
      updated_at: new Date().toISOString(),
    };

    if (v.id) {
      await (supabaseAdmin.from("product_variants") as any)
        .update(variantData)
        .eq("id", v.id);
    } else {
      await (supabaseAdmin.from("product_variants") as any)
        .insert(variantData);
    }
  }

  // 4. Save Media with primary image enforcement
  if (payload.media && payload.media.length > 0) {
    // Delete existing media to maintain clean order
    await (supabaseAdmin.from("product_media") as any)
      .delete()
      .eq("product_id", productId);

    let hasPrimary = false;
    const mediaInserts = payload.media.map((m, idx) => {
      const isPrimary = !hasPrimary && (m.isPrimary || idx === 0);
      if (isPrimary) hasPrimary = true;

      return {
        product_id: productId,
        variant_id: m.variantId ?? null,
        url: m.url,
        thumbnail_url: m.thumbnailUrl ?? null,
        media_type: m.mediaType ?? (m.url.endsWith(".mp4") ? "video" : "image"),
        sort_order: m.sortOrder ?? idx,
        status: "APPROVED",
        moderation_status: "APPROVED",
      };
    });

    await (supabaseAdmin.from("product_media") as any).insert(mediaInserts);
  }

  return (await getProductByIdOrSlug(productId))!;
}

/**
 * Fetch a single product by its unique ID or slug, along with variants and media.
 */
export async function getProductByIdOrSlug(idOrSlug: string): Promise<FullProduct | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  const query = (supabase.from("products") as any)
    .select(`
      *,
      variants:product_variants(*),
      media:product_media(*),
      seller:sellers(business_name, slug, dispatch_address)
    `);

  const { data, error } = isUuid
    ? await query.eq("id", idOrSlug).maybeSingle()
    : await query.eq("slug", idOrSlug).maybeSingle();

  if (error) {
    console.error("Error fetching product:", error);
    return null;
  }

  return (data as unknown as FullProduct) || null;
}

/**
 * Client helper to bridge product creation form to server function
 */
export async function createProductWithVariants(payload: {
  sellerId: string;
  title: string;
  department: string;
  categoryId?: string | null | undefined;
  subcategory?: string | undefined;
  description: string;
  price?: number | undefined;
  salePrice?: number | undefined;
  stockQuantity?: number | undefined;
  status?: ProductStatus | undefined;
  variants: Array<{
    sku: string;
    title: string;
    price: number;
    salePrice?: number | undefined;
    stockQuantity: number;
    attributes?: Record<string, string> | undefined;
    images?: string[] | undefined;
  }>;
  media?: ProductMediaInput[] | undefined;
}): Promise<FullProduct> {
  const basePrice = payload.price ?? (payload.variants[0]?.price || 199);
  const baseStock = payload.stockQuantity ?? (payload.variants.reduce((acc, v) => acc + v.stockQuantity, 0) || 1);

  return saveProductTransactional({
    sellerId: payload.sellerId,
    title: payload.title,
    categoryId: payload.categoryId ?? null,
    department: payload.department,
    subcategory: payload.subcategory,
    description: payload.description,
    price: basePrice,
    salePrice: payload.salePrice,
    stockQuantity: baseStock,
    status: payload.status ?? "DRAFT",
    media: payload.media ?? (payload.variants[0]?.images?.map((url, i) => ({ url, isPrimary: i === 0 })) || []),
    variants: payload.variants.map((v) => ({
      title: v.title,
      sku: v.sku,
      price: v.price,
      salePrice: v.salePrice,
      stockQuantity: v.stockQuantity,
      attributes: v.attributes,
      images: v.images,
    })),
  });
}

/**
 * Upload an image or MP4 video to the public 'product-media' Supabase Storage bucket.
 */
export async function uploadProductMedia(file: File, sellerId: string): Promise<string> {
  // Validate MIME type
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");

  if (!isImage && !isVideo) {
    throw new Error("Invalid media type. Only JPG, PNG, WebP images and MP4 videos are allowed.");
  }

  // Validate size (20MB for images/media bucket, 100MB for video)
  const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File size exceeds the allowable limit of ${isVideo ? "100MB" : "20MB"}.`);
  }

  const fileExt = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
  const fileName = `${sellerId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from("product-media")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Error uploading product media:", error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from("product-media")
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * Fetch active store departments for navigation
 */
export async function getDepartments(): Promise<Database["public"]["Tables"]["departments"]["Row"][]> {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetch curated product collections
 */
export async function getCollections(): Promise<Database["public"]["Tables"]["collections"]["Row"][]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Error fetching collections:", error);
    return [];
  }
  return data || [];
}
