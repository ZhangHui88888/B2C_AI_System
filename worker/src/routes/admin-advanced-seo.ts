/**
 * Admin Advanced SEO / Analysis API routes
 * Secure (JWT + brand access) wrapper around advanced SEO & analysis tools.
 */

import type { Env } from '../index';
import { errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandAdminAccess, requireBrandManageAccess } from '../middleware/admin-auth';
import { validateCronSecret } from '../utils/cron';

import { handleKeywords } from './keywords';
import { handleEeat } from './eeat';
import { handleIndexStatus } from './index-status';
import { handleSeoReports } from './seo-reports';
import { handleSeoLinks } from './seo-links';
import { handleRelatedContent } from './related-content';

type Delegate = (request: Request, env: Env, path: string) => Promise<Response>;

interface RouteMapping {
  prefix: string;
  delegate: Delegate;
  mapPath: (path: string) => string;
}

const ROUTES: RouteMapping[] = [
  {
    prefix: '/api/admin/keywords',
    delegate: handleKeywords,
    mapPath: (p) => p.replace(/^\/api\/admin\/keywords/, '/api/keywords'),
  },
  {
    prefix: '/api/admin/eeat',
    delegate: handleEeat,
    mapPath: (p) => p.replace(/^\/api\/admin\/eeat/, '/api/eeat'),
  },
  {
    prefix: '/api/admin/index-status',
    delegate: handleIndexStatus,
    mapPath: (p) => p.replace(/^\/api\/admin\/index-status/, '/api/index-status'),
  },
  {
    prefix: '/api/admin/seo-reports',
    delegate: handleSeoReports,
    mapPath: (p) => p.replace(/^\/api\/admin\/seo-reports/, '/api/seo-reports'),
  },
  {
    prefix: '/api/admin/seo/links',
    delegate: handleSeoLinks,
    mapPath: (p) => p.replace(/^\/api\/admin\/seo\/links/, '/api/seo/links'),
  },
  {
    prefix: '/api/admin/related-content',
    delegate: handleRelatedContent,
    mapPath: (p) => p.replace(/^\/api\/admin\/related-content/, '/api/related-content'),
  },
];

function findRoute(path: string): RouteMapping | null {
  for (const r of ROUTES) {
    if (path.startsWith(r.prefix)) return r;
  }
  return null;
}

export async function handleAdminAdvancedSeo(request: Request, env: Env, path: string): Promise<Response> {
  const route = findRoute(path);
  if (!route) return errorResponse('Not found', 404);

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  const brandId = getBrandId(request);
  if (!brandId || brandId === 'all') {
    return errorResponse('Brand context missing', 400);
  }

  const access = await requireBrandManageAccess(env, admin, brandId);
  if (!access.ok) return access.response;

  const isWriteMethod = request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS';
  if (isWriteMethod) {
    const adminAccess = await requireBrandAdminAccess(env, admin, brandId);
    if (!adminAccess.ok) return adminAccess.response;
  }

  const mappedPath = route.mapPath(path);
  return await route.delegate(request, env, mappedPath);
}

export function isAdvancedSeoPublicPath(path: string): boolean {
  return (
    path.startsWith('/api/keywords') ||
    path.startsWith('/api/eeat') ||
    path.startsWith('/api/index-status') ||
    path.startsWith('/api/seo-reports') ||
    path.startsWith('/api/related-content') ||
    path.startsWith('/api/seo/links')
  );
}

export function isAllowedSeoReportsCronPath(path: string, method: string): boolean {
  return path === '/api/seo-reports/run-scheduled' && method === 'POST';
}

export { validateCronSecret };
