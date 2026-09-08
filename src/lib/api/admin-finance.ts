import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import { executeSellerPayoutTransfer, getSellerPayoutEligibility } from "./payouts";
import { postLedgerEntry } from "./ledger";
import { executeReturnRefund } from "./returns";

export interface FinanceSummaryMetrics {
  totalGmvAud: number;
  totalPlatformCommissionAud: number;
  totalPendingHoldAud: number;
  totalEligiblePayoutsAud: number;
  totalPaidToSellersAud: number;
}

/**
 * Server Function: Get finance summary metrics from authoritative ledger_entries
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

export async function generateSellerPayoutBatchCsv(): Promise<{
  csvContent: string;
  batchId: string;
  sellerCount: number;
  totalPayoutAud: number;
}> {
  const batchId = `BATCH-${Date.now().toString().slice(-8)}`;

  const { data: sellers } = await (supabaseAdmin.from("sellers") as any)
    .select("id, business_name, store_name, stripe_account_id")
    .in("status", ["APPROVED", "approved", "ACTIVE"]);

  let totalPayoutAud = 0;
  const rows: string[] = [];

  for (const seller of sellers || []) {
    const eligibility = await getSellerPayoutEligibility(seller.id);
    if (eligibility.isEligibleForPayout) {
      totalPayoutAud += eligibility.totalNetPayoutAud;
      rows.push(
        `"${seller.id}","${seller.business_name}","${seller.stripe_account_id ?? ""}",${eligibility.totalNetPayoutAud.toFixed(2)},"ISM-${batchId}","${eligibility.eligibleSubOrderIds.length} sub-orders"`
      );
    }
  }

  const csvHeader = "Seller ID,Business Name,Stripe Connected Account,Net Payout (AUD),Batch Reference,Matured Orders\n";
  const csvContent = csvHeader + rows.join("\n");

  return {
    csvContent,
    batchId,
    sellerCount: rows.length,
    totalPayoutAud: Number(totalPayoutAud.toFixed(2)),
  };
}

/**
 * Server Function: Moderate seller status (APPROVED, REJECTED, SUSPENDED, INFO_REQUIRED)
 */
export const moderateSellerStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string; status: "APPROVED" | "REJECTED" | "SUSPENDED" | "INFO_REQUIRED"; reason?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("sellers") as any)
      .update({
        status: data.status.toLowerCase(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.sellerId);

    if (error) throw new Error(`Failed to update seller status: ${error.message}`);

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: `SELLER_${data.status}`,
      entity_type: "SELLER",
      entity_id: data.sellerId,
      new_data: { status: data.status, reason: data.reason },
    });

    return { success: true };
  });

/**
 * Server Function: Moderate product status (LIVE, REJECTED, ARCHIVED)
 */
export const moderateProductStatusServerFn = createServerFn({ method: "POST" })
  .validator((data: { productId: string; status: "LIVE" | "REJECTED" | "ARCHIVED"; notes?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("products") as any)
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.productId);

    if (error) throw new Error(`Failed to update product status: ${error.message}`);

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: `PRODUCT_${data.status}`,
      entity_type: "PRODUCT",
      entity_id: data.productId,
      new_data: { status: data.status, notes: data.notes },
    });

    return { success: true };
  });

/**
 * Server Function: Moderate return request
 */
export const moderateReturnServerFn = createServerFn({ method: "POST" })
  .validator((data: { returnId: string; action: "APPROVE" | "REJECT" | "REFUND"; notes?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { data: returnReq, error: fetchErr } = await (supabaseAdmin.from("returns") as any)
      .select("id, sub_order_id, refund_amount, status")
      .eq("id", data.returnId)
      .maybeSingle();

    if (fetchErr || !returnReq) throw new Error("Return request not found");

    if (data.action === "APPROVE") {
      await (supabaseAdmin.from("returns") as any)
        .update({ status: "APPROVED", approved_at: new Date().toISOString() })
        .eq("id", data.returnId);
    } else if (data.action === "REJECT") {
      await (supabaseAdmin.from("returns") as any)
        .update({ status: "REJECTED" })
        .eq("id", data.returnId);
    } else if (data.action === "REFUND") {
      // Execute Stripe refund
      await executeReturnRefund(data.returnId, Number(returnReq.refund_amount) || undefined);
    }

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: `RETURN_${data.action}`,
      entity_type: "RETURN",
      entity_id: data.returnId,
      new_data: { action: data.action, notes: data.notes },
    });

    return { success: true };
  });

/**
 * Fetch marketplace financial aggregates from immutable ledger_entries.
 */
export async function getMarketplaceFinanceMetrics(): Promise<FinanceSummaryMetrics> {
  const { data: ledgerEntries, error } = await (supabaseAdmin.from("ledger_entries") as any).select("*");

  if (error || !ledgerEntries || ledgerEntries.length === 0) {
    return {
      totalGmvAud: 0,
      totalPlatformCommissionAud: 0,
      totalPendingHoldAud: 0,
      totalEligiblePayoutsAud: 0,
      totalPaidToSellersAud: 0,
    };
  }

  let totalGmvCents = 0;
  let totalCommissionCents = 0;
  let totalHoldCents = 0;
  let totalPaidCents = 0;

  for (const entry of (ledgerEntries as any[])) {
    const amount = Number(entry.amount_cents) || 0;
    if (entry.entry_type === "CUSTOMER_PAYMENT" || entry.entry_type === "CUSTOMER_CHARGE") totalGmvCents += amount;
    if (entry.entry_type === "PLATFORM_COMMISSION" || entry.entry_type === "ISM_COMMISSION") totalCommissionCents += amount;
    if (entry.entry_type === "DISPUTE_HOLD") totalHoldCents += amount;
    if (entry.entry_type === "SELLER_PAYOUT") totalPaidCents += amount;
  }

  return {
    totalGmvAud: Number((totalGmvCents / 100).toFixed(2)),
    totalPlatformCommissionAud: Number((totalCommissionCents / 100).toFixed(2)),
    totalPendingHoldAud: Number((totalHoldCents / 100).toFixed(2)),
    totalEligiblePayoutsAud: Number((Math.max(0, totalGmvCents - totalCommissionCents - totalHoldCents - totalPaidCents) / 100).toFixed(2)),
    totalPaidToSellersAud: Number((totalPaidCents / 100).toFixed(2)),
  };
}

/**
 * Reconcile and calculate matured payouts across all active sellers.
 */
export async function reconcileAndUnlockEligiblePayouts(): Promise<{
  eligibleSellersCount: number;
  totalEligiblePayoutAud: number;
}> {
  const { data: sellers } = await (supabaseAdmin.from("sellers") as any)
    .select("id")
    .in("status", ["APPROVED", "approved", "ACTIVE"]);

  let eligibleSellersCount = 0;
  let totalEligiblePayoutAud = 0;

  for (const seller of sellers || []) {
    const eligibility = await getSellerPayoutEligibility(seller.id);
    if (eligibility.isEligibleForPayout) {
      eligibleSellersCount++;
      totalEligiblePayoutAud += eligibility.totalNetPayoutAud;
    }
  }

  return {
    eligibleSellersCount,
    totalEligiblePayoutAud: Number(totalEligiblePayoutAud.toFixed(2)),
  };
}

/**
 * Server Function: Execute Stripe Connect payout transfer for matured sub-orders
 */
export const executeSellerStripePayoutServerFn = createServerFn({ method: "POST" })
  .validator((data: { sellerId: string; isMfaVerified?: boolean | undefined; adminId?: string | undefined }) => data)
  .handler(async ({ data }) => {
    return executeSellerPayoutTransfer(data.sellerId, data.isMfaVerified ?? false, data.adminId);
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

/**
 * Server Function: Get marketplace settings / configurations
 */
export const getMarketplaceConfigServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: configs, error } = await (supabaseAdmin.from("marketplace_configs") as any)
      .select("*");

    if (error || !configs) return [];
    return configs;
  });

/**
 * Server Function: Update marketplace settings / configuration item
 */
export const updateMarketplaceConfigServerFn = createServerFn({ method: "POST" })
  .validator((data: { key: string; value: any; description?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("marketplace_configs") as any)
      .upsert({
        key: data.key,
        value: data.value,
        description: data.description ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    if (error) throw new Error(`Failed to update marketplace config: ${error.message}`);

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: "MARKETPLACE_CONFIG_UPDATED",
      entity_type: "CONFIG",
      entity_id: data.key,
      new_data: { key: data.key, value: data.value },
    });

    return { success: true };
  });

/**
 * Server Function: Get users & roles for Admin management
 */
export const getAdminUsersServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: users, error } = await (supabaseAdmin.from("profiles") as any)
      .select("id, email, full_name, role, created_at, phone")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !users) return [];
    return users;
  });

/**
 * Server Function: Update user role (Customer, Seller, Admin, Super Admin)
 */
export const updateUserRoleServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; newRole: "customer" | "seller" | "admin" | "super_admin" }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("profiles") as any)
      .update({
        role: data.newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId);

    if (error) throw new Error(`Failed to update user role: ${error.message}`);

    await (supabaseAdmin.from("audit_logs") as any).insert({
      action: "USER_ROLE_CHANGED",
      entity_type: "USER",
      entity_id: data.userId,
      new_data: { newRole: data.newRole },
    });

    return { success: true };
  });

/**
 * Server Function: Get immutable ledger records
 */
export const getAdminLedgerServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: ledger, error } = await (supabaseAdmin.from("ledger_entries") as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !ledger) return [];
    return ledger;
  });

/**
 * Server Function: Get shipping exceptions & delayed packages
 */
export const getAdminShippingExceptionsServerFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: shipments, error } = await (supabaseAdmin.from("shipments") as any)
      .select("*, sub_order:sub_orders(id, master_order_id, seller:sellers(business_name))")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !shipments) return [];
    return shipments;
  });
