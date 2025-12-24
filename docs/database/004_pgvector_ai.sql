-- AI Customer Service - pgvector Support
-- Run this in Supabase SQL Editor AFTER enabling pgvector extension

-- ============================================
-- Enable pgvector extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- Add embedding column to knowledge_base
-- ============================================
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add source tracking columns
ALTER TABLE knowledge_base 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS title VARCHAR(500);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_vector 
ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ============================================
-- Vector similarity search function
-- ============================================
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_brand_id UUID,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  brand_id UUID,
  content TEXT,
  title VARCHAR(500),
  source_type VARCHAR(50),
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.brand_id,
    kb.content,
    kb.title,
    kb.source_type,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.brand_id = match_brand_id
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- Insert default AI settings for existing brands
-- ============================================
-- This is a template - run for each brand_id as needed
-- INSERT INTO settings (brand_id, key, value) VALUES
-- ('your-brand-uuid', 'ai_enabled', 'true'),
-- ('your-brand-uuid', 'ai_system_prompt', '"You are a helpful customer service assistant for {brand_name}. Answer questions based on the provided context. Be friendly, professional, and concise."'),
-- ('your-brand-uuid', 'ai_welcome_message', '"Hello! How can I help you today?"'),
-- ('your-brand-uuid', 'ai_max_context_messages', '10'),
-- ('your-brand-uuid', 'ai_handoff_keywords', '["complaint", "refund", "human", "manager", "投诉", "退款", "人工"]')
-- ON CONFLICT (brand_id, key) DO NOTHING;
