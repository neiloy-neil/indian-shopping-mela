/**
 * Session Revocation & Security Lifecycle Management
 */

import { supabaseAdmin } from "@/lib/supabase/server";

export interface SessionRevocationResult {
  success: boolean;
  userId: string;
  revokedAt: string;
  reason: string;
}

/**
 * Revoke all active user sessions upon sensitive security changes
 * (password reset, email change, role modification, or account suspension)
 */
export async function revokeUserSessions(
  userId: string,
  reason: "PASSWORD_CHANGED" | "ROLE_CHANGED" | "ACCOUNT_SUSPENDED" | "SECURITY_BREACH_SUSPECTED" | "MANUAL_ADMIN_REVOCATION"
): Promise<SessionRevocationResult> {
  const revokedAt = new Date().toISOString();

  // Invalidate Supabase Auth sessions via admin API
  try {
    const { error } = await (supabaseAdmin.auth.admin as any).signOut(userId, "all");
    if (error) {
      console.warn(`[Security] Could not complete admin auth signout for user ${userId}: ${error.message}`);
    }
  } catch (err: any) {
    console.warn(`[Security] Exception during session signOut: ${err.message}`);
  }

  // Record audit log for security accountability
  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "USER_SESSIONS_REVOKED",
    entity_type: "USER_SESSION",
    entity_id: userId,
    new_data: { reason, revokedAt },
  });

  return {
    success: true,
    userId,
    revokedAt,
    reason,
  };
}
