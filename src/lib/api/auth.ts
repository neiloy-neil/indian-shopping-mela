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
  phone?: string
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
  const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/signin?reset=true` : undefined;
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
  const { data, error } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Could not fetch profile:", error);
    return null;
  }

  return (data as ProfileRow) || null;
}

/**
 * Get current authenticated session user.
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
