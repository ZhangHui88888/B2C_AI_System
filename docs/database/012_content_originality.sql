-- Phase 5: Content Originality & Differentiation Schema Updates
-- Run this after 011_multi_brand_management.sql

-- ============================================
-- 1. CONTENT ORIGINALITY TRACKING
-- ============================================

-- Add originality tracking fields to content_library
ALTER TABLE content_library 
ADD COLUMN IF NOT EXISTS originality_score INTEGER CHECK (originality_score >= 0 AND originality_score <= 100),
ADD COLUMN IF NOT EXISTS originality_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS originality_flags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS differentiation_source JSONB DEFAULT '{}';

-- Index for finding content that needs originality check
CREATE INDEX IF NOT EXISTS idx_content_originality ON content_library(brand_id, originality_score) 
WHERE originality_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_needs_check ON content_library(brand_id, originality_checked_at) 
WHERE is_ai_generated = true;

-- ============================================
-- 2. CONTENT DIFFERENTIATION LOG
-- ============================================

-- Track what data sources were used for differentiation
CREATE TABLE IF NOT EXISTS content_differentiation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_library(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    content_type VARCHAR(50) NOT NULL,
    
    -- Data sources used
    included_reviews BOOLEAN DEFAULT false,
    review_count INTEGER DEFAULT 0,
    included_specs BOOLEAN DEFAULT false,
    included_comparisons BOOLEAN DEFAULT false,
    comparison_product_ids UUID[] DEFAULT '{}',
    
    -- Generation metadata
    tone VARCHAR(50),
    language VARCHAR(50),
    base_content_length INTEGER,
    generated_content_length INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diff_logs_brand ON content_differentiation_logs(brand_id);
CREATE INDEX idx_diff_logs_product ON content_differentiation_logs(product_id);
CREATE INDEX idx_diff_logs_date ON content_differentiation_logs(created_at);

-- ============================================
-- 3. ORIGINALITY CHECK LOG
-- ============================================

-- Track originality checks for analytics
CREATE TABLE IF NOT EXISTS originality_check_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_library(id) ON DELETE SET NULL,
    
    -- Check results
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    has_generic_opening BOOLEAN DEFAULT false,
    has_repetitive_structure BOOLEAN DEFAULT false,
    lacks_specific_details BOOLEAN DEFAULT false,
    has_ai_patterns BOOLEAN DEFAULT false,
    
    -- Detected issues
    common_patterns_count INTEGER DEFAULT 0,
    suggestions_count INTEGER DEFAULT 0,
    
    -- Content snapshot (for tracking improvements)
    content_length INTEGER,
    content_hash VARCHAR(64),
    
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_originality_logs_brand ON originality_check_logs(brand_id);
CREATE INDEX idx_originality_logs_content ON originality_check_logs(content_id);
CREATE INDEX idx_originality_logs_score ON originality_check_logs(brand_id, score);

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Function to get content needing originality check
CREATE OR REPLACE FUNCTION get_content_needing_originality_check(
    p_brand_id UUID,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    type VARCHAR(50),
    content TEXT,
    created_at TIMESTAMPTZ,
    is_ai_generated BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cl.id,
        cl.title,
        cl.type::VARCHAR(50),
        cl.content,
        cl.created_at,
        cl.is_ai_generated
    FROM content_library cl
    WHERE cl.brand_id = p_brand_id
      AND cl.is_ai_generated = true
      AND cl.originality_checked_at IS NULL
      AND cl.status IN ('draft', 'approved', 'published')
    ORDER BY cl.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get average originality score for a brand
CREATE OR REPLACE FUNCTION get_brand_originality_stats(
    p_brand_id UUID
)
RETURNS TABLE (
    avg_score DECIMAL(5,2),
    total_checked INTEGER,
    low_score_count INTEGER,
    high_score_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(AVG(cl.originality_score)::DECIMAL, 2) as avg_score,
        COUNT(*)::INTEGER as total_checked,
        COUNT(*) FILTER (WHERE cl.originality_score < 50)::INTEGER as low_score_count,
        COUNT(*) FILTER (WHERE cl.originality_score >= 70)::INTEGER as high_score_count
    FROM content_library cl
    WHERE cl.brand_id = p_brand_id
      AND cl.originality_score IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. RLS POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE content_differentiation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE originality_check_logs ENABLE ROW LEVEL SECURITY;

-- Policies for content_differentiation_logs
CREATE POLICY "Service role can do everything on content_differentiation_logs"
    ON content_differentiation_logs FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Differentiation logs visible to brand admins" ON content_differentiation_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.auth_user_id = auth.uid()
            AND au.is_active = true
            AND (
                au.role = 'super_admin'
                OR content_differentiation_logs.brand_id = ANY(au.brand_ids)
            )
        )
    );

CREATE POLICY "Differentiation logs insertable by brand admins" ON content_differentiation_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.auth_user_id = auth.uid()
            AND au.is_active = true
            AND (
                au.role = 'super_admin'
                OR content_differentiation_logs.brand_id = ANY(au.brand_ids)
            )
        )
    );

-- Policies for originality_check_logs
CREATE POLICY "Service role can do everything on originality_check_logs"
    ON originality_check_logs FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Originality logs visible to brand admins" ON originality_check_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.auth_user_id = auth.uid()
            AND au.is_active = true
            AND (
                au.role = 'super_admin'
                OR originality_check_logs.brand_id = ANY(au.brand_ids)
            )
        )
    );

CREATE POLICY "Originality logs insertable by brand admins" ON originality_check_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admin_users au 
            WHERE au.auth_user_id = auth.uid()
            AND au.is_active = true
            AND (
                au.role = 'super_admin'
                OR originality_check_logs.brand_id = ANY(au.brand_ids)
            )
        )
    );

-- ============================================
-- 6. COMMENTS
-- ============================================

COMMENT ON COLUMN content_library.originality_score IS 'AI-analyzed originality score (0-100). Higher = more original.';
COMMENT ON COLUMN content_library.originality_checked_at IS 'When the content was last checked for originality.';
COMMENT ON COLUMN content_library.originality_flags IS 'JSON object with flags: hasGenericOpening, hasRepetitiveStructure, lacksSpecificDetails, hasAIPatterns';
COMMENT ON COLUMN content_library.differentiation_source IS 'JSON object tracking what data sources were used to generate this content.';

COMMENT ON TABLE content_differentiation_logs IS 'Tracks content differentiation operations for analytics and auditing.';
COMMENT ON TABLE originality_check_logs IS 'Tracks originality check history for content improvement tracking.';
