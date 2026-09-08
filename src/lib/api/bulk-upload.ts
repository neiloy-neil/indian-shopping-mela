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
  .validator((data: {
    sellerId: string;
    rows: BulkUploadRow[];
    mode?: "CREATE" | "UPDATE" | undefined;
    blankPolicy?: "ignore" | "clear" | undefined;
  }) => data)
  .handler(async ({ data }) => {
    return commitBulkImportChunk(data.sellerId, data.rows, data.mode ?? "CREATE", data.blankPolicy ?? "ignore");
  });

/**
 * SSRF Protection: Validate remote media URL is safe and public
 */
export function isSafeRemoteMediaUrl(urlStr: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, reason: "URL must use HTTP or HTTPS protocol." };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      (hostname.startsWith("172.") &&
        Number(hostname.split(".")[1]) >= 16 &&
        Number(hostname.split(".")[1]) <= 31) ||
      hostname === "169.254.169.254" || // AWS / GCP / Cloud metadata
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".onion")
    ) {
      return { safe: false, reason: "Access to private or local network addresses is strictly prohibited." };
    }
    return { safe: true };
  } catch {
    return { safe: false, reason: "Malformed URL format." };
  }
}

/**
 * Parse raw CSV or XLSX ArrayBuffer into structured product rows using SheetJS
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
 * Generate versioned canonical CSV template for bulk product uploads
 */
export function generateCsvTemplate(): string {
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
    [
      "MMB-SAR-001",
      "Banarasi Silk Saree — Rani Pink",
      "Women",
      "Sarees",
      "Banarasi Sarees",
      "Handcrafted pure silk saree with golden zari work and unstitched blouse piece.",
      "189.00",
      "169.00",
      "15",
      "VAR-SAR-01",
      "Free Size",
      "Rani Pink",
      "Pure Silk",
      "0.600",
      "30",
      "20",
      "5",
      "2",
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c",
      "",
      "",
      "true",
    ],
    [
      "MMB-JEW-002",
      "Oxidised Silver Jhumkas",
      "Jewellery",
      "Earrings",
      "Jhumkas",
      "Traditional antique finish German silver jhumkas with pearl beads.",
      "49.00",
      "",
      "40",
      "VAR-JEW-02",
      "Free Size",
      "Silver",
      "German Silver",
      "0.150",
      "10",
      "10",
      "4",
      "1",
      "https://images.unsplash.com/photo-1630019852942-f89202989a59",
      "",
      "",
      "true",
    ],
  ];

  return [headers.join(","), ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
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
      image_1_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c",
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
      image_1_url: "https://images.unsplash.com/photo-1630019852942-f89202989a59",
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

    if (
      row.sale_price !== undefined &&
      row.sale_price !== null &&
      String(row.sale_price).trim() !== "" &&
      !isNaN(Number(row.sale_price))
    ) {
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

    // 6. Primary Image Check & SSRF Validation
    const img1 = (row.image_1_url ?? "").trim();
    if (!img1) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "image_1_url",
        errorCode: "MISSING_PRIMARY_IMAGE",
        message: "Primary image URL (image_1_url) is required.",
      });
      return;
    }

    const ssrfCheck = isSafeRemoteMediaUrl(img1);
    if (!ssrfCheck.safe) {
      errors.push({
        rowNumber: rowNum,
        sku,
        field: "image_1_url",
        errorCode: "UNSAFE_URL_SSRF",
        message: ssrfCheck.reason ?? "Image URL is rejected for security reasons.",
      });
      return;
    }

    // 7. Video URL SSRF Check if provided
    if (row.video_url && row.video_url.trim()) {
      const videoCheck = isSafeRemoteMediaUrl(row.video_url.trim());
      if (!videoCheck.safe) {
        errors.push({
          rowNumber: rowNum,
          sku,
          field: "video_url",
          errorCode: "UNSAFE_URL_SSRF",
          message: videoCheck.reason ?? "Video URL is rejected for security reasons.",
        });
        return;
      }
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
      image_1_url: img1,
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
 * Ingest valid rows in serverless chunks into Supabase products, product_variants, and product_media.
 */
export async function commitBulkImportChunk(
  sellerId: string,
  rows: BulkUploadRow[],
  mode: "CREATE" | "UPDATE" = "CREATE",
  blankPolicy: "ignore" | "clear" = "ignore"
): Promise<{ inserted: number; updated: number; failed: number; batchId: string }> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  // 1. Create a tracking batch in bulk_import_batches
  const { data: batch } = await (supabaseAdmin.from("bulk_import_batches") as any)
    .insert({
      seller_id: sellerId,
      file_name: `batch_${Date.now()}.csv`,
      import_mode: mode.toLowerCase(),
      total_rows: rows.length,
      valid_rows: rows.length,
      error_rows: 0,
      status: "IMPORTING",
    })
    .select("id")
    .single();

  const batchId = batch?.id ?? `batch_${Date.now()}`;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 2;

    try {
      if (mode === "UPDATE") {
        // Find existing variant by SKU
        const { data: existingVariant } = await (supabaseAdmin.from("product_variants") as any)
          .select("id, product_id, price, compare_at_price, stock_quantity")
          .eq("sku", row.seller_sku)
          .single();

        if (existingVariant) {
          const updatePayload: Record<string, any> = {
            price: row.price,
            stock_quantity: row.stock_qty,
            updated_at: new Date().toISOString(),
          };

          if (row.sale_price !== undefined) {
            updatePayload["compare_at_price"] = row.sale_price;
          } else if (blankPolicy === "clear") {
            updatePayload["compare_at_price"] = null;
          }

          if (row.weight_kg) {
            updatePayload["weight_grams"] = Math.round(row.weight_kg * 1000);
          }

          await (supabaseAdmin.from("product_variants") as any)
            .update(updatePayload)
            .eq("id", existingVariant.id);

          // Update parent product
          await (supabaseAdmin.from("products") as any)
            .update({
              title: row.product_title,
              description: row.description,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingVariant.product_id);

          updated++;
          continue;
        }
      }

      // CREATE mode or new variant
      const slug = `${row.product_title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).substring(2, 7)}`;

      // 1. Insert product
      const { data: product, error: productError } = await (supabaseAdmin.from("products") as any)
        .insert({
          seller_id: sellerId,
          title: row.product_title,
          slug,
          description: row.description,
          status: "LIVE",
          stock_quantity: row.stock_qty,
        })
        .select("id")
        .single();

      if (productError || !product) {
        failed++;
        continue;
      }

      const productId = product.id;
      const weightGrams = Math.round(row.weight_kg * 1000);
      const variantTitle = row.size || row.colour ? `${row.size ?? ""} ${row.colour ?? ""}`.trim() : "Standard";

      // 2. Insert variant
      const { data: variant, error: variantError } = await (supabaseAdmin.from("product_variants") as any)
        .insert({
          product_id: productId,
          sku: row.seller_sku,
          title: variantTitle,
          price: row.price,
          compare_at_price: row.sale_price ?? null,
          stock_quantity: row.stock_qty,
          weight_grams: weightGrams,
          is_active: true,
        })
        .select("id")
        .single();

      if (variantError || !variant) {
        failed++;
        continue;
      }

      // 3. Insert primary media
      if (row.image_1_url) {
        await (supabaseAdmin.from("product_media") as any).insert({
          product_id: productId,
          media_type: "image",
          url: row.image_1_url,
          is_primary: true,
          alt_text: row.product_title,
        });
      }

      // 4. Insert secondary media
      if (row.image_2_url) {
        await (supabaseAdmin.from("product_media") as any).insert({
          product_id: productId,
          media_type: "image",
          url: row.image_2_url,
          is_primary: false,
          alt_text: `${row.product_title} - view 2`,
        });
      }

      if (row.video_url) {
        await (supabaseAdmin.from("product_media") as any).insert({
          product_id: productId,
          media_type: "video",
          url: row.video_url,
          is_primary: false,
          alt_text: `${row.product_title} video showcase`,
        });
      }

      inserted++;
    } catch {
      failed++;
    }
  }

  // Update batch completion status
  await (supabaseAdmin.from("bulk_import_batches") as any)
    .update({
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
    })
    .eq("id", batchId);

  return { inserted, updated, failed, batchId };
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
          products!inner (
            id,
            title,
            seller_id
          )
        `);

      if (data?.sellerId) {
        query = query.eq("products.seller_id", data.sellerId);
      }

      const { data: variants, error } = await query;
      if (error || !variants) return [];

      return variants.map((v: any) => ({
        id: v.id,
        variantId: v.id,
        sku: v.sku ?? "NO-SKU",
        productName: v.products?.title ?? "Product",
        stockOnHand: v.stock_quantity ?? 0,
        reservedUnits: 0,
        availableStock: v.stock_quantity ?? 0,
        price: Number(v.price) || 0,
      }));
    } catch {
      return [];
    }
  });

/**
 * Server Function: Batch update variant stock levels
 */
export const updateStockBatchServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId?: string | undefined; updates: Array<{ variantId?: string; sku?: string; newStock: number }> }) => data)
  .handler(async ({ data }) => {
    let updatedCount = 0;
    for (const item of data.updates) {
      if (item.newStock < 0) continue;
      let query = (supabaseAdmin.from("product_variants") as any)
        .update({ stock_quantity: Math.floor(item.newStock), updated_at: new Date().toISOString() });

      if (item.variantId) {
        query = query.eq("id", item.variantId);
      } else if (item.sku) {
        query = query.eq("sku", item.sku);
      } else {
        continue;
      }

      const { error } = await query;
      if (!error) updatedCount++;
    }
    return { success: true, updatedCount };
  });


