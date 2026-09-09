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

const supabaseUrl =
  getEnv("VITE_SUPABASE_URL") ??
  getEnv("SUPABASE_URL") ??
  "https://placeholder-project.supabase.co";
const supabaseAnonKey =
  getEnv("VITE_SUPABASE_ANON_KEY") ?? getEnv("SUPABASE_ANON_KEY") ?? "placeholder-anon-key";

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
