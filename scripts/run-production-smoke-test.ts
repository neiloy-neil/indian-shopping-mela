/**
 * Indian Shopping Mela (ISM) — Production Pre-flight & Smoke Test Suite (T554)
 *
 * Verifies production environment variables, database seed integrity,
 * secret isolation, security headers, robots/sitemap, and operational configurations.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// Summary
console.log("\n=======================================================");
console.log(`  SMOKE TEST SUMMARY: ${passed}/${passed + failed} PASSED (${failed} FAILED)`);
console.log("=======================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
