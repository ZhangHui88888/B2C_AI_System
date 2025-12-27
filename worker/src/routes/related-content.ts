/**
 * AI-Powered Related Content Recommendations Routes
 * Generates and manages related content suggestions
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleRelatedContent(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  // Generate related content for a single item
  if (path === '/api/related-content/generate' && method === 'POST') {
    return handleGenerateRelated(request, env, supabase, brandId);
  }

  // Bulk generate for all products
  if (path === '/api/related-content/generate-all' && method === 'POST') {
    return handleGenerateAllRelated(env, supabase, brandId);
  }

  // Get related content for an item
  if (path === '/api/related-content' && method === 'GET') {
    return handleGetRelated(request, supabase, brandId);
  }

  // Update related content (manual override)
  if (path.match(/^\/api\/related-content\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop()!;
    return handleUpdateRelated(request, id, supabase);
  }

  // Delete related content
  if (path.match(/^\/api\/related-content\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    return handleDeleteRelated(id, supabase);
  }

  // Get recommendations for display (public API)
  if (path === '/api/related-content/for-display' && method === 'GET') {
    return handleGetForDisplay(request, supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Generate Related Content ====================

async function handleGenerateRelated(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { source_type, source_id, count = 5 } = body;

    if (!source_type || !source_id) {
      return jsonResponse({ error: 'source_type and source_id are required' }, 400);
    }

    // Get source content
    let sourceContent: any = null;
    let allCandidates: any[] = [];

    if (source_type === 'product') {
      const { data: product } = await supabase
        .from('products')
        .select('id, name, description, category_id, tags, price')
        .eq('id', source_id)
        .single();
      
      sourceContent = product;

      // Get candidate products (same category or all)
      const { data: candidates } = await supabase
        .from('products')
        .select('id, name, description, category_id, tags, price')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .neq('id', source_id)
        .limit(50);
      
      allCandidates = candidates || [];
    } else if (source_type === 'blog') {
      const { data: blog } = await supabase
        .from('blog_posts')
        .select('id, title, content, category_id, tags')
        .eq('id', source_id)
        .single();
      
      sourceContent = blog;

      // Get candidate blogs
      const { data: candidates } = await supabase
        .from('blog_posts')
        .select('id, title, content, category_id, tags')
        .eq('brand_id', brandId)
        .eq('status', 'published')
        .neq('id', source_id)
        .limit(30);
      
      allCandidates = candidates || [];
    }

    if (!sourceContent) {
      return jsonResponse({ error: 'Source content not found' }, 404);
    }

    // Use AI to find related content
    const relatedItems = await findRelatedWithAI(sourceContent, allCandidates, source_type, count, env);

    // Save related content
    const savedItems: any[] = [];
    for (const item of relatedItems) {
      const { data, error } = await supabase
        .from('related_content')
        .upsert({
          brand_id: brandId,
          source_type,
          source_id,
          related_type: source_type,
          related_id: item.id,
          relevance_score: item.relevance_score,
          relationship_type: item.relationship_type,
          ai_reasoning: item.reasoning,
          is_ai_generated: true,
          is_active: true,
          display_order: item.order,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'brand_id,source_type,source_id,related_type,related_id' })
        .select()
        .single();

      if (!error && data) {
        savedItems.push(data);
      }
    }

    return jsonResponse({
      source: {
        type: source_type,
        id: source_id,
        name: sourceContent.name || sourceContent.title,
      },
      related_items: savedItems,
      count: savedItems.length,
    });
  } catch (error) {
    console.error('Error generating related content:', error);
    return jsonResponse({ error: 'Failed to generate related content' }, 500);
  }
}

async function findRelatedWithAI(
  source: any,
  candidates: any[],
  contentType: string,
  count: number,
  env: Env
): Promise<any[]> {
  if (candidates.length === 0) {
    return [];
  }

  const sourceName = source.name || source.title;
  const sourceDesc = source.description || source.content || '';

  // Prepare candidate list for AI
  const candidateList = candidates.map((c, i) => ({
    index: i,
    id: c.id,
    name: c.name || c.title,
    description: (c.description || c.content || '').substring(0, 200),
    category_id: c.category_id,
    tags: c.tags,
  }));

  const prompt = `Find the ${count} most related ${contentType}s to this item:

Source: "${sourceName}"
Description: ${sourceDesc.substring(0, 300)}
Category: ${source.category_id || 'N/A'}
Tags: ${JSON.stringify(source.tags || [])}

Candidates:
${candidateList.map(c => `${c.index}. ${c.name} - ${c.description}`).join('\n')}

For each related item, determine:
1. Relevance score (0.0-1.0)
2. Relationship type: "similar" (same category/type), "complementary" (goes well with), or "frequently_bought_together"
3. Brief reasoning

Respond in JSON format:
{
  "related": [
    {"index": 0, "relevance_score": 0.95, "relationship_type": "similar", "reasoning": "..."}
  ]
}`;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an e-commerce recommendation expert. Find related products/content based on similarity, complementarity, and buying patterns.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const aiResponse = await response.json() as any;
    const content = aiResponse.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return (parsed.related || []).slice(0, count).map((r: any, i: number) => ({
        id: candidateList[r.index]?.id,
        relevance_score: r.relevance_score || 0.5,
        relationship_type: r.relationship_type || 'similar',
        reasoning: r.reasoning || '',
        order: i,
      })).filter((r: any) => r.id);
    }
  } catch (error) {
    console.error('AI related content failed:', error);
  }

  // Fallback: return items from same category
  return candidates
    .filter(c => c.category_id === source.category_id)
    .slice(0, count)
    .map((c, i) => ({
      id: c.id,
      relevance_score: 0.7,
      relationship_type: 'similar',
      reasoning: 'Same category',
      order: i,
    }));
}

async function handleGenerateAllRelated(env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get all active products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, description, category_id, tags, price')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .limit(100);

    let generated = 0;

    for (const product of products || []) {
      const candidates = (products || []).filter((p: any) => p.id !== product.id);
      const relatedItems = await findRelatedWithAI(product, candidates, 'product', 4, env);

      for (const item of relatedItems) {
        await supabase
          .from('related_content')
          .upsert({
            brand_id: brandId,
            source_type: 'product',
            source_id: product.id,
            related_type: 'product',
            related_id: item.id,
            relevance_score: item.relevance_score,
            relationship_type: item.relationship_type,
            ai_reasoning: item.reasoning,
            is_ai_generated: true,
            is_active: true,
            display_order: item.order,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'brand_id,source_type,source_id,related_type,related_id' });
      }

      generated++;

      // Rate limiting
      if (generated % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return jsonResponse({
      success: true,
      products_processed: generated,
    });
  } catch (error) {
    console.error('Error generating all related content:', error);
    return jsonResponse({ error: 'Failed to generate all related content' }, 500);
  }
}

// ==================== Get Related Content ====================

async function handleGetRelated(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sourceType = url.searchParams.get('source_type');
    const sourceId = url.searchParams.get('source_id');

    let query = supabase
      .from('related_content')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('display_order');

    if (sourceType) {
      query = query.eq('source_type', sourceType);
    }

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({
      related_content: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('Error getting related content:', error);
    return jsonResponse({ error: 'Failed to get related content' }, 500);
  }
}

async function handleGetForDisplay(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sourceType = url.searchParams.get('source_type');
    const sourceId = url.searchParams.get('source_id');
    const limit = parseInt(url.searchParams.get('limit') || '4', 10);

    if (!sourceType || !sourceId) {
      return jsonResponse({ error: 'source_type and source_id are required' }, 400);
    }

    // Get related content IDs
    const { data: related } = await supabase
      .from('related_content')
      .select('related_type, related_id, relationship_type, relevance_score')
      .eq('brand_id', brandId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('is_active', true)
      .order('relevance_score', { ascending: false })
      .limit(limit);

    if (!related || related.length === 0) {
      return jsonResponse({ items: [] });
    }

    // Fetch full item details
    const items: any[] = [];

    for (const rel of related) {
      if (rel.related_type === 'product') {
        const { data: product } = await supabase
          .from('products')
          .select('id, name, slug, price, compare_at_price, images')
          .eq('id', rel.related_id)
          .eq('is_active', true)
          .single();

        if (product) {
          items.push({
            type: 'product',
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            compare_at_price: product.compare_at_price,
            image: product.images?.[0]?.url || product.images?.[0],
            relationship: rel.relationship_type,
            relevance: rel.relevance_score,
          });
        }
      } else if (rel.related_type === 'blog') {
        const { data: blog } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, featured_image')
          .eq('id', rel.related_id)
          .eq('status', 'published')
          .single();

        if (blog) {
          items.push({
            type: 'blog',
            id: blog.id,
            title: blog.title,
            slug: blog.slug,
            excerpt: blog.excerpt,
            image: blog.featured_image,
            relationship: rel.relationship_type,
            relevance: rel.relevance_score,
          });
        }
      }
    }

    return jsonResponse({ items });
  } catch (error) {
    console.error('Error getting related for display:', error);
    return jsonResponse({ error: 'Failed to get related content' }, 500);
  }
}

// ==================== Update/Delete ====================

async function handleUpdateRelated(request: Request, id: string, supabase: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { is_active, display_order, relationship_type } = body;

    const updateData: any = { updated_at: new Date().toISOString() };

    if (is_active !== undefined) updateData.is_active = is_active;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (relationship_type) updateData.relationship_type = relationship_type;

    const { data, error } = await supabase
      .from('related_content')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error updating related content:', error);
    return jsonResponse({ error: 'Failed to update related content' }, 500);
  }
}

async function handleDeleteRelated(id: string, supabase: any): Promise<Response> {
  try {
    const { error } = await supabase
      .from('related_content')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error deleting related content:', error);
    return jsonResponse({ error: 'Failed to delete related content' }, 500);
  }
}
