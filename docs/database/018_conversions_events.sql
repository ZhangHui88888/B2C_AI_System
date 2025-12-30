CREATE TABLE IF NOT EXISTS conversion_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

    event_name TEXT NOT NULL,
    event_id TEXT,
    event_data JSONB DEFAULT '{}',

    platforms_sent TEXT[] DEFAULT '{}',
    results JSONB DEFAULT '{}',

    ip_address VARCHAR(45),
    user_agent TEXT,

    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversion_events_brand ON conversion_events(brand_id);
CREATE INDEX IF NOT EXISTS idx_conversion_events_created ON conversion_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_events_name ON conversion_events(brand_id, event_name);
CREATE INDEX IF NOT EXISTS idx_conversion_events_event_id ON conversion_events(brand_id, event_id);

ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on conversion_events"
    ON conversion_events FOR ALL
    USING (auth.role() = 'service_role');

ALTER TABLE tracking_pixels_config
    ADD COLUMN IF NOT EXISTS pinterest_ad_account_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS google_customer_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS google_conversion_action_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS google_access_token TEXT;
