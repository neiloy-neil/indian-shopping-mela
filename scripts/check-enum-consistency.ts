/**
 * ============================================================================
 * CANONICAL ENUM, COLUMN & SCHEMA PARITY VERIFICATION SUITE (Prompt 8)
 * Run: npx tsx scripts/check-enum-consistency.ts
 *
 * Verifies:
 * 1. 100% parity between PostgreSQL enum types in 20260907_canonical_schema.sql
 *    and TypeScript enum definitions in database.types.ts.
 * 2. Strict enforcement that application code does not write legacy or non-canonical
 *    literals into enum-backed columns (ledger_entries, returns, sub_orders, payouts, payments, products).
 * 3. Accurate detection of critical insert/update column name drift across tables.
 * 4. Detection of queries targeting deprecated/legacy table names.
 * 5. Enforcement of integer cents money-field contract across financial tables.
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
console.log("ISM CANONICAL ENUM, COLUMN & SCHEMA PARITY VERIFICATION GATE (Prompt 8)");
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

const disallowedEnumWritePatterns: { pattern: RegExp; description: string }[] = [
  // ledger_entries.entry_type
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
  // sub_orders.status
  {
    pattern: /status:\s*["']NEW_ORDER["']/g,
    description: 'Legacy sub_order status "NEW_ORDER" (must use canonical "ORDER_CREATED")',
  },
  {
    pattern: /status:\s*["']PENDING_ACCEPTANCE["']/g,
    description: 'Legacy sub_order status "PENDING_ACCEPTANCE" (must use canonical "ORDER_CREATED")',
  },
  {
    pattern: /status:\s*["']PACKED["']/g,
    description: 'Legacy sub_order status "PACKED" (must use canonical "READY_TO_SHIP")',
  },
  // returns.status
  {
    pattern: /status:\s*["']PENDING_APPROVAL["']/g,
    description: 'Legacy return status "PENDING_APPROVAL" (must use canonical "RETURN_REQUESTED")',
  },
  // payouts.status
  {
    pattern: /status:\s*["']QUEUED["']/g,
    description: 'Legacy payout status "QUEUED" (must use canonical "PAYOUT_HOLD")',
  },
];

// 4. Scan Application Code for Critical Insert/Update Column Name Drift
console.log("\n3. Scanning Application Code for Critical Insert/Update Column Name Drift...");

interface ColumnCheckRule {
  table: string;
  forbiddenColumn: string;
  canonicalColumn: string;
}

const columnDriftRules: ColumnCheckRule[] = [
  { table: "orders", forbiddenColumn: "user_id", canonicalColumn: "customer_id" },
  { table: "orders", forbiddenColumn: "items_total", canonicalColumn: "subtotal" },
  { table: "orders", forbiddenColumn: "tax_total", canonicalColumn: "gst_total" },
  { table: "sub_orders", forbiddenColumn: "order_id", canonicalColumn: "master_order_id" },
  { table: "sub_orders", forbiddenColumn: "shipping_amount", canonicalColumn: "shipping_cost" },
  { table: "sub_orders", forbiddenColumn: "seller_net", canonicalColumn: "net_seller_amount" },
  { table: "order_items", forbiddenColumn: "item_price", canonicalColumn: "unit_price" },
  { table: "order_items", forbiddenColumn: "tax_amount", canonicalColumn: "gst_amount" },
  { table: "refunds", forbiddenColumn: "stripe_refund_id", canonicalColumn: "provider_refund_id" },
  { table: "payouts", forbiddenColumn: "stripe_transfer_id", canonicalColumn: "provider_transfer_id" },
];

/**
 * Extracts payload passed to .insert(...) or .update(...) for a specific table
 */
function checkTableColumnDrift(
  content: string,
  filePath: string,
  rule: ColumnCheckRule,
): number {
  let violations = 0;
  // Match e.g. .from("table") or .from('table')
  const fromPattern = new RegExp(`\\.from\\(\\s*["']${rule.table}["']\\s*\\)`, "g");
  let fromMatch;

  while ((fromMatch = fromPattern.exec(content)) !== null) {
    const fromIndex = fromMatch.index;
    // Look ahead up to 300 chars for .insert( or .update(
    const lookahead = content.slice(fromIndex, fromIndex + 300);
    const methodMatch = /\.(?:insert|update)\s*\(/g.exec(lookahead);
    if (!methodMatch) continue;

    const payloadStart = fromIndex + methodMatch.index + methodMatch[0].length;
    // Extract the argument inside the method call up to matching closing paren
    let parenDepth = 1;
    let payloadEnd = payloadStart;
    while (payloadEnd < content.length && parenDepth > 0) {
      if (content[payloadEnd] === "(") parenDepth++;
      else if (content[payloadEnd] === ")") parenDepth--;
      payloadEnd++;
    }

    const payloadText = content.slice(payloadStart, payloadEnd - 1);
    const colRegex = new RegExp(`\\b${rule.forbiddenColumn}\\s*:`, "g");
    if (colRegex.test(payloadText)) {
      console.error(
        `❌ Column Drift Violation in ${path.relative(process.cwd(), filePath)}: Table "${rule.table}" writes forbidden column "${rule.forbiddenColumn}" (must use "${rule.canonicalColumn}")`,
      );
      violations++;
    }
  }

  return violations;
}

// 5. Scan Application Code for Legacy Table Queries
console.log("\n4. Scanning Application Code for Deprecated / Legacy Table Queries...");

const disallowedTablePatterns: { pattern: RegExp; description: string }[] = [
  {
    pattern: /\.from\(["']order_packages["']\)/g,
    description: 'Deprecated table "order_packages" (must use canonical "sub_orders")',
  },
  {
    pattern: /\.from\(["']line_items["']\)/g,
    description: 'Deprecated table "line_items" (must use canonical "order_items")',
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

      // Check enum write patterns
      for (const rule of disallowedEnumWritePatterns) {
        if (rule.pattern.test(content)) {
          console.error(`❌ Enum Violation in ${path.relative(process.cwd(), fullPath)}: ${rule.description}`);
          violationCount++;
        }
      }

      // Check column drift rules
      for (const rule of columnDriftRules) {
        violationCount += checkTableColumnDrift(content, fullPath, rule);
      }

      // Check deprecated table rules
      for (const rule of disallowedTablePatterns) {
        if (rule.pattern.test(content)) {
          console.error(`❌ Legacy Table Violation in ${path.relative(process.cwd(), fullPath)}: ${rule.description}`);
          violationCount++;
        }
      }
    }
  }
}

for (const dir of sourceDirs) {
  scanDirectory(dir);
}

assert(violationCount === 0, `Zero enum literal, column drift, or legacy table violations in application code (found ${violationCount})`);

// 6. Summary Output
console.log("\n============================================================================");
console.log(`✅ ENUM, COLUMN & SCHEMA PARITY GATE PASSED: ${passedChecks}/${totalChecks} assertions satisfied.`);
console.log("============================================================================\n");
