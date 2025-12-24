/**
 * Settings API routes
 * CRUD operations for brand settings
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

export async function handleSettings(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // GET /api/settings - Get all settings
  if (request.method === 'GET' && path === '/api/settings') {
    return await getSettings(supabase, brandId);
  }

  // POST /api/settings - Update a setting
  if (request.method === 'POST' && path === '/api/settings') {
    return await updateSetting(supabase, brandId, request);
  }

  // GET /api/settings/:key - Get specific setting
  if (request.method === 'GET' && path.startsWith('/api/settings/')) {
    const key = path.replace('/api/settings/', '');
    return await getSetting(supabase, brandId, key);
  }

  return errorResponse('Not found', 404);
}

async function getSettings(supabase: any, brandId: string): Promise<Response> {
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

async function getSetting(
  supabase: any,
  brandId: string,
  key: string
): Promise<Response> {
  const { data, error } = await supabase
    .from(Tables.SETTINGS)
    .select('value')
    .eq('brand_id', brandId)
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Get setting error:', error);
    return errorResponse('Failed to get setting', 500);
  }

  return jsonResponse({ success: true, key, value: data?.value ?? null });
}

async function updateSetting(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { key?: string; value?: any };

  if (!body.key || typeof body.key !== 'string') {
    return errorResponse('key is required', 400);
  }

  // Upsert the setting
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
