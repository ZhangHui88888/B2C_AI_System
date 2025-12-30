/**
 * Authors API routes
 * E-E-A-T author management for content attribution
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

const Tables = {
  AUTHORS: 'authors',
  CONTENT_LIBRARY: 'content_library',
};

interface AuthorInput {
  name: string;
  slug?: string;
  avatar_url?: string;
  bio?: string;
  credentials?: string[];
  social_links?: Record<string, string>;
  is_active?: boolean;
}

export async function handleAuthors(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // GET /api/authors - List authors
  if (request.method === 'GET' && path === '/api/authors') {
    return await listAuthors(supabase, brandId, request);
  }

  // GET /api/authors/:id - Get author details
  if (request.method === 'GET' && path.match(/^\/api\/authors\/[^/]+$/)) {
    const id = path.replace('/api/authors/', '');
    return await getAuthor(supabase, brandId, id);
  }

  // POST /api/authors - Create author
  if (request.method === 'POST' && path === '/api/authors') {
    return await createAuthor(supabase, brandId, request);
  }

  // PUT /api/authors/:id - Update author
  if (request.method === 'PUT' && path.match(/^\/api\/authors\/[^/]+$/)) {
    const id = path.replace('/api/authors/', '');
    return await updateAuthor(supabase, brandId, id, request);
  }

  // DELETE /api/authors/:id - Delete author
  if (request.method === 'DELETE' && path.match(/^\/api\/authors\/[^/]+$/)) {
    const id = path.replace('/api/authors/', '');
    return await deleteAuthor(supabase, brandId, id);
  }

  return errorResponse('Not found', 404);
}

async function listAuthors(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const activeOnly = url.searchParams.get('active') !== 'false';
  const slug = url.searchParams.get('slug');

  // If slug is provided, return single author
  if (slug) {
    const { data, error } = await supabase
      .from(Tables.AUTHORS)
      .select('*')
      .eq('brand_id', brandId)
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return errorResponse('Author not found', 404);
    }

    // Get author's content count
    const { data: contentStats } = await supabase
      .from(Tables.CONTENT_LIBRARY)
      .select('type, status')
      .eq('brand_id', brandId)
      .eq('author_id', data.id);

    const stats = {
      total: contentStats?.length || 0,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    contentStats?.forEach((item: any) => {
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
      stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
    });

    return jsonResponse({
      success: true,
      data: {
        ...data,
        contentStats: stats,
      },
    });
  }

  let query = supabase
    .from(Tables.AUTHORS)
    .select('id, name, slug, avatar_url, bio, credentials, social_links, is_active, article_count, created_at', { count: 'exact' })
    .eq('brand_id', brandId)
    .order('name', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('List authors error:', error);
    return errorResponse('Failed to list authors', 500);
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

async function getAuthor(
  supabase: any,
  brandId: string,
  id: string
): Promise<Response> {
  const { data, error } = await supabase
    .from(Tables.AUTHORS)
    .select('*')
    .eq('brand_id', brandId)
    .eq('id', id)
    .single();

  if (error || !data) {
    return errorResponse('Author not found', 404);
  }

  // Get author's content count by type
  const { data: contentStats } = await supabase
    .from(Tables.CONTENT_LIBRARY)
    .select('type, status')
    .eq('brand_id', brandId)
    .eq('author_id', id);

  const stats = {
    total: contentStats?.length || 0,
    byType: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
  };

  contentStats?.forEach((item: any) => {
    stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;
    stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
  });

  return jsonResponse({
    success: true,
    data: {
      ...data,
      contentStats: stats,
    },
  });
}

async function createAuthor(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as AuthorInput;

  if (!body.name) {
    return errorResponse('Name is required', 400);
  }

  // Generate slug if not provided
  const slug = body.slug || body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Check for duplicate slug
  const { data: existing } = await supabase
    .from(Tables.AUTHORS)
    .select('id')
    .eq('brand_id', brandId)
    .eq('slug', slug)
    .single();

  if (existing) {
    return errorResponse('An author with this slug already exists', 400);
  }

  const { data, error } = await supabase
    .from(Tables.AUTHORS)
    .insert({
      brand_id: brandId,
      name: body.name,
      slug,
      avatar_url: body.avatar_url || null,
      bio: body.bio || null,
      credentials: body.credentials || [],
      social_links: body.social_links || {},
      is_active: body.is_active !== false,
    })
    .select()
    .single();

  if (error) {
    console.error('Create author error:', error);
    return errorResponse('Failed to create author', 500);
  }

  return jsonResponse({ success: true, data }, 201);
}

async function updateAuthor(
  supabase: any,
  brandId: string,
  id: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Partial<AuthorInput>;

  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.slug !== undefined) updateData.slug = body.slug;
  if (body.avatar_url !== undefined) updateData.avatar_url = body.avatar_url;
  if (body.bio !== undefined) updateData.bio = body.bio;
  if (body.credentials !== undefined) updateData.credentials = body.credentials;
  if (body.social_links !== undefined) updateData.social_links = body.social_links;
  if (body.is_active !== undefined) updateData.is_active = body.is_active;

  if (Object.keys(updateData).length === 0) {
    return errorResponse('No valid fields to update', 400);
  }

  // Check slug uniqueness if changing
  if (updateData.slug) {
    const { data: existing } = await supabase
      .from(Tables.AUTHORS)
      .select('id')
      .eq('brand_id', brandId)
      .eq('slug', updateData.slug)
      .neq('id', id)
      .single();

    if (existing) {
      return errorResponse('An author with this slug already exists', 400);
    }
  }

  const { data, error } = await supabase
    .from(Tables.AUTHORS)
    .update(updateData)
    .eq('id', id)
    .eq('brand_id', brandId)
    .select()
    .single();

  if (error) {
    console.error('Update author error:', error);
    return errorResponse('Failed to update author', 500);
  }

  return jsonResponse({ success: true, data });
}

async function deleteAuthor(
  supabase: any,
  brandId: string,
  id: string
): Promise<Response> {
  // First, unlink any content from this author
  await supabase
    .from(Tables.CONTENT_LIBRARY)
    .update({ author_id: null })
    .eq('brand_id', brandId)
    .eq('author_id', id);

  const { error } = await supabase
    .from(Tables.AUTHORS)
    .delete()
    .eq('id', id)
    .eq('brand_id', brandId);

  if (error) {
    console.error('Delete author error:', error);
    return errorResponse('Failed to delete author', 500);
  }

  return jsonResponse({ success: true });
}
