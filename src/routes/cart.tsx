import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, ShoppingBag, Trash2, Truck } from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { IMAGES, formatAUD, sellerBySlug } from "@/lib/ism-data";
import { cartProducts, useIsm } from "@/lib/ism-store";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Indian Shopping Mela" },
      {
        name: "description",
        content: "Multi-seller cart grouped by Indian seller with one combined AUD checkout.",
      },
      { property: "og:title", content: "Your Cart — Indian Shopping Mela" },
      { property: "og:description", content: "One checkout across multiple Indian sellers in Australia." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { cart, setQty, removeFromCart, subtotal } = useIsm();
  const lines = cartProducts(cart);

  const groups = Array.from(new Set(lines.map((l) => l.product.seller))).map((slug) => ({
    seller: sellerBySlug(slug)!,
    items: lines.filter((l) => l.product.seller === slug),
  }));

  const shipping = groups.reduce((n, g) => {
    const gSub = g.items.reduce((s, i) => s + i.product.price * i.line.qty, 0);
    return n + (gSub >= 99 ? 0 : 9.95);
  }, 0);

  return (
    <ShopLayout>
      <div className="bg-cream">
        <div className="ism-container py-8">
          <h1 className="section-title text-foreground">Your Cart</h1>
          <p className="mt-1 text-sm font-medium text-primary">
            One cart. Multiple Indian sellers. Delivered across Australia.
          </p>
          {lines.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {lines.length} item{lines.length === 1 ? "" : "s"} from {groups.length} seller
              {groups.length === 1 ? "" : "s"} · shipped as {groups.length} separate package
              {groups.length === 1 ? "" : "s"}, paid in one checkout.
            </p>
          )}

          {lines.length === 0 ? (
            <div className="mt-8 rounded-md border border-dashed border-border bg-card p-12 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <ShoppingBag size={26} />
              </span>
              <p className="mt-4 font-semibold text-foreground">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Discover sarees, jewellery, spices and more from Indian sellers across Australia.
              </p>
              <Link
                to="/"
                className="mt-5 inline-block rounded-sm bg-rani px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-rani-foreground hover:opacity-90"
              >
                Continue shopping
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-5">
                {groups.map((g, i) => {
                  const gSub = g.items.reduce((s, x) => s + x.product.price * x.line.qty, 0);
                  const freeShip = gSub >= 99;
                  return (
                    <section
                      key={g.seller.slug}
                      className="overflow-hidden rounded-md border border-border bg-card shadow-sm"
                    >
                      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 gap-y-1 bg-primary px-4 py-3 text-primary-foreground">
                        <div className="flex min-w-0 items-center gap-2 text-sm">
                          <Package size={16} className="shrink-0" />
                          <span className="shrink-0 font-bold uppercase tracking-wide text-[11px]">
                            Package {i + 1} of {groups.length}
                          </span>
                        </div>
                        <Link
                          to="/seller/$slug"
                          params={{ slug: g.seller.slug }}
                          className="shrink-0 rounded-sm bg-primary-foreground/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide hover:bg-primary-foreground/25"
                        >
                          Visit store
                        </Link>
                        <div className="col-span-2 min-w-0">
                          <Link
                            to="/seller/$slug"
                            params={{ slug: g.seller.slug }}
                            className="font-semibold hover:underline"
                          >
                            {g.seller.name}
                          </Link>
                          <span className="text-primary-foreground/70"> · {g.seller.city}, {g.seller.state}</span>
                        </div>
                      </header>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-cream/70 px-4 py-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Truck size={12} /> Dispatch {g.seller.dispatchDays}
                        </span>
                        <span>
                          {freeShip ? (
                            <span className="font-semibold text-teal">Free shipping unlocked</span>
                          ) : (
                            <>Add {formatAUD(99 - gSub)} more for free shipping from this seller</>
                          )}
                        </span>
                      </div>
                      <div className="divide-y divide-border">
                        {g.items.map(({ product, line }) => (
                          <div key={product.id} className="flex gap-4 p-4">
                            <Link to="/product/$id" params={{ id: product.id }} className="shrink-0">
                              <img
                                src={IMAGES[product.image]}
                                alt={product.name}
                                loading="lazy"
                                width={900}
                                height={900}
                                className="size-24 rounded-sm object-cover"
                              />
                            </Link>
                            <div className="min-w-0 flex-1">
                              <Link
                                to="/product/$id"
                                params={{ id: product.id }}
                                className="text-sm font-semibold text-foreground hover:text-rani"
                              >
                                {product.name}
                              </Link>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {[line.size, line.colour].filter(Boolean).join(" · ") || "Standard"}
                              </p>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="flex items-center rounded-sm border border-border">
                                  <button
                                    className="px-2.5 py-1 text-sm"
                                    onClick={() => setQty(product.id, line.qty - 1)}
                                    aria-label="Decrease"
                                  >
                                    −
                                  </button>
                                  <span className="w-8 text-center text-xs font-semibold">{line.qty}</span>
                                  <button
                                    className="px-2.5 py-1 text-sm"
                                    onClick={() => setQty(product.id, line.qty + 1)}
                                    aria-label="Increase"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  onClick={() => removeFromCart(product.id)}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 size={13} /> Remove
                                </button>
                              </div>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-foreground">
                              {formatAUD(product.price * line.qty)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
                {groups.length > 1 && (
                  <p className="rounded-sm border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground">
                    Items from different sellers may arrive in separate packages, on different days.
                  </p>
                )}
              </div>

              <aside className="h-max rounded-md border border-border bg-card p-5 shadow-sm lg:sticky lg:top-40">
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                  Order Summary
                </h2>
                <span className="mt-2 block h-px w-full gold-hairline" aria-hidden />
                <dl className="mt-4 space-y-2 text-sm">
                  <Row label="Subtotal" value={formatAUD(subtotal)} />
                  <Row label={`Shipping (${groups.length} package${groups.length === 1 ? "" : "s"})`} value={formatAUD(shipping)} />
                  <Row label="GST included" value={formatAUD(Math.round(subtotal / 11))} muted />
                </dl>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm font-bold uppercase tracking-wide">Total</span>
                  <span className="text-xl font-bold text-foreground">{formatAUD(subtotal + shipping)}</span>
                </div>
                <Link
                  to="/checkout"
                  className="mt-4 block rounded-sm bg-rani py-3 text-center text-sm font-bold uppercase tracking-wide text-rani-foreground hover:opacity-90"
                >
                  Proceed to Checkout
                </Link>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  One payment. Each seller ships and tracks their own package.
                </p>
              </aside>
            </div>
          )}
        </div>
      </div>
    </ShopLayout>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <dt>{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
