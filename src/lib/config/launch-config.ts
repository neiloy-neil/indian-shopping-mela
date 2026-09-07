/**
 * Indian Shopping Mela — Master Launch Configuration Constants & Types
 * Governs business rules, return windows, payouts, inventory holds, and compliance across ISM.
 */

export interface MarketplaceConfig {
  /** Master currency ISO code (AUD) */
  currency: "AUD";
  /** Minor currency unit multiplier (100 cents = 1 AUD) */
  minorUnitMultiplier: 100;
  /** Australian GST rate (10% standard retail) */
  gstRate: number;
  /** Ordinary change-of-mind customer return window in days */
  returnWindowDays: number;
  /** Seller payout release clearance window after carrier confirmed delivery in days */
  payoutDelayDays: number;
  /** Default platform commission percentage */
  defaultCommissionRate: number;
  /** Temporary inventory reservation duration before payment in minutes */
  stockReservationMinutes: number;
  /** Maximum product gallery images per listing */
  maxProductImages: number;
  /** Maximum product video duration in seconds */
  maxVideoDurationSeconds: number;
  /** Maximum product video file size in Megabytes */
  maxVideoFileMB: number;
  /** Default dispatch SLA target in business days */
  defaultDispatchHandlingDays: number;
  /** Active launch payment methods */
  activePaymentMethods: Array<"card" | "apple_pay" | "google_pay">;
  /** Default shipping rates in AUD */
  shippingRates: {
    standardPerPackageAud: number;
    expressPerPackageAud: number;
  };
}

export const ISM_LAUNCH_CONFIG: MarketplaceConfig = {
  currency: "AUD",
  minorUnitMultiplier: 100,
  gstRate: 0.10, // 10%
  returnWindowDays: 7, // 7 days ordinary change-of-mind per Master Architecture Plan
  payoutDelayDays: 14, // 14 days after confirmed delivery
  defaultCommissionRate: 12.0, // 12% ISM commission
  stockReservationMinutes: 15, // 15-min stock hold
  maxProductImages: 12, // 12 gallery images
  maxVideoDurationSeconds: 60, // 60s video limit
  maxVideoFileMB: 100, // 100MB video limit
  defaultDispatchHandlingDays: 2, // 2 business days handling SLA
  activePaymentMethods: ["card", "apple_pay", "google_pay"],
  shippingRates: {
    standardPerPackageAud: 9.95,
    expressPerPackageAud: 14.95,
  },
};
