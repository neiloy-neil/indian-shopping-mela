import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/lib/ism-data";
import { ProductCard } from "./ProductCard";

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h2 className="section-title text-foreground">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ViewAll({ to, params }: { to: "/category/$slug"; params: { slug: string } }) {
  return (
    <Link
      to={to}
      params={params}
      className="inline-flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wide text-rani hover:underline"
    >
      View all <ArrowRight size={14} />
    </Link>
  );
}

export function ProductGrid({ products, cols = 4 }: { products: Product[]; cols?: 4 | 5 }) {
  return (
    <div
      className={`grid grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 ${
        cols === 5 ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-3 lg:grid-cols-4"
      }`}
    >
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function ProductRail({ products, dense }: { products: Product[]; dense?: boolean }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:gap-3 md:mx-0 md:px-0">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          className={
            dense
              ? "w-[46.5%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[15.6%] xl:w-[12.4%]"
              : "w-[46.5%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[18.4%]"
          }
        />
      ))}
    </div>
  );
}
