import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Database, LedgerEntryType } from "@/lib/supabase/types";

export type CanonicalLedgerEntryType = LedgerEntryType;

export interface LedgerEntryInput {
  orderId?: string | undefined;
  subOrderId?: string | undefined;
  sellerId?: string | undefined;
  entryType: CanonicalLedgerEntryType;
  amountCents: number;
  currency?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  idempotencyKey?: string | undefined;
}

export interface SellerOrderBreakdown {
  sellerId: string;
  subOrderId?: string | undefined;
  sellerGrossCents: number;
  commissionCents: number;
  shippingCents: number;
  refundsCents: number;
  disputeHoldCents: number;
}

export interface OrderReconciliationResult {
  orderId: string;
  totalCustomerPaymentCents: number;
  totalSellerCreditsCents: number;
  totalCommissionCents: number;
  totalGstCents: number;
  totalShippingCents: number;
  totalRefundsCents: number;
  totalDiscountsCents: number;
  totalAdjustmentsCents: number;
  sellerBreakdowns: Record<string, SellerOrderBreakdown>;
  isBalanced: boolean;
  discrepancyCents: number;
  entryCount: number;
}

export interface SellerLedgerBalance {
  sellerId: string;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  disputedHoldCents: number;
  totalPaidOutCents: number;
  totalEarnedGrossCents: number;
  totalCommissionPaidCents: number;
  totalRefundsDebitCents: number;
  currency: string;
}

/**
 * Server Function: Post an immutable double-entry ledger record.
 * Append-only: Ledger entries can never be modified or deleted.
 */
export const postLedgerEntryServerFn = createServerFn({ method: "POST" })
  .validator((data: LedgerEntryInput) => data)
  .handler(async ({ data }) => {
    return postLedgerEntry(data);
  });

interface SellerLedgerJoinedRow {
  id: string;
  amount_cents: number;
  entry_type: CanonicalLedgerEntryType;
  created_at: string;
  sub_order_id: string | null;
  sub_orders: {
    id: string;
    status: string;
    delivered_at: string | null;
    created_at: string;
  } | null;
}

export async function postLedgerEntry(
  entry: LedgerEntryInput,
): Promise<{ id: string; success: boolean }> {
  if (!Number.isInteger(entry.amountCents) || entry.amountCents < 0) {
    throw new Error(
      `Ledger entry amount must be a positive integer in cents. Received: ${entry.amountCents}`,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("ledger_entries")
    .insert({
      order_id: entry.orderId ?? null,
      sub_order_id: entry.subOrderId ?? null,
      seller_id: entry.sellerId ?? null,
      payout_batch_id: entry.metadata ? (entry.metadata["payoutBatchId"] as string) ?? null : null,
      entry_type: entry.entryType,
      amount_cents: entry.amountCents,
      currency: entry.currency ?? "AUD",
      description: entry.description ?? null,
      metadata: (entry.metadata as unknown as Database["public"]["Tables"]["ledger_entries"]["Insert"]["metadata"]) ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to post ledger entry: ${error.message}`);
  }

  return { id: data.id, success: true };
}

/**
 * Server Function: Authoritatively reconcile an order's financial ledger double-entries.
 */
export const reconcileOrderLedgerServerFn = createServerFn({ method: "POST" })
  .validator((data: { orderId: string }) => data)
  .handler(async ({ data }) => {
    return reconcileOrderLedger(data.orderId);
  });

export async function reconcileOrderLedger(orderId: string): Promise<OrderReconciliationResult> {
  const { data: entries, error } = await supabaseAdmin
    .from("ledger_entries")
    .select("*")
    .eq("order_id", orderId);

  if (error) {
    throw new Error(`Failed to load ledger entries for order ${orderId}: ${error.message}`);
  }

  const rows = entries || [];
  let totalCustomerPaymentCents = 0;
  let totalSellerCreditsCents = 0;
  let totalCommissionCents = 0;
  let totalGstCents = 0;
  let totalShippingCents = 0;
  let totalRefundsCents = 0;
  let totalDiscountsCents = 0;
  let totalAdjustmentsCents = 0;

  const sellerBreakdowns: Record<string, SellerOrderBreakdown> = {};

  for (const row of rows) {
    const amount = Number(row.amount_cents) || 0;
    const type: string = row.entry_type;
    const sId = row.seller_id;

    if (sId && !sellerBreakdowns[sId]) {
      sellerBreakdowns[sId] = {
        sellerId: sId,
        subOrderId: row.sub_order_id ?? undefined,
        sellerGrossCents: 0,
        commissionCents: 0,
        shippingCents: 0,
        refundsCents: 0,
        disputeHoldCents: 0,
      };
    }

    if (type === "CUSTOMER_CHARGE" || type === "CUSTOMER_PAYMENT") {
      totalCustomerPaymentCents += amount;
    } else if (type === "SELLER_GROSS" || type === "SELLER_CREDIT") {
      totalSellerCreditsCents += amount;
      if (sId && sellerBreakdowns[sId]) sellerBreakdowns[sId]!.sellerGrossCents += amount;
    } else if (type === "ISM_COMMISSION" || type === "PLATFORM_COMMISSION") {
      totalCommissionCents += amount;
      if (sId && sellerBreakdowns[sId]) sellerBreakdowns[sId]!.commissionCents += amount;
    } else if (type === "GST_COLLECTED" || type === "GST_REMITTANCE") {
      totalGstCents += amount;
    } else if (type === "SHIPPING_FEE" || type === "SHIPPING_CHARGE" || type === "SHIPPING_COST") {
      totalShippingCents += amount;
      if (sId && sellerBreakdowns[sId]) sellerBreakdowns[sId]!.shippingCents += amount;
    } else if (type === "CUSTOMER_REFUND" || type === "REFUND_CUSTOMER" || type === "REFUND") {
      totalRefundsCents += amount;
      if (sId && sellerBreakdowns[sId]) sellerBreakdowns[sId]!.refundsCents += amount;
    } else if (type === "DISCOUNT") {
      totalDiscountsCents += amount;
    } else if (type === "ADJUSTMENT") {
      totalAdjustmentsCents += amount;
    } else if (type === "DISPUTE_HOLD") {
      if (sId && sellerBreakdowns[sId]) sellerBreakdowns[sId]!.disputeHoldCents += amount;
    } else if (type === "DISPUTE_RELEASE") {
      if (sId && sellerBreakdowns[sId]) {
        sellerBreakdowns[sId]!.disputeHoldCents = Math.max(
          0,
          sellerBreakdowns[sId]!.disputeHoldCents - amount,
        );
      }
    }
  }

  // Double-entry accounting equality check:
  // Customer Charge + Discount == Total Seller Credits (Net) + Platform Commission
  const expectedTotal = totalSellerCreditsCents + totalCommissionCents;
  const discrepancyCents = Math.abs(totalCustomerPaymentCents - expectedTotal);
  const isBalanced = discrepancyCents === 0;

  return {
    orderId,
    totalCustomerPaymentCents,
    totalSellerCreditsCents,
    totalCommissionCents,
    totalGstCents,
    totalShippingCents,
    totalRefundsCents,
    totalDiscountsCents,
    totalAdjustmentsCents,
    sellerBreakdowns,
    isBalanced,
    discrepancyCents,
    entryCount: rows.length,
  };
}

/**
 * Server Function: Compute a seller's real-time financial ledger balance.
 */
export const getSellerLedgerBalanceServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string }) => data)
  .handler(async ({ data }) => {
    return getSellerLedgerBalance(data.sellerId);
  });

export async function getSellerLedgerBalance(sellerId: string): Promise<SellerLedgerBalance> {
  const { data: rawEntries, error } = await supabaseAdmin
    .from("ledger_entries")
    .select(
      `
      id,
      amount_cents,
      entry_type,
      created_at,
      sub_order_id,
      sub_orders:sub_orders (
        id,
        status,
        delivered_at,
        created_at
      )
    `,
    )
    .eq("seller_id", sellerId);

  if (error) {
    throw new Error(`Failed to load seller ledger entries for ${sellerId}: ${error.message}`);
  }

  const rows = (rawEntries || []) as unknown as SellerLedgerJoinedRow[];
  let availableBalanceCents = 0;
  let pendingBalanceCents = 0;
  let disputedHoldCents = 0;
  let totalPaidOutCents = 0;
  let totalEarnedGrossCents = 0;
  let totalCommissionPaidCents = 0;
  let totalRefundsDebitCents = 0;

  const now = new Date();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    const amount = Number(row.amount_cents) || 0;
    const entryType: string = row.entry_type;

    if (entryType === "SELLER_GROSS" || entryType === "SELLER_CREDIT") {
      totalEarnedGrossCents += amount;
      const subOrder = row.sub_orders;

      // Payout eligibility requires delivered status + 14-day hold expiration
      if (subOrder?.delivered_at) {
        const deliveredDate = new Date(subOrder.delivered_at);
        const maturedAt = new Date(deliveredDate.getTime() + FOURTEEN_DAYS_MS);
        if (now >= maturedAt) {
          availableBalanceCents += amount;
        } else {
          pendingBalanceCents += amount;
        }
      } else {
        pendingBalanceCents += amount;
      }
    } else if (entryType === "SELLER_PAYOUT" || entryType === "PAYOUT" || entryType === "SELLER_DEBIT") {
      totalPaidOutCents += amount;
      availableBalanceCents = Math.max(0, availableBalanceCents - amount);
    } else if (entryType === "DISPUTE_HOLD") {
      disputedHoldCents += amount;
      availableBalanceCents = Math.max(0, availableBalanceCents - amount);
    } else if (entryType === "DISPUTE_RELEASE") {
      disputedHoldCents = Math.max(0, disputedHoldCents - amount);
      availableBalanceCents += amount;
    } else if (entryType === "CUSTOMER_REFUND" || entryType === "REFUND_CUSTOMER" || entryType === "REFUND") {
      totalRefundsDebitCents += amount;
      availableBalanceCents = Math.max(0, availableBalanceCents - amount);
    } else if (entryType === "ISM_COMMISSION" || entryType === "PLATFORM_COMMISSION") {
      totalCommissionPaidCents += amount;
    } else if (entryType === "ADJUSTMENT") {
      availableBalanceCents = Math.max(0, availableBalanceCents - amount);
    }
  }

  return {
    sellerId,
    availableBalanceCents,
    pendingBalanceCents,
    disputedHoldCents,
    totalPaidOutCents,
    totalEarnedGrossCents,
    totalCommissionPaidCents,
    totalRefundsDebitCents,
    currency: "AUD",
  };
}
