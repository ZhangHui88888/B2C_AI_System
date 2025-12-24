DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status_enum' AND e.enumlabel = 'failed'
  ) THEN
    ALTER TYPE order_status_enum ADD VALUE 'failed';
  END IF;
END$$;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER;

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(brand_id, sku);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  stripe_created_at TIMESTAMPTZ,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stripe_events' AND policyname = 'Service role can do everything on stripe_events'
  ) THEN
    CREATE POLICY "Service role can do everything on stripe_events"
      ON stripe_events FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_brand_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN true;
  END IF;

  UPDATE products
  SET stock_quantity = CASE
        WHEN stock_quantity IS NULL THEN NULL
        ELSE stock_quantity - p_quantity
      END,
      stock_status = CASE
        WHEN stock_quantity IS NULL THEN stock_status
        WHEN stock_quantity - p_quantity <= 0 THEN 'out_of_stock'::stock_status_enum
        WHEN stock_quantity - p_quantity <= 5 THEN 'low_stock'::stock_status_enum
        ELSE stock_status
      END
  WHERE brand_id = p_brand_id
    AND id = p_product_id
    AND (stock_quantity IS NULL OR stock_quantity >= p_quantity);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_order_items_stock(
  p_brand_id UUID,
  p_items JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_stock INTEGER;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN true;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT stock_quantity INTO v_stock
    FROM products
    WHERE brand_id = p_brand_id AND id = v_product_id
    FOR UPDATE;

    IF v_stock IS NOT NULL AND v_stock < v_quantity THEN
      RETURN false;
    END IF;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 0);

    IF v_product_id IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    IF NOT decrement_product_stock(p_brand_id, v_product_id, v_quantity) THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
