import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface MarketplaceSettings {
  returnWindowDays: number;
  payoutDelayDays: number;
  defaultCommissionRatePct: number;
  sellerDispatchSlaHours: number;
  mediaLimits: {
    maxImagesPerProduct: number;
    maxImageSizeMb: number;
    maxVideoSizeMb: number;
    maxVideoDurationSeconds: number;
  };
  importLimits: {
    maxRowsPerBatch: number;
    supportedFormats: string[];
  };
  policyVersions: {
    termsVersion: string;
    privacyVersion: string;
    sellerAgreementVersion: string;
    returnsVersion: string;
  };
}

export const DEFAULT_MARKETPLACE_SETTINGS: MarketplaceSettings = {
  returnWindowDays: 7,
  payoutDelayDays: 14,
  defaultCommissionRatePct: 10.0,
  sellerDispatchSlaHours: 48,
  mediaLimits: {
    maxImagesPerProduct: 8,
    maxImageSizeMb: 10,
    maxVideoSizeMb: 50,
    maxVideoDurationSeconds: 60,
  },
  importLimits: {
    maxRowsPerBatch: 1000,
    supportedFormats: ["csv", "xlsx"],
  },
  policyVersions: {
    termsVersion: "v1.0_2026",
    privacyVersion: "v1.0_2026",
    sellerAgreementVersion: "v1.1_2026",
    returnsVersion: "v1.2_2026",
  },
};

/**
 * Server Function: Get Authoritative Marketplace Configuration & Limits (T503)
 */
export const getMarketplaceSettingsServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarketplaceSettings> => {
    try {
      const { data, error } = await (supabaseAdmin.from("marketplace_configs") as any).select(
        "key, value",
      );

      if (error || !data || data.length === 0) {
        return DEFAULT_MARKETPLACE_SETTINGS;
      }

      const map = new Map(data.map((row: any) => [row.key, row.value]));

      return {
        returnWindowDays: Number(
          map.get("return_window_days") ?? DEFAULT_MARKETPLACE_SETTINGS.returnWindowDays,
        ),
        payoutDelayDays: Number(
          map.get("payout_delay_days") ?? DEFAULT_MARKETPLACE_SETTINGS.payoutDelayDays,
        ),
        defaultCommissionRatePct: Number(
          map.get("default_commission_rate_pct") ??
            DEFAULT_MARKETPLACE_SETTINGS.defaultCommissionRatePct,
        ),
        sellerDispatchSlaHours: Number(
          map.get("seller_dispatch_sla_hours") ??
            DEFAULT_MARKETPLACE_SETTINGS.sellerDispatchSlaHours,
        ),
        mediaLimits: (map.get("media_limits") as any) ?? DEFAULT_MARKETPLACE_SETTINGS.mediaLimits,
        importLimits:
          (map.get("import_limits") as any) ?? DEFAULT_MARKETPLACE_SETTINGS.importLimits,
        policyVersions:
          (map.get("policy_versions") as any) ?? DEFAULT_MARKETPLACE_SETTINGS.policyVersions,
      };
    } catch {
      return DEFAULT_MARKETPLACE_SETTINGS;
    }
  },
);

/**
 * Server Function: Record user/seller acceptance of legal terms & policy versions (T502)
 */
export const recordAcceptedPolicyAgreementServerFn = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId: string;
      sellerId?: string | undefined;
      agreementType: "TERMS" | "PRIVACY" | "SELLER_AGREEMENT" | "RETURNS";
      version: string;
      ipAddress?: string | undefined;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId, sellerId, agreementType, version, ipAddress } = data;

    // 1. Audit log record
    await (supabaseAdmin.from("audit_logs") as any).insert({
      user_id: userId,
      action: `LEGAL_AGREEMENT_ACCEPTED_${agreementType}`,
      entity_type: sellerId ? "SELLER" : "USER",
      entity_id: sellerId ?? userId,
      new_data: {
        agreementType,
        version,
        acceptedAt: new Date().toISOString(),
        ipAddress: ipAddress ?? null,
      },
    });

    return {
      success: true,
      agreementType,
      version,
      recordedAt: new Date().toISOString(),
    };
  });
