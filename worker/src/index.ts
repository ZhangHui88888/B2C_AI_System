/**
 * DTC E-commerce API - Cloudflare Worker
 * Main entry point with routing
 */

import { handleProducts } from './routes/products';
import { handleOrders } from './routes/orders';
import { handleChat } from './routes/chat';
import { handleCategories } from './routes/categories';
import { cors, errorHandler, jsonResponse } from './utils/response';
import { resolveBrandContext, withBrandRequest } from './middleware/brand';

export interface Env {
  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;

  DEFAULT_BRAND_SLUG?: string;
  
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

    try {
      let routedRequest = request;
      if (
        path.startsWith('/api/') &&
        path !== '/api/health' &&
        !path.startsWith('/api/stripe/webhook')
      ) {
        const { context, response } = await resolveBrandContext(request, env);
        if (response) return response;
        if (context) routedRequest = withBrandRequest(request, context.brandId);
      }

      // API Routes
      if (path.startsWith('/api/products')) {
        return await handleProducts(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/categories')) {
        return await handleCategories(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/orders') || path.startsWith('/api/cart')) {
        return await handleOrders(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/chat')) {
        return await handleChat(routedRequest, env, path);
      }
      
      if (path.startsWith('/api/stripe/webhook')) {
        // Stripe webhook - handle separately for signature verification
        return await handleStripeWebhook(request, env);
      }

      // Health check
      if (path === '/api/health') {
        return jsonResponse({ status: 'ok', environment: env.ENVIRONMENT });
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not found' }, 404);
      
    } catch (error) {
      return errorHandler(error);
    }
  },
};

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  // Placeholder - to be implemented in Step 3.2
  return jsonResponse({ received: true });
}
