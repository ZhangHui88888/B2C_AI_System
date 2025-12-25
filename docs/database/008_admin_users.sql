-- Admin Users and RBAC System

-- Admin role enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_role_enum') THEN
    CREATE TYPE admin_role_enum AS ENUM ('super_admin', 'brand_admin', 'editor', 'read_only');
  END IF;
END$$;

-- Admin users table (links to Supabase auth.users)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL UNIQUE, -- References auth.users(id)
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar_url TEXT,
  role admin_role_enum NOT NULL DEFAULT 'read_only',
  
  -- Brand access (NULL means all brands for super_admin)
  brand_ids UUID[] DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_auth_user ON admin_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_users' AND policyname = 'Service role can do everything on admin_users'
  ) THEN
    CREATE POLICY "Service role can do everything on admin_users"
      ON admin_users FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_users' AND policyname = 'Admin users can read their own record'
  ) THEN
    CREATE POLICY "Admin users can read their own record"
      ON admin_users FOR SELECT
      USING (auth.uid() = auth_user_id);
  END IF;
END$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(p_auth_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE auth_user_id = p_auth_user_id
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get admin role
CREATE OR REPLACE FUNCTION get_admin_role(p_auth_user_id UUID)
RETURNS admin_role_enum AS $$
DECLARE
  v_role admin_role_enum;
BEGIN
  SELECT role INTO v_role
  FROM admin_users
  WHERE auth_user_id = p_auth_user_id
    AND is_active = true;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check brand access
CREATE OR REPLACE FUNCTION has_brand_access(p_auth_user_id UUID, p_brand_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_admin admin_users%ROWTYPE;
BEGIN
  SELECT * INTO v_admin
  FROM admin_users
  WHERE auth_user_id = p_auth_user_id
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Super admin has access to all brands
  IF v_admin.role = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Check if brand is in user's allowed brands
  RETURN p_brand_id = ANY(v_admin.brand_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin activity log
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created ON admin_activity_log(created_at DESC);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_activity_log' AND policyname = 'Service role can do everything on admin_activity_log'
  ) THEN
    CREATE POLICY "Service role can do everything on admin_activity_log"
      ON admin_activity_log FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END$$;

-- Trigger to update last_login_at
CREATE OR REPLACE FUNCTION update_admin_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE admin_users
  SET last_login_at = NOW()
  WHERE auth_user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger would need to be on auth.users which requires special setup
-- For now, we'll update last_login_at manually in the application

-- Insert default super admin (replace with actual email after first auth signup)
-- INSERT INTO admin_users (auth_user_id, email, name, role)
-- VALUES ('YOUR_AUTH_USER_ID', 'admin@example.com', 'Super Admin', 'super_admin')
-- ON CONFLICT (email) DO NOTHING;
