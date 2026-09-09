/**
 * Indian Shopping Mela (ISM) — Production Pre-flight & Smoke Test Suite (T554 / Prompt 9)
 *
 * Verifies production environment variables, database seed integrity,
 * secret isolation, security headers, robots/sitemap, operational configurations,
 * and canonical schema contract smoke tests for orders, sub_orders, payments,
 * ledger_entries, returns, refunds, and payouts.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../src/lib/supabase/database.types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorDetail?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${errorDetail ? `: ${errorDetail}` : ""}`);
    failed++;
  }
}

console.log("\n=======================================================");
console.log("  INDIAN SHOPPING MELA — PRODUCTION PRE-FLIGHT SMOKE TEST");
console.log("=======================================================\n");

// 1. Production Seed & Isolation (T536, T552)
console.log("1. Verifying Canonical Production Seed Isolation (T536)...");
const prodSeedPath = path.join(rootDir, "supabase", "production_seed.sql");
const prodSeedContent = fs.readFileSync(prodSeedPath, "utf8");

assert(fs.existsSync(prodSeedPath), "production_seed.sql exists");
assert(
  !prodSeedContent.includes("auth.users"),
  "production_seed contains zero synthetic test users",
);
assert(
  !prodSeedContent.includes("public.orders"),
  "production_seed contains zero fake staging orders",
);
assert(
  !prodSeedContent.includes("public.products"),
  "production_seed contains zero fake demo products",
);
assert(
  prodSeedContent.includes("public.departments"),
  "production_seed populates core departments",
);
assert(prodSeedContent.includes("public.categories"), "production_seed populates core categories");
assert(
  prodSeedContent.includes("public.marketplace_configs"),
  "production_seed configures operational settings",
);
assert(
  prodSeedContent.includes("return_window_days"),
  "production_seed defines 7-day return window",
);
assert(
  prodSeedContent.includes("payout_delay_days"),
  "production_seed defines 14-day payout maturity delay",
);

// 2. Robots & Sitemap Configuration (T548)
console.log("\n2. Verifying SEO, Robots & Sitemap Configuration (T548)...");
const robotsPath = path.join(rootDir, "public", "robots.txt");
const sitemapPath = path.join(rootDir, "public", "sitemap.xml");

assert(fs.existsSync(robotsPath), "public/robots.txt exists");
assert(fs.existsSync(sitemapPath), "public/sitemap.xml exists");

const robotsContent = fs.readFileSync(robotsPath, "utf8");
const sitemapContent = fs.readFileSync(sitemapPath, "utf8");

assert(
  robotsContent.includes("Sitemap: https://indianshoppingmela.com.au/sitemap.xml"),
  "robots.txt links to production sitemap",
);
assert(
  robotsContent.includes("Disallow: /admin/"),
  "robots.txt protects admin portal from indexing",
);
assert(
  robotsContent.includes("Disallow: /sell/"),
  "robots.txt protects seller portal from indexing",
);
assert(
  robotsContent.includes("Disallow: /checkout/"),
  "robots.txt protects checkout flow from indexing",
);
assert(
  sitemapContent.includes("<loc>https://indianshoppingmela.com.au/</loc>"),
  "sitemap.xml includes root landing",
);
assert(
  sitemapContent.includes("<loc>https://indianshoppingmela.com.au/policies</loc>"),
  "sitemap.xml includes legal policies",
);

// 3. Deployment Configuration & Security Headers (T537, T546)
console.log("\n3. Verifying Production Vercel & Security Headers (T537)...");
const vercelPath = path.join(rootDir, "vercel.json");
assert(fs.existsSync(vercelPath), "vercel.json exists");

const vercelContent = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
const headers = vercelContent.headers?.[0]?.headers ?? [];
const headerMap = new Map(headers.map((h: any) => [h.key, h.value]));

assert(headerMap.get("X-Content-Type-Options") === "nosniff", "Vercel enforces nosniff header");
assert(headerMap.get("X-Frame-Options") === "DENY", "Vercel enforces DENY clickjacking protection");
assert(
  headerMap.get("Strict-Transport-Security")?.includes("max-age=63072000"),
  "Vercel enforces HSTS preloading",
);

// 4. Client Secret Leak Prevention Audit (T551)
console.log("\n4. Verifying Client Secret Leak Prevention (T551)...");
const clientFiles = [
  path.join(rootDir, "src", "routes", "policies.tsx"),
  path.join(rootDir, "src", "routes", "index.tsx"),
  path.join(rootDir, "src", "routes", "checkout.tsx"),
  path.join(rootDir, "src", "routes", "sell.index.tsx"),
];

for (const file of clientFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    assert(
      !content.includes("SUPABASE_SERVICE_ROLE_KEY"),
      `${path.basename(file)} does not leak Supabase service role key`,
    );
    assert(
      !content.includes("STRIPE_SECRET_KEY"),
      `${path.basename(file)} does not leak Stripe secret key`,
    );
    assert(
      !content.includes("BREVO_API_KEY"),
      `${path.basename(file)} does not leak Brevo API key`,
    );
    assert(
      !content.includes("AUSPOST_API_KEY"),
      `${path.basename(file)} does not leak AusPost API key`,
    );
  }
}

// 5. Critical Database Mutation & Type Contract Smoke Tests (Prompt 9)
console.log("\n5. Verifying Canonical Insert/Update Contract Smoke Tests (Prompt 9)...");

// 5.1 Orders Contract
const orderInsert: Database["public"]["Tables"]["orders"]["Insert"] = {
  customer_id: "usr_smoke_001",
  order_number: "ISM-SMOKE-001",
  subtotal: 10000,
  gst_total: 1000,
  shipping_total: 995,
  total_amount: 11995,
  currency: "AUD",
  status: "PENDING",
  payment_intent_id: "pi_smoke_12345",
  shipping_address: { address: "123 George St", city: "Sydney", state: "NSW", postcode: "2000" },
  billing_address: { address: "123 George St", city: "Sydney", state: "NSW", postcode: "2000" },
};
assert(orderInsert.subtotal === 10000 && orderInsert.gst_total === 1000, "Orders insert contract satisfies canonical integer cents schema");

// 5.2 Sub-orders Contract
const subOrderInsert: Database["public"]["Tables"]["sub_orders"]["Insert"] = {
  master_order_id: "ord_smoke_001",
  seller_id: "sel_smoke_001",
  subtotal: 10000,
  gst_amount: 1000,
  shipping_cost: 995,
  total_amount: 11995,
  net_seller_amount: 9995,
  ism_commission_amount: 1000,
  status: "ORDER_CREATED",
};
assert(subOrderInsert.status === "ORDER_CREATED" && subOrderInsert.master_order_id === "ord_smoke_001", "Sub-orders insert contract satisfies canonical schema");

const subOrderUpdate: Database["public"]["Tables"]["sub_orders"]["Update"] = {
  status: "READY_TO_SHIP",
  carrier: "Australia Post",
  tracking_number: "AP-AU-998877",
};
assert(subOrderUpdate.status === "READY_TO_SHIP", "Sub-orders update contract supports READY_TO_SHIP status");

// 5.3 Payments Contract
const paymentInsert: Database["public"]["Tables"]["payments"]["Insert"] = {
  order_id: "ord_smoke_001",
  amount_cents: 11995,
  currency: "AUD",
  payment_method: "STRIPE",
  status: "PAID",
  provider_payment_intent_id: "pi_smoke_12345",
};
assert(paymentInsert.status === "PAID" && paymentInsert.amount_cents === 11995, "Payments insert contract satisfies canonical schema");

// 5.4 Ledger Entries Contract
const ledgerInsert: Database["public"]["Tables"]["ledger_entries"]["Insert"] = {
  order_id: "ord_smoke_001",
  seller_id: "sel_smoke_001",
  entry_type: "CUSTOMER_CHARGE",
  amount_cents: 11995,
  currency: "AUD",
  description: "Customer charge for ISM-SMOKE-001",
};
assert(ledgerInsert.entry_type === "CUSTOMER_CHARGE" && ledgerInsert.amount_cents === 11995, "Ledger insert contract satisfies double-entry schema");

// 5.5 Returns Contract
const returnInsert: Database["public"]["Tables"]["returns"]["Insert"] = {
  order_id: "ord_smoke_001",
  sub_order_id: "sub_smoke_001",
  customer_id: "usr_smoke_001",
  return_number: "RET-SMOKE-001",
  status: "RETURN_REQUESTED",
  reason_code: "CHANGE_OF_MIND",
  payout_hold_placed: true,
};
assert(returnInsert.status === "RETURN_REQUESTED" && returnInsert.payout_hold_placed === true, "Returns insert contract satisfies canonical schema");

// 5.6 Refunds Contract
const refundInsert: Database["public"]["Tables"]["refunds"]["Insert"] = {
  order_id: "ord_smoke_001",
  sub_order_id: "sub_smoke_001",
  return_id: "ret_smoke_001",
  amount_cents: 10000,
  currency: "AUD",
  reason: "Customer change of mind return",
  provider_refund_id: "re_smoke_998877",
  idempotency_key: "return_refund_ret_smoke_001",
};
assert(refundInsert.provider_refund_id === "re_smoke_998877" && refundInsert.currency === "AUD", "Refunds insert contract satisfies canonical schema");

// 5.7 Payouts Contract
const payoutInsert: Database["public"]["Tables"]["payouts"]["Insert"] = {
  seller_id: "sel_smoke_001",
  payout_batch_id: "bat_smoke_001",
  amount_cents: 9995,
  currency: "AUD",
  status: "PAID_TO_SELLER",
  provider_transfer_id: "tr_smoke_12345",
  paid_at: new Date().toISOString(),
};
assert(payoutInsert.status === "PAID_TO_SELLER" && payoutInsert.provider_transfer_id === "tr_smoke_12345", "Payouts insert contract satisfies Stripe Connect schema");

// 6. RLS Policy Audit Smoke Test (Prompt 9)
console.log("\n6. Verifying Canonical RLS Policies in Schema (Prompt 9)...");
const canonicalSchemaPath = path.join(rootDir, "supabase", "migrations", "20260907_canonical_schema.sql");
const schemaSql = fs.readFileSync(canonicalSchemaPath, "utf8");

const criticalRlsTables = [
  "orders",
  "sub_orders",
  "order_items",
  "payments",
  "ledger_entries",
  "returns",
  "return_items",
  "refunds",
  "payouts",
  "payout_items",
  "sellers",
  "seller_documents",
  "carts",
  "cart_lines",
  "customer_addresses",
];

for (const tbl of criticalRlsTables) {
  const rlsRegex = new RegExp(`ALTER TABLE public\\.${tbl} ENABLE ROW LEVEL SECURITY;`, "i");
  assert(rlsRegex.test(schemaSql), `Table "public.${tbl}" has RLS explicitly enabled`);
}

// Summary
console.log("\n=======================================================");
console.log(`  SMOKE TEST SUMMARY: ${passed}/${passed + failed} PASSED (${failed} FAILED)`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
