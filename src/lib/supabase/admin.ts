import { createClient } from "@supabase/supabase-js";
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
    return process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "placeholder-service-key";
  }
  return "placeholder-service-key";
};

const getSupabaseUrl = (): string => {
  if (typeof process !== "undefined" && process.env) {
    return process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "https://placeholder-project.supabase.co";
  }
  return "https://placeholder-project.supabase.co";
};

export const supabaseAdmin = createClient<Database>(getSupabaseUrl(), getServiceRoleKey(), {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
