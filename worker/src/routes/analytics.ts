/**
 * Analytics API routes
 * Sales data, trends, and reporting
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

interface DateRange {
  start: string;
  end: string;
}

export async function handleAnalytics(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // GET /api/analytics/overview - Dashboard overview stats
  if (request.method === 'GET' && path === '/api/analytics/overview') {
    return await getOverview(supabase, brandId, request);
  }

  // GET /api/analytics/sales - Sales trend data
  if (request.method === 'GET' && path === '/api/analytics/sales') {
    return await getSalesTrend(supabase, brandId, request);
  }

  // GET /api/analytics/products - Product rankings
  if (request.method === 'GET' && path === '/api/analytics/products') {
    return await getProductRankings(supabase, brandId, request);
  }

  // GET /api/analytics/customers - Customer analytics
  if (request.method === 'GET' && path === '/api/analytics/customers') {
    return await getCustomerAnalytics(supabase, brandId, request);
  }

  // GET /api/analytics/funnel - Conversion funnel
  if (request.method === 'GET' && path === '/api/analytics/funnel') {
    return await getConversionFunnel(supabase, brandId, request);
  }

  return errorResponse('Not found', 404);
}

async function getOverview(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000);

  // Current period orders
  const { data: currentOrders, error: ordersError } = await supabase
    .from(Tables.ORDERS)
    .select('total, status, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', startDate.toISOString())
    .not('status', 'in', '("cancelled","refunded")');

  if (ordersError) {
    console.error('Orders query error:', ordersError);
    return errorResponse('Failed to fetch analytics', 500);
  }

  // Previous period orders for comparison
  const { data: prevOrders } = await supabase
    .from(Tables.ORDERS)
    .select('total, status')
    .eq('brand_id', brandId)
    .gte('created_at', prevStartDate.toISOString())
    .lt('created_at', startDate.toISOString())
    .not('status', 'in', '("cancelled","refunded")');

  // Calculate current period metrics
  const currentRevenue = currentOrders?.reduce((sum: number, o: any) => sum + (parseFloat(o.total) || 0), 0) || 0;
  const currentOrderCount = currentOrders?.length || 0;
  const currentAOV = currentOrderCount > 0 ? currentRevenue / currentOrderCount : 0;

  // Calculate previous period metrics
  const prevRevenue = prevOrders?.reduce((sum: number, o: any) => sum + (parseFloat(o.total) || 0), 0) || 0;
  const prevOrderCount = prevOrders?.length || 0;
  const prevAOV = prevOrderCount > 0 ? prevRevenue / prevOrderCount : 0;

  // Calculate changes
  const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue * 100) : 0;
  const orderChange = prevOrderCount > 0 ? ((currentOrderCount - prevOrderCount) / prevOrderCount * 100) : 0;
  const aovChange = prevAOV > 0 ? ((currentAOV - prevAOV) / prevAOV * 100) : 0;

  // Get customer count
  const { count: customerCount } = await supabase
    .from(Tables.CUSTOMERS)
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId);

  // Get product count
  const { count: productCount } = await supabase
    .from(Tables.PRODUCTS)
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('is_active', true);

  // Today's stats
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const { data: todayOrders } = await supabase
    .from(Tables.ORDERS)
    .select('total')
    .eq('brand_id', brandId)
    .gte('created_at', todayStart.toISOString())
    .not('status', 'in', '("cancelled","refunded")');

  const todayRevenue = todayOrders?.reduce((sum: number, o: any) => sum + (parseFloat(o.total) || 0), 0) || 0;
  const todayOrderCount = todayOrders?.length || 0;

  return jsonResponse({
    success: true,
    data: {
      period: {
        days,
        start: startDate.toISOString(),
        end: now.toISOString(),
      },
      today: {
        revenue: todayRevenue,
        orders: todayOrderCount,
      },
      summary: {
        revenue: {
          value: currentRevenue,
          change: revenueChange,
          previous: prevRevenue,
        },
        orders: {
          value: currentOrderCount,
          change: orderChange,
          previous: prevOrderCount,
        },
        avgOrderValue: {
          value: currentAOV,
          change: aovChange,
          previous: prevAOV,
        },
        customers: customerCount || 0,
        products: productCount || 0,
      },
    },
  });
}

async function getSalesTrend(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  const granularity = url.searchParams.get('granularity') || 'day'; // day, week, month

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data: orders, error } = await supabase
    .from(Tables.ORDERS)
    .select('total, created_at, status')
    .eq('brand_id', brandId)
    .gte('created_at', startDate.toISOString())
    .not('status', 'in', '("cancelled","refunded")')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Sales trend error:', error);
    return errorResponse('Failed to fetch sales trend', 500);
  }

  // Group by date
  const groupedData = new Map<string, { revenue: number; orders: number }>();

  orders?.forEach((order: any) => {
    const date = new Date(order.created_at);
    let key: string;

    if (granularity === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else if (granularity === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      key = date.toISOString().split('T')[0];
    }

    const existing = groupedData.get(key) || { revenue: 0, orders: 0 };
    existing.revenue += parseFloat(order.total) || 0;
    existing.orders += 1;
    groupedData.set(key, existing);
  });

  // Fill in missing dates for daily view
  if (granularity === 'day') {
    const current = new Date(startDate);
    const now = new Date();
    while (current <= now) {
      const key = current.toISOString().split('T')[0];
      if (!groupedData.has(key)) {
        groupedData.set(key, { revenue: 0, orders: 0 });
      }
      current.setDate(current.getDate() + 1);
    }
  }

  // Convert to sorted array
  const trend = Array.from(groupedData.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
    }));

  return jsonResponse({
    success: true,
    data: {
      granularity,
      days,
      trend,
    },
  });
}

async function getProductRankings(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const sortBy = url.searchParams.get('sort') || 'revenue'; // revenue, quantity

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get orders with items
  const { data: orders, error } = await supabase
    .from(Tables.ORDERS)
    .select('items')
    .eq('brand_id', brandId)
    .gte('created_at', startDate.toISOString())
    .not('status', 'in', '("cancelled","refunded")');

  if (error) {
    console.error('Product rankings error:', error);
    return errorResponse('Failed to fetch product rankings', 500);
  }

  // Aggregate product sales
  const productSales = new Map<string, { quantity: number; revenue: number; name: string }>();

  orders?.forEach((order: any) => {
    const items = order.items || [];
    items.forEach((item: any) => {
      const productId = item.product_id || item.id;
      const existing = productSales.get(productId) || { quantity: 0, revenue: 0, name: item.name || '' };
      existing.quantity += item.quantity || 1;
      existing.revenue += (item.price || 0) * (item.quantity || 1);
      existing.name = item.name || existing.name;
      productSales.set(productId, existing);
    });
  });

  // Sort and limit
  const rankings = Array.from(productSales.entries())
    .map(([productId, data]) => ({
      productId,
      name: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => sortBy === 'quantity' ? b.quantity - a.quantity : b.revenue - a.revenue)
    .slice(0, limit);

  return jsonResponse({
    success: true,
    data: {
      days,
      sortBy,
      rankings,
    },
  });
}

async function getCustomerAnalytics(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get customer stats
  const { data: customers, error } = await supabase
    .from(Tables.CUSTOMERS)
    .select('total_orders, total_spent, created_at, first_order_at')
    .eq('brand_id', brandId);

  if (error) {
    console.error('Customer analytics error:', error);
    return errorResponse('Failed to fetch customer analytics', 500);
  }

  const totalCustomers = customers?.length || 0;
  const newCustomers = customers?.filter((c: any) => 
    c.created_at && new Date(c.created_at) >= startDate
  ).length || 0;
  
  const repeatCustomers = customers?.filter((c: any) => (c.total_orders || 0) > 1).length || 0;
  const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers * 100) : 0;

  // Calculate customer value tiers
  const highValue = customers?.filter((c: any) => (c.total_spent || 0) >= 500).length || 0;
  const mediumValue = customers?.filter((c: any) => {
    const spent = c.total_spent || 0;
    return spent >= 100 && spent < 500;
  }).length || 0;
  const lowValue = totalCustomers - highValue - mediumValue;

  // Average lifetime value
  const totalSpent = customers?.reduce((sum: number, c: any) => sum + (parseFloat(c.total_spent) || 0), 0) || 0;
  const avgLifetimeValue = totalCustomers > 0 ? totalSpent / totalCustomers : 0;

  return jsonResponse({
    success: true,
    data: {
      days,
      summary: {
        total: totalCustomers,
        new: newCustomers,
        repeatCustomers,
        repeatRate,
        avgLifetimeValue,
      },
      tiers: {
        high: { count: highValue, threshold: '$500+' },
        medium: { count: mediumValue, threshold: '$100-500' },
        low: { count: lowValue, threshold: '<$100' },
      },
    },
  });
}

async function getConversionFunnel(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30');

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get orders for conversion data
  const { data: orders, error } = await supabase
    .from(Tables.ORDERS)
    .select('status, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', startDate.toISOString());

  if (error) {
    console.error('Funnel error:', error);
    return errorResponse('Failed to fetch funnel data', 500);
  }

  // Calculate funnel stages
  // Note: In a real implementation, you'd track these events separately
  const totalOrders = orders?.length || 0;
  const paidOrders = orders?.filter((o: any) => 
    !['pending', 'cancelled'].includes(o.status)
  ).length || 0;
  const shippedOrders = orders?.filter((o: any) => 
    ['shipped', 'delivered'].includes(o.status)
  ).length || 0;
  const deliveredOrders = orders?.filter((o: any) => 
    o.status === 'delivered'
  ).length || 0;

  // Estimated funnel (would need proper tracking for accurate data)
  const estimatedVisitors = totalOrders * 50; // Rough estimate
  const estimatedCartAdds = totalOrders * 3;
  const estimatedCheckoutStarts = totalOrders * 1.5;

  const funnel = [
    { stage: 'Visitors', count: estimatedVisitors, rate: 100 },
    { stage: 'Add to Cart', count: estimatedCartAdds, rate: (estimatedCartAdds / estimatedVisitors * 100) || 0 },
    { stage: 'Checkout Started', count: Math.round(estimatedCheckoutStarts), rate: (estimatedCheckoutStarts / estimatedVisitors * 100) || 0 },
    { stage: 'Orders Placed', count: totalOrders, rate: (totalOrders / estimatedVisitors * 100) || 0 },
    { stage: 'Paid', count: paidOrders, rate: (paidOrders / estimatedVisitors * 100) || 0 },
    { stage: 'Delivered', count: deliveredOrders, rate: (deliveredOrders / estimatedVisitors * 100) || 0 },
  ];

  return jsonResponse({
    success: true,
    data: {
      days,
      funnel,
      conversionRate: estimatedVisitors > 0 ? (paidOrders / estimatedVisitors * 100) : 0,
      note: 'Visitor and cart data are estimates. Implement tracking for accurate metrics.',
    },
  });
}
