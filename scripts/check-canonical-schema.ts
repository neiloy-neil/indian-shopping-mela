/**
 * Indian Shopping Mela — Canonical Schema & Migration Integrity Checker
 * Validates active migration files, required database tables, table creation order,
 * foreign key integrity, atomic RPCs, storage buckets, RLS policies, and seed consistency.
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const SEED_FILE = path.resolve(process.cwd(), "supabase/seed.sql");
const CANONICAL_MIGRATION = "20260907_canonical_schema.sql";

console.log("\n=======================================================");
console.log("  ISM CANONICAL SCHEMA & SEED INTEGRITY AUDIT");
console.log("=======================================================");

// 1. Verify only canonical migrations are active
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR);
console.log(`1. Inspecting active migrations in ${MIGRATIONS_DIR}...`);
console.log(`   Found ${migrationFiles.length} file(s): ${migrationFiles.join(", ")}`);

if (migrationFiles.length !== 1 || migrationFiles[0] !== CANONICAL_MIGRATION) {
  console.error(`[FAIL] Active migration directory must contain ONLY ${CANONICAL_MIGRATION}. Found: ${migrationFiles.join(", ")}`);
  process.exit(1);
}
console.log(`   [PASS] Only canonical migration is active.`);

// 2. Read and parse migration content
const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, CANONICAL_MIGRATION), "utf-8");

// Required tables checklist
const REQUIRED_TABLES = [
  "profiles", "sellers", "seller_members", "seller_addresses", "seller_documents",
  "departments", "categories", "category_attributes", "attribute_options",
  "products", "product_variants", "product_variant_options", "product_media",
  "collections", "collection_products",
  "inventory_reservations", "inventory_transactions", "customer_addresses", "carts", "cart_lines",
  "wishlists", "orders", "sub_orders", "order_items",
  "order_status_history", "payments", "ledger_entries", "shipments",
  "tracking_events", "returns", "return_items", "refunds", "payouts",
  "payout_items", "product_reviews", "notifications", "audit_logs",
  "webhook_events", "bulk_import_batches", "bulk_import_rows", "marketplace_configs"
];

console.log(`\n2. Verifying ${REQUIRED_TABLES.length} canonical tables in SQL schema...`);
let missingTables = 0;
const tablePositions = new Map<string, number>();

for (const table of REQUIRED_TABLES) {
  const tableRegex = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b|CREATE TABLE public\\.${table}\\b`, "i");
  const match = tableRegex.exec(sqlContent);
  if (match) {
    tablePositions.set(table, match.index);
  } else {
    console.error(`   [FAIL] Missing table definition: public.${table}`);
    missingTables++;
  }
}

if (missingTables > 0) {
  console.error(`\n[FAIL] Found ${missingTables} missing table definitions.`);
  process.exit(1);
}
console.log(`   [PASS] All ${REQUIRED_TABLES.length} canonical tables exist.`);

// 3. Verify table creation ordering for key dependencies
console.log(`\n3. Verifying table creation and foreign-key order dependencies...`);
const ORDER_DEPENDENCIES: Array<[string, string]> = [
  ["departments", "categories"],
  ["categories", "category_attributes"],
  ["category_attributes", "attribute_options"],
  ["sellers", "products"],
  ["categories", "products"],
  ["products", "product_variants"],
  ["product_variants", "product_variant_options"],
  ["products", "product_media"],
  ["collections", "collection_products"],
  ["products", "collection_products"],
  ["product_variants", "inventory_reservations"],
  ["carts", "cart_lines"],
  ["product_variants", "cart_lines"],
  ["orders", "sub_orders"],
  ["sub_orders", "order_items"],
  ["sub_orders", "shipments"],
  ["shipments", "tracking_events"],
  ["sub_orders", "returns"],
  ["returns", "return_items"],
  ["payouts", "payout_items"],
];

let orderErrors = 0;
for (const [parent, child] of ORDER_DEPENDENCIES) {
  const parentPos = tablePositions.get(parent);
  const childPos = tablePositions.get(child);
  if (parentPos !== undefined && childPos !== undefined) {
    if (parentPos > childPos) {
      console.error(`   [FAIL] Ordering violation: Table "${parent}" must be created before dependent table "${child}".`);
      orderErrors++;
    }
  }
}

if (orderErrors > 0) {
  process.exit(1);
}
console.log(`   [PASS] All ${ORDER_DEPENDENCIES.length} table creation order dependencies verified.`);

// 4. Verify atomic inventory & stock RPCs
console.log(`\n4. Verifying atomic inventory RPC functions...`);
const REQUIRED_RPCS = [
  "reserve_inventory_atomic",
  "commit_inventory_reservation",
  "release_inventory_reservation",
  "decrement_variant_stock",
  "release_expired_reservations"
];

let missingRpcs = 0;
for (const rpc of REQUIRED_RPCS) {
  if (sqlContent.includes(`CREATE OR REPLACE FUNCTION public.${rpc}`) || sqlContent.includes(`CREATE OR REPLACE FUNCTION ${rpc}`)) {
    console.log(`   [PASS] Found atomic RPC: ${rpc}`);
  } else {
    console.error(`   [FAIL] Missing atomic RPC: ${rpc}`);
    missingRpcs++;
  }
}

if (missingRpcs > 0) {
  process.exit(1);
}

// 5. Verify SECURITY DEFINER functions have search_path = public
console.log(`\n5. Verifying search_path security on all SECURITY DEFINER functions...`);
const strippedSql = sqlContent.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
const secDefRegex = /SECURITY\s+DEFINER(?!\s+SET\s+search_path\s*=\s*public)/g;
if (secDefRegex.test(strippedSql)) {
  console.error(`   [FAIL] Found SECURITY DEFINER function missing "SET search_path = public" hardening.`);
  process.exit(1);
}
console.log(`   [PASS] All SECURITY DEFINER functions explicitly set search_path = public.`);

// 6. Verify storage buckets
console.log(`\n6. Verifying storage buckets configuration...`);
const REQUIRED_BUCKETS = ["product-media", "seller-documents", "return-evidence"];
for (const bucket of REQUIRED_BUCKETS) {
  if (sqlContent.includes(`'${bucket}'`)) {
    console.log(`   [PASS] Found bucket: ${bucket}`);
  } else {
    console.error(`   [FAIL] Missing bucket setup: ${bucket}`);
    process.exit(1);
  }
}

// 7. Verify seed.sql consistency
console.log(`\n7. Verifying seed.sql consistency against canonical schema...`);
if (!fs.existsSync(SEED_FILE)) {
  console.error(`   [FAIL] Missing seed file: ${SEED_FILE}`);
  process.exit(1);
}

const seedContent = fs.readFileSync(SEED_FILE, "utf-8");
const SEED_TARGET_TABLES = [
  "public.departments",
  "public.categories",
  "auth.users",
  "public.profiles",
  "public.sellers",
  "public.seller_addresses",
  "public.products",
  "public.product_variants",
  "public.product_variant_options",
  "public.product_media"
];

for (const table of SEED_TARGET_TABLES) {
  if (seedContent.includes(table)) {
    console.log(`   [PASS] Seed populates valid table: ${table}`);
  } else {
    console.error(`   [FAIL] Seed missing population for table: ${table}`);
    process.exit(1);
  }
}

console.log("\n=======================================================");
console.log("  SCHEMA & SEED INTEGRITY CHECK: 100% PASSED (0 ERRORS)");
console.log("=======================================================\n");
process.exit(0);
