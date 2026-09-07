import { supabase } from "@/lib/supabase/client";
import type { Database, OnboardingStatus, Address } from "@/lib/supabase/types";

export type SellerInsert = Database["public"]["Tables"]["sellers"]["Insert"];
export type SellerRow = Database["public"]["Tables"]["sellers"]["Row"];
export type SellerStaffRow = Database["public"]["Tables"]["seller_staff"]["Row"];
export type SellerDocumentRow = Database["public"]["Tables"]["seller_documents"]["Row"];
export type SellerAgreementRow = Database["public"]["Tables"]["seller_agreements"]["Row"];

/**
 * Fetch the seller profile for the currently logged-in user.
 */
export async function getCurrentSellerProfile(): Promise<SellerRow | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await (supabase
    .from("sellers") as any)
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching seller profile:", error);
    throw error;
  }
  return (data as unknown as SellerRow) || null;
}

/**
 * Save draft or submit a seller onboarding application.
 */
export async function saveSellerOnboarding(payload: {
  businessName: string;
  legalName: string;
  abn: string;
  businessType: string;
  slug: string;
  dispatchAddress: Address;
  returnAddress: Address;
  bankBsb?: string | undefined;
  bankAccountNumber?: string | undefined;
  bankAccountName?: string | undefined;
  termsAcceptedVersion?: string | undefined;
  status?: OnboardingStatus | undefined;
}): Promise<SellerRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required to onboard as a seller.");

  const sellerData: Record<string, unknown> = {
    owner_id: user.id,
    business_name: payload.businessName,
    legal_name: payload.legalName,
    abn: payload.abn,
    business_type: payload.businessType,
    slug: payload.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    dispatch_address: payload.dispatchAddress,
    return_address: payload.returnAddress,
    bank_bsb: payload.bankBsb ?? null,
    bank_account_number: payload.bankAccountNumber ?? null,
    bank_account_name: payload.bankAccountName ?? null,
    terms_accepted_version: payload.termsAcceptedVersion ?? "V1_2026",
    terms_accepted_at: payload.termsAcceptedVersion ? new Date().toISOString() : null,
    status: payload.status ?? "DRAFT",
    risk_flag: false,
    commission_rate: 10.0,
    handling_days_default: 2,
    holiday_mode: false,
    logo_url: null,
    banner_url: null,
    about_text: null,
    approved_by: null,
    approved_at: null,
    admin_notes: null,
  };

  const { data, error } = await (supabase
    .from("sellers") as any)
    .upsert(sellerData, { onConflict: "slug" })
    .select()
    .single();

  if (error) {
    console.error("Error saving seller onboarding:", error);
    throw error;
  }

  return data as unknown as SellerRow;
}

/**
 * Submit the seller application for Admin review.
 */
export async function submitSellerApplication(sellerId: string): Promise<SellerRow> {
  const { data, error } = await (supabase
    .from("sellers") as any)
    .update({
      status: "SUBMITTED" as OnboardingStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerId)
    .select()
    .single();

  if (error) {
    console.error("Error submitting seller application:", error);
    throw error;
  }

  return data as unknown as SellerRow;
}

/**
 * Toggle holiday mode for a seller store.
 */
export async function toggleHolidayMode(sellerId: string, enabled: boolean): Promise<SellerRow> {
  const { data, error } = await (supabase
    .from("sellers") as any)
    .update({ holiday_mode: enabled, updated_at: new Date().toISOString() })
    .eq("id", sellerId)
    .select()
    .single();

  if (error) {
    console.error("Error toggling holiday mode:", error);
    throw error;
  }

  return data as unknown as SellerRow;
}

/**
 * Record seller agreement acceptance with audit metadata (§4, T041).
 */
export async function recordSellerAgreement(
  sellerId: string,
  agreementType: string = "SELLER_TERMS_AND_CONDITIONS",
  version: string = "V1_2026"
): Promise<SellerAgreementRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User must be authenticated to record agreement acceptance.");

  const { data, error } = await (supabase
    .from("seller_agreements") as any)
    .insert({
      seller_id: sellerId,
      user_id: user.id,
      agreement_type: agreementType,
      version,
      ip_address: null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error recording seller agreement:", error);
    throw error;
  }

  return data as unknown as SellerAgreementRow;
}

/**
 * Fetch verification documents for a seller store (§4, T042).
 */
export async function getSellerDocuments(sellerId: string): Promise<SellerDocumentRow[]> {
  const { data, error } = await (supabase
    .from("seller_documents") as any)
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching seller documents:", error);
    throw error;
  }

  return (data as unknown as SellerDocumentRow[]) || [];
}

/**
 * Fetch team staff members for a seller store (§2, T037).
 */
export async function getSellerTeamMembers(sellerId: string): Promise<SellerStaffRow[]> {
  const { data, error } = await (supabase
    .from("seller_staff") as any)
    .select("*, profiles(email, full_name)")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching seller staff:", error);
    throw error;
  }

  return (data as unknown as SellerStaffRow[]) || [];
}
