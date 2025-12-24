-- DTC E-commerce Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 0. BRANDS TABLE (Multi-tenant support)
-- ============================================
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255),                    -- 自定义域名
    logo_url TEXT,
    settings JSONB DEFAULT '{}',            -- 品牌专属设置
    owner_email VARCHAR(255) NOT NULL,      -- 品牌所有者邮箱
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_domain ON brands(domain);
CREATE INDEX idx_brands_active ON brands(is_active);

-- ============================================
-- 1. CATEGORIES TABLE
-- ============================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_brand ON categories(brand_id);
CREATE INDEX idx_categories_slug ON categories(brand_id, slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active);

-- Unique slug per brand
ALTER TABLE categories ADD CONSTRAINT unique_category_slug_per_brand UNIQUE (brand_id, slug);

-- ============================================
-- 2. PRODUCTS TABLE
-- ============================================
CREATE TYPE stock_status_enum AS ENUM ('in_stock', 'low_stock', 'out_of_stock');

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    compare_price DECIMAL(10,2) CHECK (compare_price IS NULL OR compare_price >= 0),
    cost DECIMAL(10,2) CHECK (cost IS NULL OR cost >= 0),
    main_image_url TEXT,
    images TEXT[] DEFAULT '{}',
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    supplier_info JSONB DEFAULT '{}',
    shipping_weight DECIMAL(8,2),
    shipping_time VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    stock_status stock_status_enum DEFAULT 'in_stock',
    seo_title VARCHAR(255),
    seo_description VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_slug ON products(brand_id, slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(brand_id, is_featured);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created ON products(created_at DESC);

-- Unique slug per brand
ALTER TABLE products ADD CONSTRAINT unique_product_slug_per_brand UNIQUE (brand_id, slug);

-- Full text search index
CREATE INDEX idx_products_search ON products 
    USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '')));

-- ============================================
-- 3. ORDERS TABLE
-- ============================================
CREATE TYPE order_status_enum AS ENUM (
    'pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    order_number VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    shipping_address JSONB NOT NULL,
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
    total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
    status order_status_enum DEFAULT 'pending',
    payment_intent_id VARCHAR(255),
    tracking_number VARCHAR(100),
    tracking_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_brand ON orders(brand_id);
CREATE INDEX idx_orders_number ON orders(brand_id, order_number);
CREATE INDEX idx_orders_email ON orders(customer_email);
CREATE INDEX idx_orders_status ON orders(brand_id, status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_payment ON orders(payment_intent_id);

-- Unique order number per brand
ALTER TABLE orders ADD CONSTRAINT unique_order_number_per_brand UNIQUE (brand_id, order_number);

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                           LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- ============================================
-- 4. CUSTOMERS TABLE
-- ============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    first_order_at TIMESTAMPTZ,
    last_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_brand ON customers(brand_id);
CREATE INDEX idx_customers_email ON customers(brand_id, email);
CREATE INDEX idx_customers_orders ON customers(total_orders DESC);

-- Unique email per brand (same customer can exist in multiple brands)
ALTER TABLE customers ADD CONSTRAINT unique_customer_email_per_brand UNIQUE (brand_id, email);

-- ============================================
-- 5. CONVERSATIONS TABLE (AI Chat)
-- ============================================
CREATE TYPE chat_role_enum AS ENUM ('user', 'assistant', 'system');

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    session_id VARCHAR(100) NOT NULL,
    role chat_role_enum NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_brand ON conversations(brand_id);
CREATE INDEX idx_conversations_session ON conversations(brand_id, session_id);
CREATE INDEX idx_conversations_created ON conversations(created_at DESC);

-- ============================================
-- 6. KNOWLEDGE_BASE TABLE (RAG)
-- ============================================
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_brand ON knowledge_base(brand_id);
CREATE INDEX idx_knowledge_embedding ON knowledge_base(embedding_id);

-- Full text search for fallback
CREATE INDEX idx_knowledge_search ON knowledge_base 
    USING gin(to_tsvector('english', content));

-- ============================================
-- 7. SETTINGS TABLE
-- ============================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settings_brand ON settings(brand_id);
CREATE INDEX idx_settings_key ON settings(brand_id, key);

-- Unique key per brand
ALTER TABLE settings ADD CONSTRAINT unique_setting_key_per_brand UNIQUE (brand_id, key);

-- Note: Default settings will be inserted per brand in 003_sample_data.sql

-- ============================================
-- 8. CONTENT_LIBRARY TABLE (AI Generated Content)
-- ============================================
CREATE TYPE content_type_enum AS ENUM ('script', 'caption', 'description');
CREATE TYPE content_platform_enum AS ENUM ('tiktok', 'instagram', 'pinterest', 'facebook', 'youtube');
CREATE TYPE content_status_enum AS ENUM ('draft', 'approved', 'published');

CREATE TABLE content_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    type content_type_enum NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    platform content_platform_enum,
    status content_status_enum DEFAULT 'draft',
    performance_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_brand ON content_library(brand_id);
CREATE INDEX idx_content_product ON content_library(product_id);
CREATE INDEX idx_content_type ON content_library(brand_id, type);
CREATE INDEX idx_content_platform ON content_library(brand_id, platform);
CREATE INDEX idx_content_status ON content_library(brand_id, status);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_brands_updated
    BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_categories_updated
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_products_updated
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_orders_updated
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_settings_updated
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_content_updated
    BEFORE UPDATE ON content_library
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
