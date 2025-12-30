/**
 * Order and Cart API routes
 * Placeholder - to be fully implemented in Step 3.2
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import Stripe from 'stripe';

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

interface CreateOrderPayload {
  customer?: {
    email?: string;
    name?: string;
    phone?: string;
  };
  shippingAddress?: Record<string, JsonValue>;
  items?: Array<{
    productId?: string;
    quantity?: number;
    price?: number;
    name?: string;
    slug?: string;
    image?: string | null;
  }>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function amountToCents(amount: number): number {
  return Math.max(0, Math.round(amount * 100));
}

async function getSettingValue(
  supabase: any,
  brandId: string,
  key: string
): Promise<JsonValue | null> {
  const { data, error } = await supabase
    .from(Tables.SETTINGS)
    .select('value')
    .eq('brand_id', brandId)
    .eq('key', key)
    .limit(1);

  if (error) return null;
  return (data as any[])?.[0]?.value ?? null;
}

function normalizeCurrency(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  return 'usd';
}

export async function handleOrders(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
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
      .select('id, name, price, stock_status, is_active, stock_quantity')
      .eq('brand_id', brandId)
      .in('id', productIds);

    if (error) {
      return errorResponse('Failed to validate cart', 500);
    }

    const validatedItems = items.map((item: any) => {
      const product = products?.find((p: any) => p.id === item.productId);
      const requestedQty = typeof item?.quantity === 'number' ? Math.floor(item.quantity) : 0;
      const availableQty = typeof (product as any)?.stock_quantity === 'number' ? (product as any).stock_quantity : null;

      const isActive = !!(product && (product as any).is_active);
      const inStock = !!(product && (product as any).stock_status !== 'out_of_stock');
      const qtyOk = requestedQty > 0 && (availableQty === null || availableQty >= requestedQty);

      return {
        ...item,
        valid: !!(isActive && inStock && qtyOk),
        currentPrice: (product as any)?.price ?? item.price,
        stockStatus: (product as any)?.stock_status ?? 'unknown',
        stockQuantity: availableQty,
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
    const body = (await request.json().catch(() => ({}))) as CreateOrderPayload;
    const customerEmail = typeof body?.customer?.email === 'string' ? body.customer.email.trim() : '';
    const customerName = typeof body?.customer?.name === 'string' ? body.customer.name.trim() : '';
    const customerPhone = typeof body?.customer?.phone === 'string' ? body.customer.phone.trim() : '';
    const shippingAddress = body?.shippingAddress && typeof body.shippingAddress === 'object' ? body.shippingAddress : null;

    const items = Array.isArray(body?.items) ? body.items : [];

    if (!customerEmail || !customerName || !shippingAddress) {
      return errorResponse('Missing required checkout fields', 400);
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse('Cart is empty', 400);
    }

    const normalizedItems = items
      .map((item) => {
        const productId = typeof item?.productId === 'string' ? item.productId : '';
        const quantity = typeof item?.quantity === 'number' ? item.quantity : 0;
        return {
          productId,
          quantity: Number.isFinite(quantity) ? Math.floor(quantity) : 0,
        };
      })
      .filter((i) => i.productId && i.quantity > 0);

    if (normalizedItems.length === 0) {
      return errorResponse('Cart is empty', 400);
    }

    const productIds = normalizedItems.map((i) => i.productId);
    const { data: productRows, error: productError } = await supabase
      .from(Tables.PRODUCTS)
      .select('id, name, price, stock_status, is_active, stock_quantity')
      .eq('brand_id', brandId)
      .in('id', productIds);

    if (productError) {
      console.error('Failed to load products for order:', productError);
      return errorResponse('Failed to create order', 500);
    }

    const products = (productRows || []) as any[];

    const orderItems = [] as any[];
    let subtotalCents = 0;

    for (const item of normalizedItems) {
      const product = products.find((p) => p.id === item.productId);
      const stockQuantity = typeof (product as any)?.stock_quantity === 'number' ? (product as any).stock_quantity : null;
      const stockOk = stockQuantity === null || stockQuantity >= item.quantity;

      if (!product || !product.is_active || product.stock_status === 'out_of_stock' || !stockOk) {
        return errorResponse('Some items are no longer available', 400);
      }

      const unitPrice = toNumber(product.price);
      if (unitPrice === null) {
        return errorResponse('Invalid product pricing', 500);
      }

      const unitPriceCents = amountToCents(unitPrice);
      const lineTotalCents = unitPriceCents * item.quantity;
      subtotalCents += lineTotalCents;

      orderItems.push({
        product_id: product.id,
        name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        line_total: lineTotalCents / 100,
      });
    }

    const currencySetting = await getSettingValue(supabase, brandId, 'currency');
    const currency = normalizeCurrency(currencySetting);

    const defaultShippingCostSetting = await getSettingValue(supabase, brandId, 'shipping_default_cost');
    const freeThresholdSetting = await getSettingValue(supabase, brandId, 'shipping_free_threshold');

    const defaultShippingCost = toNumber(defaultShippingCostSetting) ?? 0;
    const freeThreshold = toNumber(freeThresholdSetting) ?? 0;

    const subtotal = subtotalCents / 100;
    const shippingCost = subtotal >= freeThreshold ? 0 : defaultShippingCost;
    const shippingCents = amountToCents(shippingCost);

    const totalCents = subtotalCents + shippingCents;
    const total = totalCents / 100;

    const { data: insertedOrder, error: insertError } = await supabase
      .from(Tables.ORDERS)
      .insert({
        brand_id: brandId,
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        shipping_address: shippingAddress,
        items: orderItems,
        subtotal,
        shipping_cost: shippingCost,
        discount_amount: 0,
        total,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !insertedOrder?.id) {
      console.error('Failed to insert order:', insertError);
      return errorResponse('Failed to create order', 500);
    }

    const orderId = insertedOrder.id as string;

    try {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency,
        receipt_email: customerEmail,
        metadata: {
          order_id: orderId,
          brand_id: brandId,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      await supabase
        .from(Tables.ORDERS)
        .update({ payment_intent_id: paymentIntent.id })
        .eq('brand_id', brandId)
        .eq('id', orderId);

      return jsonResponse({
        success: true,
        orderId,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (stripeError) {
      console.error('Stripe PaymentIntent creation failed:', stripeError);
      await supabase.from(Tables.ORDERS).delete().eq('brand_id', brandId).eq('id', orderId);
      return errorResponse('Failed to create payment', 500);
    }
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
