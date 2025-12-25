import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { errorResponse, jsonResponse } from '../utils/response';

export async function handleAdminBrands(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const method = request.method;

  // GET /api/admin/brands - List all brands
  if (path === '/api/admin/brands' && method === 'GET') {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse(data);
  }

  // POST /api/admin/brands - Create new brand
  if (path === '/api/admin/brands' && method === 'POST') {
    try {
      const body = await request.json() as {
        name: string;
        slug: string;
        domain?: string | null;
        logo_url?: string | null;
        owner_email: string;
        is_active?: boolean;
      };

      // Validate required fields
      if (!body.name || !body.slug || !body.owner_email) {
        return errorResponse('Name, slug, and owner email are required', 400);
      }

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('brands')
        .select('id')
        .eq('slug', body.slug)
        .single();

      if (existing) {
        return errorResponse('Brand with this slug already exists', 400);
      }

      // Check domain uniqueness if provided
      if (body.domain) {
        const { data: existingDomain } = await supabase
          .from('brands')
          .select('id')
          .eq('domain', body.domain)
          .single();

        if (existingDomain) {
          return errorResponse('Brand with this domain already exists', 400);
        }
      }

      const { data, error } = await supabase
        .from('brands')
        .insert({
          name: body.name,
          slug: body.slug,
          domain: body.domain || null,
          logo_url: body.logo_url || null,
          owner_email: body.owner_email,
          is_active: body.is_active ?? true,
          settings: {},
        })
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      return jsonResponse(data, 201);
    } catch (e) {
      return errorResponse('Invalid request body', 400);
    }
  }

  // GET /api/admin/brands/:id - Get single brand
  const getBrandMatch = path.match(/^\/api\/admin\/brands\/([^\/]+)$/);
  if (getBrandMatch && method === 'GET') {
    const brandId = getBrandMatch[1];

    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();

    if (error || !data) {
      return errorResponse('Brand not found', 404);
    }

    return jsonResponse(data);
  }

  // PUT /api/admin/brands/:id - Update brand
  const updateBrandMatch = path.match(/^\/api\/admin\/brands\/([^\/]+)$/);
  if (updateBrandMatch && method === 'PUT') {
    const brandId = updateBrandMatch[1];

    try {
      const body = await request.json() as {
        name?: string;
        slug?: string;
        domain?: string | null;
        logo_url?: string | null;
        owner_email?: string;
        is_active?: boolean;
        settings?: Record<string, any>;
      };

      // Check slug uniqueness if changing
      if (body.slug) {
        const { data: existing } = await supabase
          .from('brands')
          .select('id')
          .eq('slug', body.slug)
          .neq('id', brandId)
          .single();

        if (existing) {
          return errorResponse('Brand with this slug already exists', 400);
        }
      }

      // Check domain uniqueness if changing
      if (body.domain) {
        const { data: existingDomain } = await supabase
          .from('brands')
          .select('id')
          .eq('domain', body.domain)
          .neq('id', brandId)
          .single();

        if (existingDomain) {
          return errorResponse('Brand with this domain already exists', 400);
        }
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.slug !== undefined) updateData.slug = body.slug;
      if (body.domain !== undefined) updateData.domain = body.domain;
      if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
      if (body.owner_email !== undefined) updateData.owner_email = body.owner_email;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.settings !== undefined) updateData.settings = body.settings;

      const { data, error } = await supabase
        .from('brands')
        .update(updateData)
        .eq('id', brandId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      if (!data) {
        return errorResponse('Brand not found', 404);
      }

      return jsonResponse(data);
    } catch (e) {
      return errorResponse('Invalid request body', 400);
    }
  }

  // DELETE /api/admin/brands/:id - Delete brand
  const deleteBrandMatch = path.match(/^\/api\/admin\/brands\/([^\/]+)$/);
  if (deleteBrandMatch && method === 'DELETE') {
    const brandId = deleteBrandMatch[1];

    // Check if brand has associated data
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    // Warn about associated data (but still allow deletion due to CASCADE)
    const warnings: string[] = [];
    if (productCount && productCount > 0) {
      warnings.push(`${productCount} products`);
    }
    if (orderCount && orderCount > 0) {
      warnings.push(`${orderCount} orders`);
    }

    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', brandId);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ 
      message: 'Brand deleted successfully',
      deleted_data: warnings.length > 0 ? warnings.join(', ') : null
    });
  }

  return errorResponse('Method not allowed', 405);
}
