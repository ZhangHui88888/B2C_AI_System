import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { errorResponse, jsonResponse } from '../utils/response';

function normalizeHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '');
}

function getHostFromRequest(request: Request): string {
  const headerHost = request.headers.get('host');
  if (headerHost) return normalizeHost(headerHost);

  try {
    return normalizeHost(new URL(request.url).host);
  } catch {
    return '';
  }
}

function isLocalhost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
}

async function findActiveBrandIdByHost(env: Env, rawHost: string): Promise<string | null> {
  const supabase = getSupabase(env);
  const host = normalizeHost(rawHost);
  if (!host) return null;

  const domainsToTry = [host];
  if (host.startsWith('api.')) domainsToTry.push(host.slice(4));

  const { data: domainRows, error: domainError } = await supabase
    .from(Tables.BRAND_DOMAINS)
    .select('brand_id')
    .in('domain', domainsToTry)
    .limit(1);

  if (!domainError) {
    const brandId = (domainRows as any[])?.[0]?.brand_id;
    if (typeof brandId === 'string' && brandId) {
      const { data: brandRow } = await supabase
        .from(Tables.BRANDS)
        .select('id')
        .eq('id', brandId)
        .eq('is_active', true)
        .limit(1);

      const activeId = (brandRow as any[])?.[0]?.id;
      if (typeof activeId === 'string' && activeId) return activeId;
    }
  }

  const { data: legacyRows, error: legacyError } = await supabase
    .from(Tables.BRANDS)
    .select('id')
    .in('domain', domainsToTry)
    .eq('is_active', true)
    .limit(1);

  if (!legacyError) {
    const legacyId = (legacyRows as any[])?.[0]?.id;
    if (typeof legacyId === 'string' && legacyId) return legacyId;
  }

  const isProd = env.ENVIRONMENT === 'production';
  if (!isProd && isLocalhost(host)) {
    if (env.DEFAULT_BRAND_SLUG) {
      const { data: slugRows, error: slugError } = await supabase
        .from(Tables.BRANDS)
        .select('id')
        .eq('slug', env.DEFAULT_BRAND_SLUG)
        .eq('is_active', true)
        .limit(1);

      if (!slugError) {
        const slugId = (slugRows as any[])?.[0]?.id;
        if (typeof slugId === 'string' && slugId) return slugId;
      }
    }

    const { data: firstRows, error: firstError } = await supabase
      .from(Tables.BRANDS)
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!firstError) {
      const firstId = (firstRows as any[])?.[0]?.id;
      if (typeof firstId === 'string' && firstId) return firstId;
    }
  }

  return null;
}

export async function handleSiteConfig(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;

  if (url.pathname !== '/api/site-config' || method !== 'GET') {
    return errorResponse('Not found', 404);
  }

  const hostParam = url.searchParams.get('host');
  const host = hostParam ? normalizeHost(hostParam) : getHostFromRequest(request);
  if (!host) return errorResponse('Missing host', 400);

  const brandId = await findActiveBrandIdByHost(env, host);
  if (!brandId) return errorResponse('Site not found', 404);

  const supabase = getSupabase(env);
  const { data: brand, error } = await supabase
    .from(Tables.BRANDS)
    .select('id, name, slug, logo_url, favicon_url, theme, custom_css, social_links, contact_info, is_active')
    .eq('id', brandId)
    .eq('is_active', true)
    .single();

  if (error || !brand) return errorResponse('Site not found', 404);

  return jsonResponse({
    brand,
  });
}
