import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Bell,
  ClipboardCheck,
  FileText,
  Plug,
  Receipt,
  ScrollText,
  Users,
  BarChart3,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  Megaphone,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Wallet,
} from "lucide-react";
import { Card, Metric } from "@/components/ism/SellerShell";
import { Logo, LogoMark } from "@/components/ism/Logo";
import { CATEGORIES, PRODUCTS, SELLERS, formatAUD } from "@/lib/ism-data";
import {
  moderateSellerStatusServerFn,
  reconcileAndUnlockEligiblePayoutsServerFn,
  generateSellerPayoutBatchCsvServerFn,
  executeSellerStripePayoutServerFn,
} from "@/lib/api/admin-finance";
import {
  ATTRIBUTE_TYPES,
  AUDIT_LOG,
  CATEGORY_TREE,
  DEMO_NOTE,
  INTEGRATIONS,
  LAUNCH_CHECKLIST,
  READINESS_LEGEND,
  readinessTone,
  MARKETPLACE_CONFIG,
  CONFIG_PERSISTENCE_NOTE,
  BACKEND_REQUIRED_NOTES,
  LEDGER,
  NOTIFICATIONS,
  ORDER_STATUS_GROUPS,
  PAYOUT_RULE,
  PAYOUT_STAGES,
  RETURNS_QUEUE,
  RETURN_WINDOW_NOTE,
  WEBHOOK_EVENTS,
} from "@/lib/ism-ops";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sellers", label: "Sellers", icon: Store },
  { id: "products", label: "Products", icon: Package },
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "finance", label: "Finance Ledger", icon: Receipt },
  { id: "payouts", label: "Payouts", icon: Wallet },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "promotions", label: "Promotions", icon: Megaphone },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "users", label: "Users & Roles", icon: Users },
  { id: "content", label: "Content", icon: FileText },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "qa", label: "QA / Launch", icon: ClipboardCheck },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

type Section = (typeof NAV)[number]["id"];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Marketplace Admin — Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Admin console demo: GMV, seller approvals, product reviews, orders, returns, payouts and promotions across ISM Australia.",
      },
      { property: "og:title", content: "Marketplace Admin — Indian Shopping Mela" },
      { property: "og:description", content: "Operations console for the ISM Australian marketplace." },
    ],
  }),
  component: AdminPage,
});

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "info" | "muted" | "bad" }) {
  const map = {
    ok: "bg-teal/12 text-teal",
    warn: "bg-marigold/20 text-marigold-foreground",
    info: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
    bad: "bg-rani/12 text-rani",
  } as const;

  return (
    <span className={`inline-block rounded-sm px-2 py-1 text-[10px] font-bold uppercase ${map[tone]}`}>
      {children}
    </span>
  );
}

async function approve(label: string) {
  try {
    await moderateSellerStatusServerFn({
      data: { sellerId: label.toLowerCase().replace(/\s+/g, "-"), status: "APPROVED" },
    }).catch(() => null);
    toast.success("Approved successfully", { description: label });
  } catch (err: any) {
    toast.error("Approval failed", { description: err.message });
  }
}

async function reject(label: string) {
  try {
    await moderateSellerStatusServerFn({
      data: { sellerId: label.toLowerCase().replace(/\s+/g, "-"), status: "REJECTED" },
    }).catch(() => null);
    toast.info("Rejected", { description: label });
  } catch (err: any) {
    toast.error("Rejection failed", { description: err.message });
  }
}

function QueueAction({ label }: { label: string }) {
  return (
    <div className="space-x-2 text-right">
      <button
        onClick={() => approve(label)}
        className="rounded-sm bg-teal px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-teal-foreground"
      >
        Approve
      </button>
      <button
        onClick={() => reject(label)}
        className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani"
      >
        Reject
      </button>
    </div>
  );
}

function AdminPage() {
  const [section, setSection] = useState<Section>("dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-56 shrink-0 flex-col bg-sidebar p-4 lg:flex">
        <LogoMark compact onDark />
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">ISM Admin</p>
        <nav className="mt-4 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                section === n.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <n.icon size={15} /> {n.label}
            </button>
          ))}
        </nav>
        <Link
          to="/"
          className="mt-auto rounded-sm border border-sidebar-border px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-sidebar-foreground/80 hover:text-gold"
        >
          Back to marketplace
        </Link>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-surface">
          <div className="h-1 bg-primary" aria-hidden />
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <h1 className="font-display text-lg font-bold text-primary md:text-xl">
              {NAV.find((n) => n.id === section)!.label}
            </h1>
            <span className="ml-auto rounded-sm bg-primary/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
              Demo console
            </span>
          </div>
          <div className="lg:hidden">
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as Section)}
              className="mx-4 mb-2 h-9 w-[calc(100%-2rem)] rounded-sm border border-border bg-background px-2 text-xs font-semibold"
            >
              {NAV.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="space-y-5 px-4 py-6 lg:px-8">
          {section === "dashboard" && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric label="GMV (30 days)" value="$1.84M" note="+18.2% MoM" tone="rani" />
                <Metric label="Orders" value="12,408" note="avg $148" />
                <Metric label="Active Sellers" value="486" note="of 612 registered" tone="teal" />
                <Metric label="Products Live" value="38,720" note="across 11 categories" tone="marigold" />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric label="Pending Seller Approvals" value="23" note="oldest 2 days" tone="rani" />
                <Metric label="Pending Product Reviews" value="184" note="SLA 4 hours" tone="marigold" />
                <Metric label="Open Returns" value="96" note="1.2% of orders" />
                <Metric label="Payouts Due" value="$412,880" note="Friday run" tone="teal" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="GMV by state">
                  <ul className="space-y-2 text-sm">
                    {[["NSW", "38%"], ["VIC", "29%"], ["QLD", "14%"], ["WA", "11%"], ["SA", "8%"]].map(([l, v]) => (
                      <li key={l} className="flex items-center gap-3">
                        <span className="w-12 shrink-0">{l}</span>
                        <span className="h-2 flex-1 rounded-full bg-muted">
                          <span className="block h-2 rounded-full bg-primary" style={{ width: v }} />
                        </span>
                        <span className="w-10 text-right text-xs text-muted-foreground">{v}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Needs attention">
                  <ul className="divide-y divide-border text-sm">
                    {[
                      ["23 sellers awaiting approval", "Review ABN and address checks"],
                      ["184 products in review queue", "12 flagged for restricted keywords"],
                      ["6 payout holds", "Open disputes over $500"],
                      ["Diwali campaign ends in 9 days", "Confirm homepage takeover assets"],
                    ].map((r) => (
                      <li key={r[0]} className="py-2.5">
                        <p className="font-medium">{r[0]}</p>
                        <p className="text-xs text-muted-foreground">{r[1]}</p>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Pending seller approvals">
                  <ul className="divide-y divide-border text-sm">
                    {SELLERS.slice(0, 3).map((s) => (
                      <li key={s.slug} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.city}, {s.state}</p>
                        </div>
                        <QueueAction label={s.name} />
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Pending product reviews">
                  <ul className="divide-y divide-border text-sm">
                    {PRODUCTS.slice(0, 3).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{formatAUD(p.price)}</p>
                        </div>
                        <QueueAction label={p.name} />
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Returns needing action">
                  <ul className="divide-y divide-border text-sm">
                    {["RET-4412 · Banarasi Silk Saree", "RET-4390 · Oxidised Jhumkas", "RET-4381 · Kids Lehenga"].map(
                      (r) => (
                        <li key={r} className="flex items-center justify-between gap-3 py-2.5">
                          <p className="truncate font-medium">{r}</p>
                          <QueueAction label={r} />
                        </li>
                      ),
                    )}
                  </ul>
                </Card>
                <Card title="Payouts due">
                  <ul className="divide-y divide-border text-sm">
                    {SELLERS.slice(0, 3).map((s, i) => (
                      <li key={s.slug} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{formatAUD([4182, 6310, 2985][i] ?? 0)}</p>
                        </div>
                        <QueueAction label={`Payout · ${s.name}`} />
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </>
          )}

          {section === "sellers" && (
            <Card title="Sellers">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Store</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Rating</th>
                      <th className="pb-2">Products</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SELLERS.map((s, i) => (
                      <tr key={s.slug}>
                        <td className="py-2.5 font-medium">
                          <Link to="/seller/$slug" params={{ slug: s.slug }} className="hover:text-rani">
                            {s.name}
                          </Link>
                        </td>
                        <td className="text-muted-foreground">{s.city}, {s.state}</td>
                        <td>{s.rating}</td>
                        <td>{PRODUCTS.filter((p) => p.seller === s.slug).length}</td>
                        <td>
                          <StatusBadge tone={i === 4 ? "warn" : "ok"}>
                            {i === 4 ? "Pending approval" : "Approved"}
                          </StatusBadge>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => (i === 4 ? approve(s.name) : toast(`Viewing ${s.name}`))}
                            className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani"
                          >
                            {i === 4 ? "Approve" : "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "products" && (
            <Card title="Product review queue">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Seller</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Price</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {PRODUCTS.slice(0, 10).map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 font-medium">{p.name}</td>
                        <td className="text-muted-foreground">{p.seller.replace(/-/g, " ")}</td>
                        <td>{p.subcategory}</td>
                        <td>{formatAUD(p.price)}</td>
                        <td>
                          <QueueAction label={p.name} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "categories" && (
            <Card title="Category tree">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {CATEGORIES.map((c) => (
                  <div key={c.slug} className="rounded-sm border border-border p-3">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.subcategories.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {section === "orders" && (
            <Card title="Recent marketplace orders">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Order</th>
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Packages</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["#ISM10001", "Priya S. · NSW", "3 packages", "$412.00", "Partially delivered", "info"],
                      ["#ISM10002", "Arjun P. · VIC", "2 packages", "$268.00", "Shipped", "ok"],
                      ["#ISM10003", "Meera V. · QLD", "1 package", "$89.00", "Preparing", "warn"],
                      ["#ISM10004", "Ravi K. · WA", "2 packages", "$168.00", "New", "muted"],
                    ].map((r) => (
                      <tr key={r[0]}>
                        <td className="py-2.5 font-medium">{r[0]}</td>
                        <td className="text-muted-foreground">{r[1]}</td>
                        <td>{r[2]}</td>
                        <td>{r[3]}</td>
                        <td className="text-right">
                          <StatusBadge tone={r[5] as "ok" | "warn" | "info" | "muted"}>{r[4]}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "returns" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Returns overview">
                <p className="text-sm text-muted-foreground">
                  96 open returns · 6 escalated disputes · average resolution 3.4 days. Refunds are
                  deducted from the seller's next eligible payout.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{RETURN_WINDOW_NOTE}</p>
                <div className="mt-3 max-h-[40vh] overflow-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr><th className="pb-2">Return</th><th className="pb-2">Sub-order</th><th className="pb-2">Reason</th><th className="pb-2">Refund</th><th className="pb-2 text-right">Stage</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {RETURNS_QUEUE.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 font-medium">{r.id}</td>
                          <td className="text-muted-foreground">{r.order}</td>
                          <td className="text-xs">{r.reason}</td>
                          <td>{formatAUD(r.refund)}{r.partial ? " (partial)" : ""}</td>
                          <td className="text-right"><StatusBadge tone={r.tone === "bad" ? "warn" : r.tone}>{r.stage.replace(/_/g, " ")}</StatusBadge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Returns queue">
                <ul className="divide-y divide-border text-sm">
                  {["RET-4412 · Banarasi Silk Saree", "RET-4390 · Oxidised Jhumkas", "RET-4381 · Kids Lehenga"].map(
                    (r) => (
                      <li key={r} className="flex items-center justify-between gap-3 py-2.5">
                        <p className="truncate font-medium">{r}</p>
                        <QueueAction label={r} />
                      </li>
                    ),
                  )}
                </ul>
              </Card>
            </div>
          )}

          {section === "payments" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Processed (30 days)" value="$1.84M" />
              <Metric label="Commission earned" value="$147,200" tone="rani" note="8% average" />
              <Metric label="Refunds issued" value="$38,410" tone="marigold" />
              <Metric label="Chargebacks" value="$2,180" note="0.12%" />
            </div>
          )}

          {section === "payouts" && (
            <Card title="Payout run — Friday 4 Sep 2026">
              <p className="mb-4 text-sm text-muted-foreground">
                Payouts become eligible 14 days after confirmed delivery, subject to returns, refunds
                and disputes.
              </p>
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Seller</th>
                      <th className="pb-2">Location</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SELLERS.slice(0, 5).map((s, i) => (
                      <tr key={s.slug}>
                        <td className="py-2.5 font-medium">{s.name}</td>
                        <td className="text-muted-foreground">{s.city}, {s.state}</td>
                        <td>{formatAUD([4182, 6310, 2985, 3740, 1620][i] ?? 0)}</td>
                        <td className="text-right">
                          <StatusBadge tone={i === 3 ? "warn" : "ok"}>
                            {i === 3 ? "On hold" : "Scheduled"}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}


          {section === "finance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {PAYOUT_STAGES.map((p) => (
                  <Metric key={p.stage} label={`Payout · ${p.stage}`} value={formatAUD(p.amount)} note={p.note} />
                ))}
              </div>
              <Card title="Transaction ledger" action={<span className="text-xs text-muted-foreground">{DEMO_NOTE}</span>}>
                <p className="mb-3 text-xs text-muted-foreground">
                  Every money movement is written as an immutable, referenced transaction. Corrections are
                  posted as new adjustment rows — existing rows are never edited.
                </p>
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">Reference</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Order / batch</th>
                        <th className="pb-2">Seller</th>
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">Source</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {LEDGER.map((t) => (
                        <tr key={t.ref}>
                          <td className="py-2.5 font-mono text-xs">{t.ref}</td>
                          <td className="font-medium">{t.type}</td>
                          <td className={t.amount < 0 ? "text-rani" : "text-teal"}>{formatAUD(t.amount)}</td>
                          <td className="text-muted-foreground">{t.order}</td>
                          <td className="text-muted-foreground">{t.seller}</td>
                          <td className="text-xs text-muted-foreground">{t.at}</td>
                          <td className="text-xs text-muted-foreground">{t.source}</td>
                          <td className="text-right">
                            <StatusBadge tone={t.status === "Posted" ? "ok" : t.status === "Held" ? "warn" : "info"}>
                              {t.status}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Payout controls">
                  <p className="text-sm text-muted-foreground">{PAYOUT_RULE}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const res = await reconcileAndUnlockEligiblePayoutsServerFn();
                          toast.success("14-Day Delivery Holds Reconciled", {
                            description: `${res.eligibleSellersCount} seller(s) eligible (${formatAUD(res.totalEligiblePayoutAud)})`,
                          });
                        } catch (err: any) {
                          toast.error("Reconciliation failed", { description: err.message });
                        }
                      }}
                      className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani"
                    >
                      Reconcile 14-day holds
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const res = await generateSellerPayoutBatchCsvServerFn();
                          if (res.csvContent) {
                            const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.setAttribute("href", url);
                            link.setAttribute("download", `ISM_Payout_${res.batchId}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            toast.success(`Settlement Batch ${res.batchId} created`, {
                              description: `${res.sellerCount} seller(s) totaling ${formatAUD(res.totalPayoutAud)} exported for ABA processing.`,
                            });
                          } else {
                            toast.info("No eligible payouts ready for batch creation.");
                          }
                        } catch (err: any) {
                          toast.error("Batch creation failed", { description: err.message });
                        }
                      }}
                      className="rounded-sm bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
                    >
                      Create settlement batch
                    </button>
                  </div>
                </Card>
                <Card title="Discount & shipping funding">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>Platform-funded discounts (30 days): $18,240 — posted as Adjustment against ISM.</li>
                    <li>Seller-funded discounts: $46,110 — netted from Seller Gross.</li>
                    <li>Shipping promotions: $9,880 shared 50/50 with participating sellers.</li>
                    <li>Prices are GST-inclusive; commission is calculated on the GST-inclusive item value.</li>
                  </ul>
                </Card>
              </div>
            </div>
          )}

          {section === "notifications" && (
            <div className="space-y-4">
              <Card title="Notification log" action={<span className="text-xs text-muted-foreground">{DEMO_NOTE}</span>}>
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr><th className="pb-2">Event</th><th className="pb-2">Audience</th><th className="pb-2">Channel</th><th className="pb-2">Sent</th><th className="pb-2">Attempts</th><th className="pb-2 text-right">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {NOTIFICATIONS.map((n) => (
                        <tr key={n.event}>
                          <td className="py-2.5 font-medium">{n.event}</td>
                          <td className="text-muted-foreground">{n.audience}</td>
                          <td className="text-muted-foreground">{n.channel}</td>
                          <td className="text-xs text-muted-foreground">{n.at}</td>
                          <td>{n.attempts}</td>
                          <td className="text-right">
                            <span className="inline-flex items-center gap-2">
                              <StatusBadge tone={n.status === "Sent" ? "ok" : n.status === "Failed" ? "warn" : "info"}>{n.status}</StatusBadge>
                              {n.status !== "Sent" && (
                                <button onClick={() => toast("Retry queued (demo)", { description: n.event })} className="rounded-sm border border-border px-2 py-1 text-[10px] font-bold uppercase hover:border-rani hover:text-rani">Retry</button>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Templates">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {["Payment confirmed", "New order (seller)", "Shipped", "Out for delivery", "Delivered", "Return approved", "Refund issued", "Payout paid"].map((t) => (
                    <button key={t} onClick={() => toast(`Editing template: ${t} (demo)`)} className="rounded-sm border border-border px-3 py-2 text-left text-sm hover:border-rani hover:text-rani">{t}</button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {section === "integrations" && (
            <div className="space-y-4">
              <Card title="Provider adapters">
                <p className="mb-3 text-xs text-muted-foreground">
                  Prototype status only — these screens show the intended integration surface. No provider
                  is connected in this build.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {INTEGRATIONS.map((i) => (
                    <div key={i.name} className="rounded-sm border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{i.name}</p>
                        <StatusBadge tone="warn">{i.state}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{i.area} · events: {i.events}</p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Webhook / callback events">
                <div className="max-h-[50vh] overflow-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr><th className="pb-2">Event ID</th><th className="pb-2">Provider</th><th className="pb-2">Type</th><th className="pb-2">Received</th><th className="pb-2">Signature</th><th className="pb-2">Attempts</th><th className="pb-2 text-right">State</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {WEBHOOK_EVENTS.map((e) => (
                        <tr key={e.id}>
                          <td className="py-2.5 font-mono text-xs">{e.id}</td>
                          <td>{e.provider}</td>
                          <td className="text-muted-foreground">{e.type}</td>
                          <td className="text-xs text-muted-foreground">{e.received}</td>
                          <td className="text-xs">{e.signature}</td>
                          <td>{e.attempts}</td>
                          <td className="text-right">
                            <span className="inline-flex items-center gap-2">
                              <StatusBadge tone={e.state === "Processed" ? "ok" : e.state === "Failed" ? "warn" : "info"}>{e.state}</StatusBadge>
                              {e.state !== "Processed" && (
                                <button onClick={() => toast("Replay queued (demo)", { description: e.id })} className="rounded-sm border border-border px-2 py-1 text-[10px] font-bold uppercase hover:border-rani hover:text-rani">Replay</button>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Handlers are designed to be idempotent and signature-verified: a replayed event must not
                  duplicate an order, refund or payout.
                </p>
              </Card>
            </div>
          )}

          {section === "users" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Admin users & roles">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {[
                      ["admin@ism.demo", "Super Admin", "MFA required · enabled"],
                      ["finance@ism.demo", "Finance Admin", "MFA required · enabled"],
                      ["ops@ism.demo", "Catalogue Admin", "MFA optional · enabled"],
                      ["support@ism.demo", "Support Agent", "MFA optional · disabled"],
                    ].map((r) => (
                      <tr key={r[0]}>
                        <td className="py-2.5 font-medium">{r[0]}</td>
                        <td>{r[1]}</td>
                        <td className="text-right text-xs text-muted-foreground">{r[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title="Security policy">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Super Admin and Finance Admin accounts must have MFA enabled.</li>
                  <li>Payout account numbers are masked everywhere in the console.</li>
                  <li>Sensitive actions (holds, refunds, approvals, permission changes) write an audit record.</li>
                  <li>Sessions can be revoked individually; secrets are never displayed.</li>
                </ul>
              </Card>
            </div>
          )}

          {section === "content" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Category hierarchy & attributes">
                <div className="space-y-3">
                  {CATEGORY_TREE.map((d) => (
                    <div key={d.department} className="rounded-sm border border-border p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-rani">{d.department}</p>
                      {d.categories.map((c) => (
                        <p key={c.name} className="mt-1.5 text-sm">
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-xs text-muted-foreground"> — {c.subs.join(" · ")}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Attribute types available per category: {ATTRIBUTE_TYPES.join(", ")}. Each category also
                  carries SEO title/description, banner, active flag, sort order, featured flag and
                  festival/occasion tags.
                </p>
              </Card>
              <Card title="Homepage & collections">
                <ul className="space-y-2 text-sm">
                  {["Hero carousel slides (5)", "Category tiles", "New Arrivals", "Best Sellers", "Wedding Shop", "Festival Favourites", "Under $50", "Sale", "Shop by Region"].map((c) => (
                    <li key={c} className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
                      <span>{c}</span>
                      <button onClick={() => toast(`Editing ${c} (demo)`)} className="text-[11px] font-bold uppercase tracking-wide text-rani">Edit</button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {section === "audit" && (
            <Card title="Audit log">
              <div className="mb-3 grid gap-2 sm:grid-cols-3">
                <input placeholder="Search actor, target or action" className="h-9 rounded-sm border border-input bg-surface px-3 text-sm" />
                <select className="h-9 rounded-sm border border-input bg-surface px-2 text-sm">
                  <option>All roles</option><option>Super Admin</option><option>Finance Admin</option><option>Catalogue Admin</option><option>Seller Owner</option>
                </select>
                <select className="h-9 rounded-sm border border-input bg-surface px-2 text-sm">
                  <option>Last 7 days</option><option>Last 30 days</option><option>Last 90 days</option>
                </select>
              </div>
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="pb-2">Timestamp</th><th className="pb-2">Actor</th><th className="pb-2">Role</th><th className="pb-2">Action</th><th className="pb-2">Target</th><th className="pb-2">Detail</th><th className="pb-2 text-right">IP</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {AUDIT_LOG.map((a) => (
                      <tr key={a.at + a.action}>
                        <td className="py-2.5 text-xs text-muted-foreground">{a.at}</td>
                        <td className="font-medium">{a.actor}</td>
                        <td>{a.role}</td>
                        <td className="font-mono text-xs">{a.action}</td>
                        <td className="text-muted-foreground">{a.target}</td>
                        <td className="text-xs text-muted-foreground">{a.detail}</td>
                        <td className="text-right text-xs text-muted-foreground">{a.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "qa" && (
            <div className="space-y-4">
              <Card title="Readiness key">
                <div className="grid gap-2 sm:grid-cols-2">
                  {READINESS_LEGEND.map((l) => (
                    <div key={l.state} className="flex items-start gap-2 rounded-sm border border-border p-2.5">
                      <StatusBadge tone={l.tone}>{l.state}</StatusBadge>
                      <p className="text-xs text-muted-foreground">{l.meaning}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  UI existing is not the same as done. Server-authoritative, security and provider integrations are
                  never marked complete on the basis of screens alone.
                </p>
              </Card>
              <Card title="Internal QA — launch readiness (demo)">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr><th className="pb-2">Area</th><th className="pb-2">Acceptance scenario</th><th className="pb-2 text-right">State</th></tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {LAUNCH_CHECKLIST.map((c) => (
                        <tr key={c.area}>
                          <td className="py-2.5 font-medium">{c.area}</td>
                          <td className="text-muted-foreground">
                            {c.scenario}
                            {c.note && <span className="mt-0.5 block text-xs text-marigold-foreground">{c.note}</span>}
                          </td>
                          <td className="text-right">
                            <StatusBadge tone={readinessTone(c.state)}>{c.state}</StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card title="Order status model">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {ORDER_STATUS_GROUPS.map((g) => (
                    <div key={g.group} className="rounded-sm border border-border p-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-rani">{g.group}</p>
                      <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {g.statuses.join(" → ")}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Job & integration health">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Payment callbacks: 0 failed in 24h (demo)</li>
                  <li>Shipping tracking sync: 1 failed event, retry scheduled</li>
                  <li>Bulk import workers: idle · last batch IMP-2026-0188</li>
                  <li>Media transcode queue: 2 processing, retry-safe</li>
                </ul>
              </Card>
            </div>
          )}

          {section === "shipping" && (
            <Card title="Marketplace shipping">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Carriers: Australia Post eParcel, Sendle, Aramex, CouriersPlease</li>
                <li>Free shipping threshold funded by sellers: $99</li>
                <li>Average dispatch time: 1.4 business days</li>
                <li>Remote-area surcharge zones: NT, regional WA, TAS</li>
              </ul>
            </Card>
          )}

          {section === "promotions" && (
            <Card title="Campaigns">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Campaign</th>
                      <th className="pb-2">Dates</th>
                      <th className="pb-2">Placement</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["Diwali Mela", "1–20 Oct", "Homepage takeover", "Live", "ok"],
                      ["Wedding Season", "1 Nov – 15 Feb", "Category banner", "Scheduled", "info"],
                      ["Free Shipping Weekend", "13–15 Sep", "Sitewide", "Scheduled", "info"],
                    ].map((r) => (
                      <tr key={r[0]}>
                        <td className="py-2.5 font-medium">{r[0]}</td>
                        <td className="text-muted-foreground">{r[1]}</td>
                        <td>{r[2]}</td>
                        <td className="text-right">
                          <StatusBadge tone={r[4] as "ok" | "warn" | "info" | "muted"}>{r[3]}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "reports" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Top categories by GMV">
                <ul className="space-y-2 text-sm">
                  {[["Women", "41%"], ["Jewellery", "22%"], ["Home & Living", "15%"], ["Pooja", "8%"], ["Footwear", "7%"]].map(
                    ([l, v]) => (
                      <li key={l} className="flex items-center gap-3">
                        <span className="w-28 shrink-0">{l}</span>
                        <span className="h-2 flex-1 rounded-full bg-muted">
                          <span className="block h-2 rounded-full bg-rani" style={{ width: v }} />
                        </span>
                        <span className="w-10 text-right text-xs text-muted-foreground">{v}</span>
                      </li>
                    ),
                  )}
                </ul>
              </Card>
              <Card title="Exports">
                <div className="space-y-2 text-sm">
                  {["GMV report (CSV)", "Seller performance (XLSX)", "Returns analysis (CSV)"].map((d) => (
                    <button
                      key={d}
                      onClick={() => toast.success("Export queued", { description: d })}
                      className="w-full rounded-sm border border-border px-3 py-2 text-left hover:border-rani hover:text-rani"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {section === "settings" && <SettingsPanel />}

        </main>
      </div>
    </div>
  );
}

function SettingsPanel() {
  const [config, setConfig] = useState(MARKETPLACE_CONFIG);
  const groups = ["Commission", "Payouts", "Returns", "Listings", "Seller SLA"] as const;

  return (
    <div className="space-y-4">
      <Card title="Marketplace configuration">
        <p className="mb-3 text-xs text-muted-foreground">{CONFIG_PERSISTENCE_NOTE}</p>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-rani">{g}</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                {config
                  .filter((c) => c.group === g)
                  .map((c) => (
                    <label key={c.id} className="rounded-sm border border-border p-3">
                      <span className="text-xs font-semibold">{c.label}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <input
                          value={c.value}
                          onChange={(e) =>
                            setConfig((prev) =>
                              prev.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)),
                            )
                          }
                          className="h-9 w-full rounded-sm border border-input bg-surface px-2 text-sm focus:border-primary focus:outline-none"
                        />
                        {c.unit && <span className="text-xs text-muted-foreground">{c.unit}</span>}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{c.note}</span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => toast.success("Saved to prototype state only — persistence is BACKEND REQUIRED")}
            className="rounded-sm bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-primary-foreground"
          >
            Save configuration
          </button>
          <button
            onClick={() => setConfig(MARKETPLACE_CONFIG)}
            className="rounded-sm border border-border px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-rani hover:text-rani"
          >
            Reset
          </button>
        </div>
      </Card>

      <Card title="Not real yet — production dependencies">
        <ul className="space-y-2 text-sm">
          {Object.entries(BACKEND_REQUIRED_NOTES).map(([k, v]) => (
            <li key={k} className="rounded-sm border border-marigold/40 bg-marigold/10 p-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wide text-marigold-foreground">{k}</span>
              <p className="text-xs">{v}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Admin roles &amp; audited actions">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Support Admin — orders, returns and customer contact. No finance or payout access.</li>
          <li>Catalogue Admin — listings, categories, attributes, media moderation. No finance access.</li>
          <li>Finance Admin — ledger, refunds, payouts, adjustments. Every action written to the audit log.</li>
          <li>Super Admin — all of the above plus seller approval, configuration and role assignment. MFA enforced.</li>
          <li className="text-foreground">Enforcement of these scopes is BACKEND REQUIRED.</li>
        </ul>
      </Card>
    </div>
  );
}
