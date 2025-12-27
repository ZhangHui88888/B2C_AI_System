-- Core Web Vitals Monitoring Tables
-- Track LCP, FID, CLS, INP, TTFB metrics

-- ============================================
-- 1. WEB_VITALS TABLE
-- Stores individual Web Vitals measurements
-- ============================================
CREATE TABLE IF NOT EXISTS web_vitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    
    -- Page info
    page_url TEXT NOT NULL,
    page_path VARCHAR(500),
    page_type VARCHAR(50), -- 'home', 'product', 'category', 'blog', 'checkout', 'other'
    
    -- Core Web Vitals
    lcp DECIMAL(10,2), -- Largest Contentful Paint (ms)
    fid DECIMAL(10,2), -- First Input Delay (ms)
    cls DECIMAL(10,4), -- Cumulative Layout Shift (score)
    inp DECIMAL(10,2), -- Interaction to Next Paint (ms)
    ttfb DECIMAL(10,2), -- Time to First Byte (ms)
    fcp DECIMAL(10,2), -- First Contentful Paint (ms)
    
    -- Rating based on Google thresholds
    lcp_rating VARCHAR(10), -- 'good', 'needs-improvement', 'poor'
    fid_rating VARCHAR(10),
    cls_rating VARCHAR(10),
    inp_rating VARCHAR(10),
    
    -- Device & connection info
    device_type VARCHAR(20), -- 'mobile', 'tablet', 'desktop'
    connection_type VARCHAR(20), -- '4g', '3g', '2g', 'slow-2g', 'offline'
    effective_type VARCHAR(20),
    
    -- Browser info
    user_agent TEXT,
    browser_name VARCHAR(50),
    browser_version VARCHAR(20),
    os_name VARCHAR(50),
    
    -- Session info
    session_id VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vitals_brand ON web_vitals(brand_id);
CREATE INDEX idx_vitals_page ON web_vitals(brand_id, page_path);
CREATE INDEX idx_vitals_type ON web_vitals(brand_id, page_type);
CREATE INDEX idx_vitals_device ON web_vitals(brand_id, device_type);
CREATE INDEX idx_vitals_created ON web_vitals(created_at DESC);
CREATE INDEX idx_vitals_lcp ON web_vitals(brand_id, lcp_rating);

-- ============================================
-- 2. WEB_VITALS_AGGREGATES TABLE
-- Daily aggregated metrics for reporting
-- ============================================
CREATE TABLE IF NOT EXISTS web_vitals_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    
    -- Aggregation period
    date DATE NOT NULL,
    page_path VARCHAR(500),
    page_type VARCHAR(50),
    device_type VARCHAR(20),
    
    -- Sample count
    sample_count INTEGER DEFAULT 0,
    
    -- LCP metrics
    lcp_p50 DECIMAL(10,2),
    lcp_p75 DECIMAL(10,2),
    lcp_p95 DECIMAL(10,2),
    lcp_good_pct DECIMAL(5,2),
    lcp_poor_pct DECIMAL(5,2),
    
    -- FID metrics
    fid_p50 DECIMAL(10,2),
    fid_p75 DECIMAL(10,2),
    fid_p95 DECIMAL(10,2),
    fid_good_pct DECIMAL(5,2),
    fid_poor_pct DECIMAL(5,2),
    
    -- CLS metrics
    cls_p50 DECIMAL(10,4),
    cls_p75 DECIMAL(10,4),
    cls_p95 DECIMAL(10,4),
    cls_good_pct DECIMAL(5,2),
    cls_poor_pct DECIMAL(5,2),
    
    -- INP metrics
    inp_p50 DECIMAL(10,2),
    inp_p75 DECIMAL(10,2),
    inp_p95 DECIMAL(10,2),
    inp_good_pct DECIMAL(5,2),
    inp_poor_pct DECIMAL(5,2),
    
    -- TTFB metrics
    ttfb_p50 DECIMAL(10,2),
    ttfb_p75 DECIMAL(10,2),
    ttfb_p95 DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vitals_agg_brand ON web_vitals_aggregates(brand_id);
CREATE INDEX idx_vitals_agg_date ON web_vitals_aggregates(brand_id, date DESC);
CREATE INDEX idx_vitals_agg_page ON web_vitals_aggregates(brand_id, page_path);

ALTER TABLE web_vitals_aggregates 
    ADD CONSTRAINT unique_vitals_agg UNIQUE (brand_id, date, page_path, device_type);

-- ============================================
-- 3. WEB_VITALS_ALERTS TABLE
-- Track performance degradation alerts
-- ============================================
CREATE TYPE alert_severity_enum AS ENUM ('warning', 'critical');
CREATE TYPE alert_status_enum AS ENUM ('active', 'acknowledged', 'resolved');

CREATE TABLE IF NOT EXISTS web_vitals_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    
    -- Alert info
    metric VARCHAR(10) NOT NULL, -- 'lcp', 'fid', 'cls', 'inp'
    page_path VARCHAR(500),
    device_type VARCHAR(20),
    
    severity alert_severity_enum NOT NULL,
    status alert_status_enum DEFAULT 'active',
    
    -- Thresholds
    threshold_value DECIMAL(10,4),
    current_value DECIMAL(10,4),
    previous_value DECIMAL(10,4),
    
    -- Message
    message TEXT,
    
    -- Timestamps
    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vitals_alert_brand ON web_vitals_alerts(brand_id);
CREATE INDEX idx_vitals_alert_status ON web_vitals_alerts(brand_id, status);
CREATE INDEX idx_vitals_alert_created ON web_vitals_alerts(created_at DESC);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE web_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_vitals_aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_vitals_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on web_vitals"
    ON web_vitals FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on web_vitals_aggregates"
    ON web_vitals_aggregates FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on web_vitals_alerts"
    ON web_vitals_alerts FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER trigger_web_vitals_aggregates_updated
    BEFORE UPDATE ON web_vitals_aggregates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate rating based on Google thresholds
CREATE OR REPLACE FUNCTION get_vitals_rating(
    p_metric VARCHAR,
    p_value DECIMAL
)
RETURNS VARCHAR AS $$
BEGIN
    CASE p_metric
        WHEN 'lcp' THEN
            IF p_value <= 2500 THEN RETURN 'good';
            ELSIF p_value <= 4000 THEN RETURN 'needs-improvement';
            ELSE RETURN 'poor';
            END IF;
        WHEN 'fid' THEN
            IF p_value <= 100 THEN RETURN 'good';
            ELSIF p_value <= 300 THEN RETURN 'needs-improvement';
            ELSE RETURN 'poor';
            END IF;
        WHEN 'cls' THEN
            IF p_value <= 0.1 THEN RETURN 'good';
            ELSIF p_value <= 0.25 THEN RETURN 'needs-improvement';
            ELSE RETURN 'poor';
            END IF;
        WHEN 'inp' THEN
            IF p_value <= 200 THEN RETURN 'good';
            ELSIF p_value <= 500 THEN RETURN 'needs-improvement';
            ELSE RETURN 'poor';
            END IF;
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Aggregate daily vitals (call via cron)
CREATE OR REPLACE FUNCTION aggregate_daily_vitals(
    p_brand_id UUID,
    p_date DATE DEFAULT CURRENT_DATE - 1
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Aggregate by page_path and device_type
    INSERT INTO web_vitals_aggregates (
        brand_id, date, page_path, page_type, device_type, sample_count,
        lcp_p50, lcp_p75, lcp_p95, lcp_good_pct, lcp_poor_pct,
        fid_p50, fid_p75, fid_p95, fid_good_pct, fid_poor_pct,
        cls_p50, cls_p75, cls_p95, cls_good_pct, cls_poor_pct,
        inp_p50, inp_p75, inp_p95, inp_good_pct, inp_poor_pct,
        ttfb_p50, ttfb_p75, ttfb_p95
    )
    SELECT 
        brand_id,
        p_date,
        page_path,
        MAX(page_type),
        device_type,
        COUNT(*),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lcp),
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY lcp),
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY lcp),
        COUNT(*) FILTER (WHERE lcp_rating = 'good') * 100.0 / NULLIF(COUNT(*), 0),
        COUNT(*) FILTER (WHERE lcp_rating = 'poor') * 100.0 / NULLIF(COUNT(*), 0),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fid),
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fid),
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY fid),
        COUNT(*) FILTER (WHERE fid_rating = 'good') * 100.0 / NULLIF(COUNT(*), 0),
        COUNT(*) FILTER (WHERE fid_rating = 'poor') * 100.0 / NULLIF(COUNT(*), 0),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cls),
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY cls),
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY cls),
        COUNT(*) FILTER (WHERE cls_rating = 'good') * 100.0 / NULLIF(COUNT(*), 0),
        COUNT(*) FILTER (WHERE cls_rating = 'poor') * 100.0 / NULLIF(COUNT(*), 0),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY inp),
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY inp),
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY inp),
        COUNT(*) FILTER (WHERE inp_rating = 'good') * 100.0 / NULLIF(COUNT(*), 0),
        COUNT(*) FILTER (WHERE inp_rating = 'poor') * 100.0 / NULLIF(COUNT(*), 0),
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ttfb),
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ttfb),
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ttfb)
    FROM web_vitals
    WHERE brand_id = p_brand_id
      AND created_at >= p_date
      AND created_at < p_date + 1
    GROUP BY brand_id, page_path, device_type
    ON CONFLICT (brand_id, date, page_path, device_type) 
    DO UPDATE SET
        sample_count = EXCLUDED.sample_count,
        lcp_p50 = EXCLUDED.lcp_p50,
        lcp_p75 = EXCLUDED.lcp_p75,
        lcp_p95 = EXCLUDED.lcp_p95,
        lcp_good_pct = EXCLUDED.lcp_good_pct,
        lcp_poor_pct = EXCLUDED.lcp_poor_pct,
        fid_p50 = EXCLUDED.fid_p50,
        fid_p75 = EXCLUDED.fid_p75,
        fid_p95 = EXCLUDED.fid_p95,
        fid_good_pct = EXCLUDED.fid_good_pct,
        fid_poor_pct = EXCLUDED.fid_poor_pct,
        cls_p50 = EXCLUDED.cls_p50,
        cls_p75 = EXCLUDED.cls_p75,
        cls_p95 = EXCLUDED.cls_p95,
        cls_good_pct = EXCLUDED.cls_good_pct,
        cls_poor_pct = EXCLUDED.cls_poor_pct,
        inp_p50 = EXCLUDED.inp_p50,
        inp_p75 = EXCLUDED.inp_p75,
        inp_p95 = EXCLUDED.inp_p95,
        inp_good_pct = EXCLUDED.inp_good_pct,
        inp_poor_pct = EXCLUDED.inp_poor_pct,
        ttfb_p50 = EXCLUDED.ttfb_p50,
        ttfb_p75 = EXCLUDED.ttfb_p75,
        ttfb_p95 = EXCLUDED.ttfb_p95,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up old raw vitals data (keep aggregates)
CREATE OR REPLACE FUNCTION cleanup_old_vitals(
    p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM web_vitals
    WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
