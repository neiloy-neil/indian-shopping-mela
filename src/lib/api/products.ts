import { supabase } from "@/lib/supabase/client";
import type { Database, ProductStatus } from "@/lib/supabase/types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];

export interface FullProduct extends ProductRow {
  variants: VariantRow[];
  seller?: {
    business_name: string;
    slug: string;
    dispatch_address: unknown;
  };
}

/**
 * Fetch a single product by its unique ID or slug, along with its variants and seller info.
 */
export async function getProductByIdOrSlug(idOrSlug: string): Promise<FullProduct | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  const query = supabase
    .from("products")
    .select(`
      *,
      variants:product_variants(*),
      seller:sellers(business_name, slug, dispatch_address)
    `);

  const { data, error } = isUuid
    ? await query.eq("id", idOrSlug).maybeSingle()
    : await query.eq("slug", idOrSlug).maybeSingle();

  if (error) {
    console.error("Error fetching product:", error);
    throw error;
  }

  return (data as unknown as FullProduct) || null;
}

/**
 * Fetch products by category slug with optional filtering and sorting.
 */
export async function getProductsByCategory(params: {
  categorySlug?: string | undefined;
  department?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  sortBy?: "relevance" | "newest" | "price_asc" | "price_desc" | undefined;
}): Promise<FullProduct[]> {
  let query = supabase
    .from("products")
    .select(`
      *,
      variants:product_variants(*),
      seller:sellers(business_name, slug, dispatch_address)
    `)
    .eq("status", "LIVE");

  if (params.department) {
    query = query.eq("department", params.department);
  }

  if (params.categorySlug) {
    query = query.eq("subcategory", params.categorySlug);
  }

  if (params.sortBy === "newest") {
    query = query.order("created_at", { ascending: false });
  }

  if (params.limit) {
    query = query.limit(params.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error querying category products:", error);
    return [];
  }

  return (data as unknown as FullProduct[]) || [];
}

/**
 * Search products by keyword, category, and price range.
 */
export async function searchProducts(searchTerm: string): Promise<FullProduct[]> {
  if (!searchTerm.trim()) return [];

  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      variants:product_variants(*),
      seller:sellers(business_name, slug)
    `)
    .eq("status", "LIVE")
    .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,department.ilike.%${searchTerm}%`)
    .limit(40);

  if (error) {
    console.error("Error searching products:", error);
    return [];
  }

  return (data as unknown as FullProduct[]) || [];
}

/**
 * Create a new product listing with variants.
 */
export async function createProductWithVariants(payload: {
  sellerId: string;
  title: string;
  department: string;
  categoryId: string;
  subcategory?: string | undefined;
  description: string;
  keyFeatures?: string[] | undefined;
  careInstructions?: string | undefined;
  countryOfOrigin?: string | undefined;
  returnEligible: boolean;
  handlingDays: number;
  weightKg: number;
  lengthCm?: number | undefined;
  widthCm?: number | undefined;
  heightCm?: number | undefined;
  fragile?: boolean | undefined;
  status?: ProductStatus | undefined;
  variants: Array<{
    sku: string;
    title: string;
    price: number;
    salePrice?: number | undefined;
    stockQuantity: number;
    lowStockThreshold?: number | undefined;
    attributes: Record<string, string>;
    images: string[];
  }>;
}): Promise<FullProduct> {
  const slug = payload.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  // 1. Insert parent product
  const productInsert = {
    seller_id: payload.sellerId,
    title: payload.title,
    slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
    department: payload.department,
    category_id: payload.categoryId,
    subcategory: payload.subcategory ?? null,
    description: payload.description,
    key_features: payload.keyFeatures ?? [],
    care_instructions: payload.careInstructions ?? null,
    country_of_origin: payload.countryOfOrigin ?? "India",
    return_eligible: payload.returnEligible,
    handling_days: payload.handlingDays,
    weight_kg: payload.weightKg,
    length_cm: payload.lengthCm ?? null,
    width_cm: payload.widthCm ?? null,
    height_cm: payload.heightCm ?? null,
    fragile: payload.fragile ?? false,
    status: payload.status ?? "DRAFT",
  };

  const { data: product, error: productError } = await supabase
    .from("products")
    .insert(productInsert as any)
    .select()
    .single();

  if (productError || !product) {
    console.error("Error inserting product:", productError);
    throw productError;
  }

  const productId = (product as any).id as string;

  // 2. Insert variants
  if (payload.variants.length > 0) {
    const variantInserts = payload.variants.map((v) => ({
      product_id: productId,
      seller_sku: v.sku,
      title: v.title,
      price: v.price,
      sale_price: v.salePrice ?? null,
      stock_quantity: v.stockQuantity,
      reserved_quantity: 0,
      low_stock_threshold: v.lowStockThreshold ?? 5,
      attributes: v.attributes,
      images: v.images,
    }));

    const { error: variantError } = await supabase
      .from("product_variants")
      .insert(variantInserts as any);

    if (variantError) {
      console.error("Error inserting variants:", variantError);
      throw variantError;
    }
  }

  return (await getProductByIdOrSlug(productId))!;
}

/**
 * Upload an image or MP4 video to the public 'product-media' Supabase Storage bucket.
 */
export async function uploadProductMedia(file: File, sellerId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
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
 * Fetch active store departments for navigation (§6, T043).
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
 * Fetch curated product collections (§6, T047).
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

/**
 * Admin catalogue moderation action with audit history logging (§7, T052, T053).
 */
export async function moderateProduct(
  productId: string,
  toStatus: ProductStatus,
  reason?: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Fetch current product status
  const { data: currentProduct } = await (supabase
    .from("products") as any)
    .select("status")
    .eq("id", productId)
    .single();

  const fromStatus = (currentProduct as { status?: ProductStatus } | null)?.status ?? null;

  // 2. Update status
  const { error: updateError } = await (supabase
    .from("products") as any)
    .update({ status: toStatus, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (updateError) {
    console.error("Error updating product status:", updateError);
    throw updateError;
  }

  // 3. Insert moderation log
  await (supabase.from("product_moderation_logs") as any).insert({
    product_id: productId,
    admin_id: user?.id ?? null,
    from_status: fromStatus,
    to_status: toStatus,
    reason: reason ?? null,
  });
}

/**
 * T137 — Fetch all products belonging to a seller with optional status filter.
 */
export async function getSellerProducts(sellerId: string, status?: ProductStatus): Promise<FullProduct[]> {
  let query = (supabase.from("products") as any)
    .select(`
      *,
      variants:product_variants(*),
      seller:sellers(business_name, slug, dispatch_address)
    `)
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching seller products:", error);
    return [];
  }

  return (data as unknown as FullProduct[]) || [];
}

/**
 * T138 — Update existing product and its variants safely.
 */
export async function updateProductWithVariants(
  productId: string,
  updates: Partial<Database["public"]["Tables"]["products"]["Row"]>,
  variants?: Array<Partial<Database["public"]["Tables"]["product_variants"]["Row"]>>
): Promise<void> {
  const { error: prodError } = await (supabase.from("products") as any)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (prodError) {
    console.error("Error updating product:", prodError);
    throw prodError;
  }

  if (variants && variants.length > 0) {
    for (const v of variants) {
      if (v.id) {
        await (supabase.from("product_variants") as any)
          .update({
            ...v,
            updated_at: new Date().toISOString(),
          })
          .eq("id", v.id);
      }
    }
  }
}

/**
 * T139 — Clone a product generating unique new SKUs and slug.
 */
export async function cloneProduct(productId: string): Promise<FullProduct> {
  const original = await getProductByIdOrSlug(productId);
  if (!original) throw new Error("Product to clone not found");

  const newTitle = `${original.title} (Copy)`;
  const cloneResult = await createProductWithVariants({
    sellerId: original.seller_id,
    title: newTitle,
    department: original.department,
    categoryId: original.category_id,
    subcategory: original.subcategory ?? undefined,
    description: original.description,
    keyFeatures: (original.key_features as string[]) ?? undefined,
    careInstructions: original.care_instructions ?? undefined,
    countryOfOrigin: original.country_of_origin ?? undefined,
    returnEligible: original.return_eligible ?? true,
    handlingDays: original.handling_days ?? 2,
    weightKg: Number(original.weight_kg || 0.5),
    lengthCm: original.length_cm ? Number(original.length_cm) : undefined,
    widthCm: original.width_cm ? Number(original.width_cm) : undefined,
    heightCm: original.height_cm ? Number(original.height_cm) : undefined,
    fragile: original.fragile ?? false,
    status: "DRAFT",
    variants: (original.variants || []).map((v) => ({
      sku: `${v.seller_sku}-COPY-${Math.floor(100 + Math.random() * 900)}`,
      title: v.title,
      price: Number(v.price),
      salePrice: v.sale_price ? Number(v.sale_price) : undefined,
      stockQuantity: v.stock_quantity,
      lowStockThreshold: v.low_stock_threshold,
      attributes: (v.attributes as Record<string, string>) || {},
      images: (v.images as string[]) || [],
    })),
  });

  return cloneResult;
}

/**
 * T139 — Archive a product non-destructively.
 */
export async function archiveProduct(productId: string): Promise<void> {
  const { error } = await (supabase.from("products") as any)
    .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) {
    console.error("Error archiving product:", error);
    throw error;
  }
}


