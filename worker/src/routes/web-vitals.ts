/**
 * Web Vitals API routes
 * Core Web Vitals monitoring: LCP, FID, CLS, INP, TTFB
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

const Tables = {
  WEB_VITALS: 'web_vitals',
  WEB_VITALS_AGGREGATES: 'web_vitals_aggregates',
  WEB_VITALS_ALERTS: 'web_vitals_alerts',
};

// Google's Core Web Vitals thresholds
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  inp: { good: 200, poor: 500 },
  ttfb: { good: 800, poor: 1800 },
};

function getRating(metric: string, value: number): string {
  const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
  if (!threshold) return 'unknown';
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

export async function handleWebVitals(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // POST /api/vitals - Record vitals measurement
  if (request.method === 'POST' && path === '/api/vitals') {
    return await recordVitals(supabase, brandId, request);
  }

  // POST /api/vitals/batch - Record multiple measurements
  if (request.method === 'POST' && path === '/api/vitals/batch') {
    return await recordVitalsBatch(supabase, brandId, request);
  }

  // GET /api/vitals/overview - Dashboard overview
  if (request.method === 'GET' && path === '/api/vitals/overview') {
    return await getVitalsOverview(supabase, brandId, request);
  }

  // GET /api/vitals/history - Historical data
  if (request.method === 'GET' && path === '/api/vitals/history') {
    return await getVitalsHistory(supabase, brandId, request);
  }

  // GET /api/vitals/pages - Per-page breakdown
  if (request.method === 'GET' && path === '/api/vitals/pages') {
    return await getVitalsByPage(supabase, brandId, request);
  }

  // GET /api/vitals/alerts - Performance alerts
  if (request.method === 'GET' && path === '/api/vitals/alerts') {
    return await getAlerts(supabase, brandId, request);
  }

  // PUT /api/vitals/alerts/:id/acknowledge - Acknowledge alert
  if (request.method === 'PUT' && path.match(/^\/api\/vitals\/alerts\/[^/]+\/acknowledge$/)) {
    const id = path.replace('/api/vitals/alerts/', '').replace('/acknowledge', '');
    return await acknowledgeAlert(supabase, brandId, id);
  }

  // PUT /api/vitals/alerts/:id/resolve - Resolve alert
  if (request.method === 'PUT' && path.match(/^\/api\/vitals\/alerts\/[^/]+\/resolve$/)) {
    const id = path.replace('/api/vitals/alerts/', '').replace('/resolve', '');
    return await resolveAlert(supabase, brandId, id);
  }

  // POST /api/vitals/aggregate - Trigger aggregation (cron)
  if (request.method === 'POST' && path === '/api/vitals/aggregate') {
    return await aggregateVitals(supabase, brandId);
  }

  return errorResponse('Not found', 404);
}

// ============================================
// RECORDING FUNCTIONS
// ============================================

async function recordVitals(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      page_url,
      page_path,
      page_type,
      lcp,
      fid,
      cls,
      inp,
      ttfb,
      fcp,
      device_type,
      connection_type,
      effective_type,
      user_agent,
      browser_name,
      browser_version,
      os_name,
      session_id,
    } = body;

    if (!page_url) {
      return errorResponse('page_url is required', 400);
    }

    const vitalsData: any = {
      brand_id: brandId,
      page_url,
      page_path: page_path || new URL(page_url).pathname,
      page_type: page_type || 'other',
      device_type,
      connection_type,
      effective_type,
      user_agent,
      browser_name,
      browser_version,
      os_name,
      session_id,
    };

    // Add metrics with ratings
    if (lcp !== undefined) {
      vitalsData.lcp = lcp;
      vitalsData.lcp_rating = getRating('lcp', lcp);
    }
    if (fid !== undefined) {
      vitalsData.fid = fid;
      vitalsData.fid_rating = getRating('fid', fid);
    }
    if (cls !== undefined) {
      vitalsData.cls = cls;
      vitalsData.cls_rating = getRating('cls', cls);
    }
    if (inp !== undefined) {
      vitalsData.inp = inp;
      vitalsData.inp_rating = getRating('inp', inp);
    }
    if (ttfb !== undefined) {
      vitalsData.ttfb = ttfb;
    }
    if (fcp !== undefined) {
      vitalsData.fcp = fcp;
    }

    const { data, error } = await supabase
      .from(Tables.WEB_VITALS)
      .insert(vitalsData)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data }, 201);
  } catch (error: any) {
    console.error('Record vitals error:', error);
    return errorResponse(error.message || 'Failed to record vitals', 500);
  }
}

async function recordVitalsBatch(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { measurements } = body;

    if (!Array.isArray(measurements) || measurements.length === 0) {
      return errorResponse('measurements array is required', 400);
    }

    const vitalsData = measurements.map((m: any) => {
      const data: any = {
        brand_id: brandId,
        page_url: m.page_url,
        page_path: m.page_path || (m.page_url ? new URL(m.page_url).pathname : null),
        page_type: m.page_type || 'other',
        device_type: m.device_type,
        connection_type: m.connection_type,
        session_id: m.session_id,
      };

      if (m.lcp !== undefined) {
        data.lcp = m.lcp;
        data.lcp_rating = getRating('lcp', m.lcp);
      }
      if (m.fid !== undefined) {
        data.fid = m.fid;
        data.fid_rating = getRating('fid', m.fid);
      }
      if (m.cls !== undefined) {
        data.cls = m.cls;
        data.cls_rating = getRating('cls', m.cls);
      }
      if (m.inp !== undefined) {
        data.inp = m.inp;
        data.inp_rating = getRating('inp', m.inp);
      }
      if (m.ttfb !== undefined) data.ttfb = m.ttfb;
      if (m.fcp !== undefined) data.fcp = m.fcp;

      return data;
    });

    const { data, error } = await supabase
      .from(Tables.WEB_VITALS)
      .insert(vitalsData)
      .select();

    if (error) throw error;
    return jsonResponse({ success: true, count: data?.length || 0 }, 201);
  } catch (error: any) {
    console.error('Record vitals batch error:', error);
    return errorResponse(error.message || 'Failed to record vitals', 500);
  }
}

// ============================================
// QUERY FUNCTIONS
// ============================================

async function getVitalsOverview(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const deviceType = url.searchParams.get('device');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get aggregated data
    let query = supabase
      .from(Tables.WEB_VITALS_AGGREGATES)
      .select('*')
      .eq('brand_id', brandId)
      .gte('date', startDate.toISOString().split('T')[0])
      .is('page_path', null); // Site-wide aggregates

    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }

    const { data: aggregates, error } = await query.order('date', { ascending: false });
    if (error) throw error;

    // Calculate overall metrics
    const totals = {
      lcp_p75: 0,
      fid_p75: 0,
      cls_p75: 0,
      inp_p75: 0,
      ttfb_p75: 0,
      sample_count: 0,
    };

    if (aggregates && aggregates.length > 0) {
      const latest = aggregates[0];
      totals.lcp_p75 = latest.lcp_p75 || 0;
      totals.fid_p75 = latest.fid_p75 || 0;
      totals.cls_p75 = latest.cls_p75 || 0;
      totals.inp_p75 = latest.inp_p75 || 0;
      totals.ttfb_p75 = latest.ttfb_p75 || 0;
      totals.sample_count = aggregates.reduce((sum: number, a: any) => sum + (a.sample_count || 0), 0);
    }

    // Get pass rates
    const passRates = {
      lcp: getRating('lcp', totals.lcp_p75),
      fid: getRating('fid', totals.fid_p75),
      cls: getRating('cls', totals.cls_p75),
      inp: getRating('inp', totals.inp_p75),
    };

    // Count passing metrics
    const passingCount = Object.values(passRates).filter(r => r === 'good').length;

    return jsonResponse({
      data: {
        metrics: totals,
        ratings: passRates,
        passing: passingCount,
        total: 4,
        score: (passingCount / 4) * 100,
        history: aggregates,
      },
      meta: { days, device: deviceType },
    });
  } catch (error: any) {
    console.error('Get vitals overview error:', error);
    return errorResponse(error.message || 'Failed to get overview', 500);
  }
}

async function getVitalsHistory(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const metric = url.searchParams.get('metric') || 'lcp';
    const pagePath = url.searchParams.get('page');
    const deviceType = url.searchParams.get('device');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from(Tables.WEB_VITALS_AGGREGATES)
      .select('date, lcp_p75, fid_p75, cls_p75, inp_p75, ttfb_p75, sample_count, lcp_good_pct, fid_good_pct, cls_good_pct, inp_good_pct')
      .eq('brand_id', brandId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (pagePath) {
      query = query.eq('page_path', pagePath);
    } else {
      query = query.is('page_path', null);
    }

    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }

    const { data, error } = await query;
    if (error) throw error;

    return jsonResponse({
      data: data || [],
      thresholds: THRESHOLDS,
      meta: { days, metric, page: pagePath, device: deviceType },
    });
  } catch (error: any) {
    console.error('Get vitals history error:', error);
    return errorResponse(error.message || 'Failed to get history', 500);
  }
}

async function getVitalsByPage(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    const deviceType = url.searchParams.get('device');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from(Tables.WEB_VITALS_AGGREGATES)
      .select('page_path, page_type, lcp_p75, fid_p75, cls_p75, inp_p75, sample_count, lcp_good_pct, cls_good_pct')
      .eq('brand_id', brandId)
      .gte('date', startDate.toISOString().split('T')[0])
      .not('page_path', 'is', null)
      .order('sample_count', { ascending: false })
      .limit(limit);

    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Add ratings to each page
    const pagesWithRatings = (data || []).map((page: any) => ({
      ...page,
      lcp_rating: getRating('lcp', page.lcp_p75),
      fid_rating: getRating('fid', page.fid_p75),
      cls_rating: getRating('cls', page.cls_p75),
      inp_rating: getRating('inp', page.inp_p75),
    }));

    return jsonResponse({
      data: pagesWithRatings,
      thresholds: THRESHOLDS,
      meta: { days, device: deviceType },
    });
  } catch (error: any) {
    console.error('Get vitals by page error:', error);
    return errorResponse(error.message || 'Failed to get pages', 500);
  }
}

// ============================================
// ALERTS FUNCTIONS
// ============================================

async function getAlerts(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'active';

    let query = supabase
      .from(Tables.WEB_VITALS_ALERTS)
      .select('*')
      .eq('brand_id', brandId)
      .order('triggered_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query.limit(50);
    if (error) throw error;

    return jsonResponse({ data: data || [] });
  } catch (error: any) {
    console.error('Get alerts error:', error);
    return errorResponse(error.message || 'Failed to get alerts', 500);
  }
}

async function acknowledgeAlert(supabase: any, brandId: string, id: string): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from(Tables.WEB_VITALS_ALERTS)
      .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
      .eq('brand_id', brandId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Acknowledge alert error:', error);
    return errorResponse(error.message || 'Failed to acknowledge alert', 500);
  }
}

async function resolveAlert(supabase: any, brandId: string, id: string): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from(Tables.WEB_VITALS_ALERTS)
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('brand_id', brandId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Resolve alert error:', error);
    return errorResponse(error.message || 'Failed to resolve alert', 500);
  }
}

// ============================================
// AGGREGATION FUNCTION
// ============================================

async function aggregateVitals(supabase: any, brandId: string): Promise<Response> {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const { data, error } = await supabase.rpc('aggregate_daily_vitals', {
      p_brand_id: brandId,
      p_date: dateStr,
    });

    if (error) throw error;
    return jsonResponse({ success: true, aggregated: data });
  } catch (error: any) {
    console.error('Aggregate vitals error:', error);
    return errorResponse(error.message || 'Failed to aggregate vitals', 500);
  }
}
