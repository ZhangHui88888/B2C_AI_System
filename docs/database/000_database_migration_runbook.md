# Database Migration Runbook

## Data dictionary

See `docs/database/000_data_dictionary.md`.

## One-click health check

Use `docs/database/000_health_check.sql`.

## Recommended execution order (fresh database)

- 001_initial_schema.sql
- 002_rls_policies.sql
- 003_sample_data.sql (optional)
- 004_pgvector_ai.sql (requires extension availability)
- 005_content_quality.sql
- 005_orders_payment.sql
- 006_reviews.sql (NOTE: repository version has fixes)
- 007_coupons.sql
- 008_admin_users.sql
- 009_blog_support.sql
- 010_seo_tools.sql
- 011_multi_brand_management.sql
- 012_content_originality.sql (NOTE: repository version has RLS fixes)
- 013_marketing_tracking.sql
- 014_email_sequences.sql
- 015_web_vitals.sql
- 016_advanced_seo_analysis.sql (NOTE: recommended to validate/fix before running)
- 017_user_retention.sql
- 018_conversions_events.sql

## Notes / repository fixes

- 006_reviews.sql
  - review_status_enum creation is now idempotent
  - fixed invalid `voter_ip::uuid` cast in unique index
  - aligned `check_verified_purchase()` status check with existing `order_status_enum`

- 012_content_originality.sql
  - fixed RLS policies to reference `admin_users.auth_user_id` and `brand_ids` array
  - added service_role full-access policies for new tables

## Current database state (from latest health check)

This runbook assumes you will run `000_health_check.sql` to determine which scripts have been applied.

## Production vs dev

- Sample data (003) should not be executed in production.
- RLS is enabled by scripts; use `service_role` key for backend operations.

## Conversions (event-level logging)

- `pixel_events` remains platform-level tracking (used by `tracking.ts`).
- `conversion_events` is event-level conversions logging (used by `conversions.ts`).

