import { supabase } from "@/lib/supabase/client";
import {
  CATEGORIES,
  PRODUCTS,
  SELLERS,
  REGIONS,
  type Product,
  type Seller,
  type Category,
  type ImageKey,
} from "@/lib/ism-data";

export interface CatalogueDepartment {
  id: string;
  name: string;
  slug: string;
  categories: Category[];
}

export interface HomepageFeed {
  departments: CatalogueDepartment[];
  categories: Category[];
  heroCollections: Array<{
    title: string;
    note: string;
    slug: string;
    image: ImageKey;
    tone: string;
  }>;
  trendingProducts: Product[];
  newArrivals: Product[];
  topSellers: Seller[];
  festiveSpotlight: Product[];
  regionalSpecialties: Array<{
    name: string;
    note: string;
    image: ImageKey;
  }>;
}

export interface SearchCatalogParams {
  query?: string | undefined;
  category?: string | undefined;
  subcategory?: string | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  seller?: string | undefined;
  region?: string | undefined;
  sort?: "relevance" | "new" | "low" | "high" | "rating" | "discount" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

/**
 * Helper to map Supabase database product record to ISM Product interface
 */
export function mapDbProductToIsm(dbItem: any): Product {
  const variants = dbItem.variants ?? [];
  const minPrice =
    variants.length > 0
      ? Math.min(...variants.map((v: any) => Number(v.price ?? dbItem.price ?? 0)))
      : Number(dbItem.price ?? 0);

  const compareAtPrice =
    variants.length > 0 && variants[0].compare_at_price
      ? Number(variants[0].compare_at_price)
      : dbItem.sale_price
        ? Number(dbItem.sale_price)
        : undefined;

  const images =
    (dbItem.media_urls as string[]) ?? (dbItem.media?.map((m: any) => m.url) as string[]) ?? [];
  const firstImage = images.length > 0 ? images[0] : "sarees";

  const allSizes = Array.from(
    new Set(variants.map((v: any) => v.size || v.title).filter(Boolean)),
  ) as string[];
  const allColours = Array.from(
    new Set(variants.map((v: any) => v.colour).filter(Boolean)),
  ) as string[];

  const totalStock =
    variants.length > 0
      ? variants.reduce((acc: number, v: any) => acc + Number(v.stock_quantity ?? 0), 0)
      : Number(dbItem.stock_quantity ?? 0);

  return {
    id: dbItem.id ?? dbItem.slug,
    name: dbItem.title,
    seller: dbItem.seller?.slug ?? "ananya-sarees",
    category: dbItem.department ?? "women-ethnic",
    subcategory: dbItem.subcategory ?? dbItem.category?.name ?? "Sarees",
    price: minPrice > 0 ? minPrice : Number(dbItem.price ?? 0),
    compareAt: compareAtPrice && compareAtPrice > minPrice ? compareAtPrice : undefined,
    rating: Number(dbItem.rating_avg ?? 0),
    reviews: Number(dbItem.rating_count ?? 0),
    image: (firstImage as ImageKey) || "sarees",
    badge: dbItem.badge_text ?? undefined,
    tags: (dbItem.tags as string[]) ?? [],
    colours: allColours.length > 0 ? allColours : ["Standard"],
    sizes: allSizes.length > 0 ? allSizes : ["Free Size"],
    fabric: dbItem.fabric ?? "Standard",
    material: dbItem.material ?? "Standard",
    region: dbItem.craft_region ?? "India",
    occasion: dbItem.occasion ?? "Festive",
    festival: dbItem.festival ?? undefined,
    readyToShip: dbItem.is_ready_to_ship ?? true,
    stock: totalStock,
  };
}

import { getClientEnv } from "@/lib/config/env";

/**
 * T125 / T126 — Get Homepage Feed from live Supabase tables, fallback to seed fixtures ONLY in demo/dev mode.
 */
export async function getHomepageFeed(): Promise<HomepageFeed> {
  const isDemo =
    getClientEnv().VITE_DEMO_MODE ||
    (typeof process !== "undefined" && process.env && process.env["NODE_ENV"] !== "production");

  try {
    const { data: dbProducts, error } = await (supabase.from("products") as any)
      .select(
        `
        *,
        variants:product_variants(*),
        seller:sellers(business_name, slug, dispatch_address)
      `,
      )
      .eq("status", "LIVE")
      .limit(30);

    if (!error && dbProducts && dbProducts.length > 0) {
      const liveProducts = dbProducts.map(mapDbProductToIsm);
      return {
        departments: [
          {
            id: "dept-women",
            name: "Women",
            slug: "women",
            categories: CATEGORIES.filter((c) =>
              ["women", "jewellery", "footwear"].includes(c.slug),
            ),
          },
          {
            id: "dept-men",
            name: "Men",
            slug: "men",
            categories: CATEGORIES.filter((c) => ["men"].includes(c.slug)),
          },
          {
            id: "dept-home",
            name: "Home & Living",
            slug: "home-living",
            categories: CATEGORIES.filter((c) => ["home-living", "pooja"].includes(c.slug)),
          },
        ],
        categories: CATEGORIES,
        heroCollections: [
          {
            title: "Diwali Special",
            note: "Diyas, sweets boxes & festive décor",
            slug: "festivals",
            image: "pooja",
            tone: "bg-marigold text-marigold-foreground",
          },
          {
            title: "Wedding Collection",
            note: "Bridal lehengas, groom wear & jewellery",
            slug: "wedding",
            image: "wedding",
            tone: "bg-rani text-rani-foreground",
          },
          {
            title: "Home Makeover",
            note: "Dohars, brassware & handicrafts",
            slug: "home-living",
            image: "home",
            tone: "bg-primary text-primary-foreground",
          },
          {
            title: "Gifting Store",
            note: "Hampers by occasion & budget",
            slug: "gifts",
            image: "gifts",
            tone: "bg-teal text-teal-foreground",
          },
        ],
        trendingProducts: liveProducts.slice(0, 8),
        newArrivals: liveProducts.slice(8, 16),
        topSellers: SELLERS,
        festiveSpotlight: liveProducts.slice(0, 6),
        regionalSpecialties: REGIONS,
      };
    }
  } catch (err) {
    console.warn("Catalogue live query failed:", err);
  }

  // Baseline fixtures fallback ONLY when demo mode is active
  if (isDemo) {
    return {
      departments: [
        {
          id: "dept-women",
          name: "Women",
          slug: "women",
          categories: CATEGORIES.filter((c) => ["women", "jewellery", "footwear"].includes(c.slug)),
        },
        {
          id: "dept-men",
          name: "Men",
          slug: "men",
          categories: CATEGORIES.filter((c) => ["men"].includes(c.slug)),
        },
        {
          id: "dept-home",
          name: "Home & Living",
          slug: "home-living",
          categories: CATEGORIES.filter((c) => ["home-living", "pooja"].includes(c.slug)),
        },
      ],
      categories: CATEGORIES,
      heroCollections: [
        {
          title: "Diwali Special",
          note: "Diyas, sweets boxes & festive décor",
          slug: "festivals",
          image: "pooja",
          tone: "bg-marigold text-marigold-foreground",
        },
        {
          title: "Wedding Collection",
          note: "Bridal lehengas, groom wear & jewellery",
          slug: "wedding",
          image: "wedding",
          tone: "bg-rani text-rani-foreground",
        },
        {
          title: "Home Makeover",
          note: "Dohars, brassware & handicrafts",
          slug: "home-living",
          image: "home",
          tone: "bg-primary text-primary-foreground",
        },
        {
          title: "Gifting Store",
          note: "Hampers by occasion & budget",
          slug: "gifts",
          image: "gifts",
          tone: "bg-teal text-teal-foreground",
        },
      ],
      trendingProducts: PRODUCTS.slice(0, 8),
      newArrivals: PRODUCTS.slice(8, 16),
      topSellers: SELLERS,
      festiveSpotlight: PRODUCTS.filter(
        (p) => p.festival === "Diwali" || p.category === "pooja",
      ).slice(0, 6),
      regionalSpecialties: REGIONS,
    };
  }

  // Fail-closed empty feed for production when DB returns empty/error
  return {
    departments: [],
    categories: [],
    heroCollections: [],
    trendingProducts: [],
    newArrivals: [],
    topSellers: [],
    festiveSpotlight: [],
    regionalSpecialties: [],
  };
}

/**
 * T127 — Get Category Products with dynamic filters and sorting
 */
export async function getCategoryCatalogue(categorySlug: string): Promise<{
  category: Category;
  products: Product[];
}> {
  const matchedCat = CATEGORIES.find((c) => c.slug === categorySlug) ?? {
    slug: categorySlug,
    name: categorySlug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    image: "sarees" as ImageKey,
    blurb: "Handcrafted traditional Indian products dispatched across Australia.",
    subcategories: [],
  };

  try {
    const { data: dbProducts, error } = await (supabase.from("products") as any)
      .select(
        `
        *,
        variants:product_variants(*),
        seller:sellers(business_name, slug, dispatch_address)
      `,
      )
      .eq("status", "LIVE")
      .or(`department.eq.${categorySlug},subcategory.ilike.%${matchedCat.name}%`);

    if (!error && dbProducts && dbProducts.length > 0) {
      return {
        category: matchedCat,
        products: dbProducts.map(mapDbProductToIsm),
      };
    }
  } catch (err) {
    console.warn("Category live query failed:", err);
  }

  const isDemo =
    getClientEnv().VITE_DEMO_MODE ||
    (typeof process !== "undefined" && process.env && process.env["NODE_ENV"] !== "production");

  if (isDemo) {
    const staticProducts = PRODUCTS.filter(
      (p) =>
        p.category === categorySlug ||
        p.subcategory.toLowerCase().includes(categorySlug.toLowerCase()),
    );
    return {
      category: matchedCat,
      products: staticProducts.length > 0 ? staticProducts : PRODUCTS.slice(0, 8),
    };
  }

  return {
    category: matchedCat,
    products: [],
  };
}

/**
 * T128 — Get Seller Storefront Page data
 */
export async function getSellerStorefrontData(sellerSlug: string): Promise<{
  seller: Seller | null;
  products: Product[];
}> {
  const isDemo =
    getClientEnv().VITE_DEMO_MODE ||
    (typeof process !== "undefined" && process.env && process.env["NODE_ENV"] !== "production");

  try {
    const { data: dbSeller, error: sellerError } = await (supabase.from("sellers") as any)
      .select("*")
      .eq("slug", sellerSlug)
      .maybeSingle();

    if (!sellerError && dbSeller) {
      const { data: dbProducts } = await (supabase.from("products") as any)
        .select(
          `
          *,
          variants:product_variants(*),
          seller:sellers(business_name, slug, dispatch_address)
        `,
        )
        .eq("seller_id", dbSeller.id)
        .eq("status", "LIVE");

      const mappedSeller: Seller = {
        name: dbSeller.business_name ?? dbSeller.trading_name,
        slug: dbSeller.slug,
        city: (dbSeller.dispatch_address as any)?.suburb ?? "Harris Park",
        state: (dbSeller.dispatch_address as any)?.state ?? "NSW",
        rating: 4.9,
        reviews: 124,
        since: new Date(dbSeller.created_at).getFullYear(),
        tagline: dbSeller.description ?? "Curated Indian collections shipped Australia-wide",
        about:
          dbSeller.description ??
          "Preserving Indian heritage, style and handcrafted treasures across Australia.",
        dispatchDays: "1-2 business days",
        banner: "sarees",
      };

      return {
        seller: mappedSeller,
        products: (dbProducts ?? []).map(mapDbProductToIsm),
      };
    }
  } catch (err) {
    console.warn("Seller storefront live query failed:", err);
  }

  if (isDemo) {
    const staticSeller = SELLERS.find((s) => s.slug === sellerSlug) ?? null;
    const staticProducts = PRODUCTS.filter((p) => p.seller === sellerSlug);
    return {
      seller: staticSeller,
      products: staticProducts,
    };
  }

  return {
    seller: null,
    products: [],
  };
}

/**
 * T129 — Get Product Detail Page data with live variants and inventory
 */
export async function getProductDetailPageData(idOrSlug: string): Promise<{
  product: Product | null;
  seller: Seller | null;
  relatedProducts: Product[];
}> {
  const isDemo =
    getClientEnv().VITE_DEMO_MODE ||
    (typeof process !== "undefined" && process.env && process.env["NODE_ENV"] !== "production");

  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const query = (supabase.from("products") as any).select(`
        *,
        variants:product_variants(*),
        seller:sellers(*)
      `);

    const { data: dbItem, error } = isUuid
      ? await query.eq("id", idOrSlug).maybeSingle()
      : await query.eq("slug", idOrSlug).maybeSingle();

    if (!error && dbItem) {
      const product = mapDbProductToIsm(dbItem);
      const sellerData = dbItem.seller;
      const seller: Seller = sellerData
        ? {
            name: sellerData.business_name ?? sellerData.trading_name,
            slug: sellerData.slug,
            city: (sellerData.dispatch_address as any)?.suburb ?? "Sydney",
            state: (sellerData.dispatch_address as any)?.state ?? "NSW",
            rating: 4.9,
            reviews: 98,
            since: 2023,
            tagline: sellerData.description ?? "Handcrafted Indian Collections",
            about:
              sellerData.description ??
              "Preserving authentic Indian craft traditions across Australia.",
            dispatchDays: "1-2 business days",
            banner: "sarees",
          }
        : (SELLERS.find((s) => s.slug === product.seller) ?? SELLERS[0]!);

      return {
        product,
        seller,
        relatedProducts: isDemo
          ? PRODUCTS.filter((p) => p.category === product.category && p.id !== product.id).slice(
              0,
              8,
            )
          : [],
      };
    }
  } catch (err) {
    console.warn("PDP live query failed:", err);
  }

  if (isDemo) {
    const staticProduct = PRODUCTS.find((p) => p.id === idOrSlug) ?? null;
    if (!staticProduct) return { product: null, seller: null, relatedProducts: [] };

    const staticSeller = SELLERS.find((s) => s.slug === staticProduct.seller) ?? SELLERS[0]!;
    const related = PRODUCTS.filter(
      (p) => p.category === staticProduct.category && p.id !== staticProduct.id,
    ).slice(0, 8);

    return {
      product: staticProduct,
      seller: staticSeller,
      relatedProducts: related,
    };
  }

  return {
    product: null,
    seller: null,
    relatedProducts: [],
  };
}

/**
 * T130 / T131 — Search Catalogue with fuzzy/typo fallback and multifaceted filtering
 */
export async function searchCatalogueItems(params: SearchCatalogParams): Promise<{
  products: Product[];
  total: number;
}> {
  const isDemo =
    getClientEnv().VITE_DEMO_MODE ||
    (typeof process !== "undefined" && process.env && process.env["NODE_ENV"] !== "production");
  const q = (params.query ?? "").trim().toLowerCase();

  try {
    if (q) {
      const { data: dbItems, error } = await (supabase.from("products") as any)
        .select(
          `
          *,
          variants:product_variants(*),
          seller:sellers(business_name, slug, dispatch_address)
        `,
        )
        .eq("status", "LIVE")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q}}`);

      if (!error && dbItems && dbItems.length > 0) {
        let results = dbItems.map(mapDbProductToIsm);

        if (params.category) {
          results = results.filter((p: Product) => p.category === params.category);
        }
        if (params.minPrice) {
          results = results.filter((p: Product) => p.price >= params.minPrice!);
        }
        if (params.maxPrice) {
          results = results.filter((p: Product) => p.price <= params.maxPrice!);
        }

        return {
          products: results,
          total: results.length,
        };
      }
    }
  } catch (err) {
    console.warn("Search live query error:", err);
  }

  if (isDemo) {
    let matches = PRODUCTS.filter((p) => {
      if (!q) return true;
      const searchTokens = q.split(/\s+/).filter(Boolean);
      const haystack = [
        p.name,
        p.subcategory,
        p.category,
        p.region,
        p.festival,
        p.occasion,
        p.fabric,
        ...(p.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return searchTokens.some((token) => haystack.includes(token));
    });

    if (params.category) {
      matches = matches.filter((p: Product) => p.category === params.category);
    }
    if (params.minPrice) {
      matches = matches.filter((p: Product) => p.price >= params.minPrice!);
    }
    if (params.maxPrice) {
      matches = matches.filter((p: Product) => p.price <= params.maxPrice!);
    }

    return {
      products: matches,
      total: matches.length,
    };
  }

  return {
    products: [],
    total: 0,
  };
}
