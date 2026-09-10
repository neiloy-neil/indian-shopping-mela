import crypto from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  requireVerifiedSellerAccess,
  getVerifiedSessionUserId,
  requireFinanceAdminSession,
} from "./server-auth";
import { sendSellerStaffInviteEmail } from "./notifications";
import type { Database, SellerStatus, Address } from "@/lib/supabase/types";

export type SellerRow = Database["public"]["Tables"]["sellers"]["Row"];
export type SellerDocumentRow = Database["public"]["Tables"]["seller_documents"]["Row"];

export interface SellerMemberRow {
  id: string;
  seller_id: string;
  user_id: string;
  role: string;
  permissions: any;
  created_at: string;
}

export interface SaveSellerOnboardingInput {
  userId?: string | undefined;
  /** @deprecated Use legalName instead — maps to the canonical sellers.legal_name column */
  storeName?: string | undefined;
  legalName?: string | undefined;
  businessName: string;
  businessType?: string | undefined;
  abn: string;
  phone?: string | undefined;
  email?: string | undefined;
  description?: string | undefined;
  slug: string;
  dispatchAddress: Address;
  returnAddress: Address;
  termsAcceptedVersion?: string | undefined;
  status?: SellerStatus | undefined;
}

/**
 * Australian Business Number (ABN) Mathematical Checksum Validator
 * Algorithm:
 * 1. Subtract 1 from the first digit
 * 2. Multiply each of the 11 digits by its weighting factor: [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
 * 3. Sum the resulting products
 * 4. Divide sum by 89; if remainder is 0, the ABN is valid.
 */
export function validateAustralianAbn(abn: string): {
  valid: boolean;
  formatted: string;
  reason?: string | undefined;
} {
  const cleanAbn = abn.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(cleanAbn)) {
    return { valid: false, formatted: cleanAbn, reason: "ABN must be exactly 11 numeric digits." };
  }

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleanAbn.split("").map(Number);
  digits[0] = (digits[0] ?? 0) - 1;

  const sum = digits.reduce((acc, digit, idx) => acc + digit * (weights[idx] ?? 0), 0);
  const isValid = sum % 89 === 0;

  const formatted = `${cleanAbn.slice(0, 2)} ${cleanAbn.slice(2, 5)} ${cleanAbn.slice(5, 8)} ${cleanAbn.slice(8, 11)}`;

  return {
    valid: isValid,
    formatted,
    reason: isValid ? undefined : "ABN checksum calculation failed.",
  };
}

/**
 * Valid Seller Onboarding & Moderation State Machine Transitions
 */
export const ALLOWED_SELLER_TRANSITIONS: Record<SellerStatus, SellerStatus[]> = {
  DRAFT: ["DRAFT", "SUBMITTED"],
  SUBMITTED: ["SUBMITTED", "UNDER_REVIEW", "DRAFT"],
  UNDER_REVIEW: ["UNDER_REVIEW", "APPROVED", "REJECTED", "INFO_REQUIRED"],
  INFO_REQUIRED: ["INFO_REQUIRED", "SUBMITTED", "DRAFT", "UNDER_REVIEW"],
  APPROVED: ["APPROVED", "SUSPENDED"],
  REJECTED: ["REJECTED", "UNDER_REVIEW", "DRAFT"],
  SUSPENDED: ["SUSPENDED", "APPROVED"],
};

export function isValidSellerStatusTransition(from: string, to: string): boolean {
  const normFrom = (from ?? "").toUpperCase() as SellerStatus;
  const normTo = (to ?? "").toUpperCase() as SellerStatus;
  if (normFrom === normTo) return true;
  return ALLOWED_SELLER_TRANSITIONS[normFrom]?.includes(normTo) ?? false;
}

/**
 * Server Function: Admin review of seller onboarding application
 */
export const adminReviewSellerApplicationServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sellerId: string;
      newStatus: SellerStatus;
      reviewerNote?: string | undefined;
      commissionRate?: number | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    // Seller approval + commission-rate changes are platform-admin actions — this had no
    // authorization check at all, so any caller could approve/reject/suspend any seller
    // or change their commission rate.
    const admin = await requireFinanceAdminSession();

    const { data: seller, error: fetchErr } = await (supabaseAdmin as any)
      .from("sellers")
      .select("id, status, owner_id")
      .eq("id", data.sellerId)
      .single();

    if (fetchErr || !seller) {
      throw new Error(`Seller not found: ${fetchErr?.message}`);
    }

    const currentStatus = seller.status as SellerStatus;
    if (!isValidSellerStatusTransition(currentStatus, data.newStatus)) {
      throw new Error(
        `Invalid seller status transition from ${currentStatus} to ${data.newStatus}`,
      );
    }

    const updatePayload: any = {
      status: data.newStatus,
      updated_at: new Date().toISOString(),
    };

    if (data.commissionRate !== undefined) {
      updatePayload.commission_rate = data.commissionRate;
    }

    const { error: updateErr } = await (supabaseAdmin as any)
      .from("sellers")
      .update(updatePayload)
      .eq("id", data.sellerId);

    if (updateErr) {
      throw new Error(`Failed to update seller review status: ${updateErr.message}`);
    }

    await (supabaseAdmin as any).from("audit_logs").insert({
      actor_id: admin.id,
      actor_role: admin.role,
      action: `SELLER_STATUS_${data.newStatus.toUpperCase()}`,
      entity_type: "SELLER",
      entity_id: data.sellerId,
      after_data: {
        previousStatus: currentStatus,
        newStatus: data.newStatus,
        reviewerNote: data.reviewerNote,
        commissionRate: data.commissionRate,
      },
    });

    return { success: true, sellerId: data.sellerId, status: data.newStatus };
  });

/**
 * Server Function: Save or update seller onboarding draft
 */
export const saveSellerOnboardingServerFn = createServerFn({ method: "POST" })
  .validator((data: SaveSellerOnboardingInput) => data)
  .handler(async ({ data }) => {
    const verifiedUserId = await getVerifiedSessionUserId();
    if (!verifiedUserId) {
      throw new Error("UNAUTHORIZED: Sign in to save your seller onboarding details.");
    }
    // The verified session is the only trustworthy owner id — a client-supplied userId
    // would let anyone create (or, via the slug-collision upsert below) take over an
    // existing seller row under an arbitrary owner.
    return saveSellerOnboardingTransactional({ ...data, userId: verifiedUserId });
  });

export async function saveSellerOnboardingTransactional(
  payload: SaveSellerOnboardingInput,
): Promise<SellerRow> {
  const cleanSlug = payload.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const targetStatus: SellerStatus = payload.status === "SUBMITTED" ? "SUBMITTED" : "DRAFT";

  // Check existing status to prevent self-approving or invalid jumps
  const { data: existingSeller } = await (supabaseAdmin as any)
    .from("sellers")
    .select("id, status, owner_id")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (existingSeller) {
    const currentStatus = existingSeller.status as SellerStatus;
    if (!isValidSellerStatusTransition(currentStatus, targetStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${targetStatus}`);
    }
    // A slug collision with a seller owned by someone else must never fall through to the
    // upsert below — that would silently edit another seller's live business details.
    if (payload.userId && existingSeller.owner_id && existingSeller.owner_id !== payload.userId) {
      throw new Error("This store URL is already taken by another seller.");
    }
  }

  // 1. Upsert Seller Row
  const { data: seller, error: sellerError } = await (supabaseAdmin as any)
    .from("sellers")
    .upsert(
      {
        owner_id: payload.userId ?? "00000000-0000-0000-0000-000000000001",
        legal_name: payload.legalName || payload.businessName,
        business_name: payload.businessName,
        slug: cleanSlug,
        abn: payload.abn,
        about_text: payload.description ?? null,
        status: targetStatus,
        dispatch_address: payload.dispatchAddress ?? {},
        return_address: payload.returnAddress ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select()
    .single();

  if (sellerError || !seller) {
    throw new Error(`Failed to save seller profile: ${sellerError?.message}`);
  }

  // 2. Ensure seller owner membership is registered
  if (payload.userId) {
    await (supabaseAdmin as any).from("seller_staff").upsert(
      {
        seller_id: seller.id,
        user_id: payload.userId,
        staff_role: "owner",
        permissions: ["all"],
        is_active: true,
      },
      { onConflict: "seller_id,user_id" },
    );
  }

  // 3. Update dispatch_address JSONB in sellers row
  if (payload.dispatchAddress) {
    await (supabaseAdmin as any)
      .from("sellers")
      .update({
        dispatch_address: payload.dispatchAddress,
      })
      .eq("id", seller.id);
  }

  // 4. Update return_address JSONB in sellers row
  if (payload.returnAddress) {
    await (supabaseAdmin as any)
      .from("sellers")
      .update({
        return_address: payload.returnAddress,
      })
      .eq("id", seller.id);
  }

  return seller as unknown as SellerRow;
}

/**
 * Server Function: Upload or record seller verification document metadata
 */
export const uploadSellerDocumentMetadataServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sellerId: string;
      documentType:
        "abn_certificate" | "identity_proof" | "business_registration" | "bank_statement";
      fileUrl: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireVerifiedSellerAccess(data.sellerId, "documents:manage");

    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(data.mimeType)) {
      throw new Error(`Invalid file type: ${data.mimeType}. Only PDF and images are allowed.`);
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit
    if (data.fileSize > maxSizeBytes) {
      throw new Error(`File size exceeds the 10MB limit.`);
    }

    // Real columns are file_path/file_size_bytes and the enum is uppercase
    // ('PENDING'/'VERIFIED'/'REJECTED'/'EXPIRED') — not file_url/file_size/"pending".
    const { data: doc, error } = await (supabaseAdmin as any)
      .from("seller_documents")
      .insert({
        seller_id: data.sellerId,
        document_type: data.documentType,
        file_path: data.fileUrl,
        file_name: data.fileName,
        file_size_bytes: data.fileSize,
        mime_type: data.mimeType,
        status: "PENDING",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record seller document: ${error.message}`);
    }

    await (supabaseAdmin as any).from("audit_logs").insert({
      action: "SELLER_DOCUMENT_UPLOADED",
      entity_type: "SELLER_DOCUMENT",
      entity_id: doc.id,
      after_data: {
        sellerId: data.sellerId,
        documentType: data.documentType,
        fileName: data.fileName,
      },
    });

    return doc as SellerDocumentRow;
  });

/**
 * Server Function: Record immutable seller agreement acceptance version
 */
export const recordSellerAgreementAcceptanceServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sellerId: string;
      agreementType: "seller_master_agreement" | "marketplace_terms" | "prohibited_items_policy";
      version: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    // Agreement acceptance is a legal act tied to a specific person — it must be the
    // verified caller, and they must actually be this seller's owner/staff (or an admin).
    const verifiedUserId = await requireVerifiedSellerAccess(data.sellerId, "documents:manage");

    const { data: agreement, error } = await (supabaseAdmin as any)
      .from("seller_agreements")
      .insert({
        seller_id: data.sellerId,
        user_id: verifiedUserId,
        agreement_type: data.agreementType,
        version: data.version,
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.warn("Seller agreement note:", error.message);
    }

    await (supabaseAdmin as any).from("audit_logs").insert({
      actor_id: verifiedUserId,
      action: "SELLER_AGREEMENT_ACCEPTED",
      entity_type: "SELLER_AGREEMENT",
      entity_id: data.sellerId,
      after_data: { agreementType: data.agreementType, version: data.version },
    });

    return { success: true, agreementId: agreement?.id };
  });

/**
 * Fetch the seller profile for the currently logged-in user.
 */
export async function getCurrentSellerProfile(): Promise<SellerRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // public.sellers has no user_id column — the owning user is `owner_id`.
  const { data, error } = await (supabase.from("sellers") as any)
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching seller profile:", error);
    return null;
  }
  return (data as unknown as SellerRow) || null;
}

/**
 * Seller-facing routes across this app pass the authenticated user's auth.users.id as
 * "sellerId" (e.g. `sellerId: user?.id` in sell.index.tsx, sell.bulk-stock.tsx). But
 * public.sellers.id is a separate generated UUID — the owning user's id lives on
 * public.sellers.owner_id. Any code comparing a caller-supplied "sellerId" directly
 * against a seller_id foreign key column must resolve it through this helper first,
 * or the comparison will never match a real seller row.
 *
 * Falls back to the input unchanged if no owner match is found, so callers that
 * already pass a genuine sellers.id (internal/admin callers) keep working.
 */
export async function resolveSellerRowId(sellerIdOrOwnerId: string): Promise<string> {
  const { data: owned } = await (supabaseAdmin.from("sellers") as any)
    .select("id")
    .eq("owner_id", sellerIdOrOwnerId)
    .maybeSingle();
  return owned?.id ?? sellerIdOrOwnerId;
}

/**
 * Fetch verification documents for a seller store.
 */
export async function getSellerDocuments(sellerId: string): Promise<SellerDocumentRow[]> {
  const { data, error } = await (supabase.from("seller_documents") as any)
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching seller documents:", error);
    return [];
  }

  return (data as unknown as SellerDocumentRow[]) || [];
}

/**
 * Fetch team members for a seller store from canonical seller_staff table.
 */
export async function getSellerTeamMembers(sellerId: string): Promise<SellerMemberRow[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from("seller_staff")
    .select("*, profiles:user_id(email, full_name)")
    .eq("seller_id", sellerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching seller members:", error);
    return [];
  }

  return (data as unknown as SellerMemberRow[]) || [];
}

/**
 * Server Function: Get seller team members
 */
export const getSellerTeamMembersServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    await requireVerifiedSellerAccess(data.sellerId, "team:manage");
    return getSellerTeamMembers(data.sellerId);
  });

const STAFF_INVITE_EXPIRY_DAYS = 7;

/**
 * Server Function: Invite a new staff member to seller team
 */
export const inviteSellerStaffServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sellerId: string;
      email: string;
      name: string;
      role: string;
      permissions: string[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const actorId = await requireVerifiedSellerAccess(data.sellerId, "team:manage");
    const normalizedEmail = data.email.trim().toLowerCase();

    const [{ data: seller }, { data: inviter }] = await Promise.all([
      (supabaseAdmin.from("sellers") as any).select("business_name").eq("id", data.sellerId).maybeSingle(),
      (supabaseAdmin.from("profiles") as any).select("full_name").eq("id", actorId).maybeSingle(),
    ]);
    const sellerBusinessName = seller?.business_name ?? "your seller team";
    const inviterName = inviter?.full_name ?? "The team owner";

    // Lookup profile by email if user is already registered — add them immediately,
    // no accept step needed since their account already exists and is verified.
    const { data: profile } = await (supabaseAdmin.from("profiles") as any)
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profile?.id) {
      await (supabaseAdmin.from("seller_staff") as any).upsert(
        {
          seller_id: data.sellerId,
          user_id: profile.id,
          staff_role: data.role.toLowerCase(),
          permissions: data.permissions,
          is_active: true,
        },
        { onConflict: "seller_id,user_id" },
      );

      await sendSellerStaffInviteEmail({
        inviteeEmail: normalizedEmail,
        inviteeName: data.name,
        sellerBusinessName,
        inviterName,
        role: data.role,
        acceptUrl: `https://indianshoppingmela.com.au/sell/team`,
        expiresInDays: STAFF_INVITE_EXPIRY_DAYS,
        idempotencyKey: `staff_added_${data.sellerId}_${profile.id}`,
      });

      await (supabaseAdmin.from("audit_logs") as any).insert({
        actor_id: actorId,
        action: "SELLER_MEMBER_ADDED",
        entity_type: "SELLER_MEMBER",
        entity_id: data.sellerId,
        after_data: { email: normalizedEmail, role: data.role, permissions: data.permissions },
      });

      return { success: true, alreadyRegistered: true };
    }

    // No account yet — create a real, expiring invite record and email the invite link.
    const inviteToken = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + STAFF_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const { error: inviteErr } = await (supabaseAdmin.from("seller_staff_invites") as any).insert({
      seller_id: data.sellerId,
      email: normalizedEmail,
      invited_name: data.name,
      staff_role: data.role.toLowerCase(),
      permissions: data.permissions,
      invite_token: inviteToken,
      status: "pending",
      invited_by: actorId,
      expires_at: expiresAt.toISOString(),
    });

    if (inviteErr) {
      throw new Error(`Failed to create staff invite: ${inviteErr.message}`);
    }

    await sendSellerStaffInviteEmail({
      inviteeEmail: normalizedEmail,
      inviteeName: data.name,
      sellerBusinessName,
      inviterName,
      role: data.role,
      acceptUrl: `https://indianshoppingmela.com.au/sell/team/accept?token=${inviteToken}`,
      expiresInDays: STAFF_INVITE_EXPIRY_DAYS,
      idempotencyKey: `staff_invite_${inviteToken}`,
    });

    await (supabaseAdmin.from("audit_logs") as any).insert({
      actor_id: actorId,
      action: "SELLER_MEMBER_INVITED",
      entity_type: "SELLER_MEMBER",
      entity_id: data.sellerId,
      after_data: { email: normalizedEmail, role: data.role, permissions: data.permissions },
    });

    return { success: true, alreadyRegistered: false };
  });

/**
 * Server Function: Accept staff invite
 */
export const acceptSellerStaffInviteServerFn = createServerFn({ method: "POST" })
  .validator((data: { inviteToken: string }) => data)
  .handler(async ({ data }) => {
    const userId = await getVerifiedSessionUserId();
    if (!userId) {
      throw new Error("UNAUTHORIZED: Sign in before accepting a staff invite.");
    }

    const { data: invite, error } = await (supabaseAdmin.from("seller_staff_invites") as any)
      .select("*")
      .eq("invite_token", data.inviteToken)
      .eq("status", "pending")
      .maybeSingle();

    if (error || !invite) {
      throw new Error("Invalid or already-used staff invite token.");
    }

    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await (supabaseAdmin.from("seller_staff_invites") as any)
        .update({ status: "expired" })
        .eq("id", invite.id);
      throw new Error("This staff invite has expired. Ask the seller to send a new one.");
    }

    await (supabaseAdmin.from("seller_staff") as any).upsert(
      {
        seller_id: invite.seller_id,
        user_id: userId,
        staff_role: invite.staff_role,
        permissions: invite.permissions,
        is_active: true,
      },
      { onConflict: "seller_id,user_id" },
    );

    await (supabaseAdmin.from("seller_staff_invites") as any)
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", invite.id);

    await (supabaseAdmin.from("audit_logs") as any).insert({
      actor_id: userId,
      action: "SELLER_MEMBER_ACCEPTED",
      entity_type: "SELLER_MEMBER",
      entity_id: invite.seller_id,
      after_data: { userId, role: invite.staff_role },
    });

    return { success: true, sellerId: invite.seller_id };
  });

/**
 * Server Function: Update staff member permissions
 */
export const updateSellerStaffPermissionsServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string; memberEmail: string; permissions: string[] }) => data)
  .handler(async ({ data }) => {
    const actorId = await requireVerifiedSellerAccess(data.sellerId, "team:manage");
    // Find profile
    const { data: profile } = await (supabaseAdmin.from("profiles") as any)
      .select("id")
      .eq("email", data.memberEmail.trim().toLowerCase())
      .maybeSingle();

    if (profile?.id) {
      await (supabaseAdmin.from("seller_staff") as any)
        .update({
          permissions: data.permissions,
        })
        .eq("seller_id", data.sellerId)
        .eq("user_id", profile.id);
    }

    await (supabaseAdmin as any).from("audit_logs").insert({
      actor_id: actorId,
      action: "SELLER_PERMISSIONS_UPDATED",
      entity_type: "SELLER_MEMBER",
      entity_id: data.sellerId,
      after_data: { memberEmail: data.memberEmail, permissions: data.permissions },
    });

    return { success: true };
  });

/**
 * Server Function: Remove a staff member from seller team
 */
export const removeSellerStaffServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string; memberEmail: string }) => data)
  .handler(async ({ data }) => {
    const actorId = await requireVerifiedSellerAccess(data.sellerId, "team:manage");
    const { data: profile } = await (supabaseAdmin.from("profiles") as any)
      .select("id")
      .eq("email", data.memberEmail.trim().toLowerCase())
      .maybeSingle();

    if (profile?.id) {
      await (supabaseAdmin.from("seller_staff") as any)
        .update({ is_active: false })
        .eq("seller_id", data.sellerId)
        .eq("user_id", profile.id);
    }

    await (supabaseAdmin as any).from("audit_logs").insert({
      actor_id: actorId,
      action: "SELLER_MEMBER_REMOVED",
      entity_type: "SELLER_MEMBER",
      entity_id: data.sellerId,
      after_data: { memberEmail: data.memberEmail },
    });

    return { success: true };
  });

export const revokeSellerStaffMemberServerFn = removeSellerStaffServerFn;
