/**
 * SEO Link Analysis Routes
 * Handles orphan page detection and internal link density analysis
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleSeoLinks(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  // Orphan page detection
  if (path === '/api/seo/links/orphans/scan' && method === 'POST') {
    return handleScanOrphanPages(supabase, brandId);
  }

  if (path === '/api/seo/links/orphans' && method === 'GET') {
    return handleGetOrphanPages(request, supabase, brandId);
  }

  if (path.match(/^\/api\/seo\/links\/orphans\/[\w-]+\/resolve$/) && method === 'POST') {
    const id = path.split('/')[5];
    return handleResolveOrphan(request, id, supabase);
  }

  // Internal link density
  if (path === '/api/seo/links/density/analyze' && method === 'POST') {
    return handleAnalyzeLinkDensity(request, supabase, brandId);
  }

  if (path === '/api/seo/links/density' && method === 'GET') {
    return handleGetLinkDensity(request, supabase, brandId);
  }

  // Link graph
  if (path === '/api/seo/links/graph/crawl' && method === 'POST') {
    return handleCrawlLinkGraph(supabase, brandId);
  }

  if (path === '/api/seo/links/graph' && method === 'GET') {
    return handleGetLinkGraph(request, supabase, brandId);
  }

  if (path === '/api/seo/links/suggestions' && method === 'GET') {
    return handleGetLinkSuggestions(request, env, supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Orphan Page Detection ====================

async function handleScanOrphanPages(supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get all pages
    const { data: products } = await supabase
      .from('products')
      .select('id, slug, name')
      .eq('brand_id', brandId)
      .eq('is_active', true);

    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug, name')
      .eq('brand_id', brandId);

    const { data: blogs } = await supabase
      .from('blog_posts')
      .select('id, slug, title')
      .eq('brand_id', brandId)
      .eq('status', 'published');

    // Get existing link graph
    const { data: links } = await supabase
      .from('page_link_graph')
      .select('target_url')
      .eq('brand_id', brandId)
      .eq('is_internal', true);

    const linkedUrls = new Set((links || []).map((l: any) => l.target_url));
    const orphans: any[] = [];

    // Check products
    for (const product of products || []) {
      const url = `/products/${product.slug}`;
      if (!linkedUrls.has(url)) {
        orphans.push({
          brand_id: brandId,
          page_url: url,
          page_type: 'product',
          page_id: product.id,
          page_title: product.name,
          incoming_links_count: 0,
          is_in_sitemap: true,
          is_resolved: false,
          detected_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
        });
      }
    }

    // Check categories
    for (const category of categories || []) {
      const url = `/categories/${category.slug}`;
      if (!linkedUrls.has(url)) {
        orphans.push({
          brand_id: brandId,
          page_url: url,
          page_type: 'category',
          page_id: category.id,
          page_title: category.name,
          incoming_links_count: 0,
          is_in_sitemap: true,
          is_resolved: false,
          detected_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
        });
      }
    }

    // Check blogs
    for (const blog of blogs || []) {
      const url = `/blog/${blog.slug}`;
      if (!linkedUrls.has(url)) {
        orphans.push({
          brand_id: brandId,
          page_url: url,
          page_type: 'blog',
          page_id: blog.id,
          page_title: blog.title,
          incoming_links_count: 0,
          is_in_sitemap: true,
          is_resolved: false,
          detected_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
        });
      }
    }

    // Upsert orphan pages
    if (orphans.length > 0) {
      for (const orphan of orphans) {
        await supabase
          .from('orphan_pages')
          .upsert(orphan, { onConflict: 'brand_id,page_url' });
      }
    }

    // Mark pages that now have links as resolved
    const { data: existingOrphans } = await supabase
      .from('orphan_pages')
      .select('id, page_url')
      .eq('brand_id', brandId)
      .eq('is_resolved', false);

    for (const existing of existingOrphans || []) {
      if (linkedUrls.has(existing.page_url)) {
        await supabase
          .from('orphan_pages')
          .update({
            is_resolved: true,
            resolved_at: new Date().toISOString(),
            resolution_action: 'links_added_externally',
          })
          .eq('id', existing.id);
      }
    }

    return jsonResponse({
      success: true,
      orphans_found: orphans.length,
      total_pages_scanned: (products?.length || 0) + (categories?.length || 0) + (blogs?.length || 0),
    });
  } catch (error) {
    console.error('Error scanning orphan pages:', error);
    return jsonResponse({ error: 'Failed to scan orphan pages' }, 500);
  }
}

async function handleGetOrphanPages(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const showResolved = url.searchParams.get('show_resolved') === 'true';
    const pageType = url.searchParams.get('page_type');

    let query = supabase
      .from('orphan_pages')
      .select('*')
      .eq('brand_id', brandId)
      .order('detected_at', { ascending: false });

    if (!showResolved) {
      query = query.eq('is_resolved', false);
    }

    if (pageType) {
      query = query.eq('page_type', pageType);
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({
      orphans: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('Error getting orphan pages:', error);
    return jsonResponse({ error: 'Failed to get orphan pages' }, 500);
  }
}

async function handleResolveOrphan(request: Request, id: string, supabase: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { resolution_action } = body;

    const { data, error } = await supabase
      .from('orphan_pages')
      .update({
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolution_action: resolution_action || 'manual',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error resolving orphan:', error);
    return jsonResponse({ error: 'Failed to resolve orphan' }, 500);
  }
}

// ==================== Link Density Analysis ====================

async function handleAnalyzeLinkDensity(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { page_url, page_type, page_id, content } = body;

    if (!content) {
      return jsonResponse({ error: 'content is required' }, 400);
    }

    // Count words
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Count links (simple regex for HTML content)
    const internalLinkMatches = content.match(/<a[^>]+href=["']\/[^"']*["'][^>]*>/gi) || [];
    const externalLinkMatches = content.match(/<a[^>]+href=["']https?:\/\/[^"']*["'][^>]*>/gi) || [];
    
    const internalLinks = internalLinkMatches.length;
    const externalLinks = externalLinkMatches.length;
    const totalLinks = internalLinks + externalLinks;

    // Calculate density (links per 100 words)
    const linkDensity = wordCount > 0 ? Math.round((totalLinks / wordCount) * 100 * 100) / 100 : 0;

    // Determine status
    let densityStatus = 'optimal';
    if (linkDensity < 1.0) {
      densityStatus = 'too_low';
    } else if (linkDensity > 3.0) {
      densityStatus = 'too_high';
    }

    const analysisData = {
      brand_id: brandId,
      page_url: page_url || '/',
      page_type,
      page_id,
      word_count: wordCount,
      internal_links_count: internalLinks,
      external_links_count: externalLinks,
      broken_links_count: 0,
      link_density: linkDensity,
      density_status: densityStatus,
      analyzed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('link_density_analysis')
      .upsert(analysisData, { onConflict: 'brand_id,page_url' })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({
      ...data,
      recommendations: getLinDensityRecommendations(densityStatus, linkDensity, wordCount),
    });
  } catch (error) {
    console.error('Error analyzing link density:', error);
    return jsonResponse({ error: 'Failed to analyze link density' }, 500);
  }
}

function getLinDensityRecommendations(status: string, density: number, wordCount: number): string[] {
  const recommendations: string[] = [];

  if (status === 'too_low') {
    recommendations.push('Add more internal links to improve site navigation and SEO');
    recommendations.push(`Current density: ${density}%. Aim for 1-3% (1-3 links per 100 words)`);
    const suggestedLinks = Math.ceil((wordCount / 100) * 2) - Math.floor(density * wordCount / 100);
    recommendations.push(`Consider adding ${suggestedLinks} more internal links`);
  } else if (status === 'too_high') {
    recommendations.push('Consider reducing the number of links to improve user experience');
    recommendations.push('Too many links can dilute link equity and confuse readers');
    recommendations.push('Focus on the most relevant and valuable links');
  } else {
    recommendations.push('Link density is optimal! Maintain this balance');
  }

  return recommendations;
}

async function handleGetLinkDensity(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const pageType = url.searchParams.get('page_type');

    let query = supabase
      .from('link_density_analysis')
      .select('*')
      .eq('brand_id', brandId)
      .order('analyzed_at', { ascending: false });

    if (status) {
      query = query.eq('density_status', status);
    }

    if (pageType) {
      query = query.eq('page_type', pageType);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate summary stats
    const summary = {
      total: data?.length || 0,
      optimal: data?.filter((d: any) => d.density_status === 'optimal').length || 0,
      too_low: data?.filter((d: any) => d.density_status === 'too_low').length || 0,
      too_high: data?.filter((d: any) => d.density_status === 'too_high').length || 0,
      avg_density: data?.length ? 
        Math.round(data.reduce((sum: number, d: any) => sum + (d.link_density || 0), 0) / data.length * 100) / 100 : 0,
    };

    return jsonResponse({
      pages: data || [],
      summary,
    });
  } catch (error) {
    console.error('Error getting link density:', error);
    return jsonResponse({ error: 'Failed to get link density' }, 500);
  }
}

// ==================== Link Graph ====================

async function handleCrawlLinkGraph(supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get all content with their descriptions/content
    const { data: products } = await supabase
      .from('products')
      .select('id, slug, name, description')
      .eq('brand_id', brandId)
      .eq('is_active', true);

    const { data: blogs } = await supabase
      .from('blog_posts')
      .select('id, slug, title, content')
      .eq('brand_id', brandId)
      .eq('status', 'published');

    const links: any[] = [];

    // Extract links from product descriptions
    for (const product of products || []) {
      const sourceUrl = `/products/${product.slug}`;
      const content = product.description || '';
      const extractedLinks = extractLinksFromContent(content);

      for (const link of extractedLinks) {
        links.push({
          brand_id: brandId,
          source_url: sourceUrl,
          source_type: 'product',
          source_id: product.id,
          target_url: link.url,
          anchor_text: link.anchor,
          is_internal: !link.url.startsWith('http'),
          link_position: 'content',
          discovered_at: new Date().toISOString(),
        });
      }
    }

    // Extract links from blog posts
    for (const blog of blogs || []) {
      const sourceUrl = `/blog/${blog.slug}`;
      const content = blog.content || '';
      const extractedLinks = extractLinksFromContent(content);

      for (const link of extractedLinks) {
        links.push({
          brand_id: brandId,
          source_url: sourceUrl,
          source_type: 'blog',
          source_id: blog.id,
          target_url: link.url,
          anchor_text: link.anchor,
          is_internal: !link.url.startsWith('http'),
          link_position: 'content',
          discovered_at: new Date().toISOString(),
        });
      }
    }

    // Upsert links
    let insertedCount = 0;
    for (const link of links) {
      const { error } = await supabase
        .from('page_link_graph')
        .upsert(link, { onConflict: 'brand_id,source_url,target_url' });
      
      if (!error) insertedCount++;
    }

    return jsonResponse({
      success: true,
      links_found: links.length,
      links_saved: insertedCount,
    });
  } catch (error) {
    console.error('Error crawling link graph:', error);
    return jsonResponse({ error: 'Failed to crawl link graph' }, 500);
  }
}

function extractLinksFromContent(html: string): { url: string; anchor: string }[] {
  const links: { url: string; anchor: string }[] = [];
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    links.push({
      url: match[1],
      anchor: match[2].trim(),
    });
  }

  return links;
}

async function handleGetLinkGraph(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sourceUrl = url.searchParams.get('source_url');
    const targetUrl = url.searchParams.get('target_url');
    const isInternal = url.searchParams.get('internal');

    let query = supabase
      .from('page_link_graph')
      .select('*')
      .eq('brand_id', brandId)
      .order('discovered_at', { ascending: false })
      .limit(500);

    if (sourceUrl) {
      query = query.eq('source_url', sourceUrl);
    }

    if (targetUrl) {
      query = query.eq('target_url', targetUrl);
    }

    if (isInternal !== null) {
      query = query.eq('is_internal', isInternal === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({
      links: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('Error getting link graph:', error);
    return jsonResponse({ error: 'Failed to get link graph' }, 500);
  }
}

async function handleGetLinkSuggestions(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pageUrl = url.searchParams.get('page_url');
    const pageType = url.searchParams.get('page_type');

    // Get pages with low link density
    const { data: lowDensityPages } = await supabase
      .from('link_density_analysis')
      .select('page_url, page_type, page_id')
      .eq('brand_id', brandId)
      .eq('density_status', 'too_low')
      .limit(10);

    // Get all available pages to link to
    const { data: products } = await supabase
      .from('products')
      .select('id, slug, name, category_id')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .limit(50);

    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug, name')
      .eq('brand_id', brandId);

    const { data: blogs } = await supabase
      .from('blog_posts')
      .select('id, slug, title')
      .eq('brand_id', brandId)
      .eq('status', 'published')
      .limit(20);

    // Generate simple suggestions (in production, use AI for better matching)
    const suggestions: any[] = [];

    for (const page of lowDensityPages || []) {
      const pageSuggestions: any[] = [];

      // Suggest linking to related categories
      for (const cat of categories || []) {
        pageSuggestions.push({
          target_url: `/categories/${cat.slug}`,
          target_title: cat.name,
          reason: 'Related category',
        });
      }

      // Suggest linking to products (first 3)
      for (const product of (products || []).slice(0, 3)) {
        pageSuggestions.push({
          target_url: `/products/${product.slug}`,
          target_title: product.name,
          reason: 'Popular product',
        });
      }

      suggestions.push({
        page_url: page.page_url,
        page_type: page.page_type,
        suggested_links: pageSuggestions.slice(0, 5),
      });
    }

    return jsonResponse({
      suggestions,
      low_density_count: lowDensityPages?.length || 0,
    });
  } catch (error) {
    console.error('Error getting link suggestions:', error);
    return jsonResponse({ error: 'Failed to get link suggestions' }, 500);
  }
}
