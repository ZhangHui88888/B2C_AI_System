-- Sample Data for Testing
-- Run this after 001_initial_schema.sql and 002_rls_policies.sql
-- Multi-brand support: All data is associated with a brand

-- ============================================
-- SAMPLE BRANDS (创建2-3个测试品牌)
-- ============================================
INSERT INTO brands (name, slug, domain, owner_email, settings) VALUES
(
    'TechGear Store',
    'techgear',
    'techgear.example.com',
    'admin@techgear.com',
    '{"theme": "dark", "currency": "USD", "language": "en"}'
),
(
    'Beauty Essentials',
    'beauty-essentials',
    'beauty.example.com',
    'admin@beauty.com',
    '{"theme": "light", "currency": "USD", "language": "en"}'
),
(
    'Fitness Pro',
    'fitness-pro',
    'fitness.example.com',
    'admin@fitness.com',
    '{"theme": "sporty", "currency": "USD", "language": "en"}'
);

-- ============================================
-- SAMPLE CATEGORIES (每个品牌有自己的分类)
-- ============================================
-- TechGear Store categories
INSERT INTO categories (brand_id, name, slug, description, sort_order) VALUES
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'Electronics', 'electronics', 'Latest gadgets and electronic devices', 1),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'Accessories', 'accessories', 'Phone and computer accessories', 2),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'Audio', 'audio', 'Headphones, speakers, and audio gear', 3);

-- Beauty Essentials categories
INSERT INTO categories (brand_id, name, slug, description, sort_order) VALUES
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'Skincare', 'skincare', 'Face and body skincare products', 1),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'Makeup', 'makeup', 'Cosmetics and makeup products', 2),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'Hair Care', 'hair-care', 'Shampoos, conditioners, and treatments', 3);

-- Fitness Pro categories
INSERT INTO categories (brand_id, name, slug, description, sort_order) VALUES
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'Yoga', 'yoga', 'Yoga mats, blocks, and accessories', 1),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'Gym Equipment', 'gym-equipment', 'Home gym and workout gear', 2),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'Activewear', 'activewear', 'Sports clothing and apparel', 3);

-- ============================================
-- SAMPLE PRODUCTS (每个品牌有自己的产品)
-- ============================================

-- TechGear Store products
INSERT INTO products (
    brand_id, name, slug, description, short_description, 
    price, compare_price, cost,
    category_id, is_featured, stock_status,
    seo_title, seo_description
) VALUES
(
    (SELECT id FROM brands WHERE slug = 'techgear'),
    'Wireless Bluetooth Earbuds',
    'wireless-bluetooth-earbuds',
    'Experience premium sound quality with our wireless Bluetooth earbuds. Features include active noise cancellation, 30-hour battery life, and IPX5 water resistance.',
    'Premium wireless earbuds with ANC and 30-hour battery',
    49.99, 79.99, 15.00,
    (SELECT c.id FROM categories c JOIN brands b ON c.brand_id = b.id WHERE b.slug = 'techgear' AND c.slug = 'audio'),
    true, 'in_stock',
    'Wireless Bluetooth Earbuds with ANC | Free Shipping',
    'Premium wireless earbuds with active noise cancellation, 30-hour battery life, and water resistance.'
),
(
    (SELECT id FROM brands WHERE slug = 'techgear'),
    'Smart Watch Fitness Tracker',
    'smart-watch-fitness-tracker',
    'Track your fitness goals with our advanced smartwatch. Features heart rate monitoring, GPS, sleep tracking, and 7-day battery life.',
    'Advanced fitness smartwatch with GPS and heart rate',
    89.99, 129.99, 28.00,
    (SELECT c.id FROM categories c JOIN brands b ON c.brand_id = b.id WHERE b.slug = 'techgear' AND c.slug = 'electronics'),
    true, 'in_stock',
    'Smart Watch Fitness Tracker | Heart Rate & GPS',
    'Advanced smartwatch with fitness tracking, GPS, and 7-day battery.'
);

-- Beauty Essentials products
INSERT INTO products (
    brand_id, name, slug, description, short_description, 
    price, compare_price, cost,
    category_id, is_featured, stock_status,
    seo_title, seo_description
) VALUES
(
    (SELECT id FROM brands WHERE slug = 'beauty-essentials'),
    'Vitamin C Serum',
    'vitamin-c-serum',
    'Brighten and rejuvenate your skin with our powerful Vitamin C serum. Contains 20% Vitamin C, Hyaluronic Acid, and Vitamin E.',
    'Powerful brightening serum with 20% Vitamin C',
    34.99, 44.99, 10.00,
    (SELECT c.id FROM categories c JOIN brands b ON c.brand_id = b.id WHERE b.slug = 'beauty-essentials' AND c.slug = 'skincare'),
    true, 'in_stock',
    'Vitamin C Brightening Serum | Anti-Aging Skincare',
    'Professional-grade Vitamin C serum for brighter, younger-looking skin.'
),
(
    (SELECT id FROM brands WHERE slug = 'beauty-essentials'),
    'Hydrating Face Moisturizer',
    'hydrating-face-moisturizer',
    'Deep hydration for all skin types. Contains hyaluronic acid, ceramides, and natural plant extracts for 24-hour moisture.',
    'Deep hydrating moisturizer for all skin types',
    28.99, 39.99, 8.00,
    (SELECT c.id FROM categories c JOIN brands b ON c.brand_id = b.id WHERE b.slug = 'beauty-essentials' AND c.slug = 'skincare'),
    true, 'in_stock',
    'Hydrating Face Moisturizer | 24-Hour Moisture',
    'Deep hydration moisturizer with hyaluronic acid for all skin types.'
);

-- Fitness Pro products
INSERT INTO products (
    brand_id, name, slug, description, short_description, 
    price, compare_price, cost,
    category_id, is_featured, stock_status,
    seo_title, seo_description
) VALUES
(
    (SELECT id FROM brands WHERE slug = 'fitness-pro'),
    'Premium Yoga Mat',
    'premium-yoga-mat',
    'Non-slip premium yoga mat with extra cushioning for joint protection. Made from eco-friendly TPE material. Includes carrying strap.',
    'Eco-friendly non-slip yoga mat with carrying strap',
    45.99, 65.99, 14.00,
    (SELECT c.id FROM categories c JOIN brands b ON c.brand_id = b.id WHERE b.slug = 'fitness-pro' AND c.slug = 'yoga'),
    true, 'in_stock',
    'Premium Yoga Mat | Non-Slip & Eco-Friendly',
    'Extra cushioned yoga mat made from eco-friendly materials.'
),
(
    (SELECT id FROM brands WHERE slug = 'fitness-pro'),
    'Resistance Bands Set',
    'resistance-bands-set',
    'Complete set of 5 resistance bands with different resistance levels. Perfect for home workouts, physical therapy, and strength training.',
    '5-piece resistance bands set for all fitness levels',
    24.99, 34.99, 7.00,
    (SELECT c.id FROM categories c JOIN brands b ON c.brand_id = b.id WHERE b.slug = 'fitness-pro' AND c.slug = 'gym-equipment'),
    true, 'in_stock',
    'Resistance Bands Set | 5 Levels',
    'Complete resistance bands set for home workouts and strength training.'
);

-- ============================================
-- SAMPLE KNOWLEDGE BASE (每个品牌有自己的知识库)
-- ============================================

-- TechGear Store knowledge base
INSERT INTO knowledge_base (brand_id, content, metadata) VALUES
(
    (SELECT id FROM brands WHERE slug = 'techgear'),
    'Shipping Information: We offer free standard shipping on orders over $50. Standard shipping takes 5-7 business days. Express shipping (2-3 days) is available for $12.99.',
    '{"category": "shipping", "keywords": ["shipping", "delivery", "free shipping", "express"]}'
),
(
    (SELECT id FROM brands WHERE slug = 'techgear'),
    'Return Policy: We accept returns within 30 days of delivery. Items must be unused and in original packaging. Refunds are processed within 5-7 business days.',
    '{"category": "returns", "keywords": ["return", "refund", "exchange", "money back"]}'
),
(
    (SELECT id FROM brands WHERE slug = 'techgear'),
    'Product Warranty: All electronics come with a 1-year manufacturer warranty. Extended warranty options are available at checkout.',
    '{"category": "warranty", "keywords": ["warranty", "guarantee", "defect", "broken"]}'
);

-- Beauty Essentials knowledge base
INSERT INTO knowledge_base (brand_id, content, metadata) VALUES
(
    (SELECT id FROM brands WHERE slug = 'beauty-essentials'),
    'Shipping: Free shipping on all orders over $35. Standard delivery takes 3-5 business days.',
    '{"category": "shipping", "keywords": ["shipping", "delivery", "free shipping"]}'
),
(
    (SELECT id FROM brands WHERE slug = 'beauty-essentials'),
    'Our skincare products are cruelty-free, paraben-free, and suitable for sensitive skin. All ingredients are listed on product pages.',
    '{"category": "ingredients", "keywords": ["ingredients", "cruelty-free", "paraben", "sensitive skin"]}'
);

-- Fitness Pro knowledge base
INSERT INTO knowledge_base (brand_id, content, metadata) VALUES
(
    (SELECT id FROM brands WHERE slug = 'fitness-pro'),
    'Free shipping on orders over $75. Most items ship within 1-2 business days.',
    '{"category": "shipping", "keywords": ["shipping", "delivery", "free shipping"]}'
),
(
    (SELECT id FROM brands WHERE slug = 'fitness-pro'),
    'All fitness equipment comes with a 2-year warranty. Yoga mats have a 90-day satisfaction guarantee.',
    '{"category": "warranty", "keywords": ["warranty", "guarantee", "return"]}'
);

-- ============================================
-- SAMPLE SETTINGS (每个品牌有自己的设置)
-- ============================================

-- TechGear Store settings
INSERT INTO settings (brand_id, key, value) VALUES
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'ai_enabled', 'true'),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'ai_fallback_message', '"Thank you for your message! Our tech support team will respond shortly."'),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'ai_system_prompt', '"You are a helpful tech support assistant for TechGear Store. Help customers with product questions, orders, and technical issues."'),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'store_name', '"TechGear Store"'),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'store_email', '"support@techgear.com"'),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'currency', '"USD"'),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'shipping_default_cost', '9.99'),
    ((SELECT id FROM brands WHERE slug = 'techgear'), 'shipping_free_threshold', '50');

-- Beauty Essentials settings
INSERT INTO settings (brand_id, key, value) VALUES
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'ai_enabled', 'true'),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'ai_fallback_message', '"Thank you for reaching out! Our beauty experts will get back to you soon."'),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'ai_system_prompt', '"You are a friendly beauty consultant for Beauty Essentials. Help customers find the right skincare products for their needs."'),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'store_name', '"Beauty Essentials"'),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'store_email', '"hello@beauty.com"'),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'currency', '"USD"'),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'shipping_default_cost', '5.99'),
    ((SELECT id FROM brands WHERE slug = 'beauty-essentials'), 'shipping_free_threshold', '35');

-- Fitness Pro settings
INSERT INTO settings (brand_id, key, value) VALUES
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'ai_enabled', 'true'),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'ai_fallback_message', '"Thanks for your message! Our fitness team will respond shortly."'),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'ai_system_prompt', '"You are a fitness advisor for Fitness Pro. Help customers choose the right equipment and answer workout-related questions."'),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'store_name', '"Fitness Pro"'),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'store_email', '"support@fitness.com"'),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'currency', '"USD"'),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'shipping_default_cost', '12.99'),
    ((SELECT id FROM brands WHERE slug = 'fitness-pro'), 'shipping_free_threshold', '75');
