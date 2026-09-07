import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  ALL_COLOURS,
  ALL_FABRICS,
  ALL_LOCATIONS,
  ALL_MATERIALS,
  ALL_SIZES,
  CATEGORIES,
  FESTIVALS,
  OCCASIONS,
  PRODUCTS,
  formatAUD,
  sellerBySlug,
  type Product,
} from "@/lib/ism-data";
import { ProductCard } from "./ProductCard";

type Filters = {
  price: number;
  categories: string[];
  subcategories: string[];
  sizes: string[];
  colours: string[];
  fabrics: string[];
  materials: string[];
  locations: string[];
  rating: number;
  readyToShip: boolean;
  festivals: string[];
  occasions: string[];
  minDiscount: number;
};

const EMPTY: Filters = {
  price: 1500,
  categories: [],
  subcategories: [],
  sizes: [],
  colours: [],
  fabrics: [],
  materials: [],
  locations: [],
  rating: 0,
  readyToShip: false,
  festivals: [],
  occasions: [],
  minDiscount: 0,
};

const SORTS = [
  { id: "relevance", label: "Relevance" },
  { id: "new", label: "Newest" },
  { id: "low", label: "Price: Low to High" },
  { id: "high", label: "Price: High to Low" },
  { id: "rating", label: "Customer Rating" },
  { id: "discount", label: "Biggest Discount" },
] as const;

type ActiveChip = { key: keyof Filters | "price" | "rating" | "minDiscount"; value: string; onRemove: () => void };

export function Catalogue({
  title,
  description,
  baseProducts,
  lockedCategory,
  query,
}: {
  title: string;
  description?: string | undefined;
  baseProducts?: Product[] | undefined;
  lockedCategory?: string | undefined;
  query?: string | undefined;
}) {
  const [f, setF] = useState<Filters>({
    ...EMPTY,
    categories: lockedCategory ? [lockedCategory] : [],
  });
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("relevance");
  const [mobileOpen, setMobileOpen] = useState(false);

  const source = baseProducts ?? PRODUCTS;

  const subcategoryOptions = useMemo(() => {
    const cats = lockedCategory ? [lockedCategory] : f.categories;
    const pool = cats.length ? CATEGORIES.filter((c) => cats.includes(c.slug)) : CATEGORIES;
    return Array.from(new Set(pool.flatMap((c) => c.subcategories)));
  }, [f.categories, lockedCategory]);

  const results = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    let out = source.filter((p) => {
      const seller = sellerBySlug(p.seller);
      const discount = p.compareAt ? ((p.compareAt - p.price) / p.compareAt) * 100 : 0;
      if (q) {
        const hay = [p.name, p.subcategory, p.category, p.region, p.festival, p.occasion, seller?.name]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (p.price > f.price) return false;
      if (f.categories.length && !f.categories.includes(p.category)) return false;
      if (f.subcategories.length && !f.subcategories.includes(p.subcategory)) return false;
      if (f.sizes.length && !(p.sizes ?? []).some((s) => f.sizes.includes(s))) return false;
      if (f.colours.length && !p.colours.some((c) => f.colours.includes(c))) return false;
      if (f.fabrics.length && !(p.fabric && f.fabrics.includes(p.fabric))) return false;
      if (f.materials.length && !(p.material && f.materials.includes(p.material))) return false;
      if (f.locations.length && !(seller && f.locations.includes(seller.state))) return false;
      if (f.rating && p.rating < f.rating) return false;
      if (f.readyToShip && !p.readyToShip) return false;
      if (f.festivals.length && !(p.festival && f.festivals.includes(p.festival))) return false;
      if (f.occasions.length && !(p.occasion && f.occasions.includes(p.occasion))) return false;
      if (f.minDiscount && discount < f.minDiscount) return false;
      return true;
    });

    out = [...out].sort((a, b) => {
      const da = a.compareAt ? (a.compareAt - a.price) / a.compareAt : 0;
      const db = b.compareAt ? (b.compareAt - b.price) / b.compareAt : 0;
      switch (sort) {
        case "low":
          return a.price - b.price;
        case "high":
          return b.price - a.price;
        case "rating":
          return b.rating - a.rating;
        case "discount":
          return db - da;
        case "new":
          return b.id.localeCompare(a.id);
        default:
          return b.reviews - a.reviews;
      }
    });
    return out;
  }, [source, f, sort, query]);

  const toggle = (key: keyof Filters, value: string) =>
    setF((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });

  const activeCount =
    f.categories.length * (lockedCategory ? 0 : 1) +
    f.subcategories.length +
    f.sizes.length +
    f.colours.length +
    f.fabrics.length +
    f.materials.length +
    f.locations.length +
    f.festivals.length +
    f.occasions.length +
    (f.rating ? 1 : 0) +
    (f.readyToShip ? 1 : 0) +
    (f.minDiscount ? 1 : 0) +
    (f.price < 1500 ? 1 : 0);

  const clearAll = () => setF({ ...EMPTY, categories: lockedCategory ? [lockedCategory] : [] });

  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = [];
    if (f.price < 1500)
      chips.push({ key: "price", value: `Up to ${formatAUD(f.price)}`, onRemove: () => setF({ ...f, price: 1500 }) });
    if (!lockedCategory)
      f.categories.forEach((c) =>
        chips.push({ key: "categories", value: CATEGORIES.find((x) => x.slug === c)?.name ?? c, onRemove: () => toggle("categories", c) }),
      );
    f.subcategories.forEach((c) => chips.push({ key: "subcategories", value: c, onRemove: () => toggle("subcategories", c) }));
    f.sizes.forEach((c) => chips.push({ key: "sizes", value: c, onRemove: () => toggle("sizes", c) }));
    f.colours.forEach((c) => chips.push({ key: "colours", value: c, onRemove: () => toggle("colours", c) }));
    f.fabrics.forEach((c) => chips.push({ key: "fabrics", value: c, onRemove: () => toggle("fabrics", c) }));
    f.materials.forEach((c) => chips.push({ key: "materials", value: c, onRemove: () => toggle("materials", c) }));
    f.locations.forEach((c) => chips.push({ key: "locations", value: c, onRemove: () => toggle("locations", c) }));
    f.festivals.forEach((c) => chips.push({ key: "festivals", value: c, onRemove: () => toggle("festivals", c) }));
    f.occasions.forEach((c) => chips.push({ key: "occasions", value: c, onRemove: () => toggle("occasions", c) }));
    if (f.rating) chips.push({ key: "rating", value: `${f.rating}★ & up`, onRemove: () => setF({ ...f, rating: 0 }) });
    if (f.readyToShip) chips.push({ key: "sizes", value: "Ready to Ship", onRemove: () => setF({ ...f, readyToShip: false }) });
    if (f.minDiscount) chips.push({ key: "minDiscount", value: `${f.minDiscount}% or more`, onRemove: () => setF({ ...f, minDiscount: 0 }) });
    return chips;
  }, [f, lockedCategory]);

  const panel = (
    <div className="space-y-1">
      <FilterGroup title="Price" defaultOpen>
        <input
          type="range"
          min={20}
          max={1500}
          step={10}
          value={f.price}
          onChange={(e) => setF({ ...f, price: Number(e.target.value) })}
          className="w-full accent-rani"
          aria-label="Maximum price"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Up to <span className="font-semibold text-foreground">{formatAUD(f.price)}</span>
        </p>
      </FilterGroup>

      {!lockedCategory && (
        <FilterGroup title="Category" defaultOpen>
          {CATEGORIES.map((c) => (
            <Check
              key={c.slug}
              label={c.name}
              checked={f.categories.includes(c.slug)}
              onChange={() => toggle("categories", c.slug)}
            />
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="Subcategory" scroll defaultOpen>
        {subcategoryOptions.map((s) => (
          <Check
            key={s}
            label={s}
            checked={f.subcategories.includes(s)}
            onChange={() => toggle("subcategories", s)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Size" chips>
        {ALL_SIZES.map((s) => (
          <Chip key={s} label={s} active={f.sizes.includes(s)} onClick={() => toggle("sizes", s)} />
        ))}
      </FilterGroup>

      <FilterGroup title="Colour" chips>
        {ALL_COLOURS.map((c) => (
          <Chip key={c} label={c} active={f.colours.includes(c)} onClick={() => toggle("colours", c)} />
        ))}
      </FilterGroup>

      <FilterGroup title="Fabric">
        {ALL_FABRICS.map((c) => (
          <Check key={c} label={c} checked={f.fabrics.includes(c)} onChange={() => toggle("fabrics", c)} />
        ))}
      </FilterGroup>

      <FilterGroup title="Material">
        {ALL_MATERIALS.map((c) => (
          <Check
            key={c}
            label={c}
            checked={f.materials.includes(c)}
            onChange={() => toggle("materials", c)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Seller Location" chips>
        {ALL_LOCATIONS.map((c) => (
          <Chip
            key={c}
            label={c}
            active={f.locations.includes(c)}
            onClick={() => toggle("locations", c)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Customer Rating" chips>
        {[4.5, 4, 3.5].map((r) => (
          <Chip
            key={r}
            label={`${r}★ & up`}
            active={f.rating === r}
            onClick={() => setF({ ...f, rating: f.rating === r ? 0 : r })}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Availability">
        <Check
          label="Ready to Ship"
          checked={f.readyToShip}
          onChange={() => setF({ ...f, readyToShip: !f.readyToShip })}
        />
      </FilterGroup>

      <FilterGroup title="Festival" chips>
        {FESTIVALS.map((c) => (
          <Chip
            key={c}
            label={c}
            active={f.festivals.includes(c)}
            onClick={() => toggle("festivals", c)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Occasion" chips>
        {OCCASIONS.map((c) => (
          <Chip
            key={c}
            label={c}
            active={f.occasions.includes(c)}
            onClick={() => toggle("occasions", c)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Discount" chips>
        {[10, 20, 30].map((d) => (
          <Chip
            key={d}
            label={`${d}% or more`}
            active={f.minDiscount === d}
            onClick={() => setF({ ...f, minDiscount: f.minDiscount === d ? 0 : d })}
          />
        ))}
      </FilterGroup>

      <button
        type="button"
        onClick={clearAll}
        className="mt-4 w-full rounded-sm border border-border py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:border-rani hover:text-rani"
      >
        Clear all filters
      </button>
    </div>
  );

  return (
    <div className="ism-container py-8">
      <div className="mb-5">
        <h1 className="section-title text-foreground">{title}</h1>
        <span className="mt-2 block h-1 w-20 rounded-full mela-rule" aria-hidden />
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>

      {/* Toolbar */}
      <div className="mb-4 rounded-md border border-border bg-card px-3 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{results.length}</span> product
            {results.length === 1 ? "" : "s"}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs font-semibold lg:hidden"
            >
              <SlidersHorizontal size={14} /> Filters{activeCount ? ` (${activeCount})` : ""}
            </button>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-sm border border-border bg-surface px-2 py-1.5 text-xs font-semibold text-foreground"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            {activeChips.map((c, i) => (
              <button
                key={`${c.key}-${c.value}-${i}`}
                type="button"
                onClick={c.onRemove}
                className="inline-flex items-center gap-1 rounded-full border border-rani/40 bg-rani/10 px-2.5 py-1 text-[11px] font-semibold text-rani hover:bg-rani/20"
              >
                {c.value}
                <X size={11} />
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-rani"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-md border border-border bg-card p-4">
            {panel}
          </div>
        </aside>
        <div className="min-w-0 flex-1 pb-20 lg:pb-0">
          {results.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-cream/40 p-12 text-center">
              <p className="mandala mx-auto mb-3 size-12 rounded-full bg-surface" aria-hidden />
              <p className="font-semibold text-foreground">No products match those filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try widening your price range or clearing a few filters.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="mt-4 rounded-sm bg-rani px-4 py-2 text-xs font-bold uppercase tracking-wide text-rani-foreground"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile fixed filters trigger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-lg lg:hidden"
      >
        <SlidersHorizontal size={16} /> Filters{activeCount ? ` (${activeCount})` : ""}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 lg:hidden">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-lg bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-display text-base font-semibold text-foreground">
                Filters{activeCount ? ` (${activeCount})` : ""}
              </p>
              <button onClick={() => setMobileOpen(false)} aria-label="Close filters">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{panel}</div>
            <div className="border-t border-border p-4">
              <button
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-sm bg-rani py-3 text-sm font-bold uppercase text-rani-foreground"
              >
                Show {results.length} products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  children,
  chips,
  scroll,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  chips?: boolean;
  scroll?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-border py-3 first:pt-0 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">{title}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className={
            chips
              ? "mt-2.5 flex flex-wrap gap-1.5"
              : `mt-2.5 space-y-1.5 ${scroll ? "max-h-48 overflow-y-auto pr-1" : ""}`
          }
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-3.5 accent-rani" />
      {label}
    </label>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-sm border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        active
          ? "border-rani bg-rani text-rani-foreground"
          : "border-border text-muted-foreground hover:border-rani hover:text-rani"
      }`}
    >
      {label}
    </button>
  );
}
