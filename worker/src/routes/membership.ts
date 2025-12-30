/**
 * Membership Levels Routes
 * Handles member levels, customer memberships, and level management
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleMembership(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 400);
  }

  // Member Levels
  if (path === '/api/membership/levels' && method === 'GET') {
    return handleGetLevels(supabase, brandId);
  }

  if (path === '/api/membership/levels' && method === 'POST') {
    return handleCreateLevel(request, supabase, brandId);
  }

  if (path.match(/^\/api\/membership\/levels\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop()!;
    return handleUpdateLevel(request, id, supabase, brandId);
  }

  if (path.match(/^\/api\/membership\/levels\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    return handleDeleteLevel(id, supabase, brandId);
  }

  // Initialize default levels
  if (path === '/api/membership/levels/init' && method === 'POST') {
    return handleInitDefaultLevels(supabase, brandId);
  }

  // Customer Memberships
  if (path === '/api/membership/customers' && method === 'GET') {
    return handleGetCustomerMemberships(request, supabase, brandId);
  }

  if (path.match(/^\/api\/membership\/customers\/[\w-]+$/) && method === 'GET') {
    const customerId = path.split('/').pop()!;
    return handleGetCustomerMembership(customerId, supabase, brandId);
  }

  if (path.match(/^\/api\/membership\/customers\/[\w-]+$/) && method === 'PUT') {
    const customerId = path.split('/').pop()!;
    return handleUpdateCustomerMembership(request, customerId, supabase, brandId);
  }

  // Recalculate levels
  if (path === '/api/membership/recalculate' && method === 'POST') {
    return handleRecalculateLevels(supabase, brandId);
  }

  // Level history
  if (path === '/api/membership/history' && method === 'GET') {
    return handleGetLevelHistory(request, supabase, brandId);
  }

  // Stats
  if (path === '/api/membership/stats' && method === 'GET') {
    return handleGetMembershipStats(supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Member Levels ====================

async function handleGetLevels(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('member_levels')
      .select('*')
      .eq('brand_id', brandId)
      .order('level_order');

    if (error) throw error;

    return jsonResponse({ levels: data || [] });
  } catch (error) {
    console.error('Error getting member levels:', error);
    return jsonResponse({ error: 'Failed to get member levels' }, 500);
  }
}

async function handleCreateLevel(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      level_name,
      level_code,
      level_order,
      min_points,
      min_orders,
      min_spent,
      points_multiplier,
      discount_percentage,
      free_shipping_threshold,
      exclusive_products,
      early_access_days,
      birthday_bonus_points,
      badge_color,
      badge_icon,
      description,
    } = body;

    if (!level_name || !level_code) {
      return jsonResponse({ error: 'level_name and level_code are required' }, 400);
    }

    const { data, error } = await supabase
      .from('member_levels')
      .insert({
        brand_id: brandId,
        level_name,
        level_code,
        level_order: level_order || 0,
        min_points: min_points || 0,
        min_orders: min_orders || 0,
        min_spent: min_spent || 0,
        points_multiplier: points_multiplier || 1.0,
        discount_percentage: discount_percentage || 0,
        free_shipping_threshold,
        exclusive_products: exclusive_products || false,
        early_access_days: early_access_days || 0,
        birthday_bonus_points: birthday_bonus_points || 0,
        badge_color,
        badge_icon,
        description,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error creating member level:', error);
    return jsonResponse({ error: 'Failed to create member level' }, 500);
  }
}

async function handleUpdateLevel(request: Request, id: string, supabase: any, brandId: string): Promise<Response> {
  try {
    const body = await request.json() as any;
    const updateData: any = { updated_at: new Date().toISOString() };

    const fields = [
      'level_name', 'level_code', 'level_order',
      'min_points', 'min_orders', 'min_spent',
      'points_multiplier', 'discount_percentage', 'free_shipping_threshold',
      'exclusive_products', 'early_access_days', 'birthday_bonus_points',
      'badge_color', 'badge_icon', 'description', 'is_active'
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('member_levels')
      .update(updateData)
      .eq('brand_id', brandId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error updating member level:', error);
    return jsonResponse({ error: 'Failed to update member level' }, 500);
  }
}

async function handleDeleteLevel(id: string, supabase: any, brandId: string): Promise<Response> {
  try {
    // Check if any customers are on this level
    const { data: members } = await supabase
      .from('customer_memberships')
      .select('id')
      .eq('brand_id', brandId)
      .eq('current_level_id', id)
      .limit(1);

    if (members && members.length > 0) {
      return jsonResponse({ error: 'Cannot delete level with active members' }, 400);
    }

    const { error } = await supabase
      .from('member_levels')
      .delete()
      .eq('brand_id', brandId)
      .eq('id', id);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error deleting member level:', error);
    return jsonResponse({ error: 'Failed to delete member level' }, 500);
  }
}

async function handleInitDefaultLevels(supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Check if levels already exist
    const { data: existing } = await supabase
      .from('member_levels')
      .select('id')
      .eq('brand_id', brandId)
      .limit(1);

    if (existing && existing.length > 0) {
      return jsonResponse({ message: 'Levels already exist', levels: existing.length });
    }

    const defaultLevels = [
      {
        level_name: 'Bronze',
        level_code: 'bronze',
        level_order: 1,
        min_points: 0,
        min_orders: 0,
        min_spent: 0,
        points_multiplier: 1.0,
        discount_percentage: 0,
        badge_color: '#CD7F32',
        description: 'Welcome to our loyalty program!',
      },
      {
        level_name: 'Silver',
        level_code: 'silver',
        level_order: 2,
        min_points: 500,
        min_orders: 3,
        min_spent: 100,
        points_multiplier: 1.25,
        discount_percentage: 5,
        badge_color: '#C0C0C0',
        description: 'Enjoy 5% off and earn points faster!',
      },
      {
        level_name: 'Gold',
        level_code: 'gold',
        level_order: 3,
        min_points: 2000,
        min_orders: 10,
        min_spent: 500,
        points_multiplier: 1.5,
        discount_percentage: 10,
        early_access_days: 1,
        badge_color: '#FFD700',
        description: '10% off plus early access to sales!',
      },
      {
        level_name: 'Platinum',
        level_code: 'platinum',
        level_order: 4,
        min_points: 5000,
        min_orders: 25,
        min_spent: 1500,
        points_multiplier: 2.0,
        discount_percentage: 15,
        free_shipping_threshold: 0,
        exclusive_products: true,
        early_access_days: 3,
        birthday_bonus_points: 500,
        badge_color: '#E5E4E2',
        description: 'VIP treatment with free shipping and exclusive products!',
      },
    ];

    const { data, error } = await supabase
      .from('member_levels')
      .insert(defaultLevels.map(level => ({ ...level, brand_id: brandId, is_active: true })))
      .select();

    if (error) throw error;

    return jsonResponse({
      success: true,
      levels_created: data?.length || 0,
      levels: data,
    });
  } catch (error) {
    console.error('Error initializing default levels:', error);
    return jsonResponse({ error: 'Failed to initialize default levels' }, 500);
  }
}

// ==================== Customer Memberships ====================

async function handleGetCustomerMemberships(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const levelId = url.searchParams.get('level_id');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('customer_memberships')
      .select(`
        *,
        customer:customers(id, email, first_name, last_name),
        current_level:member_levels(*)
      `, { count: 'exact' })
      .eq('brand_id', brandId)
      .order('lifetime_points', { ascending: false })
      .range(offset, offset + limit - 1);

    if (levelId) {
      query = query.eq('current_level_id', levelId);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return jsonResponse({
      memberships: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error getting customer memberships:', error);
    return jsonResponse({ error: 'Failed to get customer memberships' }, 500);
  }
}

async function handleGetCustomerMembership(customerId: string, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('customer_memberships')
      .select(`
        *,
        customer:customers(id, email, first_name, last_name),
        current_level:member_levels(*),
        referred_by_customer:customers!customer_memberships_referred_by_fkey(id, email, first_name, last_name)
      `)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return jsonResponse({ error: 'Membership not found' }, 404);
    }

    // Get recent points history
    const { data: history } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('brand_id', brandId)
      .eq('membership_id', data.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return jsonResponse({
      membership: data,
      recent_activity: history || [],
    });
  } catch (error) {
    console.error('Error getting customer membership:', error);
    return jsonResponse({ error: 'Failed to get customer membership' }, 500);
  }
}

async function handleUpdateCustomerMembership(request: Request, customerId: string, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { birthday, current_level_id } = body;

    const updateData: any = { updated_at: new Date().toISOString() };

    if (birthday) updateData.birthday = birthday;
    if (current_level_id) updateData.current_level_id = current_level_id;

    const { data, error } = await supabase
      .from('customer_memberships')
      .update(updateData)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .select(`
        *,
        current_level:member_levels(*)
      `)
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error updating customer membership:', error);
    return jsonResponse({ error: 'Failed to update customer membership' }, 500);
  }
}

// ==================== Recalculate Levels ====================

async function handleRecalculateLevels(supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get all memberships
    const { data: memberships } = await supabase
      .from('customer_memberships')
      .select('*')
      .eq('brand_id', brandId);

    // Get all levels
    const { data: levels } = await supabase
      .from('member_levels')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('level_order', { ascending: false });

    let updated = 0;
    let upgraded = 0;
    let downgraded = 0;

    for (const membership of memberships || []) {
      // Find appropriate level
      let newLevelId = null;
      for (const level of levels || []) {
        if (
          membership.lifetime_points >= (level.min_points || 0) &&
          membership.total_orders >= (level.min_orders || 0) &&
          membership.total_spent >= (level.min_spent || 0)
        ) {
          newLevelId = level.id;
          break;
        }
      }

      // Default to lowest level
      if (!newLevelId && levels && levels.length > 0) {
        newLevelId = levels[levels.length - 1].id;
      }

      if (newLevelId && newLevelId !== membership.current_level_id) {
        // Determine if upgrade or downgrade
        const oldLevelOrder = levels?.find((l: any) => l.id === membership.current_level_id)?.level_order || 0;
        const newLevelOrder = levels?.find((l: any) => l.id === newLevelId)?.level_order || 0;

        await supabase
          .from('customer_memberships')
          .update({
            current_level_id: newLevelId,
            level_updated_at: new Date().toISOString(),
          })
          .eq('brand_id', brandId)
          .eq('id', membership.id);

        // Record level change
        await supabase.from('level_history').insert({
          brand_id: brandId,
          customer_id: membership.customer_id,
          membership_id: membership.id,
          previous_level_id: membership.current_level_id,
          new_level_id: newLevelId,
          change_type: newLevelOrder > oldLevelOrder ? 'upgrade' : 'downgrade',
          reason: 'Scheduled level recalculation',
          points_at_change: membership.lifetime_points,
          orders_at_change: membership.total_orders,
          spent_at_change: membership.total_spent,
        });

        updated++;
        if (newLevelOrder > oldLevelOrder) upgraded++;
        else downgraded++;
      }
    }

    return jsonResponse({
      success: true,
      total_members: memberships?.length || 0,
      updated,
      upgraded,
      downgraded,
    });
  } catch (error) {
    console.error('Error recalculating levels:', error);
    return jsonResponse({ error: 'Failed to recalculate levels' }, 500);
  }
}

// ==================== Level History ====================

async function handleGetLevelHistory(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let query = supabase
      .from('level_history')
      .select(`
        *,
        previous_level:member_levels!level_history_previous_level_id_fkey(level_name, badge_color),
        new_level:member_levels!level_history_new_level_id_fkey(level_name, badge_color),
        customer:customers(email, first_name, last_name)
      `)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({ history: data || [] });
  } catch (error) {
    console.error('Error getting level history:', error);
    return jsonResponse({ error: 'Failed to get level history' }, 500);
  }
}

// ==================== Stats ====================

async function handleGetMembershipStats(supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get all memberships
    const { data: memberships } = await supabase
      .from('customer_memberships')
      .select('current_level_id, points_balance, lifetime_points, total_orders, total_spent')
      .eq('brand_id', brandId);

    // Get all levels
    const { data: levels } = await supabase
      .from('member_levels')
      .select('id, level_name, badge_color')
      .eq('brand_id', brandId)
      .order('level_order');

    const stats = {
      total_members: memberships?.length || 0,
      total_points_outstanding: 0,
      total_lifetime_points: 0,
      average_points_per_member: 0,
      by_level: {} as Record<string, number>,
    };

    for (const level of levels || []) {
      stats.by_level[level.level_name] = 0;
    }

    for (const m of memberships || []) {
      stats.total_points_outstanding += m.points_balance || 0;
      stats.total_lifetime_points += m.lifetime_points || 0;

      const levelName = levels?.find((l: any) => l.id === m.current_level_id)?.level_name || 'Unknown';
      stats.by_level[levelName] = (stats.by_level[levelName] || 0) + 1;
    }

    if (stats.total_members > 0) {
      stats.average_points_per_member = Math.round(stats.total_points_outstanding / stats.total_members);
    }

    return jsonResponse(stats);
  } catch (error) {
    console.error('Error getting membership stats:', error);
    return jsonResponse({ error: 'Failed to get membership stats' }, 500);
  }
}
