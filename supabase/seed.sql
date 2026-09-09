-- Indian Shopping Mela (ISM) Canonical Staging Seed
-- Reconciled 2026-09-09 to match canonical schema:
--   - profiles.role uses user_role enum values (admin_super not super_admin)
--   - sellers uses owner_id (not user_id), legal_name (not store_name),
--     commission_rate decimal (not commission_rate_pct), status SCREAMING_SNAKE
--   - Addresses embedded as JSONB in sellers (no seller_addresses table inserts)
--   - product_variants uses seller_sku (not sku), sale_price (not compare_at_price)
--   - marketplace_configs uses (config_key, config_value) schema with UUID PK

-- 1. DEPARTMENTS
INSERT INTO public.departments (name, slug, description, sort_order)
VALUES
  ('Women''s Ethnic Wear', 'women-ethnic', 'Sarees, Lehengas, Salwar Suits, Kurtis and Dupattas', 1),
  ('Men''s Ethnic Wear',  'men-ethnic',   'Kurtas, Sherwanis, Nehru Jackets and Dhoti sets', 2),
  ('Jewellery & Accessories', 'jewellery', 'Kundan, Polki, Temple Jewellery, Bangles and Juttis', 3),
  ('Home & Pooja',        'home-living',  'Handcrafted brassware, pooja essentials, dohars and festive decor', 4),
  ('Festivals & Gifting', 'festivals-gifting', 'Diwali hampers, sweets boxes, return gifts and wedding favors', 5)
ON CONFLICT (slug) DO NOTHING;

-- 2. CATEGORIES
DO $$
DECLARE
    v_dept_women UUID;
    v_dept_men   UUID;
    v_dept_jewel UUID;
    v_dept_home  UUID;
BEGIN
    SELECT id INTO v_dept_women FROM public.departments WHERE slug = 'women-ethnic';
    SELECT id INTO v_dept_men   FROM public.departments WHERE slug = 'men-ethnic';
    SELECT id INTO v_dept_jewel FROM public.departments WHERE slug = 'jewellery';
    SELECT id INTO v_dept_home  FROM public.departments WHERE slug = 'home-living';

    INSERT INTO public.categories (department_id, name, slug, description, sort_order)
    VALUES
      (v_dept_women, 'Sarees',                    'sarees',            'Banarasi, Kanjeevaram, Chanderi, Organza and Silk Sarees', 1),
      (v_dept_women, 'Lehengas',                  'lehengas',          'Bridal, Festive and Reception Lehengas', 2),
      (v_dept_women, 'Salwar Suits & Anarkalis',  'suits',             'Anarkalis, Shararas, Ghararas and Straight Suits', 3),
      (v_dept_women, 'Kurtis & Tunics',           'kurtis',            'Cotton, Silk and Embroidered Everyday and Festive Kurtis', 4),
      (v_dept_men,   'Men''s Kurtas',             'men-kurtas',        'Chikankari, Silk and Linen Kurta Sets', 5),
      (v_dept_men,   'Sherwanis & Indo-Western',  'sherwanis',         'Wedding Sherwanis and Royal Indo-Western Suits', 6),
      (v_dept_men,   'Nehru & Bandhgala Jackets', 'nehru-jackets',     'Silk, Brocade and Modi Style Waistcoats', 7),
      (v_dept_jewel, 'Kundan & Polki Jewellery',  'kundan-jewellery',  'Bridal Chokers, Necklaces and Jhumkas', 8),
      (v_dept_jewel, 'Temple & Antique Jewellery','temple-jewellery',  'South Indian Antique Gold & Matte Finish Sets', 9),
      (v_dept_jewel, 'Mojaris & Juttis',          'juttis',            'Punjabi Juttis, Embroidered Mojaris and Kolhapuris', 10),
      (v_dept_home,  'Pooja Essentials',           'pooja-essentials',  'Brass Diyas, Pooja Thalis, Idols and Incense', 11),
      (v_dept_home,  'Home Décor & Furnishings',  'home-decor',        'Block-print Dohars, Cushion Covers and Blue Pottery', 12)
    ON CONFLICT (slug) DO NOTHING;
END $$;

-- 3. SHOWCASE SELLERS & CATALOGUE
DO $$
DECLARE
    -- Fixed UUIDs for reproducible dev/staging seeds
    v_admin_id   UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_seller1_id UUID := '11111111-1111-1111-1111-111111111111'::uuid;
    v_seller2_id UUID := '22222222-2222-2222-2222-222222222222'::uuid;
    v_seller3_id UUID := '33333333-3333-3333-3333-333333333333'::uuid;
    -- Category lookups
    v_cat_sarees UUID;
    v_cat_home   UUID;
    v_cat_pooja  UUID;
    -- Fixed product/variant UUIDs
    v_prod1_id UUID := 'aaaa1111-0000-0000-0000-000000000001'::uuid;
    v_prod2_id UUID := 'bbbb2222-0000-0000-0000-000000000002'::uuid;
    v_prod3_id UUID := 'cccc3333-0000-0000-0000-000000000003'::uuid;
    v_var1_id  UUID := 'aaaa1111-1111-0000-0000-000000000001'::uuid;
    v_var2_id  UUID := 'aaaa1111-2222-0000-0000-000000000002'::uuid;
    v_var3_id  UUID := 'bbbb2222-1111-0000-0000-000000000001'::uuid;
    v_var4_id  UUID := 'cccc3333-1111-0000-0000-000000000001'::uuid;
BEGIN
    -- -------------------------------------------------------------------------
    -- Provision admin user in auth.users (idempotent)
    -- -------------------------------------------------------------------------
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_admin_id,
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
    ) ON CONFLICT (id) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- Admin profile — role MUST be 'admin_super' (canonical user_role enum)
    -- -------------------------------------------------------------------------
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (v_admin_id, 'admin@indianshoppingmela.com.au', 'Priya Sharma (ISM Admin)', 'admin_super')
    ON CONFLICT (id) DO UPDATE SET role = 'admin_super';

    -- -------------------------------------------------------------------------
    -- Showcase seller records
    --   CRITICAL column fixes vs old seed:
    --     owner_id    (was user_id)
    --     legal_name  (was store_name)
    --     commission_rate NUMERIC(5,4) decimal (was commission_rate_pct INT 12)
    --     status 'APPROVED'  (was 'approved' — canonical enum is SCREAMING_SNAKE)
    --     dispatch_address / return_address as JSONB
    --     No seller_addresses table inserts (addresses embedded in sellers JSONB)
    -- -------------------------------------------------------------------------
    INSERT INTO public.sellers (
        id, owner_id, slug, business_name, legal_name, abn,
        about_text, commission_rate, status,
        dispatch_address, return_address,
        terms_accepted_at, terms_accepted_version
    ) VALUES
    (
        v_seller1_id, v_admin_id,
        'ananya-sarees', 'Ananya Sarees Sydney', 'Ananya Sarees Pty Ltd', '88123456789',
        'Boutique Banarasi, Kanjeevaram and Chanderi sarees curated directly from Varanasi and Kanchipuram master weavers.',
        0.10, 'APPROVED',
        '{"line1":"14 Wigram St","suburb":"Harris Park","state":"NSW","postcode":"2150","country":"AU"}'::jsonb,
        '{"line1":"14 Wigram St","suburb":"Harris Park","state":"NSW","postcode":"2150","country":"AU"}'::jsonb,
        NOW(), 'v1.1_2026'
    ),
    (
        v_seller2_id, v_admin_id,
        'royal-jaipur', 'Royal Jaipur Crafts Melbourne', 'Royal Jaipur Crafts Partnership', '77987654321',
        'Authentic Rajasthani hand block printed mulmul dohars, cushion covers, and blue pottery handcrafted by artisan families.',
        0.10, 'APPROVED',
        '{"line1":"250 Foster St","suburb":"Dandenong","state":"VIC","postcode":"3175","country":"AU"}'::jsonb,
        '{"line1":"250 Foster St","suburb":"Dandenong","state":"VIC","postcode":"3175","country":"AU"}'::jsonb,
        NOW(), 'v1.1_2026'
    ),
    (
        v_seller3_id, v_admin_id,
        'shreeji-collections', 'Shreeji Pooja & Brassware Brisbane', 'Shreeji Collections Sole Trader', '66543219876',
        'Heavy cast brass temple diyas, pooja thalis, incense burners, and festive sacred idols shipped Australia-wide.',
        0.10, 'APPROVED',
        '{"line1":"88 Logan Rd","suburb":"Woolloongabba","state":"QLD","postcode":"4102","country":"AU"}'::jsonb,
        '{"line1":"88 Logan Rd","suburb":"Woolloongabba","state":"QLD","postcode":"4102","country":"AU"}'::jsonb,
        NOW(), 'v1.1_2026'
    )
    ON CONFLICT (slug) DO NOTHING;

    -- -------------------------------------------------------------------------
    -- Lookup Category UUIDs
    -- -------------------------------------------------------------------------
    SELECT id INTO v_cat_sarees FROM public.categories WHERE slug = 'sarees'           LIMIT 1;
    SELECT id INTO v_cat_home   FROM public.categories WHERE slug = 'home-decor'       LIMIT 1;
    SELECT id INTO v_cat_pooja  FROM public.categories WHERE slug = 'pooja-essentials' LIMIT 1;

    -- =========================================================================
    -- PRODUCT 1: Varanasi Pure Katan Silk Banarasi Saree
    -- Seller: Ananya Sarees Sydney
    -- =========================================================================
    IF v_cat_sarees IS NOT NULL THEN
        INSERT INTO public.products (
            id, seller_id, category_id, title, slug, description,
            weight_kg, care_instructions, country_of_origin,
            return_eligible, status
        ) VALUES (
            v_prod1_id, v_seller1_id, v_cat_sarees,
            'Varanasi Pure Katan Silk Banarasi Saree',
            'varanasi-pure-katan-silk-banarasi-saree',
            'Handcrafted in Varanasi using ancient handloom jacquard weaving. Rich gold kadwa zari floral jaal with unstitched blouse piece. Pure Katan Silk Banarasi Saree with antique gold zari.',
            0.750, 'Dry Clean Only', 'India',
            TRUE, 'LIVE'
        ) ON CONFLICT (slug) DO NOTHING;

        -- Variants: seller_sku (not sku), sale_price (not compare_at_price)
        INSERT INTO public.product_variants (
            id, product_id, title, seller_sku,
            price, sale_price, stock_quantity, low_stock_threshold
        ) VALUES
        (
            v_var1_id, v_prod1_id,
            'Crimson Red / Free Size', 'ANA-BAN-RED-001',
            289.00, 349.00, 12, 3
        ),
        (
            v_var2_id, v_prod1_id,
            'Emerald Green / Free Size', 'ANA-BAN-GRN-002',
            289.00, 349.00, 8, 3
        )
        ON CONFLICT (product_id, seller_sku) DO NOTHING;

        INSERT INTO public.product_media (product_id, url, media_type, status, sort_order)
        VALUES
          (v_prod1_id, '/assets/p-kanjivaram.jpg', 'image', 'READY', 0)
        ON CONFLICT DO NOTHING;
    END IF;

    -- =========================================================================
    -- PRODUCT 2: Hand Block Printed Mulmul Cotton Dohar
    -- Seller: Royal Jaipur Crafts Melbourne
    -- =========================================================================
    IF v_cat_home IS NOT NULL THEN
        INSERT INTO public.products (
            id, seller_id, category_id, title, slug, description,
            weight_kg, care_instructions, country_of_origin,
            return_eligible, status
        ) VALUES (
            v_prod2_id, v_seller2_id, v_cat_home,
            'Hand Block Printed Mulmul Cotton Dohar',
            'hand-block-printed-mulmul-cotton-dohar',
            'Traditional Sanganeri hand block printed 3-layer AC blanket made of 100% breathable mulmul cotton. Sanganeri hand block printed mulmul cotton dohar.',
            1.200, 'Gentle Machine Wash', 'India',
            TRUE, 'LIVE'
        ) ON CONFLICT (slug) DO NOTHING;

        INSERT INTO public.product_variants (
            id, product_id, title, seller_sku,
            price, sale_price, stock_quantity, low_stock_threshold
        ) VALUES
        (
            v_var3_id, v_prod2_id,
            'Indigo Blue Floral / Queen Size', 'RJ-DOH-BLU-Q',
            89.00, 115.00, 25, 5
        )
        ON CONFLICT (product_id, seller_sku) DO NOTHING;

        INSERT INTO public.product_media (product_id, url, media_type, status, sort_order)
        VALUES
          (v_prod2_id, '/assets/p-dohar.jpg', 'image', 'READY', 0)
        ON CONFLICT DO NOTHING;
    END IF;

    -- =========================================================================
    -- PRODUCT 3: Handcrafted Brass Peacock Diya Stand
    -- Seller: Shreeji Pooja & Brassware Brisbane
    -- =========================================================================
    IF v_cat_pooja IS NOT NULL THEN
        INSERT INTO public.products (
            id, seller_id, category_id, title, slug, description,
            weight_kg, care_instructions, country_of_origin,
            return_eligible, status
        ) VALUES (
            v_prod3_id, v_seller3_id, v_cat_pooja,
            'Handcrafted Brass Peacock Diya Stand',
            'handcrafted-brass-peacock-diya-stand',
            'Solid cast brass traditional temple diya with intricate peacock finial. Perfect for mandir, Diwali and housewarming pooja. Solid cast brass traditional temple diya with peacock finial.',
            0.900, 'Wipe with Dry Cloth, Brass Polish', 'India',
            TRUE, 'LIVE'
        ) ON CONFLICT (slug) DO NOTHING;

        INSERT INTO public.product_variants (
            id, product_id, title, seller_sku,
            price, sale_price, stock_quantity, low_stock_threshold
        ) VALUES
        (
            v_var4_id, v_prod3_id,
            'Antique Gold / 28cm Stand', 'SHR-DIYA-PEA-28',
            79.00, 99.00, 18, 3
        )
        ON CONFLICT (product_id, seller_sku) DO NOTHING;

        INSERT INTO public.product_media (product_id, url, media_type, status, sort_order)
        VALUES
          (v_prod3_id, '/assets/p-diyas.jpg', 'image', 'READY', 0)
        ON CONFLICT DO NOTHING;
    END IF;

    -- =========================================================================
    -- 4. AUTHORITATIVE MARKETPLACE OPERATIONAL SETTINGS
    --    Schema fix: uses (config_key, config_value) with UUID PK
    --    (was key TEXT PK with value JSONB in old seed)
    -- =========================================================================
    INSERT INTO public.marketplace_configs (config_key, config_value, description, version)
    VALUES
      (
        'return_window_days',
        '7'::jsonb,
        'Ordinary change-of-mind return window in calendar days from delivery (ACL compliant)',
        1
      ),
      (
        'payout_delay_days',
        '14'::jsonb,
        'Maturity delay in calendar days from delivery before seller payout is released',
        1
      ),
      (
        'default_commission_rate',
        '0.10'::jsonb,
        'Default platform commission as a decimal fraction (0.10 = 10%). Applied to gross item value.',
        1
      ),
      (
        'seller_dispatch_sla_hours',
        '48'::jsonb,
        'Standard seller dispatch SLA in hours from order placement',
        1
      ),
      (
        'media_limits',
        '{"max_images": 8, "max_image_mb": 10, "max_video_mb": 50, "max_video_seconds": 60}'::jsonb,
        'Product image and video upload constraints',
        1
      ),
      (
        'import_limits',
        '{"max_rows_per_batch": 1000, "supported_formats": ["csv", "xlsx"]}'::jsonb,
        'Bulk spreadsheet import constraints',
        1
      ),
      (
        'policy_versions',
        '{"terms": "v1.0_2026", "privacy": "v1.0_2026", "seller_agreement": "v1.1_2026", "returns": "v1.2_2026"}'::jsonb,
        'Current active legal terms & policy versions',
        1
      ),
      (
        'gst_rate',
        '0.10'::jsonb,
        'Australian GST rate as a decimal fraction (0.10 = 10%). GST is 1/11th of GST-inclusive price.',
        1
      )
    ON CONFLICT (config_key) DO UPDATE SET
      config_value = EXCLUDED.config_value,
      description  = EXCLUDED.description,
      updated_at   = NOW();

END $$;
