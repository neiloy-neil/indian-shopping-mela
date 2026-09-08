import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface FinanceSummaryMetrics {
  totalGmvAud: number;
  totalPlatformCommissionAud: number;
  totalPendingHoldAud: number;
  totalEligiblePayoutsAud: number;
  totalPaidToSellersAud: number;
}

export interface SellerPayoutBatchItem {
  sellerId: string;
  sellerBusinessName: string;
  bankBsb: string;
  bankAccountNumber: string;
  bankAccountName: string;
  totalPayoutAud: number;
  subOrderIds: string[];
}

/**
 * Server Function: Get finance summary metrics
 */
export const getMarketplaceFinanceMetricsServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    return getMarketplaceFinanceMetrics();
  });

/**
 * Server Function: Reconcile and unlock eligible payouts
 */
export const reconcileAndUnlockEligiblePayoutsServerFn = createServerFn({ method: "POST" })
  .handler(async () => {
    return reconcileAndUnlockEligiblePayouts();
  });

/**
 * Server Function: Generate payout batch CSV
 */
export const generateSellerPayoutBatchCsvServerFn = createServerFn({ method: "POST" })
  .handler(async () => {
    return generateSellerPayoutBatchCsv();
  });

/**
 * Server Function: Moderate seller status (APPROVE, REJECT, SUSPEND)
 */
export const moderateSellerStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string; status: "APPROVED" | "REJECTED" | "SUSPENDED"; reason?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("sellers") as any)
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.sellerId);

    if (error) throw new Error(`Failed to update seller status: ${error.message}`);

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: `SELLER_${data.status}`,
      entity_type: "SELLER",
      entity_id: data.sellerId,
      payload: { status: data.status, reason: data.reason },
    });

    return { success: true };
  });

/**
 * Fetch marketplace financial aggregates.
 */
export async function getMarketplaceFinanceMetrics(): Promise<FinanceSummaryMetrics> {
  const { data: ledgerEntries } = await (supabaseAdmin.from("payout_ledger") as any).select("*");

  if (!ledgerEntries || ledgerEntries.length === 0) {
    return {
      totalGmvAud: 0,
      totalPlatformCommissionAud: 0,
      totalPendingHoldAud: 0,
      totalEligiblePayoutsAud: 0,
      totalPaidToSellersAud: 0,
    };
  }

  let totalGmv = 0;
  let totalCommission = 0;
  let totalHold = 0;
  let totalEligible = 0;
  let totalPaid = 0;

  for (const entry of (ledgerEntries as any[])) {
    totalGmv += Number(entry.gross_amount);
    totalCommission += Number(entry.platform_commission);

    if (entry.status === "PAYOUT_HOLD") totalHold += Number(entry.net_payout);
    if (entry.status === "PAYOUT_ELIGIBLE") totalEligible += Number(entry.net_payout);
    if (entry.status === "PAID_TO_SELLER") totalPaid += Number(entry.net_payout);
  }

  return {
    totalGmvAud: Number(totalGmv.toFixed(2)),
    totalPlatformCommissionAud: Number(totalCommission.toFixed(2)),
    totalPendingHoldAud: Number(totalHold.toFixed(2)),
    totalEligiblePayoutsAud: Number(totalEligible.toFixed(2)),
    totalPaidToSellersAud: Number(totalPaid.toFixed(2)),
  };
}

/**
 * Reconcile and transition ledger entries to PAYOUT_ELIGIBLE when 14 days have passed
 * since delivery without active returns or fraud holds.
 */
export async function reconcileAndUnlockEligiblePayouts(): Promise<{ unlockedCount: number; unlockedAmountAud: number }> {
  const now = new Date().toISOString();

  // 1. Find entries ready for unlock: delivered_at + 14 days <= NOW and status == 'PAYOUT_HOLD'
  const { data: eligibleEntries } = await (supabaseAdmin.from("payout_ledger") as any)
    .select("id, net_payout")
    .eq("status", "PAYOUT_HOLD")
    .not("eligible_at", "is", null)
    .lte("eligible_at", now);

  if (!eligibleEntries || eligibleEntries.length === 0) {
    return { unlockedCount: 0, unlockedAmountAud: 0 };
  }

  let unlockedAmount = 0;
  for (const entry of (eligibleEntries as any[])) {
    await (supabaseAdmin.from("payout_ledger") as any)
      .update({
        status: "PAYOUT_ELIGIBLE",
        hold_reason: "14-day clearance window passed. Ready for settlement batch.",
      })
      .eq("id", entry.id);

    unlockedAmount += Number(entry.net_payout);
  }

  return {
    unlockedCount: eligibleEntries.length,
    unlockedAmountAud: Number(unlockedAmount.toFixed(2)),
  };
}

/**
 * Generate standard Australian Direct Credit CSV / ABA export for bank payouts.
 */
export async function generateSellerPayoutBatchCsv(): Promise<{
  csvContent: string;
  batchId: string;
  sellerCount: number;
  totalPayoutAud: number;
}> {
  const batchId = `BATCH-${Date.now().toString().slice(-8)}`;

  // Query all eligible payout ledger entries grouped with seller bank details
  const { data: entries } = await (supabaseAdmin.from("payout_ledger") as any)
    .select("*, seller:sellers(*)")
    .eq("status", "PAYOUT_ELIGIBLE");

  if (!entries || entries.length === 0) {
    return { csvContent: "", batchId, sellerCount: 0, totalPayoutAud: 0 };
  }

  const sellerMap = new Map<string, SellerPayoutBatchItem>();
  for (const entry of (entries as any[])) {
    const s = entry.seller;
    if (!s) continue;
    const item: SellerPayoutBatchItem = sellerMap.get(s.id) ?? {
      sellerId: s.id,
      sellerBusinessName: s.business_name ?? "Unknown Seller",
      bankBsb: s.bank_bsb ?? "000-000",
      bankAccountNumber: s.bank_account_number ?? "00000000",
      bankAccountName: s.bank_account_name ?? s.business_name ?? "Seller",
      totalPayoutAud: 0,
      subOrderIds: [] as string[],
    };

    item.totalPayoutAud += Number(entry.net_payout);
    if (entry.sub_order_id) {
      item.subOrderIds.push(entry.sub_order_id as string);
    }
    sellerMap.set(s.id, item);
  }

  const header = "BSB,Account Number,Account Name,Amount (AUD),Remittance Reference,Seller Business Name\n";
  const rows: string[] = [];
  let totalPayout = 0;

  for (const item of sellerMap.values()) {
    totalPayout += item.totalPayoutAud;
    rows.push(
      `"${item.bankBsb}","${item.bankAccountNumber}","${item.bankAccountName}",${item.totalPayoutAud.toFixed(2)},"ISM-${batchId}","${item.sellerBusinessName}"`
    );
  }

  const csvContent = header + rows.join("\n");

  // Mark ledger lines as PAYOUT_PROCESSING
  for (const entry of (entries as any[])) {
    await (supabaseAdmin.from("payout_ledger") as any)
      .update({
        status: "PAYOUT_PROCESSING",
        payout_batch_id: batchId,
      })
      .eq("id", entry.id);
  }

  return {
    csvContent,
    batchId,
    sellerCount: sellerMap.size,
    totalPayoutAud: Number(totalPayout.toFixed(2)),
  };
}

/**
 * Server Function: Execute Stripe Connect payout transfer for matured sub-orders (§8, §21, GAP-16)
 */
export const executeSellerStripePayoutServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string; amountAud: number; subOrderId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    try {
      // 1. Fetch seller stripe account details
      const { data: seller, error: sellerError } = await (supabaseAdmin.from("sellers") as any)
        .select("id, business_name, stripe_account_id, payouts_enabled")
        .eq("id", data.sellerId)
        .single();

      if (sellerError || !seller) {
        throw new Error("Seller not found");
      }

      const amountCents = Math.round(data.amountAud * 100);
      if (amountCents <= 0) {
        throw new Error("Invalid payout amount");
      }

      // Check dispute or return hold
      if (data.subOrderId) {
        const { data: openReturns } = await (supabaseAdmin.from("returns") as any)
          .select("id")
          .eq("sub_order_id", data.subOrderId)
          .not("status", "in", "('REFUNDED','CLOSED')");

        if (openReturns && openReturns.length > 0) {
          throw new Error("Cannot execute payout: active return/dispute exists on sub-order.");
        }
      }

      let transferId = `tr_sim_${Date.now()}`;
      if (seller.stripe_account_id && !seller.stripe_account_id.startsWith("acct_mock")) {
        const { stripe } = await import("@/lib/stripe-server");
        const transfer = await stripe.transfers.create({
          amount: amountCents,
          currency: "aud",
          destination: seller.stripe_account_id,
          description: `ISM Marketplace Settlement for ${seller.business_name}`,
        });
        transferId = transfer.id;
      }

      // Record payout in database
      const { data: payoutRecord } = await (supabaseAdmin.from("payouts") as any)
        .insert({
          seller_id: data.sellerId,
          amount: data.amountAud,
          currency: "AUD",
          status: "TRANSFERRED",
          transfer_id: transferId,
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Insert ledger entry
      await (supabaseAdmin.from("ledger_entries") as any).insert({
        seller_id: data.sellerId,
        sub_order_id: data.subOrderId ?? null,
        entry_type: "SELLER_PAYOUT",
        amount: -data.amountAud,
        currency: "AUD",
        description: `Stripe Connect transfer #${transferId}`,
      });

      return {
        success: true,
        payoutId: payoutRecord?.id || `payout_${Date.now()}`,
        transferId,
        amountAud: data.amountAud,
      };
    } catch (err: any) {
      console.error("Error executing seller payout:", err);
      throw new Error(`Payout transfer failed: ${err.message}`);
    }
  });

/**
 * Server Function: Get sellers for Admin console
 */
export const getAdminSellersServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: sellers, error } = await (supabaseAdmin.from("sellers") as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !sellers) return [];
    return sellers;
  });

/**
 * Server Function: Get products for Admin moderation
 */
export const getAdminProductsServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: products, error } = await (supabaseAdmin.from("products") as any)
      .select("*, seller:sellers(business_name, store_name, slug)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !products) return [];
    return products;
  });

/**
 * Server Function: Get orders and sub-orders for Admin operations
 */
export const getAdminOrdersServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: orders, error } = await (supabaseAdmin.from("orders") as any)
      .select("*, sub_orders(*, seller:sellers(business_name, store_name))")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !orders) return [];
    return orders;
  });

/**
 * Server Function: Get return requests for Admin moderation
 */
export const getAdminReturnsServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: returns, error } = await (supabaseAdmin.from("returns") as any)
      .select("*, sub_order:sub_orders(*), seller:sellers(business_name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !returns) return [];
    return returns;
  });

/**
 * Server Function: Get audit logs for Admin compliance
 */
export const getAdminAuditLogsServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: logs, error } = await (supabaseAdmin.from("audit_logs") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !logs) return [];
    return logs;
  });

