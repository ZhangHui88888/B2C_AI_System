/**
 * DTC E-commerce API - Cloudflare Worker
 * Main entry point with routing
 */

import { handleProducts } from './routes/products';
import { handleOrders } from './routes/orders';
import { handleChat } from './routes/chat';
import { handleCategories } from './routes/categories';
import { handleKnowledge } from './routes/knowledge';
import { handleContent } from './routes/content';
import { handleSettings } from './routes/settings';
import { handleAnalytics } from './routes/analytics';
import { handleAuthors } from './routes/authors';
import { handleReviews } from './routes/reviews';
import { handleAdminProducts } from './routes/admin-products';
import { handleAdminCategories } from './routes/admin-categories';
import { handleAdminOrders } from './routes/admin-orders';
import { handleAdminCoupons, handleCouponValidation } from './routes/admin-coupons';
import { handleAdminBrands } from './routes/admin-brands';
import { handleAdminTemplates } from './routes/admin-templates';
import { handleSeo } from './routes/seo';
import { handleMonitoring } from './routes/monitoring';
import { handleTracking } from './routes/tracking';
import { handleEmailSequences } from './routes/email-sequences';
import { handleWebVitals } from './routes/web-vitals';
import { handleConversions } from './routes/conversions';
import { handleImages } from './routes/images';
import { handleSearchConsole } from './routes/search-console';
import { handleSeoLinks } from './routes/seo-links';
import { handleSitemap } from './routes/sitemap';
import { handleKeywords } from './routes/keywords';
import { handleEeat } from './routes/eeat';
import { handleIndexStatus } from './routes/index-status';
import { handleSeoReports } from './routes/seo-reports';
import { handleRelatedContent } from './routes/related-content';
import { handlePoints } from './routes/points';
import { handleMembership } from './routes/membership';
import { handleReferrals } from './routes/referrals';
import { handleSiteConfig } from './routes/site-config';
import { cors, errorHandler, jsonResponse } from './utils/response';
import { resolveBrandContext, withBrandRequest } from './middleware/brand';
import { createRequestLogger } from './utils/logger';
import { metricsCollector, createRequestMetrics } from './utils/metrics';
import Stripe from 'stripe';
import { getSupabase, Tables } from './utils/supabase';
import { sendResendEmail } from './utils/email';

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

function formatMoney(amount: unknown): string {
  const num = typeof amount === 'number' ? amount : typeof amount === 'string' ? Number(amount) : NaN;
  if (!Number.isFinite(num)) return String(amount ?? '');
  return `$${num.toFixed(2)}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOrderItemsHtml(items: unknown): string {
  const rows = Array.isArray(items) ? items : [];
  if (rows.length === 0) return '<div>No items</div>';
  const trs = rows
    .map((it: any) => {
      const name = escapeHtml(it?.name || it?.title || it?.productName || it?.product_id || it?.productId || 'Item');
      const qty = escapeHtml(it?.quantity ?? '');
      const price = escapeHtml(formatMoney(it?.unit_price ?? it?.price ?? ''));
      return `<tr><td style="padding:6px 0;">${name}</td><td style="padding:6px 12px; text-align:right;">${qty}</td><td style="padding:6px 0; text-align:right;">${price}</td></tr>`;
    })
    .join('');
  return `
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left; padding:6px 0;">Item</th>
          <th style="text-align:right; padding:6px 12px;">Qty</th>
          <th style="text-align:right; padding:6px 0;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${trs}
      </tbody>
    </table>
  `;
}

function isAllowedOrderStatusTransition(currentStatus: unknown, nextStatus: unknown): boolean {
  const from = typeof currentStatus === 'string' ? currentStatus : '';
  const to = typeof nextStatus === 'string' ? nextStatus : '';

  if (!from || !to) return false;
  if (from === to) return true;

  if (from === 'pending' && (to === 'paid' || to === 'failed' || to === 'cancelled')) return true;
  if (from === 'paid' && (to === 'shipped' || to === 'refunded')) return true;
  if (from === 'shipped' && (to === 'delivered' || to === 'refunded')) return true;
  if (from === 'delivered' && to === 'refunded') return true;

  return false;
}

async function ensureStripeEventRecord(
  supabase: any,
  event: Stripe.Event
): Promise<{ alreadyProcessed: boolean; recordExists: boolean }>{
  const payload = event as any;
  const inserted = await supabase
    .from(Tables.STRIPE_EVENTS)
    .insert({
      event_id: event.id,
      type: event.type,
      stripe_created_at: typeof (event as any).created === 'number' ? new Date((event as any).created * 1000).toISOString() : null,
      payload,
    })
    .select('event_id, processed_at')
    .single();

  if (!inserted.error && inserted.data) {
    return { alreadyProcessed: !!inserted.data.processed_at, recordExists: true };
  }

  const { data: existing, error: fetchError } = await supabase
    .from(Tables.STRIPE_EVENTS)
    .select('processed_at')
    .eq('event_id', event.id)
    .limit(1);

  if (fetchError) {
    throw fetchError;
  }

  const processedAt = (existing as any[])?.[0]?.processed_at;
  return { alreadyProcessed: !!processedAt, recordExists: true };
}

async function markStripeEventProcessed(
  supabase: any,
  eventId: string,
  payload: { processed_at?: string | null; processing_error?: string | null }
): Promise<void> {
  await supabase
    .from(Tables.STRIPE_EVENTS)
    .update({
      processed_at: payload.processed_at ?? null,
      processing_error: payload.processing_error ?? null,
    })
    .eq('event_id', eventId);
}

export interface Env {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  DEFAULT_BRAND_SLUG?: string;

  OWNER_EMAIL?: string;
  
  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  
  // DeepSeek AI
  DEEPSEEK_API_KEY: string;
  
  // Email (Resend)
  RESEND_API_KEY: string;
  NOTIFY_EMAIL: string;
  
  // Environment
  ENVIRONMENT: string;
  
  // Vectorize (optional)
  KNOWLEDGE_VECTORIZE?: VectorizeIndex;
  
  // KV (optional)
  CACHE?: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return cors();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/site-config') {
      return await handleSiteConfig(request, env);
    }

    try {
      let routedRequest = request;
      if (
        path.startsWith('/api/') &&
        path !== '/api/health' &&
        !path.startsWith('/api/stripe/webhook') &&
        !path.startsWith('/api/admin/')
      ) {
        const { context, response } = await resolveBrandContext(request, env);
        if (response) return response;
        if (context) routedRequest = withBrandRequest(request, context.brandId);
      }

      // Admin API Routes (before regular routes for more specific matching)
      if (path.startsWith('/api/admin/products')) {
        return await handleAdminProducts(routedRequest, env, path);
      }

      if (path.startsWith('/api/admin/categories')) {
        return await handleAdminCategories(routedRequest, env, path);
      }

      if (path.startsWith('/api/admin/orders')) {
        return await handleAdminOrders(routedRequest, env, path);
      }

      if (path.startsWith('/api/admin/coupons')) {
        return await handleAdminCoupons(routedRequest, env, path);
      }

      if (path.startsWith('/api/admin/brands')) {
        return await handleAdminBrands(routedRequest, env, path);
      }

      if (path.startsWith('/api/admin/templates')) {
        return await handleAdminTemplates(routedRequest, env, path);
      }

      // SEO Tools Routes
      if (path.startsWith('/api/seo')) {
        return await handleSeo(routedRequest, env, path);
      }

      // Marketing & Tracking Routes
      if (path.startsWith('/api/tracking')) {
        return await handleTracking(routedRequest, env, path);
      }

      // Email Sequences Routes
      if (path.startsWith('/api/email-sequences')) {
        return await handleEmailSequences(routedRequest, env, path);
      }

      // Web Vitals Routes
      if (path.startsWith('/api/vitals')) {
        return await handleWebVitals(routedRequest, env, path);
      }

      // Server-Side Conversions Routes
      if (path.startsWith('/api/conversions')) {
        return await handleConversions(routedRequest, env, path);
      }

      // Image Processing Routes
      if (path.startsWith('/api/images')) {
        return await handleImages(routedRequest, env, path);
      }

      // Google Search Console Routes
      if (path.startsWith('/api/search-console')) {
        return await handleSearchConsole(routedRequest, env, path);
      }

      // SEO Link Analysis Routes (Orphan pages, Link density)
      if (path.startsWith('/api/seo/links')) {
        return await handleSeoLinks(routedRequest, env, path);
      }

      // Sitemap Sharding Routes
      if (path.startsWith('/api/sitemap')) {
        return await handleSitemap(routedRequest, env, path);
      }

      // Keyword Research Routes
      if (path.startsWith('/api/keywords')) {
        return await handleKeywords(routedRequest, env, path);
      }

      // E-E-A-T Scoring Routes
      if (path.startsWith('/api/eeat')) {
        return await handleEeat(routedRequest, env, path);
      }

      // Index Status Routes
      if (path.startsWith('/api/index-status')) {
        return await handleIndexStatus(routedRequest, env, path);
      }

      // Automated SEO Reports Routes
      if (path.startsWith('/api/seo-reports')) {
        return await handleSeoReports(routedRequest, env, path);
      }

      // Related Content Recommendations Routes
      if (path.startsWith('/api/related-content')) {
        return await handleRelatedContent(routedRequest, env, path);
      }

      // Points System Routes
      if (path.startsWith('/api/points')) {
        return await handlePoints(routedRequest, env, path);
      }

      // Membership Levels Routes
      if (path.startsWith('/api/membership')) {
        return await handleMembership(routedRequest, env, path);
      }

      // Referral Program Routes
      if (path.startsWith('/api/referrals')) {
        return await handleReferrals(routedRequest, env, path);
      }

      // API Routes
      if (path.startsWith('/api/products')) {
        return await handleProducts(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/categories')) {
        return await handleCategories(routedRequest, env, path);
      }

      if (path.startsWith('/api/coupons')) {
        return await handleCouponValidation(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/orders') || path.startsWith('/api/cart')) {
        return await handleOrders(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/chat')) {
        return await handleChat(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/knowledge')) {
        return await handleKnowledge(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/content')) {
        return await handleContent(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/settings')) {
        return await handleSettings(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/analytics')) {
        return await handleAnalytics(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/authors')) {
        return await handleAuthors(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/reviews')) {
        return await handleReviews(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/stripe/webhook')) {
        // Stripe webhook - handle separately for signature verification
        return await handleStripeWebhook(request, env);
      }

      // Monitoring and health routes
      if (path === '/api/health' || path === '/api/health/detailed' || 
          path === '/api/ready' || path === '/api/live' ||
          path === '/api/metrics' || path === '/api/metrics/endpoints' ||
          path === '/api/metrics/prometheus' || path === '/api/system') {
        return await handleMonitoring(request, env, path);
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not found' }, 404);
      
    } catch (error) {
      return errorHandler(error);
    }
  },
};

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return jsonResponse({ error: 'Missing Stripe signature' }, 400);
  }

  const rawBody = await request.text();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return jsonResponse({ error: 'Invalid signature' }, 400);
  }

  const supabase = getSupabase(env);

  const cache = env.CACHE;
  const dedupeKey = cache ? `stripe:event:${event.id}` : '';
  if (cache && dedupeKey) {
    const seen = await cache.get(dedupeKey);
    if (seen) {
      return jsonResponse({ received: true, deduped: true });
    }
  }

  let alreadyProcessed = false;
  try {
    const record = await ensureStripeEventRecord(supabase, event);
    alreadyProcessed = record.alreadyProcessed;
  } catch (err) {
    console.error('Failed to ensure stripe event record:', err);
  }

  if (alreadyProcessed) {
    if (cache && dedupeKey) {
      await cache.put(dedupeKey, '1', { expirationTtl: 60 * 60 * 24 });
    }
    return jsonResponse({ received: true, deduped: true, source: 'db' });
  }

  try {
    if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const paymentIntentId = pi.id;
      const orderIdFromMetadata = typeof pi.metadata?.order_id === 'string' ? pi.metadata.order_id : '';

      const nextStatus = event.type === 'payment_intent.succeeded' ? 'paid' : 'failed';

      const orderLookup = orderIdFromMetadata
        ? { field: 'id', value: orderIdFromMetadata }
        : paymentIntentId
          ? { field: 'payment_intent_id', value: paymentIntentId }
          : null;

      if (orderLookup) {
        // @ts-expect-error - Supabase type inference is excessively deep
        const { data: orderRows, error: fetchError } = await supabase
          .from(Tables.ORDERS)
          .select('id, brand_id, status, order_number, customer_email, customer_name, total, items')
          .eq(orderLookup.field as any, orderLookup.value)
          .limit(1);

        const order = (orderRows as any[])?.[0];
        const currentStatus = order?.status;
        const resolvedOrderId = order?.id;

        const shouldTransition =
          !!resolvedOrderId &&
          typeof currentStatus === 'string' &&
          isAllowedOrderStatusTransition(currentStatus, nextStatus);

        const isAlreadyAtTarget = typeof currentStatus === 'string' && currentStatus === nextStatus;

        if (!fetchError && resolvedOrderId && (shouldTransition || isAlreadyAtTarget)) {
          if (shouldTransition && !isAlreadyAtTarget) {
            if (!isAllowedOrderStatusTransition(currentStatus, nextStatus)) {
              await markStripeEventProcessed(supabase, event.id, {
                processing_error: `Illegal status transition ${String(currentStatus)} -> ${String(nextStatus)}`,
                processed_at: new Date().toISOString(),
              });
            } else {
              await supabase.from(Tables.ORDERS).update({ status: nextStatus }).eq('id', resolvedOrderId);

              if (nextStatus === 'paid') {
                const brandId = order?.brand_id;
                if (typeof brandId === 'string') {
                  const { data: ok, error: rpcError } = await supabase.rpc('decrement_order_items_stock', {
                    p_brand_id: brandId,
                    p_items: order?.items,
                  });

                  if (rpcError || ok === false) {
                    console.error('Failed to decrement stock:', rpcError);
                  }
                }

                const emailDedupeKey = cache ? `order:paid_email:${resolvedOrderId}` : '';
                let shouldSendEmail = true;
                if (cache && emailDedupeKey) {
                  const sent = await cache.get(emailDedupeKey);
                  shouldSendEmail = !sent;
                }

                if (shouldSendEmail) {
                  const to = typeof order?.customer_email === 'string' ? order.customer_email : '';
                  const subject = `Order confirmed${order?.order_number ? ` (${order.order_number})` : ''}`;
                  const html = `
                    <div style="font-family:Inter,Arial,sans-serif; line-height:1.5;">
                      <h2 style="margin:0 0 12px;">Thanks for your order${order?.customer_name ? `, ${escapeHtml(order.customer_name)}` : ''}!</h2>
                      <div style="margin:0 0 8px;">Order ID: <strong>${escapeHtml(resolvedOrderId)}</strong></div>
                      ${order?.order_number ? `<div style="margin:0 0 8px;">Order number: <strong>${escapeHtml(order.order_number)}</strong></div>` : ''}
                      <div style="margin:0 0 16px;">Total: <strong>${escapeHtml(formatMoney(order?.total))}</strong></div>
                      <div style="margin:16px 0 8px; font-weight:600;">Items</div>
                      ${renderOrderItemsHtml(order?.items)}
                      <div style="margin-top:16px; color:#666; font-size:12px;">If you have questions, reply to this email.</div>
                    </div>
                  `;

                  await sendResendEmail(env, {
                    to,
                    subject,
                    html,
                    bcc: env.NOTIFY_EMAIL,
                  });

                  if (cache && emailDedupeKey) {
                    await cache.put(emailDedupeKey, '1', { expirationTtl: 60 * 60 * 24 * 7 });
                  }
                }
              }
            }
          }

          await markStripeEventProcessed(supabase, event.id, {
            processed_at: new Date().toISOString(),
            processing_error: null,
          });
        } else if (!fetchError && !resolvedOrderId) {
          await markStripeEventProcessed(supabase, event.id, {
            processed_at: new Date().toISOString(),
            processing_error: 'Order not found for payment_intent',
          });
        } else if (fetchError) {
          throw fetchError;
        } else if (!shouldTransition && !isAlreadyAtTarget) {
          await markStripeEventProcessed(supabase, event.id, {
            processed_at: new Date().toISOString(),
            processing_error: `No allowed transition from ${String(currentStatus)} to ${String(nextStatus)}`,
          });
        }
      } else {
        await markStripeEventProcessed(supabase, event.id, {
          processed_at: new Date().toISOString(),
          processing_error: 'Missing order lookup metadata for payment_intent',
        });
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : '';
      if (paymentIntentId) {
        const { data: orderRow, error: fetchError } = await supabase
          .from(Tables.ORDERS)
          .select('id, status')
          .eq('payment_intent_id', paymentIntentId)
          .limit(1);

        const resolvedOrderId = (orderRow as any[])?.[0]?.id;
        const currentStatus = (orderRow as any[])?.[0]?.status;
        if (!fetchError && resolvedOrderId) {
          if (typeof currentStatus === 'string' && isAllowedOrderStatusTransition(currentStatus, 'refunded')) {
            await supabase.from(Tables.ORDERS).update({ status: 'refunded' }).eq('id', resolvedOrderId);
          }
          await markStripeEventProcessed(supabase, event.id, {
            processed_at: new Date().toISOString(),
            processing_error: null,
          });
        }
      }
    }

    if (
      event.type !== 'payment_intent.succeeded' &&
      event.type !== 'payment_intent.payment_failed' &&
      event.type !== 'charge.refunded'
    ) {
      await markStripeEventProcessed(supabase, event.id, {
        processed_at: new Date().toISOString(),
        processing_error: null,
      });
    }
  } catch (err) {
    console.error('Stripe webhook processing failed:', err);
    try {
      await markStripeEventProcessed(supabase, event.id, {
        processed_at: null,
        processing_error: String((err as any)?.message || err),
      });
    } catch (markError) {
      console.error('Failed to mark stripe event error:', markError);
    }
    return jsonResponse({ error: 'Webhook processing failed' }, 500);
  }

  if (cache && dedupeKey) {
    await cache.put(dedupeKey, '1', { expirationTtl: 60 * 60 * 24 });
  }

  return jsonResponse({ received: true });
}
