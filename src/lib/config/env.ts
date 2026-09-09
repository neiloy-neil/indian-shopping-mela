import { z } from "zod";

/**
 * Validates an 11-digit Australian Business Number (ABN) using the ATO Modulo-89 algorithm.
 */
export function isValidAustralianAbn(abnStr: string): boolean {
  const clean = abnStr.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(clean)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = clean.split("").map(Number);
  digits[0] = digits[0]! - 1;

  const sum = digits.reduce((acc, digit, idx) => acc + digit * weights[idx]!, 0);
  return sum % 89 === 0;
}

/**
 * Client-safe environment schema (VITE_ prefixed).
 * Can be safely imported in browser bundles.
 */
export const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .startsWith("pk_")
    .refine((val) => !val.includes("placeholder"), {
      message: "Stripe publishable key must not be a placeholder",
    })
    .optional(),
  VITE_DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/**
 * Server-only environment schema.
 * NEVER import this into browser/client bundles.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  VERCEL_ENV: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  
  // Shipping Providers
  ENABLE_AUSPOST_SHIPPING: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  AUSPOST_API_KEY: z.string().optional(),
  AUSPOST_ACCOUNT_NUMBER: z.string().optional(),
  AUSPOST_API_SECRET: z.string().optional(),
  
  ENABLE_SENDLE_SHIPPING: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  SENDLE_API_ID: z.string().optional(),
  SENDLE_API_KEY: z.string().optional(),
  SENDLE_SANDBOX: z
    .string()
    .default("true")
    .transform((v) => v === "true"),

  // Transactional Email Provider
  ENABLE_BREVO_EMAIL: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().default("Indian Shopping Mela"),

  // Video Streaming Provider
  ENABLE_MUX_VIDEO: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  MUX_WEBHOOK_SECRET: z.string().optional(),

  // Marketplace Legal & Regulatory Constants
  MARKETPLACE_LEGAL_NAME: z.string().default("Indian Shopping Mela Pty Ltd"),
  MARKETPLACE_ABN: z
    .string()
    .default("51 824 753 556") // Canonical valid ATO Modulo-89 Australian ABN
    .refine(isValidAustralianAbn, {
      message: "MARKETPLACE_ABN must be a valid 11-digit Australian ABN passing Modulo-89",
    }),
  MARKETPLACE_COMMISSION_PERCENT: z.coerce.number().default(10.0),
});

/**
 * Strict Production Environment Schema.
 * Validates that all critical infrastructure keys are present, valid, and non-placeholder.
 */
export const productionEnvSchema = z
  .object({
    SUPABASE_URL: z
      .string()
      .url("SUPABASE_URL must be a valid URL")
      .refine((url) => !url.includes("placeholder") && !url.includes("127.0.0.1"), {
        message: "SUPABASE_URL must be a live hosted Supabase project, not a placeholder or localhost",
      }),
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(20, "SUPABASE_SERVICE_ROLE_KEY must be a valid JWT secret")
      .refine((key) => !key.includes("placeholder") && !key.includes("dev-local"), {
        message: "SUPABASE_SERVICE_ROLE_KEY must not be a placeholder",
      }),
    STRIPE_SECRET_KEY: z
      .string()
      .startsWith("sk_", "STRIPE_SECRET_KEY must start with sk_")
      .refine((key) => !key.includes("placeholder") && !key.includes("mock_stripe"), {
        message: "STRIPE_SECRET_KEY must be a real Stripe key, not a placeholder",
      }),
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with whsec_")
      .refine((key) => !key.includes("placeholder"), {
        message: "STRIPE_WEBHOOK_SECRET must be a real Stripe webhook secret",
      }),
    MARKETPLACE_LEGAL_NAME: z.string().min(3, "MARKETPLACE_LEGAL_NAME must be specified"),
    MARKETPLACE_ABN: z
      .string()
      .refine(isValidAustralianAbn, "MARKETPLACE_ABN must be a valid 11-digit Australian ABN passing Modulo-89"),
    
    // Conditional provider keys
    ENABLE_AUSPOST_SHIPPING: z.boolean().default(false),
    AUSPOST_API_KEY: z.string().optional(),
    AUSPOST_ACCOUNT_NUMBER: z.string().optional(),

    ENABLE_BREVO_EMAIL: z.boolean().default(false),
    BREVO_API_KEY: z.string().optional(),
    BREVO_SENDER_EMAIL: z.string().email().optional(),

    ENABLE_MUX_VIDEO: z.boolean().default(false),
    MUX_TOKEN_ID: z.string().optional(),
    MUX_TOKEN_SECRET: z.string().optional(),
    MUX_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // If AusPost shipping is explicitly enabled, validate required keys
    if (data.ENABLE_AUSPOST_SHIPPING) {
      if (!data.AUSPOST_API_KEY || data.AUSPOST_API_KEY.includes("placeholder")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "AUSPOST_API_KEY is required when ENABLE_AUSPOST_SHIPPING is true",
          path: ["AUSPOST_API_KEY"],
        });
      }
      if (!data.AUSPOST_ACCOUNT_NUMBER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "AUSPOST_ACCOUNT_NUMBER is required when ENABLE_AUSPOST_SHIPPING is true",
          path: ["AUSPOST_ACCOUNT_NUMBER"],
        });
      }
    }

    // If Brevo email is explicitly enabled, validate required keys
    if (data.ENABLE_BREVO_EMAIL) {
      if (!data.BREVO_API_KEY || data.BREVO_API_KEY.includes("placeholder")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "BREVO_API_KEY is required when ENABLE_BREVO_EMAIL is true",
          path: ["BREVO_API_KEY"],
        });
      }
      if (!data.BREVO_SENDER_EMAIL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "BREVO_SENDER_EMAIL is required when ENABLE_BREVO_EMAIL is true",
          path: ["BREVO_SENDER_EMAIL"],
        });
      }
    }

    // If Mux video is explicitly enabled, validate required keys
    if (data.ENABLE_MUX_VIDEO) {
      if (!data.MUX_TOKEN_ID || !data.MUX_TOKEN_SECRET || !data.MUX_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "MUX_TOKEN_ID, MUX_TOKEN_SECRET, and MUX_WEBHOOK_SECRET are required when ENABLE_MUX_VIDEO is true",
          path: ["MUX_TOKEN_ID"],
        });
      }
    }
  });

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ProductionEnv = z.infer<typeof productionEnvSchema>;

/**
 * Validates and returns client environment variables.
 */
export function getClientEnv(): ClientEnv {
  const env = {
    VITE_SUPABASE_URL:
      typeof import.meta !== "undefined" && import.meta.env
        ? import.meta.env["VITE_SUPABASE_URL"]
        : undefined,
    VITE_SUPABASE_ANON_KEY:
      typeof import.meta !== "undefined" && import.meta.env
        ? import.meta.env["VITE_SUPABASE_ANON_KEY"]
        : undefined,
    VITE_STRIPE_PUBLISHABLE_KEY:
      typeof import.meta !== "undefined" && import.meta.env
        ? import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"]
        : undefined,
    VITE_DEMO_MODE:
      typeof import.meta !== "undefined" && import.meta.env
        ? import.meta.env["VITE_DEMO_MODE"]
        : "false",
  };

  const parsed = clientEnvSchema.safeParse(env);
  if (!parsed.success) {
    console.warn("Client environment validation warnings:", parsed.error.format());
    return {
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
      VITE_STRIPE_PUBLISHABLE_KEY: env.VITE_STRIPE_PUBLISHABLE_KEY,
      VITE_DEMO_MODE: false,
    };
  }
  return parsed.data;
}

/**
 * Validates and returns server environment variables.
 * Safe fallback for local development or preview runs.
 */
export function getServerEnv(): ServerEnv {
  if (typeof process === "undefined" || !process.env) {
    throw new Error("getServerEnv called outside of Node/server runtime.");
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("Server environment validation warnings:", parsed.error.format());
    return serverEnvSchema.parse({});
  }
  return parsed.data;
}

/**
 * Validates strict production requirements against the provided or active environment.
 */
export function validateProductionEnv(envOverride?: Record<string, any>): {
  isValid: boolean;
  errors: string[];
  data?: ProductionEnv;
} {
  const source = envOverride ?? (typeof process !== "undefined" ? process.env : {});
  const parsed = productionEnvSchema.safeParse(source);

  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue) => `[${issue.path.join(".") || "ROOT"}]: ${issue.message}`,
    );
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [], data: parsed.data };
}
