export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attribute_options: {
        Row: {
          attribute_id: string
          code: string
          color_hex: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          attribute_id: string
          code: string
          color_hex?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          attribute_id?: string
          code?: string
          color_hex?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "category_attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_count: number
          error_report_csv_url: string | null
          failed_count: number
          filename: string
          id: string
          mode: string
          seller_id: string
          status: string
          template_version: string
          total_rows: number
          updated_count: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          error_report_csv_url?: string | null
          failed_count?: number
          filename: string
          id?: string
          mode?: string
          seller_id: string
          status?: string
          template_version?: string
          total_rows?: number
          updated_count?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_count?: number
          error_report_csv_url?: string | null
          failed_count?: number
          filename?: string
          id?: string
          mode?: string
          seller_id?: string
          status?: string
          template_version?: string
          total_rows?: number
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_batches_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_import_rows: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          imported_product_id: string | null
          imported_variant_id: string | null
          is_valid: boolean
          raw_data: Json
          row_number: number
          sku: string | null
          validation_errors: string[] | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          imported_product_id?: string | null
          imported_variant_id?: string | null
          is_valid?: boolean
          raw_data: Json
          row_number: number
          sku?: string | null
          validation_errors?: string[] | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          imported_product_id?: string | null
          imported_variant_id?: string | null
          is_valid?: boolean
          raw_data?: Json
          row_number?: number
          sku?: string | null
          validation_errors?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_import_rows_imported_product_id_fkey"
            columns: ["imported_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_import_rows_imported_variant_id_fkey"
            columns: ["imported_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_lines: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_lines_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          guest_token: string | null
          id: string
          status: Database["public"]["Enums"]["cart_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          guest_token?: string | null
          id?: string
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          guest_token?: string | null
          id?: string
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_url: string | null
          created_at: string
          department: string
          description: string | null
          featured: boolean | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          department: string
          description?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          department?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_attributes: {
        Row: {
          attribute_type: string
          category_id: string
          code: string
          created_at: string
          id: string
          is_required: boolean | null
          name: string
          options: Json | null
        }
        Insert: {
          attribute_type?: string
          category_id: string
          code: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          name: string
          options?: Json | null
        }
        Update: {
          attribute_type?: string
          category_id?: string
          code?: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          name?: string
          options?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "category_attributes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          tagline: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          tagline?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          tagline?: string | null
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          contact_name: string
          contact_phone: string | null
          country: string
          created_at: string
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          line1: string
          line2: string | null
          postcode: string
          state: string
          suburb: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_name: string
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          line1: string
          line2?: string | null
          postcode: string
          state: string
          suburb: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string | null
          country?: string
          created_at?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          line1?: string
          line2?: string | null
          postcode?: string
          state?: string
          suburb?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          icon_name: string | null
          id: string
          is_active: boolean
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      inventory_reservations: {
        Row: {
          created_at: string
          customer_id: string | null
          expires_at: string
          id: string
          order_id: string | null
          quantity: number
          session_id: string
          status: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          expires_at: string
          id?: string
          order_id?: string | null
          quantity: number
          session_id: string
          status?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          expires_at?: string
          id?: string
          order_id?: string | null
          quantity?: number
          session_id?: string
          status?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          actor_id: string | null
          balance_after: number
          batch_id: string | null
          created_at: string
          delta: number
          id: string
          note: string | null
          order_id: string | null
          reason: string
          variant_id: string
        }
        Insert: {
          actor_id?: string | null
          balance_after: number
          batch_id?: string | null
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason: string
          variant_id: string
        }
        Update: {
          actor_id?: string | null
          balance_after?: number
          batch_id?: string | null
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          reason?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          metadata: Json | null
          order_id: string | null
          payout_batch_id: string | null
          seller_id: string | null
          sub_order_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payout_batch_id?: string | null
          seller_id?: string | null
          sub_order_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payout_batch_id?: string | null
          seller_id?: string | null
          sub_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_configs: {
        Row: {
          changed_by: string | null
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          updated_at: string
          version: number
        }
        Insert: {
          changed_by?: string | null
          config_key: string
          config_value: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          changed_by?: string | null
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_configs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          provider_message_id: string | null
          recipient_email: string | null
          recipient_phone: string | null
          sent_at: string | null
          status: string
          template_name: string
        }
        Insert: {
          channel?: string
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          template_name: string
        }
        Update: {
          channel?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          gst_amount: number
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string
          sub_order_id: string
          total_price: number
          unit_price: number
          variant_id: string | null
          variant_name: string
        }
        Insert: {
          gst_amount: number
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          sku: string
          sub_order_id: string
          total_price: number
          unit_price: number
          variant_id?: string | null
          variant_name: string
        }
        Update: {
          gst_amount?: number
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string
          sub_order_id?: string
          total_price?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          from_status: string | null
          id: string
          order_id: string | null
          reason: string | null
          sub_order_id: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
          sub_order_id?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
          sub_order_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          discount_total: number
          gst_total: number
          id: string
          payment_authorized_at: string | null
          payment_intent_id: string | null
          payment_provider: string
          payment_status: Database["public"]["Enums"]["order_payment_status"]
          shipping_address: Json
          shipping_total: number
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_address: Json
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          discount_total?: number
          gst_total: number
          id: string
          payment_authorized_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          shipping_address: Json
          shipping_total: number
          subtotal: number
          total_amount: number
          updated_at?: string
        }
        Update: {
          billing_address?: Json
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount_total?: number
          gst_total?: number
          id?: string
          payment_authorized_at?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          payment_status?: Database["public"]["Enums"]["order_payment_status"]
          shipping_address?: Json
          shipping_total?: number
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          order_id: string
          payment_method_type: string | null
          provider: string
          provider_payment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          order_id: string
          payment_method_type?: string | null
          provider?: string
          provider_payment_id: string
          status: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          order_id?: string
          payment_method_type?: string | null
          provider?: string
          provider_payment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_items: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          ledger_entry_id: string
          payout_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          ledger_entry_id: string
          payout_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          ledger_entry_id?: string
          payout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_ledger: {
        Row: {
          created_at: string
          eligible_at: string | null
          gross_amount: number
          hold_reason: string | null
          id: string
          net_payout: number
          paid_at: string | null
          payout_batch_id: string | null
          platform_commission: number
          seller_id: string
          shipping_cost_allocated: number
          status: Database["public"]["Enums"]["payout_status"]
          sub_order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eligible_at?: string | null
          gross_amount: number
          hold_reason?: string | null
          id?: string
          net_payout: number
          paid_at?: string | null
          payout_batch_id?: string | null
          platform_commission: number
          seller_id: string
          shipping_cost_allocated?: number
          status?: Database["public"]["Enums"]["payout_status"]
          sub_order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eligible_at?: string | null
          gross_amount?: number
          hold_reason?: string | null
          id?: string
          net_payout?: number
          paid_at?: string | null
          payout_batch_id?: string | null
          platform_commission?: number
          seller_id?: string
          shipping_cost_allocated?: number
          status?: Database["public"]["Enums"]["payout_status"]
          sub_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_ledger_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_ledger_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: true
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_cents: number
          cleared_at: string | null
          created_at: string
          failure_reason: string | null
          id: string
          paid_at: string | null
          payout_batch_id: string | null
          provider_transfer_id: string | null
          seller_id: string
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cleared_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          payout_batch_id?: string | null
          provider_transfer_id?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cleared_at?: string | null
          created_at?: string
          failure_reason?: string | null
          id?: string
          paid_at?: string | null
          payout_batch_id?: string | null
          provider_transfer_id?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          media_type: string
          moderation_status: string
          product_id: string
          sort_order: number | null
          status: Database["public"]["Enums"]["media_status"]
          thumbnail_url: string | null
          url: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          media_type?: string
          moderation_status?: string
          product_id: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          thumbnail_url?: string | null
          url: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          media_type?: string
          moderation_status?: string
          product_id?: string
          sort_order?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          thumbnail_url?: string | null
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_moderation_logs: {
        Row: {
          admin_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["product_status"] | null
          id: string
          product_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["product_status"]
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["product_status"] | null
          id?: string
          product_id: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["product_status"]
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["product_status"] | null
          id?: string
          product_id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["product_status"]
        }
        Relationships: [
          {
            foreignKeyName: "product_moderation_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_moderation_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_options: {
        Row: {
          attribute_id: string
          custom_value: string | null
          option_id: string | null
          variant_id: string
        }
        Insert: {
          attribute_id: string
          custom_value?: string | null
          option_id?: string | null
          variant_id: string
        }
        Update: {
          attribute_id?: string
          custom_value?: string | null
          option_id?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "category_attributes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "attribute_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          created_at: string
          id: string
          images: string[] | null
          low_stock_threshold: number
          price: number
          product_id: string
          reserved_quantity: number
          sale_end_at: string | null
          sale_price: number | null
          sale_start_at: string | null
          seller_sku: string
          stock_quantity: number
          title: string
          updated_at: string
          weight_kg_override: number | null
        }
        Insert: {
          attributes?: Json
          created_at?: string
          id?: string
          images?: string[] | null
          low_stock_threshold?: number
          price: number
          product_id: string
          reserved_quantity?: number
          sale_end_at?: string | null
          sale_price?: number | null
          sale_start_at?: string | null
          seller_sku: string
          stock_quantity?: number
          title: string
          updated_at?: string
          weight_kg_override?: number | null
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          images?: string[] | null
          low_stock_threshold?: number
          price?: number
          product_id?: string
          reserved_quantity?: number
          sale_end_at?: string | null
          sale_price?: number | null
          sale_start_at?: string | null
          seller_sku?: string
          stock_quantity?: number
          title?: string
          updated_at?: string
          weight_kg_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          care_instructions: string | null
          category_id: string
          country_of_origin: string | null
          created_at: string
          department: string
          description: string
          fragile: boolean | null
          handling_days: number | null
          height_cm: number | null
          id: string
          key_features: string[] | null
          length_cm: number | null
          return_eligible: boolean
          seller_id: string
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          subcategory: string | null
          title: string
          updated_at: string
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          care_instructions?: string | null
          category_id: string
          country_of_origin?: string | null
          created_at?: string
          department: string
          description: string
          fragile?: boolean | null
          handling_days?: number | null
          height_cm?: number | null
          id?: string
          key_features?: string[] | null
          length_cm?: number | null
          return_eligible?: boolean
          seller_id: string
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          subcategory?: string | null
          title: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          care_instructions?: string | null
          category_id?: string
          country_of_origin?: string | null
          created_at?: string
          department?: string
          description?: string
          fragile?: boolean | null
          handling_days?: number | null
          height_cm?: number | null
          id?: string
          key_features?: string[] | null
          length_cm?: number | null
          return_eligible?: boolean
          seller_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          subcategory?: string | null
          title?: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          phone_verified: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          phone_verified?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          idempotency_key: string | null
          order_id: string
          provider_refund_id: string | null
          reason: string
          return_id: string | null
          status: string
          sub_order_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          order_id: string
          provider_refund_id?: string | null
          reason: string
          return_id?: string | null
          status?: string
          sub_order_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          order_id?: string
          provider_refund_id?: string | null
          reason?: string
          return_id?: string | null
          status?: string
          sub_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          condition_reported: string | null
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          refund_amount_cents: number | null
          return_id: string
        }
        Insert: {
          condition_reported?: string | null
          created_at?: string
          id?: string
          order_item_id: string
          quantity: number
          refund_amount_cents?: number | null
          return_id: string
        }
        Update: {
          condition_reported?: string | null
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          refund_amount_cents?: number | null
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_id: string | null
          evidence_urls: string[] | null
          id: string
          order_item_id: string
          quantity: number
          reason: string
          reason_code: string
          refund_amount: number | null
          status: Database["public"]["Enums"]["return_status"]
          sub_order_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_id?: string | null
          evidence_urls?: string[] | null
          id?: string
          order_item_id: string
          quantity?: number
          reason: string
          reason_code: string
          refund_amount?: number | null
          status?: Database["public"]["Enums"]["return_status"]
          sub_order_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_id?: string | null
          evidence_urls?: string[] | null
          id?: string
          order_item_id?: string
          quantity?: number
          reason?: string
          reason_code?: string
          refund_amount?: number | null
          status?: Database["public"]["Enums"]["return_status"]
          sub_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          created_at: string
          customer_id: string | null
          evidence_urls: string[] | null
          id: string
          payout_hold_placed: boolean
          reason: string
          reason_code: string
          received_at: string | null
          resolved_at: string | null
          seller_notes: string | null
          status: Database["public"]["Enums"]["return_status"]
          sub_order_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          created_at?: string
          customer_id?: string | null
          evidence_urls?: string[] | null
          id?: string
          payout_hold_placed?: boolean
          reason: string
          reason_code?: string
          received_at?: string | null
          resolved_at?: string | null
          seller_notes?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          sub_order_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          created_at?: string
          customer_id?: string | null
          evidence_urls?: string[] | null
          id?: string
          payout_hold_placed?: boolean
          reason?: string
          reason_code?: string
          received_at?: string | null
          resolved_at?: string | null
          seller_notes?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          sub_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_agreements: {
        Row: {
          accepted_at: string
          agreement_type: string
          id: string
          ip_address: string | null
          seller_id: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          agreement_type?: string
          id?: string
          ip_address?: string | null
          seller_id: string
          user_agent?: string | null
          user_id: string
          version?: string
        }
        Update: {
          accepted_at?: string
          agreement_type?: string
          id?: string
          ip_address?: string | null
          seller_id?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_agreements_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_agreements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          seller_id: string
          status: Database["public"]["Enums"]["document_verification_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          file_name: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["document_verification_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["document_verification_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_documents_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_documents_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_staff: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          permissions: string[]
          seller_id: string
          staff_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: string[]
          seller_id: string
          staff_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          permissions?: string[]
          seller_id?: string
          staff_role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_staff_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          abn: string
          about_text: string | null
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_bsb: string | null
          banner_url: string | null
          business_name: string
          business_type: string
          commission_rate: number
          created_at: string
          dispatch_address: Json
          handling_days_default: number
          holiday_mode: boolean
          id: string
          legal_name: string
          logo_url: string | null
          owner_id: string
          return_address: Json
          risk_flag: boolean | null
          slug: string
          status: Database["public"]["Enums"]["onboarding_status"]
          terms_accepted_at: string | null
          terms_accepted_version: string | null
          updated_at: string
        }
        Insert: {
          abn: string
          about_text?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          banner_url?: string | null
          business_name: string
          business_type?: string
          commission_rate?: number
          created_at?: string
          dispatch_address?: Json
          handling_days_default?: number
          holiday_mode?: boolean
          id?: string
          legal_name: string
          logo_url?: string | null
          owner_id: string
          return_address?: Json
          risk_flag?: boolean | null
          slug: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string
          about_text?: string | null
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_bsb?: string | null
          banner_url?: string | null
          business_name?: string
          business_type?: string
          commission_rate?: number
          created_at?: string
          dispatch_address?: Json
          handling_days_default?: number
          holiday_mode?: boolean
          id?: string
          legal_name?: string
          logo_url?: string | null
          owner_id?: string
          return_address?: Json
          risk_flag?: boolean | null
          slug?: string
          status?: Database["public"]["Enums"]["onboarding_status"]
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sellers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sellers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          id: string
          label_url: string | null
          pod_signature_url: string | null
          provider_shipment_id: string | null
          shipping_cost_cents: number
          shipping_service: string
          status: string
          sub_order_id: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          label_url?: string | null
          pod_signature_url?: string | null
          provider_shipment_id?: string | null
          shipping_cost_cents?: number
          shipping_service: string
          status?: string
          sub_order_id: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          label_url?: string | null
          pod_signature_url?: string | null
          provider_shipment_id?: string | null
          shipping_cost_cents?: number
          shipping_service?: string
          status?: string
          sub_order_id?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_sub_order_id_fkey"
            columns: ["sub_order_id"]
            isOneToOne: false
            referencedRelation: "sub_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_orders: {
        Row: {
          can_return_until: string | null
          carrier: string | null
          created_at: string
          delivered_at: string | null
          dispatch_deadline: string | null
          id: string
          master_order_id: string
          package_label: string
          seller_accepted_at: string | null
          seller_id: string
          shipped_at: string | null
          shipping_cost: number
          shipping_service: string | null
          status: Database["public"]["Enums"]["sub_order_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          can_return_until?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatch_deadline?: string | null
          id: string
          master_order_id: string
          package_label?: string
          seller_accepted_at?: string | null
          seller_id: string
          shipped_at?: string | null
          shipping_cost?: number
          shipping_service?: string | null
          status?: Database["public"]["Enums"]["sub_order_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          can_return_until?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatch_deadline?: string | null
          id?: string
          master_order_id?: string
          package_label?: string
          seller_accepted_at?: string | null
          seller_id?: string
          shipped_at?: string | null
          shipping_cost?: number
          shipping_service?: string | null
          status?: Database["public"]["Enums"]["sub_order_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_orders_master_order_id_fkey"
            columns: ["master_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sub_orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          carrier_status: string
          created_at: string
          event_description: string
          event_timestamp: string
          id: string
          ism_status: string
          location: string | null
          raw_payload: Json | null
          shipment_id: string
        }
        Insert: {
          carrier_status: string
          created_at?: string
          event_description: string
          event_timestamp: string
          id?: string
          ism_status: string
          location?: string | null
          raw_payload?: Json | null
          shipment_id: string
        }
        Update: {
          carrier_status?: string
          created_at?: string
          event_description?: string
          event_timestamp?: string
          id?: string
          ism_status?: string
          location?: string | null
          raw_payload?: Json | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          last_error: string | null
          payload: Json
          processed: boolean
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          signature_verified: boolean
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type: string
          id: string
          last_error?: string | null
          payload: Json
          processed?: boolean
          processed_at?: string | null
          provider: string
          provider_event_id?: string | null
          signature_verified?: boolean
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          signature_verified?: boolean
          status?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_inventory_reservation: {
        Args: { p_order_id: string; p_reservation_id: string }
        Returns: Json
      }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { user_uuid?: string }; Returns: boolean }
      is_seller_member:
        | { Args: { seller_uuid: string }; Returns: boolean }
        | {
            Args: { seller_uuid: string; user_uuid?: string }
            Returns: boolean
          }
      release_expired_reservations: { Args: never; Returns: number }
      reserve_inventory_atomic: {
        Args: {
          p_hold_minutes?: number
          p_quantity: number
          p_reference_id: string
          p_reference_type: string
          p_variant_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      cart_status: "ACTIVE" | "CONVERTED" | "ABANDONED"
      document_verification_status:
        | "PENDING"
        | "VERIFIED"
        | "REJECTED"
        | "EXPIRED"
      ledger_entry_type:
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
        | "PAYOUT"
      media_status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED" | "REJECTED"
      onboarding_status:
        | "DRAFT"
        | "SUBMITTED"
        | "UNDER_REVIEW"
        | "INFO_REQUIRED"
        | "APPROVED"
        | "REJECTED"
        | "SUSPENDED"
      order_payment_status: "PAYMENT_PENDING" | "PAID" | "PAYMENT_FAILED"
      payout_status:
        | "PAYOUT_HOLD"
        | "PAYOUT_ELIGIBLE"
        | "PAYOUT_PROCESSING"
        | "PAID_TO_SELLER"
        | "CANCELLED"
      product_status:
        | "DRAFT"
        | "SUBMITTED"
        | "NEEDS_CHANGES"
        | "APPROVED"
        | "LIVE"
        | "PAUSED"
        | "OUT_OF_STOCK"
        | "REJECTED"
        | "ARCHIVED"
      return_status:
        | "RETURN_REQUESTED"
        | "RETURN_APPROVED"
        | "RETURN_IN_TRANSIT"
        | "RETURN_RECEIVED"
        | "REFUND_PENDING"
        | "REFUNDED"
        | "REJECTED"
      sub_order_status:
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
        | "DISPUTED"
      user_role:
        | "customer"
        | "seller_owner"
        | "seller_staff"
        | "admin_support"
        | "admin_catalogue"
        | "admin_finance"
        | "admin_super"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cart_status: ["ACTIVE", "CONVERTED", "ABANDONED"],
      document_verification_status: [
        "PENDING",
        "VERIFIED",
        "REJECTED",
        "EXPIRED",
      ],
      ledger_entry_type: [
        "CUSTOMER_CHARGE",
        "SELLER_GROSS",
        "ISM_COMMISSION",
        "PAYMENT_FEE",
        "SHIPPING_CHARGE",
        "SHIPPING_COST",
        "DISCOUNT",
        "REFUND",
        "ADJUSTMENT",
        "TRANSFER",
        "PAYOUT",
      ],
      media_status: ["UPLOADING", "PROCESSING", "READY", "FAILED", "REJECTED"],
      onboarding_status: [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "INFO_REQUIRED",
        "APPROVED",
        "REJECTED",
        "SUSPENDED",
      ],
      order_payment_status: ["PAYMENT_PENDING", "PAID", "PAYMENT_FAILED"],
      payout_status: [
        "PAYOUT_HOLD",
        "PAYOUT_ELIGIBLE",
        "PAYOUT_PROCESSING",
        "PAID_TO_SELLER",
        "CANCELLED",
      ],
      product_status: [
        "DRAFT",
        "SUBMITTED",
        "NEEDS_CHANGES",
        "APPROVED",
        "LIVE",
        "PAUSED",
        "OUT_OF_STOCK",
        "REJECTED",
        "ARCHIVED",
      ],
      return_status: [
        "RETURN_REQUESTED",
        "RETURN_APPROVED",
        "RETURN_IN_TRANSIT",
        "RETURN_RECEIVED",
        "REFUND_PENDING",
        "REFUNDED",
        "REJECTED",
      ],
      sub_order_status: [
        "ORDER_CREATED",
        "SELLER_NOTIFIED",
        "SELLER_ACCEPTED",
        "PREPARING",
        "READY_TO_SHIP",
        "LABEL_CREATED",
        "PICKUP_SCHEDULED",
        "SHIPPED",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "DISPUTED",
      ],
      user_role: [
        "customer",
        "seller_owner",
        "seller_staff",
        "admin_support",
        "admin_catalogue",
        "admin_finance",
        "admin_super",
      ],
    },
  },
} as const;

// ----------------------------------------------------------------------------
// Canonical Domain Type Aliases
// ----------------------------------------------------------------------------
export type UserRole =
  | "customer"
  | "seller"
  | "seller_owner"
  | "seller_staff"
  | "admin"
  | "admin_support"
  | "admin_catalogue"
  | "admin_finance"
  | "admin_super";

export type SellerStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "suspended"
  | "rejected";

export type OnboardingStatus = SellerStatus;

export type ProductStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_REVIEW"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "LIVE"
  | "PAUSED"
  | "OUT_OF_STOCK"
  | "REJECTED"
  | "ARCHIVED";

export type OrderStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type SubOrderStatus =
  | "NEW_ORDER"
  | "ORDER_CREATED"
  | "SELLER_NOTIFIED"
  | "ACCEPTED"
  | "SELLER_ACCEPTED"
  | "PREPARING"
  | "PACKED"
  | "READY_TO_SHIP"
  | "LABEL_CREATED"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "REFUNDED"
  | "DISPUTED";

export type OrderPaymentStatus =
  | "PENDING"
  | "PAYMENT_PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "PAYMENT_FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type ReturnStatus =
  | "REQUESTED"
  | "RETURN_REQUESTED"
  | "APPROVED"
  | "RETURN_APPROVED"
  | "REJECTED"
  | "IN_TRANSIT"
  | "RETURN_IN_TRANSIT"
  | "RECEIVED"
  | "RETURN_RECEIVED"
  | "INSPECTED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "CLOSED";

export type PayoutStatus =
  | "PENDING"
  | "PAYOUT_HOLD"
  | "PAYOUT_ELIGIBLE"
  | "SCHEDULED"
  | "PROCESSING"
  | "PAYOUT_PROCESSING"
  | "TRANSFERRED"
  | "PAID_TO_SELLER"
  | "FAILED"
  | "CANCELLED";

export type ShipmentStatus =
  | "PENDING"
  | "LABEL_CREATED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED_ATTEMPT"
  | "EXCEPTION"
  | "RETURNED_TO_SENDER";

export type LedgerEntryType =
  | "CUSTOMER_CHARGE"
  | "SELLER_GROSS"
  | "ISM_COMMISSION"
  | "GST_COLLECTED"
  | "SHIPPING_FEE"
  | "SELLER_PAYOUT"
  | "CUSTOMER_REFUND"
  | "DISPUTE_HOLD"
  | "DISPUTE_RELEASE"
  | "ADJUSTMENT"
  | "SALE_CREDIT";

export interface Address {
  line1: string;
  line2?: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
  fullName?: string;
  phone?: string;
  businessName?: string;
}
