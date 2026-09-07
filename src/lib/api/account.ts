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

/**
 * Server Function: Get customer saved addresses
 */
export const getCustomerAddressesServerFn = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<CustomerAddressDto[]> => {
    const { data: rows } = await (supabaseAdmin as any)
      .from("addresses")
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
      tag: r.tag ?? "Home",
      recipientName: r.recipient_name ?? "Customer",
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
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", data.userId);
    }

    if (data.addressId && data.addressId !== "addr_default") {
      await (supabaseAdmin as any)
        .from("addresses")
        .update({
          tag: data.tag,
          recipient_name: data.recipientName,
          phone: data.phone,
          address_line1: data.address.line1,
          address_line2: data.address.line2 ?? null,
          suburb: data.address.suburb,
          state: data.address.state,
          postcode: data.address.postcode,
          country: data.address.country,
          is_default: data.isDefault ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.addressId)
        .eq("user_id", data.userId);
    } else {
      await (supabaseAdmin as any)
        .from("addresses")
        .insert({
          user_id: data.userId,
          tag: data.tag,
          recipient_name: data.recipientName,
          phone: data.phone,
          address_line1: data.address.line1,
          address_line2: data.address.line2 ?? null,
          suburb: data.address.suburb,
          state: data.address.state,
          postcode: data.address.postcode,
          country: data.address.country,
          is_default: data.isDefault ?? true,
        });
    }

    return { success: true };
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
