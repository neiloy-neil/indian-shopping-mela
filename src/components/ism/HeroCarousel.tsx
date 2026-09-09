import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import slide1 from "@/assets/hero-slide-1.jpg";
import slide2 from "@/assets/hero-slide-2.jpg";
import slide3 from "@/assets/hero-slide-3.jpg";
import slide4 from "@/assets/hero-slide-4.jpg";
import slide5 from "@/assets/hero-slide-5.jpg";

type Cta = { label: string; slug?: string; q?: string; tone: "primary" | "ghost" };

type Slide = {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  line1: string;
  line2: string;
  sub: string;
  ctas: Cta[];
};

const SLIDES: Slide[] = [
  {
    id: "marketplace",
    image: slide1,
    alt: "Silk saree, gold jewellery, brass diya and premium home decor",
    eyebrow: "Australia's Indian marketplace",
    line1: "India's Colours.",
    line2: "Australia's Marketplace.",
    sub: "Fashion, jewellery, home décor and festive essentials from Indian sellers across Australia.",
    ctas: [
      { label: "Shop Now", slug: "women", tone: "primary" },
      { label: "Explore Categories", q: "", tone: "ghost" },
    ],
  },
  {
    id: "wedding",
    image: slide2,
    alt: "Bridal lehenga, saree and polki jewellery",
    eyebrow: "Wedding edit · made for the moments you miss",
    line1: "Bridal Sarees,",
    line2: "Lehengas & Polki.",
    sub: "Handpicked wedding wear and jewellery, dispatched from Australian warehouses.",
    ctas: [
      { label: "Shop Wedding", slug: "wedding", tone: "primary" },
      { label: "Jewellery", slug: "jewellery", tone: "ghost" },
    ],
  },
  {
    id: "home",
    image: slide3,
    alt: "Indian block print bedsheets, dohars, cushion covers and brassware",
    eyebrow: "Home & Living · a little closer to home",
    line1: "Dohars, Bedsheets",
    line2: "& Handcrafted Décor.",
    sub: "Block prints, quilts, cushion covers, towels and brassware for every Indian home.",
    ctas: [
      { label: "Shop Home & Living", slug: "home-living", tone: "primary" },
      { label: "Handicrafts", q: "Handicrafts", tone: "ghost" },
    ],
  },
  {
    id: "festival",
    image: slide4,
    alt: "Lit diyas, brass pooja thali and idol with marigold petals",
    eyebrow: "Festival & Pooja · traditions, delivered",
    line1: "Diyas, Thalis",
    line2: "& Pooja Essentials.",
    sub: "Everything for Diwali, Navratri and daily mandir rituals — ready to ship.",
    ctas: [
      { label: "Shop Pooja", slug: "pooja", tone: "primary" },
      { label: "Festivals", slug: "festivals", tone: "ghost" },
    ],
  },
  {
    id: "footwear",
    image: slide5,
    alt: "Embroidered Punjabi juttis with gift boxes",
    eyebrow: "Footwear & Gifts",
    line1: "Juttis, Mojaris",
    line2: "& Gifting Boxes.",
    sub: "Handcrafted footwear and curated hampers for every occasion and budget.",
    ctas: [
      { label: "Shop Footwear", slug: "footwear", tone: "primary" },
      { label: "Gifting Store", slug: "gifts", tone: "ghost" },
    ],
  },
];

function CtaLink({ cta }: { cta: Cta }) {
  const cls =
    cta.tone === "primary"
      ? "flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-sm bg-rani px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-rani-foreground transition-colors hover:bg-primary hover:text-primary-foreground sm:flex-none sm:px-4 sm:text-[11px] md:px-5 md:py-2.5 md:text-xs"
      : "flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-sm border border-primary bg-surface/80 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-primary backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground sm:flex-none sm:px-4 sm:text-[11px] md:px-5 md:py-2.5 md:text-xs";

  if (cta.slug) {
    return (
      <Link to="/category/$slug" params={{ slug: cta.slug }} className={cls}>
        {cta.label}
      </Link>
    );
  }
  return (
    <Link to="/search" search={cta.q ? { q: cta.q } : {}} className={cls}>
      {cta.label}
    </Link>
  );
}

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback((n: number) => setIndex((i) => (n + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5500);
    return () => window.clearInterval(t);
  }, [paused]);

  return (
    <div
      className="group relative overflow-hidden rounded-md border border-gold/50 bg-cream"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        if (start !== null && end !== null && Math.abs(end - start) > 40)
          go(index + (end < start ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Indian Shopping Mela featured collections"
    >
      {/* ratio keeper */}
      <div className="relative h-[310px] w-full min-[360px]:h-[320px] sm:h-[300px] md:h-[320px] lg:h-[340px] xl:h-[370px]">
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={i !== index}
          >
            <img
              src={s.image}
              alt={s.alt}
              width={1600}
              height={560}
              loading={i === 0 ? "eager" : "lazy"}
              className="absolute inset-0 size-full object-cover object-[62%_center] sm:object-right"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-cream via-cream/85 to-transparent sm:via-cream/70" />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-4 opacity-25"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, var(--marigold) 0 8px, transparent 8px 22px)",
              }}
              aria-hidden
            />
            <div className="relative flex h-full max-w-[94%] flex-col justify-center px-4 pb-9 pt-4 min-[360px]:px-5 sm:max-w-[62%] md:px-8 lg:max-w-[54%]">
              <p className="inline-flex w-fit max-w-full items-center rounded-full bg-primary px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.12em] text-primary-foreground min-[360px]:text-[9.5px] min-[360px]:tracking-[0.16em] md:text-[10px]">
                {s.eyebrow}
              </p>
              <h1 className="mt-2 font-display text-[1.18rem] font-bold uppercase leading-[1.05] text-primary min-[360px]:text-xl sm:mt-2.5 sm:text-2xl lg:text-[2.4rem]">
                {s.line1}
                <br />
                <span className="text-rani">{s.line2}</span>
              </h1>
              <p className="mt-2 max-w-md text-[11px] leading-relaxed text-foreground/80 min-[360px]:text-[12px] md:text-[14px]">
                {s.sub}
              </p>
              <div className="mt-3 flex w-full max-w-[290px] gap-2 sm:mt-4 sm:max-w-none sm:flex-wrap sm:gap-2.5">
                {s.ctas.map((c) => (
                  <CtaLink key={c.label} cta={c} />
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* arrows */}
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label="Previous slide"
          className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-gold/60 bg-surface/90 p-1.5 text-primary opacity-0 shadow-sm transition-opacity hover:bg-surface group-hover:opacity-100 focus-visible:opacity-100 md:block"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label="Next slide"
          className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-gold/60 bg-surface/90 p-1.5 text-primary opacity-0 shadow-sm transition-opacity hover:bg-surface group-hover:opacity-100 focus-visible:opacity-100 md:block"
        >
          <ChevronRight size={18} />
        </button>

        {/* dots */}
        <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-5 bg-rani" : "w-1.5 bg-primary/35 hover:bg-primary/60"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
