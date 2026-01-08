import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { errorResponse } from '../utils/response';

export interface AdminAuthContext {
  authUserId: string;
  email: string;
  adminUserId: string | null;
  role: string | null;
  brandIds: string[];
  isOwner: boolean;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireAdminAuth(
  request: Request,
  env: Env
): Promise<{ context?: AdminAuthContext; response?: Response }> {
  const token = getBearerToken(request);
  if (!token) {
    return { response: errorResponse('Missing Authorization token', 401) };
  }

  const supabase = getSupabase(env);

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return { response: errorResponse('Invalid or expired token', 401) };
  }

  const authUserId = userData.user.id;
  const email = (userData.user.email || '').toLowerCase();
  const ownerEmail = (env.OWNER_EMAIL || '').toLowerCase();
  const isOwner = !!ownerEmail && email === ownerEmail;

  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('id, role, is_active, brand_ids')
    .eq('auth_user_id', authUserId)
    .single();

  if (adminError || !adminRow) {
    if (!isOwner) {
      return { response: errorResponse('Admin access denied', 403) };
    }

    return {
      context: {
        authUserId,
        email,
        adminUserId: null,
        role: null,
        brandIds: [],
        isOwner,
      },
    };
  }

  if (adminRow.is_active === false) {
    return { response: errorResponse('Admin account disabled', 403) };
  }

  const brandIds = Array.isArray(adminRow.brand_ids)
    ? adminRow.brand_ids.filter((x: any) => typeof x === 'string')
    : [];

  return {
    context: {
      authUserId,
      email,
      adminUserId: adminRow.id,
      role: adminRow.role || null,
      brandIds,
      isOwner: isOwner || adminRow.role === 'super_admin',
    },
  };
}

export async function requireBrandManageAccess(
  env: Env,
  admin: AdminAuthContext,
  brandId: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!brandId) {
    return { ok: false, response: errorResponse('Brand ID is required', 400) };
  }

  if (admin.isOwner) {
    return { ok: true };
  }

  if (admin.brandIds.includes(brandId)) {
    return { ok: true };
  }

  if (!admin.adminUserId) {
    return { ok: false, response: errorResponse('Brand access denied', 403) };
  }

  const supabase = getSupabase(env);

  const { data: assignment } = await supabase
    .from('brand_user_assignments')
    .select('role')
    .eq('brand_id', brandId)
    .eq('admin_user_id', admin.adminUserId)
    .single();

  const role = typeof (assignment as any)?.role === 'string' ? (assignment as any).role : '';

  if (role === 'brand_admin' || role === 'editor') {
    return { ok: true };
  }

  return { ok: false, response: errorResponse('Brand access denied', 403) };
}

export async function requireBrandAdminAccess(
  env: Env,
  admin: AdminAuthContext,
  brandId: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!brandId) {
    return { ok: false, response: errorResponse('Brand ID is required', 400) };
  }

  if (admin.isOwner) {
    return { ok: true };
  }

  if (admin.brandIds.includes(brandId)) {
    return { ok: true };
  }

  if (!admin.adminUserId) {
    return { ok: false, response: errorResponse('Brand access denied', 403) };
  }

  const supabase = getSupabase(env);

  const { data: assignment } = await supabase
    .from('brand_user_assignments')
    .select('role')
    .eq('brand_id', brandId)
    .eq('admin_user_id', admin.adminUserId)
    .single();

  const role = typeof (assignment as any)?.role === 'string' ? (assignment as any).role : '';

  if (role === 'brand_admin') {
    return { ok: true };
  }

  return { ok: false, response: errorResponse('Brand access denied', 403) };
}
