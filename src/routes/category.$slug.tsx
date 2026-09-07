import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ShopLayout } from "@/components/ism/ShopLayout";
import { Catalogue } from "@/components/ism/Catalogue";
import { CATEGORIES } from "@/lib/ism-data";
import { getCategoryCatalogue } from "@/lib/api/catalogue";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const data = await getCategoryCatalogue(params.slug);
    if (!data.category) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Category unavailable — Indian Shopping Mela" }, { name: "robots", content: "noindex" }] };
    }
    const t = `${loaderData.category.name} — Indian Shopping Mela`;
    const d = `${loaderData.category.blurb}. Shop ${loaderData.category.name.toLowerCase()} from Indian sellers across Australia in AUD.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { category, products } = Route.useLoaderData();


  return (
    <ShopLayout>
      <div className="relative overflow-hidden border-b border-border bg-cream">
        <div className="ism-container relative py-6 md:py-7">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-rani">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span className="font-semibold text-foreground">{category.name}</span>
          </nav>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-primary md:text-4xl">
                {category.name}
              </h1>
              <span className="mt-2.5 block h-1 w-24 rounded-full mela-rule" aria-hidden />
              <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-[15px]">{category.blurb}</p>
            </div>
            <span className="shrink-0 rounded-full gold-hairline bg-surface/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary backdrop-blur">
              {products.length} products
            </span>
          </div>

          {category.subcategories.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Shop by subcategory
              </p>
              <div className="flex flex-wrap gap-2">
                {category.subcategories.map((s) => (
                  <Link
                    key={s}
                    to="/search"
                    search={{ q: s, cat: category.slug }}
                    className="rounded-full gold-hairline bg-surface/80 px-3.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition-colors hover:border-rani hover:bg-surface hover:text-rani"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <Catalogue
        title={`${products.length} products in ${category.name}`}
        description="Filter by size, colour, fabric, seller location and more."
        lockedCategory={category.slug}
        baseProducts={products}
      />
    </ShopLayout>
  );
}
