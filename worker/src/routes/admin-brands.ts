import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { errorResponse, jsonResponse } from '../utils/response';
import { requireAdminAuth } from '../middleware/admin-auth';

export async function handleAdminBrands(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const method = request.method;

  const { context: admin, response: authResponse } = await requireAdminAuth(request, env);
  if (authResponse || !admin) return authResponse as Response;

  if (!admin.isOwner) {
    return errorResponse('Forbidden', 403);
  }

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
        favicon_url?: string | null;
        owner_email?: string;
        is_active?: boolean;
        settings?: Record<string, any>;
        theme?: Record<string, any>;
        social_links?: Record<string, any>;
        contact_info?: Record<string, any>;
        custom_css?: string | null;
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
      if (body.favicon_url !== undefined) updateData.favicon_url = body.favicon_url;
      if (body.owner_email !== undefined) updateData.owner_email = body.owner_email;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.settings !== undefined) updateData.settings = body.settings;
      if (body.theme !== undefined) updateData.theme = body.theme;
      if (body.social_links !== undefined) updateData.social_links = body.social_links;
      if (body.contact_info !== undefined) updateData.contact_info = body.contact_info;
      if (body.custom_css !== undefined) updateData.custom_css = body.custom_css;

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

  // ============================================
  // Domain Management Endpoints
  // ============================================

  // GET /api/admin/brands/:id/domains - List brand domains
  const listDomainsMatch = path.match(/^\/api\/admin\/brands\/([^\/]+)\/domains$/);
  if (listDomainsMatch && method === 'GET') {
    const brandId = listDomainsMatch[1];

    const { data, error } = await supabase
      .from('brand_domains')
      .select('*')
      .eq('brand_id', brandId)
      .order('is_primary', { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse(data || []);
  }

  // POST /api/admin/brands/:id/domains - Add domain
  if (listDomainsMatch && method === 'POST') {
    const brandId = listDomainsMatch[1];

    try {
      const body = await request.json() as {
        domain: string;
        is_primary?: boolean;
      };

      if (!body.domain) {
        return errorResponse('Domain is required', 400);
      }

      // Normalize domain (remove protocol, trailing slash)
      const normalizedDomain = body.domain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
        .toLowerCase();

      // Check domain uniqueness
      const { data: existing } = await supabase
        .from('brand_domains')
        .select('id')
        .eq('domain', normalizedDomain)
        .single();

      if (existing) {
        return errorResponse('This domain is already registered', 400);
      }

      // If setting as primary, unset other primary domains
      if (body.is_primary) {
        await supabase
          .from('brand_domains')
          .update({ is_primary: false })
          .eq('brand_id', brandId);
      }

      const { data, error } = await supabase
        .from('brand_domains')
        .insert({
          brand_id: brandId,
          domain: normalizedDomain,
          is_primary: body.is_primary ?? false,
          ssl_status: 'pending',
          dns_verified: false,
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

  // PUT /api/admin/brands/:id/domains/:domainId - Update domain
  const updateDomainMatch = path.match(/^\/api\/admin\/brands\/([^\/]+)\/domains\/([^\/]+)$/);
  if (updateDomainMatch && method === 'PUT') {
    const brandId = updateDomainMatch[1];
    const domainId = updateDomainMatch[2];

    try {
      const body = await request.json() as {
        is_primary?: boolean;
        ssl_status?: string;
        dns_verified?: boolean;
      };

      // If setting as primary, unset other primary domains
      if (body.is_primary) {
        await supabase
          .from('brand_domains')
          .update({ is_primary: false })
          .eq('brand_id', brandId);
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.is_primary !== undefined) updateData.is_primary = body.is_primary;
      if (body.ssl_status !== undefined) updateData.ssl_status = body.ssl_status;
      if (body.dns_verified !== undefined) {
        updateData.dns_verified = body.dns_verified;
        if (body.dns_verified) {
          updateData.verified_at = new Date().toISOString();
        }
      }

      const { data, error } = await supabase
        .from('brand_domains')
        .update(updateData)
        .eq('id', domainId)
        .eq('brand_id', brandId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      if (!data) {
        return errorResponse('Domain not found', 404);
      }

      return jsonResponse(data);
    } catch (e) {
      return errorResponse('Invalid request body', 400);
    }
  }

  // DELETE /api/admin/brands/:id/domains/:domainId - Remove domain
  if (updateDomainMatch && method === 'DELETE') {
    const brandId = updateDomainMatch[1];
    const domainId = updateDomainMatch[2];

    const { error } = await supabase
      .from('brand_domains')
      .delete()
      .eq('id', domainId)
      .eq('brand_id', brandId);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ message: 'Domain removed successfully' });
  }

  // ============================================
  // User Assignment Endpoints
  // ============================================

  // GET /api/admin/brands/:id/users - List brand users
  const listUsersMatch = path.match(/^\/api\/admin\/brands\/([^\/]+)\/users$/);
  if (listUsersMatch && method === 'GET') {
    const brandId = listUsersMatch[1];

    const { data, error } = await supabase
      .from('brand_user_assignments')
      .select(`
        *,
        admin_user:admin_users(id, email, name, avatar_url, role, is_active)
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse(data || []);
  }

  // POST /api/admin/brands/:id/users - Add user to brand
  if (listUsersMatch && method === 'POST') {
    const brandId = listUsersMatch[1];

    try {
      const body = await request.json() as {
        admin_user_id: string;
        role: string;
        permissions?: Record<string, any>;
      };

      if (!body.admin_user_id || !body.role) {
        return errorResponse('admin_user_id and role are required', 400);
      }

      // Check if user exists
      const { data: user } = await supabase
        .from('admin_users')
        .select('id')
        .eq('id', body.admin_user_id)
        .single();

      if (!user) {
        return errorResponse('Admin user not found', 404);
      }

      const { data, error } = await supabase
        .from('brand_user_assignments')
        .insert({
          brand_id: brandId,
          admin_user_id: body.admin_user_id,
          role: body.role,
          permissions: body.permissions || {},
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return errorResponse('User is already assigned to this brand', 400);
        }
        return errorResponse(error.message, 500);
      }

      return jsonResponse(data, 201);
    } catch (e) {
      return errorResponse('Invalid request body', 400);
    }
  }

  // PUT /api/admin/brands/:id/users/:userId - Update user assignment
  const updateUserMatch = path.match(/^\/api\/admin\/brands\/([^\/]+)\/users\/([^\/]+)$/);
  if (updateUserMatch && method === 'PUT') {
    const brandId = updateUserMatch[1];
    const assignmentId = updateUserMatch[2];

    try {
      const body = await request.json() as {
        role?: string;
        permissions?: Record<string, any>;
      };

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.role !== undefined) updateData.role = body.role;
      if (body.permissions !== undefined) updateData.permissions = body.permissions;

      const { data, error } = await supabase
        .from('brand_user_assignments')
        .update(updateData)
        .eq('id', assignmentId)
        .eq('brand_id', brandId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      if (!data) {
        return errorResponse('Assignment not found', 404);
      }

      return jsonResponse(data);
    } catch (e) {
      return errorResponse('Invalid request body', 400);
    }
  }

  // DELETE /api/admin/brands/:id/users/:userId - Remove user from brand
  if (updateUserMatch && method === 'DELETE') {
    const brandId = updateUserMatch[1];
    const assignmentId = updateUserMatch[2];

    const { error } = await supabase
      .from('brand_user_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('brand_id', brandId);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ message: 'User removed from brand successfully' });
  }

  return errorResponse('Method not allowed', 405);
}
