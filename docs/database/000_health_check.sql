select
  -- ===== Extensions =====
  exists (select 1 from pg_extension where extname = 'uuid-ossp') as ext_uuid_ossp,
  exists (select 1 from pg_extension where extname = 'vector') as ext_vector,

  -- ===== 001_initial_schema.sql =====
  to_regclass('public.brands') as s001_brands,
  to_regclass('public.orders') as s001_orders,
  to_regclass('public.settings') as s001_settings,
  to_regclass('public.content_library') as s001_content_library,
  to_regclass('public.knowledge_base') as s001_knowledge_base,

  -- ===== 002_rls_policies.sql (spot-check a policy presence) =====
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'brands'
  ) as s002_has_brands_policies,

  -- ===== 004_pgvector_ai.sql =====
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='knowledge_base' and column_name='embedding'
  ) as s004_has_kb_embedding,

  -- ===== 005_orders_payment.sql =====
  to_regclass('public.stripe_events') as s005_stripe_events,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='orders' and column_name='discount_amount'
  ) as s005_orders_discount_amount,
  exists (
    select 1 from pg_type t join pg_enum e on t.oid=e.enumtypid
    where t.typname='order_status_enum' and e.enumlabel='failed'
  ) as s005_order_status_has_failed,

  -- ===== 006_reviews.sql =====
  to_regclass('public.reviews') as s006_reviews,
  to_regclass('public.review_votes') as s006_review_votes,

  -- ===== 007_coupons.sql =====
  to_regclass('public.coupons') as s007_coupons,
  to_regclass('public.coupon_usages') as s007_coupon_usages,

  -- ===== 008_admin_users.sql =====
  to_regclass('public.admin_users') as s008_admin_users,

  -- ===== 009_blog_support.sql =====
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='content_library' and column_name='slug'
  ) as s009_has_content_slug,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='content_library' and column_name='published_at'
  ) as s009_has_content_published_at,

  -- ===== 010_seo_tools.sql =====
  to_regclass('public.seo_meta') as s010_seo_meta,

  -- ===== 011_multi_brand_management.sql =====
  to_regclass('public.brand_domains') as s011_brand_domains,

  -- ===== 012_content_originality.sql =====
  to_regclass('public.content_differentiation_logs') as s012_content_differentiation_logs,
  to_regclass('public.originality_check_logs') as s012_originality_check_logs,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='content_library' and column_name='originality_score'
  ) as s012_has_originality_score,

  -- ===== 013_marketing_tracking.sql =====
  to_regclass('public.utm_tracking') as s013_utm_tracking,
  to_regclass('public.abandoned_carts') as s013_abandoned_carts,
  to_regclass('public.email_subscriptions') as s013_email_subscriptions,
  to_regclass('public.pixel_events') as s013_pixel_events,
  to_regclass('public.tracking_pixels_config') as s013_tracking_pixels_config,

  -- ===== 014_email_sequences.sql =====
  to_regclass('public.email_sequences') as s014_email_sequences,
  to_regclass('public.email_sequence_steps') as s014_email_sequence_steps,

  -- ===== 015_web_vitals.sql =====
  to_regclass('public.web_vitals') as s015_web_vitals,

  -- ===== 016_advanced_seo_analysis.sql =====
  to_regclass('public.orphan_pages') as s016_orphan_pages,
  to_regclass('public.keyword_research') as s016_keyword_research,
  to_regclass('public.index_status') as s016_index_status,

  -- ===== 017_user_retention.sql =====
  to_regclass('public.member_levels') as s017_member_levels,
  to_regclass('public.customer_memberships') as s017_customer_memberships,

  -- ===== 018_conversions_events.sql =====
  to_regclass('public.conversion_events') as s018_conversion_events,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tracking_pixels_config' and column_name='google_access_token'
  ) as s018_pixels_has_google_access_token,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tracking_pixels_config' and column_name='google_customer_id'
  ) as s018_pixels_has_google_customer_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tracking_pixels_config' and column_name='google_conversion_action_id'
  ) as s018_pixels_has_google_conversion_action_id,
  exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tracking_pixels_config' and column_name='pinterest_ad_account_id'
  ) as s018_pixels_has_pinterest_ad_account_id,

  -- ===== Code references / known mismatches =====
  to_regclass('public.seo_rankings') as code_seo_rankings,
  to_regclass('public.order_items') as code_order_items
;
