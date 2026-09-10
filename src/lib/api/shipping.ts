import { createServerFn } from "@tanstack/react-start";
import type { Address } from "@/lib/supabase/types";
import { supabaseAdmin } from "@/lib/supabase/server";

export interface ParcelDetails {
  weightKg: number;
  lengthCm?: number | undefined;
  widthCm?: number | undefined;
  heightCm?: number | undefined;
}

export interface ShippingQuote {
  carrier: "Australia Post" | "Sendle";
  serviceName: string;
  serviceCode: string;
  costAud: number;
  estimatedDeliveryDays: string;
}

export interface ShippingLabelResult {
  consignmentId: string;
  trackingNumber: string;
  labelPdfUrl: string;
  carrier: string;
}

export type TrackingStatus =
  "MANIFESTED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "EXCEPTION";

export interface TrackingEvent {
  timestamp: string;
  status: TrackingStatus;
  location: string;
  description: string;
}

export interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: TrackingStatus;
  estimatedDelivery?: string | undefined;
  deliveredAt?: string | undefined;
  events: TrackingEvent[];
}

export interface IShippingProvider {
  name: string;
  getQuote(origin: Address, destination: Address, parcel: ParcelDetails): Promise<ShippingQuote[]>;
  createShipment(
    subOrderId: string,
    origin: Address,
    destination: Address,
    parcel: ParcelDetails,
    customerName: string,
    customerPhone?: string,
  ): Promise<ShippingLabelResult>;
  getTracking(trackingNumber: string): Promise<TrackingInfo>;
  cancelShipment(consignmentId: string): Promise<boolean>;
}

/**
 * Australia Post eParcel / PAC API Service Adapter
 */
export class AusPostShippingProvider implements IShippingProvider {
  name = "Australia Post";

  private apiKey: string;
  private accountNumber: string;

  constructor() {
    const env = typeof process !== "undefined" && process.env ? process.env : {};
    this.apiKey = env["AUSPOST_API_KEY"] ?? "";
    this.accountNumber = env["AUSPOST_ACCOUNT_NUMBER"] ?? "";
  }

  async getQuote(
    origin: Address,
    destination: Address,
    parcel: ParcelDetails,
  ): Promise<ShippingQuote[]> {
    if (!this.apiKey) {
      // Domestic Australian postage rate calculation based on weight brackets
      const weight = Math.max(parcel.weightKg, 0.5);
      return [
        {
          carrier: "Australia Post",
          serviceName: "Parcel Post (Standard)",
          serviceCode: "AUS_PARCEL_REGULAR",
          costAud: Number((9.95 + (weight > 1 ? (weight - 1) * 3.5 : 0)).toFixed(2)),
          estimatedDeliveryDays: "3–6 business days",
        },
        {
          carrier: "Australia Post",
          serviceName: "Express Post",
          serviceCode: "AUS_PARCEL_EXPRESS",
          costAud: Number((14.95 + (weight > 1 ? (weight - 1) * 4.5 : 0)).toFixed(2)),
          estimatedDeliveryDays: "1–3 business days",
        },
      ];
    }

    try {
      const response = await fetch(
        `https://digitalapi.auspost.com.au/postage/parcel/domestic/calculate.json?from_postcode=${origin.postcode}&to_postcode=${destination.postcode}&length=${parcel.lengthCm ?? 20}&width=${parcel.widthCm ?? 15}&height=${parcel.heightCm ?? 10}&weight=${parcel.weightKg}&service_code=AUS_PARCEL_REGULAR`,
        {
          headers: { "AUTH-KEY": this.apiKey },
        },
      );

      if (!response.ok) throw new Error(`AusPost API returned status ${response.status}`);
      const data = (await response.json()) as any;

      return [
        {
          carrier: "Australia Post",
          serviceName: "Parcel Post",
          serviceCode: "AUS_PARCEL_REGULAR",
          costAud: Number(data.postage_result.total_cost),
          estimatedDeliveryDays: "3–6 business days",
        },
      ];
    } catch (err) {
      console.warn("AusPost API quote failed, falling back to standard domestic rate table:", err);
      return [
        {
          carrier: "Australia Post",
          serviceName: "Parcel Post (Standard)",
          serviceCode: "AUS_PARCEL_REGULAR",
          costAud: 9.95,
          estimatedDeliveryDays: "3–6 business days",
        },
      ];
    }
  }

  async createShipment(
    subOrderId: string,
    origin: Address,
    destination: Address,
    parcel: ParcelDetails,
    customerName: string,
    customerPhone?: string,
  ): Promise<ShippingLabelResult> {
    const isProduction = (typeof process !== "undefined" ? process.env["NODE_ENV"] : "") === "production";

    if (!this.apiKey || !this.accountNumber) {
      if (isProduction) {
        throw new Error(
          "AusPost shipping is not configured (missing AUSPOST_API_KEY/AUSPOST_ACCOUNT_NUMBER) — cannot create a real shipment in production.",
        );
      }
      console.warn(
        "[AusPost] Not configured — returning a DEV-ONLY placeholder shipment. This path is unreachable in production.",
      );
      return {
        consignmentId: `DEV-CONS-${subOrderId}`,
        trackingNumber: `DEV-AP-${subOrderId}`,
        labelPdfUrl: "",
        carrier: "Australia Post",
      };
    }

    // Real Australia Post Shipping & Tracking API flow: create an order (which contains
    // the shipment + parcel item), then request a printable label for that shipment.
    // NOTE: endpoint paths/payload/response shape here follow AusPost's documented
    // Shipping & Tracking API structure but have not been exercised against a live
    // sandbox in this environment — verify against AUSPOST_API_KEY sandbox credentials
    // before go-live and adjust field names if AusPost's contract has since changed.
    try {
      const orderRes = await fetch("https://digitalapi.auspost.com.au/shipping/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "AUTH-KEY": this.apiKey,
          "Account-Number": this.accountNumber,
        },
        body: JSON.stringify({
          orders: [
            {
              order_reference: subOrderId,
              order_date: new Date().toISOString(),
              shipments: [
                {
                  shipment_reference: subOrderId,
                  from: {
                    name: "Seller Dispatch",
                    lines: [origin.line1],
                    suburb: origin.suburb,
                    state: origin.state,
                    postcode: origin.postcode,
                    country: origin.country ?? "AU",
                  },
                  to: {
                    name: customerName,
                    phone: customerPhone,
                    lines: [destination.line1],
                    suburb: destination.suburb,
                    state: destination.state,
                    postcode: destination.postcode,
                    country: destination.country ?? "AU",
                  },
                  items: [
                    {
                      product_id: "7E51",
                      length: parcel.lengthCm ?? 20,
                      width: parcel.widthCm ?? 15,
                      height: parcel.heightCm ?? 10,
                      weight: parcel.weightKg,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      if (!orderRes.ok) {
        throw new Error(`AusPost order creation failed: ${orderRes.status} ${await orderRes.text()}`);
      }

      const orderData = (await orderRes.json()) as any;
      const shipment = orderData?.orders?.[0]?.shipments?.[0];
      const shipmentId = shipment?.shipment_id;
      const trackingNumber = shipment?.items?.[0]?.tracking_details?.article_id ?? shipmentId;

      if (!shipmentId) {
        throw new Error("AusPost order creation returned no shipment_id.");
      }

      const labelRes = await fetch("https://digitalapi.auspost.com.au/shipping/v1/labels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "AUTH-KEY": this.apiKey,
          "Account-Number": this.accountNumber,
        },
        body: JSON.stringify({
          shipments: [{ shipment_id: shipmentId }],
          preferences: [
            {
              type: "PRINT",
              format: "PDF",
              groups: [{ group: "domestic_labels" }],
            },
          ],
        }),
      });

      if (!labelRes.ok) {
        throw new Error(`AusPost label request failed: ${labelRes.status} ${await labelRes.text()}`);
      }

      const labelData = (await labelRes.json()) as any;
      const labelPdfUrl = labelData?.labels?.[0]?.url;

      if (!labelPdfUrl) {
        throw new Error("AusPost label request returned no downloadable label URL.");
      }

      return {
        consignmentId: shipmentId,
        trackingNumber,
        labelPdfUrl,
        carrier: "Australia Post",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isProduction) {
        throw new Error(`AusPost shipment creation failed: ${msg}`);
      }
      console.warn("[AusPost] Shipment creation failed in non-production, returning dev placeholder:", msg);
      return {
        consignmentId: `DEV-CONS-${subOrderId}`,
        trackingNumber: `DEV-AP-${subOrderId}`,
        labelPdfUrl: "",
        carrier: "Australia Post",
      };
    }
  }

  async getTracking(trackingNumber: string): Promise<TrackingInfo> {
    const isProduction = (typeof process !== "undefined" ? process.env["NODE_ENV"] : "") === "production";

    if (!this.apiKey) {
      if (isProduction) {
        throw new Error("AusPost shipping is not configured — cannot retrieve real tracking in production.");
      }
      console.warn("[AusPost] Not configured — returning DEV-ONLY placeholder tracking.");
      return {
        trackingNumber,
        carrier: "Australia Post",
        status: "MANIFESTED",
        events: [
          {
            timestamp: new Date().toISOString(),
            status: "MANIFESTED",
            location: "DEV placeholder — no real AusPost tracking data",
            description: "Development mode: AUSPOST_API_KEY not configured",
          },
        ],
      };
    }

    try {
      const res = await fetch(
        `https://digitalapi.auspost.com.au/shipping/v1/track?tracking_ids=${encodeURIComponent(trackingNumber)}`,
        { headers: { "AUTH-KEY": this.apiKey } },
      );

      if (!res.ok) {
        throw new Error(`AusPost tracking lookup failed: ${res.status} ${await res.text()}`);
      }

      const data = (await res.json()) as any;
      const trackable = data?.tracking_results?.[0]?.trackable_items?.[0];

      if (!trackable) {
        throw new Error("AusPost tracking lookup returned no trackable item for this number.");
      }

      const events: TrackingEvent[] = (trackable.events ?? []).map((e: any) => ({
        timestamp: e.date ?? new Date().toISOString(),
        status: mapAusPostStatus(e.description ?? trackable.status),
        location: e.location ?? "",
        description: e.description ?? "",
      }));

      return {
        trackingNumber,
        carrier: "Australia Post",
        status: mapAusPostStatus(trackable.status),
        estimatedDelivery: trackable.estimated_delivery_date,
        deliveredAt: trackable.status === "Delivered" ? trackable.consignment_delivered_date : undefined,
        events,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isProduction) {
        throw new Error(`AusPost tracking retrieval failed: ${msg}`);
      }
      console.warn("[AusPost] Tracking lookup failed in non-production, returning dev placeholder:", msg);
      return {
        trackingNumber,
        carrier: "Australia Post",
        status: "EXCEPTION",
        events: [
          {
            timestamp: new Date().toISOString(),
            status: "EXCEPTION",
            location: "DEV placeholder",
            description: `Tracking lookup failed: ${msg}`,
          },
        ],
      };
    }
  }

  async cancelShipment(consignmentId: string): Promise<boolean> {
    const isProduction = (typeof process !== "undefined" ? process.env["NODE_ENV"] : "") === "production";

    if (!this.apiKey) {
      if (isProduction) {
        throw new Error("AusPost shipping is not configured — cannot cancel a shipment in production.");
      }
      console.warn("[AusPost] Not configured — treating shipment cancellation as a DEV-ONLY no-op.");
      return true;
    }

    try {
      const res = await fetch(
        `https://digitalapi.auspost.com.au/shipping/v1/shipments/${encodeURIComponent(consignmentId)}`,
        {
          method: "DELETE",
          headers: { "AUTH-KEY": this.apiKey, "Account-Number": this.accountNumber },
        },
      );
      return res.ok;
    } catch (err) {
      console.warn("[AusPost] Shipment cancellation request failed:", err);
      return false;
    }
  }
}

/**
 * Map an AusPost tracking event/status description to our normalized TrackingStatus.
 */
function mapAusPostStatus(description: string | undefined): TrackingStatus {
  const d = (description ?? "").toLowerCase();
  if (d.includes("delivered")) return "DELIVERED";
  if (d.includes("out for delivery")) return "OUT_FOR_DELIVERY";
  if (d.includes("exception") || d.includes("failed") || d.includes("return")) return "EXCEPTION";
  if (d.includes("transit") || d.includes("processed") || d.includes("departed") || d.includes("arrived")) {
    return "IN_TRANSIT";
  }
  return "MANIFESTED";
}

/**
 * Main Shipping Service: Calculates quotes per seller package
 */
export async function calculateMultiSellerShippingQuotes(
  sellerOrigins: {
    sellerId: string;
    address: Address;
    parcel: ParcelDetails;
    itemsTotal: number;
  }[],
  destination: Address,
): Promise<{ sellerId: string; quote: ShippingQuote }[]> {
  const provider = new AusPostShippingProvider();
  const results: { sellerId: string; quote: ShippingQuote }[] = [];

  for (const seller of sellerOrigins) {
    if (seller.itemsTotal >= 100) {
      // Free Shipping promo if seller package exceeds $100 AUD
      results.push({
        sellerId: seller.sellerId,
        quote: {
          carrier: "Australia Post",
          serviceName: "Free Marketplace Shipping",
          serviceCode: "FREE_PROMO",
          costAud: 0.0,
          estimatedDeliveryDays: "3–6 business days",
        },
      });
      continue;
    }

    const quotes = await provider.getQuote(seller.address, destination, seller.parcel);
    const chosenQuote = quotes[0] ?? {
      carrier: "Australia Post",
      serviceName: "Parcel Post",
      serviceCode: "AUS_PARCEL_REGULAR",
      costAud: 9.95,
      estimatedDeliveryDays: "3–6 business days",
    };

    results.push({
      sellerId: seller.sellerId,
      quote: chosenQuote,
    });
  }

  return results;
}

/**
 * Server Function: Retrieve normalized tracking info for a customer order or seller shipment.
 */
export const getShipmentTrackingServerFn = createServerFn({ method: "POST" })
  .validator((data: { trackingNumber: string }) => data)
  .handler(async ({ data }) => {
    const provider = new AusPostShippingProvider();
    return provider.getTracking(data.trackingNumber);
  });
