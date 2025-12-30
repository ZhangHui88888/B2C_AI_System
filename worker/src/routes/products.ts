/**
 * Product API routes
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

interface ProductListParams {
  category?: string;
  page?: number;
  limit?: number;
  pageSize?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'featured' | 'best_selling';
  search?: string;
  featured?: boolean;
  price_min?: number;
  price_max?: number;
}

export async function handleProducts(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // POST /api/products/list - Get product list with filters
  if (path === '/api/products/list' && request.method === 'POST') {
    const params = (await request.json().catch(() => ({}))) as Partial<ProductListParams>;
    const { category, page = 1, limit, pageSize, sort = 'newest', search, featured, price_min, price_max } = params;
    const resolvedPageSize = typeof pageSize === 'number' ? pageSize : typeof limit === 'number' ? limit : 12;

    let categoryId: string | null = null;
    if (category) {
      const { data: categoryRows, error: categoryError } = await supabase
        .from(Tables.CATEGORIES)
        .select('id')
        .eq('brand_id', brandId)
        .eq('slug', category)
        .eq('is_active', true)
        .limit(1);

      if (categoryError) {
        console.error('Error resolving category:', categoryError);
        return errorResponse('Failed to fetch products', 500);
      }

      categoryId = (categoryRows as any[])?.[0]?.id || null;
      if (!categoryId) {
        return jsonResponse({
          success: true,
          products: [],
          pagination: {
            page,
            limit: resolvedPageSize,
            total: 0,
            totalPages: 1,
          },
          total: 0,
          page,
          pageSize: resolvedPageSize,
        });
      }
    }

    let query = supabase
      .from(Tables.PRODUCTS)
      .select('*, categories(name, slug)', { count: 'exact' })
      .eq('brand_id', brandId)
      .eq('is_active', true);

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (featured) {
      query = query.eq('is_featured', true);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (typeof price_min === 'number' && Number.isFinite(price_min)) {
      query = query.gte('price', price_min);
    }

    if (typeof price_max === 'number' && Number.isFinite(price_max)) {
      query = query.lte('price', price_max);
    }

    // Apply sorting
    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'best_selling':
      case 'featured':
        query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    const from = (page - 1) * resolvedPageSize;
    const to = from + resolvedPageSize - 1;
    query = query.range(from, to);

    const { data: products, error, count } = await query;

    if (error) {
      console.error('Error fetching products:', error);
      return errorResponse('Failed to fetch products', 500);
    }

    return jsonResponse({
      success: true,
      products,
      pagination: {
        page,
        limit: resolvedPageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / resolvedPageSize),
      },
      total: count || 0,
      page,
      pageSize: resolvedPageSize,
    });
  }

  // GET /api/products/:slug - Get single product
  if (request.method === 'GET') {
    const slug = path.replace('/api/products/', '');
    
    if (!slug) {
      return errorResponse('Product slug is required', 400);
    }

    const { data: product, error } = await supabase
      .from(Tables.PRODUCTS)
      .select('*, categories(name, slug)')
      .eq('brand_id', brandId)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      return errorResponse('Product not found', 404);
    }

    // Get related products from same category
    let relatedProducts: any[] = [];
    if (product.category_id) {
      const { data: related } = await supabase
        .from(Tables.PRODUCTS)
        .select('id, name, slug, price, compare_price, main_image_url')
        .eq('brand_id', brandId)
        .eq('category_id', product.category_id)
        .eq('is_active', true)
        .neq('id', product.id)
        .limit(4);
      
      relatedProducts = related || [];
    }

    return jsonResponse({
      success: true,
      product,
      relatedProducts,
    });
  }

  return errorResponse('Method not allowed', 405);
}
