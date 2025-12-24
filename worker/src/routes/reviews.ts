import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

const ReviewTables = {
  REVIEWS: 'reviews',
  REVIEW_VOTES: 'review_votes',
  REVIEW_INVITATIONS: 'review_invitations',
  PRODUCTS: 'products',
};

interface ReviewInput {
  product_id: string;
  rating: number;
  title?: string;
  content?: string;
  reviewer_name?: string;
  reviewer_email?: string;
  images?: string[];
}

interface ReviewUpdateInput {
  status?: 'pending' | 'approved' | 'rejected' | 'spam';
  is_featured?: boolean;
  merchant_reply?: string;
}

export async function handleReviews(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // GET /api/reviews - List reviews (admin)
  if (request.method === 'GET' && path === '/api/reviews') {
    return await listReviews(supabase, brandId, request);
  }

  // GET /api/reviews/product/:productId - Get product reviews (public)
  if (request.method === 'GET' && path.startsWith('/api/reviews/product/')) {
    const productId = path.replace('/api/reviews/product/', '');
    return await getProductReviews(supabase, brandId, productId, request);
  }

  // GET /api/reviews/stats/:productId - Get review stats
  if (request.method === 'GET' && path.startsWith('/api/reviews/stats/')) {
    const productId = path.replace('/api/reviews/stats/', '');
    return await getReviewStats(supabase, productId);
  }

  // POST /api/reviews - Create review (public)
  if (request.method === 'POST' && path === '/api/reviews') {
    return await createReview(supabase, brandId, request);
  }

  // PUT /api/reviews/:id - Update review (admin)
  if (request.method === 'PUT' && path.startsWith('/api/reviews/')) {
    const id = path.replace('/api/reviews/', '');
    return await updateReview(supabase, brandId, id, request);
  }

  // DELETE /api/reviews/:id - Delete review (admin)
  if (request.method === 'DELETE' && path.startsWith('/api/reviews/')) {
    const id = path.replace('/api/reviews/', '');
    return await deleteReview(supabase, brandId, id);
  }

  // POST /api/reviews/:id/reply - Add merchant reply
  if (request.method === 'POST' && path.match(/\/api\/reviews\/[^/]+\/reply$/)) {
    const id = path.replace('/api/reviews/', '').replace('/reply', '');
    return await addMerchantReply(supabase, brandId, id, request);
  }

  // POST /api/reviews/:id/vote - Vote on review
  if (request.method === 'POST' && path.match(/\/api\/reviews\/[^/]+\/vote$/)) {
    const id = path.replace('/api/reviews/', '').replace('/vote', '');
    return await voteReview(supabase, id, request);
  }

  return errorResponse('Not found', 404);
}

// List all reviews for admin
async function listReviews(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const productId = url.searchParams.get('product_id');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  let query = supabase
    .from(ReviewTables.REVIEWS)
    .select(`
      *,
      products:product_id (id, name, slug, images)
    `, { count: 'exact' })
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
    console.error('List reviews error:', error);
    return errorResponse('Failed to fetch reviews', 500);
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
}

// Get product reviews (public)
async function getProductReviews(
  supabase: any,
  brandId: string,
  productId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const sort = url.searchParams.get('sort') || 'newest';
  const offset = (page - 1) * limit;

  let query = supabase
    .from(ReviewTables.REVIEWS)
    .select('*', { count: 'exact' })
    .eq('brand_id', brandId)
    .eq('product_id', productId)
    .eq('status', 'approved')
    .range(offset, offset + limit - 1);

  // Sorting
  switch (sort) {
    case 'highest':
      query = query.order('rating', { ascending: false }).order('created_at', { ascending: false });
      break;
    case 'lowest':
      query = query.order('rating', { ascending: true }).order('created_at', { ascending: false });
      break;
    case 'helpful':
      query = query.order('helpful_count', { ascending: false }).order('created_at', { ascending: false });
      break;
    default: // newest
      query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Get product reviews error:', error);
    return errorResponse('Failed to fetch reviews', 500);
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
}

// Get review stats for a product
async function getReviewStats(
  supabase: any,
  productId: string
): Promise<Response> {
  const { data, error } = await supabase
    .rpc('get_product_review_stats', { p_product_id: productId });

  if (error) {
    console.error('Get review stats error:', error);
    return errorResponse('Failed to fetch review stats', 500);
  }

  return jsonResponse({
    success: true,
    data: data?.[0] || {
      total_reviews: 0,
      average_rating: 0,
      rating_1: 0,
      rating_2: 0,
      rating_3: 0,
      rating_4: 0,
      rating_5: 0,
      verified_count: 0,
    },
  });
}

// Create a new review
async function createReview(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as ReviewInput;

  if (!body.product_id || !body.rating) {
    return errorResponse('product_id and rating are required', 400);
  }

  if (body.rating < 1 || body.rating > 5) {
    return errorResponse('Rating must be between 1 and 5', 400);
  }

  // Check for verified purchase
  let isVerifiedPurchase = false;
  if (body.reviewer_email) {
    const { data: verified } = await supabase
      .rpc('check_verified_purchase', {
        p_brand_id: brandId,
        p_product_id: body.product_id,
        p_customer_email: body.reviewer_email,
      });
    isVerifiedPurchase = verified === true;
  }

  const { data, error } = await supabase
    .from(ReviewTables.REVIEWS)
    .insert({
      brand_id: brandId,
      product_id: body.product_id,
      rating: body.rating,
      title: body.title || null,
      content: body.content || null,
      reviewer_name: body.reviewer_name || 'Anonymous',
      reviewer_email: body.reviewer_email || null,
      images: body.images || [],
      is_verified_purchase: isVerifiedPurchase,
      status: 'pending', // All reviews start as pending
    })
    .select()
    .single();

  if (error) {
    console.error('Create review error:', error);
    return errorResponse('Failed to create review', 500);
  }

  return jsonResponse({ success: true, data });
}

// Update review (admin)
async function updateReview(
  supabase: any,
  brandId: string,
  id: string,
  request: Request
): Promise<Response> {
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
    console.error('Update review error:', error);
    return errorResponse('Failed to update review', 500);
  }

  return jsonResponse({ success: true, data });
}

// Delete review
async function deleteReview(
  supabase: any,
  brandId: string,
  id: string
): Promise<Response> {
  const { error } = await supabase
    .from(ReviewTables.REVIEWS)
    .delete()
    .eq('id', id)
    .eq('brand_id', brandId);

  if (error) {
    console.error('Delete review error:', error);
    return errorResponse('Failed to delete review', 500);
  }

  return jsonResponse({ success: true });
}

// Add merchant reply
async function addMerchantReply(
  supabase: any,
  brandId: string,
  id: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { reply: string; replied_by?: string };

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
    console.error('Add merchant reply error:', error);
    return errorResponse('Failed to add reply', 500);
  }

  return jsonResponse({ success: true, data });
}

// Vote on review (helpful/not helpful)
async function voteReview(
  supabase: any,
  reviewId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as { is_helpful: boolean };
  const voterIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

  if (typeof body.is_helpful !== 'boolean') {
    return errorResponse('is_helpful is required', 400);
  }

  // Check for existing vote
  const { data: existing } = await supabase
    .from(ReviewTables.REVIEW_VOTES)
    .select('id')
    .eq('review_id', reviewId)
    .eq('voter_ip', voterIp)
    .single();

  if (existing) {
    return errorResponse('You have already voted on this review', 400);
  }

  const { error } = await supabase
    .from(ReviewTables.REVIEW_VOTES)
    .insert({
      review_id: reviewId,
      voter_ip: voterIp,
      is_helpful: body.is_helpful,
    });

  if (error) {
    console.error('Vote review error:', error);
    return errorResponse('Failed to submit vote', 500);
  }

  return jsonResponse({ success: true });
}
