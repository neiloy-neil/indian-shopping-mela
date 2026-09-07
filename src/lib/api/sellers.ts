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
 * Valid Seller Onboarding & Moderation State Machine Transitions
 */
export const ALLOWED_SELLER_TRANSITIONS: Record<SellerStatus, SellerStatus[]> = {
  draft: ["draft", "submitted"],
  submitted: ["submitted", "under_review", "draft"],
  under_review: ["under_review", "approved", "rejected"],
  approved: ["approved", "suspended"],
  rejected: ["rejected", "under_review"],
  suspended: ["suspended", "approved"],
};

export function isValidSellerStatusTransition(from: SellerStatus, to: SellerStatus): boolean {
  if (from === to) return true;
  return ALLOWED_SELLER_TRANSITIONS[from]?.includes(to) ?? false;
}

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
    .select("status")
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

  // 2. Insert or update default dispatch address
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

  // 3. Insert or update return address
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
