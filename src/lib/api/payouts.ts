import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-server";
import { postLedgerEntry } from "./ledger";
import { requireFinanceAdminSession, requireVerifiedSellerAccess } from "./server-auth";
import type { Database, PayoutStatus } from "@/lib/supabase/types";

export interface PayoutEligibilityResult {
  sellerId: string;
  isEligibleForPayout: boolean;
  ineligibilityReason?: string | undefined;
  eligibleSubOrderIds: string[];
  heldSubOrderIds: string[];
  totalEligibleGrossCents: number;
  totalCommissionCents: number;
  totalNetPayoutCents: number;
  totalNetPayoutAud: number;
  stripeAccountId?: string | undefined;
}

export interface PayoutTransferResult {
  success: boolean;
  payoutId: string;
  transferId: string;
  amountAud: number;
  amountCents: number;
  sellerId: string;
  settledSubOrdersCount: number;
}

export interface SellerStatementItem {
  payoutId: string;
  payoutBatchId: string;
  date: string;
  grossAud: number;
  commissionAud: number;
  netAud: number;
  status: PayoutStatus;
  transferId?: string | null;
  subOrderCount: number;
}

/**
 * Server Function: Calculate authoritative seller payout eligibility.
 * Enforces 14-day hold after carrier confirmed delivery and active dispute/return holds.
 */
export const getSellerPayoutEligibilityServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    // Exposes net payout amount, Stripe Connect account id, and eligible sub-order ids —
    // same ownership check as getSellerPayoutStatementServerFn, for the same reason.
    await requireVerifiedSellerAccess(data.sellerId, "finance:view");
    return getSellerPayoutEligibility(data.sellerId);
  });

/**
 * Server Function: Execute Stripe Connect payout transfer.
 * Requires Finance Admin authorization and verified MFA.
 */
export const executeSellerPayoutTransferServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    const admin = await requireFinanceAdminSession();
    return executeSellerPayoutTransfer(data.sellerId, true, admin.id);
  });

/**
 * Server Function: Generate seller payout statement CSV and data.
 */
export const getSellerPayoutStatementServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    // Payout statements contain financial data (transfer amounts, Stripe transfer ids,
    // ledger entries) for one seller — without this check, any caller could pass any
    // sellerId and read another seller's confidential payout history.
    await requireVerifiedSellerAccess(data.sellerId, "finance:view");
    return getSellerPayoutStatement(data.sellerId);
  });

/**
 * Server Function: Apply manual finance hold on a sub-order.
 */
export const setManualFinanceHoldServerFn = createServerFn({ method: "POST" })
  .validator((data: { subOrderId: string; holdReason: string }) => data)
  .handler(async ({ data }) => {
    const admin = await requireFinanceAdminSession();
    return setManualFinanceHold(data.subOrderId, data.holdReason, admin.id);
  });

/**
 * Calculate authoritative seller payout eligibility.
 * 1. Checks seller approval and Stripe Connect status.
 * 2. Fetches delivered sub-orders where delivered_at + 14 days <= NOW().
 * 3. Excludes sub-orders with active return requests or dispute holds.
 */
interface PayoutSubOrderRow {
  id: string;
  subtotal: number | null;
  shipping_cost: number | null;
  commission_amount: number | null;
  net_seller_amount: number | null;
  status: string;
  delivered_at: string | null;
  payout_items: Array<{
    id: string;
  }> | null;
}

interface PayoutStatementJoinedRow {
  id: string;
  amount_cents: number;
  currency: string;
  status: Database["public"]["Enums"]["payout_status"];
  provider_transfer_id: string | null;
  payout_batch_id: string | null;
  paid_at: string | null;
  created_at: string;
  payout_items: Array<{
    id: string;
    amount_cents: number;
    ledger_entry_id: string | null;
  }> | null;
}

/**
 * T110 — Authoritative Payout Eligibility & Maturity Calculator.
 * 1. Checks seller approval and Stripe Connect status.
 * 2. Fetches delivered sub-orders where delivered_at + 14 days <= NOW().
 * 3. Excludes sub-orders with active return requests or dispute holds.
 */
export async function getSellerPayoutEligibility(
  sellerId: string,
): Promise<PayoutEligibilityResult> {
  // 1. Fetch seller record
  const { data: seller, error: sellerErr } = await supabaseAdmin
    .from("sellers")
    .select("id, status, stripe_account_id, payouts_enabled, business_name")
    .eq("id", sellerId)
    .single();

  if (sellerErr || !seller) {
    return {
      sellerId,
      isEligibleForPayout: false,
      ineligibilityReason: "Seller record not found in database.",
      eligibleSubOrderIds: [],
      heldSubOrderIds: [],
      totalEligibleGrossCents: 0,
      totalCommissionCents: 0,
      totalNetPayoutCents: 0,
      totalNetPayoutAud: 0,
    };
  }

  const isApproved =
    (seller.status as string) === "APPROVED" ||
    (seller.status as string) === "approved" ||
    (seller.status as string) === "ACTIVE";
  if (!isApproved) {
    return {
      sellerId,
      isEligibleForPayout: false,
      ineligibilityReason: `Seller store is not in approved status (current: ${seller.status}).`,
      eligibleSubOrderIds: [],
      heldSubOrderIds: [],
      totalEligibleGrossCents: 0,
      totalCommissionCents: 0,
      totalNetPayoutCents: 0,
      totalNetPayoutAud: 0,
      stripeAccountId: seller.stripe_account_id ?? undefined,
    };
  }

  if (!seller.stripe_account_id) {
    return {
      sellerId,
      isEligibleForPayout: false,
      ineligibilityReason: "Seller has not connected a Stripe Express account for AUD payouts.",
      eligibleSubOrderIds: [],
      heldSubOrderIds: [],
      totalEligibleGrossCents: 0,
      totalCommissionCents: 0,
      totalNetPayoutCents: 0,
      totalNetPayoutAud: 0,
    };
  }

  // A seller can have a stripe_account_id before finishing Stripe's own identity/bank
  // verification — payouts_enabled is the flag Stripe actually sets (via account.updated
  // webhook) once that onboarding is genuinely complete. Without this check a seller could
  // show as "eligible" here yet still fail at actual transfer time.
  if (!seller.payouts_enabled) {
    return {
      sellerId,
      isEligibleForPayout: false,
      ineligibilityReason: "Seller's Stripe Connect account has not completed onboarding (payouts not yet enabled).",
      eligibleSubOrderIds: [],
      heldSubOrderIds: [],
      totalEligibleGrossCents: 0,
      totalCommissionCents: 0,
      totalNetPayoutCents: 0,
      totalNetPayoutAud: 0,
      stripeAccountId: seller.stripe_account_id,
    };
  }

  // 2. Fetch all sub-orders for this seller
  const { data: rawSubOrders, error: subOrdersErr } = await supabaseAdmin
    .from("sub_orders")
    .select(
      `
      id,
      subtotal,
      shipping_cost,
      commission_amount,
      net_seller_amount,
      status,
      delivered_at,
      payout_items (
        id
      )
    `,
    )
    .eq("seller_id", sellerId);

  if (subOrdersErr) {
    throw new Error(`Failed to query sub-orders: ${subOrdersErr.message}`);
  }

  const subOrders = (rawSubOrders || []) as unknown as PayoutSubOrderRow[];

  const now = new Date();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  const eligibleSubOrderIds: string[] = [];
  const heldSubOrderIds: string[] = [];
  let totalEligibleGrossCents = 0;
  let totalCommissionCents = 0;
  let totalNetPayoutCents = 0;

  for (const so of subOrders) {
    // Skip if already settled in a payout batch
    if (so.payout_items && so.payout_items.length > 0) {
      continue;
    }

    // Skip cancelled or refunded sub-orders
    if (so.status === "CANCELLED" || so.status === "REFUNDED") {
      continue;
    }

    // Check active return requests or dispute holds
    if (so.status === "RETURN_REQUESTED" || so.status === "DISPUTED") {
      heldSubOrderIds.push(so.id);
      continue;
    }

    // Check delivered status and 14-day hold maturity
    if (so.status === "DELIVERED" && so.delivered_at) {
      const deliveredTime = new Date(so.delivered_at).getTime();
      const isMatured = now.getTime() - deliveredTime >= FOURTEEN_DAYS_MS;

      if (isMatured) {
        eligibleSubOrderIds.push(so.id);
        const gross = Math.round((Number(so.subtotal) + Number(so.shipping_cost)) * 100);
        const commission = Math.round(Number(so.commission_amount) * 100);
        const net = Math.round(Number(so.net_seller_amount) * 100);

        totalEligibleGrossCents += gross;
        totalCommissionCents += commission;
        totalNetPayoutCents += net;
      } else {
        heldSubOrderIds.push(so.id);
      }
    } else {
      // In transit or preparing
      heldSubOrderIds.push(so.id);
    }
  }

  const isEligible = eligibleSubOrderIds.length > 0 && totalNetPayoutCents > 0;

  return {
    sellerId,
    isEligibleForPayout: isEligible,
    ineligibilityReason: isEligible
      ? undefined
      : "No matured delivery records available for settlement.",
    eligibleSubOrderIds,
    heldSubOrderIds,
    totalEligibleGrossCents,
    totalCommissionCents,
    totalNetPayoutCents,
    totalNetPayoutAud: Number((totalNetPayoutCents / 100).toFixed(2)),
    stripeAccountId: seller.stripe_account_id ?? undefined,
  };
}

/**
 * Execute Stripe Connect payout transfer to seller's Australian bank account.
 */
export async function executeSellerPayoutTransfer(
  sellerId: string,
  _isMfaVerified: boolean = false,
  adminId?: string | undefined,
): Promise<PayoutTransferResult> {
  // 1. Verify eligibility
  const eligibility = await getSellerPayoutEligibility(sellerId);
  if (!eligibility.isEligibleForPayout || eligibility.totalNetPayoutCents <= 0) {
    throw new Error(
      `Seller ${sellerId} is not eligible for payout transfer: ${eligibility.ineligibilityReason}`,
    );
  }

  const amountAud = eligibility.totalNetPayoutAud;
  const amountCents = eligibility.totalNetPayoutCents;

  // 1b. Re-verify the destination account directly against sellers, fresh, right before
  // committing to a transfer — don't rely solely on the value threaded through from the
  // eligibility check moments earlier. This closes two gaps: (a) a stale/cached
  // stripeAccountId if the seller's Connect account changed between the two calls, and
  // (b) the eligibility check never actually verified payouts_enabled (Stripe's own
  // "onboarding actually completed" flag) — only that a stripe_account_id existed, which
  // a seller can have before finishing identity/bank verification.
  const { data: sellerAccount } = await supabaseAdmin
    .from("sellers")
    .select("stripe_account_id, payouts_enabled")
    .eq("id", sellerId)
    .maybeSingle();

  const stripeAccountId = sellerAccount?.stripe_account_id ?? undefined;

  if (!stripeAccountId || !stripeAccountId.startsWith("acct_") || !sellerAccount?.payouts_enabled) {
    throw new Error(
      `Cannot execute payout for seller ${sellerId}: Stripe Connect account is missing, invalid, or has not completed onboarding (payouts_enabled must be true).`,
    );
  }

  // 2. Create PAYOUT_PROCESSING payout batch record in DB
  const payoutBatchId = `PO-${Date.now().toString().slice(-8)}`;
  const { data: payoutRecord, error: payoutErr } = await supabaseAdmin
    .from("payouts")
    .insert({
      seller_id: sellerId,
      payout_batch_id: payoutBatchId,
      amount_cents: amountCents,
      status: "PAYOUT_PROCESSING",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (payoutErr || !payoutRecord) {
    throw new Error(`Failed to create payout record: ${payoutErr?.message}`);
  }

  const payoutId = payoutRecord.id;

  // 3. Post SELLER_PAYOUT debit ledger entry
  const { id: ledgerEntryId } = await postLedgerEntry({
    sellerId,
    entryType: "SELLER_PAYOUT",
    amountCents,
    description: `Stripe Connect payout batch ${payoutBatchId} (${eligibility.eligibleSubOrderIds.length} sub-orders)`,
    metadata: {
      payoutId,
      payoutBatchId,
      subOrderCount: eligibility.eligibleSubOrderIds.length,
      eligibleSubOrderIds: eligibility.eligibleSubOrderIds,
    },
  });

  // 4. Insert line items into public.payout_items with canonical ledger_entry_id
  for (const subOrderId of eligibility.eligibleSubOrderIds) {
    const { data: so } = await supabaseAdmin
      .from("sub_orders")
      .select("subtotal, shipping_cost, commission_amount, net_seller_amount")
      .eq("id", subOrderId)
      .single();

    if (so) {
      await supabaseAdmin.from("payout_items").insert({
        payout_id: payoutId,
        ledger_entry_id: ledgerEntryId,
        amount_cents: Math.round(Number(so.net_seller_amount) * 100),
        created_at: new Date().toISOString(),
      });
    }
  }

  // 5. Initiate real Stripe Connect Transfer (destination account already validated above)
  const isProduction = process.env["NODE_ENV"] === "production";

  let transferId: string;
  const idempotencyKey = `payout_transfer_${payoutId}`;

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: "aud",
        destination: stripeAccountId,
        description: `Settlement payout ${payoutBatchId} for Indian Shopping Mela`,
        metadata: {
          payoutId,
          sellerId,
          payoutBatchId,
          subOrderCount: eligibility.eligibleSubOrderIds.length,
        },
      },
      {
        idempotencyKey,
      },
    );
    transferId = transfer.id;
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
    if (
      !isProduction &&
      (!process.env["STRIPE_SECRET_KEY"] || process.env["STRIPE_SECRET_KEY"].includes("dummy"))
    ) {
      transferId = `tr_dev_${Date.now()}`;
    } else {
      // Mark payout failed/cancelled
      await supabaseAdmin
        .from("payouts")
        .update({
          status: "CANCELLED",
          failure_reason: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutId);

      throw new Error(`Stripe Connect transfer failed: ${msg}`);
    }
  }

  // 6. Update payout status to PAID_TO_SELLER
  await supabaseAdmin
    .from("payouts")
    .update({
      status: "PAID_TO_SELLER",
      provider_transfer_id: transferId,
      paid_at: new Date().toISOString(),
      cleared_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId);

  // 7. Audit log
  await supabaseAdmin.from("audit_logs").insert({
    action: "SELLER_PAYOUT_TRANSFERRED",
    entity_type: "PAYOUT",
    entity_id: payoutId,
    actor_id: adminId ?? null,
    actor_role: "admin_finance",
    after_data: {
      sellerId,
      amountCents,
      amountAud,
      transferId,
      subOrderCount: eligibility.eligibleSubOrderIds.length,
    },
  });

  return {
    success: true,
    payoutId,
    transferId,
    amountAud,
    amountCents,
    sellerId,
    settledSubOrdersCount: eligibility.eligibleSubOrderIds.length,
  };
}

/**
 * Generate seller payout statement summary and downloadable CSV export.
 */
export async function getSellerPayoutStatement(sellerId: string): Promise<{
  statementItems: SellerStatementItem[];
  totalPaidAud: number;
  totalPaidCents: number;
  totalGrossAud: number;
  totalCommissionAud: number;
  csvExport: string;
}> {
  const { data: rawPayouts } = await supabaseAdmin
    .from("payouts")
    .select(
      `
      id,
      amount_cents,
      currency,
      status,
      provider_transfer_id,
      payout_batch_id,
      paid_at,
      created_at,
      payout_items (
        id,
        amount_cents,
        ledger_entry_id
      )
    `,
    )
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  const payouts = (rawPayouts || []) as unknown as PayoutStatementJoinedRow[];

  const statementItems: SellerStatementItem[] = [];
  let totalPaidCents = 0;

  for (const po of payouts) {
    const items = po.payout_items || [];
    const netCents = Number(po.amount_cents) || 0;
    const netAud = Number((netCents / 100).toFixed(2));

    // Approximate gross and commission based on default 10% platform commission
    // Gross = Net / 0.90, Commission = Gross * 0.10
    const grossAud = Number((netAud / 0.9).toFixed(2));
    const commissionAud = Number((grossAud - netAud).toFixed(2));

    if (po.status === "PAID_TO_SELLER") {
      totalPaidCents += netCents;
    }

    statementItems.push({
      payoutId: po.id,
      payoutBatchId: po.payout_batch_id ?? po.id,
      date: po.paid_at
        ? new Date(po.paid_at).toLocaleDateString("en-AU")
        : new Date(po.created_at).toLocaleDateString("en-AU"),
      grossAud,
      commissionAud,
      netAud,
      status: po.status,
      transferId: po.provider_transfer_id,
      subOrderCount: items.length > 0 ? items.length : 1,
    });
  }

  const totalPaidAud = Number((totalPaidCents / 100).toFixed(2));
  const totalGrossAud = Number((totalPaidAud / 0.9).toFixed(2));
  const totalCommissionAud = Number((totalGrossAud - totalPaidAud).toFixed(2));

  // Generate CSV Content
  const csvHeader =
    "Payout ID,Batch ID,Date,Gross AUD,Commission AUD (10%),Net Transferred AUD,Status,Stripe Transfer ID,Sub-Orders\n";
  const csvRows = statementItems.map(
    (item) =>
      `"${item.payoutId}","${item.payoutBatchId}","${item.date}",${item.grossAud},${item.commissionAud},${item.netAud},"${item.status}","${item.transferId ?? ""}","${item.subOrderCount}"`,
  );
  const csvExport = csvHeader + csvRows.join("\n");

  return {
    statementItems,
    totalPaidAud,
    totalPaidCents,
    totalGrossAud,
    totalCommissionAud,
    csvExport,
  };
}

/**
 * Place manual finance hold on a sub-order.
 */
export async function setManualFinanceHold(
  subOrderId: string,
  holdReason: string,
  adminId?: string | undefined,
): Promise<{ success: boolean }> {
  const { data: subOrder } = await supabaseAdmin
    .from("sub_orders")
    .select("master_order_id, seller_id, net_seller_amount")
    .eq("id", subOrderId)
    .single();

  if (!subOrder) {
    throw new Error(`Sub-order ${subOrderId} not found.`);
  }

  const holdAmountCents = Math.round(Number(subOrder.net_seller_amount) * 100);

  await postLedgerEntry({
    orderId: subOrder.master_order_id,
    subOrderId,
    sellerId: subOrder.seller_id,
    entryType: "DISPUTE_HOLD",
    amountCents: holdAmountCents,
    description: `Manual finance hold: ${holdReason}`,
    metadata: { subOrderId, holdReason, adminId },
  });

  await supabaseAdmin.from("audit_logs").insert({
    action: "MANUAL_FINANCE_HOLD_APPLIED",
    entity_type: "SUB_ORDER",
    entity_id: subOrderId,
    actor_id: adminId ?? null,
    actor_role: "admin_finance",
    after_data: { holdReason, holdAmountCents },
  });

  return { success: true };
}

/**
 * Handle post-payout refund recovery:
 * If a refund/dispute occurs after a seller was already paid out, posts an ADJUSTMENT
 * entry that creates a negative balance to be automatically recovered on subsequent sales.
 */
export async function handlePostPayoutRefundRecovery(
  sellerId: string,
  subOrderId: string,
  refundAmountAud: number,
  reason: string = "Post-settlement customer return recovery",
): Promise<{ success: boolean; debitAmountCents: number }> {
  const debitAmountCents = Math.round(refundAmountAud * 100);

  await postLedgerEntry({
    sellerId,
    subOrderId,
    entryType: "ADJUSTMENT",
    amountCents: debitAmountCents,
    description: `Negative balance adjustment: ${reason}`,
    metadata: { subOrderId, refundAmountAud },
  });

  await supabaseAdmin.from("audit_logs").insert({
    action: "POST_PAYOUT_RECOVERY_DEBIT",
    entity_type: "SELLER_BALANCE",
    entity_id: sellerId,
    after_data: { subOrderId, refundAmountAud, debitAmountCents, reason },
  });

  return { success: true, debitAmountCents };
}
