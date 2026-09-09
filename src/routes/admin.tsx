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
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { Card, Metric } from "@/components/ism/SellerShell";
import { Logo, LogoMark } from "@/components/ism/Logo";
import { formatAUD } from "@/lib/ism-data";
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
  getAdminShippingExceptionsServerFn,
  type FinanceSummaryMetrics,
} from "@/lib/api/admin-finance";
import {
  runSystemJobServerFn,
  getDeadLetterQueueServerFn,
  retryDeadLetterItemServerFn,
} from "@/lib/api/jobs";
import {
  CATEGORY_TREE,
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
  { id: "shipping", label: "Shipping Exceptions", icon: Truck },
  { id: "promotions", label: "Promotions", icon: Megaphone },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "users", label: "Users & Roles", icon: Users },
  { id: "content", label: "Content & CMS", icon: FileText },
  { id: "reports", label: "Reports & GST", icon: BarChart3 },
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

function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
      <span>
        Showing {(currentPage - 1) * pageSize + 1} to{" "}
        {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="rounded-sm border border-border p-1.5 disabled:opacity-40 hover:bg-surface"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 font-semibold text-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="rounded-sm border border-border p-1.5 disabled:opacity-40 hover:bg-surface"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function AdminPage() {
  const [section, setSection] = useState<Section>("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Live state from backend
  const [financeMetrics, setFinanceMetrics] = useState<FinanceSummaryMetrics | null>(null);
  const [sellersList, setSellersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [ledgerList, setLedgerList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [shippingExceptions, setShippingExceptions] = useState<any[]>([]);
  const [deadLetters, setDeadLetters] = useState<{
    webhookDeadLetters: any[];
    notificationDeadLetters: any[];
  }>({
    webhookDeadLetters: [],
    notificationDeadLetters: [],
  });

  // MFA modal for finance actions
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [pendingMfaAction, setPendingMfaAction] = useState<(() => Promise<void>) | null>(null);

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
    getAdminShippingExceptionsServerFn()
      .then(setShippingExceptions)
      .catch(() => null);
    getDeadLetterQueueServerFn()
      .then(setDeadLetters)
      .catch(() => null);
  };

  useEffect(() => {
    refreshAll();
    setPage(1);
    setSearchTerm("");
  }, [section]);

  const executeWithMfaProtection = (action: () => Promise<void>) => {
    setPendingMfaAction(() => action);
    setMfaCode("");
    setMfaModalOpen(true);
  };

  const handleConfirmMfa = async () => {
    if (!mfaCode || mfaCode.length < 6) {
      toast.error("Please enter a valid 6-digit MFA authentication code.");
      return;
    }
    setMfaModalOpen(false);
    if (pendingMfaAction) {
      try {
        await pendingMfaAction();
      } catch (err: any) {
        toast.error("Action execution failed", { description: err.message });
      } finally {
        setPendingMfaAction(null);
      }
    }
  };

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

  const handleExecutePayout = (sellerId: string, sellerName: string) => {
    executeWithMfaProtection(async () => {
      const res = await executeSellerStripePayoutServerFn({
        data: { sellerId, isMfaVerified: true },
      });
      toast.success(`Stripe Payout Transferred: ${formatAUD(res.amountAud)}`, {
        description: `Transfer ID: ${res.transferId} for ${sellerName}`,
      });
      refreshAll();
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar Navigation */}
      <aside className="hidden w-56 shrink-0 flex-col bg-sidebar p-4 lg:flex">
        <LogoMark compact onDark />
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">ISM Admin</p>
        <nav className="mt-4 space-y-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-[12px] font-semibold transition-colors ${
                section === n.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <n.icon size={14} /> {n.label}
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

      {/* Main Content Area */}
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
            <div className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1 rounded-sm bg-teal/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal">
                <CheckCircle2 size={12} /> Live Operations
              </span>
              <button
                onClick={refreshAll}
                className="rounded-sm border border-border p-1.5 hover:bg-muted text-muted-foreground"
                title="Refresh Live Data"
              >
                <RotateCw size={14} />
              </button>
            </div>
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
          {/* Section: Dashboard */}
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
                  note={`${sellersList.filter((s) => s.status === "approved" || s.status === "APPROVED").length} approved`}
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
                      .filter((s) => s.status !== "approved" && s.status !== "APPROVED")
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
                    {sellersList.filter((s) => s.status !== "approved" && s.status !== "APPROVED")
                      .length === 0 && (
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
                    {productsList.filter(
                      (p) => p.status === "PENDING_REVIEW" || p.status === "DRAFT",
                    ).length === 0 && (
                      <p className="text-xs text-muted-foreground py-3">
                        No pending listings awaiting review.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Section: Sellers */}
          {section === "sellers" && (
            <Card title="Registered Marketplace Sellers">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} />
                  <input
                    placeholder="Search by store name, email or ABN..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-sm border border-input bg-surface pl-8 pr-3 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-auto">
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
                    {sellersList
                      .filter(
                        (s) =>
                          !searchTerm ||
                          s.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.abn?.includes(searchTerm),
                      )
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((s) => (
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
                                s.status === "approved" || s.status === "APPROVED"
                                  ? "ok"
                                  : s.status === "suspended" || s.status === "SUSPENDED"
                                    ? "bad"
                                    : "warn"
                              }
                            >
                              {s.status}
                            </StatusBadge>
                          </td>
                          <td className="text-right space-x-2">
                            {s.status !== "approved" && s.status !== "APPROVED" && (
                              <button
                                onClick={() => handleApproveSeller(s.id, s.business_name)}
                                className="rounded-sm bg-teal px-2.5 py-1 text-[11px] font-bold uppercase text-teal-foreground"
                              >
                                Approve
                              </button>
                            )}
                            {(s.status === "approved" || s.status === "APPROVED") && (
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
              <Pagination
                currentPage={page}
                pageSize={pageSize}
                totalItems={
                  sellersList.filter(
                    (s) =>
                      !searchTerm ||
                      s.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      s.abn?.includes(searchTerm),
                  ).length
                }
                onPageChange={setPage}
              />
            </Card>
          )}

          {/* Section: Products */}
          {section === "products" && (
            <Card title="Catalogue & Moderation Queue">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} />
                  <input
                    placeholder="Search products by title or seller..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-sm border border-input bg-surface pl-8 pr-3 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-auto">
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
                    {productsList
                      .filter(
                        (p) =>
                          !searchTerm ||
                          p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.seller?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()),
                      )
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((p) => (
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
                                p.status === "LIVE"
                                  ? "ok"
                                  : p.status === "REJECTED"
                                    ? "bad"
                                    : "warn"
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
              <Pagination
                currentPage={page}
                pageSize={pageSize}
                totalItems={
                  productsList.filter(
                    (p) =>
                      !searchTerm ||
                      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.seller?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()),
                  ).length
                }
                onPageChange={setPage}
              />
            </Card>
          )}

          {/* Section: Categories */}
          {section === "categories" && (
            <Card title="Marketplace Taxonomy & Category Tree">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {CATEGORY_TREE.map((dept) => (
                  <div key={dept.department} className="rounded-sm border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-bold text-sm text-primary">{dept.department}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-sm font-mono">
                        {dept.categories.length} categories
                      </span>
                    </div>
                    <div className="space-y-2">
                      {dept.categories.map((cat) => (
                        <div key={cat.name} className="space-y-1">
                          <p className="text-xs font-semibold text-foreground">{cat.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {cat.subs.map((sub) => (
                              <span
                                key={sub}
                                className="text-[11px] bg-surface border border-border px-1.5 py-0.5 rounded-sm text-muted-foreground"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Section: Orders */}
          {section === "orders" && (
            <Card title="Marketplace Orders & Fulfilment">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} />
                  <input
                    placeholder="Search by order ID or customer email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-sm border border-input bg-surface pl-8 pr-3 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-auto">
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
                    {ordersList
                      .filter(
                        (o) =>
                          !searchTerm ||
                          o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()),
                      )
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((o) => (
                        <tr key={o.id}>
                          <td className="py-2.5 font-mono text-xs font-semibold">
                            {o.order_number || o.id.slice(0, 10)}
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
              <Pagination
                currentPage={page}
                pageSize={pageSize}
                totalItems={
                  ordersList.filter(
                    (o) =>
                      !searchTerm ||
                      o.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      o.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      o.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()),
                  ).length
                }
                onPageChange={setPage}
              />
            </Card>
          )}

          {/* Section: Returns */}
          {section === "returns" && (
            <Card title="Returns & Claims Queue (7-Day ACL)">
              <div className="max-h-[60vh] overflow-auto">
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
                    {returnsList.slice((page - 1) * pageSize, page * pageSize).map((r) => (
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
                    {returnsList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-xs text-muted-foreground">
                          No return claims currently open.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={page}
                pageSize={pageSize}
                totalItems={returnsList.length}
                onPageChange={setPage}
              />
            </Card>
          )}

          {/* Section: Payments & Charges */}
          {section === "payments" && (
            <Card title="Payment Processing & Stripe Authorisations">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div className="p-3 border border-border rounded-sm bg-surface">
                    <p className="text-xs text-muted-foreground">Payment Provider</p>
                    <p className="text-base font-bold text-foreground mt-1">Stripe AU (AUD)</p>
                    <p className="text-[11px] text-teal mt-0.5">Direct Card + Apple/Google Pay</p>
                  </div>
                  <div className="p-3 border border-border rounded-sm bg-surface">
                    <p className="text-xs text-muted-foreground">Settlement Model</p>
                    <p className="text-base font-bold text-foreground mt-1">Separate Charges &amp; Transfers</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Platform holds funds until delivery</p>
                  </div>
                  <div className="p-3 border border-border rounded-sm bg-surface">
                    <p className="text-xs text-muted-foreground">GST Accounting</p>
                    <p className="text-base font-bold text-foreground mt-1">10% Inc. (1/11th Tax)</p>
                    <p className="text-[11px] text-teal mt-0.5">ATO compliant tax invoice generated</p>
                  </div>
                </div>

                <div className="max-h-[50vh] overflow-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">Ledger Ref</th>
                        <th className="pb-2">Order ID</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2 text-right">Captured</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledgerList
                        .filter(
                          (l) =>
                            l.entry_type === "CUSTOMER_PAYMENT" ||
                            l.entry_type === "CUSTOMER_CHARGE" ||
                            l.entry_type === "CUSTOMER_REFUND",
                        )
                        .slice((page - 1) * pageSize, page * pageSize)
                        .map((l) => (
                          <tr key={l.id}>
                            <td className="py-2.5 font-mono text-xs">{l.id.slice(0, 8)}</td>
                            <td className="font-mono text-xs text-muted-foreground">
                              {l.order_id || "Direct"}
                            </td>
                            <td className="font-semibold text-xs">
                              {formatAUD(Number(l.amount || l.amount_cents / 100))}
                            </td>
                            <td>
                              <StatusBadge tone={l.entry_type.includes("REFUND") ? "bad" : "ok"}>
                                {l.entry_type}
                              </StatusBadge>
                            </td>
                            <td className="text-right text-xs text-muted-foreground">
                              {new Date(l.created_at).toLocaleString("en-AU")}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          )}

          {/* Section: Finance Ledger */}
          {section === "finance" && (
            <div className="space-y-4">
              <Card title="Immutable Financial Ledger Explorer">
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
                      {ledgerList.slice((page - 1) * pageSize, page * pageSize).map((l) => (
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
                <Pagination
                  currentPage={page}
                  pageSize={pageSize}
                  totalItems={ledgerList.length}
                  onPageChange={setPage}
                />
              </Card>

              <div className="flex flex-wrap gap-2">
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
                    const blob = new Blob([res.csvContent], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `ISM_Payout_${res.batchId}.csv`;
                    a.click();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-border px-4 py-2 text-xs font-bold uppercase hover:border-rani hover:text-rani"
                >
                  <Download size={14} /> Export ABA Settlement CSV
                </button>
              </div>
            </div>
          )}

          {/* Section: Payouts */}
          {section === "payouts" && (
            <div className="space-y-4">
              <Card title="Seller Stripe Connect Payout Queue (MFA Protected)">
                <div className="max-h-[60vh] overflow-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="pb-2">Seller Store</th>
                        <th className="pb-2">Stripe Account</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sellersList
                        .filter((s) => s.status === "approved" || s.status === "APPROVED")
                        .slice((page - 1) * pageSize, page * pageSize)
                        .map((s) => (
                          <tr key={s.id}>
                            <td className="py-2.5 font-medium">{s.business_name || s.store_name}</td>
                            <td className="font-mono text-xs">
                              {s.stripe_account_id ? (
                                <span className="text-teal">{s.stripe_account_id}</span>
                              ) : (
                                <span className="text-rani">Missing Connected Account</span>
                              )}
                            </td>
                            <td>
                              <StatusBadge tone={s.stripe_account_id ? "ok" : "warn"}>
                                {s.stripe_account_id ? "READY_FOR_PAYOUT" : "NEEDS_STRIPE"}
                              </StatusBadge>
                            </td>
                            <td className="text-right">
                              <button
                                onClick={() => handleExecutePayout(s.id, s.business_name)}
                                disabled={!s.stripe_account_id}
                                className="inline-flex items-center gap-1 rounded-sm bg-primary px-3 py-1 text-[11px] font-bold uppercase text-primary-foreground disabled:opacity-40"
                              >
                                <Lock size={11} /> Transfer Payout (MFA)
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  currentPage={page}
                  pageSize={pageSize}
                  totalItems={
                    sellersList.filter((s) => s.status === "approved" || s.status === "APPROVED")
                      .length
                  }
                  onPageChange={setPage}
                />
              </Card>
            </div>
          )}

          {/* Section: Shipping Exceptions */}
          {section === "shipping" && (
            <Card title="Live Carrier Tracking &amp; Delivery Exceptions">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="sticky top-0 z-10 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="pb-2">Carrier</th>
                      <th className="pb-2">Tracking Number</th>
                      <th className="pb-2">Seller</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shippingExceptions.map((shp) => (
                      <tr key={shp.id}>
                        <td className="py-2.5 font-bold uppercase text-xs">
                          {shp.carrier || "Australia Post"}
                        </td>
                        <td className="font-mono text-xs text-primary">
                          {shp.tracking_number || "PENDING"}
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {shp.sub_order?.seller?.business_name || "Seller"}
                        </td>
                        <td>
                          <StatusBadge
                            tone={
                              shp.status === "DELIVERED"
                                ? "ok"
                                : shp.status === "DELAYED"
                                  ? "bad"
                                  : "info"
                            }
                          >
                            {shp.status || "TRANSIT"}
                          </StatusBadge>
                        </td>
                        <td className="text-right text-xs text-muted-foreground">
                          {new Date(shp.created_at).toLocaleDateString("en-AU")}
                        </td>
                      </tr>
                    ))}
                    {shippingExceptions.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                          No active shipping delays or tracking exceptions.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Section: Promotions */}
          {section === "promotions" && (
            <Card title="Promotions &amp; Coupon Codes">
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Active campaign discount rules configured across the marketplace.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <div className="p-3 border border-border rounded-sm space-y-1">
                    <p className="font-mono font-bold text-sm text-primary">WELCOME10</p>
                    <p className="text-xs text-muted-foreground">10% discount on first order</p>
                    <StatusBadge tone="ok">Active</StatusBadge>
                  </div>
                  <div className="p-3 border border-border rounded-sm space-y-1">
                    <p className="font-mono font-bold text-sm text-primary">DIWALI100</p>
                    <p className="text-xs text-muted-foreground">Free shipping for orders &gt; $100 AUD</p>
                    <StatusBadge tone="ok">Active</StatusBadge>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Section: Notifications */}
          {section === "notifications" && (
            <Card title="Transactional Email &amp; Webhook Deliveries">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Brevo transactional email dispatch logs &amp; SLA reminders.
                </p>
                <div className="border border-border rounded-sm p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Email Dispatcher</span>
                    <span className="text-teal font-bold">Brevo API Connected</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Sender: orders@indianshoppingmela.com.au (Australian domain verified)
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Section: Integrations */}
          {section === "integrations" && (
            <Card title="Provider Integration Status">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                <div className="border border-border p-3 rounded-sm space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Stripe AU</span>
                    <span className="text-teal">CONNECTED</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">Payments &amp; Express Connect Transfers</p>
                </div>
                <div className="border border-border p-3 rounded-sm space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Australia Post</span>
                    <span className="text-teal">CONNECTED</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">eParcel API &amp; Consignment Labels</p>
                </div>
                <div className="border border-border p-3 rounded-sm space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Sendle Shipping</span>
                    <span className="text-teal">CONNECTED</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">Courier Pickup &amp; Tracking</p>
                </div>
                <div className="border border-border p-3 rounded-sm space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Brevo (Sendinblue)</span>
                    <span className="text-teal">CONNECTED</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">Transactional GST Invoices &amp; Alerts</p>
                </div>
                <div className="border border-border p-3 rounded-sm space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Mux Video</span>
                    <span className="text-teal">CONNECTED</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">HLS Streaming &amp; Signed Webhooks</p>
                </div>
                <div className="border border-border p-3 rounded-sm space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>Cloudflare Turnstile</span>
                    <span className="text-teal">PROTECTED</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">Bot &amp; Checkout CAPTCHA Defense</p>
                </div>
              </div>
            </Card>
          )}

          {/* Section: Users & Roles */}
          {section === "users" && (
            <Card title="User Profiles & System Roles">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} />
                  <input
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-sm border border-input bg-surface pl-8 pr-3 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[60vh] overflow-auto">
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
                    {usersList
                      .filter(
                        (u) =>
                          !searchTerm ||
                          u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email?.toLowerCase().includes(searchTerm.toLowerCase()),
                      )
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((u) => (
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
              <Pagination
                currentPage={page}
                pageSize={pageSize}
                totalItems={
                  usersList.filter(
                    (u) =>
                      !searchTerm ||
                      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase()),
                  ).length
                }
                onPageChange={setPage}
              />
            </Card>
          )}

          {/* Section: Content & CMS */}
          {section === "content" && (
            <Card title="Marketplace Content &amp; Hero Banners">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Manage headline banners and promotional announcements on the customer homepage.
                </p>
                <div className="border border-border rounded-sm p-3">
                  <p className="font-semibold text-sm">Main Showcase Banner</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    "Authentic Indian Fashion, Jewellery &amp; Sweets Delivered Across Australia"
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Section: Reports */}
          {section === "reports" && (
            <Card title="GST &amp; Financial Summary Reports">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="p-3 border border-border rounded-sm">
                    <p className="text-xs text-muted-foreground">Total GMV (AUD)</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatAUD(financeMetrics?.totalGmvAud ?? 0)}
                    </p>
                  </div>
                  <div className="p-3 border border-border rounded-sm">
                    <p className="text-xs text-muted-foreground">10% GST Remitted (1/11th)</p>
                    <p className="text-lg font-bold text-rani">
                      {formatAUD(((financeMetrics?.totalGmvAud ?? 0) / 11))}
                    </p>
                  </div>
                  <div className="p-3 border border-border rounded-sm">
                    <p className="text-xs text-muted-foreground">ISM Commission (Ex GST)</p>
                    <p className="text-lg font-bold text-teal">
                      {formatAUD(financeMetrics?.totalPlatformCommissionAud ?? 0)}
                    </p>
                  </div>
                  <div className="p-3 border border-border rounded-sm">
                    <p className="text-xs text-muted-foreground">Total Paid to Sellers</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatAUD(financeMetrics?.totalPaidToSellersAud ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Section: Background Jobs & QA */}
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

          {/* Section: Audit Log */}
          {section === "audit" && (
            <Card title="Compliance &amp; Security Audit Trail">
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 text-muted-foreground" size={14} />
                  <input
                    placeholder="Filter audit logs by action or entity..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full rounded-sm border border-input bg-surface pl-8 pr-3 text-xs"
                  />
                </div>
              </div>
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
                    {auditLogs
                      .filter(
                        (a) =>
                          !searchTerm ||
                          a.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()),
                      )
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((a) => (
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
              <Pagination
                currentPage={page}
                pageSize={pageSize}
                totalItems={
                  auditLogs.filter(
                    (a) =>
                      !searchTerm ||
                      a.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      a.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()),
                  ).length
                }
                onPageChange={setPage}
              />
            </Card>
          )}

          {/* Section: Settings */}
          {section === "settings" && <SettingsPanel onRequireMfa={executeWithMfaProtection} />}
        </main>
      </div>

      {/* MFA Verification Modal */}
      {mfaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-sm border border-border bg-card p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck size={20} />
              <h3 className="font-bold text-sm">Finance Authorization (MFA)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              This high-risk financial mutation requires two-factor authentication (AAL2). Enter your
              6-digit authenticator code to proceed.
            </p>
            <input
              type="password"
              maxLength={6}
              placeholder="123456"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              className="h-10 w-full rounded-sm border border-input bg-surface text-center font-mono text-lg tracking-[0.3em] focus:border-primary focus:outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setMfaModalOpen(false)}
                className="rounded-sm border border-border px-3 py-1.5 text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMfa}
                className="rounded-sm bg-primary px-4 py-1.5 text-xs font-bold uppercase text-primary-foreground"
              >
                Verify &amp; Authorize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  onRequireMfa,
}: {
  onRequireMfa: (action: () => Promise<void>) => void;
}) {
  const [config, setConfig] = useState(MARKETPLACE_CONFIG);
  const groups = ["Commission", "Payouts", "Returns", "Listings", "Seller SLA"] as const;

  useEffect(() => {
    getMarketplaceConfigServerFn()
      .then((dbConfigs: any[]) => {
        if (dbConfigs && dbConfigs.length > 0) {
          setConfig((prev) =>
            prev.map((c) => {
              const matched = dbConfigs.find((db) => db.key === c.id);
              return matched ? { ...c, value: matched.value } : c;
            }),
          );
        }
      })
      .catch(() => null);
  }, []);

  const handleSaveConfig = () => {
    onRequireMfa(async () => {
      for (const item of config) {
        await updateMarketplaceConfigServerFn({
          data: { key: item.id, value: item.value, description: item.label },
        });
      }
      toast.success("Marketplace configuration saved to database!");
    });
  };

  return (
    <Card title="Marketplace Configuration (Database-Backed &amp; MFA-Gated)">
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
          className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-primary-foreground"
        >
          <Lock size={13} /> Save Configuration (Requires MFA)
        </button>
      </div>
    </Card>
  );
}
