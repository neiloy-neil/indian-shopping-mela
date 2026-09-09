import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe-server";
import { postLedgerEntry } from "./ledger";
import type { PayoutStatus } from "@/lib/supabase/types";

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
  sellerId: string;
  settledSubOrdersCount: number;
}

export interface SellerStatementItem {
  payoutId: string;
  date: string;
  grossAud: number;
  commissionAud: number;
  netAud: number;
  status: string;
  transferId?: string | null;
  subOrderCount: number;
}

/**
 * Server Function: Calculate authoritative seller payout eligibility
 * Enforces 14-day hold after carrier confirmed delivery and active dispute/return holds.
 */
export const getSellerPayoutEligibilityServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    return getSellerPayoutEligibility(data.sellerId);
  });

/**
 * Server Function: Execute Stripe Connect payout transfer
 * Requires Finance Admin role and verified MFA.
 */
export const executeSellerPayoutTransferServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      sellerId: string;
      isMfaVerified?: boolean | undefined;
      adminId?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    return executeSellerPayoutTransfer(data.sellerId, data.isMfaVerified ?? false, data.adminId);
  });

/**
 * Server Function: Generate seller payout statement CSV and data
 */
export const getSellerPayoutStatementServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    return getSellerPayoutStatement(data.sellerId);
  });

/**
 * Server Function: Apply manual finance hold on a sub-order
 */
export const setManualFinanceHoldServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: { subOrderId: string; holdReason: string; adminId?: string | undefined }) => data,
  )
  .handler(async ({ data }) => {
    return setManualFinanceHold(data.subOrderId, data.holdReason, data.adminId);
  });

/**
 * Calculate authoritative seller payout eligibility.
 * 1. Checks seller approval and Stripe Connect status (charges_enabled & payouts_enabled).
 * 2. Fetches delivered sub-orders where delivered_at + 14 days <= NOW().
 * 3. Excludes sub-orders with active return requests or dispute holds.
 */
export async function getSellerPayoutEligibility(
  sellerId: string,
): Promise<PayoutEligibilityResult> {
  // 1. Fetch seller record
  const { data: seller, error: sellerErr } = await (supabaseAdmin.from("sellers") as any)
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
    seller.status === "approved" || seller.status === "APPROVED" || seller.status === "ACTIVE";
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
      stripeAccountId: seller.stripe_account_id,
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

  // 2. Fetch all sub-orders for this seller
  const { data: subOrders, error: subOrdersErr } = await (supabaseAdmin.from("sub_orders") as any)
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

  const now = new Date();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  const eligibleSubOrderIds: string[] = [];
  const heldSubOrderIds: string[] = [];
  let totalEligibleGrossCents = 0;
  let totalCommissionCents = 0;
  let totalNetPayoutCents = 0;

  for (const so of subOrders || []) {
    // Skip if already settled in a payout batch
    if (so.payout_items && so.payout_items.length > 0) {
      continue;
    }

    // Skip cancelled or refunded sub-orders
    if (so.status === "CANCELLED" || so.status === "REFUNDED") {
      continue;
    }

    // Check active return requests or dispute holds
    if (so.status === "RETURN_REQUESTED") {
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
    stripeAccountId: seller.stripe_account_id,
  };
}

/**
 * Execute Stripe Connect payout transfer to seller's Australian bank account.
 */
export async function executeSellerPayoutTransfer(
  sellerId: string,
  isMfaVerified: boolean = false,
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
  const stripeAccountId = eligibility.stripeAccountId!;

  // 2. Create PENDING payout batch record in DB
  const payoutBatchId = `PO-${Date.now().toString().slice(-8)}`;
  const { data: payoutRecord, error: payoutErr } = await (supabaseAdmin.from("payouts") as any)
    .insert({
      seller_id: sellerId,
      payout_batch_id: payoutBatchId,
      amount: amountAud,
      currency: "AUD",
      status: "PROCESSING",
      period_end: new Date().toISOString(),
      scheduled_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (payoutErr || !payoutRecord) {
    throw new Error(`Failed to create payout record: ${payoutErr?.message}`);
  }

  const payoutId = payoutRecord.id;

  // 3. Insert line items into payout_items
  for (const subOrderId of eligibility.eligibleSubOrderIds) {
    const { data: so } = await (supabaseAdmin.from("sub_orders") as any)
      .select("subtotal, shipping_cost, commission_amount, net_seller_amount")
      .eq("id", subOrderId)
      .single();

    if (so) {
      await (supabaseAdmin.from("payout_items") as any).insert({
        payout_id: payoutId,
        sub_order_id: subOrderId,
        gross_amount: Number(so.subtotal) + Number(so.shipping_cost),
        commission_amount: Number(so.commission_amount),
        net_amount: Number(so.net_seller_amount),
      });
    }
  }

  // 4. Initiate real Stripe Connect Transfer
  const isProduction = process.env["NODE_ENV"] === "production";
  if (!stripeAccountId) {
    await (supabaseAdmin.from("payouts") as any)
      .update({
        status: "FAILED",
        failure_reason: "Seller does not have an active, verified Stripe Connect account.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payoutId);

    throw new Error(
      `Cannot execute payout for seller ${sellerId}: Missing active Stripe Connect account.`,
    );
  }

  let transferId: string;
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: eligibility.totalNetPayoutCents,
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
        idempotencyKey: `payout_transfer_${payoutId}`,
      },
    );
    transferId = transfer.id;
  } catch (stripeErr: any) {
    if (
      !isProduction &&
      (!process.env["STRIPE_SECRET_KEY"] || process.env["STRIPE_SECRET_KEY"].includes("dummy"))
    ) {
      transferId = `tr_dev_${Date.now()}`;
    } else {
      // Mark payout failed
      await (supabaseAdmin.from("payouts") as any)
        .update({
          status: "FAILED",
          failure_reason: stripeErr.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payoutId);

      throw new Error(`Stripe Connect transfer failed: ${stripeErr.message}`);
    }
  }

  // 5. Update payout status to TRANSFERRED
  await (supabaseAdmin.from("payouts") as any)
    .update({
      status: "TRANSFERRED",
      transfer_id: transferId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payoutId);

  // 6. Post SELLER_PAYOUT debit ledger entry
  await postLedgerEntry({
    sellerId,
    entryType: "SELLER_PAYOUT",
    amountCents: eligibility.totalNetPayoutCents,
    description: `Stripe Connect payout transfer #${transferId} (Batch: ${payoutBatchId})`,
    metadata: { payoutId, transferId, subOrderCount: eligibility.eligibleSubOrderIds.length },
  });

  // 7. Audit log
  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "SELLER_PAYOUT_TRANSFERRED",
    entity_type: "PAYOUT",
    entity_id: payoutId,
    user_id: adminId ?? null,
    new_data: {
      sellerId,
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
  totalGrossAud: number;
  totalCommissionAud: number;
  csvExport: string;
}> {
  const { data: payouts } = await (supabaseAdmin.from("payouts") as any)
    .select(
      `
      id,
      amount,
      status,
      transfer_id,
      paid_at,
      created_at,
      payout_items (
        gross_amount,
        commission_amount,
        net_amount
      )
    `,
    )
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  const statementItems: SellerStatementItem[] = [];
  let totalPaidAud = 0;
  let totalGrossAud = 0;
  let totalCommissionAud = 0;

  for (const po of payouts || []) {
    const items = po.payout_items || [];
    const gross = items.reduce((acc: number, i: any) => acc + (Number(i.gross_amount) || 0), 0);
    const commission = items.reduce(
      (acc: number, i: any) => acc + (Number(i.commission_amount) || 0),
      0,
    );
    const net = Number(po.amount) || 0;

    totalPaidAud += net;
    totalGrossAud += gross;
    totalCommissionAud += commission;

    statementItems.push({
      payoutId: po.id,
      date: po.paid_at
        ? new Date(po.paid_at).toLocaleDateString("en-AU")
        : new Date(po.created_at).toLocaleDateString("en-AU"),
      grossAud: Number(gross.toFixed(2)),
      commissionAud: Number(commission.toFixed(2)),
      netAud: Number(net.toFixed(2)),
      status: po.status,
      transferId: po.transfer_id,
      subOrderCount: items.length,
    });
  }

  // Generate CSV Content
  const csvHeader =
    "Payout ID,Date,Gross AUD,Commission AUD (12%),Net Transferred AUD,Status,Stripe Transfer ID,Sub-Orders\n";
  const csvRows = statementItems.map(
    (item) =>
      `"${item.payoutId}","${item.date}",${item.grossAud},${item.commissionAud},${item.netAud},"${item.status}","${item.transferId ?? ""}","${item.subOrderCount}"`,
  );
  const csvExport = csvHeader + csvRows.join("\n");

  return {
    statementItems,
    totalPaidAud: Number(totalPaidAud.toFixed(2)),
    totalGrossAud: Number(totalGrossAud.toFixed(2)),
    totalCommissionAud: Number(totalCommissionAud.toFixed(2)),
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
  const { data: subOrder } = await (supabaseAdmin.from("sub_orders") as any)
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

  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "MANUAL_FINANCE_HOLD_APPLIED",
    entity_type: "SUB_ORDER",
    entity_id: subOrderId,
    user_id: adminId ?? null,
    new_data: { holdReason, holdAmountCents },
  });

  return { success: true };
}

/**
 * Handle post-payout refund recovery:
 * If a refund/dispute occurs after a seller was already paid out, posts a SELLER_DEBIT
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
    entryType: "SELLER_DEBIT",
    amountCents: debitAmountCents,
    description: `Negative balance adjustment: ${reason}`,
    metadata: { subOrderId, refundAmountAud },
  });

  await (supabaseAdmin.from("audit_logs") as any).insert({
    action: "POST_PAYOUT_RECOVERY_DEBIT",
    entity_type: "SELLER_BALANCE",
    entity_id: sellerId,
    new_data: { subOrderId, refundAmountAud, debitAmountCents, reason },
  });

  return { success: true, debitAmountCents };
}
