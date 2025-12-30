# Database Data Dictionary (Public Schema)

This document describes the **tables defined by `docs/database` migrations (001-018)**.

## Conventions

- **Multi-tenant**: most business tables contain `brand_id` referencing `brands(id)`.
- **Timestamps**: most tables use `created_at`/`updated_at` (triggered by `update_updated_at()` from 001).
- **RLS**: many tables have Row Level Security enabled; backend should use `service_role` for full access.
- **IDs**: UUID primary keys; defaults vary between `uuid_generate_v4()` and `gen_random_uuid()` depending on migration.

## Relationship overview (high level)

- `brands` is the root tenant.
- Catalog: `brands` -> `categories` -> `products`.
- Commerce: `brands` -> `orders` (contains `items` JSONB) and `customers`.
- Content/AI: `content_library`, `knowledge_base`, and related analysis/log tables.
- Marketing: `utm_tracking`, `abandoned_carts`, `pixel_events`, `tracking_pixels_config`, `conversion_events`.
- Admin/RBAC: `admin_users`, `admin_activity_log`, plus multi-brand assignment tables.

---

# Core Commerce (001_initial_schema.sql)

## Table: brands

**Purpose**: Multi-tenant root entity. A "brand" represents an isolated storefront.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`): Brand identifier.
- `name` (VARCHAR(100), NOT NULL): Display name.
- `slug` (VARCHAR(100), NOT NULL, UNIQUE): URL-friendly identifier.
- `domain` (VARCHAR(255), NULL): Custom domain (legacy; domain binding is extended in 011).
- `logo_url` (TEXT, NULL): Brand logo.
- `settings` (JSONB, default `{}`): Brand-level settings payload.
- `theme` (JSONB, default JSON theme object): Theme customization (added in 011).
- `custom_css` (TEXT, NULL): Brand-level custom CSS (added in 011).
- `favicon_url` (TEXT, NULL): Custom favicon URL (added in 011).
- `social_links` (JSONB, default `{}`): Social link set (added in 011).
- `contact_info` (JSONB, default `{}`): Contact info payload (added in 011).
- `owner_email` (VARCHAR(255), NOT NULL): Owner/admin contact.
- `is_active` (BOOLEAN, default `true`): Soft-enable/disable.
- `created_at` (TIMESTAMPTZ, default `now()`): Created time.
- `updated_at` (TIMESTAMPTZ, default `now()`): Updated time.

**Indexes / Constraints**
- `brands.slug` unique.
- Indexes: `idx_brands_slug`, `idx_brands_domain`, `idx_brands_active`.

**Relationships**
- Referenced by: nearly all tenant tables via `brand_id`.

## Table: categories

**Purpose**: Product categories within a brand. Supports hierarchical categories.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`): Category identifier.
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE): Owning brand.
- `name` (VARCHAR(100), NOT NULL): Category name.
- `slug` (VARCHAR(100), NOT NULL): URL slug (unique per brand).
- `description` (TEXT, NULL): Description.
- `image_url` (TEXT, NULL): Category image.
- `parent_id` (UUID, NULL, self-FK -> `categories.id` ON DELETE SET NULL): Parent category.
- `sort_order` (INTEGER, default `0`): Ordering.
- `is_active` (BOOLEAN, default `true`): Status.
- `created_at` (TIMESTAMPTZ, default `now()`): Created time.
- `updated_at` (TIMESTAMPTZ, default `now()`): Updated time.

**Indexes / Constraints**
- Unique: `unique_category_slug_per_brand (brand_id, slug)`.
- Indexes: `idx_categories_brand`, `idx_categories_slug`, `idx_categories_parent`, `idx_categories_active`.

**Relationships**
- `categories.brand_id` -> `brands.id`
- `products.category_id` -> `categories.id`

## Enum: stock_status_enum

**Purpose**: Product inventory state.

**Values**
- `in_stock`
- `low_stock`
- `out_of_stock`

## Table: products

**Purpose**: Catalog product entity.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`): Product identifier.
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE): Owning brand.
- `name` (VARCHAR(255), NOT NULL): Product name.
- `slug` (VARCHAR(255), NOT NULL): URL slug (unique per brand).
- `description` (TEXT, NULL): Long description.
- `short_description` (VARCHAR(500), NULL): Short description.
- `price` (DECIMAL(10,2), NOT NULL, CHECK >=0): Selling price.
- `compare_price` (DECIMAL(10,2), NULL): "Compare at" price.
- `cost` (DECIMAL(10,2), NULL): Cost.
- `main_image_url` (TEXT, NULL): Primary image.
- `images` (TEXT[], default `{}`): Additional image URLs.
- `category_id` (UUID, NULL, FK -> `categories.id` ON DELETE SET NULL): Category.
- `supplier_info` (JSONB, default `{}`): Supplier metadata.
- `shipping_weight` (DECIMAL(8,2), NULL): Weight.
- `shipping_time` (VARCHAR(100), NULL): Shipping estimate.
- `is_active` (BOOLEAN, default `true`): Availability.
- `is_featured` (BOOLEAN, default `false`): Featured flag.
- `stock_status` (stock_status_enum, default `in_stock`): Stock state.
- `seo_title` (VARCHAR(255), NULL): SEO title.
- `seo_description` (VARCHAR(500), NULL): SEO description.
- `created_at` (TIMESTAMPTZ, default `now()`): Created time.
- `updated_at` (TIMESTAMPTZ, default `now()`): Updated time.

**Indexes / Constraints**
- Unique: `unique_product_slug_per_brand (brand_id, slug)`.
- Full text: `idx_products_search`.
- Indexes: `idx_products_brand`, `idx_products_slug`, `idx_products_category`, `idx_products_active`, `idx_products_featured`, `idx_products_price`, `idx_products_created`.

**Relationships**
- `products.brand_id` -> `brands.id`
- `products.category_id` -> `categories.id`
- Referenced by: `orders.items` (JSONB), `reviews.product_id`, `product_views.product_id`, etc.

## Enum: order_status_enum

**Purpose**: Order lifecycle.

**Values (001)**
- `pending`, `paid`, `shipped`, `delivered`, `cancelled`, `refunded`

**Extended (005)**
- Adds: `failed`

## Table: orders

**Purpose**: Customer orders. Line items are stored in `items` (JSONB array).

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`): Order identifier.
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE): Owning brand.
- `order_number` (VARCHAR(50), NOT NULL): Human-readable order number (unique per brand).
- `customer_email` (VARCHAR(255), NOT NULL): Customer email.
- `customer_name` (VARCHAR(255), NOT NULL): Customer name.
- `customer_phone` (VARCHAR(50), NULL): Phone.
- `shipping_address` (JSONB, NOT NULL): Shipping address snapshot.
- `items` (JSONB, NOT NULL): Order line items array.
- `subtotal` (DECIMAL(10,2), NOT NULL): Subtotal.
- `shipping_cost` (DECIMAL(10,2), NOT NULL, default `0`): Shipping cost.
- `discount_amount` (DECIMAL(10,2), default `0`): Discount applied.
- `total` (DECIMAL(10,2), NOT NULL): Grand total.
- `status` (order_status_enum, default `pending`): Current status.
- `payment_intent_id` (VARCHAR(255), NULL): Stripe payment intent id.
- `tracking_number` (VARCHAR(100), NULL): Shipping tracking number.
- `tracking_url` (TEXT, NULL): Tracking URL.
- `notes` (TEXT, NULL): Internal notes.
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- Unique: `unique_order_number_per_brand (brand_id, order_number)`.
- Indexes: `idx_orders_brand`, `idx_orders_number`, `idx_orders_email`, `idx_orders_status`, `idx_orders_created`, `idx_orders_payment`.

**Relationships**
- `orders.brand_id` -> `brands.id`
- Referenced by: `stripe_events.brand_id`, `reviews.order_id`, `coupon_usages.order_id`, `utm_tracking.order_id`, `pixel_events.order_id`, etc.

## Table: customers

**Purpose**: Customer profiles per brand.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `email` (VARCHAR(255), NOT NULL): Customer email (unique per brand).
- `name` (VARCHAR(255), NULL)
- `phone` (VARCHAR(50), NULL)
- `total_orders` (INTEGER, default `0`): Cached total order count.
- `total_spent` (DECIMAL(12,2), default `0`): Cached lifetime spend.
- `first_order_at` (TIMESTAMPTZ, NULL)
- `last_order_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- Unique: `unique_customer_email_per_brand (brand_id, email)`.
- Indexes: `idx_customers_brand`, `idx_customers_email`, `idx_customers_orders`.

**Relationships**
- Referenced by: reviews, email enrollments, memberships, etc.

## Enum: chat_role_enum

**Purpose**: Role of a message in a conversation.

**Values**
- `user`, `assistant`, `system`

## Table: conversations

**Purpose**: Store chat messages for AI customer service.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `session_id` (VARCHAR(100), NOT NULL): Client session.
- `role` (chat_role_enum, NOT NULL): Message role.
- `message` (TEXT, NOT NULL): Message body.
- `metadata` (JSONB, default `{}`): Extra context.
- `created_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- Indexes: `idx_conversations_brand`, `idx_conversations_session`, `idx_conversations_created`.

## Table: knowledge_base

**Purpose**: RAG knowledge chunks for AI customer service.

**Columns (001 + 004 + 011)**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `content` (TEXT, NOT NULL): Text chunk.
- `metadata` (JSONB, default `{}`): Source metadata.
- `embedding_id` (VARCHAR(100), NULL): Optional external embedding reference.
- `created_at` (TIMESTAMPTZ, default `now()`)
- `embedding` (vector(1536), NULL): pgvector embedding.
- `source_type` (VARCHAR(50), default `'manual'`): Origin (manual/import/etc).
- `source_id` (UUID, NULL): Origin id.
- `title` (VARCHAR(500), NULL): Display title.
- `is_shared` (BOOLEAN, default `false`): Shared across brands.
- `shared_by_brand_id` (UUID, FK -> `brands.id` ON DELETE SET NULL): Owner brand of shared content.
- `source_knowledge_id` (UUID, FK -> `knowledge_base.id` ON DELETE SET NULL): Link to original knowledge.

**Indexes / Constraints**
- Indexes: `idx_knowledge_brand`, `idx_knowledge_embedding`, `idx_knowledge_search`, `idx_knowledge_embedding_vector`, `idx_knowledge_shared`, `idx_knowledge_shared_by`.

## Table: settings

**Purpose**: Key/value settings per brand.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `key` (VARCHAR(100), NOT NULL): Setting key.
- `value` (JSONB, NOT NULL): Setting value.
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- Unique: `unique_setting_key_per_brand (brand_id, key)`.
- Indexes: `idx_settings_brand`, `idx_settings_key`.

## Enum: content_type_enum / content_platform_enum / content_status_enum

**Purpose**: Content generation types/platforms/status.

**Values**
- `content_type_enum`: `script`, `caption`, `description` (+ `blog` added in 009)
- `content_platform_enum`: `tiktok`, `instagram`, `pinterest`, `facebook`, `youtube`
- `content_status_enum`: `draft`, `approved`, `published`

## Table: content_library

**Purpose**: AI-generated content and blog content storage.

**Columns (001 + 005_content_quality + 009 + 012)**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `type` (content_type_enum, NOT NULL): Content type.
- `product_id` (UUID, FK -> `products.id` ON DELETE SET NULL): Associated product.
- `content` (TEXT, NOT NULL): Generated content body.
- `platform` (content_platform_enum, NULL): Target platform.
- `status` (content_status_enum, default `draft`)
- `performance_data` (JSONB, default `{}`): Performance metrics.
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)
- `is_ai_generated` (BOOLEAN, default `true`): AI vs manual.
- `ai_generated_at` (TIMESTAMPTZ, NULL): When AI generated.
- `similarity_score` (DECIMAL(5,2), NULL): Duplicate/content similarity.
- `author_id` (UUID, FK -> `authors.id` ON DELETE SET NULL): Author for EEAT/blog.
- `title` (VARCHAR(500), NULL): Title.
- `meta_description` (VARCHAR(500), NULL): SEO meta description.
- `word_count` (INTEGER, NULL)
- `last_review_at` (TIMESTAMPTZ, NULL)
- `reviewed_by` (VARCHAR(255), NULL)
- `publish_scheduled_at` (TIMESTAMPTZ, NULL)
- `slug` (VARCHAR(255), NULL): Blog slug (unique per brand when present).
- `published_at` (TIMESTAMPTZ, NULL): Publish time.
- `originality_score` (INTEGER, NULL): 0-100 originality.
- `originality_checked_at` (TIMESTAMPTZ, NULL)
- `originality_flags` (JSONB, default `{}`)
- `differentiation_source` (JSONB, default `{}`)

**Indexes / Constraints**
- Indexes: `idx_content_brand`, `idx_content_product`, `idx_content_type`, `idx_content_platform`, `idx_content_status`, `idx_content_ai_generated`, `idx_content_author`, `idx_content_scheduled`, `idx_content_slug`, `idx_content_published`, `idx_content_originality`, `idx_content_needs_check`.
- Unique (009): `unique_content_slug_per_brand (brand_id, slug)` when created.

---

# Additional tables (005-018)

The remainder of this dictionary (authors, analytics, reviews, coupons, admin/RBAC, SEO, multi-brand, marketing, email, web vitals, advanced SEO, retention, conversions) is appended below.

---

# Content Quality & Analytics (005_content_quality.sql)

## Table: authors

**Purpose**: Author profiles for E-E-A-T and blog attribution.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `name` (VARCHAR(255), NOT NULL)
- `slug` (VARCHAR(255), NOT NULL): Unique per brand.
- `avatar_url` (TEXT, NULL)
- `bio` (TEXT, NULL)
- `credentials` (TEXT[], NULL): Credentials list.
- `social_links` (JSONB, default `{}`): Social profile links.
- `is_active` (BOOLEAN, default `true`)
- `article_count` (INTEGER, default `0`): Cached count.
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- Unique: `unique_author_slug_per_brand (brand_id, slug)`
- Indexes: `idx_authors_brand`, `idx_authors_slug`, `idx_authors_active`

**Relationships**
- `content_library.author_id` -> `authors.id`

## Table: content_publish_logs

**Purpose**: Record publish events for rate limiting and auditing.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `content_id` (UUID, NULL, FK -> `content_library.id` ON DELETE SET NULL)
- `content_type` (VARCHAR(50), NOT NULL): Denormalized type label.
- `published_at` (TIMESTAMPTZ, default `now()`)

**Indexes**
- `idx_publish_logs_brand`, `idx_publish_logs_date`

## Table: daily_analytics

**Purpose**: Daily aggregated analytics per brand.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `date` (DATE, NOT NULL)
- `page_views` (INTEGER, default `0`)
- `unique_visitors` (INTEGER, default `0`)
- `orders_count` (INTEGER, default `0`)
- `revenue` (DECIMAL(12,2), default `0`)
- `avg_order_value` (DECIMAL(10,2), default `0`)
- `cart_additions` (INTEGER, default `0`)
- `checkout_starts` (INTEGER, default `0`)
- `checkout_completions` (INTEGER, default `0`)
- `conversion_rate` (DECIMAL(5,4), default `0`)
- `traffic_sources` (JSONB, default `{}`)
- `top_products` (JSONB, default `[]`)
- `new_customers` (INTEGER, default `0`)
- `returning_customers` (INTEGER, default `0`)
- `created_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- Unique index: `idx_analytics_brand_date (brand_id, date)`
- Indexes: `idx_analytics_brand`, `idx_analytics_date`

## Table: product_views

**Purpose**: Raw product view tracking.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `product_id` (UUID, NOT NULL, FK -> `products.id` ON DELETE CASCADE)
- `session_id` (VARCHAR(100), NULL)
- `viewed_at` (TIMESTAMPTZ, default `now()`)

**Indexes**
- `idx_product_views_brand`, `idx_product_views_product`, `idx_product_views_date`

---

# Payments & Stock (005_orders_payment.sql)

## Table: stripe_events

**Purpose**: Stripe webhook event log and idempotency store.

**Columns**
- `event_id` (TEXT, PK): Stripe event id.
- `type` (TEXT, NOT NULL): Stripe event type.
- `stripe_created_at` (TIMESTAMPTZ, NULL)
- `brand_id` (UUID, NULL, FK -> `brands.id` ON DELETE SET NULL)
- `payload` (JSONB, NOT NULL): Raw Stripe payload.
- `processed_at` (TIMESTAMPTZ, NULL)
- `processing_error` (TEXT, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

**Relationships**
- `stripe_events.brand_id` -> `brands.id`

---

# Reviews (006_reviews.sql)

## Enum: review_status_enum

**Purpose**: Review moderation workflow.

**Values**
- `pending`, `approved`, `rejected`, `spam`

## Table: reviews

**Purpose**: Product reviews with moderation and merchant reply.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `product_id` (UUID, NOT NULL, FK -> `products.id` ON DELETE CASCADE)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE SET NULL)
- `order_id` (UUID, NULL, FK -> `orders.id` ON DELETE SET NULL)
- `rating` (INTEGER, NOT NULL, CHECK 1..5)
- `title` (VARCHAR(255), NULL)
- `content` (TEXT, NULL)
- `reviewer_name` (VARCHAR(255), NULL)
- `reviewer_email` (VARCHAR(255), NULL)
- `status` (review_status_enum, default `pending`)
- `is_verified_purchase` (BOOLEAN, default `false`)
- `is_featured` (BOOLEAN, default `false`)
- `images` (TEXT[], NULL)
- `merchant_reply` (TEXT, NULL)
- `merchant_reply_at` (TIMESTAMPTZ, NULL)
- `merchant_reply_by` (VARCHAR(255), NULL)
- `helpful_count` (INTEGER, default `0`)
- `not_helpful_count` (INTEGER, default `0`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)
- `approved_at` (TIMESTAMPTZ, NULL)
- `approved_by` (VARCHAR(255), NULL)

**Indexes**
- `idx_reviews_brand`, `idx_reviews_product`, `idx_reviews_customer`, `idx_reviews_status`, `idx_reviews_rating`
- Partial indexes: `idx_reviews_featured`, `idx_reviews_verified`

**Relationships**
- `reviews.product_id` -> `products.id`
- `reviews.customer_id` -> `customers.id`
- `reviews.order_id` -> `orders.id`

## Table: review_votes

**Purpose**: Helpful/unhelpful votes on reviews.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `review_id` (UUID, NOT NULL, FK -> `reviews.id` ON DELETE CASCADE)
- `voter_ip` (VARCHAR(45), NULL): Anonymous voter identifier.
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE SET NULL)
- `is_helpful` (BOOLEAN, NOT NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- `idx_review_votes_review`
- Unique index: `idx_review_votes_unique (review_id, COALESCE(customer_id::text, voter_ip))`

## Table: review_invitations

**Purpose**: Track review invitation emails and completion.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `order_id` (UUID, NOT NULL, FK -> `orders.id` ON DELETE CASCADE)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE SET NULL)
- `email` (VARCHAR(255), NOT NULL)
- `token` (VARCHAR(64), NOT NULL, UNIQUE): Invitation token.
- `sent_at` (TIMESTAMPTZ, NULL)
- `opened_at` (TIMESTAMPTZ, NULL)
- `completed_at` (TIMESTAMPTZ, NULL)
- `review_id` (UUID, NULL, FK -> `reviews.id` ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

---

# Coupons (007_coupons.sql)

## Enum: coupon_type_enum / coupon_status_enum

**Purpose**: Coupon configuration.

**Values**
- `coupon_type_enum`: `percentage`, `fixed_amount`, `free_shipping`
- `coupon_status_enum`: `active`, `inactive`, `expired`

## Table: coupons

**Purpose**: Coupon definitions per brand.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `code` (VARCHAR(50), NOT NULL): Unique per brand.
- `description` (TEXT, NULL)
- `type` (coupon_type_enum, NOT NULL, default `percentage`)
- `value` (DECIMAL(10,2), NOT NULL)
- `min_order_amount` (DECIMAL(10,2), default `0`)
- `max_discount_amount` (DECIMAL(10,2), NULL)
- `usage_limit` (INTEGER, NULL)
- `usage_limit_per_customer` (INTEGER, default `1`)
- `usage_count` (INTEGER, default `0`)
- `starts_at` (TIMESTAMPTZ, default `now()`)
- `expires_at` (TIMESTAMPTZ, NULL)
- `applies_to_products` (UUID[], default `{}`)
- `applies_to_categories` (UUID[], default `{}`)
- `excluded_products` (UUID[], default `{}`)
- `first_order_only` (BOOLEAN, default `false`)
- `status` (coupon_status_enum, default `active`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Indexes / Constraints**
- Unique: `(brand_id, code)`
- Indexes: `idx_coupons_brand_code`, `idx_coupons_brand_status`

## Table: coupon_usages

**Purpose**: Track each coupon usage.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `coupon_id` (UUID, NOT NULL, FK -> `coupons.id` ON DELETE CASCADE)
- `order_id` (UUID, NULL, FK -> `orders.id` ON DELETE SET NULL)
- `customer_email` (VARCHAR(255), NOT NULL)
- `discount_amount` (DECIMAL(10,2), NOT NULL)
- `used_at` (TIMESTAMPTZ, default `now()`)

**Indexes**
- `idx_coupon_usages_coupon`, `idx_coupon_usages_email`

---

# Admin & RBAC (008_admin_users.sql)

## Enum: admin_role_enum

**Purpose**: Role for admin users.

**Values**
- `super_admin`, `brand_admin`, `editor`, `read_only`

## Table: admin_users

**Purpose**: Backoffice users mapped to Supabase `auth.users`.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `auth_user_id` (UUID, NOT NULL, UNIQUE): References `auth.users(id)`.
- `email` (VARCHAR(255), NOT NULL, UNIQUE)
- `name` (VARCHAR(255), NULL)
- `avatar_url` (TEXT, NULL)
- `role` (admin_role_enum, NOT NULL, default `read_only`)
- `brand_ids` (UUID[], default `{}`): Allowed brands for non-super admins.
- `is_active` (BOOLEAN, default `true`)
- `last_login_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Indexes**
- `idx_admin_users_auth_user`, `idx_admin_users_email`, `idx_admin_users_role`

## Table: admin_activity_log

**Purpose**: Audit log for admin actions.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `admin_user_id` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL)
- `action` (VARCHAR(100), NOT NULL)
- `resource_type` (VARCHAR(100), NULL)
- `resource_id` (UUID, NULL)
- `details` (JSONB, default `{}`)
- `ip_address` (VARCHAR(45), NULL)
- `user_agent` (TEXT, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

---

# SEO Tools (010_seo_tools.sql)

## Table: seo_meta

**Purpose**: Override meta tags and canonical/robots per page.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id` ON DELETE CASCADE)
- `page_type` (VARCHAR(50), NOT NULL)
- `page_id` (UUID, NULL)
- `page_slug` (VARCHAR(255), NULL)
- `meta_title` (VARCHAR(70), NULL)
- `meta_description` (VARCHAR(160), NULL)
- `meta_keywords` (TEXT, NULL)
- `og_title` (VARCHAR(100), NULL)
- `og_description` (VARCHAR(200), NULL)
- `og_image` (VARCHAR(500), NULL)
- `twitter_title` (VARCHAR(70), NULL)
- `twitter_description` (VARCHAR(200), NULL)
- `twitter_image` (VARCHAR(500), NULL)
- `canonical_url` (VARCHAR(500), NULL)
- `robots_directive` (VARCHAR(100), default `index,follow`)
- `is_ai_generated` (BOOLEAN, default `false`)
- `ai_generated_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, page_type, page_id, page_slug)`

## Table: url_redirects

**Purpose**: 301/302 redirects.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `source_path` (VARCHAR(500), NOT NULL)
- `target_url` (VARCHAR(1000), NOT NULL)
- `redirect_type` (INTEGER, default `301`)
- `hit_count` (INTEGER, default `0`)
- `last_hit_at` (TIMESTAMPTZ, NULL)
- `is_active` (BOOLEAN, default `true`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, source_path)`

## Table: error_404_logs

**Purpose**: 404 request aggregation.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `request_path` (VARCHAR(1000), NOT NULL)
- `referrer` (VARCHAR(1000), NULL)
- `user_agent` (TEXT, NULL)
- `ip_address` (VARCHAR(45), NULL)
- `hit_count` (INTEGER, default `1`)
- `first_seen_at` (TIMESTAMPTZ, default `now()`)
- `last_seen_at` (TIMESTAMPTZ, default `now()`)
- `is_resolved` (BOOLEAN, default `false`)
- `resolved_redirect_id` (UUID, NULL, FK -> `url_redirects.id`)

**Constraints**
- Unique: `(brand_id, request_path)`

## Table: seo_reports

**Purpose**: Store SEO audit reports.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `report_type` (VARCHAR(50), NOT NULL)
- `page_type` (VARCHAR(50), NULL)
- `page_id` (UUID, NULL)
- `page_url` (VARCHAR(500), NULL)
- `report_data` (JSONB, NOT NULL, default `{}`)
- `overall_score` (INTEGER, NULL)
- `title_score`/`description_score`/`content_score`/`readability_score`/`keyword_score`/`technical_score` (INTEGER, NULL)
- `issues` (JSONB, default `[]`)
- `recommendations` (JSONB, default `[]`)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Table: seo_keywords

**Purpose**: Keyword tracking list.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `keyword` (VARCHAR(255), NOT NULL)
- `search_intent` (VARCHAR(50), NULL)
- `target_page_type` (VARCHAR(50), NULL)
- `target_page_id` (UUID, NULL)
- `search_volume` (INTEGER, NULL)
- `keyword_difficulty` (INTEGER, NULL)
- `current_position` (INTEGER, NULL)
- `previous_position` (INTEGER, NULL)
- `is_tracked` (BOOLEAN, default `true`)
- `last_checked_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, keyword)`

## Table: sitemap_config

**Purpose**: Sitemap generation configuration per brand.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `page_type` (VARCHAR(50), NOT NULL)
- `is_included` (BOOLEAN, default `true`)
- `changefreq` (VARCHAR(20), default `weekly`)
- `priority` (DECIMAL(2,1), default `0.5`)
- `last_generated_at` (TIMESTAMPTZ, NULL)
- `url_count` (INTEGER, default `0`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, page_type)`

## Table: robots_config

**Purpose**: robots.txt overrides and crawler flags.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `custom_content` (TEXT, NULL)
- `allow_gptbot`/`allow_claudebot`/`allow_perplexitybot`/`allow_googlebot`/`allow_bingbot` (BOOLEAN, default `true`)
- `disallow_paths` (JSONB, default `[]`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id)`

## Table: ai_crawler_logs

**Purpose**: Log AI crawler hits for GEO.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `crawler_name` (VARCHAR(100), NOT NULL)
- `request_path` (VARCHAR(1000), NOT NULL)
- `user_agent` (TEXT, NULL)
- `ip_address` (VARCHAR(45), NULL)
- `request_method` (VARCHAR(10), NULL)
- `response_status` (INTEGER, NULL)
- `response_time_ms` (INTEGER, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Table: content_seo_cache

**Purpose**: Cache SEO/content analysis metrics for pages/content.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `content_type` (VARCHAR(50), NOT NULL)
- `content_id` (UUID, NOT NULL)
- `word_count`/`sentence_count`/`paragraph_count` (INTEGER, NULL)
- `flesch_reading_ease` (DECIMAL(5,2), NULL)
- `flesch_kincaid_grade` (DECIMAL(4,2), NULL)
- `primary_keyword` (VARCHAR(255), NULL)
- `keyword_density` (DECIMAL(5,2), NULL)
- `keyword_in_title`/`keyword_in_h1`/`keyword_in_meta_desc`/`keyword_in_first_paragraph` (BOOLEAN, NULL)
- `has_h1` (BOOLEAN, NULL)
- `h2_count`/`h3_count` (INTEGER, NULL)
- `image_count`/`images_with_alt` (INTEGER, NULL)
- `internal_link_count`/`external_link_count` (INTEGER, NULL)
- `seo_score`/`readability_score`/`eeat_score` (INTEGER, NULL)
- `analyzed_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, content_type, content_id)`

---

# Multi-Brand Management (011_multi_brand_management.sql)

## Table: brand_domains

**Purpose**: Multi-domain bindings per brand.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `domain` (VARCHAR(255), NOT NULL, UNIQUE)
- `is_primary` (BOOLEAN, default `false`)
- `ssl_status` (VARCHAR(50), default `pending`)
- `dns_verified` (BOOLEAN, default `false`)
- `verified_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

## Table: shared_templates

**Purpose**: Shareable templates across brands.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `owner_brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `name` (VARCHAR(255), NOT NULL)
- `description` (TEXT, NULL)
- `template_type` (VARCHAR(50), NOT NULL)
- `content` (JSONB, NOT NULL)
- `is_public` (BOOLEAN, default `false`)
- `allowed_brand_ids` (UUID[], default `{}`)
- `use_count` (INTEGER, default `0`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

## Table: brand_user_assignments

**Purpose**: Fine-grained admin-to-brand assignment (complements `admin_users.brand_ids`).

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `admin_user_id` (UUID, NOT NULL, FK -> `admin_users.id` ON DELETE CASCADE)
- `role` (VARCHAR(50), NOT NULL, default `editor`)
- `permissions` (JSONB, default `{}`)
- `assigned_by` (UUID, NULL, FK -> `admin_users.id` ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, admin_user_id)`

## Table: cross_brand_analytics

**Purpose**: Cache computed metrics for cross-brand reporting.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `metric_type` (VARCHAR(100), NOT NULL)
- `brand_id` (UUID, NULL, FK -> `brands.id` ON DELETE CASCADE)
- `period_start` (DATE, NOT NULL)
- `period_end` (DATE, NOT NULL)
- `data` (JSONB, NOT NULL)
- `calculated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(metric_type, brand_id, period_start, period_end)`

---

# Content Originality (012_content_originality.sql)

## Table: content_differentiation_logs

**Purpose**: Track what inputs were used to differentiate AI-generated content.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE)
- `content_id` (UUID, NULL, FK -> `content_library.id` ON DELETE SET NULL)
- `product_id` (UUID, NULL, FK -> `products.id` ON DELETE SET NULL)
- `content_type` (VARCHAR(50), NOT NULL)
- `included_reviews` (BOOLEAN, default `false`)
- `review_count` (INTEGER, default `0`)
- `included_specs` (BOOLEAN, default `false`)
- `included_comparisons` (BOOLEAN, default `false`)
- `comparison_product_ids` (UUID[], default `{}`)
- `tone` (VARCHAR(50), NULL)
- `language` (VARCHAR(50), NULL)
- `base_content_length` (INTEGER, NULL)
- `generated_content_length` (INTEGER, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Table: originality_check_logs

**Purpose**: Store originality evaluation results for content.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `content_id` (UUID, NULL, FK -> `content_library.id` ON DELETE SET NULL)
- `score` (INTEGER, NOT NULL, CHECK 0..100)
- `has_generic_opening` (BOOLEAN, default `false`)
- `has_repetitive_structure` (BOOLEAN, default `false`)
- `lacks_specific_details` (BOOLEAN, default `false`)
- `has_ai_patterns` (BOOLEAN, default `false`)
- `common_patterns_count` (INTEGER, default `0`)
- `suggestions_count` (INTEGER, default `0`)
- `content_length` (INTEGER, NULL)
- `content_hash` (VARCHAR(64), NULL)
- `checked_at` (TIMESTAMPTZ, default `now()`)

---

# Marketing & Tracking (013_marketing_tracking.sql)

## Table: utm_tracking

**Purpose**: Store session-level UTM attribution.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `session_id` (VARCHAR(100), NOT NULL)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE SET NULL)
- `order_id` (UUID, NULL, FK -> `orders.id` ON DELETE SET NULL)
- `utm_source`/`utm_medium`/`utm_campaign`/`utm_term`/`utm_content` (VARCHAR(255), NULL)
- `referrer` (TEXT, NULL)
- `landing_page` (TEXT, NULL)
- `user_agent` (TEXT, NULL)
- `ip_country` (VARCHAR(10), NULL)
- `device_type` (VARCHAR(50), NULL)
- `first_touch_at` (TIMESTAMPTZ, default `now()`)
- `last_touch_at` (TIMESTAMPTZ, default `now()`)
- `converted_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Enum: abandoned_cart_status_enum

**Purpose**: Abandoned cart lifecycle.

**Values**
- `active`, `abandoned`, `recovered`, `email_sent`, `unsubscribed`

## Table: abandoned_carts

**Purpose**: Shopping cart snapshots for recovery.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `session_id` (VARCHAR(100), NOT NULL)
- `customer_email` (VARCHAR(255), NULL)
- `customer_name` (VARCHAR(255), NULL)
- `items` (JSONB, NOT NULL, default `[]`)
- `subtotal` (DECIMAL(10,2), default `0`)
- `currency` (VARCHAR(10), default `USD`)
- `status` (abandoned_cart_status_enum, default `active`)
- `recovery_email_count` (INTEGER, default `0`)
- `last_email_sent_at` (TIMESTAMPTZ, NULL)
- `recovered_order_id` (UUID, NULL, FK -> `orders.id` ON DELETE SET NULL)
- `utm_tracking_id` (UUID, NULL, FK -> `utm_tracking.id` ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)
- `abandoned_at` (TIMESTAMPTZ, NULL)
- `recovered_at` (TIMESTAMPTZ, NULL)

## Enum: pixel_platform_enum / pixel_event_enum

**Purpose**: Normalize platform and event name for pixel tracking.

**Values**
- `pixel_platform_enum`: `facebook`, `google`, `tiktok`, `pinterest`
- `pixel_event_enum`: `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `AddPaymentInfo`, `Purchase`, `Lead`, `CompleteRegistration`, `Search`, `CustomEvent`

## Table: pixel_events

**Purpose**: Platform-level pixel events storage.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `platform` (pixel_platform_enum, NOT NULL)
- `event_name` (pixel_event_enum, NOT NULL)
- `custom_event_name` (VARCHAR(100), NULL)
- `event_id` (VARCHAR(100), NULL)
- `session_id` (VARCHAR(100), NULL)
- `external_id` (VARCHAR(255), NULL)
- `user_email_hash` (VARCHAR(64), NULL)
- `user_phone_hash` (VARCHAR(64), NULL)
- `user_ip` (VARCHAR(45), NULL)
- `user_agent` (TEXT, NULL)
- `event_data` (JSONB, default `{}`)
- `currency` (VARCHAR(10), NULL)
- `value` (DECIMAL(10,2), NULL)
- `content_ids` (TEXT[], NULL)
- `content_type` (VARCHAR(50), NULL)
- `num_items` (INTEGER, NULL)
- `order_id` (UUID, NULL, FK -> `orders.id` ON DELETE SET NULL)
- `sent_to_api` (BOOLEAN, default `false`)
- `api_response` (JSONB, NULL)
- `api_sent_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Table: email_subscriptions

**Purpose**: Subscription preferences and unsubscribe tokens.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `email` (VARCHAR(255), NOT NULL)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE SET NULL)
- `marketing_emails` (BOOLEAN, default `true`)
- `abandoned_cart_emails` (BOOLEAN, default `true`)
- `order_updates` (BOOLEAN, default `true`)
- `unsubscribed_at` (TIMESTAMPTZ, NULL)
- `unsubscribe_reason` (TEXT, NULL)
- `unsubscribe_token` (VARCHAR(64), UNIQUE, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `unique_email_subscription_per_brand (brand_id, email)`

## Table: tracking_pixels_config

**Purpose**: Per-brand configuration for pixel scripts and server-side conversions.

**Columns (013 + 018)**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id` ON DELETE CASCADE, UNIQUE)
- `facebook_pixel_id` (VARCHAR(50), NULL)
- `facebook_access_token` (TEXT, NULL)
- `facebook_test_event_code` (VARCHAR(50), NULL)
- `google_ads_id` (VARCHAR(50), NULL)
- `google_conversion_label` (VARCHAR(50), NULL)
- `google_remarketing_id` (VARCHAR(50), NULL)
- `google_customer_id` (VARCHAR(50), NULL): Server-side conversions customer id (018).
- `google_conversion_action_id` (VARCHAR(50), NULL): Server-side conversions action id (018).
- `google_access_token` (TEXT, NULL): OAuth token for Google Ads API (018).
- `tiktok_pixel_id` (VARCHAR(50), NULL)
- `tiktok_access_token` (TEXT, NULL)
- `pinterest_tag_id` (VARCHAR(50), NULL)
- `pinterest_access_token` (TEXT, NULL)
- `pinterest_ad_account_id` (VARCHAR(50), NULL): Pinterest Conversions API account id (018).
- `server_side_enabled` (BOOLEAN, default `false`)
- `hash_user_data` (BOOLEAN, default `true`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

---

# Email Automation (014_email_sequences.sql)

## Enum: enrollment_status_enum

**Purpose**: State of a sequence enrollment.

**Values**
- `active`, `completed`, `paused`, `cancelled`, `converted`

## Table: email_sequences

**Purpose**: Define email sequence templates.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `name` (VARCHAR(100), NOT NULL)
- `slug` (VARCHAR(100), NOT NULL)
- `description` (TEXT, NULL)
- `sequence_type` (VARCHAR(50), NOT NULL)
- `trigger_event` (VARCHAR(50), NOT NULL)
- `trigger_delay_hours` (INTEGER, default `0`)
- `is_active` (BOOLEAN, default `true`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `unique_email_seq_slug_per_brand (brand_id, slug)`

## Table: email_sequence_steps

**Purpose**: Individual emails inside a sequence.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `sequence_id` (UUID, NOT NULL, FK -> `email_sequences.id` ON DELETE CASCADE)
- `step_number` (INTEGER, NOT NULL)
- `name` (VARCHAR(100), NOT NULL)
- `subject` (VARCHAR(255), NOT NULL)
- `preview_text` (VARCHAR(255), NULL)
- `html_content` (TEXT, NOT NULL)
- `plain_text_content` (TEXT, NULL)
- `delay_hours` (INTEGER, NOT NULL, default `0`)
- `send_conditions` (JSONB, default `{}`)
- `is_active` (BOOLEAN, default `true`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `unique_step_number_per_sequence (sequence_id, step_number)`

## Table: email_sequence_enrollments

**Purpose**: Track subscribers enrolled in sequences.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `sequence_id` (UUID, NOT NULL, FK -> `email_sequences.id` ON DELETE CASCADE)
- `email` (VARCHAR(255), NOT NULL)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE SET NULL)
- `current_step` (INTEGER, default `0`)
- `status` (enrollment_status_enum, default `active`)
- `emails_sent`/`emails_opened`/`emails_clicked` (INTEGER, default `0`)
- `enrolled_at` (TIMESTAMPTZ, default `now()`)
- `next_email_at` (TIMESTAMPTZ, NULL)
- `last_email_at` (TIMESTAMPTZ, NULL)
- `completed_at` (TIMESTAMPTZ, NULL)
- `trigger_data` (JSONB, default `{}`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `unique_enrollment_per_sequence (sequence_id, email)`

## Table: email_sequence_logs

**Purpose**: Per-email send logs.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `enrollment_id` (UUID, NOT NULL, FK -> `email_sequence_enrollments.id` ON DELETE CASCADE)
- `step_id` (UUID, NOT NULL, FK -> `email_sequence_steps.id` ON DELETE CASCADE)
- `sent_at` (TIMESTAMPTZ, default `now()`)
- `delivered_at`/`opened_at`/`clicked_at` (TIMESTAMPTZ, NULL)
- `message_id` (VARCHAR(255), NULL)
- `send_error` (TEXT, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Enum: reminder_status_enum

**Purpose**: Repurchase reminder queue state.

**Values**
- `pending`, `sent`, `skipped`, `failed`

## Table: repurchase_reminders

**Purpose**: Define repurchase reminder templates per product/category.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `product_id` (UUID, NULL, FK -> `products.id` ON DELETE SET NULL)
- `category_id` (UUID, NULL, FK -> `categories.id` ON DELETE SET NULL)
- `name` (VARCHAR(100), NOT NULL)
- `reminder_days` (INTEGER, NOT NULL)
- `subject` (VARCHAR(255), NOT NULL)
- `html_content` (TEXT, NOT NULL)
- `discount_code` (VARCHAR(50), NULL)
- `discount_percent` (DECIMAL(5,2), NULL)
- `is_active` (BOOLEAN, default `true`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

## Table: repurchase_reminder_queue

**Purpose**: Scheduled reminder instances to send.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `reminder_id` (UUID, NOT NULL, FK -> `repurchase_reminders.id` ON DELETE CASCADE)
- `customer_email` (VARCHAR(255), NOT NULL)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE SET NULL)
- `order_id` (UUID, NULL, FK -> `orders.id` ON DELETE SET NULL)
- `scheduled_at` (TIMESTAMPTZ, NOT NULL)
- `status` (reminder_status_enum, default `pending`)
- `sent_at` (TIMESTAMPTZ, NULL)
- `send_error` (TEXT, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

---

# Web Performance Monitoring (015_web_vitals.sql)

## Table: web_vitals

**Purpose**: Store raw Core Web Vitals measurements.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `page_url` (TEXT, NOT NULL)
- `page_path` (VARCHAR(500), NULL)
- `page_type` (VARCHAR(50), NULL)
- `lcp`/`fid`/`cls`/`inp`/`ttfb`/`fcp` (DECIMAL, NULL)
- `lcp_rating`/`fid_rating`/`cls_rating`/`inp_rating` (VARCHAR(10), NULL)
- `device_type` (VARCHAR(20), NULL)
- `connection_type`/`effective_type` (VARCHAR(20), NULL)
- `user_agent` (TEXT, NULL)
- `browser_name`/`browser_version`/`os_name` (VARCHAR, NULL)
- `session_id` (VARCHAR(100), NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Table: web_vitals_aggregates

**Purpose**: Daily aggregates for reporting.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `date` (DATE, NOT NULL)
- `page_path` (VARCHAR(500), NULL)
- `page_type` (VARCHAR(50), NULL)
- `device_type` (VARCHAR(20), NULL)
- `sample_count` (INTEGER, default `0`)
- Percentiles and percentages for LCP/FID/CLS/INP/TTFB (DECIMAL, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `unique_vitals_agg (brand_id, date, page_path, device_type)`

## Enum: alert_severity_enum / alert_status_enum

**Values**
- `alert_severity_enum`: `warning`, `critical`
- `alert_status_enum`: `active`, `acknowledged`, `resolved`

## Table: web_vitals_alerts

**Purpose**: Alerts when vitals degrade.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `metric` (VARCHAR(10), NOT NULL)
- `page_path` (VARCHAR(500), NULL)
- `device_type` (VARCHAR(20), NULL)
- `severity` (alert_severity_enum, NOT NULL)
- `status` (alert_status_enum, default `active`)
- `threshold_value`/`current_value`/`previous_value` (DECIMAL, NULL)
- `message` (TEXT, NULL)
- `triggered_at` (TIMESTAMPTZ, default `now()`)
- `acknowledged_at`/`resolved_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

---

# Advanced SEO Analysis (016_advanced_seo_analysis.sql)

> Note: 016 currently contains a helper function referencing `blog_posts` which does not exist in this repository schema (blog content is stored in `content_library`). If you execute 016 as-is, validate/adjust those functions first.

## Table: page_link_graph

**Purpose**: Internal/external link edges discovered between pages.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `source_url` (VARCHAR(1000), NOT NULL)
- `source_type` (VARCHAR(50), NULL)
- `source_id` (UUID, NULL)
- `target_url` (VARCHAR(1000), NOT NULL)
- `target_type` (VARCHAR(50), NULL)
- `target_id` (UUID, NULL)
- `anchor_text` (VARCHAR(500), NULL)
- `is_internal` (BOOLEAN, default `true`)
- `link_position` (VARCHAR(50), NULL)
- `discovered_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, source_url, target_url)`

## Table: orphan_pages

**Purpose**: Store orphan page detection results.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `page_url` (VARCHAR(1000), NOT NULL)
- `page_type` (VARCHAR(50), NOT NULL)
- `page_id` (UUID, NULL)
- `page_title` (VARCHAR(255), NULL)
- `incoming_links_count` (INTEGER, default `0`)
- `is_in_sitemap` (BOOLEAN, default `true`)
- `is_in_navigation` (BOOLEAN, default `false`)
- `is_resolved` (BOOLEAN, default `false`)
- `resolved_at` (TIMESTAMPTZ, NULL)
- `resolution_action` (VARCHAR(100), NULL)
- `detected_at` (TIMESTAMPTZ, default `now()`)
- `last_checked_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, page_url)`

## Table: link_density_analysis

**Purpose**: Store per-page link density analysis.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `page_url` (VARCHAR(1000), NOT NULL)
- `page_type` (VARCHAR(50), NULL)
- `page_id` (UUID, NULL)
- `word_count`/`internal_links_count`/`external_links_count`/`broken_links_count` (INTEGER, default `0`)
- `link_density` (DECIMAL(5,2), NULL)
- `ideal_density_min` (DECIMAL(5,2), default `1.0`)
- `ideal_density_max` (DECIMAL(5,2), default `3.0`)
- `density_status` (VARCHAR(20), NULL)
- `suggested_links` (JSONB, default `[]`)
- `analyzed_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, page_url)`

## Table: related_content

**Purpose**: Store related-content recommendations.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `source_type` (VARCHAR(50), NOT NULL)
- `source_id` (UUID, NOT NULL)
- `related_type` (VARCHAR(50), NOT NULL)
- `related_id` (UUID, NOT NULL)
- `relevance_score` (DECIMAL(5,4), NULL)
- `relationship_type` (VARCHAR(50), NULL)
- `ai_reasoning` (TEXT, NULL)
- `is_ai_generated` (BOOLEAN, default `true`)
- `is_active` (BOOLEAN, default `true`)
- `display_order` (INTEGER, default `0`)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, source_type, source_id, related_type, related_id)`

## Table: sitemap_shards

**Purpose**: Store generated sitemap shard payloads for large sites.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `shard_type` (VARCHAR(50), NOT NULL)
- `shard_index` (INTEGER, default `0`)
- `url_count` (INTEGER, default `0`)
- `urls` (JSONB, default `[]`)
- `last_generated_at` (TIMESTAMPTZ, default `now()`)
- `file_size_bytes` (INTEGER, NULL)
- `is_active` (BOOLEAN, default `true`)

**Constraints**
- Unique: `(brand_id, shard_type, shard_index)`

## Table: keyword_research

**Purpose**: Keyword research corpus with intent and metrics.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `keyword` (VARCHAR(255), NOT NULL)
- `keyword_normalized` (VARCHAR(255), NULL)
- `search_intent` (VARCHAR(50), NULL)
- `intent_confidence` (DECIMAL(5,4), NULL)
- `search_volume_monthly` (INTEGER, NULL)
- `keyword_difficulty` (INTEGER, NULL)
- `cpc_estimate` (DECIMAL(10,2), NULL)
- `competition_level` (VARCHAR(20), NULL)
- `trend_direction` (VARCHAR(20), NULL)
- `seasonal_peak_months` (INTEGER[], NULL)
- `related_keywords` (JSONB, default `[]`)
- `long_tail_variations` (JSONB, default `[]`)
- `target_page_type` (VARCHAR(50), NULL)
- `target_page_id` (UUID, NULL)
- `current_ranking` (INTEGER, NULL)
- `ai_suggestions` (TEXT, NULL)
- `is_tracked` (BOOLEAN, default `false`)
- `priority` (VARCHAR(20), default `medium`)
- `created_at`/`updated_at` (TIMESTAMPTZ, default `now()`)
- `last_researched_at` (TIMESTAMPTZ, NULL)

**Constraints**
- Unique: `(brand_id, keyword_normalized)`

## Table: eeat_scores

**Purpose**: E-E-A-T scoring cache for content.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `content_type` (VARCHAR(50), NOT NULL)
- `content_id` (UUID, NULL)
- `experience_score`/`expertise_score`/`authoritativeness_score`/`trustworthiness_score`/`overall_score` (INTEGER, default `0`)
- `experience_factors`/`expertise_factors`/`authority_factors`/`trust_factors` (JSONB, default `{}`)
- `improvement_suggestions` (JSONB, default `[]`)
- `analyzed_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, content_type, content_id)`

## Table: keyword_rankings

**Purpose**: Time series of ranking checks.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `keyword_id` (UUID, NULL, FK -> `keyword_research.id` ON DELETE CASCADE)
- `keyword` (VARCHAR(255), NOT NULL)
- `position` (INTEGER, NULL)
- `previous_position` (INTEGER, NULL)
- `position_change` (INTEGER, NULL)
- `search_engine` (VARCHAR(20), default `google`)
- `country` (VARCHAR(10), default `us`)
- `device_type` (VARCHAR(20), default `desktop`)
- `ranking_url` (VARCHAR(1000), NULL)
- `checked_at` (TIMESTAMPTZ, default `now()`)

## Table: index_status

**Purpose**: Store index and coverage state for each page.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `page_url` (VARCHAR(1000), NOT NULL)
- `page_type` (VARCHAR(50), NULL)
- `page_id` (UUID, NULL)
- `is_indexed` (BOOLEAN, NULL)
- `index_status` (VARCHAR(50), NULL)
- `index_coverage_state` (VARCHAR(100), NULL)
- `last_crawl_date` (TIMESTAMPTZ, NULL)
- `crawl_frequency` (VARCHAR(20), NULL)
- `indexing_issues` (JSONB, default `[]`)
- `is_mobile_friendly` (BOOLEAN, NULL)
- `mobile_issues` (JSONB, default `[]`)
- `has_rich_results` (BOOLEAN, NULL)
- `rich_result_types` (JSONB, default `[]`)
- `last_checked_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, page_url)`

## Table: automated_reports

**Purpose**: Scheduled report configuration.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `report_name` (VARCHAR(255), NOT NULL)
- `report_type` (VARCHAR(50), NOT NULL)
- `schedule_frequency` (VARCHAR(20), NULL)
- `schedule_day` (INTEGER, NULL)
- `schedule_time` (TIME, default `09:00:00`)
- `last_run_at`/`next_run_at` (TIMESTAMPTZ, NULL)
- `recipients` (JSONB, default `[]`)
- `include_sections` (JSONB, default `["overview", "rankings", "issues", "recommendations"]`)
- `custom_filters` (JSONB, default `{}`)
- `is_active` (BOOLEAN, default `true`)
- `created_at`/`updated_at` (TIMESTAMPTZ, default `now()`)

## Table: report_history

**Purpose**: Archive each generated report.

**Columns**
- `id` (UUID, PK, default `gen_random_uuid()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `report_id` (UUID, NULL, FK -> `automated_reports.id` ON DELETE CASCADE)
- `report_data` (JSONB, NOT NULL)
- `overall_seo_score` (INTEGER, NULL)
- `total_pages_analyzed` (INTEGER, NULL)
- `issues_found` (INTEGER, NULL)
- `improvements_since_last` (INTEGER, NULL)
- `delivered_to` (JSONB, default `[]`)
- `delivery_status` (VARCHAR(20), NULL)
- `generated_at` (TIMESTAMPTZ, default `now()`)

---

# User Retention (017_user_retention.sql)

## Table: member_levels

**Purpose**: Membership tiers per brand.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id` ON DELETE CASCADE)
- `level_name` (VARCHAR(100), NOT NULL)
- `level_code` (VARCHAR(50), NOT NULL)
- `level_order` (INT, NOT NULL, default `0`)
- `min_points`/`min_orders` (INT, default `0`)
- `min_spent` (DECIMAL(12,2), default `0`)
- `points_multiplier` (DECIMAL(3,2), default `1.0`)
- `discount_percentage` (DECIMAL(5,2), default `0`)
- `free_shipping_threshold` (DECIMAL(12,2), NULL)
- `exclusive_products` (BOOLEAN, default `false`)
- `early_access_days` (INT, default `0`)
- `birthday_bonus_points` (INT, default `0`)
- `badge_color` (VARCHAR(20), NULL)
- `badge_icon` (VARCHAR(100), NULL)
- `description` (TEXT, NULL)
- `is_active` (BOOLEAN, default `true`)
- `created_at`/`updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, level_code)`

## Table: customer_memberships

**Purpose**: Customer membership state and balances.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE CASCADE)
- `current_level_id` (UUID, NULL, FK -> `member_levels.id`)
- `points_balance` (INT, default `0`)
- `lifetime_points` (INT, default `0`)
- `total_orders` (INT, default `0`)
- `total_spent` (DECIMAL(12,2), default `0`)
- `referral_code` (VARCHAR(20), UNIQUE, NULL)
- `referred_by` (UUID, NULL, FK -> `customers.id`)
- `referral_count` (INT, default `0`)
- `joined_at` (TIMESTAMPTZ, default `now()`)
- `level_updated_at`/`last_activity_at` (TIMESTAMPTZ, NULL)
- `birthday` (DATE, NULL)
- `created_at`/`updated_at` (TIMESTAMPTZ, default `now()`)

**Constraints**
- Unique: `(brand_id, customer_id)`

## Table: points_ledger

**Purpose**: Append-only points transactions ledger.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `customer_id` (UUID, NULL, FK -> `customers.id` ON DELETE CASCADE)
- `membership_id` (UUID, NULL, FK -> `customer_memberships.id` ON DELETE CASCADE)
- `transaction_type` (VARCHAR(50), NOT NULL)
- `points_amount` (INT, NOT NULL)
- `points_balance_after` (INT, NOT NULL)
- `reference_type` (VARCHAR(50), NULL)
- `reference_id` (UUID, NULL)
- `description` (TEXT, NULL)
- `multiplier_applied` (DECIMAL(3,2), default `1.0`)
- `expires_at`/`expired_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)
- `created_by` (UUID, NULL)

## Table: points_rules

**Purpose**: Points earning rules.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `rule_name` (VARCHAR(100), NOT NULL)
- `rule_type` (VARCHAR(50), NOT NULL)
- `points_per_dollar` (DECIMAL(5,2), NULL)
- `fixed_points` (INT, NULL)
- `min_order_amount` (DECIMAL(12,2), NULL)
- `max_points_per_order` (INT, NULL)
- `product_category_id` (UUID, NULL)
- `start_date`/`end_date` (TIMESTAMPTZ, NULL)
- `points_validity_days` (INT, default `365`)
- `is_active` (BOOLEAN, default `true`)
- `priority` (INT, default `0`)
- `created_at`/`updated_at` (TIMESTAMPTZ, default `now()`)

## Table: points_redemptions

**Purpose**: Redeem options for points.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `redemption_name` (VARCHAR(100), NOT NULL)
- `redemption_type` (VARCHAR(50), NOT NULL)
- `points_required` (INT, NOT NULL)
- `discount_amount` (DECIMAL(12,2), NULL)
- `discount_percent` (DECIMAL(5,2), NULL)
- `product_id` (UUID, NULL)
- `min_order_amount` (DECIMAL(12,2), NULL)
- `max_uses_per_customer` (INT, NULL)
- `total_uses_limit` (INT, NULL)
- `current_uses` (INT, default `0`)
- `description` (TEXT, NULL)
- `image_url` (VARCHAR(500), NULL)
- `is_active` (BOOLEAN, default `true`)
- `start_date`/`end_date` (TIMESTAMPTZ, NULL)
- `created_at`/`updated_at` (TIMESTAMPTZ, default `now()`)

## Table: referral_config

**Purpose**: Referral program configuration per brand.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`, UNIQUE)
- `referrer_points` (INT, default `0`)
- `referrer_discount_amount` (DECIMAL(12,2), NULL)
- `referrer_discount_percent` (DECIMAL(5,2), NULL)
- `referee_points` (INT, default `0`)
- `referee_discount_amount` (DECIMAL(12,2), NULL)
- `referee_discount_percent` (DECIMAL(5,2), NULL)
- `min_order_amount` (DECIMAL(12,2), default `0`)
- `require_first_purchase` (BOOLEAN, default `true`)
- `max_referrals_per_customer` (INT, NULL)
- `share_message` (TEXT, NULL)
- `email_subject` (VARCHAR(255), NULL)
- `email_template` (TEXT, NULL)
- `is_active` (BOOLEAN, default `true`)
- `created_at`/`updated_at` (TIMESTAMPTZ, default `now()`)

## Table: referrals

**Purpose**: Track referral relationships and rewards.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `referrer_id` (UUID, NULL, FK -> `customers.id` ON DELETE CASCADE)
- `referee_id` (UUID, NULL, FK -> `customers.id` ON DELETE CASCADE)
- `referral_code` (VARCHAR(20), NOT NULL)
- `status` (VARCHAR(30), default `pending`)
- `qualifying_order_id` (UUID, NULL, FK -> `orders.id`)
- `order_amount` (DECIMAL(12,2), NULL)
- Referrer reward fields (VARCHAR/DECIMAL/BOOLEAN/TIMESTAMPTZ, NULL)
- Referee reward fields (VARCHAR/DECIMAL/BOOLEAN/TIMESTAMPTZ, NULL)
- `referred_at` (TIMESTAMPTZ, default `now()`)
- `completed_at`/`expires_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

## Table: level_history

**Purpose**: Track membership level changes over time.

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NULL, FK -> `brands.id`)
- `customer_id` (UUID, NULL, FK -> `customers.id`)
- `membership_id` (UUID, NULL, FK -> `customer_memberships.id`)
- `previous_level_id`/`new_level_id` (UUID, NULL, FK -> `member_levels.id`)
- `change_type` (VARCHAR(20), NOT NULL)
- `reason` (TEXT, NULL)
- `points_at_change`/`orders_at_change` (INT, NULL)
- `spent_at_change` (DECIMAL(12,2), NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

---

# Conversions (Event-level) (018_conversions_events.sql)

## Table: conversion_events

**Purpose**: Event-level conversions log (aggregates multi-platform send results in one row).

**Columns**
- `id` (UUID, PK, default `uuid_generate_v4()`)
- `brand_id` (UUID, NOT NULL, FK -> `brands.id`)
- `event_name` (TEXT, NOT NULL)
- `event_id` (TEXT, NULL): Business event identifier.
- `event_data` (JSONB, default `{}`): Stored payload for retry/replay.
- `platforms_sent` (TEXT[], default `{}`): Platforms attempted.
- `results` (JSONB, default `{}`): Per-platform results.
- `ip_address` (VARCHAR(45), NULL)
- `user_agent` (TEXT, NULL)
- `retry_count` (INTEGER, default `0`)
- `last_retry_at` (TIMESTAMPTZ, NULL)
- `created_at` (TIMESTAMPTZ, default `now()`)

**Indexes**
- `idx_conversion_events_brand`, `idx_conversion_events_created`, `idx_conversion_events_name`, `idx_conversion_events_event_id`
