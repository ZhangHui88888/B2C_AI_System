/**
 * Marketing & Tracking API routes
 * UTM tracking, abandoned carts, pixel events
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { sendResendEmail } from '../utils/email';

// Table names
const Tables = {
  UTM_TRACKING: 'utm_tracking',
  ABANDONED_CARTS: 'abandoned_carts',
  PIXEL_EVENTS: 'pixel_events',
  EMAIL_SUBSCRIPTIONS: 'email_subscriptions',
  TRACKING_PIXELS_CONFIG: 'tracking_pixels_config',
  CUSTOMERS: 'customers',
  ORDERS: 'orders',
  PRODUCTS: 'products',
};

interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export async function handleTracking(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // ============================================
  // UTM TRACKING ENDPOINTS
  // ============================================

  // POST /api/tracking/utm - Record UTM parameters
  if (request.method === 'POST' && path === '/api/tracking/utm') {
    return await recordUTM(supabase, brandId, request);
  }

  // GET /api/tracking/utm/:sessionId - Get UTM data for session
  if (request.method === 'GET' && path.startsWith('/api/tracking/utm/')) {
    const sessionId = path.replace('/api/tracking/utm/', '');
    return await getUTMBySession(supabase, brandId, sessionId);
  }

  // PUT /api/tracking/utm/:sessionId/convert - Mark UTM as converted
  if (request.method === 'PUT' && path.match(/\/api\/tracking\/utm\/[^/]+\/convert$/)) {
    const sessionId = path.replace('/api/tracking/utm/', '').replace('/convert', '');
    return await markUTMConverted(supabase, brandId, sessionId, request);
  }

  // ============================================
  // ABANDONED CART ENDPOINTS
  // ============================================

  // POST /api/tracking/cart - Update/create cart
  if (request.method === 'POST' && path === '/api/tracking/cart') {
    return await updateCart(supabase, brandId, request);
  }

  // GET /api/tracking/cart/:sessionId - Get cart by session
  if (request.method === 'GET' && path.startsWith('/api/tracking/cart/')) {
    const sessionId = path.replace('/api/tracking/cart/', '');
    return await getCart(supabase, brandId, sessionId);
  }

  // POST /api/tracking/cart/recover - Mark cart as recovered
  if (request.method === 'POST' && path === '/api/tracking/cart/recover') {
    return await recoverCart(supabase, brandId, request);
  }

  // GET /api/tracking/abandoned - Get abandoned carts (admin)
  if (request.method === 'GET' && path === '/api/tracking/abandoned') {
    return await getAbandonedCarts(supabase, brandId, request);
  }

  // POST /api/tracking/abandoned/send-recovery - Send recovery emails
  if (request.method === 'POST' && path === '/api/tracking/abandoned/send-recovery') {
    return await sendRecoveryEmails(supabase, brandId, env, request);
  }

  // ============================================
  // PIXEL EVENTS ENDPOINTS
  // ============================================

  // POST /api/tracking/pixel - Record pixel event
  if (request.method === 'POST' && path === '/api/tracking/pixel') {
    return await recordPixelEvent(supabase, brandId, request);
  }

  // GET /api/tracking/pixels/config - Get pixel configuration
  if (request.method === 'GET' && path === '/api/tracking/pixels/config') {
    return await getPixelsConfig(supabase, brandId);
  }

  // PUT /api/tracking/pixels/config - Update pixel configuration
  if (request.method === 'PUT' && path === '/api/tracking/pixels/config') {
    return await updatePixelsConfig(supabase, brandId, request);
  }

  // ============================================
  // EMAIL SUBSCRIPTION ENDPOINTS
  // ============================================

  // GET /api/tracking/unsubscribe/:token - Unsubscribe page data
  if (request.method === 'GET' && path.startsWith('/api/tracking/unsubscribe/')) {
    const token = path.replace('/api/tracking/unsubscribe/', '');
    return await getUnsubscribeInfo(supabase, token);
  }

  // POST /api/tracking/unsubscribe - Process unsubscribe
  if (request.method === 'POST' && path === '/api/tracking/unsubscribe') {
    return await processUnsubscribe(supabase, request);
  }

  // ============================================
  // ATTRIBUTION REPORTS
  // ============================================

  // GET /api/tracking/attribution - Get attribution report
  if (request.method === 'GET' && path === '/api/tracking/attribution') {
    return await getAttributionReport(supabase, brandId, request);
  }

  return errorResponse('Not found', 404);
}

// ============================================
// UTM TRACKING FUNCTIONS
// ============================================

async function recordUTM(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      session_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      referrer,
      landing_page,
      user_agent,
      ip_country,
      device_type,
    } = body;

    if (!session_id) {
      return errorResponse('session_id is required', 400);
    }

    // Check if session already exists
    const { data: existing } = await supabase
      .from(Tables.UTM_TRACKING)
      .select('id')
      .eq('brand_id', brandId)
      .eq('session_id', session_id)
      .limit(1);

    if (existing && existing.length > 0) {
      // Update last touch
      const { data, error } = await supabase
        .from(Tables.UTM_TRACKING)
        .update({
          last_touch_at: new Date().toISOString(),
          // Update UTM if provided (last-touch attribution)
          ...(utm_source && { utm_source }),
          ...(utm_medium && { utm_medium }),
          ...(utm_campaign && { utm_campaign }),
          ...(utm_term && { utm_term }),
          ...(utm_content && { utm_content }),
        })
        .eq('id', existing[0].id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ success: true, data, updated: true });
    }

    // Create new tracking record
    const { data, error } = await supabase
      .from(Tables.UTM_TRACKING)
      .insert({
        brand_id: brandId,
        session_id,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content,
        referrer,
        landing_page,
        user_agent,
        ip_country,
        device_type,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data, created: true });
  } catch (error: any) {
    console.error('Record UTM error:', error);
    return errorResponse(error.message || 'Failed to record UTM', 500);
  }
}

async function getUTMBySession(
  supabase: any,
  brandId: string,
  sessionId: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from(Tables.UTM_TRACKING)
      .select('*')
      .eq('brand_id', brandId)
      .eq('session_id', sessionId)
      .limit(1);

    if (error) throw error;
    return jsonResponse({ data: data?.[0] || null });
  } catch (error: any) {
    console.error('Get UTM error:', error);
    return errorResponse(error.message || 'Failed to get UTM', 500);
  }
}

async function markUTMConverted(
  supabase: any,
  brandId: string,
  sessionId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { customer_id, order_id } = body;

    const { data, error } = await supabase
      .from(Tables.UTM_TRACKING)
      .update({
        customer_id,
        order_id,
        converted_at: new Date().toISOString(),
      })
      .eq('brand_id', brandId)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Mark UTM converted error:', error);
    return errorResponse(error.message || 'Failed to mark conversion', 500);
  }
}

// ============================================
// ABANDONED CART FUNCTIONS
// ============================================

async function updateCart(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      session_id,
      customer_email,
      customer_name,
      items,
      subtotal,
      currency,
      utm_tracking_id,
    } = body;

    if (!session_id) {
      return errorResponse('session_id is required', 400);
    }

    // Check if cart exists
    const { data: existing } = await supabase
      .from(Tables.ABANDONED_CARTS)
      .select('id, status')
      .eq('brand_id', brandId)
      .eq('session_id', session_id)
      .limit(1);

    const cartItems = items || [];
    const isEmpty = cartItems.length === 0;

    if (existing && existing.length > 0) {
      // Update existing cart
      const updateData: any = {
        items: cartItems,
        subtotal: subtotal || 0,
        updated_at: new Date().toISOString(),
      };

      if (customer_email) updateData.customer_email = customer_email;
      if (customer_name) updateData.customer_name = customer_name;
      if (currency) updateData.currency = currency;
      if (utm_tracking_id) updateData.utm_tracking_id = utm_tracking_id;

      // If cart was abandoned but now has activity, mark as active
      if (existing[0].status === 'abandoned' && !isEmpty) {
        updateData.status = 'active';
        updateData.abandoned_at = null;
      }

      const { data, error } = await supabase
        .from(Tables.ABANDONED_CARTS)
        .update(updateData)
        .eq('id', existing[0].id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ success: true, data, updated: true });
    }

    // Create new cart
    const { data, error } = await supabase
      .from(Tables.ABANDONED_CARTS)
      .insert({
        brand_id: brandId,
        session_id,
        customer_email,
        customer_name,
        items: cartItems,
        subtotal: subtotal || 0,
        currency: currency || 'USD',
        utm_tracking_id,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data, created: true });
  } catch (error: any) {
    console.error('Update cart error:', error);
    return errorResponse(error.message || 'Failed to update cart', 500);
  }
}

async function getCart(
  supabase: any,
  brandId: string,
  sessionId: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from(Tables.ABANDONED_CARTS)
      .select('*')
      .eq('brand_id', brandId)
      .eq('session_id', sessionId)
      .limit(1);

    if (error) throw error;
    return jsonResponse({ data: data?.[0] || null });
  } catch (error: any) {
    console.error('Get cart error:', error);
    return errorResponse(error.message || 'Failed to get cart', 500);
  }
}

async function recoverCart(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { session_id, order_id } = body;

    if (!session_id) {
      return errorResponse('session_id is required', 400);
    }

    const { data, error } = await supabase
      .from(Tables.ABANDONED_CARTS)
      .update({
        status: 'recovered',
        recovered_order_id: order_id,
        recovered_at: new Date().toISOString(),
      })
      .eq('brand_id', brandId)
      .eq('session_id', session_id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Recover cart error:', error);
    return errorResponse(error.message || 'Failed to recover cart', 500);
  }
}

async function getAbandonedCarts(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'abandoned';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from(Tables.ABANDONED_CARTS)
      .select('*', { count: 'exact' })
      .eq('brand_id', brandId)
      .order('abandoned_at', { ascending: false, nullsFirst: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return jsonResponse({
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    console.error('Get abandoned carts error:', error);
    return errorResponse(error.message || 'Failed to get abandoned carts', 500);
  }
}

async function sendRecoveryEmails(
  supabase: any,
  brandId: string,
  env: Env,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      cart_ids,
      email_template,
      discount_code,
    } = body;

    if (!cart_ids || !Array.isArray(cart_ids) || cart_ids.length === 0) {
      return errorResponse('cart_ids array is required', 400);
    }

    // Get carts
    const { data: carts, error: cartsError } = await supabase
      .from(Tables.ABANDONED_CARTS)
      .select('*')
      .eq('brand_id', brandId)
      .in('id', cart_ids)
      .eq('status', 'abandoned');

    if (cartsError) throw cartsError;

    const results = [];
    for (const cart of carts || []) {
      if (!cart.customer_email) continue;

      // Check subscription preferences
      const { data: sub } = await supabase
        .from(Tables.EMAIL_SUBSCRIPTIONS)
        .select('abandoned_cart_emails')
        .eq('brand_id', brandId)
        .eq('email', cart.customer_email)
        .limit(1);

      if (sub && sub.length > 0 && sub[0].abandoned_cart_emails === false) {
        results.push({ cart_id: cart.id, status: 'skipped', reason: 'unsubscribed' });
        continue;
      }

      // Generate unsubscribe token if not exists
      let unsubscribeToken = '';
      const { data: existingSub } = await supabase
        .from(Tables.EMAIL_SUBSCRIPTIONS)
        .select('unsubscribe_token')
        .eq('brand_id', brandId)
        .eq('email', cart.customer_email)
        .limit(1);

      if (existingSub && existingSub.length > 0) {
        unsubscribeToken = existingSub[0].unsubscribe_token;
      } else {
        unsubscribeToken = crypto.randomUUID();
        await supabase.from(Tables.EMAIL_SUBSCRIPTIONS).insert({
          brand_id: brandId,
          email: cart.customer_email,
          unsubscribe_token: unsubscribeToken,
        });
      }

      // Build email content
      const itemsHtml = (cart.items as CartItem[])
        .map((item) => `
          <tr>
            <td style="padding: 8px 0;">
              ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover;" />` : ''}
            </td>
            <td style="padding: 8px 12px;">${item.name}</td>
            <td style="padding: 8px 12px; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px 0; text-align: right;">$${item.price.toFixed(2)}</td>
          </tr>
        `)
        .join('');

      const html = email_template || `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="margin: 0 0 16px;">You left something behind!</h2>
          <p>Hi${cart.customer_name ? ` ${cart.customer_name}` : ''},</p>
          <p>We noticed you didn't complete your purchase. Your items are still waiting for you:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="padding: 12px 0; font-weight: bold;">Subtotal:</td>
                <td style="padding: 12px 0; text-align: right; font-weight: bold;">$${cart.subtotal?.toFixed(2) || '0.00'}</td>
              </tr>
            </tfoot>
          </table>

          ${discount_code ? `
            <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 8px; font-weight: bold;">Special offer just for you!</p>
              <p style="margin: 0;">Use code <strong>${discount_code}</strong> at checkout</p>
            </div>
          ` : ''}

          <p>
            <a href="#" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Complete Your Purchase
            </a>
          </p>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            <a href="/unsubscribe/${unsubscribeToken}" style="color: #666;">Unsubscribe from cart reminder emails</a>
          </p>
        </div>
      `;

      try {
        await sendResendEmail(env, {
          to: cart.customer_email,
          subject: 'You left items in your cart!',
          html,
        });

        // Update cart status
        await supabase
          .from(Tables.ABANDONED_CARTS)
          .update({
            status: 'email_sent',
            recovery_email_count: (cart.recovery_email_count || 0) + 1,
            last_email_sent_at: new Date().toISOString(),
          })
          .eq('id', cart.id);

        results.push({ cart_id: cart.id, status: 'sent' });
      } catch (emailError: any) {
        results.push({ cart_id: cart.id, status: 'failed', error: emailError.message });
      }
    }

    return jsonResponse({ success: true, results });
  } catch (error: any) {
    console.error('Send recovery emails error:', error);
    return errorResponse(error.message || 'Failed to send recovery emails', 500);
  }
}

// ============================================
// PIXEL EVENTS FUNCTIONS
// ============================================

async function recordPixelEvent(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      platform,
      event_name,
      custom_event_name,
      event_id,
      session_id,
      external_id,
      user_email,
      user_phone,
      user_ip,
      user_agent,
      event_data,
      currency,
      value,
      content_ids,
      content_type,
      num_items,
      order_id,
    } = body;

    if (!platform || !event_name) {
      return errorResponse('platform and event_name are required', 400);
    }

    // Hash user data for privacy
    const hashData = async (data: string | undefined) => {
      if (!data) return null;
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data.toLowerCase().trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const user_email_hash = await hashData(user_email);
    const user_phone_hash = await hashData(user_phone);

    const { data, error } = await supabase
      .from(Tables.PIXEL_EVENTS)
      .insert({
        brand_id: brandId,
        platform,
        event_name,
        custom_event_name,
        event_id: event_id || crypto.randomUUID(),
        session_id,
        external_id,
        user_email_hash,
        user_phone_hash,
        user_ip,
        user_agent,
        event_data: event_data || {},
        currency,
        value,
        content_ids,
        content_type,
        num_items,
        order_id,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Record pixel event error:', error);
    return errorResponse(error.message || 'Failed to record pixel event', 500);
  }
}

async function getPixelsConfig(
  supabase: any,
  brandId: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from(Tables.TRACKING_PIXELS_CONFIG)
      .select('*')
      .eq('brand_id', brandId)
      .limit(1);

    if (error) throw error;

    // Return config without sensitive tokens
    const config = data?.[0] || null;
    if (config) {
      // Mask access tokens
      if (config.facebook_access_token) {
        config.facebook_access_token = '***configured***';
      }
      if (config.tiktok_access_token) {
        config.tiktok_access_token = '***configured***';
      }
      if (config.pinterest_access_token) {
        config.pinterest_access_token = '***configured***';
      }
    }

    return jsonResponse({ data: config });
  } catch (error: any) {
    console.error('Get pixels config error:', error);
    return errorResponse(error.message || 'Failed to get pixels config', 500);
  }
}

async function updatePixelsConfig(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;

    // Check if config exists
    const { data: existing } = await supabase
      .from(Tables.TRACKING_PIXELS_CONFIG)
      .select('id')
      .eq('brand_id', brandId)
      .limit(1);

    const configData = {
      ...body,
      brand_id: brandId,
    };

    // Don't overwrite tokens with masked values
    if (configData.facebook_access_token === '***configured***') {
      delete configData.facebook_access_token;
    }
    if (configData.tiktok_access_token === '***configured***') {
      delete configData.tiktok_access_token;
    }
    if (configData.pinterest_access_token === '***configured***') {
      delete configData.pinterest_access_token;
    }

    let data, error;
    if (existing && existing.length > 0) {
      ({ data, error } = await supabase
        .from(Tables.TRACKING_PIXELS_CONFIG)
        .update(configData)
        .eq('id', existing[0].id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from(Tables.TRACKING_PIXELS_CONFIG)
        .insert(configData)
        .select()
        .single());
    }

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Update pixels config error:', error);
    return errorResponse(error.message || 'Failed to update pixels config', 500);
  }
}

// ============================================
// EMAIL SUBSCRIPTION FUNCTIONS
// ============================================

async function getUnsubscribeInfo(
  supabase: any,
  token: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from(Tables.EMAIL_SUBSCRIPTIONS)
      .select('email, marketing_emails, abandoned_cart_emails, order_updates, unsubscribed_at')
      .eq('unsubscribe_token', token)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      return errorResponse('Invalid unsubscribe link', 404);
    }

    return jsonResponse({ data: data[0] });
  } catch (error: any) {
    console.error('Get unsubscribe info error:', error);
    return errorResponse(error.message || 'Failed to get subscription info', 500);
  }
}

async function processUnsubscribe(
  supabase: any,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      token,
      marketing_emails,
      abandoned_cart_emails,
      order_updates,
      unsubscribe_all,
      reason,
    } = body;

    if (!token) {
      return errorResponse('token is required', 400);
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (unsubscribe_all) {
      updateData.marketing_emails = false;
      updateData.abandoned_cart_emails = false;
      updateData.unsubscribed_at = new Date().toISOString();
      updateData.unsubscribe_reason = reason;
    } else {
      if (typeof marketing_emails === 'boolean') updateData.marketing_emails = marketing_emails;
      if (typeof abandoned_cart_emails === 'boolean') updateData.abandoned_cart_emails = abandoned_cart_emails;
      if (typeof order_updates === 'boolean') updateData.order_updates = order_updates;
    }

    const { data, error } = await supabase
      .from(Tables.EMAIL_SUBSCRIPTIONS)
      .update(updateData)
      .eq('unsubscribe_token', token)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Process unsubscribe error:', error);
    return errorResponse(error.message || 'Failed to process unsubscribe', 500);
  }
}

// ============================================
// ATTRIBUTION REPORT FUNCTIONS
// ============================================

async function getAttributionReport(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const groupBy = url.searchParams.get('group_by') || 'source'; // source, medium, campaign

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get converted UTM data with order info
    const { data: utmData, error } = await supabase
      .from(Tables.UTM_TRACKING)
      .select(`
        utm_source,
        utm_medium,
        utm_campaign,
        converted_at,
        order_id
      `)
      .eq('brand_id', brandId)
      .gte('created_at', startDate.toISOString())
      .not('order_id', 'is', null);

    if (error) throw error;

    // Get order totals
    const orderIds = (utmData || []).map((u: any) => u.order_id).filter(Boolean);
    let orderTotals: Record<string, number> = {};

    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from(Tables.ORDERS)
        .select('id, total')
        .in('id', orderIds);

      orderTotals = (orders || []).reduce((acc: Record<string, number>, o: any) => {
        acc[o.id] = parseFloat(o.total) || 0;
        return acc;
      }, {});
    }

    // Aggregate by group
    const aggregated: Record<string, { conversions: number; revenue: number }> = {};

    for (const utm of utmData || []) {
      let key = '';
      switch (groupBy) {
        case 'medium':
          key = utm.utm_medium || '(direct)';
          break;
        case 'campaign':
          key = utm.utm_campaign || '(none)';
          break;
        default:
          key = utm.utm_source || '(direct)';
      }

      if (!aggregated[key]) {
        aggregated[key] = { conversions: 0, revenue: 0 };
      }

      aggregated[key].conversions++;
      aggregated[key].revenue += orderTotals[utm.order_id] || 0;
    }

    // Convert to array and sort by revenue
    const report = Object.entries(aggregated)
      .map(([name, stats]) => ({
        [groupBy]: name,
        conversions: stats.conversions,
        revenue: stats.revenue,
        avg_order_value: stats.conversions > 0 ? stats.revenue / stats.conversions : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate totals
    const totals = report.reduce(
      (acc, row) => ({
        conversions: acc.conversions + row.conversions,
        revenue: acc.revenue + row.revenue,
      }),
      { conversions: 0, revenue: 0 }
    );

    return jsonResponse({
      data: report,
      totals: {
        ...totals,
        avg_order_value: totals.conversions > 0 ? totals.revenue / totals.conversions : 0,
      },
      meta: {
        days,
        group_by: groupBy,
        start_date: startDate.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Get attribution report error:', error);
    return errorResponse(error.message || 'Failed to get attribution report', 500);
  }
}
