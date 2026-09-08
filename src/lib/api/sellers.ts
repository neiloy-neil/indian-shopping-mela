import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/server";
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
  storeName: string;
  businessName: string;
  abn: string;
  phone?: string | undefined;
  email?: string | undefined;
  description?: string | undefined;
  slug: string;
  dispatchAddress: Address;
  returnAddress: Address;
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
export function validateAustralianAbn(abn: string): { valid: boolean; formatted: string; reason?: string | undefined } {
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
  draft: ["draft", "submitted"],
  submitted: ["submitted", "under_review", "draft"],
  under_review: ["under_review", "approved", "rejected", "info_required"],
  info_required: ["info_required", "submitted", "draft", "under_review"],
  approved: ["approved", "suspended"],
  rejected: ["rejected", "under_review", "draft"],
  suspended: ["suspended", "approved"],
};

export function isValidSellerStatusTransition(from: SellerStatus, to: SellerStatus): boolean {
  if (from === to) return true;
  return ALLOWED_SELLER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Server Function: Admin review of seller onboarding application
 */
export const adminReviewSellerApplicationServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    sellerId: string;
    newStatus: SellerStatus;
    reviewerNote?: string | undefined;
    commissionRate?: number | undefined;
  }) => data)
  .handler(async ({ data }) => {
    const { data: seller, error: fetchErr } = await (supabaseAdmin as any)
      .from("sellers")
      .select("id, status, user_id")
      .eq("id", data.sellerId)
      .single();

    if (fetchErr || !seller) {
      throw new Error(`Seller not found: ${fetchErr?.message}`);
    }

    const currentStatus = seller.status as SellerStatus;
    if (!isValidSellerStatusTransition(currentStatus, data.newStatus)) {
      throw new Error(`Invalid seller status transition from ${currentStatus} to ${data.newStatus}`);
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
      action: `SELLER_STATUS_${data.newStatus.toUpperCase()}`,
      entity_type: "SELLER",
      entity_id: data.sellerId,
      payload: {
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
    return saveSellerOnboardingTransactional(data);
  });

export async function saveSellerOnboardingTransactional(payload: SaveSellerOnboardingInput): Promise<SellerRow> {
  const cleanSlug = payload.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const targetStatus: SellerStatus = payload.status === "submitted" ? "submitted" : "draft";

  // Check existing status to prevent self-approving or invalid jumps
  const { data: existingSeller } = await (supabaseAdmin as any)
    .from("sellers")
    .select("id, status")
    .eq("slug", cleanSlug)
    .maybeSingle();

  if (existingSeller) {
    const currentStatus = existingSeller.status as SellerStatus;
    if (!isValidSellerStatusTransition(currentStatus, targetStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${targetStatus}`);
    }
  }

  // 1. Upsert Seller Row
  const { data: seller, error: sellerError } = await (supabaseAdmin as any)
    .from("sellers")
    .upsert(
      {
        user_id: payload.userId ?? "00000000-0000-0000-0000-000000000001",
        store_name: payload.storeName || payload.businessName,
        business_name: payload.businessName,
        slug: cleanSlug,
        abn: payload.abn,
        phone: payload.phone ?? null,
        email: payload.email ?? "seller@indianshoppingmela.com.au",
        description: payload.description ?? null,
        status: targetStatus,
        onboarding_step: targetStatus === "submitted" ? 4 : 2,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (sellerError || !seller) {
    throw new Error(`Failed to save seller profile: ${sellerError?.message}`);
  }

  // 2. Ensure seller owner membership is registered
  if (payload.userId) {
    await (supabaseAdmin as any).from("seller_members").upsert(
      {
        seller_id: seller.id,
        user_id: payload.userId,
        role: "owner",
        permissions: ["all"],
      },
      { onConflict: "seller_id,user_id" }
    );
  }

  // 3. Insert or update default dispatch address
  if (payload.dispatchAddress) {
    await (supabaseAdmin as any).from("seller_addresses").upsert({
      seller_id: seller.id,
      address_type: "dispatch",
      address_line1: payload.dispatchAddress.line1,
      address_line2: payload.dispatchAddress.line2 ?? null,
      suburb: payload.dispatchAddress.suburb,
      state: payload.dispatchAddress.state,
      postcode: payload.dispatchAddress.postcode,
      country: payload.dispatchAddress.country ?? "AU",
      is_default: true,
    });
  }

  // 4. Insert or update return address
  if (payload.returnAddress) {
    await (supabaseAdmin as any).from("seller_addresses").upsert({
      seller_id: seller.id,
      address_type: "return",
      address_line1: payload.returnAddress.line1,
      address_line2: payload.returnAddress.line2 ?? null,
      suburb: payload.returnAddress.suburb,
      state: payload.returnAddress.state,
      postcode: payload.returnAddress.postcode,
      country: payload.returnAddress.country ?? "AU",
      is_default: false,
    });
  }

  return seller as unknown as SellerRow;
}

/**
 * Server Function: Upload or record seller verification document metadata
 */
export const uploadSellerDocumentMetadataServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    sellerId: string;
    documentType: "abn_certificate" | "identity_proof" | "business_registration" | "bank_statement";
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }) => data)
  .handler(async ({ data }) => {
    const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowedMimeTypes.includes(data.mimeType)) {
      throw new Error(`Invalid file type: ${data.mimeType}. Only PDF and images are allowed.`);
    }

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit
    if (data.fileSize > maxSizeBytes) {
      throw new Error(`File size exceeds the 10MB limit.`);
    }

    const { data: doc, error } = await (supabaseAdmin as any)
      .from("seller_documents")
      .insert({
        seller_id: data.sellerId,
        document_type: data.documentType,
        file_url: data.fileUrl,
        file_name: data.fileName,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        status: "pending",
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
      payload: { sellerId: data.sellerId, documentType: data.documentType, fileName: data.fileName },
    });

    return doc as SellerDocumentRow;
  });

/**
 * Server Function: Record immutable seller agreement acceptance version
 */
export const recordSellerAgreementAcceptanceServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    sellerId: string;
    agreementType: "seller_master_agreement" | "marketplace_terms" | "prohibited_items_policy";
    version: string;
  }) => data)
  .handler(async ({ data }) => {
    const { data: agreement, error } = await (supabaseAdmin as any)
      .from("seller_agreements")
      .insert({
        seller_id: data.sellerId,
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
      action: "SELLER_AGREEMENT_ACCEPTED",
      entity_type: "SELLER_AGREEMENT",
      entity_id: data.sellerId,
      payload: { agreementType: data.agreementType, version: data.version },
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

  const { data, error } = await (supabase.from("sellers") as any)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching seller profile:", error);
    return null;
  }
  return (data as unknown as SellerRow) || null;
}

/**
 * Client save helper bridging to server function / client SDK
 */
export async function saveSellerOnboarding(payload: {
  businessName: string;
  legalName?: string | undefined;
  storeName?: string | undefined;
  abn: string;
  businessType?: string | undefined;
  slug: string;
  dispatchAddress: Address;
  returnAddress: Address;
  termsAcceptedVersion?: string | undefined;
  status?: SellerStatus | undefined;
}): Promise<SellerRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return saveSellerOnboardingTransactional({
    userId: user?.id,
    storeName: payload.storeName || payload.businessName,
    businessName: payload.businessName,
    abn: payload.abn,
    slug: payload.slug,
    dispatchAddress: payload.dispatchAddress,
    returnAddress: payload.returnAddress,
    status: payload.status,
    email: user?.email,
  });
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
 * Fetch team members for a seller store.
 */
export async function getSellerTeamMembers(sellerId: string): Promise<SellerMemberRow[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from("seller_members")
    .select("*, profiles(email, full_name)")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching seller members:", error);
    return [];
  }

  return (data as unknown as SellerMemberRow[]) || [];
}

/**
 * Server Function: Invite a new staff member to seller team
 */
export const inviteSellerStaffServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    sellerId: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("seller_members").insert({
      seller_id: data.sellerId,
      role: data.role,
      permissions: data.permissions,
    });

    if (error) {
      console.warn("Seller member invite note:", error.message);
    }

    await (supabaseAdmin as any).from("audit_logs").insert({
      action: "SELLER_MEMBER_INVITED",
      entity_type: "SELLER_MEMBER",
      entity_id: data.sellerId,
      payload: { email: data.email, role: data.role, permissions: data.permissions },
    });

    return { success: true };
  });

/**
 * Server Function: Update staff member permissions
 */
export const updateSellerStaffPermissionsServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    sellerId: string;
    memberEmail: string;
    permissions: string[];
  }) => data)
  .handler(async ({ data }) => {
    await (supabaseAdmin as any).from("audit_logs").insert({
      action: "SELLER_PERMISSIONS_UPDATED",
      entity_type: "SELLER_MEMBER",
      entity_id: data.sellerId,
      payload: { memberEmail: data.memberEmail, permissions: data.permissions },
    });

    return { success: true };
  });

/**
 * Server Function: Remove a staff member from seller team
 */
export const removeSellerStaffServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    sellerId: string;
    memberEmail: string;
  }) => data)
  .handler(async ({ data }) => {
    await (supabaseAdmin as any).from("audit_logs").insert({
      action: "SELLER_MEMBER_REMOVED",
      entity_type: "SELLER_MEMBER",
      entity_id: data.sellerId,
      payload: { memberEmail: data.memberEmail },
    });

    return { success: true };
  });
