import { useState, useEffect } from "react";
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
  Play,
  RotateCw,
  Search,
} from "lucide-react";
import { Card, Metric } from "@/components/ism/SellerShell";
import { Logo, LogoMark } from "@/components/ism/Logo";
import { CATEGORIES, PRODUCTS, SELLERS, formatAUD } from "@/lib/ism-data";
import {
  getMarketplaceFinanceMetricsServerFn,
  reconcileAndUnlockEligiblePayoutsServerFn,
  generateSellerPayoutBatchCsvServerFn,
  executeSellerStripePayoutServerFn,
  getAdminSellersServerFn,
  moderateSellerStatusServerFn,
  getAdminProductsServerFn,
  moderateProductStatusServerFn,
  getAdminOrdersServerFn,
  getAdminReturnsServerFn,
  moderateReturnServerFn,
  getAdminLedgerServerFn,
  getAdminUsersServerFn,
  updateUserRoleServerFn,
  getMarketplaceConfigServerFn,
  updateMarketplaceConfigServerFn,
  getAdminAuditLogsServerFn,
  type FinanceSummaryMetrics,
} from "@/lib/api/admin-finance";
import {
  runSystemJobServerFn,
  getDeadLetterQueueServerFn,
  retryDeadLetterItemServerFn,
} from "@/lib/api/jobs";
import {
  ATTRIBUTE_TYPES,
  CATEGORY_TREE,
  ORDER_STATUS_GROUPS,
  PAYOUT_RULE,
  PAYOUT_STAGES,
  MARKETPLACE_CONFIG,
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
  { id: "qa", label: "Background Jobs & QA", icon: ClipboardCheck },
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
          "Admin console: Live GMV, seller approvals, product moderation, orders, returns, payouts and audit across ISM Australia.",
      },
      { property: "og:title", content: "Marketplace Admin — Indian Shopping Mela" },
      {
        property: "og:description",
        content: "Authoritative operations console for the ISM Australian marketplace.",
      },
    ],
  }),
  component: AdminPage,
});

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "info" | "muted" | "bad";
}) {
  const map = {
    ok: "bg-teal/12 text-teal",
    warn: "bg-marigold/20 text-marigold-foreground",
    info: "bg-primary/10 text-primary",
    muted: "bg-muted text-muted-foreground",
    bad: "bg-rani/12 text-rani",
  } as const;

  return (
    <span
      className={`inline-block rounded-sm px-2 py-1 text-[10px] font-bold uppercase ${map[tone]}`}
    >
      {children}
    </span>
  );
}

function AdminPage() {
  const [section, setSection] = useState<Section>("dashboard");

  // Live state from backend
  const [financeMetrics, setFinanceMetrics] = useState<FinanceSummaryMetrics | null>(null);
  const [sellersList, setSellersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [ledgerList, setLedgerList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [deadLetters, setDeadLetters] = useState<{
    webhookDeadLetters: any[];
    notificationDeadLetters: any[];
  }>({
    webhookDeadLetters: [],
    notificationDeadLetters: [],
  });

  const refreshAll = () => {
    getMarketplaceFinanceMetricsServerFn()
      .then(setFinanceMetrics)
      .catch(() => null);
    getAdminSellersServerFn()
      .then(setSellersList)
      .catch(() => null);
    getAdminProductsServerFn()
      .then(setProductsList)
      .catch(() => null);
    getAdminOrdersServerFn()
      .then(setOrdersList)
      .catch(() => null);
    getAdminReturnsServerFn()
      .then(setReturnsList)
      .catch(() => null);
    getAdminLedgerServerFn()
      .then(setLedgerList)
      .catch(() => null);
    getAdminUsersServerFn()
      .then(setUsersList)
      .catch(() => null);
    getAdminAuditLogsServerFn()
      .then(setAuditLogs)
      .catch(() => null);
    getDeadLetterQueueServerFn()
      .then(setDeadLetters)
      .catch(() => null);
  };

  useEffect(() => {
    refreshAll();
  }, [section]);

  const handleApproveSeller = async (sellerId: string, name: string) => {
    try {
      await moderateSellerStatusServerFn({ data: { sellerId, status: "APPROVED" } });
      toast.success("Seller Approved", { description: name });
      getAdminSellersServerFn().then(setSellersList);
    } catch (err: any) {
      toast.error("Approval failed", { description: err.message });
    }
  };

  const handleRejectSeller = async (sellerId: string, name: string) => {
    try {
      await moderateSellerStatusServerFn({ data: { sellerId, status: "REJECTED" } });
      toast.info("Seller Application Rejected", { description: name });
      getAdminSellersServerFn().then(setSellersList);
    } catch (err: any) {
      toast.error("Rejection failed", { description: err.message });
    }
  };

  const handleModerateProduct = async (productId: string, status: "LIVE" | "REJECTED") => {
    try {
      await moderateProductStatusServerFn({ data: { productId, status } });
      toast.success(`Product ${status === "LIVE" ? "Published" : "Rejected"}`);
      getAdminProductsServerFn().then(setProductsList);
    } catch (err: any) {
      toast.error("Action failed", { description: err.message });
    }
  };

  const handleModerateReturn = async (
    returnId: string,
    action: "APPROVE" | "REJECT" | "REFUND",
  ) => {
    try {
      await moderateReturnServerFn({ data: { returnId, action } });
      toast.success(`Return Action: ${action} processed`);
      getAdminReturnsServerFn().then(setReturnsList);
    } catch (err: any) {
      toast.error("Action failed", { description: err.message });
    }
  };

  const handleRunJob = async (jobName: any) => {
    try {
      const res = await runSystemJobServerFn({ data: { jobName } });
      toast.success(`Job ${jobName} Executed`, {
        description: `Processed: ${res.processedCount} item(s)`,
      });
      refreshAll();
    } catch (err: any) {
      toast.error("Job execution failed", { description: err.message });
    }
  };

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
            <span className="ml-auto rounded-sm bg-teal/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal">
              Live Operations
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
                <Metric
                  label="Live GMV"
                  value={formatAUD(financeMetrics?.totalGmvAud ?? 0)}
                  note="authoritative ledger"
                  tone="rani"
                />
                <Metric
                  label="Platform Commission"
                  value={formatAUD(financeMetrics?.totalPlatformCommissionAud ?? 0)}
                  note="ISM net revenue"
                />
                <Metric
                  label="Pending 14-Day Holds"
                  value={formatAUD(financeMetrics?.totalPendingHoldAud ?? 0)}
                  note="delivery clearance"
                  tone="marigold"
                />
                <Metric
                  label="Matured Payouts Due"
                  value={formatAUD(financeMetrics?.totalEligiblePayoutsAud ?? 0)}
                  note="ready for Stripe"
                  tone="teal"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Metric
                  label="Registered Sellers"
                  value={String(sellersList.length)}
                  note={`${sellersList.filter((s) => s.status === "approved").length} approved`}
                  tone="teal"
                />
                <Metric
                  label="Live Catalogue Items"
                  value={String(productsList.length)}
                  note="across all sellers"
                  tone="marigold"
                />
                <Metric
                  label="Active Orders"
                  value={String(ordersList.length)}
                  note="live fulfillment"
                />
                <Metric
                  label="Open Returns"
                  value={String(returnsList.length)}
                  note="under review"
                  tone="rani"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Pending Seller Approvals">
                  <div className="divide-y divide-border text-sm">
                    {sellersList
                      .filter((s) => s.status !== "approved")
                      .slice(0, 5)
                      .map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div>
                            <p className="font-medium">{s.business_name || s.store_name}</p>
                            <p className="text-xs text-muted-foreground">
                              ABN: {s.abn || "N/A"} · {s.email}
                            </p>
                          </div>
                          <div className="space-x-2">
                            <button
                              onClick={() => handleApproveSeller(s.id, s.business_name)}
                              className="rounded-sm bg-teal px-3 py-1.5 text-[11px] font-bold uppercase text-teal-foreground"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectSeller(s.id, s.business_name)}
                              className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase hover:border-rani hover:text-rani"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    {sellersList.filter((s) => s.status !== "approved").length === 0 && (
                      <p className="text-xs text-muted-foreground py-3">
                        All registered sellers are approved.
                      </p>
                    )}
                  </div>
                </Card>

                <Card title="Product Moderation Queue">
                  <div className="divide-y divide-border text-sm">
                    {productsList
                      .filter((p) => p.status === "PENDING_REVIEW" || p.status === "DRAFT")
                      .slice(0, 5)
                      .map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                          <div>
                            <p className="font-medium">{p.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatAUD(Number(p.price))} · {p.seller?.business_name || "Seller"}
                            </p>
                          </div>
                          <div className="space-x-2">
                            <button
                              onClick={() => handleModerateProduct(p.id, "LIVE")}
                              className="rounded-sm bg-teal px-3 py-1.5 text-[11px] font-bold uppercase text-teal-foreground"
                            >
                              Publish
                            </button>
                            <button
                              onClick={() => handleModerateProduct(p.id, "REJECTED")}
                              className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase hover:border-rani hover:text-rani"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    {productsList.filter((p) => p.status === "PENDING_REVIEW").length === 0 && (
                      <p className="text-xs text-muted-foreground py-3">
                        No pending listings awaiting review.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}

          {section === "sellers" && (
            <Card title="Registered Marketplace Sellers">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Store / Business</th>
                      <th className="pb-2">ABN</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Stripe Account</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sellersList.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 font-medium">{s.business_name || s.store_name}</td>
                        <td className="text-muted-foreground font-mono text-xs">
                          {s.abn || "Pending"}
                        </td>
                        <td>{s.email}</td>
                        <td className="font-mono text-xs">
                          {s.stripe_account_id
                            ? s.stripe_account_id.slice(0, 14) + "..."
                            : "Not Connected"}
                        </td>
                        <td>
                          <StatusBadge
                            tone={
                              s.status === "approved"
                                ? "ok"
                                : s.status === "suspended"
                                  ? "bad"
                                  : "warn"
                            }
                          >
                            {s.status}
                          </StatusBadge>
                        </td>
                        <td className="text-right space-x-2">
                          {s.status !== "approved" && (
                            <button
                              onClick={() => handleApproveSeller(s.id, s.business_name)}
                              className="rounded-sm bg-teal px-2.5 py-1 text-[11px] font-bold uppercase text-teal-foreground"
                            >
                              Approve
                            </button>
                          )}
                          {s.status === "approved" && (
                            <button
                              onClick={() => handleRejectSeller(s.id, s.business_name)}
                              className="rounded-sm border border-border px-2.5 py-1 text-[11px] font-bold uppercase hover:border-rani hover:text-rani"
                            >
                              Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "products" && (
            <Card title="Catalogue & Moderation Queue">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Title</th>
                      <th className="pb-2">Seller</th>
                      <th className="pb-2">Price</th>
                      <th className="pb-2">Stock</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {productsList.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 font-medium">{p.title}</td>
                        <td className="text-muted-foreground">
                          {p.seller?.business_name || "Seller"}
                        </td>
                        <td>{formatAUD(Number(p.price))}</td>
                        <td>{p.stock_quantity}</td>
                        <td>
                          <StatusBadge
                            tone={
                              p.status === "LIVE" ? "ok" : p.status === "REJECTED" ? "bad" : "warn"
                            }
                          >
                            {p.status}
                          </StatusBadge>
                        </td>
                        <td className="text-right space-x-2">
                          <button
                            onClick={() =>
                              handleModerateProduct(p.id, p.status === "LIVE" ? "REJECTED" : "LIVE")
                            }
                            className="rounded-sm border border-border px-2.5 py-1 text-[11px] font-bold uppercase hover:border-rani hover:text-rani"
                          >
                            {p.status === "LIVE" ? "Unpublish" : "Approve & Publish"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "orders" && (
            <Card title="Marketplace Orders & Fulfilment">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Order ID</th>
                      <th className="pb-2">Customer</th>
                      <th className="pb-2">Seller Packages</th>
                      <th className="pb-2">Total Amount</th>
                      <th className="pb-2">Payment</th>
                      <th className="pb-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {ordersList.map((o) => (
                      <tr key={o.id}>
                        <td className="py-2.5 font-mono text-xs font-semibold">
                          {o.order_number || o.id}
                        </td>
                        <td>{o.customer_name || o.customer_email}</td>
                        <td>{o.sub_orders?.length || 1} package(s)</td>
                        <td>{formatAUD(Number(o.total_amount))}</td>
                        <td>
                          <StatusBadge tone={o.payment_status === "PAID" ? "ok" : "warn"}>
                            {o.payment_status}
                          </StatusBadge>
                        </td>
                        <td className="text-right">
                          <StatusBadge
                            tone={
                              o.status === "CONFIRMED" || o.status === "DELIVERED" ? "ok" : "info"
                            }
                          >
                            {o.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "returns" && (
            <Card title="Returns & Claims Queue (7-Day ACL)">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Return Ref</th>
                      <th className="pb-2">Seller</th>
                      <th className="pb-2">Reason</th>
                      <th className="pb-2">Refund Total</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {returnsList.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 font-mono text-xs">#{r.id.slice(0, 8)}</td>
                        <td className="text-muted-foreground">
                          {r.seller?.business_name || "Seller"}
                        </td>
                        <td className="text-xs">{r.reason}</td>
                        <td>{formatAUD(Number(r.refund_amount))}</td>
                        <td>
                          <StatusBadge
                            tone={
                              r.status === "RETURN_APPROVED" ||
                              r.status === "APPROVED" ||
                              r.status === "REFUNDED"
                                ? "ok"
                                : "warn"
                            }
                          >
                            {r.status}
                          </StatusBadge>
                        </td>
                        <td className="text-right space-x-2">
                          {(r.status === "RETURN_REQUESTED" || r.status === "REQUESTED") && (
                            <button
                              onClick={() => handleModerateReturn(r.id, "APPROVE")}
                              className="rounded-sm bg-teal px-2.5 py-1 text-[11px] font-bold uppercase text-teal-foreground"
                            >
                              Approve
                            </button>
                          )}
                          {(r.status === "RETURN_APPROVED" || r.status === "APPROVED") && (
                            <button
                              onClick={() => handleModerateReturn(r.id, "REFUND")}
                              className="rounded-sm bg-primary px-2.5 py-1 text-[11px] font-bold uppercase text-primary-foreground"
                            >
                              Issue Refund
                            </button>
                          )}
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
              <Card title="Immutable Ledger Explorer">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full min-w-[880px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">ID</th>
                        <th className="pb-2">Entry Type</th>
                        <th className="pb-2">Amount (Cents)</th>
                        <th className="pb-2">AUD</th>
                        <th className="pb-2">Order Ref</th>
                        <th className="pb-2">Description</th>
                        <th className="pb-2 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledgerList.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2 font-mono text-xs">{l.id.slice(0, 8)}</td>
                          <td className="font-semibold text-xs">{l.entry_type}</td>
                          <td className="font-mono text-xs">
                            {l.amount_cents ?? Math.round(l.amount * 100)}
                          </td>
                          <td className={Number(l.amount) < 0 ? "text-rani" : "text-teal"}>
                            {formatAUD(Number(l.amount || l.amount_cents / 100))}
                          </td>
                          <td className="font-mono text-xs text-muted-foreground">
                            {l.order_id || "N/A"}
                          </td>
                          <td className="text-xs text-muted-foreground">{l.description}</td>
                          <td className="text-right text-xs text-muted-foreground">
                            {new Date(l.created_at).toLocaleDateString("en-AU")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const res = await reconcileAndUnlockEligiblePayoutsServerFn();
                    toast.success(
                      `Reconciled 14-day holds: ${res.eligibleSellersCount} seller(s) eligible (${formatAUD(res.totalEligiblePayoutAud)})`,
                    );
                    refreshAll();
                  }}
                  className="rounded-sm bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase"
                >
                  Reconcile 14-Day Holds
                </button>
                <button
                  onClick={async () => {
                    const res = await generateSellerPayoutBatchCsvServerFn();
                    toast.success(
                      `Batch ${res.batchId} generated: ${res.sellerCount} sellers (${formatAUD(res.totalPayoutAud)})`,
                    );
                  }}
                  className="rounded-sm border border-border px-4 py-2 text-xs font-bold uppercase hover:border-rani hover:text-rani"
                >
                  Export ABA Settlement CSV
                </button>
              </div>
            </div>
          )}

          {section === "users" && (
            <Card title="User Profiles & System Roles">
              <div className="max-h-[70vh] overflow-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">User</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Current Role</th>
                      <th className="pb-2 text-right">Assign Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usersList.map((u) => (
                      <tr key={u.id}>
                        <td className="py-2.5 font-medium">{u.full_name || "Customer"}</td>
                        <td>{u.email}</td>
                        <td>
                          <StatusBadge
                            tone={
                              u.role === "admin_super"
                                ? "bad"
                                : ["admin_support", "admin_catalogue", "admin_finance"].includes(
                                      u.role,
                                    )
                                  ? "warn"
                                  : u.role === "seller_owner" || u.role === "seller_staff"
                                    ? "info"
                                    : "muted"
                            }
                          >
                            {u.role}
                          </StatusBadge>
                        </td>
                        <td className="text-right">
                          <select
                            value={u.role}
                            onChange={async (e) => {
                              try {
                                await updateUserRoleServerFn({
                                  data: { userId: u.id, newRole: e.target.value as any },
                                });
                                toast.success(`Updated role for ${u.email} to ${e.target.value}`);
                                getAdminUsersServerFn().then(setUsersList);
                              } catch (err: any) {
                                toast.error("Failed to update role", { description: err.message });
                              }
                            }}
                            className="h-8 rounded-sm border border-input bg-surface px-2 text-xs font-semibold"
                          >
                            <option value="customer">Customer</option>
                            <option value="seller_owner">Seller Owner</option>
                            <option value="seller_staff">Seller Staff</option>
                            <option value="admin_support">Admin — Support</option>
                            <option value="admin_catalogue">Admin — Catalogue</option>
                            <option value="admin_finance">Admin — Finance</option>
                            <option value="admin_super">Admin — Super (MFA)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {section === "qa" && (
            <div className="space-y-4">
              <Card title="Background Job Harness (No Browser Connection Required)">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="border border-border p-3 rounded-sm space-y-2">
                    <p className="font-semibold text-sm">Reservation Expiry Worker</p>
                    <p className="text-xs text-muted-foreground">
                      Releases atomic stock reservations &gt; 15 min old.
                    </p>
                    <button
                      onClick={() => handleRunJob("reservation_expiry")}
                      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-sm text-xs font-bold uppercase"
                    >
                      <Play size={13} /> Run Expiry Job
                    </button>
                  </div>
                  <div className="border border-border p-3 rounded-sm space-y-2">
                    <p className="font-semibold text-sm">Payout Maturity Worker</p>
                    <p className="text-xs text-muted-foreground">
                      Matures delivered orders &gt; 14 days without active holds.
                    </p>
                    <button
                      onClick={() => handleRunJob("payout_eligibility")}
                      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-sm text-xs font-bold uppercase"
                    >
                      <Play size={13} /> Run Payout Job
                    </button>
                  </div>
                  <div className="border border-border p-3 rounded-sm space-y-2">
                    <p className="font-semibold text-sm">Notification Retry Worker</p>
                    <p className="text-xs text-muted-foreground">
                      Retries queued transactional emails with backoff.
                    </p>
                    <button
                      onClick={() => handleRunJob("notification_retry")}
                      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-sm text-xs font-bold uppercase"
                    >
                      <Play size={13} /> Run Retry Worker
                    </button>
                  </div>
                  <div className="border border-border p-3 rounded-sm space-y-2">
                    <p className="font-semibold text-sm">Bulk Import Worker</p>
                    <p className="text-xs text-muted-foreground">
                      Processes queued product CSV/XLSX chunks in background.
                    </p>
                    <button
                      onClick={() => handleRunJob("bulk_import")}
                      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-sm text-xs font-bold uppercase"
                    >
                      <Play size={13} /> Run Import Worker
                    </button>
                  </div>
                  <div className="border border-border p-3 rounded-sm space-y-2">
                    <p className="font-semibold text-sm">Provider Retry Worker</p>
                    <p className="text-xs text-muted-foreground">
                      Re-attempts pending carrier tracking &amp; webhook processing.
                    </p>
                    <button
                      onClick={() => handleRunJob("provider_retry")}
                      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-sm text-xs font-bold uppercase"
                    >
                      <Play size={13} /> Run Provider Retry
                    </button>
                  </div>
                </div>
              </Card>

              <Card title="Dead-Letter Queue &amp; Failure Visibility">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Exhausted webhook events and notifications are moved here after 3 retries for
                    operational investigation.
                  </p>
                  {deadLetters.webhookDeadLetters.length === 0 &&
                  deadLetters.notificationDeadLetters.length === 0 ? (
                    <p className="text-xs text-teal font-semibold py-2">
                      ✓ Dead-Letter queue is completely clear (0 failed jobs).
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {deadLetters.webhookDeadLetters.map((dl) => (
                        <div key={dl.id} className="py-2 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold">
                              Webhook: {dl.provider} ({dl.event_type})
                            </span>
                            <p className="text-muted-foreground">Error: {dl.last_error}</p>
                          </div>
                          <button
                            onClick={async () => {
                              await retryDeadLetterItemServerFn({
                                data: { itemType: "webhook", itemId: dl.id },
                              });
                              toast.success("Requeued for retry");
                              getDeadLetterQueueServerFn().then(setDeadLetters);
                            }}
                            className="border px-2 py-1 rounded-sm uppercase font-bold"
                          >
                            Retry
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {section === "audit" && (
            <Card title="Compliance &amp; Security Audit Trail">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Timestamp</th>
                      <th className="pb-2">Action</th>
                      <th className="pb-2">Entity Type</th>
                      <th className="pb-2">Entity ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString("en-AU")}
                        </td>
                        <td className="font-mono text-xs font-semibold">{a.action}</td>
                        <td className="text-xs text-muted-foreground">{a.entity_type}</td>
                        <td className="font-mono text-xs text-muted-foreground">{a.entity_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
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

  const handleSaveConfig = async () => {
    try {
      for (const item of config) {
        await updateMarketplaceConfigServerFn({
          data: { key: item.id, value: item.value, description: item.label },
        });
      }
      toast.success("Marketplace configuration saved to database!");
    } catch (err: any) {
      toast.error("Failed to persist config", { description: err.message });
    }
  };

  return (
    <Card title="Marketplace Configuration (Database-Backed)">
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
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSaveConfig}
          className="rounded-sm bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-primary-foreground"
        >
          Save Configuration
        </button>
      </div>
    </Card>
  );
}
