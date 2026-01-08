/**
 * Admin Sitemap API routes
 * Secure (JWT + brand access) wrapper around sitemap sharding tools.
 */

import type { Env } from '../index';
import { errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandManageAccess, requireBrandAdminAccess } from '../middleware/admin-auth';
import { handleSitemap } from './sitemap';

export async function handleAdminSitemap(request: Request, env: Env, path: string): Promise<Response> {
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

  const mappedPath = path.replace(/^\/api\/admin\/sitemap/, '/api/sitemap');
  return await handleSitemap(request, env, mappedPath);
}
