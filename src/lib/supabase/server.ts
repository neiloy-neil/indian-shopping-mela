import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./types";
export { supabaseAdmin } from "./admin";

/**
 * Creates an SSR Supabase client using cookie headers and cookie management.
 * Allows server loaders / functions to verify and extract the authenticated user.
 */
export function createServerSupabaseClient(
  cookieHeader?: string,
  setCookieCallback?: (name: string, value: string, options: CookieOptions) => void,
) {
  const env = typeof process !== "undefined" && process.env ? process.env : {};
  const isProd =
    env["NODE_ENV"] === "production" || env["VERCEL_ENV"] === "production";

  const rawUrl = env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"];
  const rawKey = env["VITE_SUPABASE_ANON_KEY"] ?? env["SUPABASE_ANON_KEY"];

  if (isProd && (!rawUrl || !rawKey || rawUrl.includes("placeholder"))) {
    throw new Error(
      "CRITICAL: SUPABASE_URL and SUPABASE_ANON_KEY must be configured in production runtime.",
    );
  }

  const supabaseUrl = rawUrl || "http://127.0.0.1:54321";
  const supabaseAnonKey =
    rawKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dev-local-anon-key";

  // Parse cookie header into map
  const cookiesMap = new Map<string, string>();
  if (cookieHeader) {
    const pairs = cookieHeader.split(";");
    for (const pair of pairs) {
      const [k, ...v] = pair.trim().split("=");
      if (k) {
        cookiesMap.set(k, decodeURIComponent(v.join("=")));
      }
    }
  }

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Array.from(cookiesMap.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        if (setCookieCallback) {
          for (const { name, value, options } of cookiesToSet) {
            setCookieCallback(name, value, options);
          }
        }
      },
    },
  });
}
