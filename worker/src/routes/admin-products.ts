/**
 * Admin Product API routes
 * CRUD operations for product management
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandManageAccess } from '../middleware/admin-auth';

interface ProductInput {
  brand_id: string;
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  price: number;
  compare_price?: number | null;
  cost?: number | null;
  main_image_url?: string | null;
  images?: string[];
  category_id?: string | null;
  supplier_info?: Record<string, unknown>;
  shipping_weight?: number | null;
  shipping_time?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  stock_quantity?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
}

export async function handleAdminProducts(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  const brandId = getBrandId(request);
  if (!brandId || brandId === 'all') {
    return errorResponse('Brand context missing', 400);
  }

  const access = await requireBrandManageAccess(env, admin, brandId);
  if (!access.ok) return access.response;

  // GET /api/admin/products - List products (admin view, includes inactive)
  if (path === '/api/admin/products' && request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
      const offset = (page - 1) * limit;

      const { data: products, error, count } = await supabase
        .from(Tables.PRODUCTS)
        .select('id, brand_id, name, slug, price, compare_price, is_active, is_featured, stock_quantity, created_at, images', {
          count: 'exact',
        })
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error listing products:', error);
        return errorResponse('Failed to fetch products', 500);
      }

      const total = count || 0;
      return jsonResponse({
        success: true,
        products: products || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      console.error('Error in list products:', err);
      return errorResponse('Failed to fetch products', 500);
    }
  }

  // POST /api/admin/products - Create product
  if (path === '/api/admin/products' && request.method === 'POST') {
    try {
      const input = (await request.json()) as ProductInput;

      // Validate required fields
      if (!input.name || !input.slug || typeof input.price !== 'number') {
        return errorResponse('Missing required fields: name, slug, price', 400);
      }

      // Check for duplicate slug
      const { data: existing } = await supabase
        .from(Tables.PRODUCTS)
        .select('id')
        .eq('brand_id', brandId)
        .eq('slug', input.slug)
        .limit(1);

      if (existing && existing.length > 0) {
        return errorResponse('A product with this slug already exists', 400);
      }

      // Prepare product data
      const productData = {
        brand_id: brandId,
        name: input.name,
        slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: input.description || null,
        short_description: input.short_description || null,
        price: input.price,
        compare_price: input.compare_price || null,
        cost: input.cost || null,
        main_image_url: input.main_image_url || null,
        images: input.images || [],
        category_id: input.category_id || null,
        supplier_info: input.supplier_info || {},
        shipping_weight: input.shipping_weight || null,
        shipping_time: input.shipping_time || null,
        is_active: input.is_active !== false,
        is_featured: input.is_featured === true,
        stock_status: input.stock_status || 'in_stock',
        stock_quantity: input.stock_quantity ?? null,
        seo_title: input.seo_title || null,
        seo_description: input.seo_description || null,
      };

      const { data: product, error } = await supabase
        .from(Tables.PRODUCTS)
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.error('Error creating product:', error);
        return errorResponse(error.message || 'Failed to create product', 500);
      }

      return jsonResponse({
        success: true,
        product,
      });
    } catch (err) {
      console.error('Error in create product:', err);
      return errorResponse('Failed to create product', 500);
    }
  }

  // PUT /api/admin/products/:id - Update product
  if (path.startsWith('/api/admin/products/') && request.method === 'PUT') {
    const id = path.replace('/api/admin/products/', '');
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    try {
      const input = (await request.json()) as Partial<ProductInput> & { id: string };

      // Check product exists
      const { data: existing, error: fetchError } = await supabase
        .from(Tables.PRODUCTS)
        .select('id, brand_id, slug')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return errorResponse('Product not found', 404);
      }

      if (existing.brand_id !== brandId) {
        return errorResponse('Product not found', 404);
      }

      // Check for duplicate slug if slug is being changed
      if (input.slug && input.slug !== existing.slug) {
        const { data: slugExists } = await supabase
          .from(Tables.PRODUCTS)
          .select('id')
          .eq('brand_id', brandId)
          .eq('slug', input.slug)
          .neq('id', id)
          .limit(1);

        if (slugExists && slugExists.length > 0) {
          return errorResponse('A product with this slug already exists', 400);
        }
      }

      // Prepare update data (only include provided fields)
      const updateData: Record<string, unknown> = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.slug !== undefined) updateData.slug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (input.description !== undefined) updateData.description = input.description;
      if (input.short_description !== undefined) updateData.short_description = input.short_description;
      if (input.price !== undefined) updateData.price = input.price;
      if (input.compare_price !== undefined) updateData.compare_price = input.compare_price;
      if (input.cost !== undefined) updateData.cost = input.cost;
      if (input.main_image_url !== undefined) updateData.main_image_url = input.main_image_url;
      if (input.images !== undefined) updateData.images = input.images;
      if (input.category_id !== undefined) updateData.category_id = input.category_id;
      if (input.supplier_info !== undefined) updateData.supplier_info = input.supplier_info;
      if (input.shipping_weight !== undefined) updateData.shipping_weight = input.shipping_weight;
      if (input.shipping_time !== undefined) updateData.shipping_time = input.shipping_time;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;
      if (input.is_featured !== undefined) updateData.is_featured = input.is_featured;
      if (input.stock_status !== undefined) updateData.stock_status = input.stock_status;
      if (input.stock_quantity !== undefined) updateData.stock_quantity = input.stock_quantity;
      if (input.seo_title !== undefined) updateData.seo_title = input.seo_title;
      if (input.seo_description !== undefined) updateData.seo_description = input.seo_description;

      const { data: product, error } = await supabase
        .from(Tables.PRODUCTS)
        .update(updateData)
        .eq('id', id)
        .eq('brand_id', brandId)
        .select()
        .single();

      if (error) {
        console.error('Error updating product:', error);
        return errorResponse(error.message || 'Failed to update product', 500);
      }

      return jsonResponse({
        success: true,
        product,
      });
    } catch (err) {
      console.error('Error in update product:', err);
      return errorResponse('Failed to update product', 500);
    }
  }

  // DELETE /api/admin/products/:id - Delete product
  if (path.startsWith('/api/admin/products/') && request.method === 'DELETE') {
    const id = path.replace('/api/admin/products/', '');
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    try {
      // Check product exists
      const { data: existing, error: fetchError } = await supabase
        .from(Tables.PRODUCTS)
        .select('id, brand_id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return errorResponse('Product not found', 404);
      }

      const { error } = await supabase
        .from(Tables.PRODUCTS)
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId);

      if (error) {
        console.error('Error deleting product:', error);
        return errorResponse(error.message || 'Failed to delete product', 500);
      }

      return jsonResponse({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (err) {
      console.error('Error in delete product:', err);
      return errorResponse('Failed to delete product', 500);
    }
  }

  // GET /api/admin/products/:id - Get single product (admin view, includes inactive)
  if (path.startsWith('/api/admin/products/') && !path.includes('/batch') && request.method === 'GET') {
    const id = path.replace('/api/admin/products/', '');
    
    if (!id) {
      return errorResponse('Product ID is required', 400);
    }

    try {
      const { data: product, error } = await supabase
        .from(Tables.PRODUCTS)
        .select('*, categories(id, name, slug)')
        .eq('id', id)
        .eq('brand_id', brandId)
        .single();

      if (error || !product) {
        return errorResponse('Product not found', 404);
      }

      return jsonResponse({
        success: true,
        product,
      });
    } catch (err) {
      console.error('Error fetching product:', err);
      return errorResponse('Failed to fetch product', 500);
    }
  }

  // POST /api/admin/products/batch - Batch operations
  if (path === '/api/admin/products/batch' && request.method === 'POST') {
    try {
      const { action, ids } = await request.json() as { action: string; ids: string[] };

      if (!action || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse('Action and ids are required', 400);
      }

      if (!['activate', 'deactivate', 'delete', 'feature', 'unfeature'].includes(action)) {
        return errorResponse('Invalid action', 400);
      }

      let error;
      let affected = 0;

      switch (action) {
        case 'activate':
          const activateResult = await supabase
            .from(Tables.PRODUCTS)
            .update({ is_active: true })
            .in('id', ids)
            .eq('brand_id', brandId);
          error = activateResult.error;
          affected = ids.length;
          break;

        case 'deactivate':
          const deactivateResult = await supabase
            .from(Tables.PRODUCTS)
            .update({ is_active: false })
            .in('id', ids)
            .eq('brand_id', brandId);
          error = deactivateResult.error;
          affected = ids.length;
          break;

        case 'delete':
          const deleteResult = await supabase
            .from(Tables.PRODUCTS)
            .delete()
            .in('id', ids)
            .eq('brand_id', brandId);
          error = deleteResult.error;
          affected = ids.length;
          break;

        case 'feature':
          const featureResult = await supabase
            .from(Tables.PRODUCTS)
            .update({ is_featured: true })
            .in('id', ids)
            .eq('brand_id', brandId);
          error = featureResult.error;
          affected = ids.length;
          break;

        case 'unfeature':
          const unfeatureResult = await supabase
            .from(Tables.PRODUCTS)
            .update({ is_featured: false })
            .in('id', ids)
            .eq('brand_id', brandId);
          error = unfeatureResult.error;
          affected = ids.length;
          break;
      }

      if (error) {
        console.error('Batch operation error:', error);
        return errorResponse(error.message || 'Batch operation failed', 500);
      }

      return jsonResponse({
        success: true,
        action,
        affected,
        message: `Successfully ${action}d ${affected} product(s)`,
      });
    } catch (err) {
      console.error('Error in batch operation:', err);
      return errorResponse('Batch operation failed', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
