/**
 * @file types.ts
 * @description Re-export barrel for Supabase database types.
 *
 * This file exists purely for backwards compatibility with imports that use
 * `@/lib/supabase/types`. All types are now defined in `database.types.ts`
 * as the single authoritative source of truth.
 *
 * DO NOT add types here — add them to database.types.ts.
 */
export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
  // Domain aliases
  UserRole,
  OnboardingStatus,
  SellerStatus,
  ProductStatus,
  OrderStatus,
  SubOrderStatus,
  OrderPaymentStatus,
  ReturnStatus,
  PayoutStatus,
  ShipmentStatus,
  LedgerEntryType,
  MediaStatus,
  CartStatus,
  DocumentVerificationStatus,
  InventoryTxType,
  BulkImportStatus,
  PaymentMethod,
  // Shared interfaces
  Address,
} from "./database.types";

export { Constants } from "./database.types";
