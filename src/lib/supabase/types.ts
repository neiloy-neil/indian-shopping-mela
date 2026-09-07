export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole =
  | "customer"
  | "seller_owner"
  | "seller_staff"
  | "admin_support"
  | "admin_catalogue"
  | "admin_finance"
  | "admin_super";

export type OnboardingStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INFO_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

export type ProductStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "LIVE"
  | "PAUSED"
  | "OUT_OF_STOCK"
  | "REJECTED"
  | "ARCHIVED";

export type SubOrderStatus =
  | "ORDER_CREATED"
  | "SELLER_NOTIFIED"
  | "SELLER_ACCEPTED"
  | "PREPARING"
  | "READY_TO_SHIP"
  | "LABEL_CREATED"
  | "PICKUP_SCHEDULED"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "DISPUTED";

export type PayoutStatus =
  | "PAYOUT_HOLD"
  | "PAYOUT_ELIGIBLE"
  | "PAYOUT_PROCESSING"
  | "PAID_TO_SELLER"
  | "CANCELLED";

export type ReturnStatus =
  | "RETURN_REQUESTED"
  | "RETURN_APPROVED"
  | "RETURN_IN_TRANSIT"
  | "RETURN_RECEIVED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REJECTED";

export interface Address {
  line1: string;
  line2?: string;
  suburb: string;
  state: string; // NSW, VIC, QLD, WA, SA, TAS, ACT, NT
  postcode: string;
  country: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          phone_verified: boolean;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          phone_verified?: boolean;
          role?: UserRole;
          avatar_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      sellers: {
        Row: {
          id: string;
          owner_id: string;
          business_name: string;
          legal_name: string;
          abn: string;
          business_type: string;
          slug: string;
          logo_url: string | null;
          banner_url: string | null;
          about_text: string | null;
          status: OnboardingStatus;
          risk_flag: boolean;
          commission_rate: number;
          handling_days_default: number;
          holiday_mode: boolean;
          dispatch_address: Address;
          return_address: Address;
          bank_bsb: string | null;
          bank_account_number: string | null;
          bank_account_name: string | null;
          terms_accepted_version: string | null;
          terms_accepted_at: string | null;
          approved_by: string | null;
          approved_at: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sellers"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sellers"]["Insert"]>;
      };
      seller_staff: {
        Row: {
          id: string;
          seller_id: string;
          user_id: string;
          staff_role: string;
          permissions: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["seller_staff"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["seller_staff"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          seller_id: string;
          title: string;
          slug: string;
          department: string;
          category_id: string;
          subcategory: string | null;
          description: string;
          key_features: string[];
          care_instructions: string | null;
          country_of_origin: string;
          return_eligible: boolean;
          handling_days: number;
          weight_kg: number;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
          fragile: boolean;
          status: ProductStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          seller_sku: string;
          title: string;
          price: number;
          sale_price: number | null;
          sale_start_at: string | null;
          sale_end_at: string | null;
          stock_quantity: number;
          reserved_quantity: number;
          low_stock_threshold: number;
          weight_kg_override: number | null;
          attributes: Record<string, string>;
          images: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["product_variants"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variants"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          customer_id: string | null;
          customer_email: string;
          customer_name: string;
          customer_phone: string | null;
          shipping_address: Address;
          billing_address: Address;
          subtotal: number;
          shipping_total: number;
          gst_total: number;
          discount_total: number;
          total_amount: number;
          payment_provider: string;
          payment_intent_id: string | null;
          payment_status: "PAYMENT_PENDING" | "PAID" | "PAYMENT_FAILED";
          payment_authorized_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      sub_orders: {
        Row: {
          id: string;
          master_order_id: string;
          seller_id: string;
          status: SubOrderStatus;
          package_label: string;
          carrier: string;
          tracking_number: string | null;
          tracking_url: string | null;
          shipping_service: string;
          shipping_cost: number;
          dispatch_deadline: string | null;
          seller_accepted_at: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          can_return_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sub_orders"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["sub_orders"]["Insert"]>;
      };
      order_items: {
        Row: {
          id: string;
          sub_order_id: string;
          product_id: string | null;
          variant_id: string | null;
          product_name: string;
          variant_name: string;
          sku: string;
          unit_price: number;
          quantity: number;
          total_price: number;
          gst_amount: number;
        };
        Insert: Omit<Database["public"]["Tables"]["order_items"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
      };
      payout_ledger: {
        Row: {
          id: string;
          seller_id: string;
          sub_order_id: string;
          gross_amount: number;
          platform_commission: number;
          shipping_cost_allocated: number;
          net_payout: number;
          status: PayoutStatus;
          hold_reason: string | null;
          eligible_at: string | null;
          paid_at: string | null;
          payout_batch_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payout_ledger"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payout_ledger"]["Insert"]>;
      };
      return_requests: {
        Row: {
          id: string;
          sub_order_id: string;
          order_item_id: string;
          customer_id: string | null;
          quantity: number;
          reason: string;
          reason_code: string;
          evidence_urls: string[];
          status: ReturnStatus;
          refund_amount: number | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["return_requests"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["return_requests"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_role: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          before_data: Json | null;
          after_data: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
      seller_agreements: {
        Row: {
          id: string;
          seller_id: string;
          user_id: string;
          agreement_type: string;
          version: string;
          ip_address: string | null;
          user_agent: string | null;
          accepted_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["seller_agreements"]["Row"], "id" | "accepted_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["seller_agreements"]["Insert"]>;
      };
      seller_documents: {
        Row: {
          id: string;
          seller_id: string;
          document_type: string;
          file_path: string;
          file_name: string;
          file_size_bytes: number | null;
          mime_type: string | null;
          status: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
          reviewer_id: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["seller_documents"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["seller_documents"]["Insert"]>;
      };
      departments: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon_name: string | null;
          banner_url: string | null;
          sort_order: number;
          is_active: boolean;
          seo_title: string | null;
          seo_description: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["departments"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
      };
      attribute_options: {
        Row: {
          id: string;
          attribute_id: string;
          code: string;
          label: string;
          color_hex: string | null;
          sort_order: number;
          is_active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["attribute_options"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["attribute_options"]["Insert"]>;
      };
      collections: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          banner_url: string | null;
          tagline: string | null;
          featured: boolean;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["collections"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["collections"]["Insert"]>;
      };
      product_collections: {
        Row: {
          product_id: string;
          collection_id: string;
          sort_order: number;
        };
        Insert: Database["public"]["Tables"]["product_collections"]["Row"];
        Update: Partial<Database["public"]["Tables"]["product_collections"]["Insert"]>;
      };
      product_variant_options: {
        Row: {
          variant_id: string;
          attribute_id: string;
          option_id: string | null;
          custom_value: string | null;
        };
        Insert: Database["public"]["Tables"]["product_variant_options"]["Row"];
        Update: Partial<Database["public"]["Tables"]["product_variant_options"]["Insert"]>;
      };
      product_moderation_logs: {
        Row: {
          id: string;
          product_id: string;
          admin_id: string | null;
          from_status: ProductStatus | null;
          to_status: ProductStatus;
          reason: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["product_moderation_logs"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["product_moderation_logs"]["Insert"]>;
      };
      inventory_transactions: {
        Row: {
          id: string;
          variant_id: string;
          delta: number;
          balance_after: number;
          reason: string;
          actor_id: string | null;
          order_id: string | null;
          batch_id: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["inventory_transactions"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["inventory_transactions"]["Insert"]>;
      };
      inventory_reservations: {
        Row: {
          id: string;
          variant_id: string;
          reference_type: string;
          reference_id: string;
          quantity: number;
          status: "RESERVED" | "CONFIRMED" | "RELEASED" | "EXPIRED";
          expires_at: string;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["inventory_reservations"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["inventory_reservations"]["Insert"]>;
      };
      customer_addresses: {
        Row: {
          id: string;
          user_id: string;
          contact_name: string;
          contact_phone: string | null;
          line1: string;
          line2: string | null;
          suburb: string;
          state: string;
          postcode: string;
          country: string;
          is_default_shipping: boolean;
          is_default_billing: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["customer_addresses"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["customer_addresses"]["Insert"]>;
      };
      carts: {
        Row: {
          id: string;
          user_id: string | null;
          guest_token: string | null;
          status: "ACTIVE" | "CONVERTED" | "ABANDONED";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["carts"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["carts"]["Insert"]>;
      };
      cart_lines: {
        Row: {
          id: string;
          cart_id: string;
          variant_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["cart_lines"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["cart_lines"]["Insert"]>;
      };
      wishlists: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["wishlists"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["wishlists"]["Insert"]>;
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string | null;
          sub_order_id: string | null;
          from_status: string | null;
          to_status: string;
          actor_id: string | null;
          actor_role: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["order_status_history"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["order_status_history"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          provider: string;
          provider_payment_id: string;
          amount_cents: number;
          currency: string;
          status: string;
          idempotency_key: string | null;
          payment_method_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payments"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      ledger_entries: {
        Row: {
          id: string;
          entry_type:
            | "CUSTOMER_CHARGE"
            | "SELLER_GROSS"
            | "ISM_COMMISSION"
            | "PAYMENT_FEE"
            | "SHIPPING_CHARGE"
            | "SHIPPING_COST"
            | "DISCOUNT"
            | "REFUND"
            | "ADJUSTMENT"
            | "TRANSFER"
            | "PAYOUT";
          amount_cents: number;
          currency: string;
          seller_id: string | null;
          order_id: string | null;
          sub_order_id: string | null;
          payout_batch_id: string | null;
          description: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ledger_entries"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["ledger_entries"]["Insert"]>;
      };
      shipments: {
        Row: {
          id: string;
          sub_order_id: string;
          carrier: string;
          shipping_service: string;
          provider_shipment_id: string | null;
          tracking_number: string | null;
          label_url: string | null;
          shipping_cost_cents: number;
          status: string;
          dispatched_at: string | null;
          delivered_at: string | null;
          pod_signature_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["shipments"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["shipments"]["Insert"]>;
      };
      tracking_events: {
        Row: {
          id: string;
          shipment_id: string;
          carrier_status: string;
          ism_status: string;
          event_description: string;
          location: string | null;
          event_timestamp: string;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tracking_events"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["tracking_events"]["Insert"]>;
      };
      returns: {
        Row: {
          id: string;
          sub_order_id: string;
          customer_id: string | null;
          status: ReturnStatus;
          reason: string;
          reason_code: string;
          payout_hold_placed: boolean;
          evidence_urls: string[];
          seller_notes: string | null;
          admin_notes: string | null;
          approved_at: string | null;
          received_at: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["returns"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["returns"]["Insert"]>;
      };
      return_items: {
        Row: {
          id: string;
          return_id: string;
          order_item_id: string;
          quantity: number;
          condition_reported: string | null;
          refund_amount_cents: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["return_items"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["return_items"]["Insert"]>;
      };
      refunds: {
        Row: {
          id: string;
          return_id: string | null;
          order_id: string;
          sub_order_id: string;
          provider_refund_id: string | null;
          amount_cents: number;
          reason: string;
          status: string;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["refunds"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["refunds"]["Insert"]>;
      };
      payouts: {
        Row: {
          id: string;
          seller_id: string;
          amount_cents: number;
          status: PayoutStatus;
          provider_transfer_id: string | null;
          payout_batch_id: string | null;
          cleared_at: string | null;
          paid_at: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payouts"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["payouts"]["Insert"]>;
      };
      payout_items: {
        Row: {
          id: string;
          payout_id: string;
          ledger_entry_id: string;
          amount_cents: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["payout_items"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["payout_items"]["Insert"]>;
      };
      marketplace_configs: {
        Row: {
          id: string;
          version: number;
          config_key: string;
          config_value: Json;
          description: string | null;
          changed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["marketplace_configs"]["Row"], "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["marketplace_configs"]["Insert"]>;
      };
      webhook_events: {
        Row: {
          id: string;
          provider: string;
          provider_event_id: string;
          event_type: string;
          signature_verified: boolean;
          payload: Json;
          status: string;
          attempts: number;
          last_error: string | null;
          processed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["webhook_events"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["webhook_events"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          recipient_email: string | null;
          recipient_phone: string | null;
          channel: string;
          template_name: string;
          entity_type: string;
          entity_id: string;
          provider_message_id: string | null;
          status: string;
          idempotency_key: string | null;
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      bulk_import_batches: {
        Row: {
          id: string;
          seller_id: string;
          uploader_id: string;
          file_name: string;
          file_path: string;
          template_version: string;
          import_mode: string;
          total_rows: number;
          valid_rows: number;
          error_rows: number;
          status: string;
          error_report_url: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["bulk_import_batches"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["bulk_import_batches"]["Insert"]>;
      };
      bulk_import_rows: {
        Row: {
          id: string;
          batch_id: string;
          row_number: number;
          sku: string | null;
          raw_data: Json;
          is_valid: boolean;
          validation_errors: string[];
          imported_product_id: string | null;
          imported_variant_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bulk_import_rows"]["Row"], "id" | "created_at"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["bulk_import_rows"]["Insert"]>;
      };
    };
  };
}
