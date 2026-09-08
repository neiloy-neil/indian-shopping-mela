import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import { BadgeCheck, Calendar, Heart, MapPin, PackageCheck, Store, Truck } from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { LogoMark } from "@/components/ism/Logo";
import { ProductGrid, SectionHead } from "@/components/ism/Rail";
import { Stars } from "@/components/ism/Stars";
import { IMAGES } from "@/lib/ism-data";
import { getSellerStorefrontData } from "@/lib/api/catalogue";

export const Route = createFileRoute("/seller/$slug")({
  loader: async ({ params }) => {
    const data = await getSellerStorefrontData(params.slug);
    if (!data.seller) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData || !loaderData.seller) {
      return { meta: [{ title: "Seller unavailable — Indian Shopping Mela" }, { name: "robots", content: "noindex" }] };
    }
    const s = loaderData.seller;
    const t = `${s.name} — Indian Shopping Mela Seller`;
    const d = `${s.tagline}. Verified Indian seller in ${s.city}, ${s.state} shipping Australia-wide.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: SellerPage,
});

const REVIEWS = [
  { name: "Anjali M., Melbourne", rating: 5, text: "Beautiful quality and it arrived in three days. Packaging was gorgeous." },
  { name: "Ravi K., Perth", rating: 4, text: "Great range and honest sizing help over chat. Will order again for Diwali." },
  { name: "Simran D., Sydney", rating: 5, text: "Exactly like the photos. Loved that it shipped from within Australia." },
];

function SellerPage() {
  const { seller, products } = Route.useLoaderData();
  const [following, setFollowing] = useState(false);

  if (!seller) return null;



  const chips = Array.from(new Set(products.map((p) => p.subcategory))).slice(0, 6);

  const toggleFollow = () => {
    setFollowing((f) => {
      const next = !f;
      toast(next ? `Following ${seller.name}` : `Unfollowed ${seller.name}`, {
        description: next ? "You will see new arrivals from this store in your feed." : undefined,
      });
      return next;
    });
  };


  return (
    <ShopLayout>
      <div className="relative h-32 overflow-hidden bg-primary mandala sm:h-40 md:h-56">
        <img
          src={IMAGES[seller.banner]}
          alt=""
          loading="lazy"
          width={900}
          height={900}
          className="size-full object-cover object-center opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-primary/80" aria-hidden />
      </div>

      <div className="ism-container">
        <div className="relative z-10 -mt-10 rounded-md gold-hairline bg-card p-4 shadow-sm md:-mt-14 md:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface shadow-sm md:size-24">
              <Store size={28} className="text-primary md:hidden" />
              <Store size={32} className="hidden text-primary md:block" />
            </div>


            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-primary md:text-2xl">
                    {seller.name} <BadgeCheck size={18} className="text-teal" />
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">{seller.tagline}</p>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                  <button

                    onClick={toggleFollow}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-sm px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition-colors sm:flex-none sm:px-5 sm:text-xs ${
                      following
                        ? "border border-rani text-rani"
                        : "bg-rani text-rani-foreground"
                    }`}
                  >
                    <Heart size={13} className={following ? "fill-rani" : ""} />
                    {following ? "Following" : "Follow store"}
                  </button>
                  <Link
                    to="/search"
                    search={{ q: seller.name }}
                    className="flex-1 rounded-sm border border-border px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide hover:border-rani hover:text-rani sm:flex-none sm:px-5 sm:text-xs"
                  >
                    Search store
                  </Link>
                </div>

              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <Stars rating={seller.rating} reviews={seller.reviews} />
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} /> {seller.city}, {seller.state}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Truck size={13} /> Dispatch {seller.dispatchDays}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={13} /> Member since {seller.since}
                </span>
                <span className="inline-flex items-center gap-1">
                  <PackageCheck size={13} /> {products.length} products
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-4 border-t border-border pt-4">
            <span className="hidden shrink-0 rounded-lg bg-cream/60 p-2 ring-1 ring-gold/30 sm:inline-flex">
              <LogoMark compact />
            </span>
            <p className="max-w-3xl text-sm text-muted-foreground">
              <span className="font-semibold text-primary">Verified on Indian Shopping Mela.</span>{" "}
              {seller.about}
            </p>
          </div>

          {chips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-primary/8 px-3 py-1 text-[11px] font-semibold text-primary"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="py-10">
          <SectionHead title={`${products.length} products from this seller`} />
          <ProductGrid products={products} cols={5} />
        </div>

        <div className="border-t border-border py-10">
          <SectionHead title="Store reviews" subtitle={`${seller.reviews} verified customer reviews`} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {REVIEWS.map((r) => (
              <div key={r.name} className="rounded-md border border-border bg-card p-4">
                <Stars rating={r.rating} />
                <p className="mt-2 text-sm text-foreground">{r.text}</p>
                <p className="mt-3 text-xs text-muted-foreground">{r.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
