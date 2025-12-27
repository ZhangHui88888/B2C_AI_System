-- ============================================
-- CMS BIKE 产品数据 SQL
-- 等待用户提供产品信息后填充
-- ============================================

-- 产品导入模板
-- 请提供以下信息后，我会为你生成完整的 SQL：

/*
每个产品需要的信息：
1. 产品名称（英文）
2. 产品 Slug（URL 友好的英文短名）
3. 产品描述（英文，用于 SEO）
4. 价格（欧元）
5. 原价（如有折扣）
6. 库存数量
7. SKU 编码
8. 所属分类：
   - folding-bikes（折叠自行车）
   - electric-folding-bikes（电动折叠自行车）
   - accessories（配件）
   - spare-parts（零件）
9. 产品图片 URL 列表
10. 产品规格（如：重量、折叠尺寸、轮径、适合身高等）
11. 特性亮点（3-5 个卖点）

示例：
{
  "name": "CMS Urban Pro 20",
  "slug": "cms-urban-pro-20",
  "description": "Lightweight 20-inch folding bike perfect for city commuting...",
  "price": 599.00,
  "compare_price": 699.00,
  "stock": 50,
  "sku": "CMS-UP20-BLK",
  "category": "folding-bikes",
  "images": [
    "/images/products/urban-pro-20-1.jpg",
    "/images/products/urban-pro-20-2.jpg"
  ],
  "specs": {
    "weight": "12.5 kg",
    "folded_size": "80 x 60 x 35 cm",
    "wheel_size": "20 inch",
    "rider_height": "155-185 cm",
    "max_load": "100 kg",
    "gears": "7-speed Shimano"
  },
  "features": [
    "Folds in 15 seconds",
    "Aircraft-grade aluminum frame",
    "Shimano 7-speed drivetrain",
    "Front and rear disc brakes",
    "Built-in kickstand"
  ]
}
*/

-- 获取品牌 ID
DO $$
DECLARE
  v_brand_id UUID;
  v_category_id UUID;
BEGIN
  SELECT id INTO v_brand_id FROM brands WHERE slug = 'cmsbike';
  
  -- 示例产品（请替换为实际产品数据）
  -- 产品 1: CMS Urban Pro 20
  SELECT id INTO v_category_id FROM categories WHERE brand_id = v_brand_id AND slug = 'folding-bikes';
  
  /*
  INSERT INTO products (
    brand_id,
    category_id,
    name,
    slug,
    description,
    price,
    compare_price,
    stock,
    sku,
    images,
    specs,
    features,
    is_active,
    seo_title,
    seo_description
  ) VALUES (
    v_brand_id,
    v_category_id,
    'CMS Urban Pro 20',
    'cms-urban-pro-20',
    'Lightweight 20-inch folding bike perfect for city commuting. Features aircraft-grade aluminum frame and Shimano 7-speed drivetrain.',
    599.00,
    699.00,
    50,
    'CMS-UP20-BLK',
    '["https://your-cdn.com/images/urban-pro-20-1.jpg", "https://your-cdn.com/images/urban-pro-20-2.jpg"]'::jsonb,
    '{"weight": "12.5 kg", "folded_size": "80 x 60 x 35 cm", "wheel_size": "20 inch", "rider_height": "155-185 cm", "max_load": "100 kg", "gears": "7-speed Shimano"}'::jsonb,
    '["Folds in 15 seconds", "Aircraft-grade aluminum frame", "Shimano 7-speed drivetrain", "Front and rear disc brakes", "Built-in kickstand"]'::jsonb,
    true,
    'CMS Urban Pro 20 - Premium Folding Bike | CMS BIKE',
    'Discover the CMS Urban Pro 20 folding bike. Lightweight aluminum frame, 7-speed Shimano gears, folds in 15 seconds. Free EU shipping.'
  );
  */

  RAISE NOTICE 'Product template ready. Please provide actual product data.';
END $$;

-- ============================================
-- 产品图片上传说明
-- ============================================
-- 
-- 推荐方案：使用 Cloudflare Images
-- 1. 在 Cloudflare Dashboard 开通 Images 服务
-- 2. 上传产品图片，获取 CDN URL
-- 3. URL 格式：https://imagedelivery.net/{account_hash}/{image_id}/{variant}
--
-- 或者：使用 Supabase Storage
-- 1. 在 Supabase Dashboard > Storage 创建 bucket
-- 2. 上传图片
-- 3. URL 格式：https://xxx.supabase.co/storage/v1/object/public/products/{filename}
-- ============================================
