/**
 * Admin Category API routes
 * CRUD operations for category management
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';

interface CategoryInput {
  brand_id: string;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  parent_id?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export async function handleAdminCategories(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);

  // GET /api/admin/categories - Get all categories (admin view, includes inactive)
  if (path === '/api/admin/categories' && request.method === 'GET') {
    try {
      const { data: categories, error } = await supabase
        .from(Tables.CATEGORIES)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching categories:', error);
        return errorResponse('Failed to fetch categories', 500);
      }

      return jsonResponse({
        success: true,
        categories: categories || [],
      });
    } catch (err) {
      console.error('Error in fetch categories:', err);
      return errorResponse('Failed to fetch categories', 500);
    }
  }

  // POST /api/admin/categories - Create category
  if (path === '/api/admin/categories' && request.method === 'POST') {
    try {
      const input = (await request.json()) as CategoryInput;

      // Validate required fields
      if (!input.brand_id || !input.name || !input.slug) {
        return errorResponse('Missing required fields: brand_id, name, slug', 400);
      }

      // Check for duplicate slug
      const { data: existing } = await supabase
        .from(Tables.CATEGORIES)
        .select('id')
        .eq('brand_id', input.brand_id)
        .eq('slug', input.slug)
        .limit(1);

      if (existing && existing.length > 0) {
        return errorResponse('A category with this slug already exists', 400);
      }

      // Prepare category data
      const categoryData = {
        brand_id: input.brand_id,
        name: input.name,
        slug: input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: input.description || null,
        image_url: input.image_url || null,
        parent_id: input.parent_id || null,
        sort_order: input.sort_order ?? 0,
        is_active: input.is_active !== false,
      };

      const { data: category, error } = await supabase
        .from(Tables.CATEGORIES)
        .insert(categoryData)
        .select()
        .single();

      if (error) {
        console.error('Error creating category:', error);
        return errorResponse(error.message || 'Failed to create category', 500);
      }

      return jsonResponse({
        success: true,
        category,
      });
    } catch (err) {
      console.error('Error in create category:', err);
      return errorResponse('Failed to create category', 500);
    }
  }

  // PUT /api/admin/categories/:id - Update category
  if (path.startsWith('/api/admin/categories/') && request.method === 'PUT') {
    const id = path.replace('/api/admin/categories/', '');
    
    if (!id) {
      return errorResponse('Category ID is required', 400);
    }

    try {
      const input = (await request.json()) as Partial<CategoryInput>;

      // Check category exists
      const { data: existing, error: fetchError } = await supabase
        .from(Tables.CATEGORIES)
        .select('id, brand_id, slug')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return errorResponse('Category not found', 404);
      }

      // Check for duplicate slug if slug is being changed
      if (input.slug && input.slug !== existing.slug) {
        const { data: slugExists } = await supabase
          .from(Tables.CATEGORIES)
          .select('id')
          .eq('brand_id', existing.brand_id)
          .eq('slug', input.slug)
          .neq('id', id)
          .limit(1);

        if (slugExists && slugExists.length > 0) {
          return errorResponse('A category with this slug already exists', 400);
        }
      }

      // Prepare update data
      const updateData: Record<string, unknown> = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.slug !== undefined) updateData.slug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (input.description !== undefined) updateData.description = input.description;
      if (input.image_url !== undefined) updateData.image_url = input.image_url;
      if (input.parent_id !== undefined) updateData.parent_id = input.parent_id;
      if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
      if (input.is_active !== undefined) updateData.is_active = input.is_active;

      const { data: category, error } = await supabase
        .from(Tables.CATEGORIES)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating category:', error);
        return errorResponse(error.message || 'Failed to update category', 500);
      }

      return jsonResponse({
        success: true,
        category,
      });
    } catch (err) {
      console.error('Error in update category:', err);
      return errorResponse('Failed to update category', 500);
    }
  }

  // DELETE /api/admin/categories/:id - Delete category
  if (path.startsWith('/api/admin/categories/') && request.method === 'DELETE') {
    const id = path.replace('/api/admin/categories/', '');
    
    if (!id) {
      return errorResponse('Category ID is required', 400);
    }

    try {
      // Check category exists
      const { data: existing, error: fetchError } = await supabase
        .from(Tables.CATEGORIES)
        .select('id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return errorResponse('Category not found', 404);
      }

      // Check if category has products
      const { count: productCount } = await supabase
        .from(Tables.PRODUCTS)
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);

      if (productCount && productCount > 0) {
        return errorResponse(`Cannot delete category with ${productCount} products. Move or delete products first.`, 400);
      }

      // Check if category has children
      const { count: childCount } = await supabase
        .from(Tables.CATEGORIES)
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', id);

      if (childCount && childCount > 0) {
        return errorResponse(`Cannot delete category with ${childCount} subcategories. Delete subcategories first.`, 400);
      }

      const { error } = await supabase
        .from(Tables.CATEGORIES)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting category:', error);
        return errorResponse(error.message || 'Failed to delete category', 500);
      }

      return jsonResponse({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (err) {
      console.error('Error in delete category:', err);
      return errorResponse('Failed to delete category', 500);
    }
  }

  // GET /api/admin/categories/:id - Get single category
  if (path.startsWith('/api/admin/categories/') && request.method === 'GET') {
    const id = path.replace('/api/admin/categories/', '');
    
    if (!id) {
      return errorResponse('Category ID is required', 400);
    }

    try {
      const { data: category, error } = await supabase
        .from(Tables.CATEGORIES)
        .select('*')
        .eq('id', id)
        .single();

      if (error || !category) {
        return errorResponse('Category not found', 404);
      }

      return jsonResponse({
        success: true,
        category,
      });
    } catch (err) {
      console.error('Error fetching category:', err);
      return errorResponse('Failed to fetch category', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
