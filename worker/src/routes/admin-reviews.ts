/**
 * Admin Reviews API routes
 * Moderation operations for reviews management
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { requireAdminAuth, requireBrandManageAccess, requireBrandAdminAccess } from '../middleware/admin-auth';

const ReviewTables = {
  REVIEWS: 'reviews',
  PRODUCTS: 'products',
} as const;

interface ReviewUpdateInput {
  status?: 'pending' | 'approved' | 'rejected' | 'spam';
  is_featured?: boolean;
  merchant_reply?: string;
}

export async function handleAdminReviews(
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

  // GET /api/admin/reviews - List reviews
  if (request.method === 'GET' && path === '/api/admin/reviews') {
    return await listReviews(supabase, brandId, request);
  }

  // PUT /api/admin/reviews/:id - Update review (status/featured)
  if (request.method === 'PUT' && path.startsWith('/api/admin/reviews/')) {
    const id = path.replace('/api/admin/reviews/', '');
    const adminAccess = await requireBrandAdminAccess(env, admin, brandId);
    if (!adminAccess.ok) return adminAccess.response;
    return await updateReview(supabase, brandId, id, request);
  }

  // DELETE /api/admin/reviews/:id - Delete review
  if (request.method === 'DELETE' && path.startsWith('/api/admin/reviews/')) {
    const id = path.replace('/api/admin/reviews/', '');
    const adminAccess = await requireBrandAdminAccess(env, admin, brandId);
    if (!adminAccess.ok) return adminAccess.response;
    return await deleteReview(supabase, brandId, id);
  }

  // POST /api/admin/reviews/:id/reply - Add merchant reply
  if (request.method === 'POST' && path.match(/\/api\/admin\/reviews\/[^/]+\/reply$/)) {
    const id = path.replace('/api/admin/reviews/', '').replace('/reply', '');
    const adminAccess = await requireBrandAdminAccess(env, admin, brandId);
    if (!adminAccess.ok) return adminAccess.response;
    return await addMerchantReply(supabase, brandId, id, request);
  }

  return errorResponse('Not found', 404);
}

async function listReviews(supabase: any, brandId: string, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const productId = url.searchParams.get('product_id');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  let query = supabase
    .from(ReviewTables.REVIEWS)
    .select(
      `
      *,
      products:product_id (id, name, slug, images)
    `,
      { count: 'exact' }
    )
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Admin list reviews error:', error);
    return errorResponse('Failed to fetch reviews', 500);
  }

  return jsonResponse({
    success: true,
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

async function updateReview(supabase: any, brandId: string, id: string, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as ReviewUpdateInput;

  const updateData: any = {};

  if (body.status) {
    updateData.status = body.status;
    if (body.status === 'approved') {
      updateData.approved_at = new Date().toISOString();
    }
  }

  if (typeof body.is_featured === 'boolean') {
    updateData.is_featured = body.is_featured;
  }

  if (typeof body.merchant_reply === 'string') {
    updateData.merchant_reply = body.merchant_reply;
    updateData.merchant_reply_at = new Date().toISOString();
  }

  if (Object.keys(updateData).length === 0) {
    return errorResponse('No valid fields to update', 400);
  }

  const { data, error } = await supabase
    .from(ReviewTables.REVIEWS)
    .update(updateData)
    .eq('id', id)
    .eq('brand_id', brandId)
    .select()
    .single();

  if (error) {
    console.error('Admin update review error:', error);
    return errorResponse('Failed to update review', 500);
  }

  return jsonResponse({ success: true, data });
}

async function deleteReview(supabase: any, brandId: string, id: string): Promise<Response> {
  const { error } = await supabase.from(ReviewTables.REVIEWS).delete().eq('id', id).eq('brand_id', brandId);

  if (error) {
    console.error('Admin delete review error:', error);
    return errorResponse('Failed to delete review', 500);
  }

  return jsonResponse({ success: true });
}

async function addMerchantReply(supabase: any, brandId: string, id: string, request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { reply?: string; replied_by?: string };

  if (!body.reply) {
    return errorResponse('Reply content is required', 400);
  }

  const { data, error } = await supabase
    .from(ReviewTables.REVIEWS)
    .update({
      merchant_reply: body.reply,
      merchant_reply_at: new Date().toISOString(),
      merchant_reply_by: body.replied_by || 'Admin',
    })
    .eq('id', id)
    .eq('brand_id', brandId)
    .select()
    .single();

  if (error) {
    console.error('Admin add merchant reply error:', error);
    return errorResponse('Failed to add reply', 500);
  }

  return jsonResponse({ success: true, data });
}
