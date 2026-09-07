import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Truck, Upload, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  Metric,
  Pill,
  SellerShell,
  type SellerSection,
} from "@/components/ism/SellerShell";
import { IMAGES, formatAUD, productsBySeller } from "@/lib/ism-data";
import {
  DEMO_NOTE,
  PAYOUT_RULE,
  PAYOUT_STAGES,
  BACKEND_REQUIRED_NOTES,
} from "@/lib/ism-ops";
import { acceptSubOrderServerFn, generateShippingLabelServerFn } from "@/lib/api/fulfilment";


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

const INITIAL_ORDERS: OrderItemType[] = [
  {
    id: "ISM10001-A",
    customer: "Priya S. · NSW",
    items: 1,
    total: 289,
    status: "New Order",
    tone: "new",
    action: "Accept Order",
    deadline: "Dispatch by tomorrow, 5pm",
    urgent: true,
  },
  {
    id: "ISM10004-A",
    customer: "Ravi K. · WA",
    items: 2,
    total: 168,
    status: "Preparing",
    tone: "prep",
    action: "Prepare",
    deadline: "Dispatch by Thu, 5pm",
    urgent: true,
  },
  {
    id: "ISM10007-B",
    customer: "Anita D. · VIC",
    items: 1,
    total: 449,
    status: "Ready To Ship",
    tone: "ready",
    action: "Create Shipping Label",
    deadline: "Dispatch by Fri, 5pm",
    urgent: false,
  },
  {
    id: "ISM10009-A",
    customer: "Sunil M. · QLD",
    items: 3,
    total: 312,
    status: "Shipped",
    tone: "ship",
    action: "Track",
    deadline: "In transit — ETA 2 days",
    urgent: false,
    carrier: "Australia Post",
    trackingNumber: "AP-AU-84729103",
  },
  {
    id: "ISM09992-A",
    customer: "Neha T. · SA",
    items: 1,
    total: 139,
    status: "Delivered",
    tone: "done",
    action: "Track",
    deadline: "Delivered 26 Aug",
    urgent: false,
    carrier: "Australia Post",
    trackingNumber: "AP-AU-71029384",
  },
];

const TRANSACTIONS = [
  { order: "ISM09992", date: "26 Aug 2026", gross: 139, fee: 13.9, net: 125.1, status: "Payout eligible", tone: "teal" as const },
  { order: "ISM09984", date: "21 Aug 2026", gross: 449, fee: 44.9, net: 404.1, status: "Paid", tone: "primary" as const },
  { order: "ISM09967", date: "14 Aug 2026", gross: 168, fee: 16.8, net: 151.2, status: "Paid", tone: "primary" as const },
  { order: "ISM09940", date: "07 Aug 2026", gross: 289, fee: 28.9, net: 260.1, status: "On hold — dispute", tone: "marigold" as const },
];

function SellerDashboard() {
  const [section, setSection] = useState<SellerSection>("dashboard");
  const [orders, setOrders] = useState<OrderItemType[]>(INITIAL_ORDERS);
  const products = productsBySeller("mumbai-mirror-boutique");

  const handleOrderAction = async (orderId: string) => {
    const currentOrder = orders.find((o) => o.id === orderId);
    if (!currentOrder) return;

    if (currentOrder.status === "New Order") {
      try {
        await acceptSubOrderServerFn({
          data: { subOrderId: orderId, sellerId: "mumbai-mirror-boutique" },
        }).catch((e: any) => console.warn("Live sub-order update note:", e.message));

        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? { ...o, status: "Preparing", tone: "prep", action: "Mark Ready to Ship" }
              : o
          )
        );
        toast.success(`Order ${orderId} accepted`, {
          description: "Status changed to Preparing. Package deadline started.",
        });
      } catch (err: any) {
        toast.error("Failed to accept order", { description: err.message });
      }
    } else if (currentOrder.status === "Preparing") {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "Ready To Ship", tone: "ready", action: "Create Shipping Label" }
            : o
        )
      );
      toast.success(`Order ${orderId} marked Ready to Ship`, {
        description: "Generate courier shipping label to finalize dispatch.",
      });
    } else if (currentOrder.status === "Ready To Ship") {
      try {
        const res = await generateShippingLabelServerFn({
          data: {
            subOrderId: orderId,
            sellerId: "mumbai-mirror-boutique",
            parcel: { weightKg: 0.5 },
          },
        }).catch(() => ({
          trackingNumber: `AP-AU-${Math.floor(10000000 + Math.random() * 90000000)}`,
          labelPdfUrl: `https://storage.indianshoppingmela.com.au/labels/${orderId}.pdf`,
        }));

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
              : o
          )
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
          onClick: () => window.open(`https://auspost.com.au/mypost/track/#/details/${track}`, "_blank"),
        },
      });
    }
  };

  const handleDownloadStatement = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Order,Date,Gross AUD,Marketplace Fee AUD,Net AUD,Payout Status\n" +
      TRANSACTIONS.map((t) => `${t.order},${t.date},${t.gross},${t.fee},${t.net},"${t.status}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ISM_Seller_Payout_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Payout statement CSV downloaded successfully.");
  };

  return (
    <SellerShell
      active={section}
      onSelect={setSection}
      title={sectionTitle(section)}
      subtitle="Mumbai Mirror Boutique · Verified ISM seller since 2019"
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
      {section === "dashboard" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label="Today's Orders" value="7" note="2 new since 9am" />
            <Metric label="Orders To Ship" value="5" note="2 past deadline risk" tone="marigold" />
            <Metric label="Sales (30 days)" value="$18,420" note="+12.4% vs last month" tone="rani" />
            <Metric label="Pending Payout" value="$2,905.10" note="clears over 14 days" tone="teal" />
            <Metric label="Low Stock" value="12 SKUs" note="restock recommended" tone="rani" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Orders needing action">
                <OrdersTable rows={orders.slice(0, 3)} onAction={handleOrderAction} />
              </Card>
            </div>
            <Card title="Launch checklist">
              <ul className="space-y-3 text-sm">
                {[
                  ["Store profile complete", true],
                  ["Bank details verified", true],
                  ["24 products live", true],
                  ["Bulk upload remaining catalogue", false],
                  ["Set festive shipping cut-off", false],
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">SKU</th>
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
                          src={IMAGES[p.image]}
                          alt=""
                          loading="lazy"
                          width={900}
                          height={900}
                          className="size-9 rounded-sm object-cover"
                        />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="text-xs text-muted-foreground">{p.id.toUpperCase()}</td>
                    <td>{formatAUD(p.price)}</td>
                    <td>{p.stock}</td>
                    <td>
                      <Pill label={p.stock > 5 ? "Live" : "Low stock"} tone={p.stock > 5 ? "ship" : "prep"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {section === "inventory" && (
        <div className="space-y-4">
          <p className="rounded-sm border border-marigold/40 bg-marigold/10 p-2.5 text-[11px]">
            {BACKEND_REQUIRED_NOTES.inventory}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="SKUs" value="248" />
            <Metric label="Low stock" value="12" tone="marigold" />
            <Metric label="Out of stock" value="3" tone="rani" />
            <Metric label="Units on hand" value="4,182" tone="teal" />
          </div>
          <Card title="Low stock alerts">
            <ul className="divide-y divide-border text-sm">
              {products.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.stock} units left</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {section === "orders" && (
        <Card title="Orders" action={<span className="text-xs text-muted-foreground">{orders.length} orders</span>}>
          <OrdersTable rows={orders} onAction={handleOrderAction} />
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
                Bulky (lehenga trunks) — $24.95 flat
              </li>
            </ul>
          </Card>
          <Card title="Handling & labels">
            <div className="flex items-start gap-3 rounded-sm border border-border bg-muted/40 p-3">
              <Truck size={18} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                In this marketplace prototype, shipping labels are generated as demo A6 PDFs from
                the order row — no live carrier account is connected. Handling time is 1–2 business
                days from Harris Park, NSW.
              </p>
            </div>
          </Card>
        </div>
      )}

      {section === "returns" && (
        <Card title="Returns">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {[
                ["RET-4412", "Banarasi Silk Saree", "Size exchange", "Approved"],
                ["RET-4390", "Georgette Party Saree", "Damaged in transit", "Refunded $169"],
                ["RET-4356", "Chikankari Kurta Set", "Change of mind", "Awaiting parcel"],
              ].map((r) => (
                <tr key={r[0]}>
                  <td className="py-2.5 font-medium">{r[0]}</td>
                  <td>{r[1]}</td>
                  <td className="text-muted-foreground">{r[2]}</td>
                  <td className="text-right text-xs font-semibold">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {section === "promotions" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Your store coupons">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {[
                  ["MIRROR10", "10% off orders over $120", "Seller funded", "Live"],
                  ["FESTIVE25", "$25 off lehengas", "Seller funded", "Scheduled"],
                  ["FREESHIP99", "Free shipping over $99", "Seller funded shipping", "Live"],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td className="py-2.5 font-semibold">{r[0]}</td>
                    <td className="text-muted-foreground">{r[1]}</td>
                    <td className="text-xs">{r[2]}</td>
                    <td className="text-right"><Pill label={r[3]!} tone={r[3] === "Live" ? "ship" : "ready"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card title="Marketplace campaigns">
            <ul className="space-y-3 text-sm">
              {[
                ["Diwali Mela · 1–20 Oct", "Platform funded discount, seller funds shipping", "Opted in"],
                ["Wedding Season · 1 Nov – 15 Feb", "Category banner placement", "Not opted in"],
                ["Free Shipping Weekend · 13–15 Sep", "Shipping cost shared 50/50", "Not opted in"],
              ].map((r) => (
                <li key={r[0]} className="rounded-sm border border-border p-3">
                  <p className="font-semibold">{r[0]}</p>
                  <p className="text-xs text-muted-foreground">{r[1]}</p>
                  <button
                    onClick={() => toast.success("Campaign preference saved", { description: r[0] })}
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
            <Metric label="Available Balance" value="$4,182.40" tone="teal" />
            <Metric label="Pending Balance" value="$2,905.10" />
            <Metric label="On Hold" value="$318.00" tone="marigold" note="2 open disputes" />
            <Metric label="Next Payout" value="$4,182.40" note="Fri 4 Sep 2026" tone="rani" />
            <Metric label="Total Paid" value="$186,340" note="lifetime" />
          </div>
          <Card title="Payout pipeline">
            <div className="grid gap-2 sm:grid-cols-5">
              {PAYOUT_STAGES.map((p) => (
                <div key={p.stage} className="rounded-sm border border-border p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{p.stage}</p>
                  <p className="mt-1 font-display text-lg font-bold text-primary">{formatAUD(p.amount)}</p>
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
          <Card title="Order transaction history" action={<span className="text-xs text-muted-foreground">4 of 328 shown</span>}>
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
                  {TRANSACTIONS.map((t) => (
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
          </Card>
          <Card title="Recent payouts">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {[
                  ["PO-20826", "21 Aug 2026", "$3,914.20", "Paid"],
                  ["PO-20744", "14 Aug 2026", "$4,602.85", "Paid"],
                  ["PO-20661", "7 Aug 2026", "$2,880.00", "Paid"],
                ].map((r) => (
                  <tr key={r[0]}>
                    <td className="py-2.5 font-medium">{r[0]}</td>
                    <td className="text-muted-foreground">{r[1]}</td>
                    <td>{r[2]}</td>
                    <td className="text-right text-xs font-semibold text-teal">{r[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {section === "store" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Storefront">
            <p className="text-sm text-muted-foreground">
              Banner, logo, about text, dispatch promise and featured collections are managed here.
            </p>
            <Link
              to="/seller/$slug"
              params={{ slug: "mumbai-mirror-boutique" }}
              className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-rani"
            >
              View public storefront <ArrowUpRight size={13} />
            </Link>
          </Card>
          <Card title="Store policies">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Returns: 7 days, standard change-of-mind policy</li>
              <li>Dispatch: 1–2 business days from Harris Park, NSW</li>
              <li>Customer support: 9am–6pm AEST, Mon–Sat</li>
            </ul>
          </Card>
        </div>
      )}

      {section === "reports" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Top categories">
            <ul className="space-y-2 text-sm">
              {[["Sarees", "42%"], ["Lehengas", "26%"], ["Kurta Sets", "18%"], ["Dupattas", "14%"]].map(
                ([l, v]) => (
                  <li key={l} className="flex items-center gap-3">
                    <span className="w-24 shrink-0">{l}</span>
                    <span className="h-2 flex-1 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-rani" style={{ width: v }} />
                    </span>
                    <span className="text-xs text-muted-foreground">{v}</span>
                  </li>
                ),
              )}
            </ul>
          </Card>
          <Card title="Sales by state">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[["NSW", "$7,410"], ["VIC", "$5,280"], ["QLD", "$2,940"], ["WA", "$1,610"], ["SA", "$1,180"]].map(
                ([l, v]) => (
                  <li key={l} className="flex justify-between">
                    <span>{l}</span>
                    <span className="font-semibold text-foreground">{v}</span>
                  </li>
                ),
              )}
            </ul>
          </Card>
          <Card title="Downloads">
            <div className="space-y-2 text-sm">
              {["Sales report (CSV)", "Payout statement (PDF)", "Inventory snapshot (XLSX)"].map((d) => (
                <button
                  key={d}
                  onClick={() => toast.success(`Generated ${d}`)}
                  className="w-full rounded-sm border border-border px-3 py-2 text-left hover:border-rani hover:text-rani"
                >
                  {d}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {section === "settings" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Business details">
            <div className="space-y-3 text-sm">
              {[["Trading name", "Mumbai Mirror Boutique"], ["ABN", "58 123 456 789"], ["GST registered", "Yes"], ["Warehouse", "Harris Park NSW 2150"]].map(
                ([l, v]) => (
                  <div key={l}>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{l}</p>
                    <p>{v}</p>
                  </div>
                ),
              )}
            </div>
          </Card>
          <Card title="Payout account">
            <p className="text-sm text-muted-foreground">
              NAB · BSB 083-004 · Account ending 2841 · Verified 2 Feb 2026
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
