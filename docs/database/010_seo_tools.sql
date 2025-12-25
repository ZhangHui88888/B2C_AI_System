-- =============================================
-- SEO Tools Database Schema
-- Phase 7: Advanced SEO/GEO Tools
-- =============================================

-- 1. SEO Meta Overrides Table
-- Stores custom meta tags for products, categories, blogs, and pages
CREATE TABLE IF NOT EXISTS seo_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Page identification
  page_type VARCHAR(50) NOT NULL, -- 'product', 'category', 'blog', 'page', 'homepage'
  page_id UUID, -- References product/category/blog id, NULL for homepage/static pages
  page_slug VARCHAR(255), -- For static pages like 'about', 'contact'
  
  -- Meta content
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  meta_keywords TEXT,
  
  -- Open Graph
  og_title VARCHAR(100),
  og_description VARCHAR(200),
  og_image VARCHAR(500),
  
  -- Twitter Card
  twitter_title VARCHAR(70),
  twitter_description VARCHAR(200),
  twitter_image VARCHAR(500),
  
  -- Advanced
  canonical_url VARCHAR(500),
  robots_directive VARCHAR(100) DEFAULT 'index,follow', -- 'noindex,nofollow', etc.
  
  -- AI Generation tracking
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_generated_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint per page
  UNIQUE(brand_id, page_type, page_id, page_slug)
);

-- 2. URL Redirects Table (301/302 redirects)
CREATE TABLE IF NOT EXISTS url_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  source_path VARCHAR(500) NOT NULL, -- Original URL path (without domain)
  target_url VARCHAR(1000) NOT NULL, -- Target URL (can be full URL or path)
  redirect_type INTEGER DEFAULT 301, -- 301 (permanent) or 302 (temporary)
  
  -- Analytics
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, source_path)
);

-- 3. 404 Error Log Table
CREATE TABLE IF NOT EXISTS error_404_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  request_path VARCHAR(1000) NOT NULL,
  referrer VARCHAR(1000),
  user_agent TEXT,
  ip_address VARCHAR(45),
  
  -- Aggregation
  hit_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Resolution status
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_redirect_id UUID REFERENCES url_redirects(id),
  
  UNIQUE(brand_id, request_path)
);

-- 4. SEO Reports Table
CREATE TABLE IF NOT EXISTS seo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Report type
  report_type VARCHAR(50) NOT NULL, -- 'page_audit', 'site_audit', 'keyword_analysis', 'content_score'
  
  -- Target
  page_type VARCHAR(50),
  page_id UUID,
  page_url VARCHAR(500),
  
  -- Report data (JSONB for flexibility)
  report_data JSONB NOT NULL DEFAULT '{}',
  
  -- Scores
  overall_score INTEGER, -- 0-100
  
  -- Specific scores
  title_score INTEGER,
  description_score INTEGER,
  content_score INTEGER,
  readability_score INTEGER,
  keyword_score INTEGER,
  technical_score INTEGER,
  
  -- Issues found
  issues JSONB DEFAULT '[]', -- Array of issues with severity
  recommendations JSONB DEFAULT '[]', -- Array of suggestions
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Keywords Tracking Table
CREATE TABLE IF NOT EXISTS seo_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  keyword VARCHAR(255) NOT NULL,
  search_intent VARCHAR(50), -- 'informational', 'navigational', 'transactional', 'commercial'
  
  -- Target page
  target_page_type VARCHAR(50),
  target_page_id UUID,
  
  -- Metrics (can be updated from external sources)
  search_volume INTEGER,
  keyword_difficulty INTEGER, -- 0-100
  current_position INTEGER,
  previous_position INTEGER,
  
  -- Tracking
  is_tracked BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, keyword)
);

-- 6. Sitemap Configuration Table
CREATE TABLE IF NOT EXISTS sitemap_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Page type configuration
  page_type VARCHAR(50) NOT NULL, -- 'products', 'categories', 'blogs', 'pages'
  
  is_included BOOLEAN DEFAULT TRUE,
  changefreq VARCHAR(20) DEFAULT 'weekly', -- 'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
  priority DECIMAL(2,1) DEFAULT 0.5, -- 0.0 to 1.0
  
  -- Last generation
  last_generated_at TIMESTAMPTZ,
  url_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, page_type)
);

-- 7. Robots.txt Configuration Table
CREATE TABLE IF NOT EXISTS robots_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Custom robots.txt content (overrides default)
  custom_content TEXT,
  
  -- AI crawler settings
  allow_gptbot BOOLEAN DEFAULT TRUE,
  allow_claudebot BOOLEAN DEFAULT TRUE,
  allow_perplexitybot BOOLEAN DEFAULT TRUE,
  allow_googlebot BOOLEAN DEFAULT TRUE,
  allow_bingbot BOOLEAN DEFAULT TRUE,
  
  -- Disallow paths (JSONB array)
  disallow_paths JSONB DEFAULT '[]',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id)
);

-- 8. AI Crawler Logs Table (GEO Optimization)
CREATE TABLE IF NOT EXISTS ai_crawler_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  crawler_name VARCHAR(100) NOT NULL, -- 'GPTBot', 'ClaudeBot', 'PerplexityBot', etc.
  request_path VARCHAR(1000) NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(45),
  
  -- Request info
  request_method VARCHAR(10),
  response_status INTEGER,
  response_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Content SEO Analysis Cache
CREATE TABLE IF NOT EXISTS content_seo_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Content reference
  content_type VARCHAR(50) NOT NULL, -- 'product', 'blog', 'page'
  content_id UUID NOT NULL,
  
  -- Analysis results
  word_count INTEGER,
  sentence_count INTEGER,
  paragraph_count INTEGER,
  
  -- Readability metrics
  flesch_reading_ease DECIMAL(5,2),
  flesch_kincaid_grade DECIMAL(4,2),
  
  -- Keyword analysis
  primary_keyword VARCHAR(255),
  keyword_density DECIMAL(5,2),
  keyword_in_title BOOLEAN,
  keyword_in_h1 BOOLEAN,
  keyword_in_meta_desc BOOLEAN,
  keyword_in_first_paragraph BOOLEAN,
  
  -- Structure analysis
  has_h1 BOOLEAN,
  h2_count INTEGER,
  h3_count INTEGER,
  image_count INTEGER,
  images_with_alt INTEGER,
  internal_link_count INTEGER,
  external_link_count INTEGER,
  
  -- Overall scores
  seo_score INTEGER, -- 0-100
  readability_score INTEGER, -- 0-100
  eeat_score INTEGER, -- 0-100 (E-E-A-T: Experience, Expertise, Authoritativeness, Trustworthiness)
  
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, content_type, content_id)
);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_seo_meta_brand ON seo_meta(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_meta_page ON seo_meta(brand_id, page_type, page_id);
CREATE INDEX IF NOT EXISTS idx_seo_meta_slug ON seo_meta(brand_id, page_type, page_slug);

CREATE INDEX IF NOT EXISTS idx_redirects_brand ON url_redirects(brand_id);
CREATE INDEX IF NOT EXISTS idx_redirects_source ON url_redirects(brand_id, source_path);
CREATE INDEX IF NOT EXISTS idx_redirects_active ON url_redirects(brand_id, is_active);

CREATE INDEX IF NOT EXISTS idx_404_brand ON error_404_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_404_path ON error_404_logs(brand_id, request_path);
CREATE INDEX IF NOT EXISTS idx_404_unresolved ON error_404_logs(brand_id, is_resolved) WHERE is_resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_seo_reports_brand ON seo_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_reports_page ON seo_reports(brand_id, page_type, page_id);
CREATE INDEX IF NOT EXISTS idx_seo_reports_type ON seo_reports(brand_id, report_type);

CREATE INDEX IF NOT EXISTS idx_keywords_brand ON seo_keywords(brand_id);
CREATE INDEX IF NOT EXISTS idx_keywords_tracked ON seo_keywords(brand_id, is_tracked);

CREATE INDEX IF NOT EXISTS idx_ai_logs_brand ON ai_crawler_logs(brand_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_crawler ON ai_crawler_logs(brand_id, crawler_name);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_crawler_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_content_seo_brand ON content_seo_cache(brand_id);
CREATE INDEX IF NOT EXISTS idx_content_seo_content ON content_seo_cache(brand_id, content_type, content_id);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE seo_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_redirects ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_404_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitemap_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE robots_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_crawler_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_seo_cache ENABLE ROW LEVEL SECURITY;

-- SEO Meta policies
CREATE POLICY "Allow read seo_meta for all" ON seo_meta
  FOR SELECT USING (true);

CREATE POLICY "Allow insert seo_meta for authenticated" ON seo_meta
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update seo_meta for authenticated" ON seo_meta
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete seo_meta for authenticated" ON seo_meta
  FOR DELETE USING (auth.role() = 'authenticated');

-- URL Redirects policies
CREATE POLICY "Allow read redirects for all" ON url_redirects
  FOR SELECT USING (true);

CREATE POLICY "Allow insert redirects for authenticated" ON url_redirects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update redirects for authenticated" ON url_redirects
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete redirects for authenticated" ON url_redirects
  FOR DELETE USING (auth.role() = 'authenticated');

-- 404 Error logs policies
CREATE POLICY "Allow read 404_logs for authenticated" ON error_404_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert 404_logs for all" ON error_404_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update 404_logs for authenticated" ON error_404_logs
  FOR UPDATE USING (auth.role() = 'authenticated');

-- SEO Reports policies
CREATE POLICY "Allow read seo_reports for authenticated" ON seo_reports
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert seo_reports for authenticated" ON seo_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- SEO Keywords policies
CREATE POLICY "Allow read keywords for authenticated" ON seo_keywords
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert keywords for authenticated" ON seo_keywords
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update keywords for authenticated" ON seo_keywords
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Allow delete keywords for authenticated" ON seo_keywords
  FOR DELETE USING (auth.role() = 'authenticated');

-- Sitemap config policies
CREATE POLICY "Allow read sitemap_config for all" ON sitemap_config
  FOR SELECT USING (true);

CREATE POLICY "Allow insert sitemap_config for authenticated" ON sitemap_config
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update sitemap_config for authenticated" ON sitemap_config
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Robots config policies
CREATE POLICY "Allow read robots_config for all" ON robots_config
  FOR SELECT USING (true);

CREATE POLICY "Allow insert robots_config for authenticated" ON robots_config
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update robots_config for authenticated" ON robots_config
  FOR UPDATE USING (auth.role() = 'authenticated');

-- AI Crawler logs policies
CREATE POLICY "Allow read ai_logs for authenticated" ON ai_crawler_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert ai_logs for all" ON ai_crawler_logs
  FOR INSERT WITH CHECK (true);

-- Content SEO Cache policies
CREATE POLICY "Allow read content_seo for all" ON content_seo_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow insert content_seo for authenticated" ON content_seo_cache
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow update content_seo for authenticated" ON content_seo_cache
  FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- Helper Functions
-- =============================================

-- Function to get active redirect for a path
CREATE OR REPLACE FUNCTION get_redirect(p_brand_id UUID, p_path VARCHAR)
RETURNS TABLE(target_url VARCHAR, redirect_type INTEGER) AS $$
BEGIN
  UPDATE url_redirects
  SET hit_count = hit_count + 1, last_hit_at = NOW()
  WHERE brand_id = p_brand_id AND source_path = p_path AND is_active = TRUE;
  
  RETURN QUERY
  SELECT r.target_url, r.redirect_type
  FROM url_redirects r
  WHERE r.brand_id = p_brand_id AND r.source_path = p_path AND r.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to log 404 error (with upsert)
CREATE OR REPLACE FUNCTION log_404_error(
  p_brand_id UUID,
  p_path VARCHAR,
  p_referrer VARCHAR DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address VARCHAR DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO error_404_logs (brand_id, request_path, referrer, user_agent, ip_address)
  VALUES (p_brand_id, p_path, p_referrer, p_user_agent, p_ip_address)
  ON CONFLICT (brand_id, request_path)
  DO UPDATE SET
    hit_count = error_404_logs.hit_count + 1,
    last_seen_at = NOW(),
    referrer = COALESCE(EXCLUDED.referrer, error_404_logs.referrer),
    user_agent = COALESCE(EXCLUDED.user_agent, error_404_logs.user_agent);
END;
$$ LANGUAGE plpgsql;

-- Function to get SEO issues summary
CREATE OR REPLACE FUNCTION get_seo_issues_summary(p_brand_id UUID)
RETURNS TABLE(
  missing_meta_count BIGINT,
  duplicate_titles BIGINT,
  duplicate_descriptions BIGINT,
  missing_alt_images BIGINT,
  unresolved_404_count BIGINT,
  low_score_pages BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM products p 
     WHERE p.brand_id = p_brand_id 
     AND NOT EXISTS (SELECT 1 FROM seo_meta m WHERE m.brand_id = p_brand_id AND m.page_type = 'product' AND m.page_id = p.id)),
    (SELECT COUNT(*) - COUNT(DISTINCT meta_title) FROM seo_meta WHERE brand_id = p_brand_id AND meta_title IS NOT NULL),
    (SELECT COUNT(*) - COUNT(DISTINCT meta_description) FROM seo_meta WHERE brand_id = p_brand_id AND meta_description IS NOT NULL),
    (SELECT COUNT(*) FROM content_seo_cache WHERE brand_id = p_brand_id AND image_count > images_with_alt),
    (SELECT COUNT(*) FROM error_404_logs WHERE brand_id = p_brand_id AND is_resolved = FALSE),
    (SELECT COUNT(*) FROM seo_reports WHERE brand_id = p_brand_id AND overall_score < 50);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Trigger for updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_seo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER seo_meta_updated_at BEFORE UPDATE ON seo_meta
FOR EACH ROW EXECUTE FUNCTION update_seo_updated_at();

CREATE TRIGGER redirects_updated_at BEFORE UPDATE ON url_redirects
FOR EACH ROW EXECUTE FUNCTION update_seo_updated_at();

CREATE TRIGGER keywords_updated_at BEFORE UPDATE ON seo_keywords
FOR EACH ROW EXECUTE FUNCTION update_seo_updated_at();

CREATE TRIGGER sitemap_config_updated_at BEFORE UPDATE ON sitemap_config
FOR EACH ROW EXECUTE FUNCTION update_seo_updated_at();

CREATE TRIGGER robots_config_updated_at BEFORE UPDATE ON robots_config
FOR EACH ROW EXECUTE FUNCTION update_seo_updated_at();
