import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
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
  Plus,
  Trash2,
} from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { LogoMark } from "@/components/ism/Logo";
import { ProductGrid } from "@/components/ism/Rail";
import { PRODUCTS, formatAUD } from "@/lib/ism-data";
import { useIsm } from "@/lib/ism-store";
import { useAuth } from "@/hooks/use-auth";
import {
  getCustomerOrdersServerFn,
  getCustomerAddressesServerFn,
  saveCustomerAddressServerFn,
  deleteCustomerAddressServerFn,
  getCustomerReturnsServerFn,
  updateCustomerProfileServerFn,
  type CustomerAddressDto,
  type CustomerOrderSummaryDto,
} from "@/lib/api/account";

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

function AccountPage() {
  const { tab = "overview" } = Route.useSearch();
  const { wishlist } = useIsm();
  const { user, loading, signOut } = useAuth();
  const wishProducts = PRODUCTS.filter((p) => wishlist.includes(p.id));
  const navigate = Route.useNavigate();

  const [orders, setOrders] = useState<CustomerOrderSummaryDto[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddressDto[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setIsLoadingData(true);
      Promise.all([
        getCustomerOrdersServerFn({ data: { userId: user.id } }).catch(() => []),
        getCustomerAddressesServerFn({ data: { userId: user.id } }).catch(() => []),
        getCustomerReturnsServerFn({ data: { userId: user.id } }).catch(() => []),
      ])
        .then(([ord, addr, ret]) => {
          if (ord) setOrders(ord);
          if (addr) setAddresses(addr);
          if (ret) setReturnsList(ret);
        })
        .finally(() => setIsLoadingData(false));
    }
  }, [user?.id]);

  if (!loading && !user) {
    return (
      <ShopLayout>
        <div className="ism-container py-16 text-center">
          <div className="mx-auto max-w-md rounded-md border border-border bg-card p-8 shadow-sm">
            <User className="mx-auto size-12 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">Sign In Required</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Please sign in to view your orders, live package tracking, returns, and saved wishlist items.
            </p>
            <Link
              to="/signin"
              className="mt-6 inline-block w-full rounded-sm bg-rani py-3 text-sm font-bold uppercase tracking-wide text-rani-foreground hover:opacity-90"
            >
              Sign In to Your Account
            </Link>
          </div>
        </div>
      </ShopLayout>
    );
  }

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
                Hello {user?.fullName ?? "Customer"} — {user?.email ?? ""} · ISM Customer
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
          {/* Mobile dropdown */}
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

          {/* Desktop nav */}
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
            {tab === "overview" && (
              <Overview
                orders={orders}
                wishCount={wishlist.length}
                returnsCount={returnsList.length}
              />
            )}
            {tab === "orders" && <Orders orders={orders} />}
            {tab === "track" && <Track orders={orders} />}
            {tab === "returns" && <Returns returnsList={returnsList} />}
            {tab === "wishlist" && (
              <Panel title={`Wishlist (${wishProducts.length})`}>
                {wishProducts.length ? (
                  <ProductGrid products={wishProducts} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing saved yet — tap the heart on any product to save for later.
                  </p>
                )}
              </Panel>
            )}
            {tab === "addresses" && (
              <Addresses
                userId={user?.id || ""}
                addresses={addresses}
                onRefresh={() => {
                  if (user?.id) {
                    getCustomerAddressesServerFn({ data: { userId: user.id } }).then(setAddresses);
                  }
                }}
              />
            )}
            {tab === "reviews" && <Reviews orders={orders} />}
            {tab === "profile" && <Profile />}
          </section>
        </div>
      </div>
    </ShopLayout>
  );
}

function Overview({ orders, wishCount, returnsCount }: { orders: CustomerOrderSummaryDto[]; wishCount: number; returnsCount: number }) {
  const activePackages = orders.reduce((sum, o) => sum + o.packages.filter((p) => p.status !== "DELIVERED" && p.status !== "CANCELLED").length, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Orders" value={String(orders.length)} note="all time" />
        <Stat label="Packages in Transit" value={String(activePackages)} note="active shipping" />
        <Stat label="Wishlist Items" value={String(wishCount)} note="saved items" />
        <Stat label="Returns & Exchanges" value={String(returnsCount)} note="in progress" />
      </div>

      {orders.length > 0 ? (
        <Panel title={`Latest Order — #${orders[0]!.orderNumber}`}>
          <div className="space-y-3">
            {orders[0]!.packages.map((pkg, idx) => (
              <PackageItemCard key={pkg.subOrderId} pkg={pkg} index={idx + 1} total={orders[0]!.packages.length} />
            ))}
          </div>
        </Panel>
      ) : (
        <Panel title="Recent Orders">
          <p className="text-sm text-muted-foreground">No orders placed yet. Explore our curated Indian catalogue!</p>
        </Panel>
      )}
    </div>
  );
}

function Orders({ orders }: { orders: CustomerOrderSummaryDto[] }) {
  if (orders.length === 0) {
    return (
      <Panel title="My Orders">
        <p className="text-sm text-muted-foreground">You have not placed any orders yet.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <Panel
          key={o.id}
          title={`Order #${o.orderNumber} · Total ${formatAUD(o.totalAmountAud)}`}
          action={
            <Link to="/orders/$id" params={{ id: o.id }} className="text-[11px] font-bold uppercase tracking-wide text-rani">
              View Order Details
            </Link>
          }
        >
          <div className="space-y-3">
            {o.packages.map((p, idx) => (
              <PackageItemCard key={p.subOrderId} pkg={p} index={idx + 1} total={o.packages.length} />
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

function Track({ orders }: { orders: CustomerOrderSummaryDto[] }) {
  const allPackages = orders.flatMap((o) => o.packages.map((p) => ({ ...p, orderId: o.id, orderNumber: o.orderNumber })));

  return (
    <Panel title="Multi-Seller Package Tracking">
      <p className="mb-4 text-xs text-muted-foreground">
        Orders with items from different sellers ship independently with live Australia Post / Sendle tracking.
      </p>
      {allPackages.length > 0 ? (
        <div className="space-y-4">
          {allPackages.map((p, idx) => (
            <PackageItemCard key={p.subOrderId} pkg={p} index={idx + 1} total={allPackages.length} showTimeline />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No active shipments to track.</p>
      )}
    </Panel>
  );
}

function PackageItemCard({
  pkg,
  index,
  total,
  showTimeline = false,
}: {
  pkg: CustomerOrderSummaryDto["packages"][number];
  index: number;
  total: number;
  showTimeline?: boolean;
}) {
  const isDelivered = pkg.status === "DELIVERED";
  const isShipped = pkg.status === "SHIPPED" || isDelivered;

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Package {index} of {total} ·{" "}
          <Link to="/seller/$slug" params={{ slug: pkg.sellerSlug }} className="text-primary hover:text-rani">
            {pkg.sellerName}
          </Link>
        </p>
        <span className="rounded-sm bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase text-primary">
          {pkg.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {pkg.items.map((item) => (
          <div key={item.id} className="flex gap-3 text-sm">
            {item.imageUrl && (
              <img src={item.imageUrl} alt={item.title} className="size-14 shrink-0 rounded-sm object-cover border border-border" />
            )}
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                Qty: {item.quantity} · {formatAUD(item.unitPriceAud)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {pkg.trackingNumber && (
        <p className="mt-2 text-xs text-muted-foreground">
          Carrier: {pkg.carrier || "Australia Post"} · Tracking: <span className="font-mono">{pkg.trackingNumber}</span>
        </p>
      )}

      {showTimeline && (
        <div className="mt-4 border-t border-border pt-4">
          <ol className="space-y-2">
            {TIMELINE_STEPS.map((step, i) => {
              const done = isDelivered || (isShipped && i <= 2) || i === 0;
              return (
                <li key={step} className="flex items-center gap-2 text-xs">
                  {done ? <CheckCircle2 size={14} className="text-teal" /> : <Circle size={14} className="text-border" />}
                  <span className={done ? "font-semibold text-foreground" : "text-muted-foreground"}>{step}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isDelivered && (
          <Link
            to="/returns/new"
            className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani"
          >
            Return or Exchange (7-day ACL)
          </Link>
        )}
      </div>
    </div>
  );
}

function Returns({ returnsList }: { returnsList: any[] }) {
  return (
    <Panel
      title="Returns & Exchanges"
      action={
        <Link to="/returns/new" className="text-[11px] font-bold uppercase tracking-wide text-rani">
          Start a Return
        </Link>
      }
    >
      <div className="space-y-3 text-sm">
        {returnsList.length > 0 ? (
          returnsList.map((ret) => (
            <div key={ret.id} className="rounded-md border border-border p-4">
              <div className="flex justify-between items-center">
                <p className="font-semibold">Return #{ret.id.slice(0, 8)}</p>
                <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase">{ret.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Reason: {ret.reason}</p>
              <p className="text-xs text-muted-foreground">Refund Amount: {formatAUD(Number(ret.refund_amount))}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No active return requests.</p>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          Change of mind returns are accepted within 7 days of confirmed delivery. Statutory ACL warranty claims for damaged or faulty goods are supported outside this window.
        </p>
      </div>
    </Panel>
  );
}

function Addresses({
  userId,
  addresses,
  onRefresh,
}: {
  userId: string;
  addresses: CustomerAddressDto[];
  onRefresh: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [tag, setTag] = useState("Home");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("NSW");
  const [postcode, setPostcode] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCustomerAddressServerFn({
        data: {
          userId,
          tag,
          recipientName,
          phone,
          address: { line1, suburb, state, postcode, country: "Australia" },
          isDefault: addresses.length === 0,
        },
      });
      toast.success("Address saved!");
      setIsAdding(false);
      onRefresh();
    } catch (err: any) {
      toast.error("Failed to save address", { description: err.message });
    }
  };

  const handleDelete = async (addressId: string) => {
    try {
      await deleteCustomerAddressServerFn({ data: { userId, addressId } });
      toast.success("Address removed");
      onRefresh();
    } catch (err: any) {
      toast.error("Failed to remove address", { description: err.message });
    }
  };

  return (
    <Panel
      title="Saved Addresses"
      action={
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-rani"
        >
          <Plus size={14} /> Add Address
        </button>
      }
    >
      <div className="space-y-4">
        {isAdding && (
          <form onSubmit={handleSave} className="rounded-md border border-border p-4 space-y-3 bg-muted/20">
            <h3 className="text-xs font-bold uppercase">Add New Australian Delivery Address</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Full Name" required className="h-9 px-3 border rounded-sm text-sm" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone Number" required className="h-9 px-3 border rounded-sm text-sm" />
              <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Street Address" required className="h-9 px-3 border rounded-sm text-sm sm:col-span-2" />
              <input value={suburb} onChange={(e) => setSuburb(e.target.value)} placeholder="Suburb" required className="h-9 px-3 border rounded-sm text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={state} onChange={(e) => setState(e.target.value)} className="h-9 px-2 border rounded-sm text-sm">
                  <option value="NSW">NSW</option><option value="VIC">VIC</option><option value="QLD">QLD</option><option value="WA">WA</option><option value="SA">SA</option><option value="TAS">TAS</option><option value="ACT">ACT</option><option value="NT">NT</option>
                </select>
                <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" required className="h-9 px-3 border rounded-sm text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-1.5 text-xs font-bold uppercase rounded-sm">Save</button>
              <button type="button" onClick={() => setIsAdding(false)} className="border px-4 py-1.5 text-xs font-bold uppercase rounded-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-md border border-border p-4 text-sm flex justify-between items-start">
              <div>
                <p className="font-semibold">{a.tag} {a.isDefault && "(Default)"}</p>
                <p className="mt-1 text-muted-foreground">{a.recipientName} · {a.address.line1}, {a.address.suburb} {a.address.state} {a.address.postcode}</p>
                <p className="text-xs text-muted-foreground">{a.phone}</p>
              </div>
              <button onClick={() => handleDelete(a.id)} className="text-muted-foreground hover:text-rani p-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function Reviews({ orders }: { orders: CustomerOrderSummaryDto[] }) {
  return (
    <Panel title="Product Reviews">
      <div className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          You can write verified reviews for products you have purchased and received.
        </p>
        {orders.length > 0 ? (
          orders.flatMap((o) => o.packages.flatMap((p) => p.items)).slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-md border border-border p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">Verified Purchase · Delivered</p>
              </div>
              <Link to="/product/$id" params={{ id: item.id }} className="text-xs font-bold uppercase text-rani hover:underline">
                Write Review
              </Link>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No purchase reviews yet.</p>
        )}
      </div>
    </Panel>
  );
}

function Profile() {
  const { user, signOut } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "Customer");
  const [phone, setPhone] = useState(user?.phone ?? "0412 345 678");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!user?.id) {
      toast.error("User session not found.");
      return;
    }
    setIsSaving(true);
    try {
      await updateCustomerProfileServerFn({
        data: { userId: user.id, fullName, phone },
      });
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error("Profile update failed", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Panel title="Profile & Preferences">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Email</label>
          <input defaultValue={user?.email ?? "customer@example.com.au"} disabled className="mt-1 h-10 w-full rounded-sm border border-input bg-muted/40 px-3 text-sm text-muted-foreground" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mobile</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 h-10 w-full rounded-sm border border-input bg-surface px-3 text-sm" />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={handleSaveProfile} disabled={isSaving} className="rounded-sm bg-rani px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:opacity-90">
          {isSaving ? "Saving..." : "Save changes"}
        </button>
        <button onClick={() => signOut()} className="rounded-sm border border-border px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-rani hover:text-rani">
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
