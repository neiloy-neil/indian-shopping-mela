/**
 * ============================================================================
 * PRODUCTION ENVIRONMENT VALIDATION & PLACEHOLDER AUDIT (Prompt 10)
 * Run: npx tsx scripts/check-production-env.ts
 *
 * Verifies:
 * 1. Strict production env schema validation (Zod)
 * 2. Fail-closed behavior on missing or placeholder Supabase / Stripe credentials
 * 3. ATO Modulo-89 mathematical validation on marketplace ABN
 * 4. Conditional provider gating (AusPost, Sendle, Brevo, Mux)
 * 5. Codebase scan ensuring zero hardcoded placeholder secrets or fake credentials
 * ============================================================================
 */

import * as fs from "fs";
import * as path from "path";
import {
  productionEnvSchema,
  validateProductionEnv,
  isValidAustralianAbn,
} from "../src/lib/config/env";

console.log("============================================================================");
console.log("ISM PRODUCTION ENVIRONMENT & PLACEHOLDER AUDIT GATE (Prompt 10)");
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

// 1. Validate ATO Modulo-89 ABN Checksum
console.log("\n1. Testing ATO Modulo-89 ABN Mathematical Algorithm...");
assert(isValidAustralianAbn("51 824 753 556"), "Valid ABN '51 824 753 556' passes Modulo-89");
assert(!isValidAustralianAbn("12 345 678 901"), "Placeholder ABN '12 345 678 901' is strictly rejected");
assert(!isValidAustralianAbn("00 000 000 000"), "Invalid ABN '00 000 000 000' is strictly rejected");
assert(!isValidAustralianAbn("12345"), "Short ABN '12345' is strictly rejected");

// 2. Validate Production Schema Rejections on Incomplete / Placeholder Configs
console.log("\n2. Testing Strict Production Environment Schema Rejections...");

const emptyValidation = validateProductionEnv({});
assert(!emptyValidation.isValid, "Empty environment fails production validation");
assert(
  emptyValidation.errors.some((e) => e.includes("SUPABASE_URL")),
  "Missing SUPABASE_URL error reported",
);
assert(
  emptyValidation.errors.some((e) => e.includes("STRIPE_SECRET_KEY")),
  "Missing STRIPE_SECRET_KEY error reported",
);

const placeholderValidation = validateProductionEnv({
  SUPABASE_URL: "https://placeholder-project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
  STRIPE_SECRET_KEY: "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET: "whsec_placeholder",
  MARKETPLACE_LEGAL_NAME: "Indian Shopping Mela Pty Ltd",
  MARKETPLACE_ABN: "12 345 678 901",
});
assert(!placeholderValidation.isValid, "Placeholder credentials fail production validation");
assert(
  placeholderValidation.errors.some((e) => e.includes("SUPABASE_URL")),
  "Placeholder SUPABASE_URL error reported",
);
assert(
  placeholderValidation.errors.some((e) => e.includes("STRIPE_SECRET_KEY")),
  "Placeholder STRIPE_SECRET_KEY error reported",
);
assert(
  placeholderValidation.errors.some((e) => e.includes("MARKETPLACE_ABN")),
  "Placeholder ABN error reported",
);

// 3. Validate Valid Production Configuration
console.log("\n3. Testing Valid Production Configuration Acceptance...");

const validProdConfig = {
  SUPABASE_URL: "https://ism-prod.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod-service-role-secret-token",
  STRIPE_SECRET_KEY: "sk_live_51ISMProductionStripeSecretKey998877",
  STRIPE_WEBHOOK_SECRET: "whsec_real_production_webhook_secret_998877",
  MARKETPLACE_LEGAL_NAME: "Indian Shopping Mela Pty Ltd",
  MARKETPLACE_ABN: "51 824 753 556",
};

const validResult = validateProductionEnv(validProdConfig);
assert(validResult.isValid, "Valid production configuration passes all schema assertions");
assert(validResult.errors.length === 0, "Zero errors on valid production configuration");

// 4. Test Conditional Provider Flags
console.log("\n4. Testing Conditional Provider Configuration Gates...");

// 4.1 AusPost Shipping
const auspostDisabled = validateProductionEnv({
  ...validProdConfig,
  ENABLE_AUSPOST_SHIPPING: false,
});
assert(auspostDisabled.isValid, "Disabled AusPost shipping requires no API keys");

const auspostEnabledMissingKey = validateProductionEnv({
  ...validProdConfig,
  ENABLE_AUSPOST_SHIPPING: true,
});
assert(!auspostEnabledMissingKey.isValid, "Enabled AusPost shipping requires AUSPOST_API_KEY");

const auspostEnabledValid = validateProductionEnv({
  ...validProdConfig,
  ENABLE_AUSPOST_SHIPPING: true,
  AUSPOST_API_KEY: "real_auspost_api_key_998877",
  AUSPOST_ACCOUNT_NUMBER: "12345678",
});
assert(auspostEnabledValid.isValid, "Enabled AusPost shipping with valid keys passes validation");

// 4.2 Brevo Transactional Email
const brevoDisabled = validateProductionEnv({
  ...validProdConfig,
  ENABLE_BREVO_EMAIL: false,
});
assert(brevoDisabled.isValid, "Disabled Brevo email requires no API keys");

const brevoEnabledMissingKey = validateProductionEnv({
  ...validProdConfig,
  ENABLE_BREVO_EMAIL: true,
});
assert(!brevoEnabledMissingKey.isValid, "Enabled Brevo email requires BREVO_API_KEY & SENDER_EMAIL");

const brevoEnabledValid = validateProductionEnv({
  ...validProdConfig,
  ENABLE_BREVO_EMAIL: true,
  BREVO_API_KEY: "xkeysib-real-brevo-api-key-998877",
  BREVO_SENDER_EMAIL: "support@indianshoppingmela.com.au",
});
assert(brevoEnabledValid.isValid, "Enabled Brevo email with valid keys passes validation");

// 5. Codebase Scan for Forbidden Placeholder Secret Strings
console.log("\n5. Scanning Codebase for Forbidden Placeholder Secret Strings...");

const forbiddenPlaceholderPatterns = [
  /["']pk_test_placeholder["']/g,
  /["']placeholder-service-role-key["']/g,
  /["']placeholder-project\.supabase\.co["']/g,
];

const sourceDirs = [
  path.resolve(process.cwd(), "src/lib"),
  path.resolve(process.cwd(), "src/routes"),
];

let leakCount = 0;

function scanDir(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const pattern of forbiddenPlaceholderPatterns) {
        if (pattern.test(content)) {
          console.error(`❌ Found placeholder string match in ${path.relative(process.cwd(), fullPath)}: ${pattern}`);
          leakCount++;
        }
      }
    }
  }
}

for (const dir of sourceDirs) {
  scanDir(dir);
}

assert(leakCount === 0, `Zero forbidden placeholder secret strings in source code (found ${leakCount})`);

// Summary Output
console.log("\n============================================================================");
console.log(`✅ PRODUCTION ENVIRONMENT GATE PASSED: ${passedChecks}/${totalChecks} assertions satisfied.`);
console.log("============================================================================\n");
