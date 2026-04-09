-- ============================================
-- CMSBike 产品图片更新 SQL
-- 将 R2 图片 URL 关联到产品
-- 同时更新 main_image_url 和 images 字段
-- ============================================

-- R2 公开访问基础 URL
-- https://assets.cmsbike.uk

-- 更新电动车产品 (E-Bike)
UPDATE products 
SET 
  main_image_url = 'https://assets.cmsbike.uk/ebike-16/side-view.jpg',
  images = ARRAY[
    'https://assets.cmsbike.uk/ebike-16/side-view.jpg',
    'https://assets.cmsbike.uk/ebike-16/hero-folding.jpg',
    'https://assets.cmsbike.uk/ebike-16/lifestyle-charging.jpg',
    'https://assets.cmsbike.uk/ebike-16/product-hero.jpg',
    'https://assets.cmsbike.uk/ebike-16/detail-sensor-tire.jpg'
  ]
WHERE (name ILIKE '%e-bike%' OR name ILIKE '%electric%' OR slug LIKE '%ebike%')
AND brand_id = (SELECT id FROM brands WHERE slug IN ('cmsbike', 'cmsbike-test') LIMIT 1);

-- 更新折叠自行车产品 (Folding)
UPDATE products 
SET 
  main_image_url = 'https://assets.cmsbike.uk/14-inch/black-side.jpg',
  images = ARRAY[
    'https://assets.cmsbike.uk/14-inch/black-side.jpg',
    'https://assets.cmsbike.uk/14-inch/gray-side.jpg',
    'https://assets.cmsbike.uk/14-inch/detail-derailleur.jpg',
    'https://assets.cmsbike.uk/14-inch/detail-disc-brake.jpg'
  ]
WHERE name ILIKE '%folding%'
AND brand_id = (SELECT id FROM brands WHERE slug IN ('cmsbike', 'cmsbike-test') LIMIT 1);

-- 更新配件产品 (Helmet, Lock, Battery)
UPDATE products 
SET 
  main_image_url = 'https://assets.cmsbike.uk/14-inch/black-side.jpg',
  images = ARRAY['https://assets.cmsbike.uk/14-inch/black-side.jpg']
WHERE (name ILIKE '%helmet%' OR name ILIKE '%lock%' OR name ILIKE '%battery%')
AND brand_id = (SELECT id FROM brands WHERE slug IN ('cmsbike', 'cmsbike-test') LIMIT 1);

-- 为所有还使用占位符的产品设置默认图片
UPDATE products 
SET 
  main_image_url = 'https://assets.cmsbike.uk/14-inch/black-side.jpg',
  images = ARRAY['https://assets.cmsbike.uk/14-inch/black-side.jpg']
WHERE brand_id = (SELECT id FROM brands WHERE slug IN ('cmsbike', 'cmsbike-test') LIMIT 1)
AND (main_image_url IS NULL OR main_image_url LIKE '%placeholder%' OR main_image_url LIKE '%via.placeholder%');

-- 验证更新结果
SELECT name, slug, main_image_url, images FROM products 
WHERE brand_id = (SELECT id FROM brands WHERE slug IN ('cmsbike', 'cmsbike-test') LIMIT 1);
