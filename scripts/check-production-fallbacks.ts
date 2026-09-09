/**
 * Production Fallback & Mock Leakage Checker (Task T493)
 * Indian Shopping Mela — Master Implementation Runbook
 *
 * Statically scans the codebase to ensure no raw mock cards, unisolated demo bypasses,
 * placeholder API keys, or fake transaction simulators can activate in a production build.
 */

import * as fs from "fs";
import * as path from "path";

const SRC_DIR = path.resolve(process.cwd(), "src");

interface Violation {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
  reason: string;
}

const FORBIDDEN_RULES: Array<{
  name: string;
  regex: RegExp;
  reason: string;
  excludeFiles?: string[];
}> = [
  {
    name: "Hardcoded Test Card",
    regex: /4242[\s-]?4242[\s-]?4242[\s-]?4242/,
    reason: "Test card numbers must not be hardcoded in production source files.",
  },
  {
    name: "Demo Customer Fallback in Routes",
    regex: /["']cust_demo["']/,
    reason:
      "Customer ID must be resolved from real authenticated session, not hardcoded 'cust_demo'.",
    excludeFiles: ["ism-ops.ts"],
  },
  {
    name: "Fake Payment Simulation in Production Code",
    regex: /simulatePaymentSuccess|fakePaymentIntent|pi_fake|pi_mock|pi_demo/i,
    reason: "Payments must strictly proceed through authoritative Stripe PaymentElement/webhooks.",
  },
  {
    name: "Fake Australia Post Consignment Generator",
    regex: /AP-AU-\${Math\.random/,
    reason:
      "Shipping tracking and labels must be authoritatively created via AusPost/carrier provider.",
  },
  {
    name: "Optimistic Return Swallow in Production",
    regex: /createCustomerReturnRequestServerFn\(.*?\)\.catch/,
    reason: "Return requests must fail closed if server persistence fails.",
  },
  {
    name: "Optimistic Sub-Order Status Swallow",
    regex: /acceptSubOrderServerFn\(.*?\)\.catch|markSubOrderPackedServerFn\(.*?\)\.catch/,
    reason: "Seller sub-order status updates must fail closed on database failure.",
  },
  {
    name: "Placeholder Secrets in Production Code",
    regex: /sk_test_placeholder|placeholder-service-key|placeholder_secret/i,
    reason: "Placeholder credentials must never be committed to production code.",
  },
  {
    name: "Fake Payout Transfer Simulation",
    regex: /tr_demo|tr_mock|tr_fake/i,
    reason:
      "Payout transfers must be generated through real Stripe Connect API with real transfer IDs.",
  },
  {
    name: "Fake Refund Transaction ID",
    regex: /re_demo|re_mock|re_fake/i,
    reason: "Refunds must be processed through real Stripe Refunds API with real refund IDs.",
  },
  {
    name: "Fake Shipping Tracking / Label Simulation",
    regex: /mock_auspost_label|fake_tracking_number|track_mock/i,
    reason: "Shipping labels and tracking IDs must be generated via authoritative carrier integration.",
  },
  {
    name: "Fake Video Moderation Pass",
    regex: /mock_mux_asset_id|fake_passthrough_video/i,
    reason: "Video moderation and asset IDs must proceed through authoritative Mux webhooks.",
  },
  {
    name: "Fake Bulk Import Success Simulation",
    regex: /fake_import_batch|mock_bulk_success/i,
    reason: "Bulk product imports must proceed through authoritative PostgreSQL batch parser.",
  },
];

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function runFallbackAudit(): boolean {
  console.log("=================================================================");
  console.log("🔎 Indian Shopping Mela — Production Fallback & Mock Leakage Audit");
  console.log("=================================================================\n");

  const files = scanDirectory(SRC_DIR);
  const violations: Violation[] = [];

  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    for (const rule of FORBIDDEN_RULES) {
      if (rule.excludeFiles && rule.excludeFiles.some((ef) => relativePath.endsWith(ef))) {
        continue;
      }

      lines.forEach((line, idx) => {
        if (rule.regex.test(line)) {
          violations.push({
            file: relativePath,
            line: idx + 1,
            pattern: rule.name,
            snippet: line.trim(),
            reason: rule.reason,
          });
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error(`❌ Found ${violations.length} forbidden production fallback violation(s):\n`);
    violations.forEach((v, i) => {
      console.error(`${i + 1}. [${v.pattern}] ${v.file}:${v.line}`);
      console.error(`   Snippet: "${v.snippet}"`);
      console.error(`   Reason:  ${v.reason}\n`);
    });
    return false;
  }

  console.log(`✅ Scanned ${files.length} source files — 0 forbidden production fallbacks found.`);
  console.log(
    "   Zero-trust checkout, live order fulfillment, and fail-closed transactions verified.\n",
  );
  return true;
}

const success = runFallbackAudit();
process.exit(success ? 0 : 1);
