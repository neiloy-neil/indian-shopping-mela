import { createServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface BulkUploadRow {
  seller_sku: string;
  product_title: string;
  department: string;
  category: string;
  subcategory?: string | undefined;
  description: string;
  price: number;
  sale_price?: number | undefined;
  stock_qty: number;
  variant_group?: string | undefined;
  size?: string | undefined;
  colour?: string | undefined;
  material?: string | undefined;
  weight_kg: number;
  length_cm?: number | undefined;
  width_cm?: number | undefined;
  height_cm?: number | undefined;
  handling_days?: number | undefined;
  image_1_url: string;
  image_2_url?: string | undefined;
  video_url?: string | undefined;
  return_eligible?: boolean | undefined;
}

export interface BulkValidationError {
  rowNumber: number;
  sku: string;
  field: string;
  errorCode: string;
  message: string;
}

export interface BulkProcessResult {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  errors: BulkValidationError[];
  batchId: string;
}

/**
 * Server Function: Validate rows and return preview metrics
 */
export const validateBulkRowsServerFn = createServerFn({ method: "POST" })
  .validator((data: { rows: Partial<BulkUploadRow>[] }) => data)
  .handler(async ({ data }) => {
    return validateBulkRows(data.rows);
  });

/**
 * Server Function: Commit valid rows in transactional chunks
 */
export const commitBulkImportChunkServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string; rows: BulkUploadRow[]; mode?: "CREATE" | "UPDATE" }) => data)
  .handler(async ({ data }) => {
    return commitBulkImportChunk(data.sellerId, data.rows, data.mode);
  });

/**
 * Parse raw file ArrayBuffer into structured product rows using SheetJS
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer | Uint8Array, _fileName?: string): Partial<BulkUploadRow>[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return [];
  return XLSX.utils.sheet_to_json<Partial<BulkUploadRow>>(worksheet, { defval: "" });
}

/**
 * Generate a binary Excel (.xlsx) template for bulk product uploads
 */
export function generateXlsxTemplateBlob(): Uint8Array {
  const headers = [
    "seller_sku",
    "product_title",
    "department",
    "category",
    "subcategory",
    "description",
    "price",
    "sale_price",
    "stock_qty",
    "variant_group",
    "size",
    "colour",
    "material",
    "weight_kg",
    "length_cm",
    "width_cm",
    "height_cm",
    "handling_days",
    "image_1_url",
    "image_2_url",
    "video_url",
    "return_eligible",
  ];

  const sampleRows = [
    {
      seller_sku: "MMB-SAR-001",
      product_title: "Banarasi Silk Saree — Rani Pink",
      department: "Women",
      category: "Sarees",
      subcategory: "Banarasi Sarees",
      description: "Authentic pure silk saree with golden zari work and unstitched blouse piece.",
      price: 189.0,
      sale_price: 169.0,
      stock_qty: 15,
      variant_group: "VAR-SAR-01",
      size: "Free Size",
      colour: "Rani Pink",
      material: "Pure Silk",
      weight_kg: 0.6,
      length_cm: 30,
      width_cm: 20,
      height_cm: 5,
      handling_days: 2,
      image_1_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800",
      image_2_url: "",
      video_url: "",
      return_eligible: "true",
    },
    {
      seller_sku: "MMB-JEW-002",
      product_title: "Oxidised Silver Jhumkas",
      department: "Jewellery",
      category: "Earrings",
      subcategory: "Jhumkas",
      description: "Traditional antique finish German silver jhumkas with pearl beads.",
      price: 49.0,
      sale_price: "",
      stock_qty: 40,
      variant_group: "VAR-JEW-02",
      size: "Free Size",
      colour: "Silver",
      material: "German Silver",
      weight_kg: 0.15,
      length_cm: 10,
      width_cm: 10,
      height_cm: 4,
      handling_days: 1,
      image_1_url: "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&q=80&w=800",
      image_2_url: "",
      video_url: "",
      return_eligible: "true",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ISM Products");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" });
}

/**
 * Validate a batch of parsed CSV/XLSX rows according to Master Plan V1 (Section 8.2).
 */
export function validateBulkRows(rows: Partial<BulkUploadRow>[]): {
  validRows: BulkUploadRow[];
  errors: BulkValidationError[];
} {
  const validRows: BulkUploadRow[] = [];
  const errors: BulkValidationError[] = [];
  const seenSkus = new Set<string>();

  rows.forEach((row, index) => {
    const rowNum = index + 2; // Accounting for 1-based index and header row
    const sku = (row.seller_sku ?? "").trim();

    // 1. SKU Check
    if (!sku) {
      errors.push({
        rowNumber: rowNum,
        sku: "UNKNOWN",
        field: "seller_sku",
        errorCode: "MISSING_SKU",
        message: "Seller SKU is required and must be unique.",
      });
      return;
    }

    if (seenSkus.has(sku)) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "seller_sku",
        errorCode: "DUPLICATE_SKU",
        message: `Duplicate SKU '${sku}' detected within this file.`,
      });
      return;
    }
    seenSkus.add(sku);

    // 2. Title Check
    if (!row.product_title || !row.product_title.trim()) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "product_title",
        errorCode: "MISSING_TITLE",
        message: "Product title is required.",
      });
      return;
    }

    // 3. Department & Category Check
    if (!row.department || !row.department.trim()) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "department",
        errorCode: "MISSING_DEPARTMENT",
        message: "Department is required (e.g. Women, Jewellery, Home & Living).",
      });
      return;
    }

    // 4. Price Check
    const price = Number(row.price);
    if (isNaN(price) || price <= 0) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "price",
        errorCode: "INVALID_PRICE",
        message: "Price must be a valid positive number in AUD.",
      });
      return;
    }

    if (row.sale_price !== undefined && row.sale_price !== null && String(row.sale_price).trim() !== "" && !isNaN(Number(row.sale_price))) {
      if (Number(row.sale_price) >= price) {
        errors.push({
          rowNumber: rowNum,
          sku,
          field: "sale_price",
          errorCode: "INVALID_SALE_PRICE",
          message: "Sale price must be strictly less than the regular price.",
        });
        return;
      }
    }

    // 5. Stock Check
    const stock = Number(row.stock_qty);
    if (isNaN(stock) || stock < 0) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "stock_qty",
        errorCode: "INVALID_STOCK",
        message: "Stock quantity must be a non-negative integer.",
      });
      return;
    }

    // 6. Primary Image Check
    if (!row.image_1_url || !row.image_1_url.trim()) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "image_1_url",
        errorCode: "MISSING_PRIMARY_IMAGE",
        message: "Primary image URL (image_1_url) is required.",
      });
      return;
    }

    validRows.push({
      seller_sku: sku,
      product_title: row.product_title.trim(),
      department: row.department.trim(),
      category: (row.category ?? "General").trim(),
      subcategory: row.subcategory?.trim(),
      description: row.description?.trim() ?? row.product_title.trim(),
      price,
      sale_price: row.sale_price ? Number(row.sale_price) : undefined,
      stock_qty: Math.floor(stock),
      variant_group: row.variant_group?.trim(),
      size: row.size?.trim(),
      colour: row.colour?.trim(),
      material: row.material?.trim(),
      weight_kg: Number(row.weight_kg) || 0.5,
      length_cm: row.length_cm ? Number(row.length_cm) : undefined,
      width_cm: row.width_cm ? Number(row.width_cm) : undefined,
      height_cm: row.height_cm ? Number(row.height_cm) : undefined,
      handling_days: row.handling_days ? Number(row.handling_days) : 2,
      image_1_url: row.image_1_url.trim(),
      image_2_url: row.image_2_url?.trim(),
      video_url: row.video_url?.trim(),
      return_eligible: String(row.return_eligible).toLowerCase() !== "false",
    });
  });

  return { validRows, errors };
}

/**
 * Generate a downloadable CSV error report for failed rows.
 */
export function generateErrorReportCsv(errors: BulkValidationError[]): string {
  const header = "Row Number,Seller SKU,Field,Error Code,Error Message\n";
  const rows = errors.map(
    (e) => `${e.rowNumber},"${e.sku}","${e.field}","${e.errorCode}","${e.message.replace(/"/g, '""')}"`
  );
  return header + rows.join("\n");
}

/**
 * Ingest valid rows in serverless chunks (100 rows per chunk) into Supabase.
 */
export async function commitBulkImportChunk(
  sellerId: string,
  rows: BulkUploadRow[],
  mode: "CREATE" | "UPDATE" = "CREATE"
): Promise<{ inserted: number; failed: number }> {
  let inserted = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const slug = `${row.product_title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).substring(2, 6)}`;

      // 1. Upsert product
      const { data: product, error: productError } = await (supabaseAdmin as any)
        .from("products")
        .upsert(
          {
            seller_id: sellerId,
            title: row.product_title,
            slug,
            description: row.description,
            country_of_origin: "India",
            is_return_eligible: row.return_eligible ?? true,
            status: "LIVE",
          },
          { onConflict: "seller_id,slug" }
        )
        .select("id")
        .single();

      if (productError || !product) {
        failed++;
        continue;
      }

      const productId = product.id;
      const priceAudCents = Math.round(row.price * 100);
      const salePriceCents = row.sale_price ? Math.round(row.sale_price * 100) : null;
      const weightGrams = Math.round(row.weight_kg * 1000);
      const variantName = row.size || row.colour ? `${row.size ?? ""} ${row.colour ?? ""}`.trim() : "Standard";

      // 2. Upsert variant
      const { data: variant, error: variantError } = await (supabaseAdmin as any)
        .from("product_variants")
        .upsert(
          {
            product_id: productId,
            seller_sku: row.seller_sku,
            variant_name: variantName,
            price_aud_cents: priceAudCents,
            compare_at_aud_cents: salePriceCents,
            stock_quantity: row.stock_qty,
            weight_grams: weightGrams,
            length_cm: row.length_cm ?? null,
            width_cm: row.width_cm ?? null,
            height_cm: row.height_cm ?? null,
            is_active: true,
          },
          { onConflict: "product_id,seller_sku" }
        )
        .select("id")
        .single();

      if (variantError || !variant) {
        failed++;
        continue;
      }

      // 3. Upsert primary media
      if (row.image_1_url) {
        await (supabaseAdmin as any).from("product_media").insert({
          product_id: productId,
          variant_id: variant.id,
          media_type: "image",
          media_url: row.image_1_url,
          is_primary: true,
          status: "approved",
        });
      }

      // 4. Upsert secondary media / video
      if (row.image_2_url) {
        await (supabaseAdmin as any).from("product_media").insert({
          product_id: productId,
          variant_id: variant.id,
          media_type: "image",
          media_url: row.image_2_url,
          is_primary: false,
          status: "approved",
        });
      }

      if (row.video_url) {
        await (supabaseAdmin as any).from("product_media").insert({
          product_id: productId,
          variant_id: variant.id,
          media_type: "video",
          media_url: row.video_url,
          is_primary: false,
          status: "pending",
        });
      }

      inserted++;
    } catch {
      failed++;
    }
  }

  return { inserted, failed };
}

export interface SellerStockItem {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  stockOnHand: number;
  reservedUnits: number;
  availableStock: number;
  price: number;
}

/**
 * Server Function: Fetch seller SKUs with current stock and active reservation hold counts
 */
export const getSellerStockListServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId?: string | undefined }) => data)
  .handler(async ({ data }): Promise<SellerStockItem[]> => {
    try {
      let query = (supabaseAdmin.from("product_variants") as any)
        .select(`
          id,
          sku,
          stock_quantity,
          price,
          product:products(id, title, seller_id)
        `);

      if (data.sellerId) {
        // filter by seller if provided
        const { data: sellerProds } = await (supabaseAdmin.from("products") as any)
          .select("id")
          .eq("seller_id", data.sellerId);
        
        const prodIds = (sellerProds || []).map((p: any) => p.id);
        if (prodIds.length > 0) {
          query = query.in("product_id", prodIds);
        }
      }

      const { data: variants, error } = await query.limit(100);
      if (error || !variants || variants.length === 0) {
        return [];
      }

      // Fetch active reservations
      const now = new Date().toISOString();
      const variantIds = variants.map((v: any) => v.id);
      const { data: reservations } = await (supabaseAdmin.from("inventory_reservations") as any)
        .select("variant_id, quantity")
        .in("variant_id", variantIds)
        .eq("status", "active")
        .gt("expires_at", now);

      const reservationMap: Record<string, number> = {};
      (reservations || []).forEach((r: any) => {
        reservationMap[r.variant_id] = (reservationMap[r.variant_id] || 0) + Number(r.quantity || 0);
      });

      return variants.map((v: any) => {
        const reserved = reservationMap[v.id] || 0;
        const stockOnHand = Number(v.stock_quantity || 0);
        return {
          id: v.product?.id || v.id,
          variantId: v.id,
          sku: v.sku || `SKU-${v.id.slice(0, 8)}`,
          productName: v.product?.title || "Product Listing",
          stockOnHand,
          reservedUnits: reserved,
          availableStock: Math.max(0, stockOnHand - reserved),
          price: Number(v.price || 0),
        };
      });
    } catch (err) {
      console.error("Error fetching seller stock list:", err);
      return [];
    }
  });

/**
 * Server Function: Batch update variant stock levels and log inventory transactions
 */
export const updateStockBatchServerFn = createServerFn({ method: "POST" })
  .validator((data: { updates: Array<{ sku: string; newStock: number }> }) => data)
  .handler(async ({ data }) => {
    let updatedCount = 0;
    const errors: Array<{ sku: string; error: string }> = [];

    for (const update of data.updates) {
      try {
        const { data: variant, error: findError } = await (supabaseAdmin.from("product_variants") as any)
          .select("id, stock_quantity")
          .eq("sku", update.sku)
          .maybeSingle();

        if (findError || !variant) {
          errors.push({ sku: update.sku, error: "SKU not found in database" });
          continue;
        }

        const oldStock = Number(variant.stock_quantity || 0);
        const newStock = Math.max(0, Math.floor(update.newStock));

        const { error: updateError } = await (supabaseAdmin.from("product_variants") as any)
          .update({
            stock_quantity: newStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", variant.id);

        if (updateError) {
          errors.push({ sku: update.sku, error: updateError.message });
          continue;
        }

        // Record inventory transaction
        await (supabaseAdmin.from("inventory_transactions") as any).insert({
          variant_id: variant.id,
          transaction_type: "MANUAL_ADJUSTMENT",
          quantity: newStock - oldStock,
          balance_after: newStock,
          notes: `Bulk stock screen adjustment (${oldStock} -> ${newStock})`,
        });

        updatedCount++;
      } catch (err: any) {
        errors.push({ sku: update.sku, error: err.message || "Unknown error" });
      }
    }

    return {
      success: true,
      updatedCount,
      failedCount: errors.length,
      errors,
    };
  });

