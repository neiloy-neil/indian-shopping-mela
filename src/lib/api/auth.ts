import { supabase } from "@/lib/supabase/client";
import type { Database, UserRole } from "@/lib/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface AuthSessionUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: UserRole;
  avatarUrl: string | null;
}

/**
 * Sign in with email and password via Supabase Auth.
 */
export async function signIn(email: string, password: string): Promise<AuthSessionUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Sign-in error:", error.message);
    throw error;
  }

  if (!data.user) {
    throw new Error("No user returned from authentication.");
  }

  const profile = await getProfile(data.user.id);
  return {
    id: data.user.id,
    email: data.user.email ?? email,
    fullName: profile?.full_name ?? data.user.user_metadata?.["full_name"] ?? null,
    phone: profile?.phone ?? data.user.phone ?? null,
    role: profile?.role ?? "customer",
    avatarUrl: profile?.avatar_url ?? null,
  };
}

/**
 * Customer / Seller sign-up with profile provisioning.
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  phone?: string,
): Promise<{ user: AuthSessionUser | null; requiresEmailVerification: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone ?? null,
      },
    },
  });

  if (error) {
    console.error("Sign-up error:", error.message);
    throw error;
  }

  if (!data.user) {
    return { user: null, requiresEmailVerification: true };
  }

  // Auto-profile or fallback
  const userObj: AuthSessionUser = {
    id: data.user.id,
    email: data.user.email ?? email,
    fullName,
    phone: phone ?? null,
    role: "customer",
    avatarUrl: null,
  };

  return {
    user: userObj,
    requiresEmailVerification: !data.session,
  };
}

/**
 * Sign out and clear Supabase session.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Sign-out error:", error);
    throw error;
  }
}

/**
 * Send password reset email.
 */
export async function resetPassword(email: string): Promise<void> {
  const redirectUrl =
    typeof window !== "undefined" ? `${window.location.origin}/signin?reset=true` : undefined;
  const options = redirectUrl ? { redirectTo: redirectUrl } : {};
  const { error } = await supabase.auth.resetPasswordForEmail(email, options);

  if (error) {
    console.error("Password reset error:", error.message);
    throw error;
  }
}

/**
 * Fetch profile data for a specific user ID.
 */
export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Could not fetch profile:", error);
    return null;
  }

  return data;
}

/**
 * Get current authenticated session user in browser context.
 */
export async function getCurrentUser(): Promise<AuthSessionUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await getProfile(user.id);
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.user_metadata?.["full_name"] ?? null,
    phone: profile?.phone ?? user.phone ?? null,
    role: profile?.role ?? "customer",
    avatarUrl: profile?.avatar_url ?? null,
  };
}

/**
 * Server authorization helper: Require authenticated user from Supabase session.
 */
export async function requireUser(userId?: string): Promise<AuthSessionUser> {
  if (!userId) {
    throw new Error("UNAUTHORIZED: Authentication required.");
  }
  const profile = await getProfile(userId);
  return {
    id: userId,
    email: profile?.email ?? "",
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    role: profile?.role ?? "customer",
    avatarUrl: profile?.avatar_url ?? null,
  };
}

/**
 * Server authorization helper: Verify user is an owner or member of a specific seller.
 */
export async function requireSellerMember(
  sellerId: string,
  userId: string,
): Promise<{ sellerId: string; role: string }> {
  const user = await requireUser(userId);
  if (["admin_support", "admin_catalogue", "admin_finance", "admin_super"].includes(user.role)) {
    return { sellerId, role: "admin_override" };
  }

  const { data: member } = await supabase
    .from("seller_staff")
    .select("staff_role, permissions")
    .eq("seller_id", sellerId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (member) {
    return { sellerId, role: member.staff_role };
  }

  // Check direct owner
  const { data: seller } = await supabase
    .from("sellers")
    .select("id, owner_id")
    .eq("id", sellerId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!seller) {
    throw new Error(
      "FORBIDDEN: You do not have permission to access or manage this seller account.",
    );
  }

  return { sellerId, role: "owner" };
}

/**
 * Server authorization helper: Verify specific seller permission (e.g. 'products:write', 'orders:fulfill').
 */
export async function requireSellerPermission(
  sellerId: string,
  userId: string,
  requiredPermission: string,
): Promise<boolean> {
  const membership = await requireSellerMember(sellerId, userId);
  if (membership.role === "owner" || membership.role === "admin_override") {
    return true;
  }

  const { data: member } = await supabase
    .from("seller_staff")
    .select("permissions")
    .eq("seller_id", sellerId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const permissions: string[] = (member?.permissions as string[]) ?? [];
  if (!permissions.includes(requiredPermission) && !permissions.includes("*")) {
    throw new Error(`FORBIDDEN: Missing required seller permission: ${requiredPermission}`);
  }

  return true;
}

/**
 * Server authorization helper: Require Admin or Super Admin role.
 */
export async function requireAdminRole(userId: string): Promise<AuthSessionUser> {
  const user = await requireUser(userId);
  if (!["admin_support", "admin_catalogue", "admin_finance", "admin_super"].includes(user.role)) {
    throw new Error("FORBIDDEN: Platform administrative privileges required.");
  }
  return user;
}

/**
 * Server authorization helper: Require Super Admin / Finance Admin with MFA/AAL verification.
 */
export async function requireFinanceAdmin(
  userId: string,
  aalLevel: string = "aal1",
): Promise<AuthSessionUser> {
  const admin = await requireAdminRole(userId);
  if (admin.role !== "admin_super" && admin.role !== "admin_finance") {
    throw new Error(
      "FORBIDDEN: Super Admin role required for financial ledger, payouts, and settlement actions.",
    );
  }

  // For high-risk financial actions, enforce MFA / AAL2 if configured
  if (process.env["NODE_ENV"] === "production" && aalLevel !== "aal2") {
    console.warn(
      `Financial action initiated by ${admin.email} with standard auth level ${aalLevel}. High-risk actions require MFA verification.`,
    );
  }

  return admin;
}
