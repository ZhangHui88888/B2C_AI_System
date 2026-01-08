/**
 * Admin Settings API routes
 * Authenticated settings management with brand scoping
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandManageAccess, requireBrandAdminAccess } from '../middleware/admin-auth';

export async function handleAdminSettings(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  // All admin settings endpoints require authentication
  const authResult = await requireAdminAuth(request, env);
  if (authResult.response) return authResult.response;
  if (!authResult.context) return errorResponse('Auth failed', 401);
  const admin = authResult.context;

  const brandId = getBrandId(request);
  if (!brandId || brandId === 'all') {
    return errorResponse('Brand context required', 400);
  }

  const supabase = getSupabase(env);

  // GET /api/admin/settings - Get all settings for the brand
  if (request.method === 'GET' && path === '/api/admin/settings') {
    // Require at least manage access to view settings
    const accessResult = await requireBrandManageAccess(env, admin, brandId);
    if (!accessResult.ok) return accessResult.response;

    const { data, error } = await supabase
      .from(Tables.SETTINGS)
      .select('key, value')
      .eq('brand_id', brandId);

    if (error) {
      console.error('Get settings error:', error);
      return errorResponse('Failed to get settings', 500);
    }

    const settingsMap: Record<string, any> = {};
    data?.forEach((s: any) => {
      settingsMap[s.key] = s.value;
    });

    return jsonResponse({ success: true, data: settingsMap });
  }

  // POST /api/admin/settings - Update a setting
  if (request.method === 'POST' && path === '/api/admin/settings') {
    // Require admin access to modify settings
    const accessResult = await requireBrandAdminAccess(env, admin, brandId);
    if (!accessResult.ok) return accessResult.response;

    const body = (await request.json().catch(() => ({}))) as { key?: string; value?: any };

    if (!body.key || typeof body.key !== 'string') {
      return errorResponse('key is required', 400);
    }

    const { error } = await supabase
      .from(Tables.SETTINGS)
      .upsert(
        {
          brand_id: brandId,
          key: body.key,
          value: body.value,
        },
        { onConflict: 'brand_id,key' }
      );

    if (error) {
      console.error('Update setting error:', error);
      return errorResponse('Failed to update setting', 500);
    }

    return jsonResponse({ success: true, key: body.key, value: body.value });
  }

  // PUT /api/admin/settings/bulk - Bulk update settings
  if (request.method === 'PUT' && path === '/api/admin/settings/bulk') {
    const accessResult = await requireBrandAdminAccess(env, admin, brandId);
    if (!accessResult.ok) return accessResult.response;

    const body = (await request.json().catch(() => ({}))) as { settings?: Record<string, any> };

    if (!body.settings || typeof body.settings !== 'object') {
      return errorResponse('settings object is required', 400);
    }

    const entries = Object.entries(body.settings);
    const upsertData = entries.map(([key, value]) => ({
      brand_id: brandId,
      key,
      value,
    }));

    const { error } = await supabase
      .from(Tables.SETTINGS)
      .upsert(upsertData, { onConflict: 'brand_id,key' });

    if (error) {
      console.error('Bulk update settings error:', error);
      return errorResponse('Failed to update settings', 500);
    }

    return jsonResponse({ success: true, updated: entries.length });
  }

  return errorResponse('Not found', 404);
}
