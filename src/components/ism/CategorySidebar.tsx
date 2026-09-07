import { Link } from "@tanstack/react-router";
import { ChevronRight, Store } from "lucide-react";
import { CATEGORIES } from "@/lib/ism-data";

/** Desktop-only left rail: dense category list + compact seller CTA. */
export function CategorySidebar() {
  return (
    <aside className="hidden w-[215px] shrink-0 self-start rounded-md border border-border bg-surface lg:block">
      <p className="rounded-t-md bg-gradient-to-r from-primary to-[color-mix(in_oklab,var(--primary)_65%,var(--rani))] px-3.5 py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-primary-foreground">
        Shop by Category
      </p>
      <nav className="py-1">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            to="/category/$slug"
            params={{ slug: c.slug }}
            activeProps={{ className: "bg-secondary text-rani" }}
            className="group flex items-center justify-between gap-2 px-3.5 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:bg-secondary hover:text-rani"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-marigold/70 group-hover:bg-rani" />
              <span className="truncate">{c.name}</span>
            </span>
            <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </nav>
      <div className="m-2.5 rounded-sm border border-gold/50 bg-cream p-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-primary">Sell on ISM</p>
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Reach Indian shoppers Australia-wide. No listing fees in year one.
        </p>
        <Link
          to="/sell"
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-sm bg-rani px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rani-foreground hover:bg-primary hover:text-primary-foreground"
        >
          <Store size={12} /> Start selling
        </Link>
      </div>
    </aside>
  );
}
