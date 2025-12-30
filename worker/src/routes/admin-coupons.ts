/**
 * Admin Coupon API routes
 * CRUD operations for coupon management
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandManageAccess } from '../middleware/admin-auth';

interface CouponInput {
  code: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  status?: 'active' | 'inactive';
  min_order_amount?: number;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  usage_limit_per_customer?: number;
  starts_at?: string | null;
  expires_at?: string | null;
  first_order_only?: boolean;
  applies_to_products?: string[];
  applies_to_categories?: string[];
  excluded_products?: string[];
}

export async function handleAdminCoupons(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  if (!brandId || brandId === 'all') {
    return errorResponse('Brand context missing', 400);
  }

  const access = await requireBrandManageAccess(env, admin, brandId);
  if (!access.ok) return access.response;

  // GET /api/admin/coupons - List all coupons
  if (path === '/api/admin/coupons' && request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;

      let query = supabase
        .from('coupons')
        .select('*', { count: 'exact' })
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('List coupons error:', error);
        return errorResponse('Failed to fetch coupons', 500);
      }

      return jsonResponse({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (err) {
      console.error('Error listing coupons:', err);
      return errorResponse('Failed to fetch coupons', 500);
    }
  }

  // POST /api/admin/coupons - Create coupon
  if (path === '/api/admin/coupons' && request.method === 'POST') {
    try {
      const input = (await request.json()) as CouponInput;

      if (!input.code || !input.type || typeof input.value !== 'number') {
        return errorResponse('Missing required fields: code, type, value', 400);
      }

      // Check for duplicate code
      const { data: existing } = await supabase
        .from('coupons')
        .select('id')
        .eq('brand_id', brandId)
        .ilike('code', input.code)
        .limit(1);

      if (existing && existing.length > 0) {
        return errorResponse('A coupon with this code already exists', 400);
      }

      const couponData = {
        brand_id: brandId,
        code: input.code.toUpperCase(),
        description: input.description || null,
        type: input.type,
        value: input.value,
        status: input.status || 'active',
        min_order_amount: input.min_order_amount || 0,
        max_discount_amount: input.max_discount_amount || null,
        usage_limit: input.usage_limit || null,
        usage_limit_per_customer: input.usage_limit_per_customer || 1,
        starts_at: input.starts_at || new Date().toISOString(),
        expires_at: input.expires_at || null,
        first_order_only: input.first_order_only || false,
        applies_to_products: input.applies_to_products || [],
        applies_to_categories: input.applies_to_categories || [],
        excluded_products: input.excluded_products || [],
      };

      const { data, error } = await supabase
        .from('coupons')
        .insert(couponData)
        .select()
        .single();

      if (error) {
        console.error('Create coupon error:', error);
        return errorResponse(error.message || 'Failed to create coupon', 500);
      }

      return jsonResponse({ success: true, data });
    } catch (err) {
      console.error('Error creating coupon:', err);
      return errorResponse('Failed to create coupon', 500);
    }
  }

  // PUT /api/admin/coupons/:id - Update coupon
  if (path.match(/^\/api\/admin\/coupons\/[^\/]+$/) && request.method === 'PUT') {
    const id = path.replace('/api/admin/coupons/', '');

    try {
      const input = (await request.json()) as Partial<CouponInput>;

      // Check coupon exists and belongs to brand
      const { data: existing, error: fetchError } = await supabase
        .from('coupons')
        .select('id, code')
        .eq('id', id)
        .eq('brand_id', brandId)
        .single();

      if (fetchError || !existing) {
        return errorResponse('Coupon not found', 404);
      }

      // Check for duplicate code if code is being changed
      if (input.code && input.code.toUpperCase() !== existing.code) {
        const { data: codeExists } = await supabase
          .from('coupons')
          .select('id')
          .eq('brand_id', brandId)
          .ilike('code', input.code)
          .neq('id', id)
          .limit(1);

        if (codeExists && codeExists.length > 0) {
          return errorResponse('A coupon with this code already exists', 400);
        }
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (input.code !== undefined) updateData.code = input.code.toUpperCase();
      if (input.description !== undefined) updateData.description = input.description;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.value !== undefined) updateData.value = input.value;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.min_order_amount !== undefined) updateData.min_order_amount = input.min_order_amount;
      if (input.max_discount_amount !== undefined) updateData.max_discount_amount = input.max_discount_amount;
      if (input.usage_limit !== undefined) updateData.usage_limit = input.usage_limit;
      if (input.usage_limit_per_customer !== undefined) updateData.usage_limit_per_customer = input.usage_limit_per_customer;
      if (input.starts_at !== undefined) updateData.starts_at = input.starts_at;
      if (input.expires_at !== undefined) updateData.expires_at = input.expires_at;
      if (input.first_order_only !== undefined) updateData.first_order_only = input.first_order_only;

      const { data, error } = await supabase
        .from('coupons')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update coupon error:', error);
        return errorResponse(error.message || 'Failed to update coupon', 500);
      }

      return jsonResponse({ success: true, data });
    } catch (err) {
      console.error('Error updating coupon:', err);
      return errorResponse('Failed to update coupon', 500);
    }
  }

  // DELETE /api/admin/coupons/:id - Delete coupon
  if (path.match(/^\/api\/admin\/coupons\/[^\/]+$/) && request.method === 'DELETE') {
    const id = path.replace('/api/admin/coupons/', '');

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId);

      if (error) {
        console.error('Delete coupon error:', error);
        return errorResponse('Failed to delete coupon', 500);
      }

      return jsonResponse({ success: true });
    } catch (err) {
      console.error('Error deleting coupon:', err);
      return errorResponse('Failed to delete coupon', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}

// Public coupon validation endpoint
export async function handleCouponValidation(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // POST /api/coupons/validate - Validate a coupon code
  if (path === '/api/coupons/validate' && request.method === 'POST') {
    try {
      const { code, email, subtotal, product_ids } = await request.json() as {
        code: string;
        email?: string;
        subtotal: number;
        product_ids?: string[];
      };

      if (!code || typeof subtotal !== 'number') {
        return errorResponse('Code and subtotal are required', 400);
      }

      // Call the validate_coupon function
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_brand_id: brandId,
        p_code: code.toUpperCase(),
        p_customer_email: email || '',
        p_order_subtotal: subtotal,
        p_product_ids: product_ids || [],
      });

      if (error) {
        console.error('Validate coupon error:', error);
        return errorResponse('Failed to validate coupon', 500);
      }

      const result = data?.[0];

      if (!result || !result.valid) {
        return jsonResponse({
          success: false,
          valid: false,
          error: result?.error_message || 'Invalid coupon code',
        });
      }

      return jsonResponse({
        success: true,
        valid: true,
        coupon_id: result.coupon_id,
        discount_type: result.discount_type,
        discount_value: result.discount_value,
        discount_amount: result.discount_amount,
      });
    } catch (err) {
      console.error('Error validating coupon:', err);
      return errorResponse('Failed to validate coupon', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
