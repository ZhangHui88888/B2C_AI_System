# 数据库数据字典（Public Schema）

本文档描述 **`docs/database` 迁移脚本（001-018）定义的所有数据表**（public schema）。

## 约定（Conventions）

- **多租户（Multi-tenant）**：大多数业务表包含 `brand_id`，并引用 `brands(id)`。
- **时间戳（Timestamps）**：大多数表使用 `created_at`/`updated_at`（由 001 中的 `update_updated_at()` 触发器函数维护）。
- **RLS**：许多表启用了行级安全（Row Level Security）；后端应使用 `service_role` 以获得全量访问。
- **ID**：主键多为 UUID；默认值可能是 `uuid_generate_v4()` 或 `gen_random_uuid()`（取决于迁移脚本）。

## 关系概览（高层）

- `brands` 是租户根表。
- 商品目录：`brands` -> `categories` -> `products`。
- 交易：`brands` -> `orders`（包含 `items` JSONB）以及 `customers`。
- 内容/AI：`content_library`、`knowledge_base` 以及相关分析/日志表。
- 营销：`utm_tracking`、`abandoned_carts`、`pixel_events`、`tracking_pixels_config`、`conversion_events`。
- 管理/RBAC：`admin_users`、`admin_activity_log`，以及多品牌管理相关的分配表。

---

# 核心电商（001_initial_schema.sql）

## 表：brands

**用途**：多租户根实体。“brand” 表示一个隔离的店铺/站点。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）：品牌标识。
- `name`（VARCHAR(100)，NOT NULL）：展示名称。
- `slug`（VARCHAR(100)，NOT NULL，UNIQUE）：URL 友好标识。
- `domain`（VARCHAR(255)，NULL）：自定义域名（历史字段；011 中扩展了域名绑定能力）。
- `logo_url`（TEXT，NULL）：品牌 Logo。
- `settings`（JSONB，默认 `{}`）：品牌级设置。
- `theme`（JSONB，默认“主题对象”）：主题配置（011 新增）。
- `custom_css`（TEXT，NULL）：品牌自定义 CSS（011 新增）。
- `favicon_url`（TEXT，NULL）：站点 favicon（011 新增）。
- `social_links`（JSONB，默认 `{}`）：社交链接集合（011 新增）。
- `contact_info`（JSONB，默认 `{}`）：联系信息（011 新增）。
- `owner_email`（VARCHAR(255)，NOT NULL）：店铺负责人/管理员联系邮箱。
- `is_active`（BOOLEAN，默认 `true`）：软开关（启用/禁用）。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
- `updated_at`（TIMESTAMPTZ，默认 `now()`）：更新时间。

**索引 / 约束**
- `brands.slug` 唯一。
- 索引：`idx_brands_slug`、`idx_brands_domain`、`idx_brands_active`。

**关联关系**
- 被引用：几乎所有租户表通过 `brand_id` 引用 `brands(id)`。

## 表：categories

**用途**：品牌下的商品分类；支持层级分类。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）：分类标识。
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）：所属品牌。
- `name`（VARCHAR(100)，NOT NULL）：分类名称。
- `slug`（VARCHAR(100)，NOT NULL）：URL slug（品牌内唯一）。
- `description`（TEXT，NULL）：描述。
- `image_url`（TEXT，NULL）：分类图片。
- `parent_id`（UUID，NULL，自引用 FK -> `categories.id` ON DELETE SET NULL）：父分类。
- `sort_order`（INTEGER，默认 `0`）：排序。
- `is_active`（BOOLEAN，默认 `true`）：状态。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
- `updated_at`（TIMESTAMPTZ，默认 `now()`）：更新时间。

**索引 / 约束**
- 唯一约束：`unique_category_slug_per_brand (brand_id, slug)`。
- 索引：`idx_categories_brand`、`idx_categories_slug`、`idx_categories_parent`、`idx_categories_active`。

**关联关系**
- `categories.brand_id` -> `brands.id`
- `products.category_id` -> `categories.id`

## 枚举：stock_status_enum

**用途**：商品库存状态。

**取值**
- `in_stock`
- `low_stock`
- `out_of_stock`

## 表：products

**用途**：商品（SPU）基础信息。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）：商品标识。
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）：所属品牌。
- `name`（VARCHAR(255)，NOT NULL）：商品名称。
- `slug`（VARCHAR(255)，NOT NULL）：URL slug（品牌内唯一）。
- `description`（TEXT，NULL）：长描述。
- `short_description`（VARCHAR(500)，NULL）：短描述。
- `price`（DECIMAL(10,2)，NOT NULL，CHECK >=0）：售价。
- `compare_price`（DECIMAL(10,2)，NULL）：“对比价/划线价”。
- `cost`（DECIMAL(10,2)，NULL）：成本。
- `main_image_url`（TEXT，NULL）：主图。
- `images`（TEXT[]，默认 `{}`）：额外图片 URL。
- `category_id`（UUID，NULL，FK -> `categories.id` ON DELETE SET NULL）：所属分类。
- `supplier_info`（JSONB，默认 `{}`）：供应商信息。
- `shipping_weight`（DECIMAL(8,2)，NULL）：重量。
- `shipping_time`（VARCHAR(100)，NULL）：预计发货/配送时间。
- `is_active`（BOOLEAN，默认 `true`）：是否上架/可售。
- `is_featured`（BOOLEAN，默认 `false`）：是否推荐。
- `stock_status`（stock_status_enum，默认 `in_stock`）：库存状态。
- `seo_title`（VARCHAR(255)，NULL）：SEO 标题。
- `seo_description`（VARCHAR(500)，NULL）：SEO 描述。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
- `updated_at`（TIMESTAMPTZ，默认 `now()`）：更新时间。

**索引 / 约束**
- 唯一约束：`unique_product_slug_per_brand (brand_id, slug)`。
- 全文索引：`idx_products_search`。
- 索引：`idx_products_brand`、`idx_products_slug`、`idx_products_category`、`idx_products_active`、`idx_products_featured`、`idx_products_price`、`idx_products_created`。

**关联关系**
- `products.brand_id` -> `brands.id`
- `products.category_id` -> `categories.id`
- 被引用：`orders.items`（JSONB）、`reviews.product_id`、`product_views.product_id` 等。

## 枚举：order_status_enum

**用途**：订单生命周期状态。

**取值（001）**
- `pending`、`paid`、`shipped`、`delivered`、`cancelled`、`refunded`

**扩展（005）**
- 新增：`failed`

## 表：orders

**用途**：订单。订单行项目存储在 `items`（JSONB 数组）中。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）：订单标识。
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）：所属品牌。
- `order_number`（VARCHAR(50)，NOT NULL）：订单号（品牌内唯一）。
- `customer_email`（VARCHAR(255)，NOT NULL）：客户邮箱。
- `customer_name`（VARCHAR(255)，NOT NULL）：客户姓名。
- `customer_phone`（VARCHAR(50)，NULL）：客户电话。
- `shipping_address`（JSONB，NOT NULL）：收货地址快照。
- `items`（JSONB，NOT NULL）：订单行项目数组。
- `subtotal`（DECIMAL(10,2)，NOT NULL）：小计。
- `shipping_cost`（DECIMAL(10,2)，NOT NULL，默认 `0`）：运费。
- `discount_amount`（DECIMAL(10,2)，默认 `0`）：优惠金额。
- `total`（DECIMAL(10,2)，NOT NULL）：订单总计。
- `status`（order_status_enum，默认 `pending`）：订单状态。
- `payment_intent_id`（VARCHAR(255)，NULL）：Stripe payment intent id。
- `tracking_number`（VARCHAR(100)，NULL）：物流单号。
- `tracking_url`（TEXT，NULL）：物流查询链接。
- `notes`（TEXT，NULL）：内部备注。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**索引 / 约束**
- 唯一约束：`unique_order_number_per_brand (brand_id, order_number)`。
- 索引：`idx_orders_brand`、`idx_orders_number`、`idx_orders_email`、`idx_orders_status`、`idx_orders_created`、`idx_orders_payment`。

**关联关系**
- `orders.brand_id` -> `brands.id`
- 被引用：`stripe_events.brand_id`、`reviews.order_id`、`coupon_usages.order_id`、`utm_tracking.order_id`、`pixel_events.order_id` 等。

## 表：customers

**用途**：品牌维度的客户档案。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）
- `email`（VARCHAR(255)，NOT NULL）：客户邮箱（品牌内唯一）。
- `name`（VARCHAR(255)，NULL）
- `phone`（VARCHAR(50)，NULL）
- `total_orders`（INTEGER，默认 `0`）：累计订单数缓存。
- `total_spent`（DECIMAL(12,2)，默认 `0`）：累计消费金额缓存。
- `first_order_at`（TIMESTAMPTZ，NULL）
- `last_order_at`（TIMESTAMPTZ，NULL）
- `created_at`（TIMESTAMPTZ，默认 `now()`）

**索引 / 约束**
- 唯一约束：`unique_customer_email_per_brand (brand_id, email)`。
- 索引：`idx_customers_brand`、`idx_customers_email`、`idx_customers_orders`。

**关联关系**
- 被引用：评价、邮件入组、会员体系等。

## 枚举：chat_role_enum

**用途**：对话消息的角色类型。

**取值**
- `user`、`assistant`、`system`

## 表：conversations

**用途**：AI 客服对话消息存储。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `session_id`（VARCHAR(100)，NOT NULL）：客户端会话标识。
- `role`（chat_role_enum，NOT NULL）：消息角色。
- `message`（TEXT，NOT NULL）：消息内容。
- `metadata`（JSONB，默认 `{}`）：附加上下文。
- `created_at`（TIMESTAMPTZ，默认 `now()`）

**索引 / 约束**
- 索引：`idx_conversations_brand`、`idx_conversations_session`、`idx_conversations_created`。

## 表：knowledge_base

**用途**：RAG 知识库分片（用于 AI 客服/检索增强）。

**字段（001 + 004 + 011）**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `content`（TEXT，NOT NULL）：文本内容分片。
- `metadata`（JSONB，默认 `{}`）：来源/附加信息。
- `embedding_id`（VARCHAR(100)，NULL）：可选外部 embedding 引用。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `embedding`（vector(1536)，NULL）：pgvector 向量。
- `source_type`（VARCHAR(50)，默认 `'manual'`）：来源类型（手动/导入等）。
- `source_id`（UUID，NULL）：来源对象 id。
- `title`（VARCHAR(500)，NULL）：展示标题。
- `is_shared`（BOOLEAN，默认 `false`）：是否跨品牌共享。
- `shared_by_brand_id`（UUID，FK -> `brands.id` ON DELETE SET NULL）：共享内容的所属品牌。
- `source_knowledge_id`（UUID，FK -> `knowledge_base.id` ON DELETE SET NULL）：指向原始 knowledge 记录。

**索引 / 约束**
- 索引：`idx_knowledge_brand`、`idx_knowledge_embedding`、`idx_knowledge_search`、`idx_knowledge_embedding_vector`、`idx_knowledge_shared`、`idx_knowledge_shared_by`。

## 表：settings

**用途**：品牌级 Key/Value 配置存储。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `key`（VARCHAR(100)，NOT NULL）：配置键。
- `value`（JSONB，NOT NULL）：配置值。
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**索引 / 约束**
- 唯一约束：`unique_setting_key_per_brand (brand_id, key)`。
- 索引：`idx_settings_brand`、`idx_settings_key`。

## 枚举：content_type_enum / content_platform_enum / content_status_enum

**用途**：内容类型/投放平台/状态。

**取值**
- `content_type_enum`：`script`、`caption`、`description`（009 新增 `blog`）
- `content_platform_enum`：`tiktok`、`instagram`、`pinterest`、`facebook`、`youtube`
- `content_status_enum`：`draft`、`approved`、`published`

## 表：content_library

**用途**：AI 生成内容 + Blog 内容的存储。

**字段（001 + 005_content_quality + 009 + 012）**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `type`（content_type_enum，NOT NULL）：内容类型。
- `product_id`（UUID，FK -> `products.id` ON DELETE SET NULL）：关联商品。
- `content`（TEXT，NOT NULL）：内容正文。
- `platform`（content_platform_enum，NULL）：目标平台。
- `status`（content_status_enum，默认 `draft`）
- `performance_data`（JSONB，默认 `{}`）：效果数据/指标。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）
- `is_ai_generated`（BOOLEAN，默认 `true`）：是否 AI 生成（对比手工）。
- `ai_generated_at`（TIMESTAMPTZ，NULL）：AI 生成时间。
- `similarity_score`（DECIMAL(5,2)，NULL）：相似度/重复度。
- `author_id`（UUID，FK -> `authors.id` ON DELETE SET NULL）：作者（用于 EEAT/Blog）。
- `title`（VARCHAR(500)，NULL）：标题。
- `meta_description`（VARCHAR(500)，NULL）：SEO meta description。
- `word_count`（INTEGER，NULL）：字数。
- `last_review_at`（TIMESTAMPTZ，NULL）：最近审核时间。
- `reviewed_by`（VARCHAR(255)，NULL）：审核人。
- `publish_scheduled_at`（TIMESTAMPTZ，NULL）：计划发布时间。
- `slug`（VARCHAR(255)，NULL）：Blog slug（存在时品牌内唯一）。
- `published_at`（TIMESTAMPTZ，NULL）：实际发布时间。
- `originality_score`（INTEGER，NULL）：原创度 0-100。
- `originality_checked_at`（TIMESTAMPTZ，NULL）：原创检测时间。
- `originality_flags`（JSONB，默认 `{}`）：原创检测标记/明细。
- `differentiation_source`（JSONB，默认 `{}`）：用于差异化生成的来源信息。

**索引 / 约束**
- 索引：`idx_content_brand`、`idx_content_product`、`idx_content_type`、`idx_content_platform`、`idx_content_status`、`idx_content_ai_generated`、`idx_content_author`、`idx_content_scheduled`、`idx_content_slug`、`idx_content_published`、`idx_content_originality`、`idx_content_needs_check`。
- 唯一约束（009）：`unique_content_slug_per_brand (brand_id, slug)`（创建时）。

---

# 其他数据表（005-018）

本字典后续部分（作者、分析、评价、优惠券、管理/RBAC、SEO、多品牌、营销、邮件、Web Vitals、高级 SEO、留存、转化）如下。

---

# 内容质量与分析（005_content_quality.sql）

## 表：authors

**用途**：作者档案，用于 E-E-A-T 与 Blog 归因。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）
- `name`（VARCHAR(255)，NOT NULL）：作者名。
- `slug`（VARCHAR(255)，NOT NULL）：slug（品牌内唯一）。
- `avatar_url`（TEXT，NULL）：头像。
- `bio`（TEXT，NULL）：简介。
- `credentials`（TEXT[]，NULL）：资质/证书列表。
- `social_links`（JSONB，默认 `{}`）：社交链接。
- `is_active`（BOOLEAN，默认 `true`）：是否启用。
- `article_count`（INTEGER，默认 `0`）：文章数缓存。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**索引 / 约束**
- 唯一约束：`unique_author_slug_per_brand (brand_id, slug)`
- 索引：`idx_authors_brand`、`idx_authors_slug`、`idx_authors_active`

**关联关系**
- `content_library.author_id` -> `authors.id`

## 表：content_publish_logs

**用途**：记录发布事件（用于限流与审计）。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `content_id`（UUID，NULL，FK -> `content_library.id` ON DELETE SET NULL）
- `content_type`（VARCHAR(50)，NOT NULL）：冗余的内容类型标签。
- `published_at`（TIMESTAMPTZ，默认 `now()`）：发布时间。

**索引**
- `idx_publish_logs_brand`、`idx_publish_logs_date`

## 表：daily_analytics

**用途**：按天聚合的品牌分析指标。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `date`（DATE，NOT NULL）：日期。
- `page_views`（INTEGER，默认 `0`）：PV。
- `unique_visitors`（INTEGER，默认 `0`）：UV。
- `orders_count`（INTEGER，默认 `0`）：订单数。
- `revenue`（DECIMAL(12,2)，默认 `0`）：收入。
- `avg_order_value`（DECIMAL(10,2)，默认 `0`）：平均客单价。
- `cart_additions`（INTEGER，默认 `0`）：加购次数。
- `checkout_starts`（INTEGER，默认 `0`）：发起结账次数。
- `checkout_completions`（INTEGER，默认 `0`）：完成结账次数。

**补充字段**
- `conversion_rate`（DECIMAL(5,4)，默认 `0`）：转化率。
- `traffic_sources`（JSONB，默认 `{}`）：渠道来源汇总。
- `top_products`（JSONB，默认 `[]`）：热销/高贡献商品列表。
- `new_customers`（INTEGER，默认 `0`）：新客数。
- `returning_customers`（INTEGER，默认 `0`）：复购用户数。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。

**索引 / 约束**
- 唯一索引：`idx_analytics_brand_date (brand_id, date)`
- 索引：`idx_analytics_brand`、`idx_analytics_date`

## 表：product_views

**用途**：商品浏览的原始记录（PV 明细）。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `product_id`（UUID，NOT NULL，FK -> `products.id` ON DELETE CASCADE）：被浏览的商品。
- `session_id`（VARCHAR(100)，NULL）：会话标识。
- `viewed_at`（TIMESTAMPTZ，默认 `now()`）：浏览时间。

**索引**
- `idx_product_views_brand`、`idx_product_views_product`、`idx_product_views_date`

---

# 支付与库存（005_orders_payment.sql）

## 表：stripe_events

**用途**：Stripe Webhook 事件日志与幂等处理存储。

**字段**
- `event_id`（TEXT，PK）：Stripe 事件 id。
- `type`（TEXT，NOT NULL）：Stripe 事件类型。
- `stripe_created_at`（TIMESTAMPTZ，NULL）：Stripe 侧事件创建时间。
- `brand_id`（UUID，NULL，FK -> `brands.id` ON DELETE SET NULL）：归属品牌。
- `payload`（JSONB，NOT NULL）：Stripe 原始 payload。
- `processed_at`（TIMESTAMPTZ，NULL）：处理完成时间。
- `processing_error`（TEXT，NULL）：处理错误信息（如有）。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：入库时间。

**关联关系**
- `stripe_events.brand_id` -> `brands.id`

---

# 评价（006_reviews.sql）

## 枚举：review_status_enum

**用途**：评价审核/风控流程状态。

**取值**
- `pending`、`approved`、`rejected`、`spam`

## 表：reviews

**用途**：商品评价（包含审核、商家回复、精选、是否已购验证等）。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）：所属品牌。
- `product_id`（UUID，NOT NULL，FK -> `products.id` ON DELETE CASCADE）：关联商品。
- `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE SET NULL）：关联客户。
- `order_id`（UUID，NULL，FK -> `orders.id` ON DELETE SET NULL）：关联订单（用于“已购”验证）。
- `rating`（INTEGER，NOT NULL，CHECK 1..5）：评分。
- `title`（VARCHAR(255)，NULL）：标题。
- `content`（TEXT，NULL）：评价正文。
- `reviewer_name`（VARCHAR(255)，NULL）：展示名。
- `reviewer_email`（VARCHAR(255)，NULL）：邮箱（可选）。
- `status`（review_status_enum，默认 `pending`）：审核状态。
- `is_verified_purchase`（BOOLEAN，默认 `false`）：是否已购用户评价。
- `is_featured`（BOOLEAN，默认 `false`）：是否精选。
- `images`（TEXT[]，NULL）：图片列表。
- `merchant_reply`（TEXT，NULL）：商家回复。
- `merchant_reply_at`（TIMESTAMPTZ，NULL）：回复时间。
- `merchant_reply_by`（VARCHAR(255)，NULL）：回复人。
- `helpful_count`（INTEGER，默认 `0`）：有帮助计数。
- `not_helpful_count`（INTEGER，默认 `0`）：无帮助计数。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
- `updated_at`（TIMESTAMPTZ，默认 `now()`）：更新时间。
- `approved_at`（TIMESTAMPTZ，NULL）：审核通过时间。
- `approved_by`（VARCHAR(255)，NULL）：审核人。

**索引**
- `idx_reviews_brand`、`idx_reviews_product`、`idx_reviews_customer`、`idx_reviews_status`、`idx_reviews_rating`
- 部分索引：`idx_reviews_featured`、`idx_reviews_verified`

**关联关系**
- `reviews.product_id` -> `products.id`
- `reviews.customer_id` -> `customers.id`
- `reviews.order_id` -> `orders.id`

## 表：review_votes

**用途**：对评价进行“有帮助/无帮助”的投票。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `review_id`（UUID，NOT NULL，FK -> `reviews.id` ON DELETE CASCADE）：被投票的评价。
- `voter_ip`（VARCHAR(45)，NULL）：匿名投票标识（通常为 IP）。
- `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE SET NULL）：登录用户投票时的客户 id。
- `is_helpful`（BOOLEAN，NOT NULL）：是否“有帮助”。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：投票时间。

**索引 / 约束**
- `idx_review_votes_review`
- 唯一索引：`idx_review_votes_unique (review_id, COALESCE(customer_id::text, voter_ip))`（同一用户或同一 IP 对同一评价只能投一次）

## 表：review_invitations

**用途**：追踪评价邀请邮件发送与完成情况。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）
- `order_id`（UUID，NOT NULL，FK -> `orders.id` ON DELETE CASCADE）
- `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE SET NULL）
- `email`（VARCHAR(255)，NOT NULL）：邀请接收邮箱。
- `token`（VARCHAR(64)，NOT NULL，UNIQUE）：邀请 token。
- `sent_at`（TIMESTAMPTZ，NULL）：发送时间。
- `opened_at`（TIMESTAMPTZ，NULL）：打开时间。
- `completed_at`（TIMESTAMPTZ，NULL）：完成评价时间。
- `review_id`（UUID，NULL，FK -> `reviews.id` ON DELETE SET NULL）：最终关联的评价。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。

---

# 优惠券（007_coupons.sql）

## 枚举：coupon_type_enum / coupon_status_enum

**用途**：优惠券的类型与状态。

**取值**
- `coupon_type_enum`：`percentage`（百分比折扣）、`fixed_amount`（固定金额立减）、`free_shipping`（免运费）
- `coupon_status_enum`：`active`、`inactive`、`expired`

## 表：coupons

**用途**：品牌维度的优惠券定义。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）
- `code`（VARCHAR(50)，NOT NULL）：优惠码（品牌内唯一）。
- `description`（TEXT，NULL）：描述。
- `type`（coupon_type_enum，NOT NULL，默认 `percentage`）：优惠类型。
- `value`（DECIMAL(10,2)，NOT NULL）：折扣值（百分比或金额，视 type 而定）。
- `min_order_amount`（DECIMAL(10,2)，默认 `0`）：最低订单金额门槛。
- `max_discount_amount`（DECIMAL(10,2)，NULL）：最大优惠封顶（可选）。
- `usage_limit`（INTEGER，NULL）：总使用上限（可选）。
- `usage_limit_per_customer`（INTEGER，默认 `1`）：每个客户使用次数上限。
- `usage_count`（INTEGER，默认 `0`）：已使用次数缓存。
- `starts_at`（TIMESTAMPTZ，默认 `now()`）：开始时间。
- `expires_at`（TIMESTAMPTZ，NULL）：过期时间。
- `applies_to_products`（UUID[]，默认 `{}`）：适用商品列表。
- `applies_to_categories`（UUID[]，默认 `{}`）：适用分类列表。
- `excluded_products`（UUID[]，默认 `{}`）：排除商品列表。
- `first_order_only`（BOOLEAN，默认 `false`）：是否仅首单可用。
- `status`（coupon_status_enum，默认 `active`）：状态。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
- `updated_at`（TIMESTAMPTZ，默认 `now()`）：更新时间。

**索引 / 约束**
- 唯一约束：`(brand_id, code)`
- 索引：`idx_coupons_brand_code`、`idx_coupons_brand_status`

## 表：coupon_usages

**用途**：记录每一次优惠券使用。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `coupon_id`（UUID，NOT NULL，FK -> `coupons.id` ON DELETE CASCADE）：使用的优惠券。
- `order_id`（UUID，NULL，FK -> `orders.id` ON DELETE SET NULL）：关联订单。
- `customer_email`（VARCHAR(255)，NOT NULL）：使用者邮箱。
- `discount_amount`（DECIMAL(10,2)，NOT NULL）：抵扣金额。
- `used_at`（TIMESTAMPTZ，默认 `now()`）：使用时间。

**索引**
- `idx_coupon_usages_coupon`、`idx_coupon_usages_email`

---

# 管理员与 RBAC（008_admin_users.sql）

## 枚举：admin_role_enum

**用途**：后台管理员角色。

**取值**
- `super_admin`、`brand_admin`、`editor`、`read_only`

## 表：admin_users

**用途**：后台用户，映射到 Supabase `auth.users`。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `auth_user_id`（UUID，NOT NULL，UNIQUE）：对应 `auth.users(id)`。
- `email`（VARCHAR(255)，NOT NULL，UNIQUE）：邮箱。
- `name`（VARCHAR(255)，NULL）：姓名。
- `avatar_url`（TEXT，NULL）：头像。
- `role`（admin_role_enum，NOT NULL，默认 `read_only`）：角色。
- `brand_ids`（UUID[]，默认 `{}`）：非 super_admin 可访问的品牌列表。
- `is_active`（BOOLEAN，默认 `true`）：是否启用。
- `last_login_at`（TIMESTAMPTZ，NULL）：最近登录时间。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**索引**
- `idx_admin_users_auth_user`、`idx_admin_users_email`、`idx_admin_users_role`

## 表：admin_activity_log

**用途**：管理员操作审计日志。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `admin_user_id`（UUID，NULL，FK -> `admin_users.id` ON DELETE SET NULL）：操作者。
- `action`（VARCHAR(100)，NOT NULL）：动作类型。
- `resource_type`（VARCHAR(100)，NULL）：资源类型。
- `resource_id`（UUID，NULL）：资源 id。
- `details`（JSONB，默认 `{}`）：详情/上下文。
- `ip_address`（VARCHAR(45)，NULL）：IP。
- `user_agent`（TEXT，NULL）：UA。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：发生时间。

---

# SEO 工具（010_seo_tools.sql）

## 表：seo_meta

**用途**：为页面覆盖/自定义 Meta 标签、canonical、robots 指令。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id` ON DELETE CASCADE）：所属品牌（可为空用于全局/默认）。
- `page_type`（VARCHAR(50)，NOT NULL）：页面类型（例如 product/category/content 等）。
- `page_id`（UUID，NULL）：页面对象 id（可选）。
- `page_slug`（VARCHAR(255)，NULL）：页面 slug（可选）。
- `meta_title`（VARCHAR(70)，NULL）：Meta Title。
- `meta_description`（VARCHAR(160)，NULL）：Meta Description。
- `meta_keywords`（TEXT，NULL）：Meta Keywords。
- `og_title`（VARCHAR(100)，NULL）：Open Graph 标题。
- `og_description`（VARCHAR(200)，NULL）：Open Graph 描述。
- `og_image`（VARCHAR(500)，NULL）：Open Graph 图片。
- `twitter_title`（VARCHAR(70)，NULL）：Twitter 标题。
- `twitter_description`（VARCHAR(200)，NULL）：Twitter 描述。
- `twitter_image`（VARCHAR(500)，NULL）：Twitter 图片。
- `canonical_url`（VARCHAR(500)，NULL）：Canonical URL。
- `robots_directive`（VARCHAR(100)，默认 `index,follow`）：Robots 指令。
- `is_ai_generated`（BOOLEAN，默认 `false`）：是否 AI 生成。
- `ai_generated_at`（TIMESTAMPTZ，NULL）：AI 生成时间。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**约束**
- 唯一约束：`(brand_id, page_type, page_id, page_slug)`

## 表：url_redirects

**用途**：301/302 重定向规则。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `source_path`（VARCHAR(500)，NOT NULL）：来源路径。
- `target_url`（VARCHAR(1000)，NOT NULL）：目标 URL。
- `redirect_type`（INTEGER，默认 `301`）：重定向类型。
- `hit_count`（INTEGER，默认 `0`）：命中次数。
- `last_hit_at`（TIMESTAMPTZ，NULL）：最近命中时间。
- `is_active`（BOOLEAN，默认 `true`）：是否启用。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**约束**
- 唯一约束：`(brand_id, source_path)`

## 表：error_404_logs

**用途**：404 请求聚合日志（按路径聚合）。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `request_path`（VARCHAR(1000)，NOT NULL）：请求路径。
- `referrer`（VARCHAR(1000)，NULL）：来源页面。
- `user_agent`（TEXT，NULL）：UA。
- `ip_address`（VARCHAR(45)，NULL）：IP。
- `hit_count`（INTEGER，默认 `1`）：累计命中。
- `first_seen_at`（TIMESTAMPTZ，默认 `now()`）：首次出现。
- `last_seen_at`（TIMESTAMPTZ，默认 `now()`）：最近出现。
- `is_resolved`（BOOLEAN，默认 `false`）：是否已处理。
- `resolved_redirect_id`（UUID，NULL，FK -> `url_redirects.id`）：用于修复的重定向规则（可选）。

**约束**
- 唯一约束：`(brand_id, request_path)`

## 表：seo_reports

**用途**：SEO 审计/诊断报告存储。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `report_type`（VARCHAR(50)，NOT NULL）：报告类型。
- `page_type`（VARCHAR(50)，NULL）：页面类型。
- `page_id`（UUID，NULL）：页面对象 id。
- `page_url`（VARCHAR(500)，NULL）：页面 URL。
- `report_data`（JSONB，NOT NULL，默认 `{}`）：报告详细数据。
- `overall_score`（INTEGER，NULL）：总分。
- `title_score`/`description_score`/`content_score`/`readability_score`/`keyword_score`/`technical_score`（INTEGER，NULL）：各维度评分。
- `issues`（JSONB，默认 `[]`）：问题列表。
- `recommendations`（JSONB，默认 `[]`）：建议列表。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：生成时间。

## 表：seo_keywords

**用途**：关键词跟踪清单。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `keyword`（VARCHAR(255)，NOT NULL）：关键词。
- `search_intent`（VARCHAR(50)，NULL）：搜索意图。
- `target_page_type`（VARCHAR(50)，NULL）：目标页面类型。
- `target_page_id`（UUID，NULL）：目标页面 id。
- `search_volume`（INTEGER，NULL）：搜索量。
- `keyword_difficulty`（INTEGER，NULL）：难度。
- `current_position`（INTEGER，NULL）：当前排名。
- `previous_position`（INTEGER，NULL）：上次排名。
- `is_tracked`（BOOLEAN，默认 `true`）：是否跟踪。
- `last_checked_at`（TIMESTAMPTZ，NULL）：最近检查时间。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**约束**
- 唯一约束：`(brand_id, keyword)`

## 表：sitemap_config

**用途**：站点地图（sitemap）生成配置。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `page_type`（VARCHAR(50)，NOT NULL）：页面类型。
- `is_included`（BOOLEAN，默认 `true`）：是否纳入 sitemap。
- `changefreq`（VARCHAR(20)，默认 `weekly`）：更新频率建议。
- `priority`（DECIMAL(2,1)，默认 `0.5`）：优先级建议。
- `last_generated_at`（TIMESTAMPTZ，NULL）：最近生成时间。
- `url_count`（INTEGER，默认 `0`）：URL 数量缓存。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**约束**
- 唯一约束：`(brand_id, page_type)`

## 表：robots_config

**用途**：robots.txt 覆盖内容与爬虫开关。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `custom_content`（TEXT，NULL）：自定义 robots.txt 内容（可选）。
- `allow_gptbot`/`allow_claudebot`/`allow_perplexitybot`/`allow_googlebot`/`allow_bingbot`（BOOLEAN，默认 `true`）：各爬虫开关。
- `disallow_paths`（JSONB，默认 `[]`）：禁止路径列表。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**约束**
- 唯一约束：`(brand_id)`

## 表：ai_crawler_logs

**用途**：记录 AI 爬虫命中日志（用于 GEO 分析）。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `crawler_name`（VARCHAR(100)，NOT NULL）：爬虫名称。
- `request_path`（VARCHAR(1000)，NOT NULL）：请求路径。
- `user_agent`（TEXT，NULL）：UA。
- `ip_address`（VARCHAR(45)，NULL）：IP。
- `request_method`（VARCHAR(10)，NULL）：请求方法。
- `response_status`（INTEGER，NULL）：响应码。
- `response_time_ms`（INTEGER，NULL）：响应耗时（ms）。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：记录时间。

## 表：content_seo_cache

**用途**：页面/内容的 SEO 与文本分析指标缓存。

**字段**
- `id`（UUID，PK，默认 `gen_random_uuid()`）
- `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
- `content_type`（VARCHAR(50)，NOT NULL）：内容类型。
- `content_id`（UUID，NOT NULL）：内容 id。
- `word_count`/`sentence_count`/`paragraph_count`（INTEGER，NULL）：词/句/段统计。
- `flesch_reading_ease`（DECIMAL(5,2)，NULL）：Flesch 可读性。
- `flesch_kincaid_grade`（DECIMAL(4,2)，NULL）：FK 年级。
- `primary_keyword`（VARCHAR(255)，NULL）：主关键词。
- `keyword_density`（DECIMAL(5,2)，NULL）：关键词密度。
- `keyword_in_title`/`keyword_in_h1`/`keyword_in_meta_desc`/`keyword_in_first_paragraph`（BOOLEAN，NULL）：关键词位置标记。
- `has_h1`（BOOLEAN，NULL）：是否存在 H1。
- `h2_count`/`h3_count`（INTEGER，NULL）：标题计数。
- `image_count`/`images_with_alt`（INTEGER，NULL）：图片计数。
- `internal_link_count`/`external_link_count`（INTEGER，NULL）：链接计数。
- `seo_score`/`readability_score`/`eeat_score`（INTEGER，NULL）：评分。
- `analyzed_at`（TIMESTAMPTZ，默认 `now()`）：分析时间。

**约束**
- 唯一约束：`(brand_id, content_type, content_id)`

---

# 多品牌管理（011_multi_brand_management.sql）

## 表：brand_domains

**用途**：品牌的多域名绑定。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）：所属品牌。
- `domain`（VARCHAR(255)，NOT NULL，UNIQUE）：域名（全局唯一）。
- `is_primary`（BOOLEAN，默认 `false`）：是否主域名。
- `ssl_status`（VARCHAR(50)，默认 `pending`）：SSL 状态。
- `dns_verified`（BOOLEAN，默认 `false`）：DNS 是否验证。
- `verified_at`（TIMESTAMPTZ，NULL）：验证时间。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

## 表：shared_templates

**用途**：可跨品牌共享的模板（可限定可用品牌）。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `owner_brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）：模板拥有者品牌。
- `name`（VARCHAR(255)，NOT NULL）：名称。
- `description`（TEXT，NULL）：描述。
- `template_type`（VARCHAR(50)，NOT NULL）：模板类型。
- `content`（JSONB，NOT NULL）：模板内容。
- `is_public`（BOOLEAN，默认 `false`）：是否公开。
- `allowed_brand_ids`（UUID[]，默认 `{}`）：允许使用的品牌列表。
- `use_count`（INTEGER，默认 `0`）：使用次数缓存。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

## 表：brand_user_assignments

**用途**：更细粒度的管理员-品牌分配（补充 `admin_users.brand_ids`）。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）：被授权品牌。
- `admin_user_id`（UUID，NOT NULL，FK -> `admin_users.id` ON DELETE CASCADE）：管理员。
- `role`（VARCHAR(50)，NOT NULL，默认 `editor`）：在该品牌下的角色。
- `permissions`（JSONB，默认 `{}`）：权限细节。
- `assigned_by`（UUID，NULL，FK -> `admin_users.id` ON DELETE SET NULL）：分配者。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**约束**
- 唯一约束：`(brand_id, admin_user_id)`

## 表：cross_brand_analytics

**用途**：跨品牌报表的计算结果缓存。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `metric_type`（VARCHAR(100)，NOT NULL）：指标类型。
- `brand_id`（UUID，NULL，FK -> `brands.id` ON DELETE CASCADE）：关联品牌（可选）。
- `period_start`（DATE，NOT NULL）：周期开始。
- `period_end`（DATE，NOT NULL）：周期结束。
- `data`（JSONB，NOT NULL）：指标数据。
- `calculated_at`（TIMESTAMPTZ，默认 `now()`）：计算时间。

**约束**
- 唯一约束：`(metric_type, brand_id, period_start, period_end)`

---

# 内容原创性（012_content_originality.sql）

## 表：content_differentiation_logs

**用途**：记录 AI 生成内容“差异化”时使用了哪些输入（例如是否引用评价、规格、对比商品等）。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE）
- `content_id`（UUID，NULL，FK -> `content_library.id` ON DELETE SET NULL）
- `product_id`（UUID，NULL，FK -> `products.id` ON DELETE SET NULL）
- `content_type`（VARCHAR(50)，NOT NULL）：内容类型标签。
- `included_reviews`（BOOLEAN，默认 `false`）：是否包含评价数据。
- `review_count`（INTEGER，默认 `0`）：评价数量。
- `included_specs`（BOOLEAN，默认 `false`）：是否包含规格信息。
- `included_comparisons`（BOOLEAN，默认 `false`）：是否包含对比信息。
- `comparison_product_ids`（UUID[]，默认 `{}`）：对比商品 id 列表。
- `tone`（VARCHAR(50)，NULL）：语气。
- `language`（VARCHAR(50)，NULL）：语言。
- `base_content_length`（INTEGER，NULL）：原始内容长度。
- `generated_content_length`（INTEGER，NULL）：生成内容长度。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：记录时间。

## 表：originality_check_logs

**用途**：记录内容原创度检测结果。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
- `content_id`（UUID，NULL，FK -> `content_library.id` ON DELETE SET NULL）
- `score`（INTEGER，NOT NULL，CHECK 0..100）：原创度评分。
- `has_generic_opening`（BOOLEAN，默认 `false`）：是否“通用开头”。
- `has_repetitive_structure`（BOOLEAN，默认 `false`）：是否结构重复。
- `lacks_specific_details`（BOOLEAN，默认 `false`）：是否缺少具体细节。
- `has_ai_patterns`（BOOLEAN，默认 `false`）：是否有明显 AI 模式。
- `common_patterns_count`（INTEGER，默认 `0`）：常见模式计数。
- `suggestions_count`（INTEGER，默认 `0`）：建议数量。
- `content_length`（INTEGER，NULL）：内容长度。
- `content_hash`（VARCHAR(64)，NULL）：内容 hash。
- `checked_at`（TIMESTAMPTZ，默认 `now()`）：检测时间。

---

# 营销与追踪（013_marketing_tracking.sql）

## 表：utm_tracking

**用途**：存储会话级（session-level）的 UTM 归因信息。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
- `session_id`（VARCHAR(100)，NOT NULL）：会话标识。
- `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE SET NULL）：关联客户。
- `order_id`（UUID，NULL，FK -> `orders.id` ON DELETE SET NULL）：关联订单。
- `utm_source`/`utm_medium`/`utm_campaign`/`utm_term`/`utm_content`（VARCHAR(255)，NULL）：UTM 参数。
- `referrer`（TEXT，NULL）：来源 referrer。
- `landing_page`（TEXT，NULL）：落地页。
- `user_agent`（TEXT，NULL）：UA。
- `ip_country`（VARCHAR(10)，NULL）：IP 国家。
- `device_type`（VARCHAR(50)，NULL）：设备类型。
- `first_touch_at`（TIMESTAMPTZ，默认 `now()`）：首次触点时间。
- `last_touch_at`（TIMESTAMPTZ，默认 `now()`）：最近触点时间。
- `converted_at`（TIMESTAMPTZ，NULL）：转化时间（若有）。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：记录时间。

## 枚举：abandoned_cart_status_enum

**用途**：弃购（abandoned cart）生命周期状态。

**取值**
- `active`、`abandoned`、`recovered`、`email_sent`、`unsubscribed`

## 表：abandoned_carts

**用途**：用于弃购挽回的购物车快照。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
- `session_id`（VARCHAR(100)，NOT NULL）：会话标识。
- `customer_email`（VARCHAR(255)，NULL）：客户邮箱。
- `customer_name`（VARCHAR(255)，NULL）：客户姓名。
- `items`（JSONB，NOT NULL，默认 `[]`）：购物车条目。
- `subtotal`（DECIMAL(10,2)，默认 `0`）：小计。
- `currency`（VARCHAR(10)，默认 `USD`）：货币。
- `status`（abandoned_cart_status_enum，默认 `active`）：状态。
- `recovery_email_count`（INTEGER，默认 `0`）：挽回邮件发送次数。
- `last_email_sent_at`（TIMESTAMPTZ，NULL）：最近一次发送挽回邮件时间。
- `recovered_order_id`（UUID，NULL，FK -> `orders.id` ON DELETE SET NULL）：挽回后关联的订单。
- `utm_tracking_id`（UUID，NULL，FK -> `utm_tracking.id` ON DELETE SET NULL）：关联归因记录。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）
- `abandoned_at`（TIMESTAMPTZ，NULL）：标记为弃购时间。
- `recovered_at`（TIMESTAMPTZ，NULL）：标记为挽回时间。

## 枚举：pixel_platform_enum / pixel_event_enum

**用途**：统一像素平台与事件名称，用于 Pixel 追踪。

**取值**
- `pixel_platform_enum`：`facebook`、`google`、`tiktok`、`pinterest`
- `pixel_event_enum`：`PageView`、`ViewContent`、`AddToCart`、`InitiateCheckout`、`AddPaymentInfo`、`Purchase`、`Lead`、`CompleteRegistration`、`Search`、`CustomEvent`

## 表：pixel_events

**用途**：平台级 Pixel 事件存储（每个平台/每次事件一条记录）。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
- `platform`（pixel_platform_enum，NOT NULL）：平台。
- `event_name`（pixel_event_enum，NOT NULL）：事件名。
- `custom_event_name`（VARCHAR(100)，NULL）：自定义事件名（当 `event_name = CustomEvent` 时）。
- `event_id`（VARCHAR(100)，NULL）：事件去重 id（可选）。
- `session_id`（VARCHAR(100)，NULL）：会话 id。
- `external_id`（VARCHAR(255)，NULL）：外部用户/会话标识（可选）。
- `user_email_hash`（VARCHAR(64)，NULL）：邮箱 hash。
- `user_phone_hash`（VARCHAR(64)，NULL）：手机号 hash。
- `user_ip`（VARCHAR(45)，NULL）：用户 IP。
- `user_agent`（TEXT，NULL）：UA。
- `event_data`（JSONB，默认 `{}`）：事件扩展数据。
- `currency`（VARCHAR(10)，NULL）：货币。
- `value`（DECIMAL(10,2)，NULL）：金额/价值。
- `content_ids`（TEXT[]，NULL）：内容/商品 id 列表。
- `content_type`（VARCHAR(50)，NULL）：内容类型。
- `num_items`（INTEGER，NULL）：数量。
- `order_id`（UUID，NULL，FK -> `orders.id` ON DELETE SET NULL）：关联订单。
- `sent_to_api`（BOOLEAN，默认 `false`）：是否已发送到平台 API。
- `api_response`（JSONB，NULL）：平台响应。
- `api_sent_at`（TIMESTAMPTZ，NULL）：发送时间。
- `created_at`（TIMESTAMPTZ，默认 `now()`）：记录时间。

## 表：email_subscriptions

**用途**：邮件订阅偏好与退订 token 管理。

**字段**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
- `email`（VARCHAR(255)，NOT NULL）：邮箱。
- `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE SET NULL）：关联客户。
- `marketing_emails`（BOOLEAN，默认 `true`）：营销邮件开关。
- `abandoned_cart_emails`（BOOLEAN，默认 `true`）：弃购挽回邮件开关。
- `order_updates`（BOOLEAN，默认 `true`）：订单更新通知开关。
- `unsubscribed_at`（TIMESTAMPTZ，NULL）：退订时间。
- `unsubscribe_reason`（TEXT，NULL）：退订原因。
- `unsubscribe_token`（VARCHAR(64)，UNIQUE，NULL）：退订 token。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）

**约束**
- 唯一约束：`unique_email_subscription_per_brand (brand_id, email)`

## 表：tracking_pixels_config

**用途**：品牌维度的 Pixel 脚本与服务端转化（Conversions API）配置。

**字段（013 + 018）**
- `id`（UUID，PK，默认 `uuid_generate_v4()`）
- `brand_id`（UUID，NOT NULL，FK -> `brands.id` ON DELETE CASCADE，UNIQUE）：品牌（每个品牌最多一条配置）。
- `facebook_pixel_id`（VARCHAR(50)，NULL）
- `facebook_access_token`（TEXT，NULL）
- `facebook_test_event_code`（VARCHAR(50)，NULL）
- `google_ads_id`（VARCHAR(50)，NULL）
- `google_conversion_label`（VARCHAR(50)，NULL）
- `google_remarketing_id`（VARCHAR(50)，NULL）
- `google_customer_id`（VARCHAR(50)，NULL）：Google 服务端转化 customer id（018）。
- `google_conversion_action_id`（VARCHAR(50)，NULL）：Google 服务端转化 action id（018）。
- `google_access_token`（TEXT，NULL）：Google Ads API 的 OAuth token（018）。
- `tiktok_pixel_id`（VARCHAR(50)，NULL）
- `tiktok_access_token`（TEXT，NULL）
- `pinterest_tag_id`（VARCHAR(50)，NULL）
- `pinterest_access_token`（TEXT，NULL）
- `pinterest_ad_account_id`（VARCHAR(50)，NULL）：Pinterest Conversions API 广告账户 id（018）。
- `server_side_enabled`（BOOLEAN，默认 `false`）：是否启用服务端转化。
- `hash_user_data`（BOOLEAN，默认 `true`）：是否对用户数据进行 hash。
- `created_at`（TIMESTAMPTZ，默认 `now()`）
- `updated_at`（TIMESTAMPTZ，默认 `now()`）
---

 # 邮件自动化（014_email_sequences.sql）
 
 ## 枚举：enrollment_status_enum
 
 **用途**：邮件序列（sequence）入组/执行状态。
 
 **取值**
 - `active`、`completed`、`paused`、`cancelled`、`converted`
 
 ## 表：email_sequences
 
 **用途**：定义邮件序列模板（例如欢迎序列、弃购挽回序列、复购提醒等）。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
 - `name`（VARCHAR(100)，NOT NULL）：序列名称。
 - `slug`（VARCHAR(100)，NOT NULL）：slug（品牌内唯一）。
 - `description`（TEXT，NULL）：描述。
 - `sequence_type`（VARCHAR(50)，NOT NULL）：序列类型。
 - `trigger_event`（VARCHAR(50)，NOT NULL）：触发事件。
 - `trigger_delay_hours`（INTEGER，默认 `0`）：触发延迟（小时）。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）
 - `updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 **约束**
 - 唯一约束：`unique_email_seq_slug_per_brand (brand_id, slug)`
 
 ## 表：email_sequence_steps
 
 **用途**：序列中的单个邮件步骤。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `sequence_id`（UUID，NOT NULL，FK -> `email_sequences.id` ON DELETE CASCADE）：所属序列。
 - `step_number`（INTEGER，NOT NULL）：步骤号。
 - `name`（VARCHAR(100)，NOT NULL）：步骤名称。
 - `subject`（VARCHAR(255)，NOT NULL）：邮件主题。
 - `preview_text`（VARCHAR(255)，NULL）：预览文本。
 - `html_content`（TEXT，NOT NULL）：HTML 内容。
 - `plain_text_content`（TEXT，NULL）：纯文本内容。
 - `delay_hours`（INTEGER，NOT NULL，默认 `0`）：相对延迟（小时）。
 - `send_conditions`（JSONB，默认 `{}`）：发送条件（可选）。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）
 - `updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 **约束**
 - 唯一约束：`unique_step_number_per_sequence (sequence_id, step_number)`
 
 ## 表：email_sequence_enrollments
 
 **用途**：跟踪订阅者进入序列后的执行状态。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
 - `sequence_id`（UUID，NOT NULL，FK -> `email_sequences.id` ON DELETE CASCADE）：所属序列。
 - `email`（VARCHAR(255)，NOT NULL）：订阅邮箱。
 - `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE SET NULL）：关联客户。
 - `current_step`（INTEGER，默认 `0`）：当前步骤。
 - `status`（enrollment_status_enum，默认 `active`）：入组状态。
 - `emails_sent`/`emails_opened`/`emails_clicked`（INTEGER，默认 `0`）：统计计数。
 - `enrolled_at`（TIMESTAMPTZ，默认 `now()`）：入组时间。
 - `next_email_at`（TIMESTAMPTZ，NULL）：下次发送时间。
 - `last_email_at`（TIMESTAMPTZ，NULL）：最近发送时间。
 - `completed_at`（TIMESTAMPTZ，NULL）：完成时间。
 - `trigger_data`（JSONB，默认 `{}`）：触发上下文数据。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）
 - `updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 **约束**
 - 唯一约束：`unique_enrollment_per_sequence (sequence_id, email)`
 
 ## 表：email_sequence_logs
 
 **用途**：逐封邮件发送日志。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `enrollment_id`（UUID，NOT NULL，FK -> `email_sequence_enrollments.id` ON DELETE CASCADE）：入组记录。
 - `step_id`（UUID，NOT NULL，FK -> `email_sequence_steps.id` ON DELETE CASCADE）：步骤。
 - `sent_at`（TIMESTAMPTZ，默认 `now()`）：发送时间。
 - `delivered_at`/`opened_at`/`clicked_at`（TIMESTAMPTZ，NULL）：投递/打开/点击时间。
 - `message_id`（VARCHAR(255)，NULL）：邮件服务商消息 id。
 - `send_error`（TEXT，NULL）：发送错误信息。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：记录时间。
 
 ## 枚举：reminder_status_enum
 
 **用途**：复购提醒队列状态。
 
 **取值**
 - `pending`、`sent`、`skipped`、`failed`
 
 ## 表：repurchase_reminders
 
 **用途**：按商品/分类配置复购提醒模板。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
 - `product_id`（UUID，NULL，FK -> `products.id` ON DELETE SET NULL）：关联商品。
 - `category_id`（UUID，NULL，FK -> `categories.id` ON DELETE SET NULL）：关联分类。
 - `name`（VARCHAR(100)，NOT NULL）：提醒名称。
 - `reminder_days`（INTEGER，NOT NULL）：下单后多少天提醒。
 - `subject`（VARCHAR(255)，NOT NULL）：邮件主题。
 - `html_content`（TEXT，NOT NULL）：HTML 内容。
 - `discount_code`（VARCHAR(50)，NULL）：优惠码（可选）。
 - `discount_percent`（DECIMAL(5,2)，NULL）：折扣百分比（可选）。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）
 - `updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 ## 表：repurchase_reminder_queue
 
 **用途**：待发送的复购提醒任务队列。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
 - `reminder_id`（UUID，NOT NULL，FK -> `repurchase_reminders.id` ON DELETE CASCADE）：提醒模板。
 - `customer_email`（VARCHAR(255)，NOT NULL）：客户邮箱。
 - `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE SET NULL）：关联客户。
 - `order_id`（UUID，NULL，FK -> `orders.id` ON DELETE SET NULL）：关联订单。
 - `scheduled_at`（TIMESTAMPTZ，NOT NULL）：计划发送时间。
 - `status`（reminder_status_enum，默认 `pending`）：队列状态。
 - `sent_at`（TIMESTAMPTZ，NULL）：实际发送时间。
 - `send_error`（TEXT，NULL）：发送错误信息。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
 
 ---
 
 # Web 性能监控（015_web_vitals.sql）
 
 ## 表：web_vitals
 
 **用途**：存储原始 Core Web Vitals 测量数据。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
 - `page_url`（TEXT，NOT NULL）：完整 URL。
 - `page_path`（VARCHAR(500)，NULL）：路径。
 - `page_type`（VARCHAR(50)，NULL）：页面类型。
 - `lcp`/`fid`/`cls`/`inp`/`ttfb`/`fcp`（DECIMAL，NULL）：各项指标值。
 - `lcp_rating`/`fid_rating`/`cls_rating`/`inp_rating`（VARCHAR(10)，NULL）：指标等级（good/needs-improvement/poor）。
 - `device_type`（VARCHAR(20)，NULL）：设备类型。
 - `connection_type`/`effective_type`（VARCHAR(20)，NULL）：网络类型。
 - `user_agent`（TEXT，NULL）：UA。
 - `browser_name`/`browser_version`/`os_name`（VARCHAR，NULL）：浏览器/系统信息。
 - `session_id`（VARCHAR(100)，NULL）：会话 id。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：采集时间。
 
 ## 表：web_vitals_aggregates
 
 **用途**：用于报表的按日聚合指标。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
 - `date`（DATE，NOT NULL）：日期。
 - `page_path`（VARCHAR(500)，NULL）：路径。
 - `page_type`（VARCHAR(50)，NULL）：页面类型。
 - `device_type`（VARCHAR(20)，NULL）：设备类型。
 - `sample_count`（INTEGER，默认 `0`）：样本数。
 - LCP/FID/CLS/INP/TTFB 的分位数与百分比指标（DECIMAL，NULL）
 - `created_at`（TIMESTAMPTZ，默认 `now()`）
 - `updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 **约束**
 - 唯一约束：`unique_vitals_agg (brand_id, date, page_path, device_type)`
 
 ## 枚举：alert_severity_enum / alert_status_enum
 
 **取值**
 - `alert_severity_enum`：`warning`、`critical`
 - `alert_status_enum`：`active`、`acknowledged`、`resolved`
 
 ## 表：web_vitals_alerts
 
 **用途**：当性能指标恶化时生成告警。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）
 - `metric`（VARCHAR(10)，NOT NULL）：指标名称。
 - `page_path`（VARCHAR(500)，NULL）：路径。
 - `device_type`（VARCHAR(20)，NULL）：设备类型。
 - `severity`（alert_severity_enum，NOT NULL）：告警级别。
 - `status`（alert_status_enum，默认 `active`）：告警状态。
 - `threshold_value`/`current_value`/`previous_value`（DECIMAL，NULL）：阈值/当前值/上次值。
 - `message`（TEXT，NULL）：告警描述。
 - `triggered_at`（TIMESTAMPTZ，默认 `now()`）：触发时间。
 - `acknowledged_at`/`resolved_at`（TIMESTAMPTZ，NULL）：确认/解决时间。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
 
 ---

 # 高级 SEO 分析（016_advanced_seo_analysis.sql）
 
 > 注意：016 当前包含一个引用 `blog_posts` 的辅助函数，但本仓库 schema 中并不存在 `blog_posts`（Blog 内容存储在 `content_library`）。如果要直接执行 016，请先验证/调整这些函数。
 
 ## 表：page_link_graph
 
 **用途**：记录页面之间发现的链接边（内链/外链）。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）：所属品牌。
 - `source_url`（VARCHAR(1000)，NOT NULL）：来源 URL。
 - `source_type`（VARCHAR(50)，NULL）：来源类型。
 - `source_id`（UUID，NULL）：来源对象 id。
 - `target_url`（VARCHAR(1000)，NOT NULL）：目标 URL。
 - `target_type`（VARCHAR(50)，NULL）：目标类型。
 - `target_id`（UUID，NULL）：目标对象 id。
 - `anchor_text`（VARCHAR(500)，NULL）：锚文本。
 - `is_internal`（BOOLEAN，默认 `true`）：是否站内链接。
 - `link_position`（VARCHAR(50)，NULL）：链接位置（例如 header/body/footer）。
 - `discovered_at`（TIMESTAMPTZ，默认 `now()`）：发现时间。
 
 **约束**
 - 唯一约束：`(brand_id, source_url, target_url)`
 
 ## 表：orphan_pages
 
 **用途**：存储“孤立页面”检测结果（几乎没有站内入链的页面）。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `page_url`（VARCHAR(1000)，NOT NULL）：页面 URL。
 - `page_type`（VARCHAR(50)，NOT NULL）：页面类型。
 - `page_id`（UUID，NULL）：页面对象 id。
 - `page_title`（VARCHAR(255)，NULL）：页面标题。
 - `incoming_links_count`（INTEGER，默认 `0`）：入链数量。
 - `is_in_sitemap`（BOOLEAN，默认 `true`）：是否在 sitemap 中。
 - `is_in_navigation`（BOOLEAN，默认 `false`）：是否在导航中。
 - `is_resolved`（BOOLEAN，默认 `false`）：是否已处理。
 - `resolved_at`（TIMESTAMPTZ，NULL）：处理时间。
 - `resolution_action`（VARCHAR(100)，NULL）：处理方式。
 - `detected_at`（TIMESTAMPTZ，默认 `now()`）：检测时间。
 - `last_checked_at`（TIMESTAMPTZ，默认 `now()`）：最近检查时间。
 
 **约束**
 - 唯一约束：`(brand_id, page_url)`
 
 ## 表：link_density_analysis
 
 **用途**：按页面存储链接密度分析结果。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `page_url`（VARCHAR(1000)，NOT NULL）：页面 URL。
 - `page_type`（VARCHAR(50)，NULL）：页面类型。
 - `page_id`（UUID，NULL）：页面对象 id。
 - `word_count`/`internal_links_count`/`external_links_count`/`broken_links_count`（INTEGER，默认 `0`）：词数/内链/外链/坏链。
 - `link_density`（DECIMAL(5,2)，NULL）：链接密度。
 - `ideal_density_min`（DECIMAL(5,2)，默认 `1.0`）：建议密度下限。
 - `ideal_density_max`（DECIMAL(5,2)，默认 `3.0`）：建议密度上限。
 - `density_status`（VARCHAR(20)，NULL）：密度状态。
 - `suggested_links`（JSONB，默认 `[]`）：建议补充的链接。
 - `analyzed_at`（TIMESTAMPTZ，默认 `now()`）：分析时间。
 
 **约束**
 - 唯一约束：`(brand_id, page_url)`
 
 ## 表：related_content
 
 **用途**：存储“相关推荐”结果（可 AI 生成）。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `source_type`（VARCHAR(50)，NOT NULL）：来源类型。
 - `source_id`（UUID，NOT NULL）：来源 id。
 - `related_type`（VARCHAR(50)，NOT NULL）：相关推荐类型。
 - `related_id`（UUID，NOT NULL）：相关推荐 id。
 - `relevance_score`（DECIMAL(5,4)，NULL）：相关度。
 - `relationship_type`（VARCHAR(50)，NULL）：关系类型。
 - `ai_reasoning`（TEXT，NULL）：AI 推理说明。
 - `is_ai_generated`（BOOLEAN，默认 `true`）：是否 AI 生成。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `display_order`（INTEGER，默认 `0`）：展示排序。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）
 - `updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 **约束**
 - 唯一约束：`(brand_id, source_type, source_id, related_type, related_id)`
 
 ## 表：sitemap_shards
 
 **用途**：大站点的 sitemap 分片生成结果存储。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `shard_type`（VARCHAR(50)，NOT NULL）：分片类型。
 - `shard_index`（INTEGER，默认 `0`）：分片索引。
 - `url_count`（INTEGER，默认 `0`）：URL 数量。
 - `urls`（JSONB，默认 `[]`）：URL 列表。
 - `last_generated_at`（TIMESTAMPTZ，默认 `now()`）：最近生成时间。
 - `file_size_bytes`（INTEGER，NULL）：文件大小。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 
 **约束**
 - 唯一约束：`(brand_id, shard_type, shard_index)`
 
 ## 表：keyword_research
 
 **用途**：关键词研究语料与指标（含意图与 AI 建议）。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `keyword`（VARCHAR(255)，NOT NULL）：关键词。
 - `keyword_normalized`（VARCHAR(255)，NULL）：标准化关键词。
 - `search_intent`（VARCHAR(50)，NULL）：意图分类。
 - `intent_confidence`（DECIMAL(5,4)，NULL）：意图置信度。
 - `search_volume_monthly`（INTEGER，NULL）：月搜索量。
 - `keyword_difficulty`（INTEGER，NULL）：难度。
 - `cpc_estimate`（DECIMAL(10,2)，NULL）：CPC 估算。
 - `competition_level`（VARCHAR(20)，NULL）：竞争程度。
 - `trend_direction`（VARCHAR(20)，NULL）：趋势方向。
 - `seasonal_peak_months`（INTEGER[]，NULL）：季节性峰值月份。
 - `related_keywords`（JSONB，默认 `[]`）：相关关键词。
 - `long_tail_variations`（JSONB，默认 `[]`）：长尾变体。
 - `target_page_type`（VARCHAR(50)，NULL）：目标页面类型。
 - `target_page_id`（UUID，NULL）：目标页面 id。
 - `current_ranking`（INTEGER，NULL）：当前排名（可选缓存）。
 - `ai_suggestions`（TEXT，NULL）：AI 建议。
 - `is_tracked`（BOOLEAN，默认 `false`）：是否加入跟踪。
 - `priority`（VARCHAR(20)，默认 `medium`）：优先级。
 - `created_at`/`updated_at`（TIMESTAMPTZ，默认 `now()`）
 - `last_researched_at`（TIMESTAMPTZ，NULL）：最近研究时间。
 
 **约束**
 - 唯一约束：`(brand_id, keyword_normalized)`
 
 ## 表：eeat_scores
 
 **用途**：内容的 E-E-A-T 评分缓存。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `content_type`（VARCHAR(50)，NOT NULL）：内容类型。
 - `content_id`（UUID，NULL）：内容 id。
 - `experience_score`/`expertise_score`/`authoritativeness_score`/`trustworthiness_score`/`overall_score`（INTEGER，默认 `0`）：分项与总分。
 - `experience_factors`/`expertise_factors`/`authority_factors`/`trust_factors`（JSONB，默认 `{}`）：评分因子。
 - `improvement_suggestions`（JSONB，默认 `[]`）：改进建议。
 - `analyzed_at`（TIMESTAMPTZ，默认 `now()`）：分析时间。
 
 **约束**
 - 唯一约束：`(brand_id, content_type, content_id)`
 
 ## 表：keyword_rankings
 
 **用途**：关键词排名检查的时间序列记录。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `keyword_id`（UUID，NULL，FK -> `keyword_research.id` ON DELETE CASCADE）：关联关键词研究记录。
 - `keyword`（VARCHAR(255)，NOT NULL）：关键词（冗余）。
 - `position`（INTEGER，NULL）：排名。
 - `previous_position`（INTEGER，NULL）：上次排名。
 - `position_change`（INTEGER，NULL）：排名变化。
 - `search_engine`（VARCHAR(20)，默认 `google`）：搜索引擎。
 - `country`（VARCHAR(10)，默认 `us`）：国家。
 - `device_type`（VARCHAR(20)，默认 `desktop`）：设备类型。
 - `ranking_url`（VARCHAR(1000)，NULL）：排名 URL。
 - `checked_at`（TIMESTAMPTZ，默认 `now()`）：检查时间。
 
 ## 表：index_status
 
 **用途**：存储页面索引与覆盖状态（例如 Search Console 的覆盖/索引信息）。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `page_url`（VARCHAR(1000)，NOT NULL）：页面 URL。
 - `page_type`（VARCHAR(50)，NULL）：页面类型。
 - `page_id`（UUID，NULL）：页面对象 id。
 - `is_indexed`（BOOLEAN，NULL）：是否已索引。
 - `index_status`（VARCHAR(50)，NULL）：索引状态。
 - `index_coverage_state`（VARCHAR(100)，NULL）：覆盖状态。
 - `last_crawl_date`（TIMESTAMPTZ，NULL）：最近抓取。
 - `crawl_frequency`（VARCHAR(20)，NULL）：抓取频率。
 - `indexing_issues`（JSONB，默认 `[]`）：问题列表。
 - `is_mobile_friendly`（BOOLEAN，NULL）：是否移动端友好。
 - `mobile_issues`（JSONB，默认 `[]`）：移动问题。
 - `has_rich_results`（BOOLEAN，NULL）：是否有富结果。
 - `rich_result_types`（JSONB，默认 `[]`）：富结果类型。
 - `last_checked_at`（TIMESTAMPTZ，默认 `now()`）：最近检查。
 
 **约束**
 - 唯一约束：`(brand_id, page_url)`
 
 ## 表：automated_reports
 
 **用途**：自动化报告的调度配置。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `report_name`（VARCHAR(255)，NOT NULL）：报告名称。
 - `report_type`（VARCHAR(50)，NOT NULL）：报告类型。
 - `schedule_frequency`（VARCHAR(20)，NULL）：频率。
 - `schedule_day`（INTEGER，NULL）：日/周的触发日。
 - `schedule_time`（TIME，默认 `09:00:00`）：触发时间。
 - `last_run_at`/`next_run_at`（TIMESTAMPTZ，NULL）：上次/下次运行时间。
 - `recipients`（JSONB，默认 `[]`）：收件人列表。
 - `include_sections`（JSONB，默认 `["overview", "rankings", "issues", "recommendations"]`）：包含章节。
 - `custom_filters`（JSONB，默认 `{}`）：过滤条件。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `created_at`/`updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 ## 表：report_history
 
 **用途**：归档每一次生成的报告。
 
 **字段**
 - `id`（UUID，PK，默认 `gen_random_uuid()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `report_id`（UUID，NULL，FK -> `automated_reports.id` ON DELETE CASCADE）：报告配置。
 - `report_data`（JSONB，NOT NULL）：报告内容。
 - `overall_seo_score`（INTEGER，NULL）：总体 SEO 分数。
 - `total_pages_analyzed`（INTEGER，NULL）：分析页面数。
 - `issues_found`（INTEGER，NULL）：发现问题数。
 - `improvements_since_last`（INTEGER，NULL）：相对上次改善数。
 - `delivered_to`（JSONB，默认 `[]`）：投递对象。
 - `delivery_status`（VARCHAR(20)，NULL）：投递状态。
 - `generated_at`（TIMESTAMPTZ，默认 `now()`）：生成时间。
 
 ---

 # 用户留存（017_user_retention.sql）
 
 ## 表：member_levels
 
 **用途**：品牌维度的会员等级/会员体系配置。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id` ON DELETE CASCADE）
 - `level_name`（VARCHAR(100)，NOT NULL）：等级名称。
 - `level_code`（VARCHAR(50)，NOT NULL）：等级编码。
 - `level_order`（INT，NOT NULL，默认 `0`）：等级顺序。
 - `min_points`/`min_orders`（INT，默认 `0`）：升级条件。
 - `min_spent`（DECIMAL(12,2)，默认 `0`）：升级所需消费。
 - `points_multiplier`（DECIMAL(3,2)，默认 `1.0`）：积分倍率。
 - `discount_percentage`（DECIMAL(5,2)，默认 `0`）：折扣百分比。
 - `free_shipping_threshold`（DECIMAL(12,2)，NULL）：免邮门槛。
 - `exclusive_products`（BOOLEAN，默认 `false`）：是否专享商品。
 - `early_access_days`（INT，默认 `0`）：提前访问天数。
 - `birthday_bonus_points`（INT，默认 `0`）：生日奖励积分。
 - `badge_color`（VARCHAR(20)，NULL）：徽章颜色。
 - `badge_icon`（VARCHAR(100)，NULL）：徽章图标。
 - `description`（TEXT，NULL）：描述。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `created_at`/`updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 **约束**
 - 唯一约束：`(brand_id, level_code)`
 
 ## 表：customer_memberships
 
 **用途**：客户的会员状态与积分余额。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE CASCADE）
 - `current_level_id`（UUID，NULL，FK -> `member_levels.id`）：当前等级。
 - `points_balance`（INT，默认 `0`）：当前积分。
 - `lifetime_points`（INT，默认 `0`）：累计积分。
 - `total_orders`（INT，默认 `0`）：订单数。
 - `total_spent`（DECIMAL(12,2)，默认 `0`）：累计消费。
 - `referral_code`（VARCHAR(20)，UNIQUE，NULL）：推荐码。
 - `referred_by`（UUID，NULL，FK -> `customers.id`）：推荐人（客户 id）。
 - `referral_count`（INT，默认 `0`）：推荐人数。
 - `joined_at`（TIMESTAMPTZ，默认 `now()`）：加入时间。
 - `level_updated_at`/`last_activity_at`（TIMESTAMPTZ，NULL）：等级变更/最近活跃。
 - `birthday`（DATE，NULL）：生日。
 - `created_at`/`updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 **约束**
 - 唯一约束：`(brand_id, customer_id)`
 
 ## 表：points_ledger
 
 **用途**：积分流水账（只追加，不更新的 ledger）。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `customer_id`（UUID，NULL，FK -> `customers.id` ON DELETE CASCADE）
 - `membership_id`（UUID，NULL，FK -> `customer_memberships.id` ON DELETE CASCADE）
 - `transaction_type`（VARCHAR(50)，NOT NULL）：交易类型。
 - `points_amount`（INT，NOT NULL）：本次变动积分。
 - `points_balance_after`（INT，NOT NULL）：变动后余额。
 - `reference_type`（VARCHAR(50)，NULL）：关联对象类型。
 - `reference_id`（UUID，NULL）：关联对象 id。
 - `description`（TEXT，NULL）：描述。
 - `multiplier_applied`（DECIMAL(3,2)，默认 `1.0`）：倍率。
 - `expires_at`/`expired_at`（TIMESTAMPTZ，NULL）：过期时间/实际过期时间。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
 - `created_by`（UUID，NULL）：创建者（可选）。
 
 ## 表：points_rules
 
 **用途**：积分获取规则。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `rule_name`（VARCHAR(100)，NOT NULL）：规则名称。
 - `rule_type`（VARCHAR(50)，NOT NULL）：规则类型。
 - `points_per_dollar`（DECIMAL(5,2)，NULL）：每消费金额积分。
 - `fixed_points`（INT，NULL）：固定积分。
 - `min_order_amount`（DECIMAL(12,2)，NULL）：最低订单金额。
 - `max_points_per_order`（INT，NULL）：单笔上限。
 - `product_category_id`（UUID，NULL）：限定分类（可选）。
 - `start_date`/`end_date`（TIMESTAMPTZ，NULL）：生效区间。
 - `points_validity_days`（INT，默认 `365`）：积分有效期（天）。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `priority`（INT，默认 `0`）：优先级。
 - `created_at`/`updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 ## 表：points_redemptions
 
 **用途**：积分兑换选项。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `redemption_name`（VARCHAR(100)，NOT NULL）：兑换名称。
 - `redemption_type`（VARCHAR(50)，NOT NULL）：兑换类型。
 - `points_required`（INT，NOT NULL）：所需积分。
 - `discount_amount`（DECIMAL(12,2)，NULL）：立减金额。
 - `discount_percent`（DECIMAL(5,2)，NULL）：折扣百分比。
 - `product_id`（UUID，NULL）：限定商品（可选）。
 - `min_order_amount`（DECIMAL(12,2)，NULL）：最低订单金额。
 - `max_uses_per_customer`（INT，NULL）：每用户使用上限。
 - `total_uses_limit`（INT，NULL）：总使用上限。
 - `current_uses`（INT，默认 `0`）：已使用次数。
 - `description`（TEXT，NULL）：描述。
 - `image_url`（VARCHAR(500)，NULL）：图片。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `start_date`/`end_date`（TIMESTAMPTZ，NULL）：生效区间。
 - `created_at`/`updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 ## 表：referral_config
 
 **用途**：推荐有礼（Referral Program）配置（品牌级）。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`，UNIQUE）：每品牌一条配置。
 - `referrer_points`（INT，默认 `0`）：推荐人积分奖励。
 - `referrer_discount_amount`（DECIMAL(12,2)，NULL）：推荐人优惠金额。
 - `referrer_discount_percent`（DECIMAL(5,2)，NULL）：推荐人优惠百分比。
 - `referee_points`（INT，默认 `0`）：被推荐人积分奖励。
 - `referee_discount_amount`（DECIMAL(12,2)，NULL）：被推荐人优惠金额。
 - `referee_discount_percent`（DECIMAL(5,2)，NULL）：被推荐人优惠百分比。
 - `min_order_amount`（DECIMAL(12,2)，默认 `0`）：最低订单金额。
 - `require_first_purchase`（BOOLEAN，默认 `true`）：是否要求首购。
 - `max_referrals_per_customer`（INT，NULL）：每客户最大推荐数。
 - `share_message`（TEXT，NULL）：分享文案。
 - `email_subject`（VARCHAR(255)，NULL）：邮件主题。
 - `email_template`（TEXT，NULL）：邮件模板。
 - `is_active`（BOOLEAN，默认 `true`）：是否启用。
 - `created_at`/`updated_at`（TIMESTAMPTZ，默认 `now()`）
 
 ## 表：referrals
 
 **用途**：记录推荐关系与奖励发放状态。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `referrer_id`（UUID，NULL，FK -> `customers.id` ON DELETE CASCADE）：推荐人客户 id。
 - `referee_id`（UUID，NULL，FK -> `customers.id` ON DELETE CASCADE）：被推荐人客户 id。
 - `referral_code`（VARCHAR(20)，NOT NULL）：推荐码。
 - `status`（VARCHAR(30)，默认 `pending`）：状态。
 - `qualifying_order_id`（UUID，NULL，FK -> `orders.id`）：达标订单。
 - `order_amount`（DECIMAL(12,2)，NULL）：订单金额。
 - 推荐人奖励字段（VARCHAR/DECIMAL/BOOLEAN/TIMESTAMPTZ，NULL）
 - 被推荐人奖励字段（VARCHAR/DECIMAL/BOOLEAN/TIMESTAMPTZ，NULL）
 - `referred_at`（TIMESTAMPTZ，默认 `now()`）：推荐发生时间。
 - `completed_at`/`expires_at`（TIMESTAMPTZ，NULL）：完成/过期时间。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
 
 ## 表：level_history
 
 **用途**：记录会员等级变更历史。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NULL，FK -> `brands.id`）
 - `customer_id`（UUID，NULL，FK -> `customers.id`）
 - `membership_id`（UUID，NULL，FK -> `customer_memberships.id`）
 - `previous_level_id`/`new_level_id`（UUID，NULL，FK -> `member_levels.id`）：变更前/后等级。
 - `change_type`（VARCHAR(20)，NOT NULL）：变更类型。
 - `reason`（TEXT，NULL）：原因。
 - `points_at_change`/`orders_at_change`（INT，NULL）：变更时积分/订单数。
 - `spent_at_change`（DECIMAL(12,2)，NULL）：变更时消费。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：记录时间。
 
 ---

 # 转化（事件级）（018_conversions_events.sql）
 
 ## 表：conversion_events
 
 **用途**：事件级转化日志（同一业务事件汇总多平台发送结果到一行）。
 
 **字段**
 - `id`（UUID，PK，默认 `uuid_generate_v4()`）
 - `brand_id`（UUID，NOT NULL，FK -> `brands.id`）：所属品牌。
 - `event_name`（TEXT，NOT NULL）：事件名称。
 - `event_id`（TEXT，NULL）：业务事件标识（用于去重/追踪）。
 - `event_data`（JSONB，默认 `{}`）：用于重试/回放的事件 payload。
 - `platforms_sent`（TEXT[]，默认 `{}`）：尝试发送的平台集合。
 - `results`（JSONB，默认 `{}`）：各平台发送结果。
 - `ip_address`（VARCHAR(45)，NULL）：IP。
 - `user_agent`（TEXT，NULL）：UA。
 - `retry_count`（INTEGER，默认 `0`）：重试次数。
 - `last_retry_at`（TIMESTAMPTZ，NULL）：最近重试时间。
 - `created_at`（TIMESTAMPTZ，默认 `now()`）：创建时间。
 
 **索引**
 - `idx_conversion_events_brand`、`idx_conversion_events_created`、`idx_conversion_events_name`、`idx_conversion_events_event_id`
