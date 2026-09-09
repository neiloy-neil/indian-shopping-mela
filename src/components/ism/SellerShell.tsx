import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Menu,
  PackagePlus,
  RotateCcw,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  Upload,
  Users,
  Boxes as BoxesIcon,
  Megaphone,
  UserPlus,
  X,
} from "lucide-react";
import { Logo } from "./Logo";

export const SELLER_SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Boxes },
  { id: "inventory", label: "Inventory", icon: ClipboardList },
  { id: "orders", label: "Orders", icon: ShoppingCart },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "returns", label: "Returns", icon: RotateCcw },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "promotions", label: "Promotions", icon: Megaphone },
  { id: "store", label: "Store", icon: Store },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export type SellerSection = (typeof SELLER_SECTIONS)[number]["id"];

function SidebarBrand() {
  return (
    <div className="rounded-sm bg-sidebar-accent p-3">
      <Logo compact onDark />
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
        Seller Centre
      </p>
      <p className="mt-1 text-sm font-semibold text-sidebar-foreground">Mumbai Mirror Boutique</p>
      <p className="text-[11px] text-sidebar-foreground/70">Harris Park, NSW · Verified</p>
    </div>
  );
}

function SidebarNav({
  active,
  onSelect,
  onNavigate,
}: {
  active: SellerSection | "add" | "bulk" | "team" | "onboarding" | "stock";
  onSelect?: ((id: SellerSection) => void) | undefined;
  onNavigate?: () => void;
}) {
  const itemCls = (isActive: boolean) =>
    `flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-[13px] font-semibold transition-colors ${
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`;

  return (
    <nav className="mt-4 space-y-1">
      <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
        Manage
      </p>
      {SELLER_SECTIONS.map((s) =>
        onSelect ? (
          <button
            key={s.id}
            onClick={() => {
              onSelect(s.id);
              onNavigate?.();
            }}
            className={itemCls(active === s.id)}
          >
            <s.icon size={15} /> {s.label}
          </button>
        ) : (
          <Link key={s.id} to="/sell" onClick={onNavigate} className={itemCls(false)}>
            <s.icon size={15} /> {s.label}
          </Link>
        ),
      )}
      <div className="!mt-4 space-y-1 border-t border-sidebar-border pt-4">
        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
          Catalogue tools
        </p>
        <Link to="/sell/add-product" onClick={onNavigate} className={itemCls(active === "add")}>
          <PackagePlus size={15} /> Add Product
        </Link>
        <Link to="/sell/bulk-upload" onClick={onNavigate} className={itemCls(active === "bulk")}>
          <Upload size={15} /> Bulk Upload
        </Link>
        <Link to="/sell/bulk-stock" onClick={onNavigate} className={itemCls(active === "stock")}>
          <BoxesIcon size={15} /> Bulk Stock Update
        </Link>
      </div>
      <div className="!mt-4 space-y-1 border-t border-sidebar-border pt-4">
        <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
          Account
        </p>
        <Link to="/sell/team" onClick={onNavigate} className={itemCls(active === "team")}>
          <Users size={15} /> Team & Permissions
        </Link>
        <Link
          to="/sell/onboarding"
          onClick={onNavigate}
          className={itemCls(active === "onboarding")}
        >
          <UserPlus size={15} /> Become a Seller
        </Link>
      </div>
    </nav>
  );
}

export function SellerShell({
  active,
  onSelect,
  title,
  subtitle,
  actions,
  children,
}: {
  active: SellerSection | "add" | "bulk" | "team" | "onboarding" | "stock";
  onSelect?: ((id: SellerSection) => void) | undefined;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar p-4 lg:flex">
        <SidebarBrand />
        <SidebarNav active={active} onSelect={onSelect} />
        <Link
          to="/"
          className="mt-auto rounded-sm border border-sidebar-border px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-sidebar-foreground/80 hover:text-gold"
        >
          Back to marketplace
        </Link>
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink/60"
          />
          <div className="relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <SidebarBrand />
              </div>
              <button
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="shrink-0 rounded-sm p-2 text-sidebar-foreground/80 hover:text-gold"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SidebarNav
                active={active}
                onSelect={onSelect}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
            <Link
              to="/"
              onClick={() => setDrawerOpen(false)}
              className="mt-4 rounded-sm border border-sidebar-border px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-sidebar-foreground/80 hover:text-gold"
            >
              Back to marketplace
            </Link>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-surface">
          <div className="festive-bar h-1" aria-hidden />
          <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
                className="shrink-0 rounded-sm border border-border p-2 text-foreground lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold text-primary md:text-xl">
                  {title}
                </h1>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">{actions}</div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
            {SELLER_SECTIONS.map((s) =>
              onSelect ? (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`shrink-0 rounded-sm px-3 py-1.5 text-xs font-semibold ${
                    active === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ) : (
                <Link
                  key={s.id}
                  to="/sell"
                  className="shrink-0 rounded-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                >
                  {s.label}
                </Link>
              ),
            )}
            <Link
              to="/sell/bulk-upload"
              className={`shrink-0 rounded-sm px-3 py-1.5 text-xs font-semibold ${
                active === "bulk" ? "bg-primary text-primary-foreground" : "text-rani"
              }`}
            >
              Bulk Upload
            </Link>
            <Link
              to="/sell/add-product"
              className={`shrink-0 rounded-sm px-3 py-1.5 text-xs font-semibold ${
                active === "add" ? "bg-primary text-primary-foreground" : "text-rani"
              }`}
            >
              Add Product
            </Link>
          </nav>
        </header>
        <main className="px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-md border border-border bg-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  note,
  tone = "default",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "default" | "rani" | "teal" | "marigold";
}) {
  const toneCls =
    tone === "rani"
      ? "text-rani"
      : tone === "teal"
        ? "text-teal"
        : tone === "marigold"
          ? "text-marigold"
          : "text-primary";
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${toneCls}`}>{value}</p>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

export function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "new" | "prep" | "ready" | "ship" | "done";
}) {
  const map = {
    new: "bg-rani/12 text-rani",
    prep: "bg-marigold/20 text-marigold-foreground",
    ready: "bg-primary/10 text-primary",
    ship: "bg-teal/12 text-teal",
    done: "bg-muted text-muted-foreground",
  } as const;
  return (
    <span
      className={`inline-block rounded-sm px-2 py-1 text-[10px] font-bold uppercase ${map[tone]}`}
    >
      {label}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "rani" | "teal" | "marigold" | "primary";
}) {
  const map = {
    neutral: "bg-muted text-muted-foreground",
    rani: "bg-rani/12 text-rani",
    teal: "bg-teal/12 text-teal",
    marigold: "bg-marigold/20 text-marigold-foreground",
    primary: "bg-primary/10 text-primary",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${map[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "ghost",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "rani" | "ghost" | "outline";
  size?: "sm" | "md";
}) {
  const variantCls =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : variant === "rani"
        ? "bg-rani text-rani-foreground hover:bg-rani/90"
        : variant === "outline"
          ? "border border-border text-foreground hover:border-primary hover:text-primary"
          : "border border-border text-muted-foreground hover:border-rani hover:text-rani";
  const sizeCls = size === "sm" ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-xs";
  return (
    <button
      {...rest}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-sm font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variantCls} ${sizeCls} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  required,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; required?: boolean }) {
  return (
    <div className={className}>
      <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}{" "}
        {required ? (
          <span className="text-rani">*</span>
        ) : (
          <span className="normal-case text-muted-foreground/60">(optional)</span>
        )}
      </label>
      <input
        {...rest}
        className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm focus:border-primary focus:outline-none"
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
