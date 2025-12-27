# 新品牌搭建完整指南

> 本指南提供从零开始搭建一个新品牌独立站的完整步骤，适用于多品牌运营场景。

---

## 📋 目录

1. [前置准备](#1-前置准备)
2. [第三方账号注册](#2-第三方账号注册)
3. [数据库初始化](#3-数据库初始化)
4. [品牌数据配置](#4-品牌数据配置)
5. [后端部署](#5-后端部署)
6. [前端部署](#6-前端部署)
7. [第三方服务配置](#7-第三方服务配置)
8. [产品数据导入](#8-产品数据导入)
9. [测试验证](#9-测试验证)
10. [上线检查清单](#10-上线检查清单)

---

## 1. 前置准备

### 1.1 品牌信息收集

在开始之前，请准备以下信息：

```yaml
品牌基本信息:
  品牌名称: _______________
  品牌Slug: _______________ # 英文短名，用于URL和数据库
  域名: _______________
  管理员邮箱: _______________
  Logo图片: _______________
  品牌主色调: _______________ # 如 #1a56db
  品牌副色调: _______________ # 如 #f97316

公司信息:
  公司名称: _______________
  联系邮箱: _______________
  联系电话: _______________
  地址: _______________
  
业务信息:
  目标市场: _______________ # 如：欧洲、北美、全球
  主要货币: _______________ # 如：EUR、USD、GBP
  时区: _______________ # 如：Europe/Berlin
  语言: _______________ # 如：英语、德语
  
产品信息:
  产品类型: _______________
  分类列表: _______________
  是否需要AI客服: _______________
```

### 1.2 域名准备

1. **购买域名**
   - 推荐平台：[Cloudflare Registrar](https://dash.cloudflare.com)、[Namecheap](https://namecheap.com)
   - 建议格式：`brandname.com` 或 `brandname.eu`（欧洲市场）

2. **DNS 托管到 Cloudflare**
   - 登录 Cloudflare Dashboard
   - 添加站点 > 输入域名
   - 按提示修改 Nameservers

3. **规划子域名**
   ```
   brandname.com      → 前端网站（Cloudflare Pages）
   api.brandname.com  → 后端API（Cloudflare Workers）
   ```

### 1.3 环境要求

- Node.js 18+
- npm 或 pnpm
- Wrangler CLI（`npm install -g wrangler`）
- Git

---

## 2. 第三方账号注册

### 必需账号

| 服务 | 用途 | 注册地址 | 预计时间 |
|------|------|----------|----------|
| **Cloudflare** | 前端托管 + 后端 | https://cloudflare.com | 5分钟 |
| **Supabase** | 数据库 | https://supabase.com | 5分钟 |
| **Stripe** | 支付 | https://stripe.com | 10分钟 |
| **Resend** | 邮件 | https://resend.com | 5分钟 |

### 可选账号

| 服务 | 用途 | 注册地址 |
|------|------|----------|
| **DeepSeek** | AI 客服 | https://deepseek.com |
| **Google Analytics** | 数据分析 | https://analytics.google.com |
| **Facebook Business** | 广告追踪 | https://business.facebook.com |

### 区域选择建议

| 目标市场 | Supabase 区域 | 说明 |
|----------|---------------|------|
| 欧洲 | Frankfurt (eu-central-1) | 德国，覆盖整个欧洲 |
| 北美 | East US (us-east-1) | 美国东部 |
| 亚太 | Singapore (ap-southeast-1) | 新加坡 |
| 全球 | East US 或 Frankfurt | 根据主要用户群选择 |

---

## 3. 数据库初始化

### 3.1 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击 **New Project**
3. 配置：
   - **Name**: `brandname-store`
   - **Database Password**: 生成强密码（⚠️ 保存好）
   - **Region**: 根据目标市场选择
4. 等待创建完成（约2分钟）

### 3.2 获取凭证

进入 **Settings > API**，记录：

| 信息 | 说明 | 用途 |
|------|------|------|
| Project URL | `https://xxx.supabase.co` | 前端 + 后端 |
| anon public key | `eyJhbGci...` | 前端 |
| service_role secret | `eyJhbGci...` | 后端（⚠️ 保密）|

### 3.3 执行数据库迁移

在 Supabase **SQL Editor** 中，按顺序执行 `docs/database/` 下的 SQL 文件：

```
执行顺序：
 1. 001_initial_schema.sql        # 基础表结构
 2. 002_rls_policies.sql          # 行级安全策略
 3. 004_pgvector_ai.sql           # AI 向量支持
 4. 005_content_quality.sql       # 内容质量
 5. 005_orders_payment.sql        # 订单支付
 6. 006_reviews.sql               # 评价系统
 7. 007_coupons.sql               # 优惠券
 8. 008_admin_users.sql           # 管理员
 9. 009_blog_support.sql          # 博客
10. 010_seo_tools.sql             # SEO 工具
11. 011_multi_brand_management.sql # 多品牌
12. 013_marketing_tracking.sql    # 营销追踪
13. 014_email_sequences.sql       # 邮件序列
14. 015_web_vitals.sql            # 性能监控
15. 017_user_retention.sql        # 用户留存
```

> ⚠️ 首次部署只需执行一次，后续新增品牌无需重复

---

## 4. 品牌数据配置

### 4.1 创建品牌配置目录

```bash
mkdir -p brands/brandname
```

### 4.2 创建配置文件

#### 前端环境变量 `brands/brandname/.env.example`

```env
# Supabase
PUBLIC_SUPABASE_URL=https://xxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# Stripe
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# 站点配置
PUBLIC_SITE_URL=https://brandname.com
PUBLIC_API_URL=https://api.brandname.com
PUBLIC_SITE_NAME=Brand Name
```

#### 后端开发变量 `brands/brandname/.dev.vars.example`

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI（可选）
DEEPSEEK_API_KEY=sk-...

# 邮件
RESEND_API_KEY=re_...
NOTIFY_EMAIL=orders@brandname.com

# 开发环境
DEFAULT_BRAND_SLUG=brandname
ENVIRONMENT=development
```

### 4.3 创建品牌初始化 SQL

创建 `brands/brandname/init-brand.sql`。

#### ⚠️ 必须修改的字段清单

在执行 SQL 之前，**必须**根据实际情况修改以下字段：

| 位置 | 字段 | 示例值 | 说明 |
|------|------|--------|------|
| **品牌基本信息** | | | |
| 第1节 | `name` | `'CMS BIKE'` | 品牌显示名称 |
| 第1节 | `slug` | `'cmsbike'` | 品牌英文标识（全小写，用于URL） |
| 第1节 | `domain` | `'cmsbike.com'` | 正式域名或临时域名如 `dtc-store-frontend.pages.dev` |
| 第1节 | `owner_email` | `'admin@cmsbike.com'` | 管理员邮箱 |
| **业务设置** | | | |
| 第1节 settings | `currency` | `'EUR'` / `'USD'` | 货币代码 |
| 第1节 settings | `locale` | `'en-EU'` / `'en-US'` | 语言区域 |
| 第1节 settings | `timezone` | `'Europe/Berlin'` | 时区 |
| 第1节 settings | `primary_color` | `'#1a56db'` | 品牌主色（十六进制） |
| 第1节 settings | `secondary_color` | `'#f97316'` | 品牌副色（十六进制） |
| **产品分类** | | | |
| 第2节 | 分类名称 | `'Folding Bikes'` | 根据产品类型修改 |
| 第2节 | 分类 slug | `'folding-bikes'` | 分类URL标识 |
| 第2节 | 分类描述 | `'...'` | 分类SEO描述 |
| **店铺设置** | | | |
| 第3节 | `store_name` | `'CMS BIKE'` | 店铺名称 |
| 第3节 | `store_tagline` | `'Fold. Ride. Explore.'` | 品牌口号 |
| 第3节 | `contact_email` | `'support@cmsbike.com'` | 客服邮箱 |
| 第3节 | `contact_phone` | `'+49 123 456 7890'` | 联系电话（可选） |
| 第3节 | `shipping_note` | `'Free shipping...'` | 运费说明 |
| 第3节 | `return_policy` | `'30-day returns...'` | 退换政策 |
| **AI 客服（可选）** | | | |
| 第4节 | `ai_system_prompt` | 详细客服指令 | AI 角色设定和产品知识 |
| 第4节 | `ai_welcome_message` | `'Hello! 👋...'` | 欢迎语 |
| 第4节 | `ai_handoff_keywords` | `'["refund", "human"]'` | 转人工关键词 |

> 💡 **提示**：所有出现 `brandname` 的地方都需要替换为实际品牌 slug

#### SQL 模板

```sql
-- ============================================
-- 品牌初始化 SQL 模板
-- ============================================

-- 1. 创建品牌
INSERT INTO brands (name, slug, domain, owner_email, is_active, settings)
VALUES (
  '品牌名称',           -- ⬅️ 替换：品牌显示名
  'brandname',          -- ⬅️ 替换：品牌slug
  'brandname.com',      -- ⬅️ 替换：实际域名
  'admin@brandname.com',-- ⬅️ 替换：管理员邮箱
  true,
  jsonb_build_object(
    'currency', 'EUR',           -- ⬅️ 替换：货币
    'locale', 'en-EU',           -- ⬅️ 替换：语言
    'timezone', 'Europe/Berlin', -- ⬅️ 替换：时区
    'logo', '/images/logo.png',
    'primary_color', '#1a56db',  -- ⬅️ 替换：主色
    'secondary_color', '#f97316' -- ⬅️ 替换：副色
  )
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  settings = EXCLUDED.settings;

-- 2. 创建产品分类（根据实际产品修改）
DO $$
DECLARE
  v_brand_id UUID;
BEGIN
  SELECT id INTO v_brand_id FROM brands WHERE slug = 'brandname'; -- ⬅️ 替换slug
  
  INSERT INTO categories (brand_id, name, slug, description, sort_order, is_active)
  VALUES
    -- ⬅️ 替换为实际分类
    (v_brand_id, '分类一', 'category-1', '分类一描述', 1, true),
    (v_brand_id, '分类二', 'category-2', '分类二描述', 2, true)
  ON CONFLICT (brand_id, slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;
END $$;

-- 3. 配置店铺设置
DO $$
DECLARE
  v_brand_id UUID;
BEGIN
  SELECT id INTO v_brand_id FROM brands WHERE slug = 'brandname'; -- ⬅️ 替换slug
  
  INSERT INTO settings (brand_id, key, value)
  VALUES
    -- ⬅️ 替换为实际信息
    (v_brand_id, 'store_name', '"品牌名称"'),
    (v_brand_id, 'store_tagline', '"品牌口号"'),
    (v_brand_id, 'contact_email', '"support@brandname.com"'),
    (v_brand_id, 'shipping_note', '"运费说明"'),
    (v_brand_id, 'return_policy', '"退货政策"')
  ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;
END $$;

-- 4. 配置 AI 客服（可选，不需要可删除此节）
DO $$
DECLARE
  v_brand_id UUID;
BEGIN
  SELECT id INTO v_brand_id FROM brands WHERE slug = 'brandname'; -- ⬅️ 替换slug
  
  INSERT INTO settings (brand_id, key, value)
  VALUES
    (v_brand_id, 'ai_enabled', 'true'),
    -- ⬅️ 替换为品牌专属的AI指令
    (v_brand_id, 'ai_system_prompt', '"You are [Brand] customer service assistant..."'),
    (v_brand_id, 'ai_welcome_message', '"Hello! How can I help you today?"'),
    (v_brand_id, 'ai_handoff_keywords', '["complaint", "refund", "human"]')
  ON CONFLICT (brand_id, key) DO UPDATE SET value = EXCLUDED.value;
END $$;
```

### 4.4 执行品牌初始化

1. 打开 [Supabase SQL Editor](https://supabase.com/dashboard)
2. 选择项目 → SQL Editor → New query
3. 粘贴修改后的 `init-brand.sql` 内容
4. 点击 **Run** 执行
5. 确认无报错，查看品牌是否创建成功：
   ```sql
   SELECT * FROM brands WHERE slug = 'your-brand-slug';
   ```

---

## 5. 后端部署

### 5.1 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 5.2 配置 Secrets

```bash
cd worker

# 必需
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY
wrangler secret put NOTIFY_EMAIL

# 可选（AI客服）
wrangler secret put DEEPSEEK_API_KEY
```

### 5.3 修改 wrangler.toml

```toml
name = "brandname-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
DEFAULT_BRAND_SLUG = "brandname"
ENVIRONMENT = "production"
```

### 5.4 部署

```bash
wrangler deploy
```

### 5.5 绑定域名

1. Cloudflare Dashboard > Workers & Pages
2. 选择 Worker > Settings > Triggers
3. Custom Domains > Add > `api.brandname.com`

---

## 6. 前端部署

### 6.1 配置环境变量

将 `brands/brandname/.env.example` 复制为 `frontend/.env` 并填入实际值

### 6.2 本地测试

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:4321` 验证

### 6.3 部署到 Cloudflare Pages

**方式一：GitHub 自动部署（推荐）**

1. Cloudflare Dashboard > Pages > Create project
2. 连接 GitHub 仓库
3. 构建设置：
   | 配置项 | 值 |
   |--------|-----|
   | Framework | Astro |
   | Build command | `npm run build` |
   | Build output | `dist` |
   | Root directory | `frontend` |
4. 添加环境变量（同 `.env`）
5. 部署

**方式二：手动部署**

```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name=brandname
```

### 6.4 绑定域名

1. Pages > 项目 > Custom domains
2. 添加 `brandname.com`
3. 配置 DNS

---

## 7. 第三方服务配置

### 7.1 Stripe 支付

#### 创建 Webhook

1. [Stripe Dashboard](https://dashboard.stripe.com) > Developers > Webhooks
2. Add endpoint:
   - URL: `https://api.brandname.com/api/stripe/webhook`
   - Events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
3. 复制 Signing secret 到 `STRIPE_WEBHOOK_SECRET`

#### 欧洲市场支付方式

在 Stripe Dashboard > Settings > Payment methods 启用：
- ✅ Cards
- ✅ Apple Pay / Google Pay
- ✅ SEPA Direct Debit（欧元区）
- ✅ Bancontact（比利时）
- ✅ iDEAL（荷兰）
- ✅ Klarna（分期）

### 7.2 Resend 邮件

1. [Resend Dashboard](https://resend.com) > Domains > Add Domain
2. 添加 `brandname.com`
3. 配置 DNS 记录（SPF、DKIM）
4. API Keys > Create > 复制到 `RESEND_API_KEY`

### 7.3 DeepSeek AI（可选）

1. [DeepSeek](https://deepseek.com) > API Keys
2. 创建密钥，复制到 `DEEPSEEK_API_KEY`

---

## 8. 产品数据导入

### 8.1 产品数据格式

每个产品需要以下信息：

```yaml
基本信息:
  name: 产品名称（英文）
  slug: url-friendly-name
  description: 产品描述（SEO，100-200字）
  price: 99.00
  compare_price: 129.00  # 原价（可选）
  stock: 100
  sku: PROD-001

分类:
  category_slug: category-1

图片:
  - https://cdn.example.com/image1.jpg
  - https://cdn.example.com/image2.jpg

规格（JSON）:
  weight: "1.5 kg"
  dimensions: "30 x 20 x 10 cm"
  material: "Aluminum"

卖点（数组）:
  - Feature 1
  - Feature 2
  - Feature 3

SEO:
  seo_title: Product Name | Brand
  seo_description: Meta description for search engines
```

### 8.2 导入方式

**方式一：管理后台**

访问 `https://brandname.com/admin/products` 手动添加

**方式二：SQL 批量导入**

创建 `brands/brandname/init-products.sql`：

```sql
DO $$
DECLARE
  v_brand_id UUID;
  v_category_id UUID;
BEGIN
  SELECT id INTO v_brand_id FROM brands WHERE slug = 'brandname';
  SELECT id INTO v_category_id FROM categories 
    WHERE brand_id = v_brand_id AND slug = 'category-1';
  
  INSERT INTO products (
    brand_id, category_id, name, slug, description,
    price, compare_price, stock, sku, images, specs, features,
    is_active, seo_title, seo_description
  ) VALUES (
    v_brand_id,
    v_category_id,
    'Product Name',
    'product-slug',
    'Product description...',
    99.00,
    129.00,
    100,
    'PROD-001',
    '["https://cdn/image1.jpg"]'::jsonb,
    '{"weight": "1.5 kg"}'::jsonb,
    '["Feature 1", "Feature 2"]'::jsonb,
    true,
    'Product Name | Brand',
    'Meta description'
  );
END $$;
```

### 8.3 图片托管

**推荐：Cloudflare Images**

```
URL 格式：https://imagedelivery.net/{account_hash}/{image_id}/public
```

**备选：Supabase Storage**

```
URL 格式：https://xxx.supabase.co/storage/v1/object/public/products/{filename}
```

---

## 9. 测试验证

### 9.1 功能测试清单

| 功能 | 测试方法 | 预期结果 |
|------|----------|----------|
| 首页 | 访问域名 | 正常加载 |
| 产品列表 | 点击分类 | 显示产品 |
| 产品详情 | 点击产品 | 显示详情 |
| 加入购物车 | 点击按钮 | 数量更新 |
| 结算支付 | 测试卡 `4242 4242 4242 4242` | 支付成功 |
| 订单邮件 | 完成支付 | 收到邮件 |
| 管理后台 | 访问 `/admin` | 可登录 |
| AI 客服 | 点击聊天 | 正常回复 |

### 9.2 SEO 检查

- [ ] `/sitemap.xml` 可访问
- [ ] `/robots.txt` 配置正确
- [ ] 页面有正确 `<title>` 和 `<meta description>`
- [ ] 产品页有 Schema.org 结构化数据

### 9.3 性能检查

- [ ] 首页 LCP < 2.5s
- [ ] 图片使用 WebP
- [ ] 启用 HTTPS

---

## 10. 上线检查清单

### 必须完成 ✅

- [ ] 域名 DNS 配置完成
- [ ] Stripe 切换到生产密钥（`pk_live_` / `sk_live_`）
- [ ] 所有 Secrets 已配置
- [ ] 邮件域名已验证（SPF/DKIM）
- [ ] Stripe Webhook 已配置
- [ ] 产品数据已导入
- [ ] 管理员账号已创建
- [ ] SSL/HTTPS 已启用

### 建议完成 📋

- [ ] Google Search Console 已验证
- [ ] Google Analytics 已配置
- [ ] Facebook Pixel 已配置（如需广告）
- [ ] 隐私政策页面已创建
- [ ] 服务条款页面已创建
- [ ] Cookie 同意横幅（欧洲市场 GDPR）

### 监控设置 📊

- [ ] Cloudflare Analytics 已启用
- [ ] Stripe Dashboard 监控
- [ ] Supabase 监控
- [ ] 错误通知邮箱已配置

---

## 📝 快速参考

### 常用命令

```bash
# 本地开发
cd frontend && npm run dev    # 前端 :4321
cd worker && npm run dev      # 后端 :8787

# 部署
cd worker && wrangler deploy
cd frontend && npm run build

# Secrets 管理
wrangler secret list
wrangler secret put KEY_NAME
wrangler secret delete KEY_NAME

# 查看日志
wrangler tail
```

### 目录结构

```
brands/
└── brandname/
    ├── README.md           # 品牌说明
    ├── .env.example        # 前端环境变量模板
    ├── .dev.vars.example   # 后端开发变量模板
    ├── init-brand.sql      # 品牌初始化 SQL
    └── init-products.sql   # 产品数据 SQL
```

### 关键 URL

| 服务 | 地址 |
|------|------|
| 前端网站 | `https://brandname.com` |
| 后端 API | `https://api.brandname.com` |
| 管理后台 | `https://brandname.com/admin` |
| Stripe Webhook | `https://api.brandname.com/api/stripe/webhook` |

---

## 🔗 相关文档

- [部署指南](../deployment/部署指南.md)
- [环境变量配置](../deployment/环境变量配置.md)
- [AI客服系统说明](../AI客服系统实现说明.md)
- [功能说明](../功能说明.md)

---

## 更新日志

- 2025-12-27：初始版本
