-- Indian Shopping Mela (ISM) — Canonical Production Seed
-- Contains ONLY immutable taxonomy, system categories, and authoritative marketplace configurations.
-- NEVER includes synthetic demo users, fake orders, or test products.

-- 1. DEPARTMENTS
INSERT INTO public.departments (name, slug, description, sort_order)
VALUES
  ('Women''s Ethnic Wear', 'women-ethnic', 'Sarees, Lehengas, Salwar Suits, Kurtis and Dupattas', 1),
  ('Men''s Ethnic Wear', 'men-ethnic', 'Kurtas, Sherwanis, Nehru Jackets and Dhoti sets', 2),
  ('Jewellery & Accessories', 'jewellery', 'Kundan, Polki, Temple Jewellery, Bangles and Juttis', 3),
  ('Home & Pooja', 'home-living', 'Handcrafted brassware, pooja essentials, dohars and festive decor', 4),
  ('Festivals & Gifting', 'festivals-gifting', 'Diwali hampers, sweets boxes, return gifts and wedding favors', 5)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- 2. CATEGORIES
DO $$
DECLARE
    v_dept_women UUID;
    v_dept_men UUID;
    v_dept_jewel UUID;
    v_dept_home UUID;
    v_dept_gift UUID;
BEGIN
    SELECT id INTO v_dept_women FROM public.departments WHERE slug = 'women-ethnic';
    SELECT id INTO v_dept_men FROM public.departments WHERE slug = 'men-ethnic';
    SELECT id INTO v_dept_jewel FROM public.departments WHERE slug = 'jewellery';
    SELECT id INTO v_dept_home FROM public.departments WHERE slug = 'home-living';
    SELECT id INTO v_dept_gift FROM public.departments WHERE slug = 'festivals-gifting';

    INSERT INTO public.categories (department_id, name, slug, description, sort_order)
    VALUES
      (v_dept_women, 'Sarees', 'sarees', 'Banarasi, Kanjeevaram, Chanderi, Organza and Silk Sarees', 1),
      (v_dept_women, 'Lehengas', 'lehengas', 'Bridal, Festive and Reception Lehengas', 2),
      (v_dept_women, 'Salwar Suits & Anarkalis', 'suits', 'Anarkalis, Shararas, Ghararas and Straight Suits', 3),
      (v_dept_women, 'Kurtis & Tunics', 'kurtis', 'Cotton, Silk and Embroidered Everyday and Festive Kurtis', 4),
      (v_dept_women, 'Dupattas & Shawls', 'dupattas', 'Phulkari, Banarasi, Bandhani and Pashmina Dupattas', 5),
      (v_dept_men, 'Men''s Kurtas', 'men-kurtas', 'Chikankari, Silk and Linen Kurta Sets', 6),
      (v_dept_men, 'Sherwanis & Indo-Western', 'sherwanis', 'Wedding Sherwanis and Royal Indo-Western Suits', 7),
      (v_dept_men, 'Nehru & Bandhgala Jackets', 'nehru-jackets', 'Silk, Brocade and Modi Style Waistcoats', 8),
      (v_dept_men, 'Dhotis & Pajamas', 'dhotis', 'Traditional Silk and Cotton Dhotis', 9),
      (v_dept_jewel, 'Kundan & Polki Jewellery', 'kundan-jewellery', 'Bridal Chokers, Necklaces and Jhumkas', 10),
      (v_dept_jewel, 'Temple & Antique Jewellery', 'temple-jewellery', 'South Indian Antique Gold & Matte Finish Sets', 11),
      (v_dept_jewel, 'Bangles & Kada Sets', 'bangles', 'Glass, Silk Thread, Brass and Polki Bangles', 12),
      (v_dept_jewel, 'Mojaris & Juttis', 'juttis', 'Punjabi Juttis, Embroidered Mojaris and Kolhapuris', 13),
      (v_dept_home, 'Pooja Essentials', 'pooja-essentials', 'Brass Diyas, Pooja Thalis, Idols and Incense', 14),
      (v_dept_home, 'Home Décor & Furnishings', 'home-decor', 'Block-print Dohars, Cushion Covers and Blue Pottery', 15),
      (v_dept_home, 'Brassware & Metalcraft', 'brassware', 'Handmade Brass Statues, Urlis and Bells', 16),
      (v_dept_gift, 'Diwali & Festive Sweets', 'festive-sweets', 'Packaged Kaju Katli, Laddoos and Dry Fruit Boxes', 17),
      (v_dept_gift, 'Wedding & Return Gifts', 'wedding-gifts', 'Handcrafted Gift Hampers, Potlis and Favors', 18)
    ON CONFLICT (slug) DO UPDATE SET
      department_id = EXCLUDED.department_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      sort_order = EXCLUDED.sort_order;
END $$;

-- 3. AUTHORITATIVE MARKETPLACE OPERATIONAL CONFIGURATION
INSERT INTO public.marketplace_configs (key, value, description)
VALUES
  ('return_window_days', '7'::jsonb, 'Ordinary change-of-mind return window in calendar days from delivery'),
  ('payout_delay_days', '14'::jsonb, 'Maturity delay in calendar days from delivery before seller payout release'),
  ('default_commission_rate_pct', '10.00'::jsonb, 'Default platform commission percentage on seller gross items'),
  ('seller_dispatch_sla_hours', '48'::jsonb, 'Standard seller dispatch SLA in hours from order placement'),
  ('media_limits', '{"max_images": 8, "max_image_mb": 10, "max_video_mb": 50, "max_video_seconds": 60}'::jsonb, 'Product image and video upload constraints'),
  ('import_limits', '{"max_rows_per_batch": 1000, "supported_formats": ["csv", "xlsx"]}'::jsonb, 'Bulk spreadsheet import constraints'),
  ('policy_versions', '{"terms": "v1.0_2026", "privacy": "v1.0_2026", "seller_agreement": "v1.1_2026", "returns": "v1.2_2026"}'::jsonb, 'Current active legal terms & policy versions')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- 4. STORAGE BUCKET CONFIGURATION (Public & Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-media', 'product-media', TRUE, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('seller-documents', 'seller-documents', FALSE, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('return-evidence', 'return-evidence', FALSE, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
