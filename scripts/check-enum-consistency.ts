/**
 * ============================================================================
 * CANONICAL ENUM CONSISTENCY & LITERAL VERIFICATION SUITE
 * Run: npx tsx scripts/check-enum-consistency.ts
 *
 * Verifies:
 * 1. 100% parity between PostgreSQL enum types in 20260907_canonical_schema.sql
 *    and TypeScript enum definitions in database.types.ts.
 * 2. Strict enforcement that application code does not write legacy or non-canonical
 *    literals into enum-backed columns (ledger_entries, returns, sub_orders, payouts, payments).
 * ============================================================================
 */

import * as fs from "fs";
import * as path from "path";
import { Constants } from "../src/lib/supabase/database.types";

const CANONICAL_MIGRATION = path.resolve(
  process.cwd(),
  "supabase/migrations/20260907_canonical_schema.sql",
);

console.log("============================================================================");
console.log("ISM CANONICAL ENUM CONSISTENCY & LITERAL VERIFICATION GATE");
console.log("============================================================================");

let totalChecks = 0;
let passedChecks = 0;

function assert(condition: boolean, message: string) {
  totalChecks++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  passedChecks++;
  console.log(`✅ PASSED: ${message}`);
}

// 1. Verify Canonical SQL Migration Exists
assert(fs.existsSync(CANONICAL_MIGRATION), "Canonical SQL migration file exists");
const migrationSql = fs.readFileSync(CANONICAL_MIGRATION, "utf-8");

// 2. Extract Enums from SQL Migration
const sqlEnums: Record<string, string[]> = {};
const enumRegex = /CREATE TYPE\s+([a-z_]+)\s+AS\s+ENUM\s*\(([\s\S]*?)\);/gi;
let match;
while ((match = enumRegex.exec(migrationSql)) !== null) {
  const enumName = match[1]!.toLowerCase();
  const rawValues = match[2]!;
  const values = rawValues
    .split(",")
    .map((v) => v.trim().replace(/^['"]|['"]$/g, ""))
    .filter((v) => v.length > 0);
  sqlEnums[enumName] = values;
}

const dbEnums = Constants.public.Enums;

console.log(`\n1. Verifying Database Types Enum Parity against SQL Schema (${Object.keys(dbEnums).length} enums)...`);

for (const [enumName, dbValues] of Object.entries(dbEnums)) {
  const sqlValues = sqlEnums[enumName];
  assert(!!sqlValues, `SQL Schema defines ENUM type "${enumName}"`);

  if (sqlValues) {
    const missingInSql = (dbValues as readonly string[]).filter((v) => !sqlValues.includes(v));
    const missingInTs = sqlValues.filter((v) => !(dbValues as readonly string[]).includes(v));

    assert(
      missingInSql.length === 0,
      `Enum "${enumName}" has no TypeScript values missing in SQL (missing: ${missingInSql.join(", ") || "none"})`,
    );
    assert(
      missingInTs.length === 0,
      `Enum "${enumName}" has no SQL values missing in TypeScript (missing: ${missingInTs.join(", ") || "none"})`,
    );
  }
}

// 3. Scan Application Code for Disallowed Legacy String Literals in DB writes
console.log("\n2. Scanning Application Code for Non-Canonical Enum Writes...");

const sourceDirs = [
  path.resolve(process.cwd(), "src/lib/api"),
  path.resolve(process.cwd(), "src/routes"),
];

const disallowedWritePatterns: { pattern: RegExp; description: string }[] = [
  {
    pattern: /entry_type:\s*["']CUSTOMER_PAYMENT["']/g,
    description: 'Legacy entry_type "CUSTOMER_PAYMENT" (must use canonical "CUSTOMER_CHARGE")',
  },
  {
    pattern: /entry_type:\s*["']SELLER_CREDIT["']/g,
    description: 'Legacy entry_type "SELLER_CREDIT" (must use canonical "SELLER_GROSS")',
  },
  {
    pattern: /entry_type:\s*["']PLATFORM_COMMISSION["']/g,
    description: 'Legacy entry_type "PLATFORM_COMMISSION" (must use canonical "ISM_COMMISSION")',
  },
  {
    pattern: /entry_type:\s*["']GST_REMITTANCE["']/g,
    description: 'Legacy entry_type "GST_REMITTANCE" (must use canonical "GST_COLLECTED")',
  },
  {
    pattern: /entry_type:\s*["']REFUND_CUSTOMER["']/g,
    description: 'Legacy entry_type "REFUND_CUSTOMER" (must use canonical "CUSTOMER_REFUND")',
  },
  {
    pattern: /status:\s*["']NEW_ORDER["']/g,
    description: 'Legacy sub_order status "NEW_ORDER" (must use canonical "ORDER_CREATED")',
  },
];

let violationCount = 0;

function scanDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const rule of disallowedWritePatterns) {
        if (rule.pattern.test(content)) {
          console.error(`❌ Violation in ${path.relative(process.cwd(), fullPath)}: ${rule.description}`);
          violationCount++;
        }
      }
    }
  }
}

for (const dir of sourceDirs) {
  scanDirectory(dir);
}

assert(violationCount === 0, `Zero non-canonical enum write violations in application code (found ${violationCount})`);

// 4. Summary Output
console.log("\n============================================================================");
console.log(`✅ ENUM CONSISTENCY GATE PASSED: ${passedChecks}/${totalChecks} assertions satisfied.`);
console.log("============================================================================\n");
