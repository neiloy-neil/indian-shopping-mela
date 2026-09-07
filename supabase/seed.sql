-- Indian Shopping Mela (ISM) Initial Staging Seed Migration
-- Populates departments, categories, attribute options, initial verified sellers, products, variants, and product images.

-- 1. Departments
INSERT INTO public.departments (id, name, slug, description, sort_order)
VALUES
  ('dept-women-ethnic', 'Women''s Ethnic Wear', 'women-ethnic', 'Sarees, Lehengas, Salwar Suits, Kurtis and Dupattas', 1),
  ('dept-men-ethnic', 'Men''s Ethnic Wear', 'men-ethnic', 'Kurtas, Sherwanis, Nehru Jackets and Dhoti sets', 2),
  ('dept-jewellery', 'Jewellery & Accessories', 'jewellery', 'Kundan, Polki, Temple Jewellery, Bangles and Juttis', 3),
  ('dept-home-living', 'Home & Pooja', 'home-living', 'Handcrafted brassware, pooja essentials, dohars and festive decor', 4),
  ('dept-gifting', 'Festivals & Gifting', 'festivals-gifting', 'Diwali hampers, sweets boxes, return gifts and wedding favors', 5)
ON CONFLICT (slug) DO NOTHING;

-- 2. Categories
INSERT INTO public.categories (id, department_id, name, slug, description, sort_order)
VALUES
  ('cat-sarees', 'dept-women-ethnic', 'Sarees', 'sarees', 'Banarasi, Kanjeevaram, Chanderi, Organza and Silk Sarees', 1),
  ('cat-lehengas', 'dept-women-ethnic', 'Lehengas', 'lehengas', 'Bridal, Festive and Reception Lehengas', 2),
  ('cat-suits', 'dept-women-ethnic', 'Salwar Suits & Anarkalis', 'suits', 'Anarkalis, Shararas, Ghararas and Straight Suits', 3),
  ('cat-kurtis', 'dept-women-ethnic', 'Kurtis & Tunics', 'kurtis', 'Cotton, Silk and Embroidered Everyday and Festive Kurtis', 4),
  ('cat-men-kurtas', 'dept-men-ethnic', 'Men''s Kurtas', 'men-kurtas', 'Chikankari, Silk and Linen Kurta Sets', 5),
  ('cat-sherwanis', 'dept-men-ethnic', 'Sherwanis & Indo-Western', 'sherwanis', 'Wedding Sherwanis and Royal Indo-Western Suits', 6),
  ('cat-nehru-jackets', 'dept-men-ethnic', 'Nehru & Bandhgala Jackets', 'nehru-jackets', 'Silk, Brocade and Modi Style Waistcoats', 7),
  ('cat-kundan-jewellery', 'dept-jewellery', 'Kundan & Polki Jewellery', 'kundan-jewellery', 'Bridal Chokers, Necklaces and Jhumkas', 8),
  ('cat-temple-jewellery', 'dept-jewellery', 'Temple & Antique Jewellery', 'temple-jewellery', 'South Indian Antique Gold & Matte Finish Sets', 9),
  ('cat-juttis', 'dept-jewellery', 'Mojaris & Juttis', 'juttis', 'Punjabi Juttis, Embroidered Mojaris and Kolhapuris', 10),
  ('cat-pooja-essentials', 'dept-home-living', 'Pooja Essentials', 'pooja-essentials', 'Brass Diyas, Pooja Thalis, Idols and Incense', 11),
  ('cat-home-decor', 'dept-home-living', 'Home Décor & Furnishings', 'home-decor', 'Block-print Dohars, Cushion Covers and Blue Pottery', 12)
ON CONFLICT (slug) DO NOTHING;

-- 3. Initial Verified Boutique Sellers
INSERT INTO public.sellers (
  id,
  user_id,
  business_name,
  trading_name,
  slug,
  abn,
  business_type,
  phone,
  email,
  dispatch_address,
  return_policy_days,
  commission_rate_percent,
  onboarding_status,
  status,
  payouts_enabled,
  is_verified
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'Ananya Sarees Sydney',
    'Ananya Sarees',
    'ananya-sarees',
    '88123456789',
    'PROPRIETARY_LIMITED',
    '+61 2 9876 5432',
    'orders@ananyasarees.com.au',
    '{"line1": "14 Wigram St", "suburb": "Harris Park", "state": "NSW", "postcode": "2150", "country": "Australia"}'::jsonb,
    7,
    10.00,
    'COMPLETED',
    'ACTIVE',
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'Royal Jaipur Crafts Melbourne',
    'Royal Jaipur',
    'royal-jaipur',
    '77987654321',
    'PARTNERSHIP',
    '+61 3 9123 4567',
    'namaste@royaljaipurcrafts.com.au',
    '{"line1": "250 Foster St", "suburb": "Dandenong", "state": "VIC", "postcode": "3175", "country": "Australia"}'::jsonb,
    7,
    10.00,
    'COMPLETED',
    'ACTIVE',
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'Shreeji Pooja & Brassware Brisbane',
    'Shreeji Collections',
    'shreeji-collections',
    '66543219876',
    'SOLE_TRADER',
    '+61 7 3456 7890',
    'care@shreejicollections.com.au',
    '{"line1": "88 Logan Rd", "suburb": "Woolloongabba", "state": "QLD", "postcode": "4102", "country": "Australia"}'::jsonb,
    7,
    10.00,
    'COMPLETED',
    'ACTIVE',
    true,
    true
  )
ON CONFLICT (slug) DO NOTHING;

-- 4. Initial Showcase Products
INSERT INTO public.products (
  id,
  seller_id,
  title,
  slug,
  department,
  subcategory,
  description,
  badge_text,
  tags,
  highlights,
  specifications,
  fabric,
  occasion,
  festival,
  craft_region,
  care_instructions,
  ready_to_ship,
  dispatch_days_min,
  dispatch_days_max,
  status,
  is_approved,
  rating_avg,
  rating_count
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Varanasi Pure Katan Silk Banarasi Saree',
    'varanasi-pure-katan-silk-banarasi-saree',
    'women-ethnic',
    'Sarees',
    'Handcrafted in Varanasi using ancient handloom jacquard weaving. Rich gold kadwa zari floral jaal with unstitched blouse piece.',
    'Bestseller',
    ARRAY['saree', 'banarasi', 'silk', 'festive', 'wedding'],
    ARRAY['Pure Katan Silk with Silk Mark', 'Handcrafted Real Kadwa Zari Weave', 'Includes 0.8m matching unstitched blouse piece'],
    '{"Weave": "Handloom Kadwa", "Length": "6.3 Metres (with blouse)", "Origin": "Varanasi, UP"}'::jsonb,
    'Pure Silk',
    'Wedding & Festive',
    'Diwali',
    'Varanasi',
    'Dry clean only',
    true,
    1,
    2,
    'LIVE',
    true,
    4.9,
    38
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Hand Block Printed Mulmul Cotton Dohar',
    'hand-block-printed-mulmul-cotton-dohar',
    'home-living',
    'Home Décor',
    'Traditional Sanganeri hand block printed 3-layer AC blanket made of 100% breathable mulmul cotton.',
    'Staff Pick',
    ARRAY['dohar', 'cotton', 'jaipur', 'bedding'],
    ARRAY['100% Breathable Mulmul Cotton', 'Natural vegetable dyes', 'Lightweight 3-layer AC blanket'],
    '{"Dimensions": "220cm x 240cm (Queen)", "Material": "Mulmul Cotton", "Origin": "Jaipur, Rajasthan"}'::jsonb,
    'Mulmul Cotton',
    'Everyday Living',
    'All Season',
    'Jaipur',
    'Machine wash cold gentle cycle',
    true,
    1,
    2,
    'LIVE',
    true,
    4.8,
    24
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'Handcrafted Brass Peacock Diya Stand',
    'handcrafted-brass-peacock-diya-stand',
    'home-living',
    'Pooja Essentials',
    'Solid cast brass traditional temple diya with intricate peacock finial. Perfect for mandir, Diwali and housewarming pooja.',
    'Festive Special',
    ARRAY['diya', 'brass', 'pooja', 'diwali', 'mandir'],
    ARRAY['Solid heavy virgin brass', 'Hand-polished antique golden luster', 'Stable weighted base'],
    '{"Height": "28 cm", "Weight": "1.4 kg", "Material": "Pure Brass"}'::jsonb,
    'Solid Brass',
    'Pooja & Gifting',
    'Diwali',
    'Moradabad',
    'Wipe clean with dry cloth or Pitambari powder',
    true,
    1,
    2,
    'LIVE',
    true,
    5.0,
    42
  )
ON CONFLICT (slug) DO NOTHING;

-- 5. Product Variants (Prices stored in AUD Cents)
INSERT INTO public.product_variants (
  id,
  product_id,
  title,
  sku,
  price_cents,
  compare_at_cents,
  cost_cents,
  weight_grams,
  stock_on_hand,
  colour,
  size,
  is_active
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Crimson Red / Free Size',
    'ANA-BAN-RED-001',
    28900, -- $289.00 AUD
    34900, -- $349.00 AUD
    14000,
    850,
    12,
    'Crimson Red',
    'Free Size',
    true
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Royal Emerald Green / Free Size',
    'ANA-BAN-GRN-002',
    28900,
    34900,
    14000,
    850,
    8,
    'Emerald Green',
    'Free Size',
    true
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Indigo Blue Floral / Queen Size',
    'RJ-DOH-BLU-Q',
    8900, -- $89.00 AUD
    11500,
    4000,
    650,
    25,
    'Indigo Blue',
    'Queen (220x240cm)',
    true
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000003',
    'Antique Gold / 28cm Stand',
    'SHR-DIYA-PEA-28',
    7900, -- $79.00 AUD
    9900,
    3200,
    1400,
    18,
    'Antique Brass',
    '28 cm',
    true
  )
ON CONFLICT (sku) DO NOTHING;
