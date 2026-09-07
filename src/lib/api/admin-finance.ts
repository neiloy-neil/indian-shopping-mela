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
