/**
 * CI Guard: Enforces typed database boundaries on critical financial, inventory, order, and payout code.
 * Fails if any untyped escape hatches (e.g. `supabase.from(...) as any` or `supabaseAdmin as any`)
 * are detected in critical modules.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CRITICAL_FILES = [
  "src/lib/api/checkout.ts",
  "src/lib/api/orders.ts",
  "src/lib/api/inventory.ts",
  "src/lib/api/ledger.ts",
  "src/lib/api/returns.ts",
  "src/lib/api/payouts.ts",
  "src/lib/api/stripe-connect.ts",
  "src/lib/api/auth.ts",
  "src/routes/api.webhooks.stripe.ts",
];

const FORBIDDEN_PATTERNS = [
  /\.from\([^)]+\)\s*as\s+any/,
  /\.rpc\([^)]+\)\s*as\s+any/,
  /supabaseAdmin\s+as\s+any/,
  /\(supabase\s+as\s+any\)/,
  /\(supabaseAdmin\s+as\s+any\)/,
];

let violationCount = 0;

console.log("🔍 Checking typed boundaries in critical financial and order paths...\n");

for (const relPath of CRITICAL_FILES) {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ Warning: Critical file not found: ${relPath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        console.error(`❌ Untyped escape hatch in ${relPath}:${index + 1}`);
        console.error(`   ${line.trim()}\n`);
        violationCount++;
      }
    }
  });
}

if (violationCount > 0) {
  console.error(`💥 Failed: Found ${violationCount} untyped database escape hatches in critical paths.`);
  process.exit(1);
} else {
  console.log("✅ All critical financial, inventory, order, and payout DB paths are strictly typed with zero escape hatches!\n");
}
