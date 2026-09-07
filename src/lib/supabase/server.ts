import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
export { supabaseAdmin } from "./admin";

/**
 * Creates an SSR Supabase client using cookie headers from a server request.
 * Allows server loaders / functions to verify and extract the authenticated user.
 */
export function createServerSupabaseClient(cookieHeader?: string) {
  const env = typeof process !== "undefined" && process.env ? process.env : {};
  const supabaseUrl = env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"] ?? "https://placeholder-project.supabase.co";
  const supabaseAnonKey = env["VITE_SUPABASE_ANON_KEY"] ?? env["SUPABASE_ANON_KEY"] ?? "placeholder-anon-key";

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    },
  });
}
