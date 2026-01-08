import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { errorResponse, jsonResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandAdminAccess, requireBrandManageAccess } from '../middleware/admin-auth';
import { handleTracking } from './tracking';
import { handleMembership } from './membership';

async function forwardToPath(request: Request, nextPath: string): Promise<Request> {
  const url = new URL(request.url);
  url.pathname = nextPath;
  return new Request(url.toString(), request);
}

export async function handleAdminMarketing(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabase(env);

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  const brandId = getBrandId(request);
  if (!brandId || brandId === 'all') {
    return errorResponse('Brand context missing', 400);
  }

  const manageAccess = await requireBrandManageAccess(env, admin, brandId);
  if (!manageAccess.ok) return manageAccess.response;

  const isWriteMethod = request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS';
  if (isWriteMethod) {
    const adminAccess = await requireBrandAdminAccess(env, admin, brandId);
    if (!adminAccess.ok) return adminAccess.response;
  }

  if (path === '/api/admin/marketing/page-data' && request.method === 'GET') {
    const { count: abandonedCount, error: abandonedError } = await supabase
      .from('abandoned_carts')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'abandoned');

    if (abandonedError) return errorResponse(abandonedError.message, 500);

    const { count: recoveredCount, error: recoveredError } = await supabase
      .from('abandoned_carts')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'recovered');

    if (recoveredError) return errorResponse(recoveredError.message, 500);

    const { data: pixelConfig, error: pixelError } = await supabase
      .from('tracking_pixels_config')
      .select('facebook_pixel_id, google_ads_id, tiktok_pixel_id, pinterest_tag_id')
      .eq('brand_id', brandId)
      .limit(1);

    if (pixelError) return errorResponse(pixelError.message, 500);

    const cfg = (pixelConfig as any[])?.[0] || {};
    const configuredPixels = [
      cfg.facebook_pixel_id && 'Facebook',
      cfg.google_ads_id && 'Google',
      cfg.tiktok_pixel_id && 'TikTok',
      cfg.pinterest_tag_id && 'Pinterest',
    ].filter(Boolean);

    return jsonResponse({
      success: true,
      abandonedCount: abandonedCount || 0,
      recoveredCount: recoveredCount || 0,
      configuredPixels,
    });
  }

  if (path === '/api/admin/marketing/abandoned-carts/page-data' && request.method === 'GET') {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'abandoned';
    const page = Math.max(1, Number(url.searchParams.get('page') || '1') || 1);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || '20') || 20));
    const offset = (page - 1) * limit;

    const forwardUrl = new URL(request.url);
    forwardUrl.searchParams.set('status', status);
    forwardUrl.searchParams.set('limit', String(limit));
    forwardUrl.searchParams.set('offset', String(offset));

    const forwarded = await forwardToPath(new Request(forwardUrl.toString(), request), '/api/tracking/abandoned');
    const resp = await handleTracking(forwarded, env, '/api/tracking/abandoned');
    if (!resp.ok) return resp;

    const payload = await resp.json();
    const total = Number(payload?.pagination?.total || 0);
    const totalPages = Math.ceil(total / limit);

    return jsonResponse({
      success: true,
      carts: payload?.data || [],
      pagination: {
        total,
        limit,
        offset,
        page,
        totalPages,
      },
    });
  }

  if (path === '/api/admin/marketing/abandoned-carts/send-recovery' && request.method === 'POST') {
    const forwarded = await forwardToPath(request, '/api/tracking/abandoned/send-recovery');
    return await handleTracking(forwarded, env, '/api/tracking/abandoned/send-recovery');
  }

  if (path === '/api/admin/marketing/tracking-pixels/config' && request.method === 'GET') {
    const forwarded = await forwardToPath(request, '/api/tracking/pixels/config');
    return await handleTracking(forwarded, env, '/api/tracking/pixels/config');
  }

  if (path === '/api/admin/marketing/tracking-pixels/config' && request.method === 'PUT') {
    const forwarded = await forwardToPath(request, '/api/tracking/pixels/config');
    return await handleTracking(forwarded, env, '/api/tracking/pixels/config');
  }

  if (path === '/api/admin/marketing/attribution/report' && request.method === 'GET') {
    const forwarded = await forwardToPath(request, '/api/tracking/attribution');
    return await handleTracking(forwarded, env, '/api/tracking/attribution');
  }

  if (path === '/api/admin/marketing/referrals/page-data' && request.method === 'GET') {
    const { data: config, error: configError } = await supabase
      .from('referral_config')
      .select('*')
      .eq('brand_id', brandId)
      .single();

    if (configError && configError.code !== 'PGRST116') {
      return errorResponse(configError.message, 500);
    }

    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        *,
        referrer:customers!referrals_referrer_id_fkey(email, first_name, last_name),
        referee:customers!referrals_referee_id_fkey(email, first_name, last_name)
      `)
      .eq('brand_id', brandId)
      .order('referred_at', { ascending: false })
      .limit(20);

    if (referralsError) return errorResponse(referralsError.message, 500);

    const rows = Array.isArray(referrals) ? referrals : [];
    const completed = rows.filter((r: any) => r?.status === 'completed').length;
    const pending = rows.filter((r: any) => r?.status === 'pending').length;
    const totalRevenue = rows
      .filter((r: any) => r?.status === 'completed')
      .reduce((sum: number, r: any) => sum + (Number(r?.order_amount) || 0), 0);
    const conversionRate = rows.length > 0 ? Math.round((completed / rows.length) * 100) : 0;

    return jsonResponse({
      success: true,
      config: config || null,
      referrals: rows,
      stats: {
        total: rows.length,
        completed,
        pending,
        totalRevenue,
        conversionRate,
      },
    });
  }

  if (path === '/api/admin/marketing/referrals/config' && request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return errorResponse('Invalid JSON body', 400);
    }

    const payload: any = { ...(body as any), brand_id: brandId };

    const { data, error } = await supabase
      .from('referral_config')
      .upsert(payload, { onConflict: 'brand_id' })
      .select()
      .single();

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, config: data });
  }

  if (path === '/api/admin/marketing/loyalty/page-data' && request.method === 'GET') {
    const { data: levels, error: levelsError } = await supabase
      .from('member_levels')
      .select('*')
      .eq('brand_id', brandId)
      .order('level_order');

    if (levelsError) return errorResponse(levelsError.message, 500);

    const { data: memberships, error: membershipsError } = await supabase
      .from('customer_memberships')
      .select('current_level_id, points_balance, lifetime_points')
      .eq('brand_id', brandId);

    if (membershipsError) return errorResponse(membershipsError.message, 500);

    const { data: pointsRules, error: rulesError } = await supabase
      .from('points_rules')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true);

    if (rulesError) return errorResponse(rulesError.message, 500);

    const { data: redemptions, error: redemptionsError } = await supabase
      .from('points_redemptions')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true);

    if (redemptionsError) return errorResponse(redemptionsError.message, 500);

    const safeLevels = Array.isArray(levels) ? levels : [];
    const safeMemberships = Array.isArray(memberships) ? memberships : [];

    const totalMembers = safeMemberships.length;
    const totalPointsOutstanding = safeMemberships.reduce(
      (sum: number, m: any) => sum + (typeof m?.points_balance === 'number' ? m.points_balance : Number(m?.points_balance) || 0),
      0
    );

    const levelCounts: Record<string, number> = {};
    for (const level of safeLevels) {
      const id = typeof (level as any)?.id === 'string' ? (level as any).id : '';
      if (!id) continue;
      levelCounts[id] = safeMemberships.filter((m: any) => m?.current_level_id === id).length;
    }

    return jsonResponse({
      success: true,
      levels: safeLevels,
      memberships: safeMemberships,
      pointsRules: Array.isArray(pointsRules) ? pointsRules : [],
      redemptions: Array.isArray(redemptions) ? redemptions : [],
      stats: {
        totalMembers,
        totalPointsOutstanding,
        levelCounts,
      },
    });
  }

  if (path === '/api/admin/marketing/loyalty/levels/init' && request.method === 'POST') {
    const forwarded = await forwardToPath(request, '/api/membership/levels/init');
    return await handleMembership(forwarded, env, '/api/membership/levels/init');
  }

  if (path === '/api/admin/marketing/loyalty/recalculate' && request.method === 'POST') {
    const forwarded = await forwardToPath(request, '/api/membership/recalculate');
    return await handleMembership(forwarded, env, '/api/membership/recalculate');
  }

  if (path === '/api/admin/marketing/loyalty/members' && request.method === 'GET') {
    const forwarded = await forwardToPath(request, '/api/membership/customers');
    return await handleMembership(forwarded, env, '/api/membership/customers');
  }

  return errorResponse('Not found', 404);
}
