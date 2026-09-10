import { getRequestHeader } from "@tanstack/react-start/server";
import { createServerSupabaseClient, supabaseAdmin } from "@/lib/supabase/server";
import type { AuthSessionUser } from "./auth";
import type { UserRole } from "@/lib/supabase/types";

const ADMIN_ROLES: UserRole[] = [
  "admin_support",
  "admin_catalogue",
  "admin_finance",
  "admin_super",
];
const FINANCE_ROLES: UserRole[] = ["admin_finance", "admin_super"];

/**
 * Cryptographically verifies the caller's identity from their session cookie via
 * Supabase Auth (`auth.getUser()` validates the JWT server-side against Supabase,
 * it does not just decode an unverified claim). Every admin/finance server function
 * MUST use this instead of trusting a client-supplied userId/sellerId/customerId —
 * a client can put any value it wants into a request payload.
 */
export async function getVerifiedSessionUserId(): Promise<string | null> {
  const cookieHeader = getRequestHeader("cookie");
  const client = createServerSupabaseClient(cookieHeader);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

async function loadSessionUser(userId: string): Promise<AuthSessionUser> {
  const { data: profile } = await (supabaseAdmin.from("profiles") as any)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return {
    id: userId,
    email: profile?.email ?? "",
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: (profile?.role as UserRole) ?? "customer",
    avatarUrl: profile?.avatar_url ?? null,
  };
}

/**
 * Require a verified, authenticated session belonging to a platform admin role.
 * Throws on missing/invalid session or insufficient role — callers should let
 * this error propagate to the client as a rejected request.
 */
export async function requireAdminSession(): Promise<AuthSessionUser> {
  const userId = await getVerifiedSessionUserId();
  if (!userId) {
    throw new Error("UNAUTHORIZED: Authentication required.");
  }
  const user = await loadSessionUser(userId);
  if (!ADMIN_ROLES.includes(user.role)) {
    throw new Error("FORBIDDEN: Platform administrative privileges required.");
  }
  return user;
}

/**
 * Require a verified admin_finance / admin_super session for money-moving or
 * marketplace-config-mutating actions (payouts, commission/SLA settings, role changes).
 */
export async function requireFinanceAdminSession(): Promise<AuthSessionUser> {
  const user = await requireAdminSession();
  if (!FINANCE_ROLES.includes(user.role)) {
    throw new Error(
      "FORBIDDEN: Super Admin or Finance Admin role required for financial and configuration actions.",
    );
  }
  return user;
}

/**
 * Require the verified caller to be the seller's owner, an active seller_staff member
 * with the given permission, or a platform admin. Uses supabaseAdmin (service role) for
 * the membership/permission lookup — auth.ts's requireSellerMember/requireSellerPermission
 * query through the anon client, which has no session attached server-side and so gets
 * blocked by RLS regardless of whether the caller is actually authorized. Returns the
 * verified caller's user id.
 */
export async function requireVerifiedSellerAccess(
  sellerId: string,
  requiredPermission?: string,
): Promise<string> {
  const userId = await getVerifiedSessionUserId();
  if (!userId) {
    throw new Error("UNAUTHORIZED: Authentication required.");
  }

  const user = await loadSessionUser(userId);
  if (ADMIN_ROLES.includes(user.role)) {
    return userId;
  }

  const { data: seller } = await (supabaseAdmin.from("sellers") as any)
    .select("id, owner_id")
    .eq("id", sellerId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (seller) {
    return userId;
  }

  const { data: staffRow } = await (supabaseAdmin.from("seller_staff") as any)
    .select("permissions")
    .eq("seller_id", sellerId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!staffRow) {
    throw new Error("FORBIDDEN: You do not have permission to manage this seller account.");
  }

  if (requiredPermission) {
    const permissions: string[] = staffRow.permissions ?? [];
    if (!permissions.includes(requiredPermission) && !permissions.includes("*")) {
      throw new Error(`FORBIDDEN: Missing required seller permission: ${requiredPermission}`);
    }
  }

  return userId;
}
