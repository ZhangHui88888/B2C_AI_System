import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { errorResponse, jsonResponse } from '../utils/response';
import { requireAdminAuth, requireBrandManageAccess } from '../middleware/admin-auth';
import { getBrandId } from '../middleware/brand';

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
  supabase: any,
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

async function getAccessibleBrandIds(supabase: any, admin: any): Promise<string[]> {
  if (admin.isOwner) {
    const { data, error } = await supabase
      .from(Tables.BRANDS)
      .select('id')
      .eq('is_active', true);

    if (error) return [];

    return Array.isArray(data)
      ? data.map((x: any) => x?.id).filter((x: any) => typeof x === 'string' && x)
      : [];
  }

  if (!admin.adminUserId) return [];

  const { data: assignments, error: assignmentError } = await supabase
    .from('brand_user_assignments')
    .select('brand_id')
    .eq('admin_user_id', admin.adminUserId);

  if (assignmentError) return [];

  return Array.isArray(assignments)
    ? assignments.map((x: any) => x?.brand_id).filter((x: any) => typeof x === 'string' && x)
    : [];
}

export async function handleAdminOverview(request: Request, env: Env, path: string): Promise<Response> {
  const supabase = getSupabase(env);

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  // GET /api/admin/overview/page-data - cross-brand overview
  if (path === '/api/admin/overview/page-data' && request.method === 'GET') {
    const brandIds = await getAccessibleBrandIds(supabase, admin);

    if (brandIds.length === 0) {
      return jsonResponse({
        success: true,
        totals: { orders: 0, pendingOrders: 0, revenue: 0, products: 0, customers: 0, brands: 0 },
        brandStats: [],
        recentOrders: [],
      });
    }

    const { data: brands, error: brandsError } = await supabase
      .from(Tables.BRANDS)
      .select('id, name, slug, logo_url, is_active')
      .in('id', brandIds)
      .eq('is_active', true)
      .order('name');

    if (brandsError) return errorResponse(brandsError.message, 500);

    const { rows: orderStats, error: ordersError } = await fetchOrdersWithTotalField(supabase, (totalField) =>
      supabase
        .from(Tables.ORDERS)
        .select(`brand_id, status, ${totalField}, created_at`)
        .in('brand_id', brandIds)
    );

    if (ordersError) return errorResponse(ordersError.message, 500);

    const { data: productStats, error: productsError } = await supabase
      .from(Tables.PRODUCTS)
      .select('brand_id, is_active')
      .in('brand_id', brandIds);

    if (productsError) return errorResponse(productsError.message, 500);

    const { data: customerStats, error: customersError } = await supabase
      .from(Tables.CUSTOMERS)
      .select('brand_id')
      .in('brand_id', brandIds);

    if (customersError) return errorResponse(customersError.message, 500);

    const brandsList = Array.isArray(brands) ? brands : [];
    const ordersList = Array.isArray(orderStats) ? orderStats : [];
    const productsList = Array.isArray(productStats) ? productStats : [];
    const customersList = Array.isArray(customerStats) ? customerStats : [];

    const paidStatuses = new Set(['paid', 'processing', 'shipped', 'delivered']);

    const brandStats = brandsList.map((brand: any) => {
      const orders = ordersList.filter((o: any) => o?.brand_id === brand.id);
      const products = productsList.filter((p: any) => p?.brand_id === brand.id);
      const customers = customersList.filter((c: any) => c?.brand_id === brand.id);

      const paidOrders = orders.filter((o: any) => paidStatuses.has(o?.status));
      const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + parseMoney(o?.total_amount), 0);
      const pendingOrders = orders.filter((o: any) => o?.status === 'pending').length;

      const totalOrders = orders.length;
      const totalProducts = products.length;
      const activeProducts = products.filter((p: any) => !!p?.is_active).length;
      const totalCustomers = customers.length;
      const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

      return {
        ...brand,
        totalOrders,
        pendingOrders,
        totalRevenue,
        totalProducts,
        activeProducts,
        totalCustomers,
        avgOrderValue,
      };
    });

    const totals = {
      orders: brandStats.reduce((sum: number, b: any) => sum + (b?.totalOrders || 0), 0),
      pendingOrders: brandStats.reduce((sum: number, b: any) => sum + (b?.pendingOrders || 0), 0),
      revenue: brandStats.reduce((sum: number, b: any) => sum + (b?.totalRevenue || 0), 0),
      products: brandStats.reduce((sum: number, b: any) => sum + (b?.totalProducts || 0), 0),
      customers: brandStats.reduce((sum: number, b: any) => sum + (b?.totalCustomers || 0), 0),
      brands: brandsList.length,
    };


    const { rows: recentOrdersList, error: recentError } = await fetchOrdersWithTotalField(supabase, (totalField) =>
      supabase
        .from(Tables.ORDERS)
        .select(`id, order_number, customer_email, ${totalField}, status, created_at, brand_id`)
        .in('brand_id', brandIds)
        .order('created_at', { ascending: false })
        .limit(10)
    );

    if (recentError) return errorResponse(recentError.message, 500);

    const recentOrders = recentOrdersList.map((order: any) => ({
      ...order,
      brand: brandsList.find((b: any) => b?.id === order?.brand_id) || null,
    }));

    return jsonResponse({
      success: true,
      totals,
      brandStats,
      recentOrders,
    });
  }

  // GET /api/admin/dashboard/page-data - brand-scoped dashboard
  if (path === '/api/admin/dashboard/page-data' && request.method === 'GET') {
    const brandId = getBrandId(request);
    if (!brandId || brandId === 'all') {
      return errorResponse('Brand context missing', 400);
    }

    const access = await requireBrandManageAccess(env, admin, brandId);
    if (!access.ok) return access.response;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const ordersResult = await supabase
      .from(Tables.ORDERS)
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    const productsResult = await supabase
      .from(Tables.PRODUCTS)
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    const customersResult = await supabase
      .from(Tables.CUSTOMERS)
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    const revenueResult = await fetchOrdersWithTotalField(supabase, (totalField) =>
      supabase
        .from(Tables.ORDERS)
        .select(`${totalField}`)
        .eq('brand_id', brandId)
        .gte('created_at', thirtyDaysAgo)
    );

    if (ordersResult.error) return errorResponse(ordersResult.error.message, 500);
    if (productsResult.error) return errorResponse(productsResult.error.message, 500);
    if (customersResult.error) return errorResponse(customersResult.error.message, 500);
    if (revenueResult.error) return errorResponse(revenueResult.error?.message || 'Failed to fetch revenue', 500);

    const totalRevenue = Array.isArray(revenueResult.rows)
      ? revenueResult.rows.reduce((sum: number, o: any) => sum + parseMoney(o?.total_amount), 0)
      : 0;

    const { rows: recentOrdersRaw, error: recentError } = await fetchOrdersWithTotalField(supabase, (totalField) =>
      supabase
        .from(Tables.ORDERS)
        .select(`id, ${totalField}, status, created_at, customer_email`)
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(5)
    );

    if (recentError) return errorResponse(recentError.message, 500);

    return jsonResponse({
      success: true,
      stats: {
        totalOrders: ordersResult.count || 0,
        totalProducts: productsResult.count || 0,
        totalCustomers: customersResult.count || 0,
        totalRevenue,
      },
      recentOrders: Array.isArray(recentOrdersRaw) ? recentOrdersRaw : [],
    });
  }

  return errorResponse('Not found', 404);
}
