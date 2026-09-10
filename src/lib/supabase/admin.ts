import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-only Supabase Admin client utilizing the SUPABASE_SERVICE_ROLE_KEY.
 * Bypasses Row-Level Security (RLS) for trusted server-side execution:
 * - Stripe / Carrier Webhooks
 * - Financial ledger settlement & payouts
 * - Transactional inventory reservations
 * - Bulk product ingestion batch commits
 *
 * WARNING: NEVER import or bundle this module into browser-facing React components!
 */

const getServiceRoleKey = (): string => {
  if (typeof process !== "undefined" && process.env) {
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (key && key.trim() !== "") return key;
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production runtime.");
  }
  return "dev-local-service-role-key";
};

const getSupabaseUrl = (): string => {
  if (typeof process !== "undefined" && process.env) {
    const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
    if (url && url.trim() !== "") return url;
  }
  if (process.env["NODE_ENV"] === "production") {
    const envKeys = Object.keys(process.env)
      .filter((k) => k.toUpperCase().includes("SUPABASE"))
      .join(",");
    throw new Error(
      `SUPABASE_URL or VITE_SUPABASE_URL is required in production runtime. [DEBUG visible SUPABASE-related keys: ${envKeys || "NONE"}]`,
    );
  }
  return "http://127.0.0.1:54321";
};

let _adminClient: SupabaseClient<Database> | null = null;

export const getSupabaseAdmin = (): SupabaseClient<Database> => {
  if (!_adminClient) {
    _adminClient = createClient<Database>(getSupabaseUrl(), getServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _adminClient;
};

export const supabaseAdmin = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
