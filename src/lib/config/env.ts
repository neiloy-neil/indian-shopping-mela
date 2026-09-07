import { z } from "zod";

/**
 * Client-safe environment schema (VITE_ prefixed).
 * Can be safely imported in browser bundles.
 */
export const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  VITE_DEMO_MODE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

/**
 * Server-only environment schema.
 * NEVER import this into browser/client bundles.
 */
export const serverEnvSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  AUSPOST_API_KEY: z.string().optional(),
  AUSPOST_ACCOUNT_NUMBER: z.string().optional(),
  AUSPOST_API_SECRET: z.string().optional(),
  SENDLE_API_ID: z.string().optional(),
  SENDLE_API_KEY: z.string().optional(),
  SENDLE_SANDBOX: z.string().default("true").transform((v) => v === "true"),
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional(),
  BREVO_SENDER_NAME: z.string().default("Indian Shopping Mela"),
  MARKETPLACE_LEGAL_NAME: z.string().default("Indian Shopping Mela Pty Ltd"),
  MARKETPLACE_ABN: z.string().default("12 345 678 901"),
  MARKETPLACE_COMMISSION_PERCENT: z.coerce.number().default(12.0),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates and returns client environment variables.
 */
export function getClientEnv(): ClientEnv {
  const env = {
    VITE_SUPABASE_URL: typeof import.meta !== "undefined" && import.meta.env ? import.meta.env["VITE_SUPABASE_URL"] : undefined,
    VITE_SUPABASE_ANON_KEY: typeof import.meta !== "undefined" && import.meta.env ? import.meta.env["VITE_SUPABASE_ANON_KEY"] : undefined,
    VITE_STRIPE_PUBLISHABLE_KEY: typeof import.meta !== "undefined" && import.meta.env ? import.meta.env["VITE_STRIPE_PUBLISHABLE_KEY"] : undefined,
    VITE_DEMO_MODE: typeof import.meta !== "undefined" && import.meta.env ? import.meta.env["VITE_DEMO_MODE"] : "false",
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
