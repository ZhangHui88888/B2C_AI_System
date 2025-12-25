import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { errorResponse, jsonResponse } from '../utils/response';

export async function handleAdminTemplates(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const method = request.method;

  // GET /api/admin/templates - List templates
  if (path === '/api/admin/templates' && method === 'GET') {
    const url = new URL(request.url);
    const brandId = url.searchParams.get('brand_id');
    const type = url.searchParams.get('type');

    let query = supabase
      .from('shared_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (brandId && brandId !== 'all') {
      // Show templates owned by this brand OR public OR shared with this brand
      query = query.or(`owner_brand_id.eq.${brandId},is_public.eq.true,allowed_brand_ids.cs.{${brandId}}`);
    }

    if (type) {
      query = query.eq('template_type', type);
    }

    const { data, error } = await query;

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse(data || []);
  }

  // POST /api/admin/templates - Create template
  if (path === '/api/admin/templates' && method === 'POST') {
    try {
      const body = await request.json() as {
        name: string;
        description?: string | null;
        template_type: string;
        content: Record<string, any>;
        is_public?: boolean;
        allowed_brand_ids?: string[];
        owner_brand_id?: string | null;
      };

      if (!body.name || !body.template_type || !body.content) {
        return errorResponse('Name, template_type, and content are required', 400);
      }

      // Get brand_id from header if not provided
      const brandId = body.owner_brand_id || request.headers.get('x-brand-id');

      if (!brandId) {
        return errorResponse('Brand ID is required', 400);
      }

      const { data, error } = await supabase
        .from('shared_templates')
        .insert({
          owner_brand_id: brandId,
          name: body.name,
          description: body.description || null,
          template_type: body.template_type,
          content: body.content,
          is_public: body.is_public ?? false,
          allowed_brand_ids: body.allowed_brand_ids || [],
          use_count: 0,
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

  // GET /api/admin/templates/:id - Get single template
  const getTemplateMatch = path.match(/^\/api\/admin\/templates\/([^\/]+)$/);
  if (getTemplateMatch && method === 'GET') {
    const templateId = getTemplateMatch[1];

    const { data, error } = await supabase
      .from('shared_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      return errorResponse('Template not found', 404);
    }

    return jsonResponse(data);
  }

  // PUT /api/admin/templates/:id - Update template
  const updateTemplateMatch = path.match(/^\/api\/admin\/templates\/([^\/]+)$/);
  if (updateTemplateMatch && method === 'PUT') {
    const templateId = updateTemplateMatch[1];

    try {
      const body = await request.json() as {
        name?: string;
        description?: string | null;
        template_type?: string;
        content?: Record<string, any>;
        is_public?: boolean;
        allowed_brand_ids?: string[];
      };

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.template_type !== undefined) updateData.template_type = body.template_type;
      if (body.content !== undefined) updateData.content = body.content;
      if (body.is_public !== undefined) updateData.is_public = body.is_public;
      if (body.allowed_brand_ids !== undefined) updateData.allowed_brand_ids = body.allowed_brand_ids;

      const { data, error } = await supabase
        .from('shared_templates')
        .update(updateData)
        .eq('id', templateId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      if (!data) {
        return errorResponse('Template not found', 404);
      }

      return jsonResponse(data);
    } catch (e) {
      return errorResponse('Invalid request body', 400);
    }
  }

  // DELETE /api/admin/templates/:id - Delete template
  if (updateTemplateMatch && method === 'DELETE') {
    const templateId = updateTemplateMatch[1];

    const { error } = await supabase
      .from('shared_templates')
      .delete()
      .eq('id', templateId);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ message: 'Template deleted successfully' });
  }

  // POST /api/admin/templates/:id/use - Increment use count
  const useTemplateMatch = path.match(/^\/api\/admin\/templates\/([^\/]+)\/use$/);
  if (useTemplateMatch && method === 'POST') {
    const templateId = useTemplateMatch[1];

    const { data: current } = await supabase
      .from('shared_templates')
      .select('use_count')
      .eq('id', templateId)
      .single();

    if (!current) {
      return errorResponse('Template not found', 404);
    }

    const { error } = await supabase
      .from('shared_templates')
      .update({ use_count: (current.use_count || 0) + 1 })
      .eq('id', templateId);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({ message: 'Use count incremented' });
  }

  // POST /api/admin/templates/:id/share - Share template with brands
  const shareTemplateMatch = path.match(/^\/api\/admin\/templates\/([^\/]+)\/share$/);
  if (shareTemplateMatch && method === 'POST') {
    const templateId = shareTemplateMatch[1];

    try {
      const body = await request.json() as {
        brand_ids: string[];
      };

      if (!body.brand_ids || !Array.isArray(body.brand_ids)) {
        return errorResponse('brand_ids array is required', 400);
      }

      const { data, error } = await supabase
        .from('shared_templates')
        .update({ 
          allowed_brand_ids: body.brand_ids,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      return jsonResponse(data);
    } catch (e) {
      return errorResponse('Invalid request body', 400);
    }
  }

  return errorResponse('Method not allowed', 405);
}
