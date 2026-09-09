import { createFileRoute, Link } from "@tanstack/react-router";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { Catalogue } from "@/components/ism/Catalogue";
import { CATEGORIES, byCategory, PRODUCTS } from "@/lib/ism-data";
import { searchCatalogueItems } from "@/lib/api/catalogue";

type SearchParams = { q?: string | undefined; cat?: string | undefined };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s["q"] === "string" && s["q"] ? (s["q"] as string) : undefined,
    cat: typeof s["cat"] === "string" && s["cat"] ? (s["cat"] as string) : undefined,
  }),
  loaderDeps: ({ search: { q, cat } }) => ({ q, cat }),
  loader: async ({ deps: { q, cat } }) => {
    const data = await searchCatalogueItems({ query: q, category: cat });
    return data;
  },
  head: () => ({
    meta: [
      { title: "Search the Mela — Indian Shopping Mela" },
      {
        name: "description",
        content:
          "Search Indian products across Australian sellers — sarees, jewellery, footwear, pooja items and home décor with AUD pricing.",
      },
      { property: "og:title", content: "Search the Mela — Indian Shopping Mela" },
      {
        property: "og:description",
        content:
          "Filter thousands of Indian products by price, size, colour, fabric and seller location.",
      },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, cat } = Route.useSearch();
  const { products, total } = Route.useLoaderData();
  const category = cat ? CATEGORIES.find((c) => c.slug === cat) : undefined;
  const resultCount = total;

  return (
    <ShopLayout>
      <div className="relative overflow-hidden border-b border-border bg-cream">
        <div className="ism-container relative py-6 md:py-7">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-rani">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span className="font-semibold text-foreground">{q ? "Search" : "All products"}</span>
          </nav>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              {q ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rani">
                  Search results
                </p>
              ) : (
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rani">
                  Browse the mela
                </p>
              )}
              <h1 className="mt-1 font-display text-3xl font-bold uppercase tracking-tight text-primary md:text-4xl">
                {q ? `“${q}”` : "All products"}
              </h1>
              <span className="mt-2.5 block h-1 w-24 rounded-full mela-rule" aria-hidden />
              <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-[15px]">
                {category
                  ? `Within ${category.name}. Refine with the filters below.`
                  : "Every product on Indian Shopping Mela, priced in AUD."}
              </p>
            </div>
            <span className="shrink-0 rounded-full gold-hairline bg-surface/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary backdrop-blur">
              {resultCount} result{resultCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
      <Catalogue
        key={`${q ?? ""}-${cat ?? ""}`}
        title={q ? `Search results for “${q}”` : "Browse all products"}
        description={
          category
            ? `Within ${category.name}. Refine with the filters below.`
            : "Every product on Indian Shopping Mela, priced in AUD."
        }
        query={q}
        baseProducts={category ? byCategory(category.slug) : undefined}
      />
    </ShopLayout>
  );
}
