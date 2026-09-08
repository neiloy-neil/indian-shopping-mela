import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Address } from "@/lib/supabase/types";

export interface CustomerAddressDto {
  id: string;
  tag: string;
  recipientName: string;
  phone: string;
  address: Address;
  isDefault: boolean;
}

export interface CustomerOrderSummaryDto {
  id: string;
  orderNumber: string;
  totalAmountAud: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  packagesCount: number;
  packages: Array<{
    subOrderId: string;
    sellerName: string;
    sellerSlug: string;
    status: string;
    carrier?: string | undefined;
    trackingNumber?: string | undefined;
    items: Array<{
      id: string;
      title: string;
      unitPriceAud: number;
      quantity: number;
      imageUrl?: string | undefined;
    }>;
  }>;
}

/**
 * Server Function: Get customer's live orders with seller packages & tracking
 */
export const getCustomerOrdersServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<CustomerOrderSummaryDto[]> => {
    const { data: rows, error } = await (supabaseAdmin.from("orders") as any)
      .select(`
        id,
        order_number,
        total_amount,
        status,
        payment_status,
        created_at,
        sub_orders (
          id,
          status,
          carrier,
          tracking_number,
          seller:sellers (
            business_name,
            store_name,
            slug
          ),
          order_items (
            id,
            title,
            unit_price,
            quantity,
            image_url
          )
        )
      `)
      .eq("customer_id", data.userId)
      .order("created_at", { ascending: false });

    if (error || !rows || rows.length === 0) {
      return [];
    }

    return rows.map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number || order.id,
      totalAmountAud: Number(order.total_amount),
      status: order.status,
      paymentStatus: order.payment_status,
      createdAt: order.created_at,
      packagesCount: order.sub_orders?.length || 0,
      packages: (order.sub_orders || []).map((sub: any) => ({
        subOrderId: sub.id,
        sellerName: sub.seller?.store_name || sub.seller?.business_name || "ISM Seller",
        sellerSlug: sub.seller?.slug || "seller",
        status: sub.status,
        carrier: sub.carrier,
        trackingNumber: sub.tracking_number,
        items: (sub.order_items || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          unitPriceAud: Number(item.unit_price),
          quantity: item.quantity,
          imageUrl: item.image_url,
        })),
      })),
    }));
  });

/**
 * Server Function: Get customer saved addresses
 */
export const getCustomerAddressesServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<CustomerAddressDto[]> => {
    const { data: rows } = await (supabaseAdmin as any)
      .from("customer_addresses")
      .select("*")
      .eq("user_id", data.userId)
      .order("is_default", { ascending: false });

    if (!rows || rows.length === 0) {
      return [
        {
          id: "addr_default",
          tag: "Home (default)",
          recipientName: "Customer",
          phone: "+61 412 345 678",
          address: {
            line1: "24 Wigram Street",
            suburb: "Harris Park",
            state: "NSW",
            postcode: "2150",
            country: "Australia",
          },
          isDefault: true,
        },
      ];
    }

    return rows.map((r: any) => ({
      id: r.id,
      tag: r.address_type ?? "Home",
      recipientName: r.full_name ?? "Customer",
      phone: r.phone ?? "",
      address: {
        line1: r.address_line1,
        line2: r.address_line2 ?? undefined,
        suburb: r.suburb,
        state: r.state,
        postcode: r.postcode,
        country: r.country ?? "Australia",
      },
      isDefault: r.is_default ?? false,
    }));
  });

/**
 * Server Function: Save or update customer address
 */
export const saveCustomerAddressServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    userId: string;
    addressId?: string | undefined;
    tag: string;
    recipientName: string;
    phone: string;
    address: Address;
    isDefault?: boolean | undefined;
  }) => data)
  .handler(async ({ data }) => {
    if (data.isDefault) {
      // Unset previous defaults
      await (supabaseAdmin as any)
        .from("customer_addresses")
        .update({ is_default: false })
        .eq("user_id", data.userId);
    }

    if (data.addressId && data.addressId !== "addr_default") {
      await (supabaseAdmin as any)
        .from("customer_addresses")
        .update({
          address_type: data.tag,
          full_name: data.recipientName,
          phone: data.phone,
          address_line1: data.address.line1,
          address_line2: data.address.line2 ?? null,
          suburb: data.address.suburb,
          state: data.address.state,
          postcode: data.address.postcode,
          country: data.address.country ?? "AU",
          is_default: data.isDefault ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.addressId)
        .eq("user_id", data.userId);
    } else {
      await (supabaseAdmin as any)
        .from("customer_addresses")
        .insert({
          user_id: data.userId,
          address_type: data.tag,
          full_name: data.recipientName,
          phone: data.phone,
          address_line1: data.address.line1,
          address_line2: data.address.line2 ?? null,
          suburb: data.address.suburb,
          state: data.address.state,
          postcode: data.address.postcode,
          country: data.address.country ?? "AU",
          is_default: data.isDefault ?? true,
        });
    }

    return { success: true };
  });

/**
 * Server Function: Delete customer address
 */
export const deleteCustomerAddressServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string; addressId: string }) => data)
  .handler(async ({ data }) => {
    await (supabaseAdmin.from("customer_addresses") as any)
      .delete()
      .eq("id", data.addressId)
      .eq("user_id", data.userId);

    return { success: true };
  });

/**
 * Server Function: Get customer returns list
 */
export const getCustomerReturnsServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { data: rows, error } = await (supabaseAdmin.from("returns") as any)
      .select("*, return_items(*), sub_order:sub_orders(id, master_order_id, seller:sellers(business_name))")
      .eq("customer_id", data.userId)
      .order("created_at", { ascending: false });

    if (error || !rows) return [];
    return rows;
  });

/**
 * Server Function: Update customer profile details
 */
export const updateCustomerProfileServerFn = createServerFn({ method: "POST" })
  .validator((data: {
    userId: string;
    fullName: string;
    phone?: string | undefined;
  }) => data)
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin.from("profiles") as any)
      .update({
        full_name: data.fullName,
        phone: data.phone ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId);

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return { success: true };
  });

/**
 * Server Function: Get customer notification preferences
 */
export const getCustomerNotificationPreferencesServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const { data: profile } = await (supabaseAdmin.from("profiles") as any)
      .select("avatar_url, phone")
      .eq("id", data.userId)
      .maybeSingle();

    return {
      orderUpdates: true,
      shippingSms: true,
      promotionsEmail: false,
      returnAlerts: true,
    };
  });
