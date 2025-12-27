-- =============================================
-- Advanced SEO Analysis Database Schema
-- Phase 7 P3: Advanced SEO/GEO Tools
-- =============================================

-- 1. Page Link Graph (for orphan detection & internal linking)
CREATE TABLE IF NOT EXISTS page_link_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Source page
  source_url VARCHAR(1000) NOT NULL,
  source_type VARCHAR(50), -- 'product', 'category', 'blog', 'page'
  source_id UUID,
  
  -- Target page
  target_url VARCHAR(1000) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  
  -- Link info
  anchor_text VARCHAR(500),
  is_internal BOOLEAN DEFAULT TRUE,
  link_position VARCHAR(50), -- 'header', 'content', 'footer', 'sidebar'
  
  -- Timestamps
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, source_url, target_url)
);

-- 2. Orphan Pages Detection
CREATE TABLE IF NOT EXISTS orphan_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  page_url VARCHAR(1000) NOT NULL,
  page_type VARCHAR(50) NOT NULL,
  page_id UUID,
  page_title VARCHAR(255),
  
  -- Orphan status
  incoming_links_count INTEGER DEFAULT 0,
  is_in_sitemap BOOLEAN DEFAULT TRUE,
  is_in_navigation BOOLEAN DEFAULT FALSE,
  
  -- Resolution
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_action VARCHAR(100), -- 'added_links', 'removed', 'added_to_nav'
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, page_url)
);

-- 3. Internal Link Density Analysis
CREATE TABLE IF NOT EXISTS link_density_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  page_url VARCHAR(1000) NOT NULL,
  page_type VARCHAR(50),
  page_id UUID,
  
  -- Link metrics
  word_count INTEGER DEFAULT 0,
  internal_links_count INTEGER DEFAULT 0,
  external_links_count INTEGER DEFAULT 0,
  broken_links_count INTEGER DEFAULT 0,
  
  -- Density scores
  link_density DECIMAL(5,2), -- links per 100 words
  ideal_density_min DECIMAL(5,2) DEFAULT 1.0,
  ideal_density_max DECIMAL(5,2) DEFAULT 3.0,
  
  -- Status
  density_status VARCHAR(20), -- 'optimal', 'too_low', 'too_high'
  
  -- Recommendations
  suggested_links JSONB DEFAULT '[]', -- suggested internal links to add
  
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, page_url)
);

-- 4. Related Content Recommendations (AI-powered)
CREATE TABLE IF NOT EXISTS related_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Source content
  source_type VARCHAR(50) NOT NULL, -- 'product', 'blog', 'category'
  source_id UUID NOT NULL,
  
  -- Related content
  related_type VARCHAR(50) NOT NULL,
  related_id UUID NOT NULL,
  
  -- Relationship info
  relevance_score DECIMAL(5,4), -- 0.0 to 1.0
  relationship_type VARCHAR(50), -- 'similar', 'complementary', 'frequently_bought_together'
  
  -- AI analysis
  ai_reasoning TEXT,
  is_ai_generated BOOLEAN DEFAULT TRUE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, source_type, source_id, related_type, related_id)
);

-- 5. Sitemap Shards
CREATE TABLE IF NOT EXISTS sitemap_shards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Shard info
  shard_type VARCHAR(50) NOT NULL, -- 'products', 'categories', 'blogs', 'pages', 'images'
  shard_index INTEGER DEFAULT 0, -- for pagination (products-1.xml, products-2.xml)
  
  -- Content
  url_count INTEGER DEFAULT 0,
  urls JSONB DEFAULT '[]', -- array of {loc, lastmod, changefreq, priority}
  
  -- Generation
  last_generated_at TIMESTAMPTZ DEFAULT NOW(),
  file_size_bytes INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  UNIQUE(brand_id, shard_type, shard_index)
);

-- 6. Keyword Research
CREATE TABLE IF NOT EXISTS keyword_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Keyword data
  keyword VARCHAR(255) NOT NULL,
  keyword_normalized VARCHAR(255), -- lowercase, trimmed
  
  -- Search intent classification
  search_intent VARCHAR(50), -- 'informational', 'navigational', 'transactional', 'commercial'
  intent_confidence DECIMAL(5,4), -- 0.0 to 1.0
  
  -- Metrics (from external APIs or estimates)
  search_volume_monthly INTEGER,
  keyword_difficulty INTEGER, -- 0-100
  cpc_estimate DECIMAL(10,2),
  competition_level VARCHAR(20), -- 'low', 'medium', 'high'
  
  -- Trend data
  trend_direction VARCHAR(20), -- 'up', 'down', 'stable'
  seasonal_peak_months INTEGER[], -- e.g., {11, 12} for Nov-Dec
  
  -- Related keywords
  related_keywords JSONB DEFAULT '[]',
  long_tail_variations JSONB DEFAULT '[]',
  
  -- Content mapping
  target_page_type VARCHAR(50),
  target_page_id UUID,
  current_ranking INTEGER,
  
  -- AI analysis
  ai_suggestions TEXT,
  
  -- Status
  is_tracked BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_researched_at TIMESTAMPTZ,
  
  UNIQUE(brand_id, keyword_normalized)
);

-- 7. E-E-A-T Scoring
CREATE TABLE IF NOT EXISTS eeat_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Content reference
  content_type VARCHAR(50) NOT NULL, -- 'product', 'blog', 'page', 'author'
  content_id UUID,
  
  -- E-E-A-T Scores (0-100 each)
  experience_score INTEGER DEFAULT 0,
  expertise_score INTEGER DEFAULT 0,
  authoritativeness_score INTEGER DEFAULT 0,
  trustworthiness_score INTEGER DEFAULT 0,
  overall_score INTEGER DEFAULT 0,
  
  -- Score breakdown (JSONB for flexibility)
  experience_factors JSONB DEFAULT '{}', -- {first_person_experience, case_studies, original_research}
  expertise_factors JSONB DEFAULT '{}', -- {author_credentials, technical_depth, citations}
  authority_factors JSONB DEFAULT '{}', -- {backlinks, mentions, industry_recognition}
  trust_factors JSONB DEFAULT '{}', -- {https, contact_info, privacy_policy, reviews}
  
  -- Recommendations
  improvement_suggestions JSONB DEFAULT '[]',
  
  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, content_type, content_id)
);

-- 8. Keyword Ranking History
CREATE TABLE IF NOT EXISTS keyword_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  keyword_id UUID REFERENCES keyword_research(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  
  -- Ranking data
  position INTEGER, -- 1-100, NULL if not ranking
  previous_position INTEGER,
  position_change INTEGER, -- positive = improved, negative = dropped
  
  -- Search engine
  search_engine VARCHAR(20) DEFAULT 'google', -- 'google', 'bing', 'duckduckgo'
  country VARCHAR(10) DEFAULT 'us',
  device_type VARCHAR(20) DEFAULT 'desktop', -- 'desktop', 'mobile'
  
  -- Ranking URL
  ranking_url VARCHAR(1000),
  
  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Index Status Tracking
CREATE TABLE IF NOT EXISTS index_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  page_url VARCHAR(1000) NOT NULL,
  page_type VARCHAR(50),
  page_id UUID,
  
  -- Index status
  is_indexed BOOLEAN,
  index_status VARCHAR(50), -- 'indexed', 'not_indexed', 'crawled', 'blocked', 'error'
  index_coverage_state VARCHAR(100), -- from Search Console
  
  -- Crawl info
  last_crawl_date TIMESTAMPTZ,
  crawl_frequency VARCHAR(20), -- 'daily', 'weekly', 'monthly', 'rarely'
  
  -- Issues
  indexing_issues JSONB DEFAULT '[]', -- array of issues preventing indexing
  
  -- Mobile usability
  is_mobile_friendly BOOLEAN,
  mobile_issues JSONB DEFAULT '[]',
  
  -- Rich results
  has_rich_results BOOLEAN,
  rich_result_types JSONB DEFAULT '[]', -- ['product', 'review', 'faq']
  
  -- Timestamps
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, page_url)
);

-- 10. Automated SEO Reports
CREATE TABLE IF NOT EXISTS automated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Report config
  report_name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL, -- 'weekly_summary', 'monthly_audit', 'keyword_tracking', 'custom'
  
  -- Schedule
  schedule_frequency VARCHAR(20), -- 'daily', 'weekly', 'monthly'
  schedule_day INTEGER, -- day of week (1-7) or month (1-31)
  schedule_time TIME DEFAULT '09:00:00',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  
  -- Recipients
  recipients JSONB DEFAULT '[]', -- array of email addresses
  
  -- Report content config
  include_sections JSONB DEFAULT '["overview", "rankings", "issues", "recommendations"]',
  custom_filters JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Report History
CREATE TABLE IF NOT EXISTS report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  report_id UUID REFERENCES automated_reports(id) ON DELETE CASCADE,
  
  -- Report data
  report_data JSONB NOT NULL,
  
  -- Summary metrics
  overall_seo_score INTEGER,
  total_pages_analyzed INTEGER,
  issues_found INTEGER,
  improvements_since_last INTEGER,
  
  -- Delivery status
  delivered_to JSONB DEFAULT '[]',
  delivery_status VARCHAR(20), -- 'pending', 'sent', 'failed'
  
  -- Timestamps
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes for Performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_link_graph_brand ON page_link_graph(brand_id);
CREATE INDEX IF NOT EXISTS idx_link_graph_source ON page_link_graph(brand_id, source_url);
CREATE INDEX IF NOT EXISTS idx_link_graph_target ON page_link_graph(brand_id, target_url);

CREATE INDEX IF NOT EXISTS idx_orphan_brand ON orphan_pages(brand_id);
CREATE INDEX IF NOT EXISTS idx_orphan_unresolved ON orphan_pages(brand_id, is_resolved) WHERE is_resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_link_density_brand ON link_density_analysis(brand_id);
CREATE INDEX IF NOT EXISTS idx_link_density_status ON link_density_analysis(brand_id, density_status);

CREATE INDEX IF NOT EXISTS idx_related_content_brand ON related_content(brand_id);
CREATE INDEX IF NOT EXISTS idx_related_content_source ON related_content(brand_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_related_content_active ON related_content(brand_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sitemap_shards_brand ON sitemap_shards(brand_id);
CREATE INDEX IF NOT EXISTS idx_sitemap_shards_type ON sitemap_shards(brand_id, shard_type);

CREATE INDEX IF NOT EXISTS idx_keyword_research_brand ON keyword_research(brand_id);
CREATE INDEX IF NOT EXISTS idx_keyword_research_tracked ON keyword_research(brand_id, is_tracked);
CREATE INDEX IF NOT EXISTS idx_keyword_research_intent ON keyword_research(brand_id, search_intent);

CREATE INDEX IF NOT EXISTS idx_eeat_brand ON eeat_scores(brand_id);
CREATE INDEX IF NOT EXISTS idx_eeat_content ON eeat_scores(brand_id, content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_rankings_brand ON keyword_rankings(brand_id);
CREATE INDEX IF NOT EXISTS idx_rankings_keyword ON keyword_rankings(keyword_id);
CREATE INDEX IF NOT EXISTS idx_rankings_date ON keyword_rankings(checked_at);

CREATE INDEX IF NOT EXISTS idx_index_status_brand ON index_status(brand_id);
CREATE INDEX IF NOT EXISTS idx_index_status_status ON index_status(brand_id, index_status);

CREATE INDEX IF NOT EXISTS idx_auto_reports_brand ON automated_reports(brand_id);
CREATE INDEX IF NOT EXISTS idx_auto_reports_schedule ON automated_reports(next_run_at) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_report_history_brand ON report_history(brand_id);
CREATE INDEX IF NOT EXISTS idx_report_history_report ON report_history(report_id);

-- =============================================
-- RLS Policies
-- =============================================

ALTER TABLE page_link_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE orphan_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_density_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE related_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE sitemap_shards ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE eeat_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE automated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_history ENABLE ROW LEVEL SECURITY;

-- Generic read/write policies for authenticated users
CREATE POLICY "Allow read for authenticated" ON page_link_graph FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write for authenticated" ON page_link_graph FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read orphan_pages for authenticated" ON orphan_pages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write orphan_pages for authenticated" ON orphan_pages FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read link_density for authenticated" ON link_density_analysis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write link_density for authenticated" ON link_density_analysis FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read related_content for all" ON related_content FOR SELECT USING (true);
CREATE POLICY "Allow write related_content for authenticated" ON related_content FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read sitemap_shards for all" ON sitemap_shards FOR SELECT USING (true);
CREATE POLICY "Allow write sitemap_shards for authenticated" ON sitemap_shards FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read keyword_research for authenticated" ON keyword_research FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write keyword_research for authenticated" ON keyword_research FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read eeat_scores for authenticated" ON eeat_scores FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write eeat_scores for authenticated" ON eeat_scores FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read keyword_rankings for authenticated" ON keyword_rankings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write keyword_rankings for authenticated" ON keyword_rankings FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read index_status for authenticated" ON index_status FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write index_status for authenticated" ON index_status FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read automated_reports for authenticated" ON automated_reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write automated_reports for authenticated" ON automated_reports FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow read report_history for authenticated" ON report_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow write report_history for authenticated" ON report_history FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- Helper Functions
-- =============================================

-- Function to find orphan pages (pages with no incoming internal links)
CREATE OR REPLACE FUNCTION find_orphan_pages(p_brand_id UUID)
RETURNS TABLE(
  page_url VARCHAR,
  page_type VARCHAR,
  page_id UUID,
  incoming_links INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH all_pages AS (
    -- Products
    SELECT 
      '/products/' || p.slug AS url,
      'product'::VARCHAR AS type,
      p.id
    FROM products p
    WHERE p.brand_id = p_brand_id AND p.is_active = TRUE
    
    UNION ALL
    
    -- Categories
    SELECT 
      '/categories/' || c.slug AS url,
      'category'::VARCHAR AS type,
      c.id
    FROM categories c
    WHERE c.brand_id = p_brand_id
    
    UNION ALL
    
    -- Blogs
    SELECT 
      '/blog/' || b.slug AS url,
      'blog'::VARCHAR AS type,
      b.id
    FROM blog_posts b
    WHERE b.brand_id = p_brand_id AND b.status = 'published'
  ),
  link_counts AS (
    SELECT 
      target_url,
      COUNT(*) AS cnt
    FROM page_link_graph
    WHERE brand_id = p_brand_id AND is_internal = TRUE
    GROUP BY target_url
  )
  SELECT 
    ap.url,
    ap.type,
    ap.id,
    COALESCE(lc.cnt, 0)::INTEGER
  FROM all_pages ap
  LEFT JOIN link_counts lc ON lc.target_url = ap.url
  WHERE COALESCE(lc.cnt, 0) = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate link density for a page
CREATE OR REPLACE FUNCTION calculate_link_density(
  p_word_count INTEGER,
  p_internal_links INTEGER,
  p_external_links INTEGER
) RETURNS DECIMAL AS $$
BEGIN
  IF p_word_count = 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND(((p_internal_links + p_external_links)::DECIMAL / p_word_count) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to get SEO health summary
CREATE OR REPLACE FUNCTION get_seo_health_summary(p_brand_id UUID)
RETURNS TABLE(
  orphan_pages_count BIGINT,
  low_density_pages BIGINT,
  high_density_pages BIGINT,
  unindexed_pages BIGINT,
  low_eeat_pages BIGINT,
  keywords_dropping BIGINT,
  pending_reports BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM orphan_pages WHERE brand_id = p_brand_id AND is_resolved = FALSE),
    (SELECT COUNT(*) FROM link_density_analysis WHERE brand_id = p_brand_id AND density_status = 'too_low'),
    (SELECT COUNT(*) FROM link_density_analysis WHERE brand_id = p_brand_id AND density_status = 'too_high'),
    (SELECT COUNT(*) FROM index_status WHERE brand_id = p_brand_id AND is_indexed = FALSE),
    (SELECT COUNT(*) FROM eeat_scores WHERE brand_id = p_brand_id AND overall_score < 50),
    (SELECT COUNT(*) FROM keyword_rankings kr 
     WHERE kr.brand_id = p_brand_id 
     AND kr.position_change < 0 
     AND kr.checked_at > NOW() - INTERVAL '7 days'),
    (SELECT COUNT(*) FROM report_history WHERE brand_id = p_brand_id AND delivery_status = 'pending');
END;
$$ LANGUAGE plpgsql;
