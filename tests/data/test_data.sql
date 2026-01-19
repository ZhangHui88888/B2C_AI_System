-- ============================================
-- B2C AI System 完整测试数据
-- 执行顺序：直接在 Supabase SQL Editor 运行
-- ============================================

-- 清理现有测试数据（谨慎使用）
-- DELETE FROM orders WHERE brand_id IN (SELECT id FROM brands WHERE slug = 'cmsbike-test');
-- DELETE FROM products WHERE brand_id IN (SELECT id FROM brands WHERE slug = 'cmsbike-test');
-- DELETE FROM categories WHERE brand_id IN (SELECT id FROM brands WHERE slug = 'cmsbike-test');
-- DELETE FROM brands WHERE slug = 'cmsbike-test';

-- ============================================
-- 1. 测试品牌
-- ============================================
INSERT INTO brands (name, slug, domain, owner_email, logo_url, settings, is_active) VALUES
(
    'CMSBike Test',
    'cmsbike-test',
    'xk-truck.cn',
    '652364972@qq.com',
    'https://via.placeholder.com/200x50?text=CMSBike',
    '{
        "theme": "modern",
        "currency": "GBP",
        "language": "en",
        "primary_color": "#3B82F6",
        "secondary_color": "#10B981"
    }',
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    domain = EXCLUDED.domain,
    owner_email = EXCLUDED.owner_email,
    settings = EXCLUDED.settings,
    is_active = EXCLUDED.is_active;

-- 获取品牌 ID
DO $$
DECLARE
    v_brand_id UUID;
    v_cat_ebikes UUID;
    v_cat_accessories UUID;
    v_cat_parts UUID;
BEGIN
    SELECT id INTO v_brand_id FROM brands WHERE slug = 'cmsbike-test';

    -- ============================================
    -- 2. 测试分类
    -- ============================================
    INSERT INTO categories (brand_id, name, slug, description, image_url, sort_order, is_active) VALUES
    (v_brand_id, 'Electric Bikes', 'electric-bikes', 'High-performance electric bicycles for city commuting and adventure', 'https://via.placeholder.com/400x300?text=E-Bikes', 1, true),
    (v_brand_id, 'Accessories', 'accessories', 'Bike accessories including helmets, lights, locks and more', 'https://via.placeholder.com/400x300?text=Accessories', 2, true),
    (v_brand_id, 'Spare Parts', 'spare-parts', 'Replacement parts and components for bike maintenance', 'https://via.placeholder.com/400x300?text=Parts', 3, true)
    ON CONFLICT (brand_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        image_url = EXCLUDED.image_url,
        sort_order = EXCLUDED.sort_order;

    -- 获取分类 ID
    SELECT id INTO v_cat_ebikes FROM categories WHERE brand_id = v_brand_id AND slug = 'electric-bikes';
    SELECT id INTO v_cat_accessories FROM categories WHERE brand_id = v_brand_id AND slug = 'accessories';
    SELECT id INTO v_cat_parts FROM categories WHERE brand_id = v_brand_id AND slug = 'spare-parts';

    -- ============================================
    -- 3. 测试产品
    -- ============================================
    
    -- 电动自行车产品
    INSERT INTO products (brand_id, name, slug, description, short_description, price, compare_price, cost, main_image_url, images, category_id, is_featured, is_active, stock_status, seo_title, seo_description, shipping_weight, shipping_time) VALUES
    (
        v_brand_id,
        'Urban Commuter E-Bike',
        'urban-commuter-ebike',
        'The perfect electric bike for city commuting. Features a powerful 500W motor, 48V 13Ah battery with 60-mile range, hydraulic disc brakes, and integrated lights. Lightweight aluminum frame weighs only 22kg.',
        'Powerful 500W city e-bike with 60-mile range',
        1299.99, 1599.99, 650.00,
        'https://via.placeholder.com/800x600?text=Urban+E-Bike',
        ARRAY['https://via.placeholder.com/800x600?text=E-Bike+Side', 'https://via.placeholder.com/800x600?text=E-Bike+Front', 'https://via.placeholder.com/800x600?text=E-Bike+Detail'],
        v_cat_ebikes,
        true, true, 'in_stock',
        'Urban Commuter E-Bike | 500W Motor | Free UK Delivery',
        'High-performance urban e-bike with 500W motor and 60-mile range. Perfect for city commuting. Free UK delivery.',
        22.0, '3-5 business days'
    ),
    (
        v_brand_id,
        'Mountain Explorer E-Bike',
        'mountain-explorer-ebike',
        'Conquer any terrain with our Mountain Explorer. Features 750W mid-drive motor, full suspension, 48V 17.5Ah battery with 80-mile range, and Shimano 9-speed gears. Built for adventure.',
        'Off-road e-bike with 750W motor and full suspension',
        1899.99, 2299.99, 950.00,
        'https://via.placeholder.com/800x600?text=Mountain+E-Bike',
        ARRAY['https://via.placeholder.com/800x600?text=MTB+Side', 'https://via.placeholder.com/800x600?text=MTB+Action'],
        v_cat_ebikes,
        true, true, 'in_stock',
        'Mountain Explorer E-Bike | 750W Mid-Drive | Full Suspension',
        'Powerful mountain e-bike with 750W mid-drive motor and full suspension. 80-mile range for epic adventures.',
        28.0, '5-7 business days'
    ),
    (
        v_brand_id,
        'Folding City E-Bike',
        'folding-city-ebike',
        'Compact and portable folding e-bike. 350W motor, 36V 10Ah battery with 35-mile range. Folds in 15 seconds for easy storage and transport. Perfect for mixed commutes.',
        'Compact folding e-bike for easy transport',
        899.99, 1099.99, 450.00,
        'https://via.placeholder.com/800x600?text=Folding+E-Bike',
        ARRAY['https://via.placeholder.com/800x600?text=Folded', 'https://via.placeholder.com/800x600?text=Unfolded'],
        v_cat_ebikes,
        false, true, 'low_stock',
        'Folding City E-Bike | Portable | 35-Mile Range',
        'Compact folding e-bike that folds in 15 seconds. 350W motor with 35-mile range. Perfect for commuters.',
        18.0, '2-4 business days'
    )
    ON CONFLICT (brand_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        compare_price = EXCLUDED.compare_price,
        is_featured = EXCLUDED.is_featured,
        stock_status = EXCLUDED.stock_status;

    -- 配件产品
    INSERT INTO products (brand_id, name, slug, description, short_description, price, compare_price, cost, main_image_url, category_id, is_featured, is_active, stock_status, seo_title, seo_description, shipping_weight, shipping_time) VALUES
    (
        v_brand_id,
        'Smart Bike Helmet',
        'smart-bike-helmet',
        'Advanced safety helmet with integrated LED lights, turn signals, and Bluetooth speaker. MIPS protection technology. Fits head sizes 54-62cm.',
        'LED helmet with turn signals and Bluetooth',
        149.99, 189.99, 55.00,
        'https://via.placeholder.com/800x600?text=Smart+Helmet',
        v_cat_accessories,
        true, true, 'in_stock',
        'Smart Bike Helmet | LED Lights | Bluetooth',
        'Advanced bike helmet with integrated LED lights, turn signals, and Bluetooth speaker. MIPS protection.',
        0.8, '2-3 business days'
    ),
    (
        v_brand_id,
        'Heavy Duty Bike Lock',
        'heavy-duty-bike-lock',
        '16mm hardened steel U-lock with 1.2m cable. Sold Secure Gold rated. Includes 3 keys and mounting bracket.',
        '16mm steel U-lock - Sold Secure Gold',
        79.99, 99.99, 28.00,
        'https://via.placeholder.com/800x600?text=Bike+Lock',
        v_cat_accessories,
        false, true, 'in_stock',
        'Heavy Duty Bike Lock | Sold Secure Gold | U-Lock',
        'Heavy duty 16mm U-lock with Sold Secure Gold rating. Keep your bike safe.',
        1.2, '2-3 business days'
    )
    ON CONFLICT (brand_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price;

    -- 零配件产品
    INSERT INTO products (brand_id, name, slug, description, short_description, price, compare_price, cost, main_image_url, category_id, is_featured, is_active, stock_status, seo_title, seo_description, shipping_weight, shipping_time) VALUES
    (
        v_brand_id,
        'E-Bike Battery Pack 48V 13Ah',
        'ebike-battery-48v-13ah',
        'Replacement battery pack for most 48V e-bikes. Samsung cells, 13Ah capacity, BMS protection. Compatible with Urban Commuter and similar models.',
        '48V 13Ah replacement battery - Samsung cells',
        399.99, 499.99, 180.00,
        'https://via.placeholder.com/800x600?text=Battery+Pack',
        v_cat_parts,
        false, true, 'in_stock',
        'E-Bike Battery 48V 13Ah | Samsung Cells | Replacement',
        'High-quality 48V 13Ah replacement battery with Samsung cells. BMS protection included.',
        3.5, '3-5 business days'
    )
    ON CONFLICT (brand_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price = EXCLUDED.price;

END $$;

-- ============================================
-- 4. 测试优惠券
-- ============================================
INSERT INTO coupons (brand_id, code, description, type, value, min_order_amount, usage_limit, usage_count, starts_at, expires_at, status)
SELECT 
    b.id,
    'WELCOME10',
    '10% off your first order',
    'percentage',
    10.00,
    50.00,
    1000,
    0,
    NOW(),
    NOW() + INTERVAL '1 year',
    'active'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, code) DO NOTHING;

INSERT INTO coupons (brand_id, code, description, type, value, min_order_amount, usage_limit, usage_count, starts_at, expires_at, status)
SELECT 
    b.id,
    'SUMMER50',
    '£50 off orders over £500',
    'fixed_amount',
    50.00,
    500.00,
    100,
    0,
    NOW(),
    NOW() + INTERVAL '3 months',
    'active'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, code) DO NOTHING;

-- ============================================
-- 5. 测试订单
-- ============================================
INSERT INTO orders (brand_id, order_number, customer_email, customer_name, customer_phone, shipping_address, items, subtotal, shipping_cost, discount_amount, total, status, notes)
SELECT 
    b.id,
    'ORD-TEST-001',
    'customer1@test.com',
    'John Smith',
    '+44 7700 900123',
    '{"line1": "123 High Street", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}'::jsonb,
    ('[{"product_id": "' || p.id || '", "name": "Urban Commuter E-Bike", "price": 1299.99, "quantity": 1}]')::jsonb,
    1299.99,
    0.00,
    0.00,
    1299.99,
    'paid',
    'Test order - paid'
FROM brands b, products p 
WHERE b.slug = 'cmsbike-test' AND p.slug = 'urban-commuter-ebike' AND p.brand_id = b.id
ON CONFLICT DO NOTHING;

INSERT INTO orders (brand_id, order_number, customer_email, customer_name, customer_phone, shipping_address, items, subtotal, shipping_cost, discount_amount, total, status, tracking_number, notes)
SELECT 
    b.id,
    'ORD-TEST-002',
    'customer2@test.com',
    'Jane Doe',
    '+44 7700 900456',
    '{"line1": "456 Oak Avenue", "city": "Manchester", "postcode": "M1 1AA", "country": "UK"}'::jsonb,
    ('[{"product_id": "' || p.id || '", "name": "Smart Bike Helmet", "price": 149.99, "quantity": 2}]')::jsonb,
    299.98,
    9.99,
    0.00,
    309.97,
    'shipped',
    'TRK123456789',
    'Test order - shipped'
FROM brands b, products p 
WHERE b.slug = 'cmsbike-test' AND p.slug = 'smart-bike-helmet' AND p.brand_id = b.id
ON CONFLICT DO NOTHING;

INSERT INTO orders (brand_id, order_number, customer_email, customer_name, customer_phone, shipping_address, items, subtotal, shipping_cost, discount_amount, total, status, notes)
SELECT 
    b.id,
    'ORD-TEST-003',
    'customer3@test.com',
    'Bob Wilson',
    '+44 7700 900789',
    '{"line1": "789 Park Lane", "city": "Birmingham", "postcode": "B1 1AA", "country": "UK"}'::jsonb,
    ('[{"product_id": "' || p.id || '", "name": "Mountain Explorer E-Bike", "price": 1899.99, "quantity": 1}]')::jsonb,
    1899.99,
    0.00,
    50.00,
    1849.99,
    'pending',
    'Test order - pending with discount'
FROM brands b, products p 
WHERE b.slug = 'cmsbike-test' AND p.slug = 'mountain-explorer-ebike' AND p.brand_id = b.id
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. 测试客户
-- ============================================
INSERT INTO customers (brand_id, email, name, phone, total_orders, total_spent, first_order_at, last_order_at)
SELECT 
    b.id,
    'customer1@test.com',
    'John Smith',
    '+44 7700 900123',
    1,
    1299.99,
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '7 days'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, email) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_spent = EXCLUDED.total_spent;

INSERT INTO customers (brand_id, email, name, phone, total_orders, total_spent, first_order_at, last_order_at)
SELECT 
    b.id,
    'customer2@test.com',
    'Jane Doe',
    '+44 7700 900456',
    3,
    899.97,
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '2 days'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, email) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_spent = EXCLUDED.total_spent;

-- ============================================
-- 7. 测试知识库
-- ============================================
INSERT INTO knowledge_base (brand_id, content, metadata)
SELECT 
    b.id,
    'Shipping Information: We offer FREE UK delivery on all e-bikes. Accessories ship free on orders over £50. Standard delivery takes 3-5 business days. Express next-day delivery available for £14.99.',
    '{"category": "shipping", "keywords": ["shipping", "delivery", "free delivery", "next day"]}'
FROM brands b WHERE b.slug = 'cmsbike-test';

INSERT INTO knowledge_base (brand_id, content, metadata)
SELECT 
    b.id,
    'Return Policy: 30-day money-back guarantee on all products. E-bikes can be returned within 14 days if unused. Items must be in original packaging. We cover return shipping costs for faulty items.',
    '{"category": "returns", "keywords": ["return", "refund", "money back", "exchange"]}'
FROM brands b WHERE b.slug = 'cmsbike-test';

INSERT INTO knowledge_base (brand_id, content, metadata)
SELECT 
    b.id,
    'Warranty: All e-bikes come with a 2-year manufacturer warranty covering motor, battery, and frame. Accessories have 1-year warranty. Extended 3-year warranty available for £99.',
    '{"category": "warranty", "keywords": ["warranty", "guarantee", "repair", "coverage"]}'
FROM brands b WHERE b.slug = 'cmsbike-test';

INSERT INTO knowledge_base (brand_id, content, metadata)
SELECT 
    b.id,
    'Battery Care: To maximize battery life, charge after each use but avoid keeping it at 100% for extended periods. Store in a cool, dry place. Ideal storage charge is 50-80%. Expect 500-800 charge cycles.',
    '{"category": "maintenance", "keywords": ["battery", "charging", "maintenance", "care"]}'
FROM brands b WHERE b.slug = 'cmsbike-test';

-- ============================================
-- 8. 测试设置
-- ============================================
INSERT INTO settings (brand_id, key, value)
SELECT b.id, 'store_name', '"CMSBike Test Store"'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (brand_id, key, value)
SELECT b.id, 'store_email', '"test@xk-truck.cn"'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (brand_id, key, value)
SELECT b.id, 'currency', '"GBP"'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (brand_id, key, value)
SELECT b.id, 'shipping_default_cost', '9.99'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (brand_id, key, value)
SELECT b.id, 'shipping_free_threshold', '50'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (brand_id, key, value)
SELECT b.id, 'ai_enabled', 'true'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO settings (brand_id, key, value)
SELECT b.id, 'ai_system_prompt', '"You are a helpful e-bike expert for CMSBike. Help customers choose the right e-bike, answer technical questions, and provide information about orders and shipping."'
FROM brands b WHERE b.slug = 'cmsbike-test'
ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================
-- 9. 测试评论
-- ============================================
INSERT INTO reviews (brand_id, product_id, reviewer_name, reviewer_email, rating, title, content, is_verified_purchase, status)
SELECT 
    b.id,
    p.id,
    'John S.',
    'customer1@test.com',
    5,
    'Excellent commuter bike!',
    'Been using this for my daily commute for 3 months now. Battery lasts the whole week. Motor is powerful enough for hills. Highly recommend!',
    true,
    'approved'
FROM brands b, products p 
WHERE b.slug = 'cmsbike-test' AND p.slug = 'urban-commuter-ebike' AND p.brand_id = b.id;

INSERT INTO reviews (brand_id, product_id, reviewer_name, reviewer_email, rating, title, content, is_verified_purchase, status)
SELECT 
    b.id,
    p.id,
    'Sarah M.',
    'sarah@test.com',
    4,
    'Great value for money',
    'Good quality bike at a reasonable price. Only minor issue is the seat could be more comfortable. Otherwise very happy.',
    true,
    'approved'
FROM brands b, products p 
WHERE b.slug = 'cmsbike-test' AND p.slug = 'urban-commuter-ebike' AND p.brand_id = b.id;

INSERT INTO reviews (brand_id, product_id, reviewer_name, reviewer_email, rating, title, content, is_verified_purchase, status)
SELECT 
    b.id,
    p.id,
    'Mike T.',
    'mike@test.com',
    5,
    'Perfect for off-road adventures',
    'Took this on a week-long trip through the Lake District. Amazing performance on rough terrain. Battery lasted longer than expected.',
    true,
    'approved'
FROM brands b, products p 
WHERE b.slug = 'cmsbike-test' AND p.slug = 'mountain-explorer-ebike' AND p.brand_id = b.id;

-- ============================================
-- 10. 管理员用户
-- ============================================
-- 注意：admin_users 需要关联 Supabase Auth 用户
-- 请通过后台登录自动创建，或手动执行以下 SQL（替换 YOUR_AUTH_USER_ID）：
-- 
-- INSERT INTO admin_users (auth_user_id, email, name, role, brand_ids, is_active)
-- VALUES (
--     'YOUR_AUTH_USER_ID',  -- 从 Supabase Auth -> Users 获取
--     '652364972@qq.com',
--     'Super Admin',
--     'super_admin',
--     '{}',
--     true
-- )
-- ON CONFLICT (email) DO UPDATE SET
--     role = 'super_admin',
--     is_active = true;

-- ============================================
-- 验证数据
-- ============================================
DO $$
DECLARE
    v_brand_count INTEGER;
    v_category_count INTEGER;
    v_product_count INTEGER;
    v_order_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_brand_count FROM brands WHERE slug = 'cmsbike-test';
    SELECT COUNT(*) INTO v_category_count FROM categories c JOIN brands b ON c.brand_id = b.id WHERE b.slug = 'cmsbike-test';
    SELECT COUNT(*) INTO v_product_count FROM products p JOIN brands b ON p.brand_id = b.id WHERE b.slug = 'cmsbike-test';
    SELECT COUNT(*) INTO v_order_count FROM orders o JOIN brands b ON o.brand_id = b.id WHERE b.slug = 'cmsbike-test';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Test Data Import Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Brands: %', v_brand_count;
    RAISE NOTICE 'Categories: %', v_category_count;
    RAISE NOTICE 'Products: %', v_product_count;
    RAISE NOTICE 'Orders: %', v_order_count;
    RAISE NOTICE '========================================';
END $$;
