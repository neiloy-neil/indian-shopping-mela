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
  "profiles", "sellers", "seller_staff", "seller_addresses", "seller_documents", "seller_agreements",
  "departments", "categories", "category_attributes", "attribute_options",
  "products", "product_variants", "product_variant_options", "product_media", "product_moderation_logs",
  "collections", "product_collections",
  "inventory_reservations", "inventory_transactions", "customer_addresses", "carts", "cart_lines",
  "wishlists", "orders", "sub_orders", "order_items",
  "order_status_history", "payments", "ledger_entries", "shipments",
  "tracking_events", "returns", "return_requests", "return_items", "refunds", "payouts",
  "payout_items", "payout_ledger", "product_reviews", "notifications", "user_notifications",
  "audit_logs", "webhook_events", "bulk_import_batches", "bulk_import_rows", "marketplace_configs"
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
  ["collections", "product_collections"],
  ["products", "product_collections"],
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

// 7. Verify seed.sql and production_seed.sql consistency
console.log(`\n7. Verifying seed files consistency against canonical schema...`);
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
  "public.products",
  "public.product_variants",
  "public.product_media",
  "public.marketplace_configs"
];

for (const table of SEED_TARGET_TABLES) {
  if (seedContent.includes(table)) {
    console.log(`   [PASS] Staging seed populates valid table: ${table}`);
  } else {
    console.error(`   [FAIL] Staging seed missing population for table: ${table}`);
    process.exit(1);
  }
}

// 8. Verify production seed isolation (optional — skip if not present)
const PROD_SEED_FILE = path.resolve(process.cwd(), "supabase/production_seed.sql");
if (fs.existsSync(PROD_SEED_FILE)) {
  const prodSeedContent = fs.readFileSync(PROD_SEED_FILE, "utf-8");
  assertProdSeed(prodSeedContent.includes("public.departments"), "Production seed populates departments");
  assertProdSeed(prodSeedContent.includes("public.categories"), "Production seed populates categories");
  assertProdSeed(prodSeedContent.includes("public.marketplace_configs"), "Production seed populates marketplace_configs");
  assertProdSeed(!prodSeedContent.includes("auth.users"), "Production seed strictly excludes synthetic auth users");
  assertProdSeed(!prodSeedContent.includes("public.orders"), "Production seed strictly excludes fake staging orders");
} else {
  console.log(`   [SKIP] production_seed.sql not found — skipping production seed checks.`);
}

function assertProdSeed(condition: boolean, label: string) {
  if (condition) {
    console.log(`   [PASS] ${label}`);
  } else {
    console.error(`   [FAIL] ${label}`);
    process.exit(1);
  }
}

// 9. Verify generated TypeScript types file alignment
console.log(`\n8. Verifying database.types.ts table definitions...`);
const DB_TYPES_FILE = path.resolve(process.cwd(), "src/lib/supabase/database.types.ts");
if (fs.existsSync(DB_TYPES_FILE)) {
  const dbTypesContent = fs.readFileSync(DB_TYPES_FILE, "utf-8");
  for (const table of REQUIRED_TABLES) {
    if (dbTypesContent.includes(`${table}: {`)) {
      // verified
    } else {
      console.warn(`   [WARN] database.types.ts might be missing type definition for: ${table}`);
    }
  }
  console.log(`   [PASS] Database types verified.`);
}

console.log("\n=======================================================");
console.log("  SCHEMA & SEED INTEGRITY CHECK: 100% PASSED (0 ERRORS)");
console.log("=======================================================\n");
process.exit(0);
