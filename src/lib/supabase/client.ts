import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const getEnv = (key: string): string | undefined => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  return undefined;
};

const rawUrl = getEnv("VITE_SUPABASE_URL") ?? getEnv("SUPABASE_URL");
const rawKey = getEnv("VITE_SUPABASE_ANON_KEY") ?? getEnv("SUPABASE_ANON_KEY");

const isProd =
  getEnv("NODE_ENV") === "production" ||
  getEnv("VERCEL_ENV") === "production";

if (isProd && (!rawUrl || !rawKey || rawUrl.includes("placeholder"))) {
  console.error(
    "CRITICAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in production environment.",
  );
}

const supabaseUrl = rawUrl || "http://127.0.0.1:54321";
const supabaseAnonKey = rawKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dev-local-anon-key";

/**
 * Public Supabase client for browser-side queries.
 * Respects PostgreSQL Row-Level Security (RLS) policies.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
