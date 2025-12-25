-- Blog Support Schema Updates
-- Add blog content type and slug field to content_library
-- Run this after 008_admin_users.sql

-- ============================================
-- 1. ADD BLOG TYPE TO CONTENT_TYPE_ENUM
-- ============================================

-- Add 'blog' to content_type_enum
ALTER TYPE content_type_enum ADD VALUE IF NOT EXISTS 'blog';

-- ============================================
-- 2. ADD SLUG FIELD TO CONTENT_LIBRARY
-- ============================================

-- Add slug field for blog posts
ALTER TABLE content_library 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_content_slug ON content_library(brand_id, slug) WHERE slug IS NOT NULL;

-- Add unique constraint for slug per brand
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_content_slug_per_brand'
    ) THEN
        ALTER TABLE content_library 
        ADD CONSTRAINT unique_content_slug_per_brand 
        UNIQUE (brand_id, slug);
    END IF;
END $$;

-- ============================================
-- 3. ADD PUBLISHED_AT FIELD
-- ============================================

-- Add published_at timestamp for blog posts
ALTER TABLE content_library 
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Create index for published date sorting
CREATE INDEX IF NOT EXISTS idx_content_published ON content_library(brand_id, published_at DESC) WHERE published_at IS NOT NULL;

-- ============================================
-- 4. FUNCTION TO AUTO-GENERATE SLUG
-- ============================================

CREATE OR REPLACE FUNCTION generate_content_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Only generate slug for blog posts if not provided
    IF NEW.type = 'blog' AND NEW.slug IS NULL AND NEW.title IS NOT NULL THEN
        -- Generate base slug from title
        base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
        base_slug := trim(both '-' from base_slug);
        final_slug := base_slug;
        
        -- Check for uniqueness and append counter if needed
        WHILE EXISTS (
            SELECT 1 FROM content_library 
            WHERE brand_id = NEW.brand_id 
            AND slug = final_slug 
            AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) LOOP
            counter := counter + 1;
            final_slug := base_slug || '-' || counter;
        END LOOP;
        
        NEW.slug := final_slug;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating slugs
DROP TRIGGER IF EXISTS trigger_generate_content_slug ON content_library;
CREATE TRIGGER trigger_generate_content_slug
    BEFORE INSERT OR UPDATE ON content_library
    FOR EACH ROW
    EXECUTE FUNCTION generate_content_slug();

-- ============================================
-- 5. UPDATE CONTENT_LIBRARY TRIGGER
-- ============================================

-- Ensure updated_at trigger exists
DROP TRIGGER IF EXISTS trigger_content_library_updated ON content_library;
CREATE TRIGGER trigger_content_library_updated
    BEFORE UPDATE ON content_library
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 6. SAMPLE BLOG POST DATA
-- ============================================

-- Insert sample blog post (optional - for testing)
-- Uncomment to add sample data:

/*
INSERT INTO content_library (
    brand_id,
    type,
    title,
    meta_description,
    content,
    status,
    author_id,
    published_at,
    slug
)
SELECT 
    b.id as brand_id,
    'blog'::content_type_enum,
    'How to Choose the Right Product: A Practical Guide',
    'Learn how to evaluate features, compare options, and make informed purchasing decisions with our comprehensive buying guide.',
    E'## Introduction\n\nChoosing the right product can be overwhelming with so many options available. This guide will help you make informed decisions.\n\n## 1. Define Your Needs\n\nStart by clearly identifying what you need the product for. Consider:\n- Primary use case\n- Frequency of use\n- Budget constraints\n- Must-have vs nice-to-have features\n\n## 2. Research and Compare\n\nDon''t rush into a purchase. Take time to:\n- Read product specifications\n- Compare similar products\n- Check customer reviews\n- Look for expert opinions\n\n## 3. Consider Long-term Value\n\nThink beyond the initial price:\n- Durability and build quality\n- Warranty and support\n- Maintenance costs\n- Resale value\n\n## 4. Check Return Policies\n\nAlways verify:\n- Return window duration\n- Condition requirements\n- Refund vs store credit\n- Return shipping costs\n\n## Conclusion\n\nMaking the right purchase decision requires research and patience. Use this checklist to guide your next purchase and shop with confidence.',
    'published'::content_status_enum,
    a.id as author_id,
    NOW(),
    'how-to-choose-the-right-product'
FROM brands b
CROSS JOIN authors a
WHERE b.is_active = true 
AND a.is_active = true
LIMIT 1
ON CONFLICT (brand_id, slug) DO NOTHING;
*/