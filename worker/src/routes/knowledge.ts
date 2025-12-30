/**
 * Knowledge Base Management API routes
 * CRUD operations for RAG knowledge entries
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { generateEmbedding } from '../utils/deepseek';

interface KnowledgeEntry {
  id?: string;
  title?: string;
  content: string;
  source_type?: 'manual' | 'product' | 'faq' | 'policy' | 'blog';
  source_id?: string;
}

export async function handleKnowledge(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // GET /api/knowledge - List knowledge entries
  if (request.method === 'GET' && path === '/api/knowledge') {
    return await listKnowledge(supabase, brandId, request);
  }

  // POST /api/knowledge - Add knowledge entry
  if (request.method === 'POST' && path === '/api/knowledge') {
    return await addKnowledge(env, supabase, brandId, request);
  }

  // DELETE /api/knowledge/:id - Delete knowledge entry
  if (request.method === 'DELETE' && path.startsWith('/api/knowledge/')) {
    const id = path.replace('/api/knowledge/', '');
    return await deleteKnowledge(supabase, brandId, id);
  }

  // PUT /api/knowledge/:id - Update knowledge entry
  if (request.method === 'PUT' && path.startsWith('/api/knowledge/')) {
    const id = path.replace('/api/knowledge/', '');
    return await updateKnowledge(env, supabase, brandId, id, request);
  }

  // POST /api/knowledge/sync - Sync knowledge from products/FAQ
  if (request.method === 'POST' && path === '/api/knowledge/sync') {
    return await syncKnowledge(env, supabase, brandId, request);
  }

  return errorResponse('Not found', 404);
}

async function listKnowledge(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const sourceType = url.searchParams.get('source_type');

  let query = supabase
    .from(Tables.KNOWLEDGE_BASE)
    .select('id, title, content, source_type, source_id, created_at', { count: 'exact' })
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });

  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('List knowledge error:', error);
    return errorResponse('Failed to list knowledge', 500);
  }

  return jsonResponse({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

async function addKnowledge(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as KnowledgeEntry;

  if (!body.content || typeof body.content !== 'string') {
    return errorResponse('Content is required', 400);
  }

  try {
    // Generate embedding
    const embedding = await generateEmbedding(env.DEEPSEEK_API_KEY, body.content);
    const hasValidEmbedding = embedding.some((v) => v !== 0);

    const { data, error } = await supabase
      .from(Tables.KNOWLEDGE_BASE)
      .insert({
        brand_id: brandId,
        title: body.title || null,
        content: body.content,
        source_type: body.source_type || 'manual',
        source_id: body.source_id || null,
        embedding: hasValidEmbedding ? embedding : null,
      })
      .select('id, title, content, source_type, created_at')
      .single();

    if (error) {
      console.error('Add knowledge error:', error);
      return errorResponse('Failed to add knowledge', 500);
    }

    return jsonResponse({
      success: true,
      data,
      hasEmbedding: hasValidEmbedding,
    });
  } catch (error) {
    console.error('Add knowledge error:', error);
    return errorResponse('Failed to add knowledge', 500);
  }
}

async function updateKnowledge(
  env: Env,
  supabase: any,
  brandId: string,
  id: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as KnowledgeEntry;

  if (!body.content || typeof body.content !== 'string') {
    return errorResponse('Content is required', 400);
  }

  try {
    // Verify ownership
    const { data: existing } = await supabase
      .from(Tables.KNOWLEDGE_BASE)
      .select('id')
      .eq('id', id)
      .eq('brand_id', brandId)
      .single();

    if (!existing) {
      return errorResponse('Knowledge entry not found', 404);
    }

    // Generate new embedding
    const embedding = await generateEmbedding(env.DEEPSEEK_API_KEY, body.content);
    const hasValidEmbedding = embedding.some((v) => v !== 0);

    const { data, error } = await supabase
      .from(Tables.KNOWLEDGE_BASE)
      .update({
        title: body.title || null,
        content: body.content,
        embedding: hasValidEmbedding ? embedding : null,
      })
      .eq('id', id)
      .eq('brand_id', brandId)
      .select('id, title, content, source_type, created_at')
      .single();

    if (error) {
      console.error('Update knowledge error:', error);
      return errorResponse('Failed to update knowledge', 500);
    }

    return jsonResponse({
      success: true,
      data,
      hasEmbedding: hasValidEmbedding,
    });
  } catch (error) {
    console.error('Update knowledge error:', error);
    return errorResponse('Failed to update knowledge', 500);
  }
}

async function deleteKnowledge(
  supabase: any,
  brandId: string,
  id: string
): Promise<Response> {
  const { error } = await supabase
    .from(Tables.KNOWLEDGE_BASE)
    .delete()
    .eq('id', id)
    .eq('brand_id', brandId);

  if (error) {
    console.error('Delete knowledge error:', error);
    return errorResponse('Failed to delete knowledge', 500);
  }

  return jsonResponse({ success: true });
}

async function syncKnowledge(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { sources?: string[] };
  const sources = body.sources || ['product', 'faq'];

  const results = {
    synced: 0,
    errors: 0,
    sources: {} as Record<string, number>,
  };

  // Sync products
  if (sources.includes('product')) {
    const productCount = await syncProducts(env, supabase, brandId);
    results.sources.product = productCount;
    results.synced += productCount;
  }

  // Note: FAQ sync would require an FAQ table - placeholder for future
  if (sources.includes('faq')) {
    results.sources.faq = 0;
  }

  return jsonResponse({
    success: true,
    message: `Synced ${results.synced} knowledge entries`,
    results,
  });
}

async function syncProducts(
  env: Env,
  supabase: any,
  brandId: string
): Promise<number> {
  // Get all active products
  const { data: products } = await supabase
    .from(Tables.PRODUCTS)
    .select('id, name, description, short_description')
    .eq('brand_id', brandId)
    .eq('is_active', true);

  if (!products || products.length === 0) return 0;

  let synced = 0;

  for (const product of products) {
    // Build knowledge content from product
    const content = [
      `Product: ${product.name}`,
      product.short_description && `Summary: ${product.short_description}`,
      product.description && `Details: ${product.description}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      // Check if knowledge entry already exists for this product
      const { data: existing } = await supabase
        .from(Tables.KNOWLEDGE_BASE)
        .select('id')
        .eq('brand_id', brandId)
        .eq('source_type', 'product')
        .eq('source_id', product.id)
        .single();

      // Generate embedding
      const embedding = await generateEmbedding(env.DEEPSEEK_API_KEY, content);
      const hasValidEmbedding = embedding.some((v) => v !== 0);

      if (existing) {
        // Update existing
        await supabase
          .from(Tables.KNOWLEDGE_BASE)
          .update({
            title: product.name,
            content,
            embedding: hasValidEmbedding ? embedding : null,
          })
          .eq('brand_id', brandId)
          .eq('id', existing.id);
      } else {
        // Insert new
        await supabase.from(Tables.KNOWLEDGE_BASE).insert({
          brand_id: brandId,
          title: product.name,
          content,
          source_type: 'product',
          source_id: product.id,
          embedding: hasValidEmbedding ? embedding : null,
        });
      }

      synced++;
    } catch (error) {
      console.error(`Failed to sync product ${product.id}:`, error);
    }
  }

  return synced;
}
