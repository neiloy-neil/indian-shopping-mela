import { supabase } from "@/lib/supabase/client";

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

    if (row.sale_price !== undefined && row.sale_price !== null && !isNaN(Number(row.sale_price))) {
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
      description: (row.description ?? "").trim() || row.product_title.trim(),
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
      handling_days: Number(row.handling_days) || 2,
      image_1_url: row.image_1_url.trim(),
      image_2_url: row.image_2_url?.trim(),
      video_url: row.video_url?.trim(),
      return_eligible: row.return_eligible !== false,
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
      const { data: product, error: productError } = await supabase
        .from("products")
        .upsert(
          {
            seller_id: sellerId,
            title: row.product_title,
            slug,
            department: row.department,
            category_id: "00000000-0000-0000-0000-000000000000", // Default category UUID
            subcategory: row.subcategory ?? null,
            description: row.description,
            return_eligible: row.return_eligible ?? true,
            handling_days: row.handling_days ?? 2,
            weight_kg: row.weight_kg,
            length_cm: row.length_cm ?? null,
            width_cm: row.width_cm ?? null,
            height_cm: row.height_cm ?? null,
            status: "LIVE",
          } as any,
          { onConflict: "seller_id,slug" }
        )
        .select()
        .single();

      if (productError || !product) {
        failed++;
        continue;
      }

      const productId = (product as any).id;

      // 2. Upsert variant
      const attributes: Record<string, string> = {};
      if (row.size) attributes["size"] = row.size;
      if (row.colour) attributes["colour"] = row.colour;
      if (row.material) attributes["material"] = row.material;

      const images = [row.image_1_url];
      if (row.image_2_url) images.push(row.image_2_url);

      const variantTitle = row.size || row.colour ? `${row.size ?? ""} ${row.colour ?? ""}`.trim() : "Default Variant";

      const { error: variantError } = await supabase
        .from("product_variants")
        .upsert(
          {
            product_id: productId,
            seller_sku: row.seller_sku,
            title: variantTitle,
            price: row.price,
            sale_price: row.sale_price ?? null,
            stock_quantity: row.stock_qty,
            attributes,
            images,
          } as any,
          { onConflict: "product_id,seller_sku" }
        );

      if (variantError) {
        failed++;
      } else {
        inserted++;
      }
    } catch {
      failed++;
    }
  }

  return { inserted, failed };
}
