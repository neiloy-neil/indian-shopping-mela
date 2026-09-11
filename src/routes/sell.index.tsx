import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Truck, Upload, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  Badge,
  Button,
  Card,
  Metric,
  Pill,
  SellerShell,
  type SellerSection,
} from "@/components/ism/SellerShell";
import { formatAUD } from "@/lib/ism-data";
import { PAYOUT_RULE, PAYOUT_STAGES, BACKEND_REQUIRED_NOTES } from "@/lib/ism-ops";
import {
  acceptSubOrderServerFn,
  generateShippingLabelServerFn,
  getSellerSubOrdersServerFn,
  markSubOrderPackedServerFn,
} from "@/lib/api/fulfilment";
import { getSellerProductsServerFn } from "@/lib/api/products";
import {
  getSellerPayoutStatementServerFn,
  getSellerPayoutEligibilityServerFn,
  type PayoutEligibilityResult,
} from "@/lib/api/payouts";
import { getSellerReturnsServerFn, type SellerReturnRow } from "@/lib/api/returns";
import { getCurrentSellerProfile, type SellerRow } from "@/lib/api/sellers";
import type { PayoutStatus } from "@/lib/supabase/types";

export const Route = createFileRoute("/sell/")({
  head: () => ({
    meta: [
      { title: "Seller Dashboard — Sell on Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Manage products, inventory, orders, shipping, returns and payouts as an Indian seller on Australia's ISM marketplace.",
      },
      { property: "og:title", content: "Seller Dashboard — Sell on Indian Shopping Mela" },
      {
        property: "og:description",
        content: "Bulk upload, order fulfilment and payouts for Indian sellers across Australia.",
      },
    ],
  }),
  component: SellerDashboard,
});

type OrderItemType = {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: string;
  tone: "new" | "prep" | "ready" | "ship" | "done";
  action: string;
  deadline: string;
  urgent: boolean;
  carrier?: string | undefined;
  trackingNumber?: string | undefined;
  labelPdfUrl?: string | undefined;
};

type TransactionRow = {
  order: string;
  date: string;
  gross: number;
  fee: number;
  net: number;
  status: string;
  tone: "primary" | "teal" | "marigold" | "rani" | "neutral";
};

type SellerProductRow = {
  id: string;
  name: string;
  image: string;
  price: number;
  stock: number;
};

const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'%3E%3Crect width='36' height='36' fill='%23e5e7eb'/%3E%3C/svg%3E";

function payoutStatusTone(status: PayoutStatus): TransactionRow["tone"] {
  switch (status) {
    case "PAID_TO_SELLER":
      return "teal";
    case "PAYOUT_PROCESSING":
      return "primary";
    case "PAYOUT_ELIGIBLE":
      return "marigold";
    case "PAYOUT_HOLD":
      return "rani";
    default:
      return "neutral";
  }
}

function SellerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<SellerSection>("dashboard");
  const [sellerProfile, setSellerProfile] = useState<SellerRow | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderItemType[]>([]);
  const [products, setProducts] = useState<SellerProductRow[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [sellerReturns, setSellerReturns] = useState<SellerReturnRow[]>([]);
  const [payoutEligibility, setPayoutEligibility] = useState<PayoutEligibilityResult | null>(null);
  const [payoutSummary, setPayoutSummary] = useState({
    totalGrossAud: 0,
    totalCommissionAud: 0,
    totalNetAud: 0,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/signin", search: { portal: "seller", redirect: "/sell" } });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let isMounted = true;
    getCurrentSellerProfile()
      .then((seller) => {
        if (isMounted) {
          setSellerProfile(seller);
          setSellerId(seller?.id ?? null);
        }
      })
      .catch((err) => console.error("Error loading seller profile:", err));
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!sellerId) return;

    // 1. Live Orders
    async function loadLiveOrders() {
      try {
        const liveSubOrders = await getSellerSubOrdersServerFn({ data: { sellerId: sellerId! } });
        if (liveSubOrders && liveSubOrders.length > 0) {
          const mapped: OrderItemType[] = liveSubOrders.map((so) => {
            let tone: "new" | "prep" | "ready" | "ship" | "done" = "new";
            let action = "Accept Order";
            let statusText = "New Order";

            if (so.status === "ACCEPTED" || so.status === "PROCESSING") {
              tone = "prep";
              action = "Mark Ready to Ship";
              statusText = "Preparing";
            } else if (so.status === "PACKED") {
              tone = "ready";
              action = "Create Shipping Label";
              statusText = "Ready To Ship";
            } else if (so.status === "SHIPPED") {
              tone = "ship";
              action = "Track";
              statusText = "Shipped";
            } else if (so.status === "DELIVERED") {
              tone = "done";
              action = "Track";
              statusText = "Delivered";
            }

            return {
              id: so.id,
              customer: `${so.customerName} · ${so.customerState}`,
              items: so.itemCount,
              total: so.total,
              status: statusText,
              tone,
              action,
              deadline: "Dispatch in standard SLA (24h-48h)",
              urgent: tone === "new" || tone === "prep",
              carrier: so.carrier,
              trackingNumber: so.trackingNumber,
            };
          });
          setOrders(mapped);
        } else {
          setOrders([]);
        }
      } catch (err) {
        console.error("Error loading seller sub-orders:", err);
      }
    }
    loadLiveOrders();

    // 2. Live Products
    getSellerProductsServerFn({ data: { sellerId } })
      .then((rows) => {
        setProducts(
          rows.map((p) => {
            const firstVariant = p.variants?.[0];
            const price = firstVariant ? Number(firstVariant.price ?? 0) : 0;
            const stock =
              p.variants?.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0) ?? 0;
            return {
              id: p.id,
              name: p.title,
              image: p.media?.[0]?.url || p.media?.[0]?.thumbnail_url || FALLBACK_PRODUCT_IMAGE,
              price,
              stock,
            };
          }),
        );
      })
      .catch((err) => console.error("Error loading seller products:", err));

    // 3. Live Payout Statements
    getSellerPayoutStatementServerFn({ data: { sellerId } })
      .then((result) => {
        setTransactions(
          result.statementItems.map((t) => ({
            order: t.payoutBatchId || t.payoutId,
            date: t.date,
            gross: t.grossAud,
            fee: t.commissionAud,
            net: t.netAud,
            status: t.status,
            tone: payoutStatusTone(t.status),
          })),
        );
        setPayoutSummary({
          totalGrossAud: result.totalGrossAud,
          totalCommissionAud: result.totalCommissionAud,
          totalNetAud:
            result.totalPaidAud ||
            Math.max(0, result.totalGrossAud - result.totalCommissionAud),
        });
      })
      .catch((err) => console.error("Error loading seller payout statement:", err));

    // 4. Live Payout Eligibility
    getSellerPayoutEligibilityServerFn({ data: { sellerId } })
      .then((res) => setPayoutEligibility(res))
      .catch((err) => console.error("Error loading payout eligibility:", err));

    // 5. Live Returns
    getSellerReturnsServerFn({ data: { sellerId } })
      .then((rows) => setSellerReturns(rows))
      .catch((err) => console.error("Error loading seller returns:", err));
  }, [sellerId]);

  const handleOrderAction = async (orderId: string) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    if (!currentOrder || !sellerId) return;

    if (currentOrder.status === "New Order") {
      try {
        await acceptSubOrderServerFn({
          data: { subOrderId: orderId, sellerId },
        });

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: "Preparing", tone: "prep", action: "Mark Ready to Ship" }
              : o,
          ),
        );
        toast.success(`Order ${orderId} accepted`, {
          description: "Status changed to Preparing. Package deadline started.",
        });
      } catch (err: any) {
        toast.error("Failed to accept order", { description: err.message });
      }
    } else if (currentOrder.status === "Preparing") {
      try {
        await markSubOrderPackedServerFn({
          data: { subOrderId: orderId, sellerId },
        });

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: "Ready To Ship", tone: "ready", action: "Create Shipping Label" }
              : o,
          ),
        );
        toast.success(`Order ${orderId} marked Ready to Ship`, {
          description: "Generate courier shipping label to finalize dispatch.",
        });
      } catch (err: any) {
        toast.error("Failed to update status", { description: err.message });
      }
    } else if (currentOrder.status === "Ready To Ship") {
      try {
        const res = await generateShippingLabelServerFn({
          data: {
            subOrderId: orderId,
            sellerId,
            parcel: { weightKg: 0.5 },
          },
        });

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  status: "Shipped",
                  tone: "ship",
                  action: "Track",
                  carrier: "Australia Post",
                  trackingNumber: res.trackingNumber,
                  labelPdfUrl: res.labelPdfUrl,
                }
              : o,
          ),
        );

        toast.success(`Australia Post Label Created: ${res.trackingNumber}`, {
          description: `A6 label generated for ${orderId}. Dispatched and tracking notified to customer.`,
        });
      } catch (err: any) {
        toast.error("Failed to generate shipping label", { description: err.message });
      }
    } else {
      const track = currentOrder.trackingNumber ?? "AP-AU-84729103";
      toast.info(`Tracking #${track}`, {
        description: "Carrier: Australia Post eParcel (Domestic Standard)",
        action: {
          label: "Open Tracker",
          onClick: () =>
            window.open(`https://auspost.com.au/mypost/track/#/details/${track}`, "_blank"),
        },
      });
    }
  };

  const handleDownloadStatement = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Order,Date,Gross AUD,Marketplace Fee AUD,Net AUD,Payout Status\n" +
      transactions
        .map((t) => `${t.order},${t.date},${t.gross},${t.fee},${t.net},"${t.status}"`)
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `ISM_Seller_Payout_Statement_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Payout statement CSV downloaded successfully.");
  };

  // Live Metrics
  const todayOrdersCount = orders.filter(
    (o) => o.status === "New Order" || o.status === "Preparing",
  ).length;
  const ordersToShipCount = orders.filter(
    (o) =>
      o.status === "New Order" || o.status === "Preparing" || o.status === "Ready To Ship",
  ).length;
  const totalSales30Days =
    orders.reduce((sum, o) => sum + o.total, 0) || (payoutSummary.totalGrossAud || 0);
  const availablePayout =
    payoutEligibility?.totalNetPayoutAud ?? (payoutSummary.totalNetAud || 0);
  const lowStockCount = products.filter((p) => p.stock <= 5 && p.stock > 0).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;
  const totalUnitsOnHand = products.reduce((sum, p) => sum + p.stock, 0);
  const dispatchAddr = (sellerProfile?.dispatch_address as any) || {};

  return (
    <SellerShell
      active={section}
      onSelect={setSection}
      title={sectionTitle(section)}
      subtitle={
        sellerProfile
          ? `${sellerProfile.business_name} · Status: ${sellerProfile.status?.replace(/_/g, " ") || "ACTIVE"}`
          : "Seller Centre · Australian Indian Marketplace"
      }
      brand={{
        storeName:
          sellerProfile?.business_name ||
          (user?.fullName ? `${user.fullName}'s Store` : "Seller Centre"),
        location: dispatchAddr.suburb
          ? `${dispatchAddr.suburb}, ${dispatchAddr.state || "AU"}`
          : "Australia",
        verified: sellerProfile?.status === "APPROVED",
      }}
      actions={
        <>
          <Link
            to="/sell/bulk-upload"
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground"
          >
            <Upload size={14} /> Bulk Upload
          </Link>
          <Link
            to="/sell/add-product"
            className="inline-flex items-center gap-1.5 rounded-sm bg-rani px-4 py-2 text-xs font-bold uppercase tracking-wide text-rani-foreground"
          >
            <PackagePlus size={14} /> Add Product
          </Link>
        </>
      }
    >
      {/* Onboarding Incomplete Banner if not fully approved */}
      {(!sellerProfile || sellerProfile.status === "DRAFT" || sellerProfile.status === "SUBMITTED") && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-marigold/50 bg-marigold/10 p-4 text-xs">
          <div>
            <p className="font-bold text-foreground">
              {sellerProfile?.status === "SUBMITTED"
                ? "Your seller application is under review by ISM Admin."
                : sellerProfile?.status === "DRAFT"
                  ? "Your seller application is in draft."
                  : "Welcome! Complete your seller registration to list products."}
            </p>
            <p className="text-muted-foreground">
              Submit your ABN, store details, and seller agreement to unlock live catalogue listing and order dispatch.
            </p>
          </div>
          <Link
            to="/sell/onboarding"
            className="inline-flex items-center gap-1 rounded-sm bg-rani px-3 py-1.5 font-bold uppercase tracking-wider text-rani-foreground hover:opacity-90"
          >
            Go to Onboarding Portal →
          </Link>
        </div>
      )}

      {section === "dashboard" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric
              label="Active Orders"
              value={String(todayOrdersCount)}
              note={`${orders.filter((o) => o.status === "New Order").length} awaiting acceptance`}
            />
            <Metric
              label="Orders To Ship"
              value={String(ordersToShipCount)}
              note={`${orders.filter((o) => o.status === "Ready To Ship").length} ready for courier`}
              tone="marigold"
            />
            <Metric
              label="Sales Volume"
              value={formatAUD(totalSales30Days)}
              note="Authoritative sub-orders"
              tone="rani"
            />
            <Metric
              label="Available Payout"
              value={formatAUD(availablePayout)}
              note="14-day hold post-delivery"
              tone="teal"
            />
            <Metric
              label="Low Stock"
              value={`${lowStockCount} SKUs`}
              note="<= 5 units remaining"
              tone="rani"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Orders needing action">
                {orders.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No active orders pending action.
                  </div>
                ) : (
                  <OrdersTable rows={orders.slice(0, 3)} onAction={handleOrderAction} />
                )}
              </Card>
            </div>
            <Card title="Launch checklist">
              <ul className="space-y-3 text-sm">
                {[
                  ["Store profile complete", !!sellerProfile?.business_name],
                  ["ABN registered", !!sellerProfile?.abn],
                  [`${products.length} products live`, products.length > 0],
                  ["Bulk upload catalogue", products.length >= 5],
                  ["Fast Australia Post dispatch configured", true],
                ].map(([l, done]) => (
                  <li key={String(l)} className="flex items-center gap-2">
                    <span
                      className={`grid size-4 place-items-center rounded-full text-[9px] ${
                        done ? "bg-teal text-teal-foreground" : "border border-border"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span className={done ? "text-muted-foreground line-through" : ""}>{l}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/sell/bulk-upload"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-rani"
                >
                  Start bulk upload <ArrowUpRight size={13} />
                </Link>
                <Link
                  to="/sell/bulk-stock"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary"
                >
                  Bulk stock update <ArrowUpRight size={13} />
                </Link>
                <Link
                  to="/sell/team"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary"
                >
                  Team & permissions <ArrowUpRight size={13} />
                </Link>
                <Link
                  to="/sell/onboarding"
                  className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary"
                >
                  Onboarding status <ArrowUpRight size={13} />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}

      {section === "products" && (
        <Card title={`${products.length} products`}>
          {products.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No products found in your catalogue. Use the <strong>Add Product</strong> or{" "}
              <strong>Bulk Upload</strong> buttons above to list your Indian goods.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Product ID</th>
                    <th className="pb-2">Price</th>
                    <th className="pb-2">Stock</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={p.image}
                            alt=""
                            loading="lazy"
                            width={900}
                            height={900}
                            className="size-9 rounded-sm object-cover"
                          />
                          <span className="font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="text-xs text-muted-foreground">{p.id.slice(0, 8).toUpperCase()}</td>
                      <td>{formatAUD(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>
                        <Pill
                          label={p.stock > 5 ? "Live" : p.stock > 0 ? "Low stock" : "Out of stock"}
                          tone={p.stock > 5 ? "ship" : p.stock > 0 ? "prep" : "done"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {section === "inventory" && (
        <div className="space-y-4">
          <p className="rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
            {BACKEND_REQUIRED_NOTES.inventory}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Live Products" value={String(products.length)} />
            <Metric label="Low stock" value={String(lowStockCount)} tone="marigold" />
            <Metric label="Out of stock" value={String(outOfStockCount)} tone="rani" />
            <Metric label="Units on hand" value={String(totalUnitsOnHand)} tone="teal" />
          </div>
          <Card title="Low stock alerts">
            {products.filter((p) => p.stock <= 5).length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">
                All listed products are above the low-stock threshold.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {products
                  .filter((p) => p.stock <= 5)
                  .map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2.5">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs font-semibold text-rani">{p.stock} units left</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {section === "orders" && (
        <Card
          title="Orders"
          action={<span className="text-xs text-muted-foreground">{orders.length} orders</span>}
        >
          {orders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No orders yet. When customers purchase items from your store, they will appear here.
            </div>
          ) : (
            <OrdersTable rows={orders} onAction={handleOrderAction} />
          )}
        </Card>
      )}

      {section === "shipping" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <p className="rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px] lg:col-span-2">
            {BACKEND_REQUIRED_NOTES.shipping}
          </p>
          <Card title="Shipping profiles">
            <ul className="space-y-3 text-sm">
              <li className="rounded-sm border border-border p-3">
                Standard AU — $9.95, free over $99, 4–7 business days
              </li>
              <li className="rounded-sm border border-border p-3">
                Express AU — $14.95, 1–3 business days
              </li>
              <li className="rounded-sm border border-border p-3">
                Bulky (lehenga trunks / brass puja items) — $24.95 flat
              </li>
            </ul>
          </Card>
          <Card title="Handling & labels">
            <div className="flex items-start gap-3 rounded-sm border border-border bg-muted/40 p-3">
              <Truck size={18} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                Australia Post eParcel integration generates live A6 PDF shipping labels and
                consignment tracking numbers upon dispatch. Standard dispatch SLA is 1–2 business
                days from {dispatchAddr.suburb || "Harris Park"}, {dispatchAddr.state || "NSW"}.
              </p>
            </div>
          </Card>
        </div>
      )}

      {section === "returns" && (
        <Card
          title="Return Requests & Claims"
          action={<span className="text-xs text-muted-foreground">{sellerReturns.length} requests</span>}
        >
          {sellerReturns.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No active return claims. Customer statutory and ACL 7-day change-of-mind claims for your items will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2">Return ID</th>
                    <th className="pb-2">Item</th>
                    <th className="pb-2">Reason</th>
                    <th className="pb-2">Refund AUD</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sellerReturns.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 font-medium">{r.id.slice(0, 8).toUpperCase()}</td>
                      <td>{r.productName}</td>
                      <td className="text-muted-foreground">{r.reason}</td>
                      <td>{formatAUD(r.refundAmountAud)}</td>
                      <td className="text-right">
                        <Pill
                          label={r.status}
                          tone={r.status === "REFUNDED" ? "ship" : r.status === "APPROVED" ? "ready" : "prep"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {section === "promotions" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Your store coupons">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {[
                  ["FESTIVE10", "10% off orders over $120", "Seller funded", "Live"],
                  ["DIWALI25", "$25 off lehengas", "Seller funded", "Scheduled"],
                  ["FREESHIP99", "Free shipping over $99", "Seller funded shipping", "Live"],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td className="py-2.5 font-semibold">{r[0]}</td>
                    <td className="text-muted-foreground">{r[1]}</td>
                    <td className="text-xs">{r[2]}</td>
                    <td className="text-right">
                      <Pill label={r[3]!} tone={r[3] === "Live" ? "ship" : "ready"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Marketplace campaigns">
            <ul className="space-y-3 text-sm">
              {[
                [
                  "Diwali Mela · 1–20 Oct",
                  "Platform funded discount, seller funds shipping",
                  "Opted in",
                ],
                ["Wedding Season · 1 Nov – 15 Feb", "Category banner placement", "Not opted in"],
                ["Free Shipping Weekend · 13–15 Sep", "Shipping cost shared 50/50", "Not opted in"],
              ].map((r) => (
                <li key={r[0]} className="rounded-sm border border-border p-3">
                  <p className="font-semibold">{r[0]}</p>
                  <p className="text-xs text-muted-foreground">{r[1]}</p>
                  <button
                    onClick={() =>
                      toast.success("Campaign preference saved", { description: r[0] })
                    }
                    className="mt-2 text-[11px] font-bold uppercase tracking-wide text-rani"
                  >
                    {r[2] === "Opted in" ? "Manage opt-in" : "Opt in"}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {section === "payments" && (
        <div className="space-y-4">
          <p className="rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
            {BACKEND_REQUIRED_NOTES.payouts}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric
              label="Available Balance"
              value={formatAUD(payoutEligibility?.totalNetPayoutAud || 0)}
              tone="teal"
              note="Eligible for transfer"
            />
            <Metric
              label="Pending Maturation"
              value={formatAUD(
                (payoutSummary.totalNetAud || 0) - (payoutEligibility?.totalNetPayoutAud || 0) > 0
                  ? (payoutSummary.totalNetAud || 0) - (payoutEligibility?.totalNetPayoutAud || 0)
                  : 0,
              )}
              note="14-day hold post-delivery"
            />
            <Metric
              label="Held Disputes"
              value={String(payoutEligibility?.heldSubOrderIds?.length || 0)}
              tone="marigold"
              note="Locked orders"
            />
            <Metric
              label="Commission Paid"
              value={formatAUD(payoutSummary.totalCommissionAud || 0)}
              note="10% marketplace fee"
            />
            <Metric
              label="Total Gross Sales"
              value={formatAUD(payoutSummary.totalGrossAud || 0)}
              note="Authoritative ledger"
              tone="rani"
            />
          </div>
          <Card title="Payout pipeline">
            <div className="grid gap-2 sm:grid-cols-5">
              {PAYOUT_STAGES.map((p) => (
                <div key={p.stage} className="rounded-sm border border-border p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {p.stage}
                  </p>
                  <p className="mt-1 font-display text-lg font-bold text-primary">
                    {formatAUD(p.amount)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{p.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{PAYOUT_RULE}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleDownloadStatement}
                className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani"
              >
                Download statement (CSV)
              </button>
            </div>
          </Card>
          <Card
            title="Order transaction history"
            action={<span className="text-xs text-muted-foreground">{transactions.length} transactions</span>}
          >
            {transactions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No payout transactions recorded in ledger yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Order</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Gross</th>
                      <th className="pb-2">Marketplace fee</th>
                      <th className="pb-2">Net</th>
                      <th className="pb-2 text-right">Payout status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((t) => (
                      <tr key={t.order}>
                        <td className="py-2.5 font-medium">{t.order}</td>
                        <td className="text-muted-foreground">{t.date}</td>
                        <td>{formatAUD(t.gross)}</td>
                        <td className="text-muted-foreground">-{formatAUD(t.fee)}</td>
                        <td className="font-semibold">{formatAUD(t.net)}</td>
                        <td className="text-right">
                          <Badge tone={t.tone}>{t.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {section === "store" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Storefront">
            <p className="text-sm text-muted-foreground">
              Banner, logo, about text, dispatch promise and featured collections are managed here.
            </p>
            {sellerProfile?.slug ? (
              <Link
                to="/seller/$slug"
                params={{ slug: sellerProfile.slug }}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-rani"
              >
                View public storefront ({sellerProfile.slug}) <ArrowUpRight size={13} />
              </Link>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                Complete onboarding to configure your storefront slug.
              </p>
            )}
          </Card>
          <Card title="Store policies">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Returns: 7 days, Australian Consumer Law change-of-mind policy</li>
              <li>Dispatch SLA: 1–2 business days Australia Post / Sendle</li>
              <li>Customer support: Standard Australian business hours</li>
            </ul>
          </Card>
        </div>
      )}

      {section === "reports" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Product inventory distribution">
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Total Listed Products</span>
                <span className="font-semibold">{products.length}</span>
              </li>
              <li className="flex justify-between">
                <span>Total Stock On Hand</span>
                <span className="font-semibold">{totalUnitsOnHand}</span>
              </li>
              <li className="flex justify-between">
                <span>Low Stock SKUs</span>
                <span className="font-semibold text-marigold">{lowStockCount}</span>
              </li>
            </ul>
          </Card>
          <Card title="Fulfilment SLA metrics">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex justify-between">
                <span>Dispatch SLA</span>
                <span className="font-semibold text-foreground">48 Hours</span>
              </li>
              <li className="flex justify-between">
                <span>Carrier</span>
                <span className="font-semibold text-foreground">Australia Post</span>
              </li>
              <li className="flex justify-between">
                <span>Active Packages</span>
                <span className="font-semibold text-foreground">{ordersToShipCount}</span>
              </li>
            </ul>
          </Card>
          <Card title="Downloads">
            <div className="space-y-2 text-sm">
              <button
                onClick={handleDownloadStatement}
                className="w-full rounded-sm border border-border px-3 py-2 text-left hover:border-rani hover:text-rani"
              >
                Payout statement (CSV)
              </button>
            </div>
          </Card>
        </div>
      )}

      {section === "settings" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Business details">
            <div className="space-y-3 text-sm">
              {[
                ["Trading Name", sellerProfile?.business_name || "Not configured"],
                ["Legal Entity Name", sellerProfile?.legal_name || "Not configured"],
                ["ABN", sellerProfile?.abn || "Not provided"],
                ["GST Registered", "Yes (10% inclusive)"],
                [
                  "Warehouse Dispatch",
                  dispatchAddr.line1
                    ? `${dispatchAddr.line1}, ${dispatchAddr.suburb || ""}, ${dispatchAddr.state || ""} ${dispatchAddr.postcode || ""}`
                    : "Not provided",
                ],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {l}
                  </p>
                  <p>{v}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Payout account">
            <p className="text-sm text-muted-foreground">
              {sellerProfile?.stripe_account_id
                ? `Stripe Connect Custom Account · ${sellerProfile.stripe_account_id} · Direct bank transfers enabled`
                : "Stripe Connect account configured for Australian automated seller payouts."}
            </p>
          </Card>
        </div>
      )}
    </SellerShell>
  );
}

function OrdersTable({
  rows,
  onAction,
}: {
  rows: readonly OrderItemType[];
  onAction: (orderId: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="pb-2">Order</th>
            <th className="pb-2">Customer</th>
            <th className="pb-2">Items</th>
            <th className="pb-2">Total</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Dispatch deadline</th>
            <th className="pb-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="py-3 font-medium">
                <div>{o.id}</div>
                {o.trackingNumber && (
                  <div className="text-[10px] text-muted-foreground">
                    {o.carrier ?? "AusPost"}: {o.trackingNumber}
                  </div>
                )}
              </td>
              <td className="text-muted-foreground">{o.customer}</td>
              <td>{o.items}</td>
              <td>{formatAUD(o.total)}</td>
              <td>
                <Pill label={o.status} tone={o.tone} />
              </td>
              <td>
                <Badge tone={o.urgent ? "marigold" : "neutral"}>{o.deadline}</Badge>
              </td>
              <td className="text-right">
                <Button
                  size="sm"
                  variant={o.tone === "new" ? "rani" : "outline"}
                  onClick={() => onAction(o.id)}
                >
                  {o.action}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sectionTitle(s: SellerSection) {
  const found = {
    dashboard: "Seller Dashboard",
    products: "Products",
    inventory: "Inventory",
    orders: "Orders",
    shipping: "Shipping",
    returns: "Returns",
    promotions: "Promotions",
    payments: "Payments & Payouts",
    store: "Store",
    reports: "Reports",
    settings: "Settings",
  } as const;
  return found[s];
}
