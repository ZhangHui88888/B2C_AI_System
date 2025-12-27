-- ============================================
-- CMS BIKE 品牌初始化 SQL
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 1. 创建品牌
INSERT INTO brands (name, slug, domain, owner_email, is_active, settings)
VALUES (
  'CMS BIKE',
  'cmsbike',
  'cmsbike.com',  -- ⬅️ 替换为实际域名
  'admin@cmsbike.com',  -- ⬅️ 替换为管理员邮箱
  true,
  jsonb_build_object(
    -- 默认货币（结算货币）
    'default_currency', 'USD',
    'default_locale', 'en',
    'timezone', 'UTC',
    -- 支持的市场配置
    'supported_markets', jsonb_build_object(
      'EU', jsonb_build_object('currency', 'EUR', 'locale', 'en-EU', 'name', 'Europe'),
      'US', jsonb_build_object('currency', 'USD', 'locale', 'en-US', 'name', 'United States'),
      'JP', jsonb_build_object('currency', 'JPY', 'locale', 'ja-JP', 'name', 'Japan'),
      'KR', jsonb_build_object('currency', 'KRW', 'locale', 'ko-KR', 'name', 'South Korea')
    ),
    -- 品牌视觉
    'logo', '/images/cmsbike-logo.png',
    'favicon', '/images/favicon.ico',
    'primary_color', '#1a56db',
    'secondary_color', '#f97316'
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  settings = EXCLUDED.settings;

-- 获取品牌 ID（用于后续插入）
DO $$
DECLARE
  v_brand_id UUID;
BEGIN
  SELECT id INTO v_brand_id FROM brands WHERE slug = 'cmsbike';
  
  -- 2. 创建产品分类
  INSERT INTO categories (brand_id, name, slug, description, sort_order, is_active)
  VALUES
    (v_brand_id, 'Folding Bikes', 'folding-bikes', 'Compact folding bicycles for urban commuting and travel', 1, true),
    (v_brand_id, 'Electric Folding Bikes', 'electric-folding-bikes', 'Electric-assist folding bikes for effortless riding', 2, true),
    (v_brand_id, 'Accessories', 'accessories', 'Bike accessories, bags, lights, and more', 3, true),
    (v_brand_id, 'Spare Parts', 'spare-parts', 'Replacement parts and components', 4, true)
  ON CONFLICT (brand_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order;

  -- 3. 配置 AI 客服设置
  INSERT INTO settings (brand_id, key, value)
  VALUES
    (v_brand_id, 'ai_enabled', 'true'),
    (v_brand_id, 'ai_model', '"deepseek-chat"'),
    (v_brand_id, 'ai_system_prompt', '"You are CMS BIKE''s friendly customer service assistant. You help customers with:
- Product information about our folding bikes
- Sizing recommendations (rider height, weight capacity)
- Shipping information to European countries
- Assembly and maintenance questions
- Order status and tracking
- Return and warranty policies

Key product knowledge:
- Our folding bikes are designed for urban commuting and easy storage
- Most bikes fold in under 20 seconds
- We offer free shipping within EU for orders over €99
- 2-year warranty on all bikes
- 30-day return policy

Always be helpful, professional, and encourage customers to contact human support for complex issues."'),
    (v_brand_id, 'ai_welcome_message', '"Hello! 👋 Welcome to CMS BIKE. I''m here to help you find the perfect folding bike. How can I assist you today?"'),
    (v_brand_id, 'ai_max_context_messages', '10'),
    (v_brand_id, 'ai_handoff_keywords', '["complaint", "refund", "damaged", "broken", "human", "agent", "manager", "speak to someone"]'),
    (v_brand_id, 'ai_fallback_message', '"I apologize, but I''m having trouble understanding your question. Would you like me to connect you with our human support team? You can also email us at support@cmsbike.com"')
  ON CONFLICT (brand_id, key) DO UPDATE SET
    value = EXCLUDED.value;

  -- 4. 配置店铺设置
  INSERT INTO settings (brand_id, key, value)
  VALUES
    (v_brand_id, 'store_name', '"CMS BIKE"'),
    (v_brand_id, 'store_tagline', '"Fold. Ride. Explore."'),
    (v_brand_id, 'store_description', '"Premium folding bikes for urban explorers. Compact design, superior quality, European engineering."'),
    (v_brand_id, 'contact_email', '"support@cmsbike.com"'),
    (v_brand_id, 'contact_phone', '"+49 123 456 7890"'),
    (v_brand_id, 'shipping_note', '"Free shipping within EU for orders over €99. Delivery in 3-7 business days."'),
    (v_brand_id, 'return_policy', '"30-day hassle-free returns. 2-year warranty on all bikes."')
  ON CONFLICT (brand_id, key) DO UPDATE SET
    value = EXCLUDED.value;

  -- 5. 配置邮件模板
  INSERT INTO settings (brand_id, key, value)
  VALUES
    (v_brand_id, 'email_from_name', '"CMS BIKE"'),
    (v_brand_id, 'email_from_address', '"orders@cmsbike.com"'),
    (v_brand_id, 'email_order_confirmed_subject', '"Your CMS BIKE Order #{order_number} is Confirmed!"'),
    (v_brand_id, 'email_order_shipped_subject', '"Great news! Your CMS BIKE order is on its way!"'),
    (v_brand_id, 'email_signature', '"Happy riding! 🚴\nThe CMS BIKE Team"')
  ON CONFLICT (brand_id, key) DO UPDATE SET
    value = EXCLUDED.value;

  RAISE NOTICE 'CMS BIKE brand initialized with ID: %', v_brand_id;
END $$;

-- 6. 验证初始化结果
SELECT 
  b.id,
  b.name,
  b.slug,
  b.domain,
  (SELECT COUNT(*) FROM categories WHERE brand_id = b.id) as category_count,
  (SELECT COUNT(*) FROM settings WHERE brand_id = b.id) as settings_count
FROM brands b
WHERE b.slug = 'cmsbike';
