-- Phase 8: Multi-Brand Management System
-- This migration adds support for:
-- 1. Brand theme customization
-- 2. Domain binding configuration
-- 3. Shared knowledge base and templates
-- 4. Cross-brand collaboration features

-- ============================================
-- 1. BRAND THEME SETTINGS (Extend brands table)
-- ============================================

-- Add theme columns to brands table
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS theme JSONB DEFAULT '{
  "primaryColor": "#4F46E5",
  "secondaryColor": "#10B981",
  "accentColor": "#F59E0B",
  "fontFamily": "Inter",
  "headerStyle": "default",
  "footerStyle": "default",
  "buttonStyle": "rounded"
}'::jsonb;

ALTER TABLE brands
ADD COLUMN IF NOT EXISTS custom_css TEXT;

ALTER TABLE brands
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

ALTER TABLE brands
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

ALTER TABLE brands
ADD COLUMN IF NOT EXISTS contact_info JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- 2. DOMAIN CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS brand_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT false,
  ssl_status VARCHAR(50) DEFAULT 'pending', -- pending, active, failed
  dns_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_domains_brand ON brand_domains(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_domains_domain ON brand_domains(domain);
CREATE INDEX IF NOT EXISTS idx_brand_domains_primary ON brand_domains(brand_id, is_primary) WHERE is_primary = true;

ALTER TABLE brand_domains ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brand_domains' AND policyname = 'Service role can do everything on brand_domains'
  ) THEN
    CREATE POLICY "Service role can do everything on brand_domains"
      ON brand_domains FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

-- Trigger for updated_at
CREATE TRIGGER trigger_brand_domains_updated
    BEFORE UPDATE ON brand_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. SHARED KNOWLEDGE BASE
-- ============================================

-- Add sharing support to knowledge_base
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS shared_by_brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS source_knowledge_id UUID REFERENCES knowledge_base(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_shared ON knowledge_base(is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_shared_by ON knowledge_base(shared_by_brand_id);

-- ============================================
-- 4. SHARED TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS shared_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL, -- email, page, content, script
  content JSONB NOT NULL,
  is_public BOOLEAN DEFAULT false, -- Available to all brands
  allowed_brand_ids UUID[] DEFAULT '{}', -- Specific brands that can use this
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_templates_owner ON shared_templates(owner_brand_id);
CREATE INDEX IF NOT EXISTS idx_shared_templates_type ON shared_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_shared_templates_public ON shared_templates(is_public) WHERE is_public = true;

ALTER TABLE shared_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shared_templates' AND policyname = 'Service role can do everything on shared_templates'
  ) THEN
    CREATE POLICY "Service role can do everything on shared_templates"
      ON shared_templates FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

CREATE TRIGGER trigger_shared_templates_updated
    BEFORE UPDATE ON shared_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. BRAND USER ASSIGNMENTS (Enhanced)
-- ============================================

-- Brand-User assignment table for more flexible permission management
CREATE TABLE IF NOT EXISTS brand_user_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'editor', -- brand_admin, editor, read_only
  permissions JSONB DEFAULT '{}', -- Granular permissions
  assigned_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, admin_user_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_user_assignments_brand ON brand_user_assignments(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_user_assignments_user ON brand_user_assignments(admin_user_id);

ALTER TABLE brand_user_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brand_user_assignments' AND policyname = 'Service role can do everything on brand_user_assignments'
  ) THEN
    CREATE POLICY "Service role can do everything on brand_user_assignments"
      ON brand_user_assignments FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

CREATE TRIGGER trigger_brand_user_assignments_updated
    BEFORE UPDATE ON brand_user_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6. CROSS-BRAND ANALYTICS CACHE
-- ============================================

CREATE TABLE IF NOT EXISTS cross_brand_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type VARCHAR(100) NOT NULL, -- daily_sales, monthly_sales, top_products, etc.
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE, -- NULL for aggregate
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_type, brand_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_cross_brand_analytics_type ON cross_brand_analytics(metric_type);
CREATE INDEX IF NOT EXISTS idx_cross_brand_analytics_brand ON cross_brand_analytics(brand_id);
CREATE INDEX IF NOT EXISTS idx_cross_brand_analytics_period ON cross_brand_analytics(period_start, period_end);

ALTER TABLE cross_brand_analytics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cross_brand_analytics' AND policyname = 'Service role can do everything on cross_brand_analytics'
  ) THEN
    CREATE POLICY "Service role can do everything on cross_brand_analytics"
      ON cross_brand_analytics FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to get all brands a user has access to
CREATE OR REPLACE FUNCTION get_user_accessible_brands(p_auth_user_id UUID)
RETURNS TABLE(brand_id UUID, brand_name VARCHAR, role VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as brand_id,
    b.name as brand_name,
    COALESCE(bua.role, 
      CASE 
        WHEN au.role = 'super_admin' THEN 'super_admin'
        ELSE 'read_only'
      END
    )::VARCHAR as role
  FROM admin_users au
  LEFT JOIN brand_user_assignments bua ON bua.admin_user_id = au.id
  CROSS JOIN brands b
  WHERE au.auth_user_id = p_auth_user_id
    AND au.is_active = true
    AND b.is_active = true
    AND (
      au.role = 'super_admin' -- Super admin sees all brands
      OR b.id = ANY(au.brand_ids) -- Legacy brand_ids array
      OR bua.brand_id = b.id -- New assignment table
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can manage a specific brand
CREATE OR REPLACE FUNCTION can_manage_brand(p_auth_user_id UUID, p_brand_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
  v_assignment brand_user_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_admin
  FROM admin_users
  WHERE auth_user_id = p_auth_user_id
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Super admin can manage all brands
  IF v_admin.role = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Check legacy brand_ids array
  IF p_brand_id = ANY(v_admin.brand_ids) THEN
    RETURN true;
  END IF;
  
  -- Check new assignment table
  SELECT * INTO v_assignment
  FROM brand_user_assignments
  WHERE admin_user_id = v_admin.id
    AND brand_id = p_brand_id;
  
  IF FOUND AND v_assignment.role IN ('brand_admin', 'editor') THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get shared knowledge for a brand
CREATE OR REPLACE FUNCTION get_shared_knowledge(p_brand_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  source_brand_name VARCHAR,
  is_own BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.content,
    kb.metadata,
    b.name as source_brand_name,
    (kb.brand_id = p_brand_id) as is_own
  FROM knowledge_base kb
  LEFT JOIN brands b ON b.id = kb.shared_by_brand_id
  WHERE kb.brand_id = p_brand_id
     OR (kb.is_shared = true AND kb.shared_by_brand_id IS NOT NULL)
  ORDER BY kb.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. MIGRATE EXISTING DOMAIN DATA
-- ============================================

-- Migrate existing domains from brands.domain to brand_domains table
INSERT INTO brand_domains (brand_id, domain, is_primary, ssl_status, dns_verified, verified_at)
SELECT id, domain, true, 'active', true, NOW()
FROM brands
WHERE domain IS NOT NULL AND domain != ''
ON CONFLICT (domain) DO NOTHING;

-- ============================================
-- 9. AGGREGATE VIEWS FOR SUPER ADMIN
-- ============================================

-- View for cross-brand order summary
CREATE OR REPLACE VIEW v_cross_brand_orders AS
SELECT 
  b.id as brand_id,
  b.name as brand_name,
  COUNT(o.id) as total_orders,
  COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
  COUNT(CASE WHEN o.status = 'paid' THEN 1 END) as paid_orders,
  COUNT(CASE WHEN o.status = 'shipped' THEN 1 END) as shipped_orders,
  SUM(CASE WHEN o.status IN ('paid', 'shipped', 'delivered') THEN o.total ELSE 0 END) as total_revenue,
  MAX(o.created_at) as last_order_at
FROM brands b
LEFT JOIN orders o ON o.brand_id = b.id
WHERE b.is_active = true
GROUP BY b.id, b.name;

-- View for cross-brand product summary
CREATE OR REPLACE VIEW v_cross_brand_products AS
SELECT 
  b.id as brand_id,
  b.name as brand_name,
  COUNT(p.id) as total_products,
  COUNT(CASE WHEN p.is_active THEN 1 END) as active_products,
  COUNT(CASE WHEN p.is_featured THEN 1 END) as featured_products,
  AVG(p.price) as avg_price
FROM brands b
LEFT JOIN products p ON p.brand_id = b.id
WHERE b.is_active = true
GROUP BY b.id, b.name;

-- View for cross-brand customer summary
CREATE OR REPLACE VIEW v_cross_brand_customers AS
SELECT 
  b.id as brand_id,
  b.name as brand_name,
  COUNT(c.id) as total_customers,
  SUM(c.total_orders) as total_orders,
  SUM(c.total_spent) as total_spent
FROM brands b
LEFT JOIN customers c ON c.brand_id = b.id
WHERE b.is_active = true
GROUP BY b.id, b.name;

COMMENT ON TABLE brand_domains IS 'Multi-domain support for brands';
COMMENT ON TABLE shared_templates IS 'Shared templates across brands';
COMMENT ON TABLE brand_user_assignments IS 'Fine-grained user-brand permission assignments';
COMMENT ON TABLE cross_brand_analytics IS 'Cached analytics data for cross-brand reporting';
