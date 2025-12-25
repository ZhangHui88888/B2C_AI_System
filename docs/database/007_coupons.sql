-- Coupons and Discounts System

-- Coupon type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_type_enum') THEN
    CREATE TYPE coupon_type_enum AS ENUM ('percentage', 'fixed_amount', 'free_shipping');
  END IF;
END$$;

-- Coupon status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_status_enum') THEN
    CREATE TYPE coupon_status_enum AS ENUM ('active', 'inactive', 'expired');
  END IF;
END$$;

-- Coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  
  -- Coupon code and basic info
  code VARCHAR(50) NOT NULL,
  description TEXT,
  
  -- Discount configuration
  type coupon_type_enum NOT NULL DEFAULT 'percentage',
  value DECIMAL(10,2) NOT NULL CHECK (value >= 0),
  
  -- Usage limits
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2), -- Cap for percentage discounts
  usage_limit INTEGER, -- Total usage limit (NULL = unlimited)
  usage_limit_per_customer INTEGER DEFAULT 1, -- Per customer limit
  usage_count INTEGER DEFAULT 0, -- Current usage count
  
  -- Validity period
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Restrictions
  applies_to_products UUID[] DEFAULT '{}', -- Empty = all products
  applies_to_categories UUID[] DEFAULT '{}', -- Empty = all categories
  excluded_products UUID[] DEFAULT '{}',
  first_order_only BOOLEAN DEFAULT false,
  
  -- Status
  status coupon_status_enum DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique code per brand
  UNIQUE(brand_id, code)
);

-- Coupon usage tracking
CREATE TABLE IF NOT EXISTS coupon_usages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_email VARCHAR(255) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_brand_code ON coupons(brand_id, code);
CREATE INDEX IF NOT EXISTS idx_coupons_brand_status ON coupons(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon ON coupon_usages(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_email ON coupon_usages(customer_email);

-- RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for coupons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'Service role can do everything on coupons'
  ) THEN
    CREATE POLICY "Service role can do everything on coupons"
      ON coupons FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupons' AND policyname = 'Public can read active coupons'
  ) THEN
    CREATE POLICY "Public can read active coupons"
      ON coupons FOR SELECT
      USING (status = 'active');
  END IF;
END$$;

-- RLS Policies for coupon_usages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coupon_usages' AND policyname = 'Service role can do everything on coupon_usages'
  ) THEN
    CREATE POLICY "Service role can do everything on coupon_usages"
      ON coupon_usages FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

-- Function to validate and apply coupon
CREATE OR REPLACE FUNCTION validate_coupon(
  p_brand_id UUID,
  p_code VARCHAR(50),
  p_customer_email VARCHAR(255),
  p_order_subtotal DECIMAL(10,2),
  p_product_ids UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  valid BOOLEAN,
  coupon_id UUID,
  discount_type coupon_type_enum,
  discount_value DECIMAL(10,2),
  discount_amount DECIMAL(10,2),
  error_message TEXT
) AS $$
DECLARE
  v_coupon RECORD;
  v_customer_usage_count INTEGER;
  v_discount DECIMAL(10,2);
BEGIN
  -- Find the coupon
  SELECT * INTO v_coupon
  FROM coupons c
  WHERE c.brand_id = p_brand_id
    AND UPPER(c.code) = UPPER(p_code)
    AND c.status = 'active';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::coupon_type_enum, NULL::DECIMAL, NULL::DECIMAL, 'Invalid coupon code'::TEXT;
    RETURN;
  END IF;

  -- Check expiration
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::coupon_type_enum, NULL::DECIMAL, NULL::DECIMAL, 'This coupon has expired'::TEXT;
    RETURN;
  END IF;

  -- Check start date
  IF v_coupon.starts_at > NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::coupon_type_enum, NULL::DECIMAL, NULL::DECIMAL, 'This coupon is not yet active'::TEXT;
    RETURN;
  END IF;

  -- Check total usage limit
  IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::coupon_type_enum, NULL::DECIMAL, NULL::DECIMAL, 'This coupon has reached its usage limit'::TEXT;
    RETURN;
  END IF;

  -- Check per-customer usage limit
  IF v_coupon.usage_limit_per_customer IS NOT NULL THEN
    SELECT COUNT(*) INTO v_customer_usage_count
    FROM coupon_usages
    WHERE coupon_id = v_coupon.id
      AND customer_email = p_customer_email;

    IF v_customer_usage_count >= v_coupon.usage_limit_per_customer THEN
      RETURN QUERY SELECT false, NULL::UUID, NULL::coupon_type_enum, NULL::DECIMAL, NULL::DECIMAL, 'You have already used this coupon'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Check minimum order amount
  IF v_coupon.min_order_amount > 0 AND p_order_subtotal < v_coupon.min_order_amount THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::coupon_type_enum, NULL::DECIMAL, NULL::DECIMAL, 
      ('Minimum order amount is $' || v_coupon.min_order_amount::TEXT)::TEXT;
    RETURN;
  END IF;

  -- Check first order only
  IF v_coupon.first_order_only THEN
    IF EXISTS (
      SELECT 1 FROM orders
      WHERE brand_id = p_brand_id
        AND customer_email = p_customer_email
        AND status NOT IN ('cancelled', 'failed')
    ) THEN
      RETURN QUERY SELECT false, NULL::UUID, NULL::coupon_type_enum, NULL::DECIMAL, NULL::DECIMAL, 'This coupon is for first orders only'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Calculate discount
  CASE v_coupon.type
    WHEN 'percentage' THEN
      v_discount := p_order_subtotal * (v_coupon.value / 100);
      IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
        v_discount := v_coupon.max_discount_amount;
      END IF;
    WHEN 'fixed_amount' THEN
      v_discount := LEAST(v_coupon.value, p_order_subtotal);
    WHEN 'free_shipping' THEN
      v_discount := 0; -- Shipping discount handled separately
  END CASE;

  RETURN QUERY SELECT true, v_coupon.id, v_coupon.type, v_coupon.value, v_discount, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record coupon usage
CREATE OR REPLACE FUNCTION record_coupon_usage(
  p_coupon_id UUID,
  p_order_id UUID,
  p_customer_email VARCHAR(255),
  p_discount_amount DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Insert usage record
  INSERT INTO coupon_usages (coupon_id, order_id, customer_email, discount_amount)
  VALUES (p_coupon_id, p_order_id, p_customer_email, p_discount_amount);

  -- Increment usage count
  UPDATE coupons
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = p_coupon_id;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add coupon fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
