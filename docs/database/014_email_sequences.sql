-- Email Sequences Tables
-- Welcome emails, repurchase reminders, and automated email campaigns

-- ============================================
-- 1. EMAIL_SEQUENCES TABLE
-- Defines email sequence templates
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Sequence type
    sequence_type VARCHAR(50) NOT NULL, -- 'welcome', 'repurchase', 'winback', 'post_purchase'
    
    -- Trigger conditions
    trigger_event VARCHAR(50) NOT NULL, -- 'subscription', 'first_purchase', 'any_purchase', 'no_purchase_days'
    trigger_delay_hours INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_seq_brand ON email_sequences(brand_id);
CREATE INDEX idx_email_seq_type ON email_sequences(brand_id, sequence_type);
CREATE INDEX idx_email_seq_active ON email_sequences(brand_id, is_active);

ALTER TABLE email_sequences 
    ADD CONSTRAINT unique_email_seq_slug_per_brand UNIQUE (brand_id, slug);

-- ============================================
-- 2. EMAIL_SEQUENCE_STEPS TABLE
-- Individual emails within a sequence
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    
    step_number INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Email content
    subject VARCHAR(255) NOT NULL,
    preview_text VARCHAR(255),
    html_content TEXT NOT NULL,
    plain_text_content TEXT,
    
    -- Timing
    delay_hours INTEGER NOT NULL DEFAULT 0, -- Hours after previous step (or trigger for step 1)
    
    -- Conditions
    send_conditions JSONB DEFAULT '{}', -- e.g., {"skip_if_purchased": true}
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_step_sequence ON email_sequence_steps(sequence_id);
CREATE INDEX idx_email_step_order ON email_sequence_steps(sequence_id, step_number);

ALTER TABLE email_sequence_steps 
    ADD CONSTRAINT unique_step_number_per_sequence UNIQUE (sequence_id, step_number);

-- ============================================
-- 3. EMAIL_SEQUENCE_ENROLLMENTS TABLE
-- Tracks users enrolled in sequences
-- ============================================
CREATE TYPE enrollment_status_enum AS ENUM (
    'active',       -- Currently receiving emails
    'completed',    -- Finished all steps
    'paused',       -- Temporarily paused
    'cancelled',    -- User cancelled/unsubscribed
    'converted'     -- Achieved goal (e.g., made purchase)
);

CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
    
    -- Subscriber info
    email VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Progress
    current_step INTEGER DEFAULT 0,
    status enrollment_status_enum DEFAULT 'active',
    
    -- Tracking
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    
    -- Timing
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    next_email_at TIMESTAMPTZ,
    last_email_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    trigger_data JSONB DEFAULT '{}', -- Data from trigger event (e.g., order info)
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrollment_brand ON email_sequence_enrollments(brand_id);
CREATE INDEX idx_enrollment_sequence ON email_sequence_enrollments(sequence_id);
CREATE INDEX idx_enrollment_email ON email_sequence_enrollments(email);
CREATE INDEX idx_enrollment_status ON email_sequence_enrollments(status);
CREATE INDEX idx_enrollment_next ON email_sequence_enrollments(next_email_at) WHERE status = 'active';
CREATE INDEX idx_enrollment_customer ON email_sequence_enrollments(customer_id);

-- Prevent duplicate enrollments in same sequence
ALTER TABLE email_sequence_enrollments 
    ADD CONSTRAINT unique_enrollment_per_sequence UNIQUE (sequence_id, email);

-- ============================================
-- 4. EMAIL_SEQUENCE_LOGS TABLE
-- Tracks individual email sends
-- ============================================
CREATE TABLE IF NOT EXISTS email_sequence_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES email_sequence_enrollments(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES email_sequence_steps(id) ON DELETE CASCADE,
    
    -- Send status
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    -- Email service response
    message_id VARCHAR(255),
    send_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_log_enrollment ON email_sequence_logs(enrollment_id);
CREATE INDEX idx_email_log_step ON email_sequence_logs(step_id);
CREATE INDEX idx_email_log_sent ON email_sequence_logs(sent_at DESC);

-- ============================================
-- 5. REPURCHASE_REMINDERS TABLE
-- Tracks product repurchase cycles
-- ============================================
CREATE TABLE IF NOT EXISTS repurchase_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    
    -- Product info
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Reminder settings
    name VARCHAR(100) NOT NULL,
    reminder_days INTEGER NOT NULL, -- Days after purchase to send reminder
    
    -- Email content
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    
    -- Discount incentive
    discount_code VARCHAR(50),
    discount_percent DECIMAL(5,2),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_repurchase_brand ON repurchase_reminders(brand_id);
CREATE INDEX idx_repurchase_product ON repurchase_reminders(product_id);
CREATE INDEX idx_repurchase_category ON repurchase_reminders(category_id);
CREATE INDEX idx_repurchase_active ON repurchase_reminders(brand_id, is_active);

-- ============================================
-- 6. REPURCHASE_REMINDER_QUEUE TABLE
-- Scheduled repurchase reminders
-- ============================================
CREATE TYPE reminder_status_enum AS ENUM (
    'pending',
    'sent',
    'skipped',
    'failed'
);

CREATE TABLE IF NOT EXISTS repurchase_reminder_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    reminder_id UUID NOT NULL REFERENCES repurchase_reminders(id) ON DELETE CASCADE,
    
    -- Customer info
    customer_email VARCHAR(255) NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    status reminder_status_enum DEFAULT 'pending',
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    send_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminder_queue_brand ON repurchase_reminder_queue(brand_id);
CREATE INDEX idx_reminder_queue_scheduled ON repurchase_reminder_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_reminder_queue_status ON repurchase_reminder_queue(status);
CREATE INDEX idx_reminder_queue_customer ON repurchase_reminder_queue(customer_email);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repurchase_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE repurchase_reminder_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_sequences"
    ON email_sequences FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on email_sequence_steps"
    ON email_sequence_steps FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on email_sequence_enrollments"
    ON email_sequence_enrollments FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on email_sequence_logs"
    ON email_sequence_logs FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on repurchase_reminders"
    ON repurchase_reminders FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on repurchase_reminder_queue"
    ON repurchase_reminder_queue FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER trigger_email_sequences_updated
    BEFORE UPDATE ON email_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_email_sequence_steps_updated
    BEFORE UPDATE ON email_sequence_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_email_sequence_enrollments_updated
    BEFORE UPDATE ON email_sequence_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_repurchase_reminders_updated
    BEFORE UPDATE ON repurchase_reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get pending emails to send (call via cron)
CREATE OR REPLACE FUNCTION get_pending_sequence_emails(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    enrollment_id UUID,
    brand_id UUID,
    sequence_id UUID,
    step_id UUID,
    email VARCHAR,
    customer_id UUID,
    subject VARCHAR,
    html_content TEXT,
    step_number INTEGER,
    send_conditions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS enrollment_id,
        e.brand_id,
        e.sequence_id,
        s.id AS step_id,
        e.email,
        e.customer_id,
        s.subject,
        s.html_content,
        s.step_number,
        s.send_conditions
    FROM email_sequence_enrollments e
    JOIN email_sequences seq ON seq.id = e.sequence_id
    JOIN email_sequence_steps s ON s.sequence_id = e.sequence_id 
        AND s.step_number = e.current_step + 1
    LEFT JOIN email_subscriptions sub ON sub.brand_id = e.brand_id AND sub.email = e.email
    WHERE e.status = 'active'
      AND e.next_email_at <= NOW()
      AND seq.is_active = true
      AND s.is_active = true
      AND (sub.id IS NULL OR sub.marketing_emails = true)
    ORDER BY e.next_email_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending repurchase reminders (call via cron)
CREATE OR REPLACE FUNCTION get_pending_repurchase_reminders(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    queue_id UUID,
    brand_id UUID,
    reminder_id UUID,
    customer_email VARCHAR,
    customer_id UUID,
    order_id UUID,
    subject VARCHAR,
    html_content TEXT,
    discount_code VARCHAR,
    discount_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.id AS queue_id,
        q.brand_id,
        q.reminder_id,
        q.customer_email,
        q.customer_id,
        q.order_id,
        r.subject,
        r.html_content,
        r.discount_code,
        r.discount_percent
    FROM repurchase_reminder_queue q
    JOIN repurchase_reminders r ON r.id = q.reminder_id
    LEFT JOIN email_subscriptions sub ON sub.brand_id = q.brand_id AND sub.email = q.customer_email
    WHERE q.status = 'pending'
      AND q.scheduled_at <= NOW()
      AND r.is_active = true
      AND (sub.id IS NULL OR sub.marketing_emails = true)
    ORDER BY q.scheduled_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enroll customer in welcome sequence after subscription
CREATE OR REPLACE FUNCTION enroll_in_welcome_sequence(
    p_brand_id UUID,
    p_email VARCHAR,
    p_customer_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_sequence_id UUID;
    v_enrollment_id UUID;
    v_delay_hours INTEGER;
BEGIN
    -- Find active welcome sequence
    SELECT id, trigger_delay_hours INTO v_sequence_id, v_delay_hours
    FROM email_sequences
    WHERE brand_id = p_brand_id
      AND sequence_type = 'welcome'
      AND is_active = true
    LIMIT 1;
    
    IF v_sequence_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Create enrollment
    INSERT INTO email_sequence_enrollments (
        brand_id, sequence_id, email, customer_id, 
        current_step, status, next_email_at
    ) VALUES (
        p_brand_id, v_sequence_id, p_email, p_customer_id,
        0, 'active', NOW() + (v_delay_hours || ' hours')::INTERVAL
    )
    ON CONFLICT (sequence_id, email) DO NOTHING
    RETURNING id INTO v_enrollment_id;
    
    RETURN v_enrollment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule repurchase reminders after order
CREATE OR REPLACE FUNCTION schedule_repurchase_reminders(
    p_brand_id UUID,
    p_order_id UUID,
    p_customer_email VARCHAR,
    p_customer_id UUID DEFAULT NULL,
    p_product_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_reminder RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Find applicable reminders
    FOR v_reminder IN
        SELECT r.id, r.reminder_days
        FROM repurchase_reminders r
        WHERE r.brand_id = p_brand_id
          AND r.is_active = true
          AND (
            r.product_id = ANY(p_product_ids)
            OR r.product_id IS NULL
          )
    LOOP
        -- Schedule reminder
        INSERT INTO repurchase_reminder_queue (
            brand_id, reminder_id, customer_email, customer_id, order_id, scheduled_at
        ) VALUES (
            p_brand_id, v_reminder.id, p_customer_email, p_customer_id, p_order_id,
            NOW() + (v_reminder.reminder_days || ' days')::INTERVAL
        )
        ON CONFLICT DO NOTHING;
        
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
