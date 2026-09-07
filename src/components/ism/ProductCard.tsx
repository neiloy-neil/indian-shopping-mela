import { Link } from "@tanstack/react-router";
import { Heart, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IMAGES, formatAUD, sellerBySlug, type Product } from "@/lib/ism-data";
import { useIsm } from "@/lib/ism-store";
import { Stars } from "./Stars";

export function ProductCard({ product, className }: { product: Product; className?: string }) {
  const { addToCart, toggleWishlist, isWishlisted } = useIsm();
  const seller = sellerBySlug(product.seller);
  const off = product.compareAt
    ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
    : 0;
  const wished = isWishlisted(product.id);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-md border border-border bg-card transition-shadow hover:shadow-[0_8px_28px_-18px_rgba(60,20,80,0.5)]",
        className,
      )}
    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative block aspect-4/5 overflow-hidden bg-cream"
      >
        <img
          src={IMAGES[product.image]}
          alt={product.name}
          loading="lazy"
          width={900}
          height={900}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {product.badge && (
          <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
            {product.badge}
          </span>
        )}
        {off > 0 && (
          <span className="absolute bottom-2 left-2 rounded-sm bg-marigold px-1.5 py-0.5 text-[10px] font-bold text-marigold-foreground">
            {off}% OFF
          </span>
        )}
      </Link>

      <button
        type="button"
        aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        onClick={() => {
          toggleWishlist(product.id);
          toast(wished ? "Removed from wishlist" : "Saved to wishlist");
        }}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-rani"
      >
        <Heart size={15} className={cn(wished && "fill-rani text-rani")} />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-2 sm:p-2.5">
        <Link
          to="/seller/$slug"
          params={{ slug: product.seller }}
          className="truncate text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-rani min-[360px]:text-[10px] sm:text-[11px]"
        >
          {seller?.name}
        </Link>
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          className="line-clamp-2 min-h-8 text-[11.5px] font-medium leading-snug text-foreground hover:text-primary min-[360px]:text-[12px] sm:text-[13px]"
        >
          {product.name}
        </Link>
        <Stars rating={product.rating} reviews={product.reviews} />
        <div className="mt-auto flex items-end justify-between gap-1 pt-1.5 sm:gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
              <span className="text-[14px] font-bold text-foreground sm:text-[15px]">
                {formatAUD(product.price)}
              </span>
              {product.compareAt && (
                <span className="text-[10px] text-muted-foreground line-through sm:text-xs">
                  {formatAUD(product.compareAt)}
                </span>
              )}
            </div>
            {off > 0 && (
              <span className="text-[10.5px] font-bold text-teal">{off}% off today</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              addToCart(product.id);
              toast.success("Added to cart", { description: product.name });
            }}
            className="inline-flex size-8 shrink-0 items-center justify-center gap-1 rounded-sm bg-secondary text-[10px] font-bold uppercase tracking-wide text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground min-[360px]:h-auto min-[360px]:w-auto min-[360px]:px-2 min-[360px]:py-1.5 sm:px-2.5 sm:text-[11px]"
          >
            <Plus size={13} /> <span className="hidden min-[360px]:inline">Add</span>
          </button>
        </div>
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Truck size={11} className="shrink-0 text-teal" />
          {product.readyToShip
            ? "Dispatch in 1–2 days"
            : "Made to order · dispatch in 5–7 days"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Ships from {seller?.city}, {seller?.state}
        </p>
      </div>
    </article>
  );
}
