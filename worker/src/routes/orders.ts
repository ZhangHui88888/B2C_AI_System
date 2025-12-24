/**
 * Order and Cart API routes
 * Placeholder - to be fully implemented in Step 3.2
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

export async function handleOrders(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // POST /api/cart/validate - Validate cart items
  if (path === '/api/cart/validate' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as any;
    const items = Array.isArray(body?.items) ? body.items : [];
    
    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse('Cart is empty', 400);
    }

    const productIds = items.map((item: any) => item.productId);
    
    const { data: products, error } = await supabase
      .from(Tables.PRODUCTS)
      .select('id, name, price, stock_status, is_active')
      .eq('brand_id', brandId)
      .in('id', productIds);

    if (error) {
      return errorResponse('Failed to validate cart', 500);
    }

    const validatedItems = items.map((item: any) => {
      const product = products?.find(p => p.id === item.productId);
      return {
        ...item,
        valid: !!(product && product.is_active && product.stock_status !== 'out_of_stock'),
        currentPrice: product?.price || item.price,
        stockStatus: product?.stock_status || 'unknown',
      };
    });

    const allValid = validatedItems.every((item: any) => item.valid);

    return jsonResponse({
      success: true,
      valid: allValid,
      items: validatedItems,
    });
  }

  // POST /api/orders/create - Create order
  if (path === '/api/orders/create' && request.method === 'POST') {
    // Placeholder - full implementation in Step 3.2
    return jsonResponse({
      success: false,
      error: 'Order creation not yet implemented',
    }, 501);
  }

  // GET /api/orders/:id - Get order details
  if (path.startsWith('/api/orders/') && request.method === 'GET') {
    const orderId = path.replace('/api/orders/', '').split('?')[0];
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!orderId || !email) {
      return errorResponse('Order ID and email are required', 400);
    }

    const { data: order, error } = await supabase
      .from(Tables.ORDERS)
      .select('*')
      .eq('brand_id', brandId)
      .eq('id', orderId)
      .eq('customer_email', email)
      .single();

    if (error || !order) {
      return errorResponse('Order not found', 404);
    }

    return jsonResponse({
      success: true,
      order,
    });
  }

  return errorResponse('Method not allowed', 405);
}
