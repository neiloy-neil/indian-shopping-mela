import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  Headphones,
  MapPin,
  PackageCheck,
  RotateCcw,
  Store,
  Truck,
} from "lucide-react";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { CategorySidebar } from "@/components/ism/CategorySidebar";
import { HeroCarousel } from "@/components/ism/HeroCarousel";
import { ProductGrid, ProductRail, SectionHead, ViewAll } from "@/components/ism/Rail";
import { Stars } from "@/components/ism/Stars";
import {
  byCategory,
  byTag,
  CATEGORIES,
  IMAGES,
  PRODUCTS,
  REGIONS,
  SELLERS,
  type ImageKey,
} from "@/lib/ism-data";
import { getHomepageFeed } from "@/lib/api/catalogue";

export const Route = createFileRoute("/")({
  loader: async () => {
    return await getHomepageFeed();
  },
  head: () => ({
    meta: [
      { title: "Indian Shopping Mela — Your One Stop Desi Bazaar" },
      {
        name: "description",
        content:
          "Shop sarees, jewellery, juttis, home décor and pooja essentials from verified Indian sellers across Australia. AUD pricing, local dispatch, easy returns.",
      },
      { property: "og:title", content: "Indian Shopping Mela — Your One Stop Desi Bazaar" },
      {
        property: "og:description",
        content:
          "India's colours. Australia's marketplace. Multi-vendor Indian shopping with Australia-wide delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const TRUST = [
  { icon: Truck, title: "Australia-Wide Shopping", note: "Every state & territory" },
  { icon: Store, title: "Multiple Indian Sellers", note: "Verified local businesses" },
  { icon: CreditCard, title: "Secure Payments", note: "Visa, Mastercard & Apple Pay" },
  { icon: RotateCcw, title: "Easy Returns", note: "7-day returns window" },
  { icon: PackageCheck, title: "Track Your Orders", note: "Per-package tracking" },
  { icon: Headphones, title: "Dedicated Support", note: "7 days a week, AEST" },
];

const PROMOS = [
  {
    title: "Diwali Special",
    note: "Diyas, sweets boxes & festive décor",
    to: "/category/$slug" as const,
    slug: "festivals",
    image: "pooja" as const,
    tone: "bg-marigold text-marigold-foreground",
  },
  {
    title: "Wedding Collection",
    note: "Bridal lehengas, groom wear & jewellery",
    to: "/category/$slug" as const,
    slug: "wedding",
    image: "wedding" as const,
    tone: "bg-rani text-rani-foreground",
  },
  {
    title: "Home Makeover",
    note: "Dohars, brassware & handicrafts",
    to: "/category/$slug" as const,
    slug: "home-living",
    image: "home" as const,
    tone: "bg-primary text-primary-foreground",
  },
  {
    title: "Gifting Store",
    note: "Hampers by occasion & budget",
    to: "/category/$slug" as const,
    slug: "gifts",
    image: "gifts" as const,
    tone: "bg-teal text-teal-foreground",
  },
];

const HOME_EDIT: { q: string; image: ImageKey }[] = [
  { q: "Bedsheets", image: "bedsheet" },
  { q: "Dohars", image: "dohar" },
  { q: "Cushion Covers", image: "cushion" },
  { q: "Towels", image: "towel" },
  { q: "Curtains", image: "curtain" },
  { q: "Brassware", image: "brassware" },
  { q: "Handicrafts", image: "handicraft" },
];

const COLLECTIONS = [
  {
    kicker: "Wedding Season",
    title: "Shaadi ka saaman",
    note: "Bridal lehengas, polki sets & trousseau",
    q: "Wedding",
    image: "wedding" as const,
  },
  {
    kicker: "Festive Favourites",
    title: "Lights, sweets & new clothes",
    note: "Diwali, Navratri, Holi & Rakhi edits",
    q: "Diwali",
    image: "navratri" as const,
  },
  {
    kicker: "Pooja & Traditions",
    title: "For the mandir at home",
    note: "Diyas, thalis, idols & incense",
    q: "Pooja",
    image: "thali" as const,
  },
  {
    kicker: "Gifting from the Heart",
    title: "Send a little India",
    note: "Hampers by occasion and budget",
    q: "Gift",
    image: "hamper" as const,
  },
];

function Home() {
  const feed = Route.useLoaderData();
  const trending =
    feed?.trendingProducts && feed.trendingProducts.length > 0 ? feed.trendingProducts : PRODUCTS;
  const women =
    trending.filter((p) => p.category === "women" || p.category === "sarees").slice(0, 8).length > 0
      ? trending.filter((p) => p.category === "women" || p.category === "sarees").slice(0, 8)
      : byCategory("women").slice(0, 8);
  const jewellery =
    trending.filter((p) => p.category === "jewellery").slice(0, 8).length > 0
      ? trending.filter((p) => p.category === "jewellery").slice(0, 8)
      : byCategory("jewellery").slice(0, 8);
  const home =
    trending.filter((p) => p.category === "home-living" || p.category === "home").slice(0, 8)
      .length > 0
      ? trending.filter((p) => p.category === "home-living" || p.category === "home").slice(0, 8)
      : byCategory("home-living").slice(0, 8);
  const festival =
    feed?.festiveSpotlight && feed.festiveSpotlight.length > 0
      ? feed.festiveSpotlight.slice(0, 8)
      : [...byCategory("festivals"), ...byTag("trending")].slice(0, 8);
  const wedding =
    trending.filter((p) => p.tags.includes("wedding")).slice(0, 8).length > 0
      ? trending.filter((p) => p.tags.includes("wedding")).slice(0, 8)
      : PRODUCTS.filter((p) => p.tags.includes("wedding")).slice(0, 8);
  const pooja =
    trending.filter((p) => p.category === "pooja").slice(0, 8).length > 0
      ? trending.filter((p) => p.category === "pooja").slice(0, 8)
      : byCategory("pooja").slice(0, 8);
  const footwear =
    trending.filter((p) => p.category === "footwear").length > 0
      ? trending.filter((p) => p.category === "footwear")
      : byCategory("footwear");
  const gifts =
    trending.filter((p) => p.tags.includes("gift")).slice(0, 8).length > 0
      ? trending.filter((p) => p.tags.includes("gift")).slice(0, 8)
      : PRODUCTS.filter((p) => p.tags.includes("gift")).slice(0, 8);

  return (
    <ShopLayout>
      {/* Sidebar + hero */}
      <section className="border-b border-border bg-surface">
        <div className="ism-container flex gap-5 py-3 sm:py-4">
          <CategorySidebar />

          <div className="min-w-0 flex-1 space-y-3 sm:space-y-4">
            {/* Hero carousel */}
            <HeroCarousel />

            {/* Trust strip */}
            <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 rounded-md border border-border bg-surface px-3 py-3 min-[360px]:gap-x-4 min-[360px]:px-4 sm:grid-cols-3 lg:grid-cols-6">
              {TRUST.map((t) => (
                <div key={t.title} className="flex items-start gap-2">
                  <t.icon size={17} className="mt-0.5 shrink-0 text-rani" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold leading-tight text-foreground min-[360px]:text-[12px]">
                      {t.title}
                    </p>
                    <p className="hidden text-[10.5px] leading-tight text-muted-foreground min-[350px]:block">
                      {t.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Promo tiles fill the row beside the sidebar */}
            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:px-0 sm:pb-0">
              {[
                {
                  slug: "wedding",
                  kicker: "Wedding Shop",
                  title: "Bridal lehengas & polki sets",
                  cta: "Shop wedding",
                },
                {
                  slug: "pooja",
                  kicker: "Pooja & Festive",
                  title: "Diyas, thalis & mandir picks",
                  cta: "Shop pooja",
                },
                {
                  slug: "home-living",
                  kicker: "Home & Living",
                  title: "Dohars, bedsheets & brassware",
                  cta: "Shop home",
                },
              ].map((p) => (
                <Link
                  key={p.slug}
                  to="/category/$slug"
                  params={{ slug: p.slug }}
                  className="group flex w-[72%] shrink-0 snap-start flex-col justify-between rounded-md border border-gold/50 bg-cream px-3 py-3 transition-colors hover:border-rani sm:w-auto sm:px-4"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-rani">
                    {p.kicker}
                  </p>
                  <p className="mt-1 font-display text-[14px] font-semibold leading-snug text-primary sm:text-[15px]">
                    {p.title}
                  </p>
                  <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-foreground/70 group-hover:text-rani sm:text-[11px]">
                    {p.cta} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <section className="ism-container py-6">
        <SectionHead
          title="Shop by Category"
          subtitle="Eleven aisles of the mela, all in one place"
        />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:px-0">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              to="/category/$slug"
              params={{ slug: c.slug }}
              className="group w-[30%] shrink-0 overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-rani sm:w-[18%] lg:w-[9.1%]"
            >
              <span className="block aspect-square overflow-hidden bg-cream">
                <img
                  src={IMAGES[c.image]}
                  alt={c.name}
                  loading="lazy"
                  width={600}
                  height={600}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <span className="block bg-cream px-2 py-2 text-center text-[12px] font-semibold leading-tight text-primary group-hover:text-rani">
                {c.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Trending */}
      <Band>
        <SectionHead
          title="Trending Now"
          subtitle="What Indian Australia is buying this week"
          action={<ViewAll to="/category/$slug" params={{ slug: "women" }} />}
        />
        <ProductRail products={byTag("trending").slice(0, 8)} dense />
      </Band>

      {/* Promo tiles */}
      <section className="ism-container py-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROMOS.map((p) => (
            <Link
              key={p.title}
              to={p.to}
              params={{ slug: p.slug }}
              className={`group relative overflow-hidden rounded-md ${p.tone}`}
            >
              <img
                src={IMAGES[p.image]}
                alt=""
                aria-hidden
                loading="lazy"
                width={800}
                height={500}
                className="absolute inset-0 size-full object-cover opacity-35 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="relative flex h-full flex-col justify-end gap-1 p-4">
                <p className="font-display text-lg font-semibold">{p.title}</p>
                <p className="text-[12px] opacity-90">{p.note}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide">
                  Shop now <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Band>
        <SectionHead
          title="Best Sellers Across Australia"
          subtitle="Highest rated products from every state"
        />
        <ProductGrid products={byTag("bestseller").slice(0, 8)} cols={5} />
      </Band>

      <section className="ism-container py-6">
        <SectionHead
          title="Shop Women's Fashion"
          subtitle="Sarees, lehengas, kurta sets, anarkalis and more"
          action={<ViewAll to="/category/$slug" params={{ slug: "women" }} />}
        />
        <ProductRail products={women} dense />
      </section>

      <Band>
        <SectionHead
          title="Jewellery"
          subtitle="Kundan, polki, temple and oxidised pieces"
          action={<ViewAll to="/category/$slug" params={{ slug: "jewellery" }} />}
        />
        <ProductRail products={jewellery} dense />
      </Band>

      <section className="ism-container py-6">
        <SectionHead
          title="Home & Living"
          subtitle="Bedsheets, dohars, brassware and handicrafts"
          action={<ViewAll to="/category/$slug" params={{ slug: "home-living" }} />}
        />
        <ProductRail products={home} dense />
      </section>

      {/* From India, For Your Home */}
      <section className="border-y border-gold/40 bg-cream">
        <div className="ism-container grid gap-5 py-7 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <div className="mandala relative flex flex-col justify-center rounded-md border border-gold/50 bg-surface p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rani">
              A little closer to home
            </p>
            <h2 className="section-title mt-1.5 text-primary">From India, For Your Home</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Cotton bedsheets that feel like the ones back home, winter dohars, quilted razais,
              soft towels, block-print cushion covers, brass lamps and handmade décor — chosen by
              Indian sellers, delivered across Australia.
            </p>
            <Link
              to="/category/$slug"
              params={{ slug: "home-living" }}
              className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-sm bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-primary-foreground hover:bg-rani"
            >
              Shop home & living <ArrowRight size={13} />
            </Link>
          </div>

          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 sm:pb-0 sm:gap-3">
            {HOME_EDIT.map((h) => (
              <Link
                key={h.q}
                to="/search"
                search={{ q: h.q }}
                className="group w-[30%] shrink-0 snap-start overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-rani sm:w-auto"
              >
                <span className="block aspect-square overflow-hidden bg-cream">
                  <img
                    src={IMAGES[h.image]}
                    alt={h.q}
                    loading="lazy"
                    width={400}
                    height={400}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
                <span className="block px-2 py-1.5 text-center text-[11.5px] font-semibold leading-tight text-primary group-hover:text-rani">
                  {h.q}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="ism-container py-6">
        <SectionHead
          title="Collections for the moments you miss"
          subtitle="Weddings, festivals, prayer and gifting — curated the Indian way"
        />
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.title}
              to="/search"
              search={{ q: c.q }}
              className="group relative overflow-hidden rounded-md border border-gold/50"
            >
              <img
                src={IMAGES[c.image]}
                alt=""
                aria-hidden
                loading="lazy"
                width={800}
                height={600}
                className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105 sm:h-44"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/45 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3.5 text-primary-foreground">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-gold">
                  {c.kicker}
                </span>
                <span className="mt-0.5 block font-display text-[14px] font-semibold leading-tight sm:text-[17px]">
                  {c.title}
                </span>
                <span className="mt-0.5 hidden text-[11.5px] text-primary-foreground/85 sm:block">
                  {c.note}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Festival */}
      <Band>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gold/50 bg-primary px-5 py-4 text-primary-foreground">
          <div>
            <h2 className="section-title">Celebrate Every Festival</h2>
            <p className="mt-0.5 text-[12px] text-primary-foreground/80">
              Diwali, Navratri, Raksha Bandhan, Holi, Karwa Chauth and Ganesh Chaturthi edits.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Diwali", "Navratri", "Raksha Bandhan", "Holi"].map((f) => (
              <Link
                key={f}
                to="/search"
                search={{ q: f }}
                className="rounded-sm border border-gold/60 px-3 py-1.5 text-[11px] font-semibold text-gold hover:bg-gold hover:text-gold-foreground"
              >
                {f}
              </Link>
            ))}
          </div>
        </div>
        <ProductRail products={festival} dense />
      </Band>

      <section className="ism-container py-6">
        <SectionHead
          title="Wedding Shop"
          subtitle="Bridal lehengas, groom wear, mehndi and décor"
          action={<ViewAll to="/category/$slug" params={{ slug: "wedding" }} />}
        />
        <ProductRail products={wedding} dense />
      </section>

      <Band>
        <SectionHead
          title="Pooja & Spiritual"
          subtitle="Diyas, idols, thalis, incense and mandir essentials"
          action={<ViewAll to="/category/$slug" params={{ slug: "pooja" }} />}
        />
        <ProductRail products={pooja} dense />
      </Band>

      <section className="ism-container py-6">
        <SectionHead
          title="Footwear"
          subtitle="Juttis, mojaris and Kolhapuri chappals"
          action={<ViewAll to="/category/$slug" params={{ slug: "footwear" }} />}
        />
        <ProductRail products={footwear} dense />
      </section>

      <Band>
        <SectionHead
          title="Gifts"
          subtitle="By occasion and by budget — hampers, brass and festive combos"
          action={<ViewAll to="/category/$slug" params={{ slug: "gifts" }} />}
        />
        <ProductRail products={gifts} dense />
      </Band>

      {/* Regions */}
      <section className="ism-container py-6">
        <SectionHead
          title="Shop by Region"
          subtitle="Discover crafts and textiles by the place they come from"
        />
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {REGIONS.map((r) => (
            <Link
              key={r.name}
              to="/search"
              search={{ q: r.name }}
              className="group relative w-[64%] shrink-0 overflow-hidden rounded-md border border-gold/40 bg-surface transition-colors hover:border-rani md:w-auto"
            >
              <span className="flex items-center gap-3 p-2.5">
                <span className="block size-16 shrink-0 overflow-hidden rounded-sm bg-cream">
                  <img
                    src={IMAGES[r.image]}
                    alt={r.name}
                    loading="lazy"
                    width={240}
                    height={240}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[15px] font-semibold text-primary group-hover:text-rani">
                    {r.name}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                    {r.note}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Sellers */}
      <Band>
        <SectionHead
          title="Featured Indian Sellers"
          subtitle="Verified businesses shipping from within Australia"
        />
        <div className="grid gap-3 md:grid-cols-3">
          {SELLERS.map((s) => (
            <Link
              key={s.slug}
              to="/seller/$slug"
              params={{ slug: s.slug }}
              className="flex gap-3.5 rounded-md border border-border bg-surface p-3.5 transition-colors hover:border-rani"
            >
              <img
                src={IMAGES[s.banner]}
                alt={s.name}
                loading="lazy"
                width={200}
                height={200}
                className="size-14 shrink-0 rounded-sm object-cover"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-semibold text-foreground">
                  {s.name} <BadgeCheck size={15} className="shrink-0 text-teal" />
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                  <MapPin size={12} /> {s.city}, {s.state} · since {s.since}
                </p>
                <div className="mt-1.5">
                  <Stars rating={s.rating} reviews={s.reviews} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Band>
    </ShopLayout>
  );
}

function Band({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-y border-border bg-cream/60">
      <div className="ism-container py-6">{children}</div>
    </section>
  );
}
