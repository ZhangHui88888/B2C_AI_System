/**
 * Admin SEO API routes
 * Secure (JWT + brand access) wrapper around SEO tools.
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandManageAccess, requireBrandAdminAccess } from '../middleware/admin-auth';
import { handleSeo } from './seo';

export async function handleAdminSeo(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabase(env);

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  const brandId = getBrandId(request);
  if (!brandId || brandId === 'all') {
    return errorResponse('Brand context missing', 400);
  }

  const access = await requireBrandManageAccess(env, admin, brandId);
  if (!access.ok) return access.response;

  // ---------- Page-data endpoints (GET) ----------

  if (request.method === 'GET' && path === '/api/admin/seo/overview') {
    return await getOverview(supabase, brandId);
  }

  if (request.method === 'GET' && path === '/api/admin/seo/redirects') {
    return await listRedirects(supabase, brandId);
  }

  if (request.method === 'GET' && path === '/api/admin/seo/errors') {
    return await listErrors(supabase, brandId);
  }

  if (request.method === 'GET' && path === '/api/admin/seo/sitemap/page-data') {
    return await getSitemapPageData(supabase, brandId);
  }

  if (request.method === 'GET' && path === '/api/admin/seo/robots/config') {
    return await getRobotsConfig(supabase, brandId);
  }

  if (request.method === 'GET' && path === '/api/admin/seo/meta/page-data') {
    return await getMetaPageData(supabase, brandId);
  }

  if (request.method === 'GET' && path === '/api/admin/seo/analysis/page-data') {
    return await getAnalysisPageData(supabase, brandId);
  }

  // ---------- Write operations: require brand admin ----------
  const isWriteMethod = request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS';
  if (isWriteMethod) {
    const adminAccess = await requireBrandAdminAccess(env, admin, brandId);
    if (!adminAccess.ok) return adminAccess.response;
  }

  // Delegate to existing SEO handler by rewriting path prefix
  const mappedPath = path.replace(/^\/api\/admin\/seo/, '/api/seo');
  return await handleSeo(request, env, mappedPath);
}

async function getOverview(supabase: any, brandId: string): Promise<Response> {
  const [{ data: products, error: productsError }, { data: redirects, error: redirectsError }, { data: errors404, error: errorsError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, seo_title, seo_description, images')
        .eq('brand_id', brandId)
        .eq('is_active', true),
      supabase.from('url_redirects').select('id, is_active').eq('brand_id', brandId).eq('is_active', true),
      supabase.from('error_404_logs').select('id').eq('brand_id', brandId).eq('is_resolved', false),
    ]);

  if (productsError || redirectsError || errorsError) {
    console.error('SEO overview errors:', { productsError, redirectsError, errorsError });
    return errorResponse('Failed to load SEO overview', 500);
  }

  const prodRows = Array.isArray(products) ? products : [];
  const totalProducts = prodRows.length;
  const productsWithMeta = prodRows.filter((p: any) => p?.seo_title && p?.seo_description).length;
  const productsWithoutMeta = totalProducts - productsWithMeta;

  const titles = prodRows.map((p: any) => p?.seo_title).filter(Boolean);
  const descriptions = prodRows.map((p: any) => p?.seo_description).filter(Boolean);
  const duplicateTitles = titles.length - new Set(titles).size;
  const duplicateDescriptions = descriptions.length - new Set(descriptions).size;

  let imagesWithoutAlt = 0;
  prodRows.forEach((p: any) => {
    const imgs = Array.isArray(p?.images) ? p.images : [];
    const missingAlt = imgs.some((img: any) => {
      if (!img) return true;
      if (typeof img === 'string') return true;
      return !img?.alt;
    });
    if (missingAlt) imagesWithoutAlt++;
  });

  return jsonResponse({
    success: true,
    stats: {
      totalProducts,
      productsWithMeta,
      productsWithoutMeta,
      totalRedirects: Array.isArray(redirects) ? redirects.length : 0,
      total404Errors: Array.isArray(errors404) ? errors404.length : 0,
      duplicateTitles,
      duplicateDescriptions,
      imagesWithoutAlt,
    },
  });
}

async function listRedirects(supabase: any, brandId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('url_redirects')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('List redirects error:', error);
    return errorResponse('Failed to fetch redirects', 500);
  }

  return jsonResponse({ success: true, redirects: data || [] });
}

async function listErrors(supabase: any, brandId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('error_404_logs')
    .select('*')
    .eq('brand_id', brandId)
    .order('hit_count', { ascending: false });

  if (error) {
    console.error('List 404 errors error:', error);
    return errorResponse('Failed to fetch 404 errors', 500);
  }

  return jsonResponse({ success: true, errors: data || [] });
}

async function getSitemapPageData(supabase: any, brandId: string): Promise<Response> {
  const [{ data: sitemapConfig, error: sitemapError }, { count: productCount, error: productError }, { count: categoryCount, error: categoryError }, { count: blogCount, error: blogError }] =
    await Promise.all([
      supabase.from('sitemap_config').select('*').eq('brand_id', brandId),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('is_active', true),
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('brand_id', brandId),
      supabase.from('content_library').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('type', 'blog').eq('status', 'published'),
    ]);

  if (sitemapError || productError || categoryError || blogError) {
    console.error('Sitemap page data error:', { sitemapError, productError, categoryError, blogError });
    return errorResponse('Failed to load sitemap config', 500);
  }

  return jsonResponse({
    success: true,
    sitemapConfig: sitemapConfig || [],
    counts: {
      products: productCount || 0,
      categories: categoryCount || 0,
      blogs: blogCount || 0,
      pages: 6,
    },
  });
}

async function getRobotsConfig(supabase: any, brandId: string): Promise<Response> {
  const { data, error } = await supabase
    .from('robots_config')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  if (error) {
    // If missing row, treat as empty config
    return jsonResponse({ success: true, config: null });
  }

  return jsonResponse({ success: true, config: data || null });
}

async function getMetaPageData(supabase: any, brandId: string): Promise<Response> {
  const [{ data: products, error: productsError }, { data: categories, error: categoriesError }, { data: seoMeta, error: seoMetaError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, name, slug, meta_title, meta_description, images')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('categories')
        .select('id, name, slug, meta_title, meta_description')
        .eq('brand_id', brandId)
        .order('name', { ascending: true }),
      supabase
        .from('seo_meta')
        .select('*')
        .eq('brand_id', brandId),
    ]);

  if (productsError || categoriesError || seoMetaError) {
    console.error('Meta page data error:', { productsError, categoriesError, seoMetaError });
    return errorResponse('Failed to load meta data', 500);
  }

  return jsonResponse({
    success: true,
    products: products || [],
    categories: categories || [],
    seoMeta: seoMeta || [],
  });
}

async function getAnalysisPageData(supabase: any, brandId: string): Promise<Response> {
  const [{ data: products, error: productsError }, { data: seoCache, error: cacheError }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, slug, description, short_description, meta_title, meta_description, images')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase
      .from('content_seo_cache')
      .select('*')
      .eq('brand_id', brandId),
  ]);

  if (productsError || cacheError) {
    console.error('Analysis page data error:', { productsError, cacheError });
    return errorResponse('Failed to load analysis data', 500);
  }

  return jsonResponse({
    success: true,
    products: products || [],
    seoCache: seoCache || [],
  });
}
