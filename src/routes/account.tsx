import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  Heart,
  MapPin,
  Package,
  RotateCcw,
  Star,
  Truck,
  User,
  LayoutGrid,
} from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { LogoMark } from "@/components/ism/Logo";
import { ProductGrid } from "@/components/ism/Rail";
import { IMAGES, PRODUCTS, formatAUD, productById, sellerBySlug } from "@/lib/ism-data";
import { useIsm } from "@/lib/ism-store";
import { useAuth } from "@/hooks/use-auth";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "track", label: "Track Orders", icon: Truck },
  { id: "returns", label: "Returns & Refunds", icon: RotateCcw },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "profile", label: "Profile", icon: User },
] as const;

type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/account")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab | undefined } => ({
    tab: TABS.find((t) => t.id === s["tab"])?.id,
  }),
  head: () => ({
    meta: [
      { title: "My Account — Indian Shopping Mela" },
      {
        name: "description",
        content: "Track ISM orders package by package, manage returns, wishlist, addresses and reviews.",
      },
      { property: "og:title", content: "My Account — Indian Shopping Mela" },
      { property: "og:description", content: "Your orders, tracking, returns and saved items in one place." },
    ],
  }),
  component: AccountPage,
});

const TIMELINE_STEPS = ["Ordered", "Packed", "Shipped", "Out for delivery", "Delivered"] as const;

const PACKAGES = [
  {
    n: 1,
    seller: "mumbai-mirror-boutique",
    status: "Delivered",
    step: 5,
    detail: "Left in a safe place · Sat 5:12pm",
    items: ["ism-1001"],
    tone: "teal",
    courier: "Australia Post eParcel",
    tracking: "AU100450198721",
  },
  {
    n: 2,
    seller: "jaipur-jewel-house",
    status: "In Transit",
    step: 3,
    detail: "Departed Melbourne facility · ETA Wed",
    items: ["ism-2003"],
    tone: "marigold",
    courier: "Aramex",
    tracking: "AU200450298722",
  },
  {
    n: 3,
    seller: "desi-ghar-homewares",
    status: "Preparing",
    step: 1,
    detail: "Seller is packing your order",
    items: ["ism-6001"],
    tone: "muted",
    courier: "Sendle",
    tracking: "AU300450398723",
  },
] as const;

function AccountPage() {
  const { tab = "overview" } = Route.useSearch();
  const { wishlist } = useIsm();
  const { user, signOut } = useAuth();
  const wishProducts = PRODUCTS.filter((p) => wishlist.includes(p.id));
  const navigate = Route.useNavigate();

  return (
    <ShopLayout>
      <div className="ism-container py-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <LogoMark compact className="hidden sm:inline-flex" />
            <div>
              <h1 className="section-title text-foreground">My Account</h1>
              <span className="mt-2 block h-1 w-20 rounded-full mela-rule" aria-hidden />
              <p className="mt-2 text-sm text-muted-foreground">
                Hello {user?.fullName ?? "Priya Sharma"} — {user?.email ?? "priya@example.com.au"} · ISM Member
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/signin" });
            }}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-rani hover:text-rani"
          >
            Sign out
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Mobile: select dropdown */}
          <div className="lg:hidden">
            <select
              value={tab}
              onChange={(e) => navigate({ search: { tab: e.target.value as Tab } })}
              className="h-11 w-full rounded-sm border border-input bg-surface px-3 text-sm font-semibold"
            >
              {TABS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop: sidebar nav */}
          <aside className="hidden lg:flex lg:flex-col lg:gap-1 rounded-md border border-border bg-surface p-2">
            {TABS.map((t) => (
              <Link
                key={t.id}
                to="/account"
                search={{ tab: t.id }}
                className={`inline-flex shrink-0 items-center gap-2 rounded-sm px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <t.icon size={15} /> {t.label}
              </Link>
            ))}
          </aside>

          <section className="min-w-0">
            {tab === "overview" && <Overview wishCount={wishlist.length} />}
            {tab === "orders" && <Orders />}
            {tab === "track" && <Track />}
            {tab === "returns" && <Returns />}
            {tab === "wishlist" && (
              <Panel title={`Wishlist (${wishProducts.length})`}>
                {wishProducts.length ? (
                  <ProductGrid products={wishProducts} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing saved yet — tap the heart on any product.
                  </p>
                )}
              </Panel>
            )}
            {tab === "addresses" && <Addresses />}
            {tab === "reviews" && <Reviews />}
            {tab === "profile" && <Profile />}
          </section>
        </div>
      </div>
    </ShopLayout>
  );
}

function Overview({ wishCount }: { wishCount: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open orders" value="1" note="#ISM10001" />
        <Stat label="Packages in transit" value="2" note="of 3" />
        <Stat label="Wishlist items" value={String(wishCount)} note="saved" />
        <Stat label="ISM reward credit" value="$25" note="expires June" />
      </div>
      <Panel title="Latest order — #ISM10001">
        <div className="space-y-3">
          {PACKAGES.map((p) => (
            <PackageCard key={p.n} pkg={p} compact />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Orders() {
  return (
    <div className="space-y-4">
      <Panel
        title="Order #ISM10001 · Placed 12 Aug 2026 · Total $412"
        action={
          <Link to="/orders/$id" params={{ id: "ISM10001" }} className="text-[11px] font-bold uppercase tracking-wide text-rani">
            View order details
          </Link>
        }
      >
        <div className="space-y-3">
          {PACKAGES.map((p) => (
            <PackageCard key={p.n} pkg={p} compact />
          ))}
        </div>
      </Panel>
      <Panel title="Order #ISM09884 · Placed 2 Jul 2026 · Total $148">
        <p className="text-sm text-muted-foreground">
          1 package · Delivered 5 Jul 2026 by Shubh Pooja Store (Perth, WA).
        </p>
      </Panel>
    </div>
  );
}

function Track() {
  return (
    <Panel title="Order #ISM10001 · Multi-seller tracking">
      <p className="mb-4 text-xs text-muted-foreground">
        This order was split across 3 sellers. Each package ships and is tracked independently.
      </p>
      <div className="space-y-4">
        {PACKAGES.map((p) => (
          <PackageCard key={p.n} pkg={p} />
        ))}
      </div>
    </Panel>
  );
}

function toneClasses(tone: (typeof PACKAGES)[number]["tone"]) {
  return tone === "teal"
    ? "bg-teal/12 text-teal"
    : tone === "marigold"
      ? "bg-marigold/20 text-marigold-foreground"
      : "bg-muted text-muted-foreground";
}

function PackageCard({ pkg: p, compact = false }: { pkg: (typeof PACKAGES)[number]; compact?: boolean }) {
  const seller = sellerBySlug(p.seller)!;
  const product = productById(p.items[0])!;

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Package {p.n} of 3 ·{" "}
          <Link to="/seller/$slug" params={{ slug: seller.slug }} className="text-primary hover:text-rani">
            {seller.name}
          </Link>
        </p>
        <span className={`rounded-sm px-2.5 py-1 text-[11px] font-bold uppercase ${toneClasses(p.tone)}`}>
          {p.status}
        </span>
      </div>

      <div className="mt-3 flex gap-3">
        <img
          src={IMAGES[product.image]}
          alt={product.name}
          loading="lazy"
          width={900}
          height={900}
          className="size-16 shrink-0 rounded-sm object-cover"
        />
        <div className="min-w-0 text-sm">
          <Link to="/product/$id" params={{ id: product.id }} className="font-medium hover:text-rani">
            {product.name}
          </Link>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatAUD(product.price)} · {p.courier} · Tracking {p.tracking}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{p.detail}</p>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 border-t border-border pt-4">
          <ol className="space-y-3">
            {TIMELINE_STEPS.map((step, i) => {
              const stepNo = i + 1;
              const done = stepNo <= p.step;
              const isLast = i === TIMELINE_STEPS.length - 1;
              return (
                <li key={step} className="relative flex gap-3 pl-0.5">
                  <div className="flex flex-col items-center">
                    {done ? (
                      <CheckCircle2 size={16} className="text-teal" />
                    ) : (
                      <Circle size={16} className="text-border" />
                    )}
                    {!isLast && (
                      <span
                        className={`mt-0.5 h-6 w-px ${done && stepNo < p.step ? "bg-teal" : "bg-border"}`}
                        aria-hidden
                      />
                    )}
                  </div>
                  <span className={`text-xs font-semibold ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/orders/$id"
          params={{ id: "ISM10001" }}
          className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani"
        >
          Track package
        </Link>
        <SmallBtn>View tax invoice</SmallBtn>
        {p.status === "Delivered" && (
          <Link
            to="/returns/new"
            className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani"
          >
            Return or exchange
          </Link>
        )}
      </div>
    </div>
  );
}

function Returns() {
  return (
    <Panel
      title="Returns & Refunds"
      action={
        <Link to="/returns/new" className="text-[11px] font-bold uppercase tracking-wide text-rani">
          Start a return
        </Link>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-md border border-border p-4">
          <p className="font-semibold">RET-4412 · Banarasi Silk Saree</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Size exchange approved · Return label emailed · Refund of $0 (exchange)
          </p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="font-semibold">RET-4390 · Oxidised Jhumkas</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Refunded $39 to card ending 4242 on 18 Jul 2026
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Returns are handled per package — each seller receives their own return separately. Change of
          mind returns are accepted within 7 days of delivery; faulty, damaged or not-as-described items
          are covered by Australian Consumer Law rights that are not limited by that window.
        </p>
      </div>
    </Panel>
  );
}

function Addresses() {
  return (
    <Panel title="Saved Addresses">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { tag: "Home (default)", body: "24 Wigram Street, Harris Park NSW 2150" },
          { tag: "Work", body: "Level 8, 100 George Street, Parramatta NSW 2150" },
        ].map((a) => (
          <div key={a.tag} className="rounded-md border border-border p-4 text-sm">
            <p className="font-semibold">{a.tag}</p>
            <p className="mt-1 text-muted-foreground">Priya Sharma · {a.body} · 0412 345 678</p>
            <div className="mt-3 flex gap-2">
              <SmallBtn>Edit</SmallBtn>
              <SmallBtn>Remove</SmallBtn>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Reviews() {
  return (
    <Panel title="My Reviews">
      <div className="space-y-3 text-sm">
        <div className="rounded-md border border-border p-4">
          <p className="font-semibold">Jaipuri Cotton Double Bedsheet Set</p>
          <p className="mt-1 text-xs text-muted-foreground">★★★★★ · "Soft, true colours, washes well."</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="font-semibold">Hand-Embroidered Punjabi Juttis</p>
          <p className="mt-1 text-xs text-muted-foreground">★★★★☆ · "Gorgeous work, size up half."</p>
        </div>
      </div>
    </Panel>
  );
}

function Profile() {
  const { user, signOut } = useAuth();
  return (
    <Panel title="Profile">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Full name", user?.fullName ?? "Priya Sharma"],
          ["Email", user?.email ?? "priya@example.com.au"],
          ["Mobile", user?.phone ?? "0412 345 678"],
          ["Preferred language", "English / Hindi"],
        ].map(([l, v]) => (
          <div key={l}>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {l}
            </label>
            <input
              defaultValue={v}
              className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <button className="rounded-sm bg-rani px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground">
          Save changes
        </button>
        <button
          onClick={() => signOut()}
          className="rounded-sm border border-border px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-rani hover:text-rani"
        >
          Sign out
        </button>
      </div>
    </Panel>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-primary">{value}</p>
      <p className="text-[11px] text-muted-foreground">{note}</p>
    </div>
  );
}

function SmallBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:border-rani hover:text-rani">
      {children}
    </button>
  );
}
