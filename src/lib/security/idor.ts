/**
 * Insecure Direct Object Reference (IDOR) & Multi-Tenant Authorization Guards
 */

import { supabaseAdmin } from "@/lib/supabase/server";

export class AuthorizationError extends Error {
  statusCode = 403;
  constructor(message: string = "Access denied: You do not have permission to access this resource.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Verify that the authenticated customer is the authoritative owner of the master order
 */
export async function assertCustomerOwnsOrder(userId: string, orderId: string): Promise<boolean> {
  const { data: order, error } = await (supabaseAdmin.from("orders") as any)
    .select("id, customer_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order || order.customer_id !== userId) {
    throw new AuthorizationError("You do not have access to this order.");
  }
  return true;
}

/**
 * Verify that the authenticated customer is the owner of the address record
 */
export async function assertCustomerOwnsAddress(userId: string, addressId: string): Promise<boolean> {
  const { data: address, error } = await (supabaseAdmin.from("customer_addresses") as any)
    .select("id, user_id")
    .eq("id", addressId)
    .maybeSingle();

  if (error || !address || address.user_id !== userId) {
    throw new AuthorizationError("You do not have access to this address.");
  }
  return true;
}

/**
 * Verify that the authenticated seller owns the product listing
 */
export async function assertSellerOwnsProduct(sellerId: string, productId: string): Promise<boolean> {
  const { data: product, error } = await (supabaseAdmin.from("products") as any)
    .select("id, seller_id")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product || product.seller_id !== sellerId) {
    throw new AuthorizationError("You do not have permission to manage this product.");
  }
  return true;
}

/**
 * Verify that the authenticated seller owns the sub-order package
 */
export async function assertSellerOwnsSubOrder(sellerId: string, subOrderId: string): Promise<boolean> {
  const { data: subOrder, error } = await (supabaseAdmin.from("sub_orders") as any)
    .select("id, seller_id")
    .eq("id", subOrderId)
    .maybeSingle();

  if (error || !subOrder || subOrder.seller_id !== sellerId) {
    throw new AuthorizationError("You do not have permission to manage this order package.");
  }
  return true;
}

/**
 * Verify that the actor holds Finance Admin or Super Admin role with validated MFA
 */
export async function assertFinanceAdminWithMfa(userId: string, isMfaVerified: boolean): Promise<boolean> {
  const { data: profile, error } = await (supabaseAdmin.from("profiles") as any)
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || !["admin_finance", "admin_super"].includes(profile.role)) {
    throw new AuthorizationError("Administrative finance role required.");
  }

  if (!isMfaVerified) {
    throw new AuthorizationError("Multi-Factor Authentication (MFA) verification is required for financial operations.");
  }

  return true;
}
