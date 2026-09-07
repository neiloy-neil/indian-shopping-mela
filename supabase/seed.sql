-- Indian Shopping Mela (ISM) Initial Staging Seed
-- Populates departments, categories, showcase sellers, products, and variants

-- 1. DEPARTMENTS
INSERT INTO public.departments (name, slug, description, sort_order)
VALUES
  ('Women''s Ethnic Wear', 'women-ethnic', 'Sarees, Lehengas, Salwar Suits, Kurtis and Dupattas', 1),
  ('Men''s Ethnic Wear', 'men-ethnic', 'Kurtas, Sherwanis, Nehru Jackets and Dhoti sets', 2),
  ('Jewellery & Accessories', 'jewellery', 'Kundan, Polki, Temple Jewellery, Bangles and Juttis', 3),
  ('Home & Pooja', 'home-living', 'Handcrafted brassware, pooja essentials, dohars and festive decor', 4),
  ('Festivals & Gifting', 'festivals-gifting', 'Diwali hampers, sweets boxes, return gifts and wedding favors', 5)
ON CONFLICT (slug) DO NOTHING;

-- 2. CATEGORIES
INSERT INTO public.categories (department, name, slug, description, sort_order)
VALUES
  ('Women''s Ethnic Wear', 'Sarees', 'sarees', 'Banarasi, Kanjeevaram, Chanderi, Organza and Silk Sarees', 1),
  ('Women''s Ethnic Wear', 'Lehengas', 'lehengas', 'Bridal, Festive and Reception Lehengas', 2),
  ('Women''s Ethnic Wear', 'Salwar Suits & Anarkalis', 'suits', 'Anarkalis, Shararas, Ghararas and Straight Suits', 3),
  ('Women''s Ethnic Wear', 'Kurtis & Tunics', 'kurtis', 'Cotton, Silk and Embroidered Everyday and Festive Kurtis', 4),
  ('Men''s Ethnic Wear', 'Men''s Kurtas', 'men-kurtas', 'Chikankari, Silk and Linen Kurta Sets', 5),
  ('Men''s Ethnic Wear', 'Sherwanis & Indo-Western', 'sherwanis', 'Wedding Sherwanis and Royal Indo-Western Suits', 6),
  ('Men''s Ethnic Wear', 'Nehru & Bandhgala Jackets', 'nehru-jackets', 'Silk, Brocade and Modi Style Waistcoats', 7),
  ('Jewellery & Accessories', 'Kundan & Polki Jewellery', 'kundan-jewellery', 'Bridal Chokers, Necklaces and Jhumkas', 8),
  ('Jewellery & Accessories', 'Temple & Antique Jewellery', 'temple-jewellery', 'South Indian Antique Gold & Matte Finish Sets', 9),
  ('Jewellery & Accessories', 'Mojaris & Juttis', 'juttis', 'Punjabi Juttis, Embroidered Mojaris and Kolhapuris', 10),
  ('Home & Pooja', 'Pooja Essentials', 'pooja-essentials', 'Brass Diyas, Pooja Thalis, Idols and Incense', 11),
  ('Home & Pooja', 'Home Décor & Furnishings', 'home-decor', 'Block-print Dohars, Cushion Covers and Blue Pottery', 12)
ON CONFLICT (slug) DO NOTHING;

-- 3. SELLER PROFILES & SELLERS
DO $$
DECLARE
    v_owner_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_seller1_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    v_seller2_id UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    v_seller3_id UUID := '33333333-3333-3333-3333-333333333333'::uuid;
    v_cat_sarees UUID;
    v_cat_home UUID;
    v_cat_pooja UUID;
    v_prod1_id UUID := 'aaaa1111-0000-0000-0000-000000000001'::uuid;
    v_prod2_id UUID := 'bbbb2222-0000-0000-0000-000000000002'::uuid;
    v_prod3_id UUID := 'cccc3333-0000-0000-0000-000000000003'::uuid;
BEGIN
    -- Provision admin user in auth.users
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
        v_owner_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'admin@indianshoppingmela.com.au',
        crypt('Mela2026!Admin#', gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"full_name":"Priya Sharma"}'::jsonb,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Provision mock admin/owner profile
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_owner_id, 'admin@indianshoppingmela.com.au', 'Priya Sharma (ISM Admin)', 'admin_super')
    ON CONFLICT (id) DO UPDATE SET role = 'admin_super';

    -- Insert verified showcase boutique sellers
    INSERT INTO public.sellers (
        id, owner_id, business_name, legal_name, abn, business_type, slug,
        about_text, status, commission_rate, handling_days_default,
        dispatch_address, return_address
    )
    VALUES
    (
        v_seller1_id, v_owner_id, 'Ananya Sarees Sydney', 'Ananya Sarees Pty Ltd', '88123456789', 'Company', 'ananya-sarees',
        'Boutique Banarasi, Kanjeevaram and Chanderi sarees curated directly from Varanasi and Kanchipuram master weavers.',
        'APPROVED', 10.00, 2,
        '{"line1": "14 Wigram St", "suburb": "Harris Park", "state": "NSW", "postcode": "2150", "country": "Australia"}'::jsonb,
        '{"line1": "14 Wigram St", "suburb": "Harris Park", "state": "NSW", "postcode": "2150", "country": "Australia"}'::jsonb
    ),
    (
        v_seller2_id, v_owner_id, 'Royal Jaipur Crafts Melbourne', 'Royal Jaipur Crafts Partnership', '77987654321', 'Partnership', 'royal-jaipur',
        'Authentic Rajasthani hand block printed mulmul dohars, cushion covers, and blue pottery handcrafted by artisan families.',
        'APPROVED', 10.00, 2,
        '{"line1": "250 Foster St", "suburb": "Dandenong", "state": "VIC", "postcode": "3175", "country": "Australia"}'::jsonb,
        '{"line1": "250 Foster St", "suburb": "Dandenong", "state": "VIC", "postcode": "3175", "country": "Australia"}'::jsonb
    ),
    (
        v_seller3_id, v_owner_id, 'Shreeji Pooja & Brassware Brisbane', 'Shreeji Collections Sole Trader', '66543219876', 'Sole Trader', 'shreeji-collections',
        'Heavy cast brass temple diyas, pooja thalis, incense burners, and festive sacred idols shipped Australia-wide.',
        'APPROVED', 10.00, 2,
        '{"line1": "88 Logan Rd", "suburb": "Woolloongabba", "state": "QLD", "postcode": "4102", "country": "Australia"}'::jsonb,
        '{"line1": "88 Logan Rd", "suburb": "Woolloongabba", "state": "QLD", "postcode": "4102", "country": "Australia"}'::jsonb
    )
    ON CONFLICT (slug) DO NOTHING;

    -- Lookup Category UUIDs
    SELECT id INTO v_cat_sarees FROM public.categories WHERE slug = 'sarees' LIMIT 1;
    SELECT id INTO v_cat_home FROM public.categories WHERE slug = 'home-decor' LIMIT 1;
    SELECT id INTO v_cat_pooja FROM public.categories WHERE slug = 'pooja-essentials' LIMIT 1;

    -- Insert Products
    IF v_cat_sarees IS NOT NULL THEN
        INSERT INTO public.products (
            id, seller_id, title, slug, department, category_id, subcategory,
            description, country_of_origin, return_eligible, handling_days, status
        )
        VALUES (
            v_prod1_id, v_seller1_id, 'Varanasi Pure Katan Silk Banarasi Saree', 'varanasi-pure-katan-silk-banarasi-saree',
            'Women''s Ethnic Wear', v_cat_sarees, 'Sarees',
            'Handcrafted in Varanasi using ancient handloom jacquard weaving. Rich gold kadwa zari floral jaal with unstitched blouse piece.',
            'India', true, 2, 'LIVE'
        )
        ON CONFLICT (seller_id, slug) DO NOTHING;

        INSERT INTO public.product_variants (
            product_id, seller_sku, title, price, sale_price, stock_quantity, attributes, images
        )
        VALUES
        (
            v_prod1_id, 'ANA-BAN-RED-001', 'Crimson Red / Free Size', 289.00, 349.00, 12,
            '{"size": "Free Size", "color": "Crimson Red"}'::jsonb,
            ARRAY['/assets/p-kanjivaram.jpg']
        ),
        (
            v_prod1_id, 'ANA-BAN-GRN-002', 'Emerald Green / Free Size', 289.00, 349.00, 8,
            '{"size": "Free Size", "color": "Emerald Green"}'::jsonb,
            ARRAY['/assets/p-kanjivaram.jpg']
        )
        ON CONFLICT (product_id, seller_sku) DO NOTHING;
    END IF;

    IF v_cat_home IS NOT NULL THEN
        INSERT INTO public.products (
            id, seller_id, title, slug, department, category_id, subcategory,
            description, country_of_origin, return_eligible, handling_days, status
        )
        VALUES (
            v_prod2_id, v_seller2_id, 'Hand Block Printed Mulmul Cotton Dohar', 'hand-block-printed-mulmul-cotton-dohar',
            'Home & Pooja', v_cat_home, 'Home Décor',
            'Traditional Sanganeri hand block printed 3-layer AC blanket made of 100% breathable mulmul cotton.',
            'India', true, 2, 'LIVE'
        )
        ON CONFLICT (seller_id, slug) DO NOTHING;

        INSERT INTO public.product_variants (
            product_id, seller_sku, title, price, sale_price, stock_quantity, attributes, images
        )
        VALUES
        (
            v_prod2_id, 'RJ-DOH-BLU-Q', 'Indigo Blue Floral / Queen Size', 89.00, 115.00, 25,
            '{"size": "Queen", "color": "Indigo Blue"}'::jsonb,
            ARRAY['/assets/p-dohar.jpg']
        )
        ON CONFLICT (product_id, seller_sku) DO NOTHING;
    END IF;

    IF v_cat_pooja IS NOT NULL THEN
        INSERT INTO public.products (
            id, seller_id, title, slug, department, category_id, subcategory,
            description, country_of_origin, return_eligible, handling_days, status
        )
        VALUES (
            v_prod3_id, v_seller3_id, 'Handcrafted Brass Peacock Diya Stand', 'handcrafted-brass-peacock-diya-stand',
            'Home & Pooja', v_cat_pooja, 'Pooja Essentials',
            'Solid cast brass traditional temple diya with intricate peacock finial. Perfect for mandir, Diwali and housewarming pooja.',
            'India', true, 2, 'LIVE'
        )
        ON CONFLICT (seller_id, slug) DO NOTHING;

        INSERT INTO public.product_variants (
            product_id, seller_sku, title, price, sale_price, stock_quantity, attributes, images
        )
        VALUES
        (
            v_prod3_id, 'SHR-DIYA-PEA-28', 'Antique Gold / 28cm Stand', 79.00, 99.00, 18,
            '{"size": "28cm", "color": "Antique Gold"}'::jsonb,
            ARRAY['/assets/p-diyas.jpg']
        )
        ON CONFLICT (product_id, seller_sku) DO NOTHING;
    END IF;

END $$;
