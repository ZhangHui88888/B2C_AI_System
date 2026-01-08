import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { errorResponse, jsonResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandManageAccess } from '../middleware/admin-auth';

function parseMoney(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isMissingColumn(error: any, columnName: string): boolean {
  const msg = String(error?.message || '');
  return msg.toLowerCase().includes('does not exist') && msg.includes(columnName);
}

async function fetchOrdersWithTotalField<T extends Record<string, any>>(
  build: (totalField: 'total_amount' | 'total') => PromiseLike<{ data: T[] | null; error: any }>
): Promise<{ rows: Array<T & { total_amount?: any }>; error?: any }> {
  const first = await build('total_amount');
  if (!first.error) {
    return { rows: Array.isArray(first.data) ? first.data : [] };
  }

  if (!isMissingColumn(first.error, 'total_amount')) {
    return { rows: [], error: first.error };
  }

  const fallback = await build('total');
  if (fallback.error) {
    return { rows: [], error: fallback.error };
  }

  const rows = Array.isArray(fallback.data) ? fallback.data : [];
  const normalized = rows.map((r: any) => ({ ...r, total_amount: r?.total_amount ?? r?.total }));
  return { rows: normalized };
}

function toDayKey(iso: unknown): string {
  const s = typeof iso === 'string' ? iso : '';
  return s.includes('T') ? s.split('T')[0] : s;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function handleAdminAnalytics(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabase(env);

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  const brandId = getBrandId(request);
  if (!brandId || brandId === 'all') {
    return errorResponse('Brand context missing', 400);
  }

  const access = await requireBrandManageAccess(env, admin, brandId);
  if (!access.ok) return access.response;

  if (path === '/api/admin/analytics/page-data' && request.method === 'GET') {
    const url = new URL(request.url);
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get('days') || '30') || 30));

    const today = startOfToday();
    const now = new Date();
    const rangeStart = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { rows: orders, error: ordersError } = await fetchOrdersWithTotalField((totalField) =>
      supabase
        .from(Tables.ORDERS)
        .select(`id, ${totalField}, status, created_at, items, customer_email`)
        .eq('brand_id', brandId)
        .gte('created_at', rangeStart.toISOString())
        .not('status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: true })
    );

    if (ordersError) return errorResponse(ordersError.message, 500);

    const totalRevenue = orders.reduce((sum: number, o: any) => sum + parseMoney(o?.total_amount), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const todayOrders = orders.filter((o: any) => {
      const d = new Date(o?.created_at);
      return Number.isFinite(d.getTime()) && d >= today;
    });
    const todayRevenue = todayOrders.reduce((sum: number, o: any) => sum + parseMoney(o?.total_amount), 0);

    const last7DaysOrders = orders.filter((o: any) => {
      const d = new Date(o?.created_at);
      return Number.isFinite(d.getTime()) && d >= sevenDaysAgo;
    });
    const last7DaysRevenue = last7DaysOrders.reduce((sum: number, o: any) => sum + parseMoney(o?.total_amount), 0);

    const { count: customerCount, error: customerError } = await supabase
      .from(Tables.CUSTOMERS)
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    if (customerError) return errorResponse(customerError.message, 500);

    const { count: productCount, error: productError } = await supabase
      .from(Tables.PRODUCTS)
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('is_active', true);

    if (productError) return errorResponse(productError.message, 500);

    const dailyData = new Map<string, { revenue: number; orders: number }>();
    for (const order of orders) {
      const key = toDayKey(order?.created_at);
      if (!key) continue;
      const existing = dailyData.get(key) || { revenue: 0, orders: 0 };
      existing.revenue += parseMoney(order?.total_amount);
      existing.orders += 1;
      dailyData.set(key, existing);
    }

    const cursor = new Date(rangeStart);
    while (cursor <= now) {
      const k = cursor.toISOString().split('T')[0];
      if (!dailyData.has(k)) dailyData.set(k, { revenue: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const chartData = Array.from(dailyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data }));

    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of orders) {
      const items = Array.isArray((order as any)?.items) ? (order as any).items : [];
      for (const item of items) {
        const rawId = item?.product_id || item?.productId || item?.id || 'unknown';
        const id = typeof rawId === 'string' && rawId ? rawId : 'unknown';

        const qty = typeof item?.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;
        const price = typeof item?.price === 'number' && Number.isFinite(item.price) ? item.price : 0;

        const existing = productSales.get(id) || { name: '', quantity: 0, revenue: 0 };
        existing.quantity += qty;
        existing.revenue += price * qty;
        if (typeof item?.name === 'string' && item.name) existing.name = item.name;
        productSales.set(id, existing);
      }
    }

    const topProducts = Array.from(productSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const statusCounts = orders.reduce((acc: Record<string, number>, o: any) => {
      const status = typeof o?.status === 'string' ? o.status : '';
      if (!status) return acc;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return jsonResponse({
      success: true,
      days,
      stats: {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        todayRevenue,
        todayOrders: todayOrders.length,
        last7DaysRevenue,
        last7DaysOrders: last7DaysOrders.length,
      },
      counts: {
        customerCount: customerCount || 0,
        productCount: productCount || 0,
      },
      statusCounts,
      topProducts,
      chartData,
    });
  }

  return errorResponse('Not found', 404);
}
