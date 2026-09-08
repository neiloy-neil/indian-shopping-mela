import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";

export type CanonicalLedgerEntryType =
  | "CUSTOMER_PAYMENT"
  | "SELLER_CREDIT"
  | "PLATFORM_COMMISSION"
  | "SHIPPING_FEE"
  | "GST_REMITTANCE"
  | "REFUND_CUSTOMER"
  | "REFUND_COMMISSION_ADJUSTMENT"
  | "SELLER_DEBIT"
  | "SELLER_PAYOUT"
  | "DISPUTE_HOLD";

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

export interface OrderReconciliationResult {
  orderId: string;
  totalCustomerPaymentCents: number;
  totalSellerCreditsCents: number;
  totalCommissionCents: number;
  totalGstCents: number;
  totalShippingCents: number;
  totalRefundsCents: number;
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

export async function postLedgerEntry(entry: LedgerEntryInput): Promise<{ id: string; success: boolean }> {
  if (!Number.isInteger(entry.amountCents) || entry.amountCents < 0) {
    throw new Error(`Ledger entry amount must be a positive integer in cents. Received: ${entry.amountCents}`);
  }

  const { data, error } = await (supabaseAdmin.from("ledger_entries") as any)
    .insert({
      order_id: entry.orderId ?? null,
      sub_order_id: entry.subOrderId ?? null,
      seller_id: entry.sellerId ?? null,
      entry_type: entry.entryType,
      amount_cents: entry.amountCents,
      currency: entry.currency ?? "AUD",
      description: entry.description ?? null,
      metadata: entry.metadata ?? null,
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
  const { data: entries, error } = await (supabaseAdmin.from("ledger_entries") as any)
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

  for (const row of rows) {
    const amount = Number(row.amount_cents) || 0;
    switch (row.entry_type as CanonicalLedgerEntryType) {
      case "CUSTOMER_PAYMENT":
        totalCustomerPaymentCents += amount;
        break;
      case "SELLER_CREDIT":
        totalSellerCreditsCents += amount;
        break;
      case "PLATFORM_COMMISSION":
        totalCommissionCents += amount;
        break;
      case "GST_REMITTANCE":
        totalGstCents += amount;
        break;
      case "SHIPPING_FEE":
        totalShippingCents += amount;
        break;
      case "REFUND_CUSTOMER":
        totalRefundsCents += amount;
        break;
      default:
        break;
    }
  }

  // Double-entry accounting equality check:
  // Customer Charge == Seller Gross + Platform Commission
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
  const { data: entries, error } = await (supabaseAdmin.from("ledger_entries") as any)
    .select(`
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
    `)
    .eq("seller_id", sellerId);

  if (error) {
    throw new Error(`Failed to load seller ledger entries for ${sellerId}: ${error.message}`);
  }

  const rows = entries || [];
  let availableBalanceCents = 0;
  let pendingBalanceCents = 0;
  let disputedHoldCents = 0;
  let totalPaidOutCents = 0;
  let totalEarnedGrossCents = 0;

  const now = new Date();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    const amount = Number(row.amount_cents) || 0;
    const entryType = row.entry_type as CanonicalLedgerEntryType;

    if (entryType === "SELLER_CREDIT") {
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
    } else if (entryType === "SELLER_PAYOUT" || entryType === "SELLER_DEBIT") {
      totalPaidOutCents += amount;
      availableBalanceCents = Math.max(0, availableBalanceCents - amount);
    } else if (entryType === "DISPUTE_HOLD") {
      disputedHoldCents += amount;
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
    currency: "AUD",
  };
}
