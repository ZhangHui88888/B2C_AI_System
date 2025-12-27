-- Marketing & Tracking Tables
-- UTM tracking, abandoned carts, pixel events for P1 marketing features

-- ============================================
-- 1. UTM_TRACKING TABLE
-- Stores UTM parameters and attribution data
-- ============================================
CREATE TABLE IF NOT EXISTS utm_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- UTM Parameters
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    
    -- Additional attribution data
    referrer TEXT,
    landing_page TEXT,
    user_agent TEXT,
    ip_country VARCHAR(10),
    device_type VARCHAR(50),
    
    -- Timestamps
    first_touch_at TIMESTAMPTZ DEFAULT NOW(),
    last_touch_at TIMESTAMPTZ DEFAULT NOW(),
    converted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_utm_brand ON utm_tracking(brand_id);
CREATE INDEX idx_utm_session ON utm_tracking(session_id);
CREATE INDEX idx_utm_customer ON utm_tracking(customer_id);
CREATE INDEX idx_utm_order ON utm_tracking(order_id);
CREATE INDEX idx_utm_source ON utm_tracking(brand_id, utm_source);
CREATE INDEX idx_utm_campaign ON utm_tracking(brand_id, utm_campaign);
CREATE INDEX idx_utm_created ON utm_tracking(created_at DESC);

-- ============================================
-- 2. ABANDONED_CARTS TABLE
-- Tracks abandoned shopping carts for recovery
-- ============================================
CREATE TYPE abandoned_cart_status_enum AS ENUM (
    'active',           -- Cart is still active
    'abandoned',        -- Cart abandoned (no activity for X hours)
    'recovered',        -- User completed purchase
    'email_sent',       -- Recovery email was sent
    'unsubscribed'      -- User opted out of recovery emails
);

CREATE TABLE IF NOT EXISTS abandoned_carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    
    -- Cart contents
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    
    -- Recovery tracking
    status abandoned_cart_status_enum DEFAULT 'active',
    recovery_email_count INTEGER DEFAULT 0,
    last_email_sent_at TIMESTAMPTZ,
    recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- UTM attribution
    utm_tracking_id UUID REFERENCES utm_tracking(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    abandoned_at TIMESTAMPTZ,
    recovered_at TIMESTAMPTZ
);

CREATE INDEX idx_abandoned_brand ON abandoned_carts(brand_id);
CREATE INDEX idx_abandoned_session ON abandoned_carts(session_id);
CREATE INDEX idx_abandoned_email ON abandoned_carts(customer_email);
CREATE INDEX idx_abandoned_status ON abandoned_carts(brand_id, status);
CREATE INDEX idx_abandoned_created ON abandoned_carts(created_at DESC);
CREATE INDEX idx_abandoned_abandoned_at ON abandoned_carts(abandoned_at);

-- ============================================
-- 3. PIXEL_EVENTS TABLE
-- Stores pixel events for server-side tracking
-- ============================================
CREATE TYPE pixel_platform_enum AS ENUM (
    'facebook',
    'google',
    'tiktok',
    'pinterest'
);

CREATE TYPE pixel_event_enum AS ENUM (
    'PageView',
    'ViewContent',
    'AddToCart',
    'InitiateCheckout',
    'AddPaymentInfo',
    'Purchase',
    'Lead',
    'CompleteRegistration',
    'Search',
    'CustomEvent'
);

CREATE TABLE IF NOT EXISTS pixel_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    platform pixel_platform_enum NOT NULL,
    event_name pixel_event_enum NOT NULL,
    custom_event_name VARCHAR(100),
    
    -- Event identifiers
    event_id VARCHAR(100),
    session_id VARCHAR(100),
    external_id VARCHAR(255),
    
    -- User data (hashed for privacy)
    user_email_hash VARCHAR(64),
    user_phone_hash VARCHAR(64),
    user_ip VARCHAR(45),
    user_agent TEXT,
    
    -- Event data
    event_data JSONB DEFAULT '{}',
    
    -- E-commerce specific
    currency VARCHAR(10),
    value DECIMAL(10,2),
    content_ids TEXT[],
    content_type VARCHAR(50),
    num_items INTEGER,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Server-side API response
    sent_to_api BOOLEAN DEFAULT false,
    api_response JSONB,
    api_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pixel_brand ON pixel_events(brand_id);
CREATE INDEX idx_pixel_platform ON pixel_events(brand_id, platform);
CREATE INDEX idx_pixel_event ON pixel_events(brand_id, event_name);
CREATE INDEX idx_pixel_session ON pixel_events(session_id);
CREATE INDEX idx_pixel_order ON pixel_events(order_id);
CREATE INDEX idx_pixel_created ON pixel_events(created_at DESC);
CREATE INDEX idx_pixel_pending ON pixel_events(sent_to_api) WHERE sent_to_api = false;

-- ============================================
-- 4. EMAIL_SUBSCRIPTIONS TABLE
-- Manages email subscription preferences
-- ============================================
CREATE TABLE IF NOT EXISTS email_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Subscription preferences
    marketing_emails BOOLEAN DEFAULT true,
    abandoned_cart_emails BOOLEAN DEFAULT true,
    order_updates BOOLEAN DEFAULT true,
    
    -- Unsubscribe tracking
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,
    unsubscribe_token VARCHAR(64) UNIQUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_sub_brand ON email_subscriptions(brand_id);
CREATE INDEX idx_email_sub_email ON email_subscriptions(brand_id, email);
CREATE INDEX idx_email_sub_customer ON email_subscriptions(customer_id);
CREATE INDEX idx_email_sub_token ON email_subscriptions(unsubscribe_token);

ALTER TABLE email_subscriptions 
    ADD CONSTRAINT unique_email_subscription_per_brand UNIQUE (brand_id, email);

-- ============================================
-- 5. TRACKING_PIXELS_CONFIG TABLE
-- Stores pixel configuration per brand
-- ============================================
CREATE TABLE IF NOT EXISTS tracking_pixels_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    
    -- Facebook/Meta
    facebook_pixel_id VARCHAR(50),
    facebook_access_token TEXT,
    facebook_test_event_code VARCHAR(50),
    
    -- Google Ads
    google_ads_id VARCHAR(50),
    google_conversion_label VARCHAR(50),
    google_remarketing_id VARCHAR(50),
    
    -- TikTok
    tiktok_pixel_id VARCHAR(50),
    tiktok_access_token TEXT,
    
    -- Pinterest
    pinterest_tag_id VARCHAR(50),
    pinterest_access_token TEXT,
    
    -- Server-side tracking settings
    server_side_enabled BOOLEAN DEFAULT false,
    hash_user_data BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pixels_config_brand ON tracking_pixels_config(brand_id);
ALTER TABLE tracking_pixels_config 
    ADD CONSTRAINT unique_pixels_config_per_brand UNIQUE (brand_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE utm_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_pixels_config ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Service role full access on utm_tracking"
    ON utm_tracking FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on abandoned_carts"
    ON abandoned_carts FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on pixel_events"
    ON pixel_events FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on email_subscriptions"
    ON email_subscriptions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on tracking_pixels_config"
    ON tracking_pixels_config FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER trigger_abandoned_carts_updated
    BEFORE UPDATE ON abandoned_carts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_email_subscriptions_updated
    BEFORE UPDATE ON email_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_tracking_pixels_updated
    BEFORE UPDATE ON tracking_pixels_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to mark carts as abandoned (call via cron)
CREATE OR REPLACE FUNCTION mark_abandoned_carts(
    p_abandon_after_hours INTEGER DEFAULT 1
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE abandoned_carts
    SET status = 'abandoned',
        abandoned_at = NOW()
    WHERE status = 'active'
      AND updated_at < NOW() - (p_abandon_after_hours || ' hours')::INTERVAL
      AND customer_email IS NOT NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending abandoned carts for recovery emails
CREATE OR REPLACE FUNCTION get_pending_recovery_carts(
    p_brand_id UUID,
    p_min_hours_since_abandon INTEGER DEFAULT 1,
    p_max_emails INTEGER DEFAULT 3,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    cart_id UUID,
    customer_email VARCHAR,
    customer_name VARCHAR,
    items JSONB,
    subtotal DECIMAL,
    abandoned_at TIMESTAMPTZ,
    email_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ac.id,
        ac.customer_email,
        ac.customer_name,
        ac.items,
        ac.subtotal,
        ac.abandoned_at,
        ac.recovery_email_count
    FROM abandoned_carts ac
    LEFT JOIN email_subscriptions es 
        ON es.brand_id = ac.brand_id AND es.email = ac.customer_email
    WHERE ac.brand_id = p_brand_id
      AND ac.status = 'abandoned'
      AND ac.customer_email IS NOT NULL
      AND ac.recovery_email_count < p_max_emails
      AND ac.abandoned_at < NOW() - (p_min_hours_since_abandon || ' hours')::INTERVAL
      AND (es.id IS NULL OR es.abandoned_cart_emails = true)
    ORDER BY ac.abandoned_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
