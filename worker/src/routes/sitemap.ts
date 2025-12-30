/**
 * Sitemap Sharding Routes
 * Handles dynamic sitemap generation with sharding for large sites
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';

const MAX_URLS_PER_SHARD = 10000; // Google recommends max 50,000 but we use 10,000 for performance

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleSitemap(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return jsonResponse({ error: 'Brand context missing' }, 400);
  }

  // Generate sitemap index
  if (path === '/api/sitemap/index' && method === 'GET') {
    return handleGetSitemapIndex(request, supabase, brandId);
  }

  // Generate specific sitemap shard
  if (path.match(/^\/api\/sitemap\/(products|categories|blogs|pages|images)(-\d+)?\.xml$/) && method === 'GET') {
    const matches = path.match(/^\/api\/sitemap\/(products|categories|blogs|pages|images)(-(\d+))?\.xml$/);
    const shardType = matches?.[1] || 'products';
    const shardIndex = parseInt(matches?.[3] || '0', 10);
    return handleGetSitemapShard(request, supabase, brandId, shardType, shardIndex);
  }

  // Regenerate all sitemaps
  if (path === '/api/sitemap/regenerate' && method === 'POST') {
    return handleRegenerateAllSitemaps(supabase, brandId);
  }

  // Get sitemap stats
  if (path === '/api/sitemap/stats' && method === 'GET') {
    return handleGetSitemapStats(supabase, brandId);
  }

  // Admin: Get shard list
  if (path === '/api/sitemap/shards' && method === 'GET') {
    return handleGetShardList(supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Sitemap Index ====================

async function handleGetSitemapIndex(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const baseUrl = url.searchParams.get('base_url') || url.origin;

    // Get all active shards
    const { data: shards } = await supabase
      .from('sitemap_shards')
      .select('shard_type, shard_index, last_generated_at, url_count')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('shard_type')
      .order('shard_index');

    // If no shards exist, generate them first
    if (!shards || shards.length === 0) {
      await generateAllShards(supabase, brandId);
      const { data: newShards } = await supabase
        .from('sitemap_shards')
        .select('shard_type, shard_index, last_generated_at')
        .eq('brand_id', brandId)
        .eq('is_active', true);
      
      return generateSitemapIndexXml(newShards || [], baseUrl);
    }

    return generateSitemapIndexXml(shards, baseUrl);
  } catch (error) {
    console.error('Error generating sitemap index:', error);
    return jsonResponse({ error: 'Failed to generate sitemap index' }, 500);
  }
}

function generateSitemapIndexXml(shards: any[], baseUrl: string): Response {
  const sitemapEntries = shards.map(shard => {
    const suffix = shard.shard_index > 0 ? `-${shard.shard_index}` : '';
    const loc = `${baseUrl}/sitemap/${shard.shard_type}${suffix}.xml`;
    const lastmod = shard.last_generated_at ? new Date(shard.last_generated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    return `  <sitemap>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ==================== Sitemap Shards ====================

async function handleGetSitemapShard(
  request: Request, 
  supabase: any, 
  brandId: string | null, 
  shardType: string, 
  shardIndex: number
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const baseUrl = url.searchParams.get('base_url') || url.origin;

    // Check if shard exists
    const { data: shard } = await supabase
      .from('sitemap_shards')
      .select('urls')
      .eq('brand_id', brandId)
      .eq('shard_type', shardType)
      .eq('shard_index', shardIndex)
      .single();

    let urls = shard?.urls || [];

    // If no cached data, generate fresh
    if (!urls.length) {
      urls = await generateShardUrls(supabase, brandId, shardType, shardIndex, baseUrl);
    }

    return generateSitemapXml(urls, baseUrl);
  } catch (error) {
    console.error('Error generating sitemap shard:', error);
    return jsonResponse({ error: 'Failed to generate sitemap' }, 500);
  }
}

async function generateShardUrls(
  supabase: any, 
  brandId: string | null, 
  shardType: string, 
  shardIndex: number,
  baseUrl: string
): Promise<any[]> {
  const offset = shardIndex * MAX_URLS_PER_SHARD;
  const urls: any[] = [];

  switch (shardType) {
    case 'products': {
      const { data: products } = await supabase
        .from('products')
        .select('slug, updated_at, images')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + MAX_URLS_PER_SHARD - 1);

      for (const product of products || []) {
        urls.push({
          loc: `${baseUrl}/products/${product.slug}`,
          lastmod: product.updated_at ? new Date(product.updated_at).toISOString().split('T')[0] : undefined,
          changefreq: 'weekly',
          priority: 0.8,
          images: (product.images || []).slice(0, 5).map((img: any) => ({
            loc: img.url || img,
            title: img.alt || product.slug,
          })),
        });
      }
      break;
    }

    case 'categories': {
      const { data: categories } = await supabase
        .from('categories')
        .select('slug, updated_at')
        .eq('brand_id', brandId)
        .order('name')
        .range(offset, offset + MAX_URLS_PER_SHARD - 1);

      for (const category of categories || []) {
        urls.push({
          loc: `${baseUrl}/categories/${category.slug}`,
          lastmod: category.updated_at ? new Date(category.updated_at).toISOString().split('T')[0] : undefined,
          changefreq: 'weekly',
          priority: 0.7,
        });
      }
      break;
    }

    case 'blogs': {
      const { data: blogs } = await supabase
        .from('blog_posts')
        .select('slug, updated_at, featured_image')
        .eq('brand_id', brandId)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .range(offset, offset + MAX_URLS_PER_SHARD - 1);

      for (const blog of blogs || []) {
        const entry: any = {
          loc: `${baseUrl}/blog/${blog.slug}`,
          lastmod: blog.updated_at ? new Date(blog.updated_at).toISOString().split('T')[0] : undefined,
          changefreq: 'monthly',
          priority: 0.6,
        };
        if (blog.featured_image) {
          entry.images = [{ loc: blog.featured_image }];
        }
        urls.push(entry);
      }
      break;
    }

    case 'pages': {
      // Static pages
      const staticPages = [
        { loc: `${baseUrl}/`, priority: 1.0, changefreq: 'daily' },
        { loc: `${baseUrl}/about`, priority: 0.5, changefreq: 'monthly' },
        { loc: `${baseUrl}/contact`, priority: 0.5, changefreq: 'monthly' },
        { loc: `${baseUrl}/faq`, priority: 0.5, changefreq: 'monthly' },
      ];
      urls.push(...staticPages);
      break;
    }

    case 'images': {
      const { data: products } = await supabase
        .from('products')
        .select('slug, images')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .range(offset, offset + MAX_URLS_PER_SHARD - 1);

      for (const product of products || []) {
        for (const image of product.images || []) {
          const imageUrl = typeof image === 'string' ? image : image.url;
          if (imageUrl) {
            urls.push({
              loc: imageUrl,
              title: image.alt || product.slug,
              caption: image.alt,
            });
          }
        }
      }
      break;
    }
  }

  return urls;
}

function generateSitemapXml(urls: any[], baseUrl: string): Response {
  const urlEntries = urls.map(url => {
    let entry = `  <url>
    <loc>${escapeXml(url.loc)}</loc>`;
    
    if (url.lastmod) {
      entry += `\n    <lastmod>${url.lastmod}</lastmod>`;
    }
    if (url.changefreq) {
      entry += `\n    <changefreq>${url.changefreq}</changefreq>`;
    }
    if (url.priority !== undefined) {
      entry += `\n    <priority>${url.priority}</priority>`;
    }

    // Image sitemap extension
    if (url.images && url.images.length > 0) {
      for (const image of url.images) {
        entry += `\n    <image:image>
      <image:loc>${escapeXml(image.loc)}</image:loc>`;
        if (image.title) {
          entry += `\n      <image:title>${escapeXml(image.title)}</image:title>`;
        }
        entry += `\n    </image:image>`;
      }
    }

    entry += '\n  </url>';
    return entry;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

// ==================== Regenerate Sitemaps ====================

async function handleRegenerateAllSitemaps(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const result = await generateAllShards(supabase, brandId);
    return jsonResponse(result);
  } catch (error) {
    console.error('Error regenerating sitemaps:', error);
    return jsonResponse({ error: 'Failed to regenerate sitemaps' }, 500);
  }
}

async function generateAllShards(supabase: any, brandId: string | null): Promise<any> {
  const shardTypes = ['products', 'categories', 'blogs', 'pages'];
  const results: any = { shards_created: 0, total_urls: 0 };

  for (const shardType of shardTypes) {
    // Count total items
    let totalCount = 0;

    switch (shardType) {
      case 'products': {
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId)
          .eq('is_active', true);
        totalCount = count || 0;
        break;
      }
      case 'categories': {
        const { count } = await supabase
          .from('categories')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId);
        totalCount = count || 0;
        break;
      }
      case 'blogs': {
        const { count } = await supabase
          .from('blog_posts')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId)
          .eq('status', 'published');
        totalCount = count || 0;
        break;
      }
      case 'pages': {
        totalCount = 4; // Static pages
        break;
      }
    }

    // Calculate number of shards needed
    const shardCount = Math.max(1, Math.ceil(totalCount / MAX_URLS_PER_SHARD));

    // Create/update shards
    for (let i = 0; i < shardCount; i++) {
      const urlsInShard = Math.min(MAX_URLS_PER_SHARD, totalCount - (i * MAX_URLS_PER_SHARD));

      await supabase
        .from('sitemap_shards')
        .upsert({
          brand_id: brandId,
          shard_type: shardType,
          shard_index: i,
          url_count: urlsInShard,
          last_generated_at: new Date().toISOString(),
          is_active: true,
        }, { onConflict: 'brand_id,shard_type,shard_index' });

      results.shards_created++;
      results.total_urls += urlsInShard;
    }

    // Deactivate old shards beyond current count
    await supabase
      .from('sitemap_shards')
      .update({ is_active: false })
      .eq('brand_id', brandId)
      .eq('shard_type', shardType)
      .gte('shard_index', shardCount);
  }

  return results;
}

// ==================== Stats & Admin ====================

async function handleGetSitemapStats(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data: shards } = await supabase
      .from('sitemap_shards')
      .select('shard_type, url_count, last_generated_at')
      .eq('brand_id', brandId)
      .eq('is_active', true);

    const stats: any = {
      total_urls: 0,
      by_type: {},
      last_generated: null,
    };

    for (const shard of shards || []) {
      stats.total_urls += shard.url_count || 0;
      stats.by_type[shard.shard_type] = (stats.by_type[shard.shard_type] || 0) + (shard.url_count || 0);
      
      if (!stats.last_generated || new Date(shard.last_generated_at) > new Date(stats.last_generated)) {
        stats.last_generated = shard.last_generated_at;
      }
    }

    return jsonResponse(stats);
  } catch (error) {
    console.error('Error getting sitemap stats:', error);
    return jsonResponse({ error: 'Failed to get sitemap stats' }, 500);
  }
}

async function handleGetShardList(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('sitemap_shards')
      .select('*')
      .eq('brand_id', brandId)
      .order('shard_type')
      .order('shard_index');

    if (error) throw error;

    return jsonResponse({ shards: data || [] });
  } catch (error) {
    console.error('Error getting shard list:', error);
    return jsonResponse({ error: 'Failed to get shard list' }, 500);
  }
}

// ==================== Helpers ====================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
