/**
 * Google Search Console API Routes
 * Performance data, URL inspection, sitemap management
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import {
  createSearchConsoleClient,
  formatDateRange,
  refreshAccessToken,
  getOAuthUrl,
  exchangeCodeForTokens,
} from '../utils/search-console';

const Tables = {
  SETTINGS: 'settings',
  SEO_RANKINGS: 'seo_rankings',
};

export async function handleSearchConsole(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // ============================================
  // OAuth Routes
  // ============================================

  // GET /api/search-console/oauth/url - Get OAuth URL
  if (request.method === 'GET' && path === '/api/search-console/oauth/url') {
    return getOAuthUrlRoute(env, request);
  }

  // POST /api/search-console/oauth/callback - Exchange code for tokens
  if (request.method === 'POST' && path === '/api/search-console/oauth/callback') {
    return handleOAuthCallback(env, supabase, brandId, request);
  }

  // POST /api/search-console/oauth/refresh - Refresh access token
  if (request.method === 'POST' && path === '/api/search-console/oauth/refresh') {
    return refreshToken(env, supabase, brandId);
  }

  // ============================================
  // Performance Routes
  // ============================================

  // GET /api/search-console/performance - Get performance overview
  if (request.method === 'GET' && path === '/api/search-console/performance') {
    return getPerformance(env, supabase, brandId, request);
  }

  // GET /api/search-console/queries - Get top queries
  if (request.method === 'GET' && path === '/api/search-console/queries') {
    return getTopQueries(env, supabase, brandId, request);
  }

  // GET /api/search-console/pages - Get top pages
  if (request.method === 'GET' && path === '/api/search-console/pages') {
    return getTopPages(env, supabase, brandId, request);
  }

  // GET /api/search-console/devices - Get performance by device
  if (request.method === 'GET' && path === '/api/search-console/devices') {
    return getByDevice(env, supabase, brandId, request);
  }

  // GET /api/search-console/countries - Get performance by country
  if (request.method === 'GET' && path === '/api/search-console/countries') {
    return getByCountry(env, supabase, brandId, request);
  }

  // ============================================
  // URL Inspection Routes
  // ============================================

  // POST /api/search-console/inspect - Inspect URL
  if (request.method === 'POST' && path === '/api/search-console/inspect') {
    return inspectUrl(env, supabase, brandId, request);
  }

  // POST /api/search-console/inspect/batch - Batch inspect URLs
  if (request.method === 'POST' && path === '/api/search-console/inspect/batch') {
    return batchInspectUrls(env, supabase, brandId, request);
  }

  // ============================================
  // Sitemap Routes
  // ============================================

  // GET /api/search-console/sitemaps - List sitemaps
  if (request.method === 'GET' && path === '/api/search-console/sitemaps') {
    return listSitemaps(env, supabase, brandId);
  }

  // POST /api/search-console/sitemaps - Submit sitemap
  if (request.method === 'POST' && path === '/api/search-console/sitemaps') {
    return submitSitemap(env, supabase, brandId, request);
  }

  // DELETE /api/search-console/sitemaps - Delete sitemap
  if (request.method === 'DELETE' && path === '/api/search-console/sitemaps') {
    return deleteSitemap(env, supabase, brandId, request);
  }

  // ============================================
  // Sites Routes
  // ============================================

  // GET /api/search-console/sites - List sites
  if (request.method === 'GET' && path === '/api/search-console/sites') {
    return listSites(env, supabase, brandId);
  }

  // GET /api/search-console/status - Get connection status
  if (request.method === 'GET' && path === '/api/search-console/status') {
    return getConnectionStatus(supabase, brandId);
  }

  return errorResponse('Not found', 404);
}

// ============================================
// Helper: Get Search Console Config
// ============================================

async function getConfig(
  env: Env,
  supabase: any,
  brandId: string
): Promise<{ accessToken: string; siteUrl: string } | null> {
  // Get stored tokens from settings
  const { data: settings } = await supabase
    .from(Tables.SETTINGS)
    .select('value')
    .eq('brand_id', brandId)
    .eq('key', 'search_console_config')
    .single();

  if (!settings?.value) return null;

  const config = settings.value;
  
  // Check if token needs refresh
  if (config.expires_at && new Date(config.expires_at) < new Date()) {
    const clientId = (env as any).GOOGLE_CLIENT_ID;
    const clientSecret = (env as any).GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || !config.refresh_token) {
      return null;
    }

    const refreshResult = await refreshAccessToken(
      clientId,
      clientSecret,
      config.refresh_token
    );

    if (!refreshResult.success) return null;

    // Update stored token
    const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    await supabase
      .from(Tables.SETTINGS)
      .update({
        value: {
          ...config,
          access_token: refreshResult.accessToken,
          expires_at: newExpiresAt,
        },
      })
      .eq('brand_id', brandId)
      .eq('key', 'search_console_config');

    return {
      accessToken: refreshResult.accessToken!,
      siteUrl: config.site_url,
    };
  }

  return {
    accessToken: config.access_token,
    siteUrl: config.site_url,
  };
}

// ============================================
// OAuth Routes
// ============================================

function getOAuthUrlRoute(env: Env, request: Request): Response {
  const clientId = (env as any).GOOGLE_CLIENT_ID;
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get('redirect_uri') || 
    `${url.origin}/admin/settings/search-console/callback`;

  if (!clientId) {
    return errorResponse('Google OAuth not configured', 500);
  }

  const state = crypto.randomUUID();
  const oauthUrl = getOAuthUrl(clientId, redirectUri, state);

  return jsonResponse({ url: oauthUrl, state });
}

async function handleOAuthCallback(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { code, redirect_uri, site_url } = body;

    if (!code || !redirect_uri) {
      return errorResponse('code and redirect_uri are required', 400);
    }

    const clientId = (env as any).GOOGLE_CLIENT_ID;
    const clientSecret = (env as any).GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return errorResponse('Google OAuth not configured', 500);
    }

    const result = await exchangeCodeForTokens(
      clientId,
      clientSecret,
      code,
      redirect_uri
    );

    if (!result.success) {
      return errorResponse(result.error || 'Token exchange failed', 400);
    }

    // Store tokens
    const expiresAt = new Date(Date.now() + (result.expiresIn || 3600) * 1000).toISOString();
    
    await supabase
      .from(Tables.SETTINGS)
      .upsert({
        brand_id: brandId,
        key: 'search_console_config',
        value: {
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          expires_at: expiresAt,
          site_url: site_url || '',
          connected_at: new Date().toISOString(),
        },
      }, { onConflict: 'brand_id,key' });

    return jsonResponse({
      success: true,
      message: 'Search Console connected successfully',
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return errorResponse(error.message || 'OAuth callback failed', 500);
  }
}

async function refreshToken(
  env: Env,
  supabase: any,
  brandId: string
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    
    if (!config) {
      return errorResponse('Search Console not connected or token refresh failed', 400);
    }

    return jsonResponse({ success: true, message: 'Token refreshed' });
  } catch (error: any) {
    return errorResponse(error.message || 'Token refresh failed', 500);
  }
}

// ============================================
// Performance Routes
// ============================================

async function getPerformance(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28');
    const { startDate, endDate } = formatDateRange(days);

    const client = createSearchConsoleClient(config);
    const result = await client.getDailyPerformance(startDate, endDate);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to get performance', 500);
    }

    // Calculate totals
    const totals = (result.data || []).reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
      }),
      { clicks: 0, impressions: 0 }
    );

    const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const avgPosition = result.data && result.data.length > 0
      ? result.data.reduce((sum, row) => sum + row.position, 0) / result.data.length
      : 0;

    return jsonResponse({
      data: result.data,
      totals: {
        ...totals,
        ctr: avgCtr,
        position: avgPosition,
      },
      meta: { startDate, endDate, days },
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to get performance', 500);
  }
}

async function getTopQueries(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const { startDate, endDate } = formatDateRange(days);

    const client = createSearchConsoleClient(config);
    const result = await client.getTopQueries(startDate, endDate, limit);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to get queries', 500);
    }

    return jsonResponse({
      data: result.data,
      meta: { startDate, endDate, days, limit },
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to get queries', 500);
  }
}

async function getTopPages(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const { startDate, endDate } = formatDateRange(days);

    const client = createSearchConsoleClient(config);
    const result = await client.getTopPages(startDate, endDate, limit);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to get pages', 500);
    }

    return jsonResponse({
      data: result.data,
      meta: { startDate, endDate, days, limit },
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to get pages', 500);
  }
}

async function getByDevice(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28');
    const { startDate, endDate } = formatDateRange(days);

    const client = createSearchConsoleClient(config);
    const result = await client.getPerformanceByDevice(startDate, endDate);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to get device data', 500);
    }

    return jsonResponse({
      data: result.data,
      meta: { startDate, endDate, days },
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to get device data', 500);
  }
}

async function getByCountry(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '28');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const { startDate, endDate } = formatDateRange(days);

    const client = createSearchConsoleClient(config);
    const result = await client.getPerformanceByCountry(startDate, endDate, limit);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to get country data', 500);
    }

    return jsonResponse({
      data: result.data,
      meta: { startDate, endDate, days, limit },
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to get country data', 500);
  }
}

// ============================================
// URL Inspection Routes
// ============================================

async function inspectUrl(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const body = await request.json() as any;
    const { url: pageUrl } = body;

    if (!pageUrl) {
      return errorResponse('url is required', 400);
    }

    const client = createSearchConsoleClient(config);
    const result = await client.inspectUrl(pageUrl);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to inspect URL', 500);
    }

    return jsonResponse({ data: result.data });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to inspect URL', 500);
  }
}

async function batchInspectUrls(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const body = await request.json() as any;
    const { urls } = body;

    if (!Array.isArray(urls) || urls.length === 0) {
      return errorResponse('urls array is required', 400);
    }

    if (urls.length > 20) {
      return errorResponse('Maximum 20 URLs per batch', 400);
    }

    const client = createSearchConsoleClient(config);
    const result = await client.batchInspectUrls(urls);

    return jsonResponse({
      success: result.success,
      results: result.results,
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to batch inspect URLs', 500);
  }
}

// ============================================
// Sitemap Routes
// ============================================

async function listSitemaps(
  env: Env,
  supabase: any,
  brandId: string
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const client = createSearchConsoleClient(config);
    const result = await client.listSitemaps();

    if (!result.success) {
      return errorResponse(result.error || 'Failed to list sitemaps', 500);
    }

    return jsonResponse({ data: result.data || [] });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to list sitemaps', 500);
  }
}

async function submitSitemap(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const body = await request.json() as any;
    const { sitemap_url } = body;

    if (!sitemap_url) {
      return errorResponse('sitemap_url is required', 400);
    }

    const client = createSearchConsoleClient(config);
    const result = await client.submitSitemap(sitemap_url);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to submit sitemap', 500);
    }

    return jsonResponse({ success: true, message: 'Sitemap submitted' });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to submit sitemap', 500);
  }
}

async function deleteSitemap(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const url = new URL(request.url);
    const sitemapUrl = url.searchParams.get('sitemap_url');

    if (!sitemapUrl) {
      return errorResponse('sitemap_url parameter is required', 400);
    }

    const client = createSearchConsoleClient(config);
    const result = await client.deleteSitemap(sitemapUrl);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to delete sitemap', 500);
    }

    return jsonResponse({ success: true, message: 'Sitemap deleted' });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to delete sitemap', 500);
  }
}

// ============================================
// Sites Routes
// ============================================

async function listSites(
  env: Env,
  supabase: any,
  brandId: string
): Promise<Response> {
  try {
    const config = await getConfig(env, supabase, brandId);
    if (!config) {
      return errorResponse('Search Console not connected', 400);
    }

    const client = createSearchConsoleClient(config);
    const result = await client.listSites();

    if (!result.success) {
      return errorResponse(result.error || 'Failed to list sites', 500);
    }

    return jsonResponse({ data: result.data || [] });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to list sites', 500);
  }
}

async function getConnectionStatus(
  supabase: any,
  brandId: string
): Promise<Response> {
  try {
    const { data: settings } = await supabase
      .from(Tables.SETTINGS)
      .select('value')
      .eq('brand_id', brandId)
      .eq('key', 'search_console_config')
      .single();

    if (!settings?.value) {
      return jsonResponse({
        connected: false,
        message: 'Search Console not connected',
      });
    }

    const config = settings.value;
    const isExpired = config.expires_at && new Date(config.expires_at) < new Date();

    return jsonResponse({
      connected: true,
      site_url: config.site_url,
      connected_at: config.connected_at,
      token_expired: isExpired,
    });
  } catch (error: any) {
    return errorResponse(error.message || 'Failed to get status', 500);
  }
}
