-- Content Quality Protection & Analytics Schema Updates
-- Run this after 004_pgvector_ai.sql

-- ============================================
-- 1. AUTHORS TABLE (E-E-A-T)
-- ============================================
CREATE TABLE IF NOT EXISTS authors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    credentials TEXT[],                      -- 资质证书
    social_links JSONB DEFAULT '{}',         -- {"twitter": "...", "linkedin": "..."}
    is_active BOOLEAN DEFAULT true,
    article_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_authors_brand ON authors(brand_id);
CREATE INDEX idx_authors_slug ON authors(brand_id, slug);
CREATE INDEX idx_authors_active ON authors(is_active);

ALTER TABLE authors ADD CONSTRAINT unique_author_slug_per_brand UNIQUE (brand_id, slug);

CREATE TRIGGER trigger_authors_updated
    BEFORE UPDATE ON authors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. CONTENT_LIBRARY ENHANCEMENTS
-- ============================================

-- Add AI content tracking fields
ALTER TABLE content_library 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS similarity_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES authors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS title VARCHAR(500),
ADD COLUMN IF NOT EXISTS meta_description VARCHAR(500),
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS publish_scheduled_at TIMESTAMPTZ;

-- Index for AI content filtering
CREATE INDEX IF NOT EXISTS idx_content_ai_generated ON content_library(brand_id, is_ai_generated);
CREATE INDEX IF NOT EXISTS idx_content_author ON content_library(author_id);
CREATE INDEX IF NOT EXISTS idx_content_scheduled ON content_library(publish_scheduled_at) WHERE publish_scheduled_at IS NOT NULL;

-- ============================================
-- 3. CONTENT PUBLISH LIMITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS content_publish_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_library(id) ON DELETE SET NULL,
    content_type VARCHAR(50) NOT NULL,
    published_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_publish_logs_brand ON content_publish_logs(brand_id);
CREATE INDEX idx_publish_logs_date ON content_publish_logs(brand_id, published_at);

-- ============================================
-- 4. DAILY ANALYTICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS daily_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Traffic metrics
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    -- Sales metrics
    orders_count INTEGER DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(10,2) DEFAULT 0,
    -- Conversion metrics
    cart_additions INTEGER DEFAULT 0,
    checkout_starts INTEGER DEFAULT 0,
    checkout_completions INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,4) DEFAULT 0,
    -- Traffic sources
    traffic_sources JSONB DEFAULT '{}',      -- {"direct": 100, "organic": 50, "social": 30}
    -- Product data
    top_products JSONB DEFAULT '[]',          -- [{product_id, views, sales}]
    -- Customer data
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_brand ON daily_analytics(brand_id);
CREATE INDEX idx_analytics_date ON daily_analytics(brand_id, date);
CREATE UNIQUE INDEX idx_analytics_brand_date ON daily_analytics(brand_id, date);

-- ============================================
-- 5. PRODUCT VIEWS TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS product_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    session_id VARCHAR(100),
    viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_views_brand ON product_views(brand_id);
CREATE INDEX idx_product_views_product ON product_views(product_id);
CREATE INDEX idx_product_views_date ON product_views(viewed_at);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Function to get daily publish count for rate limiting
CREATE OR REPLACE FUNCTION get_daily_publish_count(
    p_brand_id UUID,
    p_content_type VARCHAR DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM content_publish_logs
    WHERE brand_id = p_brand_id
      AND published_at >= CURRENT_DATE
      AND published_at < CURRENT_DATE + INTERVAL '1 day'
      AND (p_content_type IS NULL OR content_type = p_content_type);
    
    RETURN count_result;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily analytics
CREATE OR REPLACE FUNCTION aggregate_daily_analytics(
    p_brand_id UUID,
    p_date DATE
)
RETURNS void AS $$
BEGIN
    INSERT INTO daily_analytics (brand_id, date, orders_count, revenue, avg_order_value, new_customers)
    SELECT 
        p_brand_id,
        p_date,
        COUNT(*) as orders_count,
        COALESCE(SUM(total), 0) as revenue,
        COALESCE(AVG(total), 0) as avg_order_value,
        0 as new_customers
    FROM orders
    WHERE brand_id = p_brand_id
      AND DATE(created_at) = p_date
      AND status NOT IN ('cancelled', 'refunded')
    ON CONFLICT (brand_id, date) 
    DO UPDATE SET
        orders_count = EXCLUDED.orders_count,
        revenue = EXCLUDED.revenue,
        avg_order_value = EXCLUDED.avg_order_value,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get content needing review (> 90 days old)
CREATE OR REPLACE FUNCTION get_stale_content(
    p_brand_id UUID,
    p_days_threshold INTEGER DEFAULT 90
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    type content_type_enum,
    last_updated TIMESTAMPTZ,
    days_since_update INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cl.id,
        cl.title,
        cl.type,
        cl.updated_at as last_updated,
        EXTRACT(DAY FROM NOW() - cl.updated_at)::INTEGER as days_since_update
    FROM content_library cl
    WHERE cl.brand_id = p_brand_id
      AND cl.status = 'published'
      AND cl.updated_at < NOW() - (p_days_threshold || ' days')::INTERVAL
    ORDER BY cl.updated_at ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. DEFAULT SETTINGS FOR CONTENT LIMITS
-- ============================================
-- These will be inserted per brand as needed via the settings API
-- Example settings keys:
-- - content_daily_limit: 10
-- - content_weekly_limit: 50
-- - content_require_author: true
-- - content_similarity_threshold: 30
