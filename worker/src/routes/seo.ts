/**
 * SEO Tools API Routes
 * Handles meta tags, redirects, 404 errors, sitemap config, robots config, and content analysis
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, cors } from '../utils/response';

// Helper to get brand ID from request
function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleSeo(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  // SEO Meta endpoints
  if (path === '/api/seo/meta' && method === 'POST') {
    return handleSaveMeta(request, supabase, brandId);
  }

  if (path === '/api/seo/generate-meta' && method === 'POST') {
    return handleGenerateMeta(request, env, supabase, brandId);
  }

  if (path === '/api/seo/bulk-generate-meta' && method === 'POST') {
    return handleBulkGenerateMeta(request, env, supabase, brandId);
  }

  // Redirects endpoints
  if (path === '/api/seo/redirects' && (method === 'POST' || method === 'PUT')) {
    return handleSaveRedirect(request, supabase, brandId);
  }

  if (path.match(/^\/api\/seo\/redirects\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    return handleDeleteRedirect(id, supabase);
  }

  if (path.match(/^\/api\/seo\/redirects\/[\w-]+$/) && method === 'PATCH') {
    const id = path.split('/').pop()!;
    return handleUpdateRedirectStatus(request, id, supabase);
  }

  // 404 Errors endpoints
  if (path.match(/^\/api\/seo\/errors\/[\w-]+\/resolve$/) && method === 'POST') {
    const id = path.split('/')[4];
    return handleResolveError(id, supabase, true);
  }

  if (path.match(/^\/api\/seo\/errors\/[\w-]+\/reopen$/) && method === 'POST') {
    const id = path.split('/')[4];
    return handleResolveError(id, supabase, false);
  }

  if (path === '/api/seo/errors/clear-resolved' && method === 'DELETE') {
    return handleClearResolvedErrors(supabase, brandId);
  }

  // Sitemap config
  if (path === '/api/seo/sitemap/config' && method === 'POST') {
    return handleSaveSitemapConfig(request, supabase, brandId);
  }

  if (path === '/api/seo/sitemap/regenerate' && method === 'POST') {
    return handleRegenerateSitemap(supabase, brandId);
  }

  // Robots config
  if (path === '/api/seo/robots/config' && method === 'POST') {
    return handleSaveRobotsConfig(request, supabase, brandId);
  }

  // Content analysis
  if (path === '/api/seo/analyze' && method === 'POST') {
    return handleAnalyzeContent(request, env, supabase, brandId);
  }

  if (path === '/api/seo/analyze-all' && method === 'POST') {
    return handleAnalyzeAllContent(env, supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Meta Tags ====================

async function handleSaveMeta(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { page_id, page_type, meta_title, meta_description, page_slug } = body;

    if (!page_type) {
      return jsonResponse({ error: 'page_type is required' }, 400);
    }

    const data = {
      brand_id: brandId,
      page_type,
      page_id: page_id || null,
      page_slug: page_slug || null,
      meta_title: meta_title || null,
      meta_description: meta_description || null,
      updated_at: new Date().toISOString(),
    };

    // Upsert based on brand_id, page_type, and page_id/page_slug
    const { data: result, error } = await supabase
      .from('seo_meta')
      .upsert(data, { 
        onConflict: 'brand_id,page_type,page_id,page_slug',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      // Try insert if upsert fails
      const { data: insertResult, error: insertError } = await supabase
        .from('seo_meta')
        .insert(data)
        .select()
        .single();

      if (insertError) {
        console.error('Failed to save meta:', insertError);
        return jsonResponse({ error: 'Failed to save meta tags' }, 500);
      }
      return jsonResponse(insertResult);
    }

    return jsonResponse(result);
  } catch (error) {
    console.error('Error saving meta:', error);
    return jsonResponse({ error: 'Failed to save meta tags' }, 500);
  }
}

async function handleGenerateMeta(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { page_id, page_type, page_name } = body;

    // Get product/category details for context
    let context = '';
    if (page_type === 'product' && page_id) {
      const { data: product } = await supabase
        .from('products')
        .select('name, short_description, description, category_id')
        .eq('id', page_id)
        .single();

      if (product) {
        context = `Product: ${product.name}\nShort description: ${product.short_description || ''}\nDescription: ${product.description || ''}`;
      }
    } else if (page_type === 'category' && page_id) {
      const { data: category } = await supabase
        .from('categories')
        .select('name, description')
        .eq('id', page_id)
        .single();

      if (category) {
        context = `Category: ${category.name}\nDescription: ${category.description || ''}`;
      }
    }

    if (!context) {
      context = `Page: ${page_name || 'Untitled'}`;
    }

    // Generate meta using DeepSeek
    const prompt = `Generate SEO meta tags for the following ${page_type}:

${context}

Requirements:
1. Title tag: 50-60 characters, include primary keyword, compelling and click-worthy
2. Meta description: 140-160 characters, include call-to-action, summarize content value

Respond in JSON format only:
{
  "meta_title": "...",
  "meta_description": "..."
}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an SEO expert. Generate optimized meta tags. Respond only in valid JSON format.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const aiResponse = await response.json() as any;
    const content = aiResponse.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return jsonResponse({
        meta_title: parsed.meta_title || '',
        meta_description: parsed.meta_description || '',
        is_ai_generated: true,
      });
    }

    return jsonResponse({ error: 'Failed to parse AI response' }, 500);
  } catch (error) {
    console.error('Error generating meta:', error);
    return jsonResponse({ error: 'Failed to generate meta tags' }, 500);
  }
}

async function handleBulkGenerateMeta(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get products without meta
    const { data: products } = await supabase
      .from('products')
      .select('id, name, short_description')
      .eq('is_active', true)
      .or('meta_title.is.null,meta_description.is.null');

    let count = 0;
    const batchSize = 5; // Process in batches to avoid rate limits

    for (let i = 0; i < (products?.length || 0); i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (product: any) => {
        try {
          const prompt = `Generate SEO meta for: ${product.name}. ${product.short_description || ''}
Return JSON: {"meta_title": "50-60 chars", "meta_description": "140-160 chars"}`;

          const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 300,
            }),
          });

          if (response.ok) {
            const aiResponse = await response.json() as any;
            const content = aiResponse.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              await supabase
                .from('products')
                .update({
                  meta_title: parsed.meta_title,
                  meta_description: parsed.meta_description,
                })
                .eq('id', product.id);
              count++;
            }
          }
        } catch (err) {
          console.error('Error generating meta for product:', product.id, err);
        }
      }));

      // Small delay between batches
      if (i + batchSize < (products?.length || 0)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return jsonResponse({ success: true, count });
  } catch (error) {
    console.error('Error bulk generating meta:', error);
    return jsonResponse({ error: 'Failed to bulk generate meta tags' }, 500);
  }
}

// ==================== Redirects ====================

async function handleSaveRedirect(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { id, source_path, target_url, redirect_type, is_active } = body;

    if (!source_path || !target_url) {
      return jsonResponse({ error: 'source_path and target_url are required' }, 400);
    }

    const data = {
      brand_id: brandId,
      source_path,
      target_url,
      redirect_type: redirect_type || 301,
      is_active: is_active !== false,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      // Update existing
      const { data: result, error } = await supabase
        .from('url_redirects')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse(result);
    } else {
      // Insert new
      const { data: result, error } = await supabase
        .from('url_redirects')
        .insert({ ...data, created_at: new Date().toISOString() })
        .select()
        .single();

      if (error) throw error;
      return jsonResponse(result);
    }
  } catch (error) {
    console.error('Error saving redirect:', error);
    return jsonResponse({ error: 'Failed to save redirect' }, 500);
  }
}

async function handleDeleteRedirect(id: string, supabase: any): Promise<Response> {
  try {
    const { error } = await supabase
      .from('url_redirects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error deleting redirect:', error);
    return jsonResponse({ error: 'Failed to delete redirect' }, 500);
  }
}

async function handleUpdateRedirectStatus(request: Request, id: string, supabase: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { is_active } = body;

    const { data: result, error } = await supabase
      .from('url_redirects')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(result);
  } catch (error) {
    console.error('Error updating redirect status:', error);
    return jsonResponse({ error: 'Failed to update redirect' }, 500);
  }
}

// ==================== 404 Errors ====================

async function handleResolveError(id: string, supabase: any, resolved: boolean): Promise<Response> {
  try {
    const { data: result, error } = await supabase
      .from('error_404_logs')
      .update({ is_resolved: resolved })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(result);
  } catch (error) {
    console.error('Error resolving 404:', error);
    return jsonResponse({ error: 'Failed to update 404 status' }, 500);
  }
}

async function handleClearResolvedErrors(supabase: any, brandId: string | null): Promise<Response> {
  try {
    let query = supabase
      .from('error_404_logs')
      .delete()
      .eq('is_resolved', true);

    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { error } = await query;
    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error clearing resolved errors:', error);
    return jsonResponse({ error: 'Failed to clear resolved errors' }, 500);
  }
}

// ==================== Sitemap Config ====================

async function handleSaveSitemapConfig(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { configs } = body;

    if (!Array.isArray(configs)) {
      return jsonResponse({ error: 'configs array is required' }, 400);
    }

    // Upsert each config
    for (const config of configs) {
      await supabase
        .from('sitemap_config')
        .upsert({
          brand_id: brandId,
          page_type: config.page_type,
          is_included: config.is_included,
          changefreq: config.changefreq,
          priority: config.priority,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'brand_id,page_type',
        });
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error saving sitemap config:', error);
    return jsonResponse({ error: 'Failed to save sitemap config' }, 500);
  }
}

async function handleRegenerateSitemap(supabase: any, brandId: string | null): Promise<Response> {
  // Sitemap is generated dynamically, so just update last_generated_at
  try {
    await supabase
      .from('sitemap_config')
      .update({ last_generated_at: new Date().toISOString() })
      .eq('brand_id', brandId);

    return jsonResponse({ success: true, message: 'Sitemap regeneration triggered' });
  } catch (error) {
    console.error('Error regenerating sitemap:', error);
    return jsonResponse({ error: 'Failed to regenerate sitemap' }, 500);
  }
}

// ==================== Robots Config ====================

async function handleSaveRobotsConfig(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;

    const data = {
      brand_id: brandId,
      allow_gptbot: body.allow_gptbot !== false,
      allow_claudebot: body.allow_claudebot !== false,
      allow_perplexitybot: body.allow_perplexitybot !== false,
      allow_googlebot: body.allow_googlebot !== false,
      allow_bingbot: body.allow_bingbot !== false,
      disallow_paths: body.disallow_paths || [],
      updated_at: new Date().toISOString(),
    };

    // Upsert
    const { data: result, error } = await supabase
      .from('robots_config')
      .upsert(data, { onConflict: 'brand_id' })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse(result);
  } catch (error) {
    console.error('Error saving robots config:', error);
    return jsonResponse({ error: 'Failed to save robots config' }, 500);
  }
}

// ==================== Content Analysis ====================

async function handleAnalyzeContent(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { content_id, content_type } = body;

    if (!content_id || !content_type) {
      return jsonResponse({ error: 'content_id and content_type are required' }, 400);
    }

    // Get content
    let content: any = null;
    let name = '';

    if (content_type === 'product') {
      const { data } = await supabase
        .from('products')
        .select('id, name, description, short_description, meta_title, meta_description, images')
        .eq('id', content_id)
        .single();
      content = data;
      name = data?.name || '';
    }

    if (!content) {
      return jsonResponse({ error: 'Content not found' }, 404);
    }

    // Analyze content
    const description = content.description || '';
    const wordCount = description.split(/\s+/).filter(Boolean).length;
    const sentenceCount = (description.match(/[.!?]+/g) || []).length || 1;
    const avgWordsPerSentence = wordCount / sentenceCount;

    // Simple Flesch Reading Ease approximation
    const syllableCount = description.split(/\s+/).reduce((sum: number, word: string) => {
      return sum + (word.match(/[aeiouy]+/gi) || []).length;
    }, 0);
    const fleschScore = Math.round(206.835 - 1.015 * avgWordsPerSentence - 84.6 * (syllableCount / wordCount || 0));
    const readabilityScore = Math.max(0, Math.min(100, fleschScore));

    // Check meta tags
    const titleLength = (content.meta_title || '').length;
    const descLength = (content.meta_description || '').length;
    const hasImages = (content.images || []).length > 0;
    const imagesWithAlt = (content.images || []).filter((img: any) => img.alt).length;

    // Calculate SEO score
    let seoScore = 0;
    const issues: { severity: string; message: string }[] = [];
    const recommendations: string[] = [];

    // Title scoring (25 points)
    if (content.meta_title && titleLength >= 30 && titleLength <= 60) {
      seoScore += 25;
    } else if (content.meta_title) {
      seoScore += 10;
      if (titleLength < 30) {
        issues.push({ severity: 'warning', message: 'Title tag is too short (under 30 characters)' });
        recommendations.push('Expand your title to 50-60 characters for better SEO impact');
      } else if (titleLength > 60) {
        issues.push({ severity: 'warning', message: 'Title tag is too long (over 60 characters)' });
        recommendations.push('Shorten your title to 60 characters or less to prevent truncation');
      }
    } else {
      issues.push({ severity: 'error', message: 'Missing meta title tag' });
      recommendations.push('Add a descriptive title tag with your primary keyword');
    }

    // Description scoring (25 points)
    if (content.meta_description && descLength >= 120 && descLength <= 160) {
      seoScore += 25;
    } else if (content.meta_description) {
      seoScore += 10;
      if (descLength < 120) {
        issues.push({ severity: 'warning', message: 'Meta description is too short' });
        recommendations.push('Expand your meta description to 140-160 characters');
      } else if (descLength > 160) {
        issues.push({ severity: 'warning', message: 'Meta description is too long' });
        recommendations.push('Shorten your meta description to prevent truncation in search results');
      }
    } else {
      issues.push({ severity: 'error', message: 'Missing meta description' });
      recommendations.push('Add a compelling meta description with a call-to-action');
    }

    // Content length scoring (25 points)
    if (wordCount >= 300) {
      seoScore += 25;
    } else if (wordCount >= 100) {
      seoScore += 15;
      recommendations.push('Consider expanding your content to 300+ words for better ranking potential');
    } else if (wordCount >= 50) {
      seoScore += 5;
      issues.push({ severity: 'warning', message: 'Content is too thin (under 100 words)' });
      recommendations.push('Add more detailed product description for better SEO');
    } else {
      issues.push({ severity: 'error', message: 'Very thin content (under 50 words)' });
      recommendations.push('Products with detailed descriptions rank better in search results');
    }

    // Images scoring (25 points)
    if (hasImages && imagesWithAlt === (content.images || []).length) {
      seoScore += 25;
    } else if (hasImages) {
      seoScore += 10;
      issues.push({ severity: 'warning', message: `${(content.images || []).length - imagesWithAlt} images missing alt text` });
      recommendations.push('Add descriptive alt text to all images for accessibility and SEO');
    } else {
      issues.push({ severity: 'warning', message: 'No product images' });
      recommendations.push('Add high-quality product images to improve engagement');
    }

    // Save to cache
    await supabase.from('content_seo_cache').upsert({
      brand_id: brandId,
      content_type,
      content_id,
      word_count: wordCount,
      sentence_count: sentenceCount,
      seo_score: seoScore,
      readability_score: readabilityScore,
      image_count: (content.images || []).length,
      images_with_alt: imagesWithAlt,
      analyzed_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,content_type,content_id' });

    return jsonResponse({
      name,
      seo_score: seoScore,
      readability_score: readabilityScore,
      word_count: wordCount,
      sentence_count: sentenceCount,
      issues,
      recommendations,
    });
  } catch (error) {
    console.error('Error analyzing content:', error);
    return jsonResponse({ error: 'Failed to analyze content' }, 500);
  }
}

async function handleAnalyzeAllContent(env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true);

    let count = 0;
    for (const product of products || []) {
      try {
        // Simple analysis without AI call
        const { data: p } = await supabase
          .from('products')
          .select('description, meta_title, meta_description, images')
          .eq('id', product.id)
          .single();

        if (p) {
          const description = p.description || '';
          const wordCount = description.split(/\s+/).filter(Boolean).length;
          const titleLength = (p.meta_title || '').length;
          const descLength = (p.meta_description || '').length;
          const imageCount = (p.images || []).length;
          const imagesWithAlt = (p.images || []).filter((img: any) => img.alt).length;

          let seoScore = 0;
          if (p.meta_title && titleLength >= 30 && titleLength <= 60) seoScore += 25;
          else if (p.meta_title) seoScore += 10;
          if (p.meta_description && descLength >= 120 && descLength <= 160) seoScore += 25;
          else if (p.meta_description) seoScore += 10;
          if (wordCount >= 100) seoScore += 25;
          else if (wordCount >= 50) seoScore += 15;
          if (imageCount > 0 && imagesWithAlt === imageCount) seoScore += 25;
          else if (imageCount > 0) seoScore += 10;

          await supabase.from('content_seo_cache').upsert({
            brand_id: brandId,
            content_type: 'product',
            content_id: product.id,
            word_count: wordCount,
            seo_score: seoScore,
            image_count: imageCount,
            images_with_alt: imagesWithAlt,
            analyzed_at: new Date().toISOString(),
          }, { onConflict: 'brand_id,content_type,content_id' });

          count++;
        }
      } catch (err) {
        console.error('Error analyzing product:', product.id, err);
      }
    }

    return jsonResponse({ success: true, count });
  } catch (error) {
    console.error('Error analyzing all content:', error);
    return jsonResponse({ error: 'Failed to analyze all content' }, 500);
  }
}
