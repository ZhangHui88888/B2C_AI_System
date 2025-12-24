import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { errorResponse } from '../utils/response';

export const BRAND_ID_HEADER = 'x-brand-id';

export interface BrandContext {
  brandId: string;
  host: string;
}

const BRAND_CACHE_TTL_SECONDS = 60 * 60;

function normalizeHost(rawHost: string): string {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '');
}

function getRequestHost(request: Request): string {
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

export function withBrandRequest(request: Request, brandId: string): Request {
  const headers = new Headers(request.headers);
  headers.set(BRAND_ID_HEADER, brandId);
  return new Request(request, { headers });
}

export function getBrandId(request: Request): string | null {
  return request.headers.get(BRAND_ID_HEADER);
}

async function getCachedBrandId(env: Env, host: string): Promise<string | null> {
  if (!env.CACHE) return null;

  const key = `brand:domain:${host}`;
  const cached = await env.CACHE.get(key);
  if (!cached) return null;

  try {
    const parsed = JSON.parse(cached) as { brandId?: string };
    return typeof parsed.brandId === 'string' && parsed.brandId ? parsed.brandId : null;
  } catch {
    return null;
  }
}

async function setCachedBrandId(env: Env, host: string, brandId: string): Promise<void> {
  if (!env.CACHE) return;

  const key = `brand:domain:${host}`;
  await env.CACHE.put(key, JSON.stringify({ brandId }), {
    expirationTtl: BRAND_CACHE_TTL_SECONDS,
  });
}

async function findBrandIdByDomain(env: Env, host: string): Promise<string | null> {
  const supabase = getSupabase(env);
  const { data, error } = await supabase
    .from(Tables.BRANDS)
    .select('id')
    .eq('domain', host)
    .eq('is_active', true)
    .limit(1);

  if (error) return null;
  const id = (data as any[])?.[0]?.id;
  return typeof id === 'string' && id ? id : null;
}

async function findDefaultBrandId(env: Env): Promise<string | null> {
  const supabase = getSupabase(env);

  if (env.DEFAULT_BRAND_SLUG) {
    const { data, error } = await supabase
      .from(Tables.BRANDS)
      .select('id')
      .eq('slug', env.DEFAULT_BRAND_SLUG)
      .eq('is_active', true)
      .limit(1);

    if (!error) {
      const id = (data as any[])?.[0]?.id;
      if (typeof id === 'string' && id) return id;
    }
  }

  const { data, error } = await supabase
    .from(Tables.BRANDS)
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) return null;
  const id = (data as any[])?.[0]?.id;
  return typeof id === 'string' && id ? id : null;
}

export async function resolveBrandContext(
  request: Request,
  env: Env
): Promise<{ context?: BrandContext; response?: Response }> {
  const host = getRequestHost(request);
  if (!host) {
    return { response: errorResponse('Missing Host header', 400) };
  }

  const cachedBrandId = await getCachedBrandId(env, host);
  if (cachedBrandId) {
    return { context: { brandId: cachedBrandId, host } };
  }

  const brandId = await findBrandIdByDomain(env, host);
  if (brandId) {
    await setCachedBrandId(env, host, brandId);
    return { context: { brandId, host } };
  }

  const isProd = env.ENVIRONMENT === 'production';
  if (!isProd && isLocalhost(host)) {
    const fallbackBrandId = await findDefaultBrandId(env);
    if (fallbackBrandId) {
      return { context: { brandId: fallbackBrandId, host } };
    }
  }

  return { response: errorResponse('Site not found', 404) };
}
