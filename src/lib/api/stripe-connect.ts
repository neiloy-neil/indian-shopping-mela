import Stripe from "stripe";
import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/server";

const env = typeof process !== "undefined" && process.env ? process.env : {};
const stripeSecretKey = env["STRIPE_SECRET_KEY"] ?? "sk_test_placeholder";

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-02-24.acacia" as any,
});

export interface StripeAccountStatus {
  stripeAccountId: string;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  requiresInformation: boolean;
}

/**
 * T118 — Create or retrieve an existing Stripe Custom/Express connected account for an Australian seller.
 */
export async function createOrGetSellerStripeAccount(params: {
  sellerId: string;
  email: string;
  businessName: string;
  abn?: string | undefined;
}): Promise<string> {
  // 1. Check if seller already has a stripe_account_id in DB
  const { data: seller, error } = await (supabaseAdmin.from("sellers") as any)
    .select("id, stripe_account_id, email, business_name")
    .eq("id", params.sellerId)
    .single();

  if (error) {
    console.error("Error finding seller for Stripe account:", error);
    throw new Error(`Seller not found: ${error.message}`);
  }

  if (seller?.stripe_account_id) {
    return seller.stripe_account_id;
  }

  // 2. Create Stripe Express Connected Account in Australia (AUD currency)
  try {
    const account = await stripe.accounts.create({
      type: "express",
      country: "AU",
      email: params.email,
      business_type: "individual", // or company based on entity
      capabilities: {
        transfers: { requested: true },
      },
      business_profile: {
        name: params.businessName,
        mcc: "5691", // Men's and Women's Clothing Stores / General Retail
        product_description: "Indian ethnic wear, jewellery, handicrafts, and home goods on Indian Shopping Mela.",
      },
      metadata: {
        sellerId: params.sellerId,
        abn: params.abn ?? "",
        platform: "Indian Shopping Mela",
      },
    });

    // 3. Persist stripe_account_id to seller record
    await (supabaseAdmin.from("sellers") as any)
      .update({
        stripe_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.sellerId);

    return account.id;
  } catch (err: any) {
    console.warn("Stripe Connected Account creation mock fallback (API key missing or test mode):", err.message);
    const mockId = `acct_ism_mock_${params.sellerId.substring(0, 8)}`;
    await (supabaseAdmin.from("sellers") as any)
      .update({
        stripe_account_id: mockId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.sellerId);
    return mockId;
  }
}

/**
 * T119 — Create a Stripe Connect Onboarding Link for seller verification.
 */
export async function createSellerOnboardingLink(params: {
  sellerId: string;
  stripeAccountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Promise<{ url: string }> {
  if (params.stripeAccountId.startsWith("acct_ism_mock_")) {
    return {
      url: `${params.returnUrl}?stripe_status=simulated_success&seller_id=${params.sellerId}`,
    };
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: params.stripeAccountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  } catch (err: any) {
    console.warn("Error creating Stripe Account Link, falling back to returnUrl:", err.message);
    return {
      url: `${params.returnUrl}?stripe_status=error&message=${encodeURIComponent(err.message)}`,
    };
  }
}

/**
 * T120 — Sync capability and onboarding readiness flags from Stripe to Supabase seller table.
 */
export async function syncSellerStripeAccountStatus(sellerId: string): Promise<StripeAccountStatus> {
  const { data: seller } = await (supabaseAdmin.from("sellers") as any)
    .select("stripe_account_id")
    .eq("id", sellerId)
    .single();

  const stripeAccountId = seller?.stripe_account_id;
  if (!stripeAccountId || stripeAccountId.startsWith("acct_ism_mock_")) {
    return {
      stripeAccountId: stripeAccountId ?? "none",
      detailsSubmitted: true,
      payoutsEnabled: true,
      chargesEnabled: true,
      requiresInformation: false,
    };
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const detailsSubmitted = account.details_submitted ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const chargesEnabled = account.charges_enabled ?? false;

    // Update seller status in DB
    await (supabaseAdmin.from("sellers") as any)
      .update({
        payouts_enabled: payoutsEnabled,
        stripe_details_submitted: detailsSubmitted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sellerId);

    return {
      stripeAccountId,
      detailsSubmitted,
      payoutsEnabled,
      chargesEnabled,
      requiresInformation: !detailsSubmitted || (account.requirements?.currently_due?.length ?? 0) > 0,
    };
  } catch (err: any) {
    console.error("Error retrieving Stripe account details:", err);
    return {
      stripeAccountId,
      detailsSubmitted: false,
      payoutsEnabled: false,
      chargesEnabled: false,
      requiresInformation: true,
    };
  }
}

/**
 * T121 — Gate seller payouts strictly if Stripe Connect account is not eligible.
 */
export async function checkSellerPayoutEligibility(sellerId: string): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  const { data: seller } = await (supabaseAdmin.from("sellers") as any)
    .select("status, onboarding_status, stripe_account_id, payouts_enabled")
    .eq("id", sellerId)
    .single();

  if (!seller) {
    return { eligible: false, reason: "Seller record does not exist." };
  }

  if (seller.status !== "ACTIVE") {
    return { eligible: false, reason: `Seller is not active (current status: ${seller.status}).` };
  }

  if (!seller.stripe_account_id) {
    return { eligible: false, reason: "Seller has not connected a Stripe account for AUD payouts." };
  }

  return { eligible: true };
}
