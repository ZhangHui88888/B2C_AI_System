/**
 * Category API routes
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

export async function handleCategories(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // GET /api/categories - Get all categories
  if (path === '/api/categories' && request.method === 'GET') {
    const { data: categories, error } = await supabase
      .from(Tables.CATEGORIES)
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return errorResponse('Failed to fetch categories', 500);
    }

    const { data: productRows, error: productError } = await supabase
      .from(Tables.PRODUCTS)
      .select('category_id')
      .eq('brand_id', brandId)
      .eq('is_active', true);

    if (productError) {
      console.error('Error fetching product counts:', productError);
      return errorResponse('Failed to fetch categories', 500);
    }

    const productCountByCategory = new Map<string, number>();
    (productRows || []).forEach((row: any) => {
      const categoryId = row?.category_id;
      if (!categoryId) return;
      productCountByCategory.set(categoryId, (productCountByCategory.get(categoryId) || 0) + 1);
    });

    const categoryWithCounts = (categories || []).map((c: any) => ({
      ...c,
      product_count: productCountByCategory.get(c.id) || 0,
    }));

    // Build category tree (parent-child relationships)
    const categoryTree = buildCategoryTree(categoryWithCounts);

    return jsonResponse({
      success: true,
      categories: categoryTree,
    });
  }

  // GET /api/categories/:slug - Get single category with products
  if (request.method === 'GET') {
    const slug = path.replace('/api/categories/', '');
    
    if (!slug) {
      return errorResponse('Category slug is required', 400);
    }

    const { data: category, error } = await supabase
      .from(Tables.CATEGORIES)
      .select('*')
      .eq('brand_id', brandId)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !category) {
      return errorResponse('Category not found', 404);
    }

    const { data: subcategories, error: subcategoriesError } = await supabase
      .from(Tables.CATEGORIES)
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .eq('parent_id', (category as any).id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      return errorResponse('Failed to fetch category', 500);
    }

    return jsonResponse({
      success: true,
      category,
      subcategories: subcategories || [],
    });
  }

  return errorResponse('Method not allowed', 405);
}

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  children?: Category[];
  [key: string]: any;
}

function buildCategoryTree(categories: Category[]): Category[] {
  const categoryMap = new Map<string, Category>();
  const roots: Category[] = [];

  // First pass: create map
  categories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Second pass: build tree
  categories.forEach(cat => {
    const category = categoryMap.get(cat.id)!;
    if (cat.parent_id && categoryMap.has(cat.parent_id)) {
      categoryMap.get(cat.parent_id)!.children!.push(category);
    } else {
      roots.push(category);
    }
  });

  return roots;
}
