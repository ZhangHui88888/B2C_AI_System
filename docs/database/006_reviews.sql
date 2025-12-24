-- Reviews System Schema
-- Run this after 005_content_quality.sql

-- ============================================
-- 1. REVIEW STATUS ENUM
-- ============================================
CREATE TYPE review_status_enum AS ENUM ('pending', 'approved', 'rejected', 'spam');

-- ============================================
-- 2. REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Review content
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    content TEXT,
    
    -- Reviewer info (for anonymous reviews)
    reviewer_name VARCHAR(255),
    reviewer_email VARCHAR(255),
    
    -- Status and moderation
    status review_status_enum DEFAULT 'pending',
    is_verified_purchase BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    
    -- Media attachments
    images TEXT[],                           -- Array of image URLs
    
    -- Merchant response
    merchant_reply TEXT,
    merchant_reply_at TIMESTAMPTZ,
    merchant_reply_by VARCHAR(255),
    
    -- Helpful votes
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(255)
);

-- Indexes
CREATE INDEX idx_reviews_brand ON reviews(brand_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_status ON reviews(brand_id, status);
CREATE INDEX idx_reviews_rating ON reviews(product_id, rating);
CREATE INDEX idx_reviews_featured ON reviews(brand_id, is_featured) WHERE is_featured = true;
CREATE INDEX idx_reviews_verified ON reviews(product_id, is_verified_purchase) WHERE is_verified_purchase = true;

-- Update trigger
CREATE TRIGGER trigger_reviews_updated
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. REVIEW HELPFUL VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    voter_ip VARCHAR(45),                    -- For anonymous voting
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_votes_review ON review_votes(review_id);
CREATE UNIQUE INDEX idx_review_votes_unique ON review_votes(review_id, COALESCE(customer_id, voter_ip::uuid));

-- ============================================
-- 4. REVIEW INVITATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,       -- Unique token for review link
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_review_invitations_brand ON review_invitations(brand_id);
CREATE INDEX idx_review_invitations_order ON review_invitations(order_id);
CREATE INDEX idx_review_invitations_token ON review_invitations(token);

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_invitations ENABLE ROW LEVEL SECURITY;

-- Reviews policies
CREATE POLICY "Service role can do everything on reviews"
    ON reviews FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Public can view approved reviews"
    ON reviews FOR SELECT
    USING (status = 'approved');

-- Review votes policies
CREATE POLICY "Service role can do everything on review_votes"
    ON review_votes FOR ALL
    USING (auth.role() = 'service_role');

-- Review invitations policies
CREATE POLICY "Service role can do everything on review_invitations"
    ON review_invitations FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get product review statistics
CREATE OR REPLACE FUNCTION get_product_review_stats(p_product_id UUID)
RETURNS TABLE (
    total_reviews BIGINT,
    average_rating NUMERIC(3,2),
    rating_1 BIGINT,
    rating_2 BIGINT,
    rating_3 BIGINT,
    rating_4 BIGINT,
    rating_5 BIGINT,
    verified_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_reviews,
        COALESCE(AVG(rating)::NUMERIC(3,2), 0) as average_rating,
        COUNT(*) FILTER (WHERE rating = 1)::BIGINT as rating_1,
        COUNT(*) FILTER (WHERE rating = 2)::BIGINT as rating_2,
        COUNT(*) FILTER (WHERE rating = 3)::BIGINT as rating_3,
        COUNT(*) FILTER (WHERE rating = 4)::BIGINT as rating_4,
        COUNT(*) FILTER (WHERE rating = 5)::BIGINT as rating_5,
        COUNT(*) FILTER (WHERE is_verified_purchase = true)::BIGINT as verified_count
    FROM reviews
    WHERE product_id = p_product_id AND status = 'approved';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if customer has purchased product (for verified badge)
CREATE OR REPLACE FUNCTION check_verified_purchase(
    p_brand_id UUID,
    p_product_id UUID,
    p_customer_email VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM orders o
    WHERE o.brand_id = p_brand_id
      AND o.customer_email = p_customer_email
      AND o.status IN ('processing', 'shipped', 'delivered')
      AND EXISTS (
          SELECT 1 FROM jsonb_array_elements(o.items) item
          WHERE (item->>'product_id')::uuid = p_product_id
      );
    
    RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update review vote counts
CREATE OR REPLACE FUNCTION update_review_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_helpful THEN
            UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
        ELSE
            UPDATE reviews SET not_helpful_count = not_helpful_count + 1 WHERE id = NEW.review_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_helpful THEN
            UPDATE reviews SET helpful_count = helpful_count - 1 WHERE id = OLD.review_id;
        ELSE
            UPDATE reviews SET not_helpful_count = not_helpful_count - 1 WHERE id = OLD.review_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_review_vote_counts
    AFTER INSERT OR DELETE ON review_votes
    FOR EACH ROW EXECUTE FUNCTION update_review_vote_counts();

-- ============================================
-- 7. PRODUCT REVIEW SUMMARY (cached)
-- ============================================
-- Add review summary columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_average NUMERIC(3,2) DEFAULT 0;

-- Function to update product review summary
CREATE OR REPLACE FUNCTION update_product_review_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update for new review
    IF TG_OP = 'INSERT' AND NEW.status = 'approved' THEN
        UPDATE products
        SET review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved'),
            review_average = (SELECT COALESCE(AVG(rating)::NUMERIC(3,2), 0) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved')
        WHERE id = NEW.product_id;
    -- Update for status change
    ELSIF TG_OP = 'UPDATE' AND (OLD.status != NEW.status OR OLD.rating != NEW.rating) THEN
        UPDATE products
        SET review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved'),
            review_average = (SELECT COALESCE(AVG(rating)::NUMERIC(3,2), 0) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved')
        WHERE id = NEW.product_id;
    -- Update for delete
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
        UPDATE products
        SET review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = OLD.product_id AND status = 'approved'),
            review_average = (SELECT COALESCE(AVG(rating)::NUMERIC(3,2), 0) FROM reviews WHERE product_id = OLD.product_id AND status = 'approved')
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_review_summary
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_review_summary();
