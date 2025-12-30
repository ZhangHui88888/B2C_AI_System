/**
 * Server-Side Conversions API Routes
 * Handle server-side pixel events for Facebook, Google, TikTok, Pinterest
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import {
  sendServerConversions,
  buildPurchaseEvent,
} from '../utils/conversions-api';

const Tables = {
  CONVERSION_EVENTS: 'conversion_events',
  TRACKING_PIXELS_CONFIG: 'tracking_pixels_config',
  ORDERS: 'orders',
};

export async function handleConversions(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // POST /api/conversions/send - Send server-side conversion event
  if (request.method === 'POST' && path === '/api/conversions/send') {
    return await sendConversionEvent(supabase, brandId, request);
  }

  // POST /api/conversions/purchase - Send purchase conversion (called after order)
  if (request.method === 'POST' && path === '/api/conversions/purchase') {
    return await sendPurchaseConversion(supabase, brandId, request);
  }

  // POST /api/conversions/sync-order/:orderId - Sync order to all pixels
  if (request.method === 'POST' && path.match(/^\/api\/conversions\/sync-order\/[^/]+$/)) {
    const orderId = path.replace('/api/conversions/sync-order/', '');
    return await syncOrderConversion(supabase, brandId, orderId, request);
  }

  // GET /api/conversions/events - List sent events
  if (request.method === 'GET' && path === '/api/conversions/events') {
    return await listEvents(supabase, brandId, request);
  }

  // POST /api/conversions/retry/:eventId - Retry failed event
  if (request.method === 'POST' && path.match(/^\/api\/conversions\/retry\/[^/]+$/)) {
    const eventId = path.replace('/api/conversions/retry/', '');
    return await retryEvent(supabase, brandId, eventId, request);
  }

  return errorResponse('Not found', 404);
}

// ============================================
// Get Pixel Configuration
// ============================================

async function getPixelConfig(supabase: any, brandId: string): Promise<any> {
  const { data } = await supabase
    .from(Tables.TRACKING_PIXELS_CONFIG)
    .select('*')
    .eq('brand_id', brandId)
    .single();

  if (!data) return null;

  const config: any = {};

  // Facebook
  if (data.facebook_pixel_id && data.facebook_access_token) {
    config.facebook = {
      pixelId: data.facebook_pixel_id,
      accessToken: data.facebook_access_token,
      testEventCode: data.facebook_test_event_code,
    };
  }

  // TikTok
  if (data.tiktok_pixel_id && data.tiktok_access_token) {
    config.tiktok = {
      pixelId: data.tiktok_pixel_id,
      accessToken: data.tiktok_access_token,
    };
  }

  // Pinterest
  if (data.pinterest_tag_id && data.pinterest_access_token) {
    config.pinterest = {
      adAccountId: data.pinterest_ad_account_id,
      accessToken: data.pinterest_access_token,
    };
  }

  // Google (requires more complex OAuth setup)
  if (data.google_customer_id && data.google_conversion_action_id) {
    config.google = {
      customerId: data.google_customer_id,
      conversionActionId: data.google_conversion_action_id,
      accessToken: data.google_access_token,
    };
  }

  return config;
}

// ============================================
// Send Generic Conversion Event
// ============================================

async function sendConversionEvent(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      event_name,
      event_id,
      event_source_url,
      user_data,
      custom_data,
      platforms, // Optional: ['facebook', 'tiktok', 'pinterest']
    } = body;

    if (!event_name) {
      return errorResponse('event_name is required', 400);
    }

    // Get pixel configuration
    const pixelConfig = await getPixelConfig(supabase, brandId);
    if (!pixelConfig || Object.keys(pixelConfig).length === 0) {
      return errorResponse('No pixel configurations found', 400);
    }

    // Filter by requested platforms if specified
    const activeConfig: any = {};
    if (platforms && Array.isArray(platforms)) {
      for (const platform of platforms) {
        if (pixelConfig[platform]) {
          activeConfig[platform] = pixelConfig[platform];
        }
      }
    } else {
      Object.assign(activeConfig, pixelConfig);
    }

    // Build event
    const event = {
      eventName: event_name,
      eventTime: Math.floor(Date.now() / 1000),
      eventId: event_id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventSourceUrl: event_source_url || request.headers.get('referer'),
      actionSource: 'website' as const,
      userData: {
        email: user_data?.email,
        phone: user_data?.phone,
        firstName: user_data?.first_name,
        lastName: user_data?.last_name,
        externalId: user_data?.external_id,
        clientIpAddress: request.headers.get('cf-connecting-ip') || undefined,
        clientUserAgent: request.headers.get('user-agent') || undefined,
        fbc: user_data?.fbc,
        fbp: user_data?.fbp,
      },
      customData: custom_data
        ? {
            value: custom_data.value,
            currency: custom_data.currency,
            contentName: custom_data.content_name,
            contentCategory: custom_data.content_category,
            contentIds: custom_data.content_ids,
            contentType: custom_data.content_type,
            numItems: custom_data.num_items,
            orderId: custom_data.order_id,
            searchString: custom_data.search_string,
          }
        : undefined,
    };

    // Send to all configured platforms
    const results = await sendServerConversions(activeConfig, event);

    // Log event
    await supabase.from(Tables.CONVERSION_EVENTS).insert({
      brand_id: brandId,
      event_name: event_name,
      event_id: event.eventId,
      event_data: { user_data, custom_data },
      platforms_sent: Object.keys(activeConfig),
      results,
      ip_address: request.headers.get('cf-connecting-ip'),
      user_agent: request.headers.get('user-agent'),
    });

    // Check for failures
    const failures = Object.entries(results)
      .filter(([_, r]) => !r.success)
      .map(([platform, r]) => ({ platform, error: r.error }));

    return jsonResponse({
      success: failures.length === 0,
      event_id: event.eventId,
      results,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (error: any) {
    console.error('Send conversion event error:', error);
    return errorResponse(error.message || 'Failed to send conversion', 500);
  }
}

// ============================================
// Send Purchase Conversion (from checkout)
// ============================================

async function sendPurchaseConversion(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      order_id,
      total,
      currency,
      items,
      customer_email,
      customer_phone,
      customer_name,
      fbc,
      fbp,
    } = body;

    if (!order_id || !total || !customer_email) {
      return errorResponse('order_id, total, and customer_email are required', 400);
    }

    // Get pixel configuration
    const pixelConfig = await getPixelConfig(supabase, brandId);
    if (!pixelConfig || Object.keys(pixelConfig).length === 0) {
      return jsonResponse({ success: true, message: 'No pixel configurations' });
    }

    // Build purchase event
    const orderData = {
      id: order_id,
      total,
      currency: currency || 'USD',
      items: items || [],
      customer_email,
      customer_phone,
      customer_name,
    };

    const event = buildPurchaseEvent(orderData, request);

    // Add Facebook cookies if provided
    if (fbc) event.userData.fbc = fbc;
    if (fbp) event.userData.fbp = fbp;

    // Send to all configured platforms
    const results = await sendServerConversions(pixelConfig, event);

    // Log event
    await supabase.from(Tables.CONVERSION_EVENTS).insert({
      brand_id: brandId,
      event_name: 'Purchase',
      event_id: order_id,
      event_data: { order: orderData },
      platforms_sent: Object.keys(pixelConfig),
      results,
      ip_address: request.headers.get('cf-connecting-ip'),
      user_agent: request.headers.get('user-agent'),
    });

    return jsonResponse({
      success: true,
      event_id: order_id,
      results,
    });
  } catch (error: any) {
    console.error('Send purchase conversion error:', error);
    return errorResponse(error.message || 'Failed to send purchase conversion', 500);
  }
}

// ============================================
// Sync Order to All Pixels (admin action)
// ============================================

async function syncOrderConversion(
  supabase: any,
  brandId: string,
  orderId: string,
  request: Request
): Promise<Response> {
  try {
    // Get order details
    const { data: order, error: orderError } = await supabase
      .from(Tables.ORDERS)
      .select('*')
      .eq('id', orderId)
      .eq('brand_id', brandId)
      .single();

    if (orderError || !order) {
      return errorResponse('Order not found', 404);
    }

    const rawItems = Array.isArray(order.items) ? order.items : [];
    const items = rawItems
      .map((item: any) => ({
        product_id: item?.product_id || item?.productId || item?.id,
        quantity: item?.quantity ?? item?.qty ?? 1,
        price: item?.price ?? item?.item_price ?? item?.unit_price ?? 0,
        name: item?.name || item?.title,
      }))
      .filter((i: any) => typeof i.product_id === 'string' && i.product_id.length > 0);

    // Get pixel configuration
    const pixelConfig = await getPixelConfig(supabase, brandId);
    if (!pixelConfig || Object.keys(pixelConfig).length === 0) {
      return errorResponse('No pixel configurations found', 400);
    }

    // Build purchase event
    const orderData = {
      id: order.id,
      total: order.total,
      currency: order.currency || 'USD',
      items: items || [],
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      customer_name: order.customer_name,
      created_at: order.created_at,
    };

    const event = buildPurchaseEvent(orderData, request);

    // Send to all configured platforms
    const results = await sendServerConversions(pixelConfig, event);

    // Log event
    await supabase.from(Tables.CONVERSION_EVENTS).insert({
      brand_id: brandId,
      event_name: 'Purchase',
      event_id: orderId,
      event_data: { order: orderData, synced: true },
      platforms_sent: Object.keys(pixelConfig),
      results,
      ip_address: request.headers.get('cf-connecting-ip'),
      user_agent: request.headers.get('user-agent'),
    });

    return jsonResponse({
      success: true,
      order_id: orderId,
      results,
    });
  } catch (error: any) {
    console.error('Sync order conversion error:', error);
    return errorResponse(error.message || 'Failed to sync order', 500);
  }
}

// ============================================
// List Sent Events
// ============================================

async function listEvents(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const eventName = url.searchParams.get('event_name');

    let query = supabase
      .from(Tables.CONVERSION_EVENTS)
      .select('*', { count: 'exact' })
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (eventName) {
      query = query.eq('event_name', eventName);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return jsonResponse({
      data,
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: any) {
    console.error('List events error:', error);
    return errorResponse(error.message || 'Failed to list events', 500);
  }
}

// ============================================
// Retry Failed Event
// ============================================

async function retryEvent(
  supabase: any,
  brandId: string,
  eventId: string,
  request: Request
): Promise<Response> {
  try {
    // Get original event
    const { data: event, error } = await supabase
      .from(Tables.CONVERSION_EVENTS)
      .select('*')
      .eq('id', eventId)
      .eq('brand_id', brandId)
      .single();

    if (error || !event) {
      return errorResponse('Event not found', 404);
    }

    // Get pixel configuration
    const pixelConfig = await getPixelConfig(supabase, brandId);
    if (!pixelConfig) {
      return errorResponse('No pixel configurations found', 400);
    }

    // Determine which platforms failed
    const failedPlatforms = Object.entries(event.results || {})
      .filter(([_, r]: [string, any]) => !r.success)
      .map(([platform]) => platform);

    if (failedPlatforms.length === 0) {
      return jsonResponse({ success: true, message: 'No failed platforms to retry' });
    }

    // Rebuild event
    const eventData = event.event_data || {};
    const retryConfig: any = {};
    for (const platform of failedPlatforms) {
      if (pixelConfig[platform]) {
        retryConfig[platform] = pixelConfig[platform];
      }
    }

    // Build conversion event from stored data
    const conversionEvent = {
      eventName: event.event_name,
      eventTime: Math.floor(new Date(event.created_at).getTime() / 1000),
      eventId: event.event_id,
      actionSource: 'website' as const,
      userData: eventData.user_data || eventData.order
        ? {
            email: eventData.user_data?.email || eventData.order?.customer_email,
            phone: eventData.user_data?.phone || eventData.order?.customer_phone,
            clientIpAddress: event.ip_address,
            clientUserAgent: event.user_agent,
          }
        : {},
      customData: eventData.custom_data || eventData.order
        ? {
            value: eventData.custom_data?.value || eventData.order?.total,
            currency: eventData.custom_data?.currency || eventData.order?.currency,
            orderId: eventData.custom_data?.order_id || eventData.order?.id,
          }
        : undefined,
    };

    // Retry sending
    const results = await sendServerConversions(retryConfig, conversionEvent);

    // Update event record
    const updatedResults = { ...event.results, ...results };
    await supabase
      .from(Tables.CONVERSION_EVENTS)
      .update({
        results: updatedResults,
        retry_count: (event.retry_count || 0) + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq('brand_id', brandId)
      .eq('id', eventId);

    return jsonResponse({
      success: true,
      event_id: eventId,
      retried_platforms: failedPlatforms,
      results,
    });
  } catch (error: any) {
    console.error('Retry event error:', error);
    return errorResponse(error.message || 'Failed to retry event', 500);
  }
}
