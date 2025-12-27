-- =====================================================
-- 017: User Retention System
-- Points System, Membership Levels, Referral Program
-- =====================================================

-- =====================================================
-- 1. Membership Levels (会员等级)
-- =====================================================

CREATE TABLE IF NOT EXISTS member_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Level Info
  level_name VARCHAR(100) NOT NULL,
  level_code VARCHAR(50) NOT NULL,
  level_order INT NOT NULL DEFAULT 0,
  
  -- Requirements
  min_points INT DEFAULT 0,
  min_orders INT DEFAULT 0,
  min_spent DECIMAL(12,2) DEFAULT 0,
  
  -- Benefits
  points_multiplier DECIMAL(3,2) DEFAULT 1.0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  free_shipping_threshold DECIMAL(12,2),
  exclusive_products BOOLEAN DEFAULT FALSE,
  early_access_days INT DEFAULT 0,
  birthday_bonus_points INT DEFAULT 0,
  
  -- Display
  badge_color VARCHAR(20),
  badge_icon VARCHAR(100),
  description TEXT,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, level_code)
);

CREATE INDEX idx_member_levels_brand ON member_levels(brand_id);
CREATE INDEX idx_member_levels_order ON member_levels(brand_id, level_order);

-- =====================================================
-- 2. Customer Membership (客户会员信息)
-- =====================================================

CREATE TABLE IF NOT EXISTS customer_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Current Status
  current_level_id UUID REFERENCES member_levels(id),
  points_balance INT DEFAULT 0,
  lifetime_points INT DEFAULT 0,
  
  -- Stats
  total_orders INT DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  
  -- Referral
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID REFERENCES customers(id),
  referral_count INT DEFAULT 0,
  
  -- Dates
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  level_updated_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  birthday DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id, customer_id)
);

CREATE INDEX idx_customer_memberships_brand ON customer_memberships(brand_id);
CREATE INDEX idx_customer_memberships_customer ON customer_memberships(customer_id);
CREATE INDEX idx_customer_memberships_level ON customer_memberships(current_level_id);
CREATE INDEX idx_customer_memberships_referral ON customer_memberships(referral_code);

-- =====================================================
-- 3. Points Ledger (积分流水)
-- =====================================================

CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES customer_memberships(id) ON DELETE CASCADE,
  
  -- Transaction
  transaction_type VARCHAR(50) NOT NULL,
  -- Types: earn_purchase, earn_referral, earn_review, earn_birthday, earn_signup, earn_bonus, 
  --        redeem_discount, redeem_product, expire, adjust
  
  points_amount INT NOT NULL,
  points_balance_after INT NOT NULL,
  
  -- Reference
  reference_type VARCHAR(50),
  reference_id UUID,
  
  -- Details
  description TEXT,
  multiplier_applied DECIMAL(3,2) DEFAULT 1.0,
  
  -- Expiration (for earned points)
  expires_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_points_ledger_brand ON points_ledger(brand_id);
CREATE INDEX idx_points_ledger_customer ON points_ledger(customer_id);
CREATE INDEX idx_points_ledger_membership ON points_ledger(membership_id);
CREATE INDEX idx_points_ledger_type ON points_ledger(transaction_type);
CREATE INDEX idx_points_ledger_created ON points_ledger(created_at DESC);
CREATE INDEX idx_points_ledger_expires ON points_ledger(expires_at) WHERE expires_at IS NOT NULL AND expired_at IS NULL;

-- =====================================================
-- 4. Points Rules (积分规则)
-- =====================================================

CREATE TABLE IF NOT EXISTS points_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  rule_name VARCHAR(100) NOT NULL,
  rule_type VARCHAR(50) NOT NULL,
  -- Types: purchase, signup, referral, review, birthday, custom
  
  -- Earning Rules
  points_per_dollar DECIMAL(5,2),
  fixed_points INT,
  
  -- Conditions
  min_order_amount DECIMAL(12,2),
  max_points_per_order INT,
  product_category_id UUID,
  
  -- Validity
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  points_validity_days INT DEFAULT 365,
  
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_rules_brand ON points_rules(brand_id);
CREATE INDEX idx_points_rules_type ON points_rules(rule_type);
CREATE INDEX idx_points_rules_active ON points_rules(brand_id, is_active);

-- =====================================================
-- 5. Points Redemption Options (积分兑换选项)
-- =====================================================

CREATE TABLE IF NOT EXISTS points_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  redemption_name VARCHAR(100) NOT NULL,
  redemption_type VARCHAR(50) NOT NULL,
  -- Types: discount_fixed, discount_percent, free_shipping, free_product
  
  points_required INT NOT NULL,
  
  -- Value
  discount_amount DECIMAL(12,2),
  discount_percent DECIMAL(5,2),
  product_id UUID,
  
  -- Limits
  min_order_amount DECIMAL(12,2),
  max_uses_per_customer INT,
  total_uses_limit INT,
  current_uses INT DEFAULT 0,
  
  -- Display
  description TEXT,
  image_url VARCHAR(500),
  
  is_active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_redemptions_brand ON points_redemptions(brand_id);
CREATE INDEX idx_points_redemptions_active ON points_redemptions(brand_id, is_active);

-- =====================================================
-- 6. Referral Program (推荐有礼)
-- =====================================================

CREATE TABLE IF NOT EXISTS referral_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Referrer Rewards
  referrer_points INT DEFAULT 0,
  referrer_discount_amount DECIMAL(12,2),
  referrer_discount_percent DECIMAL(5,2),
  
  -- Referee Rewards
  referee_points INT DEFAULT 0,
  referee_discount_amount DECIMAL(12,2),
  referee_discount_percent DECIMAL(5,2),
  
  -- Conditions
  min_order_amount DECIMAL(12,2) DEFAULT 0,
  require_first_purchase BOOLEAN DEFAULT TRUE,
  max_referrals_per_customer INT,
  
  -- Messages
  share_message TEXT,
  email_subject VARCHAR(255),
  email_template TEXT,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(brand_id)
);

-- =====================================================
-- 7. Referral Tracking (推荐追踪)
-- =====================================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Participants
  referrer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  referee_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending',
  -- pending, completed, expired, cancelled
  
  -- Order Info
  qualifying_order_id UUID REFERENCES orders(id),
  order_amount DECIMAL(12,2),
  
  -- Rewards
  referrer_reward_type VARCHAR(50),
  referrer_reward_amount DECIMAL(12,2),
  referrer_reward_given BOOLEAN DEFAULT FALSE,
  referrer_reward_given_at TIMESTAMPTZ,
  
  referee_reward_type VARCHAR(50),
  referee_reward_amount DECIMAL(12,2),
  referee_reward_given BOOLEAN DEFAULT FALSE,
  referee_reward_given_at TIMESTAMPTZ,
  
  -- Timestamps
  referred_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_brand ON referrals(brand_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_referee ON referrals(referee_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);

-- =====================================================
-- 8. Level Up History (升级历史)
-- =====================================================

CREATE TABLE IF NOT EXISTS level_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES customer_memberships(id) ON DELETE CASCADE,
  
  previous_level_id UUID REFERENCES member_levels(id),
  new_level_id UUID REFERENCES member_levels(id),
  
  change_type VARCHAR(20) NOT NULL,
  -- upgrade, downgrade, initial
  
  reason TEXT,
  points_at_change INT,
  orders_at_change INT,
  spent_at_change DECIMAL(12,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_level_history_customer ON level_history(customer_id);
CREATE INDEX idx_level_history_membership ON level_history(membership_id);

-- =====================================================
-- Row Level Security Policies
-- =====================================================

ALTER TABLE member_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_history ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
CREATE POLICY "Service role full access on member_levels"
  ON member_levels FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on customer_memberships"
  ON customer_memberships FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on points_ledger"
  ON points_ledger FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on points_rules"
  ON points_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on points_redemptions"
  ON points_redemptions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on referral_config"
  ON referral_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on referrals"
  ON referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on level_history"
  ON level_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code(length INT DEFAULT 8)
RETURNS VARCHAR AS $$
DECLARE
  chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate customer level
CREATE OR REPLACE FUNCTION calculate_customer_level(
  p_brand_id UUID,
  p_points INT,
  p_orders INT,
  p_spent DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_level_id UUID;
BEGIN
  SELECT id INTO v_level_id
  FROM member_levels
  WHERE brand_id = p_brand_id
    AND is_active = TRUE
    AND (min_points IS NULL OR min_points <= p_points)
    AND (min_orders IS NULL OR min_orders <= p_orders)
    AND (min_spent IS NULL OR min_spent <= p_spent)
  ORDER BY level_order DESC
  LIMIT 1;
  
  RETURN v_level_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate points for order
CREATE OR REPLACE FUNCTION calculate_order_points(
  p_brand_id UUID,
  p_order_amount DECIMAL,
  p_level_multiplier DECIMAL DEFAULT 1.0
)
RETURNS INT AS $$
DECLARE
  v_points INT := 0;
  v_rule RECORD;
BEGIN
  -- Get active purchase rule
  SELECT * INTO v_rule
  FROM points_rules
  WHERE brand_id = p_brand_id
    AND rule_type = 'purchase'
    AND is_active = TRUE
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  ORDER BY priority DESC
  LIMIT 1;
  
  IF v_rule IS NOT NULL THEN
    -- Check min order amount
    IF v_rule.min_order_amount IS NULL OR p_order_amount >= v_rule.min_order_amount THEN
      IF v_rule.points_per_dollar IS NOT NULL THEN
        v_points := FLOOR(p_order_amount * v_rule.points_per_dollar * p_level_multiplier);
      ELSIF v_rule.fixed_points IS NOT NULL THEN
        v_points := FLOOR(v_rule.fixed_points * p_level_multiplier);
      END IF;
      
      -- Apply max points cap
      IF v_rule.max_points_per_order IS NOT NULL AND v_points > v_rule.max_points_per_order THEN
        v_points := v_rule.max_points_per_order;
      END IF;
    END IF;
  END IF;
  
  RETURN v_points;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update membership on points change
CREATE OR REPLACE FUNCTION update_membership_on_points_change()
RETURNS TRIGGER AS $$
DECLARE
  v_new_level_id UUID;
  v_current_level_id UUID;
  v_membership RECORD;
BEGIN
  -- Get current membership
  SELECT * INTO v_membership
  FROM customer_memberships
  WHERE id = NEW.membership_id;
  
  IF v_membership IS NOT NULL THEN
    -- Calculate new level
    v_new_level_id := calculate_customer_level(
      v_membership.brand_id,
      NEW.points_balance_after,
      v_membership.total_orders,
      v_membership.total_spent
    );
    
    -- Update membership balance
    UPDATE customer_memberships
    SET 
      points_balance = NEW.points_balance_after,
      lifetime_points = lifetime_points + CASE WHEN NEW.points_amount > 0 THEN NEW.points_amount ELSE 0 END,
      last_activity_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.membership_id;
    
    -- Check for level change
    IF v_new_level_id IS DISTINCT FROM v_membership.current_level_id THEN
      UPDATE customer_memberships
      SET current_level_id = v_new_level_id, level_updated_at = NOW()
      WHERE id = NEW.membership_id;
      
      -- Record level change
      INSERT INTO level_history (
        brand_id, customer_id, membership_id,
        previous_level_id, new_level_id,
        change_type, reason,
        points_at_change, orders_at_change, spent_at_change
      ) VALUES (
        v_membership.brand_id, v_membership.customer_id, NEW.membership_id,
        v_membership.current_level_id, v_new_level_id,
        CASE 
          WHEN v_membership.current_level_id IS NULL THEN 'initial'
          WHEN v_new_level_id > v_membership.current_level_id THEN 'upgrade'
          ELSE 'downgrade'
        END,
        'Points change triggered level recalculation',
        NEW.points_balance_after, v_membership.total_orders, v_membership.total_spent
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_membership_on_points
AFTER INSERT ON points_ledger
FOR EACH ROW
EXECUTE FUNCTION update_membership_on_points_change();

-- =====================================================
-- Default Data: Sample Member Levels
-- =====================================================

-- Note: Insert default levels after brands are created
-- Example:
-- INSERT INTO member_levels (brand_id, level_name, level_code, level_order, min_points, points_multiplier, discount_percentage, badge_color) VALUES
--   (brand_id, 'Bronze', 'bronze', 1, 0, 1.0, 0, '#CD7F32'),
--   (brand_id, 'Silver', 'silver', 2, 500, 1.25, 5, '#C0C0C0'),
--   (brand_id, 'Gold', 'gold', 3, 2000, 1.5, 10, '#FFD700'),
--   (brand_id, 'Platinum', 'platinum', 4, 5000, 2.0, 15, '#E5E4E2');
