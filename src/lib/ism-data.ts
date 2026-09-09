import imgSarees from "@/assets/cat-sarees.jpg";
import imgLehenga from "@/assets/cat-lehenga.jpg";
import imgKurta from "@/assets/cat-kurta.jpg";
import imgJewellery from "@/assets/cat-jewellery.jpg";
import imgMens from "@/assets/cat-mens.jpg";
import imgKids from "@/assets/cat-kids.jpg";
import imgFootwear from "@/assets/cat-footwear.jpg";
import imgHome from "@/assets/cat-home.jpg";
import imgPooja from "@/assets/cat-pooja.jpg";
import imgGifts from "@/assets/cat-gifts.jpg";
import imgBeauty from "@/assets/cat-beauty.jpg";
import imgWedding from "@/assets/cat-wedding.jpg";
import imgHero from "@/assets/hero-mela.jpg";
import pKanjivaram from "@/assets/p-kanjivaram.jpg";
import pAnarkali from "@/assets/p-anarkali.jpg";
import pSalwar from "@/assets/p-salwar.jpg";
import pBlouse from "@/assets/p-blouse.jpg";
import pDupatta from "@/assets/p-dupatta.jpg";
import pJhumkas from "@/assets/p-jhumkas.jpg";
import pNecklace from "@/assets/p-necklace.jpg";
import pBangles from "@/assets/p-bangles.jpg";
import pTempleJewel from "@/assets/p-temple-jewel.jpg";
import pBridalJewel from "@/assets/p-bridal-jewel.jpg";
import pSherwani from "@/assets/p-sherwani.jpg";
import pNehru from "@/assets/p-nehru.jpg";
import pMojari from "@/assets/p-mojari.jpg";
import pKolhapuri from "@/assets/p-kolhapuri.jpg";
import pPunjabiJutti from "@/assets/p-punjabi-jutti.jpg";
import pBedsheet from "@/assets/p-bedsheet.jpg";
import pDohar from "@/assets/p-dohar.jpg";
import pTowel from "@/assets/p-towel.jpg";
import pCushion from "@/assets/p-cushion.jpg";
import pCurtain from "@/assets/p-curtain.jpg";
import pBrassware from "@/assets/p-brassware.jpg";
import pKitchen from "@/assets/p-kitchen.jpg";
import pHandicraft from "@/assets/p-handicraft.jpg";
import pHomedecor from "@/assets/p-homedecor.jpg";
import pDiyas from "@/assets/p-diyas.jpg";
import pIdol from "@/assets/p-idol.jpg";
import pThali from "@/assets/p-thali.jpg";
import pIncense from "@/assets/p-incense.jpg";
import pMandir from "@/assets/p-mandir.jpg";
import pHoli from "@/assets/p-holi.jpg";
import pRakhi from "@/assets/p-rakhi.jpg";
import pHamper from "@/assets/p-hamper.jpg";
import pSkincare from "@/assets/p-skincare.jpg";
import pHaircare from "@/assets/p-haircare.jpg";
import pMehndi from "@/assets/p-mehndi.jpg";
import pKidsBoy from "@/assets/p-kids-boy.jpg";
import pKidsLehenga from "@/assets/p-kids-lehenga.jpg";
import pNavratri from "@/assets/p-navratri.jpg";
import pKarwa from "@/assets/p-karwa.jpg";
import pWeddingDecor from "@/assets/p-wedding-decor.jpg";
import pTrousseau from "@/assets/p-trousseau.jpg";
import pHousewarming from "@/assets/p-housewarming.jpg";
import pBindi from "@/assets/p-bindi.jpg";

export const HERO_IMAGE = imgHero;

export type ImageKey =
  | "sarees"
  | "lehenga"
  | "kurta"
  | "jewellery"
  | "mens"
  | "kids"
  | "footwear"
  | "home"
  | "pooja"
  | "gifts"
  | "beauty"
  | "wedding"
  | "kanjivaram"
  | "anarkali"
  | "salwar"
  | "blouse"
  | "dupatta"
  | "jhumkas"
  | "necklace"
  | "bangles"
  | "temple-jewel"
  | "bridal-jewel"
  | "sherwani"
  | "nehru"
  | "mojari"
  | "kolhapuri"
  | "punjabi-jutti"
  | "bedsheet"
  | "dohar"
  | "towel"
  | "cushion"
  | "curtain"
  | "brassware"
  | "kitchen"
  | "handicraft"
  | "homedecor"
  | "diyas"
  | "idol"
  | "thali"
  | "incense"
  | "mandir"
  | "holi"
  | "rakhi"
  | "hamper"
  | "skincare"
  | "haircare"
  | "mehndi"
  | "kids-boy"
  | "kids-lehenga"
  | "navratri"
  | "karwa"
  | "wedding-decor"
  | "trousseau"
  | "housewarming"
  | "bindi";

export const IMAGES: Record<ImageKey, string> = {
  sarees: imgSarees,
  lehenga: imgLehenga,
  kurta: imgKurta,
  jewellery: imgJewellery,
  mens: imgMens,
  kids: imgKids,
  footwear: imgFootwear,
  home: imgHome,
  pooja: imgPooja,
  gifts: imgGifts,
  beauty: imgBeauty,
  wedding: imgWedding,
  kanjivaram: pKanjivaram,
  anarkali: pAnarkali,
  salwar: pSalwar,
  blouse: pBlouse,
  dupatta: pDupatta,
  jhumkas: pJhumkas,
  necklace: pNecklace,
  bangles: pBangles,
  "temple-jewel": pTempleJewel,
  "bridal-jewel": pBridalJewel,
  sherwani: pSherwani,
  nehru: pNehru,
  mojari: pMojari,
  kolhapuri: pKolhapuri,
  "punjabi-jutti": pPunjabiJutti,
  bedsheet: pBedsheet,
  dohar: pDohar,
  towel: pTowel,
  cushion: pCushion,
  curtain: pCurtain,
  brassware: pBrassware,
  kitchen: pKitchen,
  handicraft: pHandicraft,
  homedecor: pHomedecor,
  diyas: pDiyas,
  idol: pIdol,
  thali: pThali,
  incense: pIncense,
  mandir: pMandir,
  holi: pHoli,
  rakhi: pRakhi,
  hamper: pHamper,
  skincare: pSkincare,
  haircare: pHaircare,
  mehndi: pMehndi,
  "kids-boy": pKidsBoy,
  "kids-lehenga": pKidsLehenga,
  navratri: pNavratri,
  karwa: pKarwa,
  "wedding-decor": pWeddingDecor,
  trousseau: pTrousseau,
  housewarming: pHousewarming,
  bindi: pBindi,
};

/** Per-product image overrides so the catalogue is visually distinct. */
const PRODUCT_IMAGE_OVERRIDES: Record<string, ImageKey> = {
  "ism-1002": "kanjivaram",
  "ism-1009": "salwar",
  "ism-1010": "anarkali",
  "ism-1012": "blouse",
  "ism-1013": "dupatta",
  "ism-2001": "bridal-jewel",
  "ism-2002": "necklace",
  "ism-2003": "jhumkas",
  "ism-2004": "temple-jewel",
  "ism-2005": "bangles",
  "ism-2006": "necklace",
  "ism-2007": "jhumkas",
  "ism-2008": "bridal-jewel",
  "ism-3002": "sherwani",
  "ism-3003": "nehru",
  "ism-3004": "nehru",
  "ism-4001": "kids-lehenga",
  "ism-4002": "kids-boy",
  "ism-5001": "punjabi-jutti",
  "ism-5003": "mojari",
  "ism-5004": "kolhapuri",
  "ism-6001": "bedsheet",
  "ism-6002": "dohar",
  "ism-6003": "dohar",
  "ism-6004": "towel",
  "ism-6005": "cushion",
  "ism-6006": "curtain",
  "ism-6007": "brassware",
  "ism-6008": "handicraft",
  "ism-6009": "kitchen",
  "ism-6010": "homedecor",
  "ism-7001": "diyas",
  "ism-7002": "idol",
  "ism-7003": "thali",
  "ism-7004": "incense",
  "ism-7005": "mandir",
  "ism-8001": "navratri",
  "ism-8002": "rakhi",
  "ism-8003": "holi",
  "ism-8004": "karwa",
  "ism-9001": "trousseau",
  "ism-9002": "mehndi",
  "ism-9003": "wedding-decor",
  "ism-9101": "hamper",
  "ism-9102": "housewarming",
  "ism-9103": "hamper",
  "ism-9201": "skincare",
  "ism-9202": "mehndi",
  "ism-9203": "haircare",
  "ism-9204": "bindi",
};

export type Category = {
  slug: string;
  name: string;
  image: ImageKey;
  subcategories: string[];
  blurb: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: "women",
    name: "Women",
    image: "sarees",
    blurb: "Sarees, lehengas, kurta sets and everyday Indian wear",
    subcategories: [
      "Sarees",
      "Lehengas",
      "Kurta Sets",
      "Salwar Suits",
      "Anarkali",
      "Indo-Western",
      "Blouses",
      "Dupattas",
    ],
  },
  {
    slug: "men",
    name: "Men",
    image: "mens",
    blurb: "Kurtas, sherwanis, nehru jackets and festive sets",
    subcategories: ["Kurta Pyjama", "Sherwani", "Nehru Jackets", "Indo-Western", "Dhoti & Lungi"],
  },
  {
    slug: "kids",
    name: "Kids",
    image: "kids",
    blurb: "Festive wear for little ones",
    subcategories: ["Girls Festive Wear", "Boys Kurta Sets", "Kids Lehenga", "Kids Accessories"],
  },
  {
    slug: "jewellery",
    name: "Jewellery",
    image: "jewellery",
    blurb: "Kundan, polki, temple and oxidised jewellery",
    subcategories: [
      "Jhumkas",
      "Necklace Sets",
      "Kundan",
      "Polki",
      "Oxidised",
      "Bangles",
      "Temple Jewellery",
      "Bridal Jewellery",
    ],
  },
  {
    slug: "footwear",
    name: "Footwear",
    image: "footwear",
    blurb: "Juttis, mojaris and Kolhapuri chappals",
    subcategories: [
      "Women's Juttis",
      "Punjabi Juttis",
      "Mojaris",
      "Kolhapuri Chappals",
      "Men's Ethnic Footwear",
    ],
  },
  {
    slug: "home-living",
    name: "Home & Living",
    image: "home",
    blurb: "Bedsheets, brassware, handicrafts and décor",
    subcategories: [
      "Bedsheets",
      "Blankets & Quilts",
      "Dohars",
      "Towels",
      "Cushion Covers",
      "Curtains",
      "Home Décor",
      "Brassware",
      "Kitchen & Dining",
      "Handicrafts",
    ],
  },
  {
    slug: "pooja",
    name: "Pooja",
    image: "pooja",
    blurb: "Diyas, idols, thalis and mandir essentials",
    subcategories: [
      "Diyas",
      "Idols",
      "Pooja Thalis",
      "Incense",
      "Mandir Accessories",
      "Pooja Kits",
    ],
  },
  {
    slug: "festivals",
    name: "Festivals",
    image: "gifts",
    blurb: "Diwali, Navratri, Raksha Bandhan and more",
    subcategories: [
      "Diwali",
      "Navratri",
      "Holi",
      "Raksha Bandhan",
      "Karwa Chauth",
      "Ganesh Chaturthi",
    ],
  },
  {
    slug: "wedding",
    name: "Wedding",
    image: "wedding",
    blurb: "Bridal wear, trousseau and mehndi essentials",
    subcategories: [
      "Bridal Lehengas",
      "Groom Wear",
      "Mehndi & Sangeet",
      "Wedding Décor",
      "Trousseau",
    ],
  },
  {
    slug: "gifts",
    name: "Gifts",
    image: "gifts",
    blurb: "Hampers and gifting by occasion and budget",
    subcategories: ["Gift Hampers", "Under $50", "Under $100", "Housewarming", "Corporate Gifting"],
  },
  {
    slug: "beauty",
    name: "Beauty",
    image: "beauty",
    blurb: "Ayurvedic care, henna and bridal beauty",
    subcategories: [
      "Ayurvedic Skincare",
      "Hair Care",
      "Henna & Mehndi",
      "Bindi & Sindoor",
      "Fragrance",
    ],
  },
];

export type Seller = {
  slug: string;
  name: string;
  city: string;
  state: string;
  rating: number;
  reviews: number;
  since: number;
  tagline: string;
  about: string;
  dispatchDays: string;
  banner: ImageKey;
};

export const SELLERS: Seller[] = [
  {
    slug: "mumbai-mirror-boutique",
    name: "Mumbai Mirror Boutique",
    city: "Harris Park",
    state: "NSW",
    rating: 4.8,
    reviews: 1284,
    since: 2019,
    tagline: "Handpicked sarees & lehengas, shipped from Sydney",
    about:
      "A family-run boutique in Harris Park stocking mill-fresh sarees, designer lehengas and blouse tailoring for Sydney's Indian community since 2019. All stock is held locally in Australia.",
    dispatchDays: "1-2 business days",
    banner: "sarees",
  },
  {
    slug: "jaipur-jewel-house",
    name: "Jaipur Jewel House",
    city: "Melbourne",
    state: "VIC",
    rating: 4.9,
    reviews: 962,
    since: 2020,
    tagline: "Kundan, polki and temple jewellery specialists",
    about:
      "Direct-from-Jaipur artisan jewellery curated in Melbourne. Every set is quality checked in our Dandenong studio before dispatch.",
    dispatchDays: "1-3 business days",
    banner: "jewellery",
  },
  {
    slug: "punjab-threads-co",
    name: "Punjab Threads Co.",
    city: "Truganina",
    state: "VIC",
    rating: 4.6,
    reviews: 517,
    since: 2021,
    tagline: "Menswear, juttis and Punjabi essentials",
    about:
      "Sherwanis, kurta sets and hand-embroidered Punjabi juttis for weddings across Australia. Free exchanges on sizing.",
    dispatchDays: "2-3 business days",
    banner: "footwear",
  },
  {
    slug: "desi-ghar-homewares",
    name: "Desi Ghar Homewares",
    city: "Brisbane",
    state: "QLD",
    rating: 4.7,
    reviews: 803,
    since: 2018,
    tagline: "Bedsheets, brassware and handicrafts",
    about:
      "Jaipuri cotton bedding, dohars, brass décor and handicrafts warehoused in Brisbane for fast Australia-wide delivery.",
    dispatchDays: "1-2 business days",
    banner: "home",
  },
  {
    slug: "shubh-pooja-store",
    name: "Shubh Pooja Store",
    city: "Perth",
    state: "WA",
    rating: 4.9,
    reviews: 441,
    since: 2022,
    tagline: "Everything for your mandir",
    about:
      "Diyas, idols, thalis, incense and complete pooja kits packed with care in Perth. Festival kits ship nationwide.",
    dispatchDays: "1-2 business days",
    banner: "pooja",
  },
  {
    slug: "chennai-silk-lane",
    name: "Chennai Silk Lane",
    city: "Adelaide",
    state: "SA",
    rating: 4.7,
    reviews: 358,
    since: 2021,
    tagline: "South Indian silks & temple jewellery",
    about:
      "Kanjivaram and Mysore silks, temple jewellery and pattu pavadai for kids, curated in Adelaide.",
    dispatchDays: "2-4 business days",
    banner: "wedding",
  },
];

export const sellerBySlug = (slug: string) => SELLERS.find((s) => s.slug === slug);

export type Product = {
  id: string;
  name: string;
  seller: string; // slug
  category: string; // slug
  subcategory: string;
  price: number;
  compareAt?: number | undefined;
  rating: number;
  reviews: number;
  image: ImageKey;
  badge?: string | undefined;
  colours: string[];
  sizes?: string[] | undefined;
  fabric?: string | undefined;
  material?: string | undefined;
  region: string;
  festival?: string | undefined;
  occasion?: string | undefined;
  readyToShip: boolean;
  stock: number;
  tags: string[];
  hasVideo?: boolean | undefined;
};

const p = (
  id: string,
  name: string,
  seller: string,
  category: string,
  subcategory: string,
  price: number,
  compareAt: number | undefined,
  rating: number,
  reviews: number,
  image: ImageKey,
  extra: Partial<Product> = {},
): Product => ({
  id,
  name,
  seller,
  category,
  subcategory,
  price,
  compareAt,
  rating,
  reviews,
  image: PRODUCT_IMAGE_OVERRIDES[id] ?? image,
  colours: ["Red", "Green"],
  region: "North India",
  readyToShip: true,
  stock: 12,
  tags: [],
  ...extra,
});

export const PRODUCTS: Product[] = [
  // Women — Sarees / Lehengas / Kurta
  p(
    "ism-1001",
    "Banarasi Silk Saree with Zari Border",
    "mumbai-mirror-boutique",
    "women",
    "Sarees",
    289,
    379,
    4.8,
    214,
    "sarees",
    {
      badge: "Bestseller",
      colours: ["Rani Pink", "Deep Purple", "Gold"],
      fabric: "Banarasi Silk",
      region: "Uttar Pradesh",
      occasion: "Wedding",
      sizes: ["Free Size"],
      stock: 8,
      hasVideo: true,
      tags: ["trending", "bestseller", "wedding"],
    },
  ),
  p(
    "ism-1002",
    "Kanjivaram Pure Silk Saree — Temple Motif",
    "chennai-silk-lane",
    "women",
    "Sarees",
    449,
    599,
    4.9,
    132,
    "sarees",
    {
      badge: "Premium",
      colours: ["Maroon", "Teal", "Mustard"],
      fabric: "Pure Silk",
      region: "South India",
      occasion: "Wedding",
      sizes: ["Free Size"],
      stock: 4,
      tags: ["bestseller", "wedding"],
    },
  ),
  p(
    "ism-1003",
    "Organza Floral Print Saree with Blouse",
    "mumbai-mirror-boutique",
    "women",
    "Sarees",
    139,
    189,
    4.5,
    96,
    "sarees",
    {
      colours: ["Peach", "Sky Blue"],
      fabric: "Organza",
      region: "West India",
      occasion: "Party",
      sizes: ["Free Size"],
      tags: ["trending"],
    },
  ),
  p(
    "ism-1004",
    "Georgette Sequin Party Saree",
    "mumbai-mirror-boutique",
    "women",
    "Sarees",
    169,
    undefined,
    4.4,
    61,
    "sarees",
    {
      colours: ["Black", "Wine"],
      fabric: "Georgette",
      region: "West India",
      occasion: "Party",
      tags: [],
    },
  ),
  p(
    "ism-1005",
    "Bridal Velvet Lehenga with Hand Embroidery",
    "mumbai-mirror-boutique",
    "women",
    "Lehengas",
    1290,
    1690,
    4.9,
    47,
    "lehenga",
    {
      badge: "Bridal",
      colours: ["Rani Pink", "Deep Red"],
      fabric: "Velvet",
      region: "North India",
      occasion: "Bridal",
      sizes: ["S", "M", "L", "XL"],
      stock: 3,
      readyToShip: false,
      hasVideo: true,
      tags: ["wedding", "trending"],
    },
  ),
  p(
    "ism-1006",
    "Georgette Sangeet Lehenga Set",
    "punjab-threads-co",
    "women",
    "Lehengas",
    399,
    529,
    4.6,
    88,
    "lehenga",
    {
      colours: ["Teal", "Magenta"],
      fabric: "Georgette",
      region: "North India",
      occasion: "Sangeet",
      sizes: ["S", "M", "L", "XL"],
      festival: "Wedding Season",
      tags: ["wedding"],
    },
  ),
  p(
    "ism-1007",
    "Cotton Straight Kurta Set with Palazzo",
    "punjab-threads-co",
    "women",
    "Kurta Sets",
    89,
    119,
    4.5,
    302,
    "kurta",
    {
      badge: "Ready to Ship",
      colours: ["Indigo", "White", "Mustard"],
      fabric: "Cotton",
      region: "North India",
      occasion: "Daily",
      sizes: ["XS", "S", "M", "L", "XL", "XXL"],
      stock: 40,
      tags: ["bestseller", "trending"],
    },
  ),
  p(
    "ism-1008",
    "Chikankari Kurta Set — Lucknowi Hand Work",
    "mumbai-mirror-boutique",
    "women",
    "Kurta Sets",
    149,
    199,
    4.7,
    176,
    "kurta",
    {
      colours: ["White", "Pastel Blue"],
      fabric: "Cotton Mul",
      region: "Uttar Pradesh",
      occasion: "Festive",
      sizes: ["S", "M", "L", "XL"],
      tags: ["bestseller"],
    },
  ),
  p(
    "ism-1009",
    "Printed Salwar Suit — Unstitched 3 Piece",
    "punjab-threads-co",
    "women",
    "Salwar Suits",
    69,
    95,
    4.3,
    143,
    "kurta",
    {
      colours: ["Green", "Peach"],
      fabric: "Cotton",
      region: "Punjab",
      occasion: "Daily",
      sizes: ["Unstitched"],
      tags: [],
    },
  ),
  p(
    "ism-1010",
    "Floor-Length Anarkali with Dupatta",
    "mumbai-mirror-boutique",
    "women",
    "Anarkali",
    219,
    289,
    4.6,
    74,
    "kurta",
    {
      colours: ["Deep Purple", "Emerald"],
      fabric: "Silk Blend",
      region: "North India",
      occasion: "Festive",
      sizes: ["S", "M", "L", "XL"],
      festival: "Diwali",
      tags: ["trending"],
    },
  ),
  p(
    "ism-1011",
    "Indo-Western Cape Gown",
    "mumbai-mirror-boutique",
    "women",
    "Indo-Western",
    259,
    undefined,
    4.4,
    39,
    "lehenga",
    {
      colours: ["Black", "Gold"],
      fabric: "Crepe",
      region: "West India",
      occasion: "Reception",
      sizes: ["S", "M", "L"],
      tags: [],
    },
  ),
  p(
    "ism-1012",
    "Readymade Embroidered Blouse",
    "chennai-silk-lane",
    "women",
    "Blouses",
    59,
    79,
    4.2,
    118,
    "sarees",
    {
      colours: ["Gold", "Maroon"],
      fabric: "Raw Silk",
      region: "South India",
      sizes: ["32", "34", "36", "38", "40"],
      tags: [],
    },
  ),
  p(
    "ism-1013",
    "Banarasi Zari Dupatta",
    "mumbai-mirror-boutique",
    "women",
    "Dupattas",
    45,
    65,
    4.5,
    205,
    "sarees",
    {
      colours: ["Red", "Gold", "Teal"],
      fabric: "Banarasi Silk",
      region: "Uttar Pradesh",
      tags: ["gift"],
    },
  ),

  // Jewellery
  p(
    "ism-2001",
    "Kundan Bridal Necklace Set with Maang Tikka",
    "jaipur-jewel-house",
    "jewellery",
    "Kundan",
    249,
    329,
    4.9,
    188,
    "jewellery",
    {
      badge: "Bestseller",
      colours: ["Gold", "Green"],
      material: "Kundan / Brass",
      region: "Rajasthan",
      occasion: "Bridal",
      stock: 15,
      hasVideo: true,
      tags: ["bestseller", "wedding", "trending"],
    },
  ),
  p(
    "ism-2002",
    "Polki Choker with Pearl Drops",
    "jaipur-jewel-house",
    "jewellery",
    "Polki",
    319,
    429,
    4.8,
    92,
    "jewellery",
    {
      colours: ["Gold", "White"],
      material: "Polki / Pearl",
      region: "Rajasthan",
      occasion: "Bridal",
      tags: ["wedding"],
    },
  ),
  p(
    "ism-2003",
    "Oxidised Silver Jhumkas — Peacock",
    "jaipur-jewel-house",
    "jewellery",
    "Jhumkas",
    39,
    55,
    4.6,
    421,
    "jewellery",
    {
      badge: "Under $50",
      colours: ["Silver"],
      material: "Oxidised Silver Alloy",
      region: "Rajasthan",
      occasion: "Festive",
      stock: 60,
      tags: ["trending", "gift"],
    },
  ),
  p(
    "ism-2004",
    "Temple Jewellery Lakshmi Necklace Set",
    "chennai-silk-lane",
    "jewellery",
    "Temple Jewellery",
    189,
    239,
    4.8,
    77,
    "jewellery",
    {
      colours: ["Antique Gold"],
      material: "Gold Plated Brass",
      region: "South India",
      occasion: "Wedding",
      tags: ["bestseller"],
    },
  ),
  p(
    "ism-2005",
    "Meenakari Bangles Set of 8",
    "jaipur-jewel-house",
    "jewellery",
    "Bangles",
    49,
    69,
    4.5,
    214,
    "jewellery",
    {
      colours: ["Rani Pink", "Green", "Gold"],
      material: "Meenakari Brass",
      region: "Rajasthan",
      sizes: ["2.4", "2.6", "2.8"],
      festival: "Karwa Chauth",
      tags: ["gift"],
    },
  ),
  p(
    "ism-2006",
    "Pearl & Emerald Rani Haar",
    "jaipur-jewel-house",
    "jewellery",
    "Necklace Sets",
    279,
    359,
    4.7,
    58,
    "jewellery",
    {
      colours: ["Green", "Gold"],
      material: "Pearl / Brass",
      region: "Rajasthan",
      occasion: "Wedding",
      tags: ["wedding"],
    },
  ),
  p(
    "ism-2007",
    "Oxidised Statement Jhumka & Ring Combo",
    "jaipur-jewel-house",
    "jewellery",
    "Oxidised",
    45,
    62,
    4.4,
    133,
    "jewellery",
    {
      colours: ["Silver", "Black"],
      material: "Oxidised Alloy",
      region: "North India",
      occasion: "Navratri",
      festival: "Navratri",
      tags: ["trending"],
    },
  ),
  p(
    "ism-2008",
    "Complete Bridal Jewellery Set — 7 Pieces",
    "jaipur-jewel-house",
    "jewellery",
    "Bridal Jewellery",
    599,
    799,
    4.9,
    41,
    "jewellery",
    {
      badge: "Bridal",
      colours: ["Gold", "Red"],
      material: "Kundan / Pearl",
      region: "Rajasthan",
      occasion: "Bridal",
      stock: 5,
      readyToShip: false,
      tags: ["wedding"],
    },
  ),

  // Men
  p(
    "ism-3001",
    "Silk Blend Kurta Pyjama Set",
    "punjab-threads-co",
    "men",
    "Kurta Pyjama",
    119,
    159,
    4.6,
    264,
    "mens",
    {
      badge: "Bestseller",
      colours: ["Cream", "Navy", "Maroon"],
      fabric: "Silk Blend",
      region: "Punjab",
      occasion: "Festive",
      sizes: ["S", "M", "L", "XL", "XXL"],
      festival: "Diwali",
      tags: ["bestseller", "trending"],
    },
  ),
  p(
    "ism-3002",
    "Embroidered Sherwani with Stole",
    "punjab-threads-co",
    "men",
    "Sherwani",
    749,
    949,
    4.8,
    52,
    "mens",
    {
      colours: ["Ivory", "Gold"],
      fabric: "Jacquard",
      region: "North India",
      occasion: "Groom",
      sizes: ["38", "40", "42", "44"],
      readyToShip: false,
      hasVideo: true,
      tags: ["wedding"],
    },
  ),
  p(
    "ism-3003",
    "Brocade Nehru Jacket",
    "punjab-threads-co",
    "men",
    "Nehru Jackets",
    99,
    139,
    4.5,
    118,
    "mens",
    {
      colours: ["Deep Purple", "Black"],
      fabric: "Brocade",
      region: "North India",
      occasion: "Festive",
      sizes: ["38", "40", "42", "44"],
      tags: [],
    },
  ),
  p(
    "ism-3004",
    "Indo-Western Kurta Bundi Set",
    "punjab-threads-co",
    "men",
    "Indo-Western",
    189,
    undefined,
    4.4,
    36,
    "mens",
    {
      colours: ["Teal", "Charcoal"],
      fabric: "Cotton Silk",
      region: "West India",
      occasion: "Sangeet",
      sizes: ["S", "M", "L", "XL"],
      tags: [],
    },
  ),

  // Kids
  p(
    "ism-4001",
    "Girls Festive Lehenga Choli",
    "chennai-silk-lane",
    "kids",
    "Kids Lehenga",
    89,
    119,
    4.7,
    91,
    "kids",
    {
      colours: ["Rani Pink", "Yellow"],
      fabric: "Art Silk",
      region: "South India",
      occasion: "Festive",
      sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
      festival: "Diwali",
      tags: ["trending"],
    },
  ),
  p(
    "ism-4002",
    "Boys Kurta Pyjama with Jacket",
    "punjab-threads-co",
    "kids",
    "Boys Kurta Sets",
    69,
    95,
    4.6,
    122,
    "kids",
    {
      colours: ["Cream", "Blue"],
      fabric: "Cotton Silk",
      region: "Punjab",
      occasion: "Festive",
      sizes: ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
      tags: ["bestseller"],
    },
  ),
  p(
    "ism-4003",
    "Kids Pattu Pavadai — South Indian Silk",
    "chennai-silk-lane",
    "kids",
    "Girls Festive Wear",
    99,
    undefined,
    4.8,
    44,
    "kids",
    {
      colours: ["Maroon", "Gold"],
      fabric: "Art Silk",
      region: "South India",
      occasion: "Festive",
      sizes: ["2-3Y", "4-5Y", "6-7Y"],
      tags: [],
    },
  ),

  // Footwear
  p(
    "ism-5001",
    "Hand-Embroidered Punjabi Juttis",
    "punjab-threads-co",
    "footwear",
    "Punjabi Juttis",
    79,
    105,
    4.7,
    318,
    "footwear",
    {
      badge: "Bestseller",
      colours: ["Rani Pink", "Gold", "Cream"],
      material: "Leather",
      region: "Punjab",
      sizes: ["AU 5", "AU 6", "AU 7", "AU 8", "AU 9"],
      stock: 34,
      tags: ["bestseller", "trending"],
    },
  ),
  p(
    "ism-5002",
    "Women's Zari Work Juttis",
    "punjab-threads-co",
    "footwear",
    "Women's Juttis",
    65,
    89,
    4.5,
    187,
    "footwear",
    {
      colours: ["Teal", "Maroon"],
      material: "Faux Leather",
      region: "Rajasthan",
      sizes: ["AU 5", "AU 6", "AU 7", "AU 8"],
      tags: [],
    },
  ),
  p(
    "ism-5003",
    "Men's Velvet Mojaris",
    "punjab-threads-co",
    "footwear",
    "Mojaris",
    89,
    undefined,
    4.4,
    76,
    "footwear",
    {
      colours: ["Deep Purple", "Black"],
      material: "Velvet",
      region: "North India",
      sizes: ["AU 7", "AU 8", "AU 9", "AU 10", "AU 11"],
      occasion: "Wedding",
      tags: ["wedding"],
    },
  ),
  p(
    "ism-5004",
    "Genuine Leather Kolhapuri Chappals",
    "desi-ghar-homewares",
    "footwear",
    "Kolhapuri Chappals",
    69,
    89,
    4.6,
    233,
    "footwear",
    {
      colours: ["Tan", "Brown"],
      material: "Leather",
      region: "Maharashtra",
      sizes: ["AU 6", "AU 7", "AU 8", "AU 9", "AU 10"],
      tags: ["gift"],
    },
  ),

  // Home & Living
  p(
    "ism-6001",
    "Jaipuri Cotton Double Bedsheet Set",
    "desi-ghar-homewares",
    "home-living",
    "Bedsheets",
    79,
    109,
    4.7,
    402,
    "home",
    {
      badge: "Bestseller",
      colours: ["Indigo", "Rust"],
      material: "Cotton",
      region: "Rajasthan",
      sizes: ["Queen", "King"],
      stock: 50,
      tags: ["bestseller", "trending"],
    },
  ),
  p(
    "ism-6002",
    "Reversible Cotton Dohar — Queen",
    "desi-ghar-homewares",
    "home-living",
    "Dohars",
    69,
    95,
    4.6,
    176,
    "home",
    {
      colours: ["Mustard", "Teal"],
      material: "Cotton",
      region: "Rajasthan",
      sizes: ["Single", "Queen", "King"],
      tags: [],
    },
  ),
  p(
    "ism-6003",
    "Handblock Print Quilt (Razai)",
    "desi-ghar-homewares",
    "home-living",
    "Blankets & Quilts",
    129,
    169,
    4.8,
    98,
    "home",
    {
      colours: ["Pink", "Green"],
      material: "Cotton Fill",
      region: "Rajasthan",
      sizes: ["Queen", "King"],
      tags: ["bestseller"],
    },
  ),
  p(
    "ism-6004",
    "Egyptian Cotton Towel Set of 4",
    "desi-ghar-homewares",
    "home-living",
    "Towels",
    59,
    undefined,
    4.4,
    141,
    "home",
    {
      colours: ["White", "Grey"],
      material: "Cotton",
      region: "South India",
      tags: [],
    },
  ),
  p(
    "ism-6005",
    "Brocade Cushion Covers — Set of 5",
    "desi-ghar-homewares",
    "home-living",
    "Cushion Covers",
    49,
    69,
    4.5,
    210,
    "home",
    {
      colours: ["Gold", "Magenta"],
      material: "Brocade",
      region: "West India",
      festival: "Diwali",
      tags: ["gift"],
    },
  ),
  p(
    "ism-6006",
    "Sheer Embroidered Curtains — Pair",
    "desi-ghar-homewares",
    "home-living",
    "Curtains",
    89,
    119,
    4.3,
    64,
    "home",
    {
      colours: ["Cream", "Teal"],
      material: "Polyester",
      region: "North India",
      tags: [],
    },
  ),
  p(
    "ism-6007",
    "Brass Urli Bowl with Floral Etching",
    "desi-ghar-homewares",
    "home-living",
    "Brassware",
    119,
    149,
    4.8,
    87,
    "home",
    {
      colours: ["Brass"],
      material: "Brass",
      region: "South India",
      festival: "Diwali",
      tags: ["trending", "gift"],
    },
  ),
  p(
    "ism-6008",
    "Hand-Carved Wooden Elephant Pair",
    "desi-ghar-homewares",
    "home-living",
    "Handicrafts",
    79,
    undefined,
    4.6,
    52,
    "home",
    {
      colours: ["Natural"],
      material: "Sheesham Wood",
      region: "Rajasthan",
      tags: ["gift"],
    },
  ),
  p(
    "ism-6009",
    "Copper Water Bottle & Glass Set",
    "desi-ghar-homewares",
    "home-living",
    "Kitchen & Dining",
    59,
    79,
    4.7,
    265,
    "home",
    {
      colours: ["Copper"],
      material: "Copper",
      region: "North India",
      tags: ["gift", "bestseller"],
    },
  ),
  p(
    "ism-6010",
    "Madhubani Wall Art Panel",
    "desi-ghar-homewares",
    "home-living",
    "Home Décor",
    99,
    129,
    4.5,
    43,
    "home",
    {
      colours: ["Multi"],
      material: "Canvas",
      region: "Bihar",
      tags: [],
    },
  ),

  // Pooja
  p(
    "ism-7001",
    "Brass Diya Set of 6 with Stand",
    "shubh-pooja-store",
    "pooja",
    "Diyas",
    39,
    55,
    4.8,
    388,
    "pooja",
    {
      badge: "Festival Pick",
      colours: ["Brass"],
      material: "Brass",
      region: "North India",
      festival: "Diwali",
      stock: 80,
      tags: ["trending", "bestseller"],
    },
  ),
  p(
    "ism-7002",
    "Marble Ganesh Idol — Hand Painted",
    "shubh-pooja-store",
    "pooja",
    "Idols",
    129,
    169,
    4.9,
    96,
    "pooja",
    {
      colours: ["White", "Gold"],
      material: "Marble Dust",
      region: "Rajasthan",
      festival: "Ganesh Chaturthi",
      hasVideo: true,
      tags: ["bestseller"],
    },
  ),
  p(
    "ism-7003",
    "Engraved Brass Pooja Thali Set",
    "shubh-pooja-store",
    "pooja",
    "Pooja Thalis",
    59,
    79,
    4.7,
    174,
    "pooja",
    {
      colours: ["Brass"],
      material: "Brass",
      region: "North India",
      festival: "Diwali",
      tags: ["gift"],
    },
  ),
  p(
    "ism-7004",
    "Premium Incense Sticks — 12 Pack",
    "shubh-pooja-store",
    "pooja",
    "Incense",
    25,
    35,
    4.6,
    512,
    "pooja",
    {
      badge: "Under $50",
      colours: ["Assorted"],
      material: "Natural Resin",
      region: "South India",
      stock: 120,
      tags: ["gift"],
    },
  ),
  p(
    "ism-7005",
    "Wooden Mandir Temple for Home",
    "shubh-pooja-store",
    "pooja",
    "Mandir Accessories",
    349,
    449,
    4.8,
    61,
    "pooja",
    {
      colours: ["Teak"],
      material: "Sheesham Wood",
      region: "Rajasthan",
      readyToShip: false,
      tags: [],
    },
  ),
  p(
    "ism-7006",
    "Complete Diwali Pooja Kit",
    "shubh-pooja-store",
    "pooja",
    "Pooja Kits",
    89,
    119,
    4.9,
    143,
    "pooja",
    {
      badge: "Festival Pick",
      colours: ["Assorted"],
      material: "Mixed",
      region: "North India",
      festival: "Diwali",
      tags: ["trending", "gift"],
    },
  ),

  // Festivals / Wedding / Gifts / Beauty
  p(
    "ism-8001",
    "Navratri Garba Chaniya Choli",
    "mumbai-mirror-boutique",
    "festivals",
    "Navratri",
    199,
    269,
    4.7,
    88,
    "lehenga",
    {
      colours: ["Mirror Multi"],
      fabric: "Cotton",
      region: "Gujarat",
      festival: "Navratri",
      occasion: "Garba",
      sizes: ["S", "M", "L", "XL"],
      tags: ["trending"],
    },
  ),
  p(
    "ism-8002",
    "Designer Rakhi Set with Sweets Box",
    "shubh-pooja-store",
    "festivals",
    "Raksha Bandhan",
    45,
    60,
    4.6,
    231,
    "gifts",
    {
      colours: ["Multi"],
      material: "Mixed",
      region: "North India",
      festival: "Raksha Bandhan",
      tags: ["gift"],
    },
  ),
  p(
    "ism-8003",
    "Organic Holi Colours Gift Pack",
    "desi-ghar-homewares",
    "festivals",
    "Holi",
    35,
    49,
    4.4,
    97,
    "gifts",
    {
      colours: ["Multi"],
      material: "Herbal",
      region: "North India",
      festival: "Holi",
      tags: ["gift"],
    },
  ),
  p(
    "ism-8004",
    "Karwa Chauth Thali & Chalni Set",
    "shubh-pooja-store",
    "festivals",
    "Karwa Chauth",
    69,
    89,
    4.7,
    74,
    "pooja",
    {
      colours: ["Brass", "Red"],
      material: "Brass",
      region: "North India",
      festival: "Karwa Chauth",
      tags: [],
    },
  ),
  p(
    "ism-9001",
    "Bridal Trousseau Gift Trunk",
    "mumbai-mirror-boutique",
    "wedding",
    "Trousseau",
    349,
    459,
    4.8,
    29,
    "wedding",
    {
      colours: ["Rani Pink", "Gold"],
      material: "Mixed",
      region: "North India",
      occasion: "Bridal",
      readyToShip: false,
      tags: ["wedding"],
    },
  ),
  p(
    "ism-9002",
    "Mehndi Décor Kit with Phoolon Ki Chaadar",
    "desi-ghar-homewares",
    "wedding",
    "Mehndi & Sangeet",
    259,
    329,
    4.6,
    33,
    "wedding",
    {
      colours: ["Marigold"],
      material: "Fabric / Floral",
      region: "North India",
      occasion: "Mehndi",
      tags: ["wedding"],
    },
  ),
  p(
    "ism-9003",
    "Wedding Marigold Toran & Backdrop Set",
    "desi-ghar-homewares",
    "wedding",
    "Wedding Décor",
    149,
    199,
    4.5,
    51,
    "wedding",
    {
      colours: ["Marigold", "Red"],
      material: "Artificial Florals",
      region: "North India",
      occasion: "Wedding",
      tags: ["wedding"],
    },
  ),
  p(
    "ism-9101",
    "Diwali Hamper — Sweets, Diyas & Décor",
    "shubh-pooja-store",
    "gifts",
    "Gift Hampers",
    119,
    149,
    4.8,
    168,
    "gifts",
    {
      badge: "Gift Pick",
      colours: ["Multi"],
      material: "Mixed",
      region: "North India",
      festival: "Diwali",
      tags: ["gift", "trending"],
    },
  ),
  p(
    "ism-9102",
    "Housewarming Brass Gift Box",
    "desi-ghar-homewares",
    "gifts",
    "Housewarming",
    89,
    115,
    4.6,
    64,
    "gifts",
    {
      colours: ["Brass"],
      material: "Brass",
      region: "South India",
      occasion: "Griha Pravesh",
      tags: ["gift"],
    },
  ),
  p(
    "ism-9103",
    "Under $50 Festive Gift Combo",
    "desi-ghar-homewares",
    "gifts",
    "Under $50",
    45,
    59,
    4.4,
    121,
    "gifts",
    {
      colours: ["Multi"],
      material: "Mixed",
      region: "West India",
      tags: ["gift"],
    },
  ),
  p(
    "ism-9201",
    "Ayurvedic Ubtan Glow Kit",
    "desi-ghar-homewares",
    "beauty",
    "Ayurvedic Skincare",
    49,
    65,
    4.5,
    209,
    "beauty",
    {
      colours: ["Natural"],
      material: "Herbal",
      region: "South India",
      occasion: "Bridal",
      tags: ["gift"],
    },
  ),
  p(
    "ism-9202",
    "Bridal Mehndi Cone Pack of 6",
    "desi-ghar-homewares",
    "beauty",
    "Henna & Mehndi",
    29,
    39,
    4.6,
    288,
    "beauty",
    {
      colours: ["Natural Henna"],
      material: "Herbal Henna",
      region: "Rajasthan",
      occasion: "Mehndi",
      tags: ["bestseller"],
    },
  ),
  p(
    "ism-9203",
    "Amla & Bhringraj Hair Oil 200ml",
    "desi-ghar-homewares",
    "beauty",
    "Hair Care",
    25,
    34,
    4.7,
    342,
    "beauty",
    {
      colours: ["Natural"],
      material: "Herbal Oil",
      region: "South India",
      tags: ["bestseller"],
    },
  ),
  p(
    "ism-9204",
    "Velvet Bindi & Sindoor Gift Box",
    "shubh-pooja-store",
    "beauty",
    "Bindi & Sindoor",
    19,
    26,
    4.3,
    156,
    "beauty",
    {
      colours: ["Multi"],
      material: "Mixed",
      region: "North India",
      tags: ["gift"],
    },
  ),
];

export const productById = (id: string) => PRODUCTS.find((x) => x.id === id);
export const productsBySeller = (slug: string) => PRODUCTS.filter((x) => x.seller === slug);
export const byTag = (tag: string) => PRODUCTS.filter((x) => x.tags.includes(tag));
export const byCategory = (slug: string) => PRODUCTS.filter((x) => x.category === slug);

export const REGIONS: { name: string; note: string; image: ImageKey }[] = [
  { name: "Gujarat", note: "Mirror work & Navratri wear", image: "navratri" },
  { name: "Punjab", note: "Phulkari, juttis & kurta sets", image: "punjabi-jutti" },
  { name: "Rajasthan", note: "Bandhani, kundan & handblock", image: "bangles" },
  { name: "Kashmir", note: "Pashmina, kani weaves & walnut wood", image: "dohar" },
  { name: "Maharashtra", note: "Paithani silks & Kolhapuri", image: "kolhapuri" },
  { name: "Bengal", note: "Jamdani, tant & terracotta", image: "handicraft" },
  { name: "South India", note: "Kanjivaram silks & temple jewellery", image: "kanjivaram" },
  { name: "Kerala", note: "Kasavu cotton & brass lamps", image: "brassware" },
];

export const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free Size", "AU 6", "AU 7", "AU 8"];
export const ALL_COLOURS = [
  "Rani Pink",
  "Deep Purple",
  "Gold",
  "Teal",
  "Maroon",
  "Cream",
  "Black",
  "Green",
  "Multi",
  "Brass",
];
export const ALL_FABRICS = [
  "Banarasi Silk",
  "Pure Silk",
  "Cotton",
  "Georgette",
  "Velvet",
  "Organza",
  "Silk Blend",
  "Brocade",
];
export const ALL_MATERIALS = [
  "Kundan / Brass",
  "Brass",
  "Leather",
  "Cotton",
  "Copper",
  "Oxidised Silver Alloy",
  "Marble Dust",
  "Sheesham Wood",
];
export const ALL_LOCATIONS = ["NSW", "VIC", "QLD", "WA", "SA"];
export const FESTIVALS = [
  "Diwali",
  "Navratri",
  "Holi",
  "Raksha Bandhan",
  "Karwa Chauth",
  "Ganesh Chaturthi",
];
export const OCCASIONS = [
  "Wedding",
  "Bridal",
  "Festive",
  "Party",
  "Daily",
  "Sangeet",
  "Mehndi",
  "Garba",
];

export const formatAUD = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
