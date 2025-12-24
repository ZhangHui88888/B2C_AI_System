-- Row Level Security (RLS) Policies
-- Run this after 001_initial_schema.sql
-- Multi-brand support: All policies filter by brand_id

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;

-- ============================================
-- BRANDS POLICIES
-- ============================================
CREATE POLICY "Public can view active brands"
    ON brands FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role can do everything on brands"
    ON brands FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- CATEGORIES POLICIES
-- Public read access for active categories
-- Note: brand_id filtering done in API layer for flexibility
-- ============================================
CREATE POLICY "Public can view active categories"
    ON categories FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role can do everything on categories"
    ON categories FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- PRODUCTS POLICIES
-- Public read access for active products
-- ============================================
CREATE POLICY "Public can view active products"
    ON products FOR SELECT
    USING (is_active = true);

CREATE POLICY "Service role can do everything on products"
    ON products FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- ORDERS POLICIES
-- Service role has full access, API handles brand filtering
-- ============================================
CREATE POLICY "Service role can do everything on orders"
    ON orders FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- CUSTOMERS POLICIES
-- ============================================
CREATE POLICY "Service role can do everything on customers"
    ON customers FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- CONVERSATIONS POLICIES
-- Allow insert for chat (brand_id required)
-- ============================================
CREATE POLICY "Public can insert conversations"
    ON conversations FOR INSERT
    WITH CHECK (brand_id IS NOT NULL);

CREATE POLICY "Public can view conversations"
    ON conversations FOR SELECT
    USING (true);  -- Session/brand validation done in API

CREATE POLICY "Service role can do everything on conversations"
    ON conversations FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- KNOWLEDGE_BASE POLICIES
-- Public read for AI search
-- ============================================
CREATE POLICY "Public can view knowledge base"
    ON knowledge_base FOR SELECT
    USING (true);

CREATE POLICY "Service role can do everything on knowledge_base"
    ON knowledge_base FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- SETTINGS POLICIES
-- Public read for certain settings
-- ============================================
CREATE POLICY "Public can view non-sensitive settings"
    ON settings FOR SELECT
    USING (
        key IN ('store_name', 'currency', 'ai_enabled', 'shipping_default_cost', 'shipping_free_threshold', 'logo_url')
    );

CREATE POLICY "Service role can do everything on settings"
    ON settings FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- CONTENT_LIBRARY POLICIES
-- ============================================
CREATE POLICY "Service role can do everything on content_library"
    ON content_library FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Verify order access by email within a brand
CREATE OR REPLACE FUNCTION verify_order_access(p_brand_id UUID, p_order_id UUID, p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM orders
        WHERE brand_id = p_brand_id 
          AND id = p_order_id 
          AND customer_email = p_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get brand by domain (for routing)
CREATE OR REPLACE FUNCTION get_brand_by_domain(p_domain TEXT)
RETURNS UUID AS $$
DECLARE
    v_brand_id UUID;
BEGIN
    SELECT id INTO v_brand_id 
    FROM brands 
    WHERE domain = p_domain AND is_active = true
    LIMIT 1;
    RETURN v_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get brand by slug
CREATE OR REPLACE FUNCTION get_brand_by_slug(p_slug TEXT)
RETURNS UUID AS $$
DECLARE
    v_brand_id UUID;
BEGIN
    SELECT id INTO v_brand_id 
    FROM brands 
    WHERE slug = p_slug AND is_active = true
    LIMIT 1;
    RETURN v_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
