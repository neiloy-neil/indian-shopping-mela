import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronDown,
  Heart,
  MapPin,
  Menu,
  Search,
  ShoppingBag,
  Store,
  Tag,
  User,
  X,
} from "lucide-react";
import { CATEGORIES } from "@/lib/ism-data";
import { useIsm } from "@/lib/ism-store";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "./Logo";

export function Header() {
  const navigate = useNavigate();
  const { cartCount, wishlist } = useIsm();
  const { user, isAuthenticated } = useAuth();
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [menuOpen, setMenuOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q && scope !== "all") {
      navigate({ to: "/category/$slug", params: { slug: scope } });
    } else {
      navigate({ to: "/search", search: q ? { q } : {} });
    }
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Slim magenta announcement strip */}
      <div className="bg-rani text-rani-foreground">
        <div className="ism-container flex h-7 items-center justify-between gap-4 text-[10px] font-medium tracking-wide sm:h-8 sm:text-[11px]">
          <p className="truncate">
            Australia-wide delivery · Free shipping over $99 · Verified Indian sellers
          </p>
          <div className="hidden shrink-0 items-center gap-5 sm:flex">
            <Link to="/sell" className="hover:underline">
              Seller Centre
            </Link>
            <Link to="/admin" className="hover:underline">
              Admin Demo
            </Link>
            <span className="opacity-85">AUD $</span>
          </div>
        </div>
      </div>

      {/* Main white header */}
      <div className="border-b border-border bg-surface">
        <div className="ism-container grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:h-16 sm:gap-3 md:flex md:h-24 md:gap-6">
          <button
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-sm border border-border text-foreground lg:hidden"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} />
          </button>

          <Logo className="min-w-0" />

          {/* Central search */}
          <form onSubmit={submit} className="hidden flex-1 md:block">
            <div className="mx-auto flex h-11 max-w-3xl items-center rounded-full border border-primary/25 bg-background pl-1 pr-1 transition-colors focus-within:border-rani">
              <div className="relative flex h-9 shrink-0 items-center rounded-full bg-secondary pl-3 pr-6 text-xs font-semibold text-secondary-foreground">
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  aria-label="Search category"
                  className="absolute inset-0 cursor-pointer opacity-0"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="max-w-28 truncate">
                  {scope === "all"
                    ? "All Categories"
                    : CATEGORIES.find((c) => c.slug === scope)?.name}
                </span>
                <ChevronDown size={13} className="absolute right-1.5" />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search sarees, jhumkas, diyas, juttis, bedsheets…"
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
                aria-label="Search products"
              />
              <button
                type="submit"
                aria-label="Search"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-rani hover:text-rani-foreground"
              >
                <Search size={17} />
              </button>
            </div>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-0 md:gap-3">
            <button
              type="button"
              className="hidden flex-col items-start px-1 text-left text-xs leading-tight text-foreground hover:text-rani xl:flex"
            >
              <span className="text-[10px] text-muted-foreground">Deliver to</span>
              <span className="inline-flex items-center gap-1 font-semibold">
                <MapPin size={12} className="text-rani" /> 3000 Melbourne
              </span>
            </button>

            <Link
              to="/account"
              search={{ tab: "wishlist" }}
              className="relative grid size-9 place-items-center text-foreground hover:text-rani"
              aria-label="Wishlist"
            >
              <Heart size={19} />
              {wishlist.length > 0 && <Count n={wishlist.length} />}
            </Link>

            <Link
              to={isAuthenticated ? "/account" : "/signin"}
              className="hidden flex-col items-start px-1 text-xs leading-tight text-foreground hover:text-rani md:flex"
            >
              <span className="text-[10px] text-muted-foreground">
                {isAuthenticated
                  ? `Hello, ${user?.fullName ? user.fullName.split(" ")[0] : "Account"}`
                  : "Sign In"}
              </span>
              <span className="font-semibold">Account</span>
            </Link>

            <Link
              to="/cart"
              className="relative grid size-9 place-items-center text-foreground hover:text-rani"
              aria-label="Cart"
            >
              <ShoppingBag size={19} />
              {cartCount > 0 && <Count n={cartCount} />}
            </Link>

            <Link
              to="/sell"
              className="hidden items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:bg-primary hover:text-primary-foreground lg:inline-flex"
            >
              <Store size={14} /> Sell on ISM
            </Link>

            <Link
              to="/signin"
              className="grid size-9 place-items-center text-foreground hover:text-rani md:hidden"
              aria-label="Sign in"
            >
              <User size={19} />
            </Link>
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={submit} className="ism-container pb-3 md:hidden">
          <div className="flex h-10 items-center rounded-full border border-input bg-background pr-1 shadow-sm">
            <Search size={16} className="mx-3 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the mela…"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              aria-label="Search products"
            />
            <button
              type="submit"
              aria-label="Search"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <Search size={15} />
            </button>
          </div>
        </form>
      </div>

      {/* Category nav row */}
      <nav className="border-b border-border bg-surface">
        <div className="ism-container flex items-center gap-0.5 overflow-x-auto py-1 [scrollbar-width:none] sm:gap-1 sm:py-1.5">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              activeProps={{ className: "text-rani" }}
              className="shrink-0 whitespace-nowrap rounded-sm px-2.5 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-secondary hover:text-rani sm:text-[13px]"
            >
              {c.name}
            </Link>
          ))}
          <Link
            to="/search"
            search={{}}
            className="shrink-0 whitespace-nowrap rounded-sm px-2.5 py-1.5 text-[13px] font-semibold text-primary hover:text-rani"
          >
            More
          </Link>
          <Link
            to="/search"
            search={{ q: "sale" }}
            className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full bg-marigold/15 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-marigold lg:inline-flex"
          >
            <Tag size={13} /> Deals of the Day
          </Link>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-ink/50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="h-full w-[82%] max-w-xs overflow-y-auto bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <Logo compact />
              <button aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Shop by Category
            </p>
            <div className="mt-2 space-y-1">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-sm px-2 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  {c.name}
                </Link>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              <Link
                to="/sell"
                onClick={() => setMenuOpen(false)}
                className="block px-2 py-2 font-semibold text-primary"
              >
                Sell on ISM
              </Link>
              <Link to="/account" onClick={() => setMenuOpen(false)} className="block px-2 py-2">
                My Account
              </Link>
              <Link to="/admin" onClick={() => setMenuOpen(false)} className="block px-2 py-2">
                Admin Demo
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="absolute right-0 top-0.5 grid min-w-4 place-items-center rounded-full bg-rani px-1 text-[10px] font-bold leading-4 text-rani-foreground">
      {n}
    </span>
  );
}
