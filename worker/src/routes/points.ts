/**
 * Points System Routes
 * Handles points earning, redemption, and management
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handlePoints(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  // Points Rules
  if (path === '/api/points/rules' && method === 'GET') {
    return handleGetRules(supabase, brandId);
  }

  if (path === '/api/points/rules' && method === 'POST') {
    return handleCreateRule(request, supabase, brandId);
  }

  if (path.match(/^\/api\/points\/rules\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop()!;
    return handleUpdateRule(request, id, supabase);
  }

  if (path.match(/^\/api\/points\/rules\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    return handleDeleteRule(id, supabase);
  }

  // Points Redemption Options
  if (path === '/api/points/redemptions' && method === 'GET') {
    return handleGetRedemptionOptions(supabase, brandId);
  }

  if (path === '/api/points/redemptions' && method === 'POST') {
    return handleCreateRedemptionOption(request, supabase, brandId);
  }

  if (path.match(/^\/api\/points\/redemptions\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop()!;
    return handleUpdateRedemptionOption(request, id, supabase);
  }

  // Customer Points
  if (path === '/api/points/balance' && method === 'GET') {
    return handleGetBalance(request, supabase, brandId);
  }

  if (path === '/api/points/history' && method === 'GET') {
    return handleGetHistory(request, supabase, brandId);
  }

  if (path === '/api/points/earn' && method === 'POST') {
    return handleEarnPoints(request, supabase, brandId);
  }

  if (path === '/api/points/redeem' && method === 'POST') {
    return handleRedeemPoints(request, supabase, brandId);
  }

  if (path === '/api/points/adjust' && method === 'POST') {
    return handleAdjustPoints(request, supabase, brandId);
  }

  // Calculate points for order
  if (path === '/api/points/calculate' && method === 'POST') {
    return handleCalculatePoints(request, supabase, brandId);
  }

  // Expire points (cron job)
  if (path === '/api/points/expire' && method === 'POST') {
    return handleExpirePoints(supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Points Rules ====================

async function handleGetRules(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('points_rules')
      .select('*')
      .eq('brand_id', brandId)
      .order('priority', { ascending: false });

    if (error) throw error;

    return jsonResponse({ rules: data || [] });
  } catch (error) {
    console.error('Error getting points rules:', error);
    return jsonResponse({ error: 'Failed to get points rules' }, 500);
  }
}

async function handleCreateRule(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      rule_name,
      rule_type,
      points_per_dollar,
      fixed_points,
      min_order_amount,
      max_points_per_order,
      points_validity_days,
      start_date,
      end_date,
      priority,
    } = body;

    if (!rule_name || !rule_type) {
      return jsonResponse({ error: 'rule_name and rule_type are required' }, 400);
    }

    const { data, error } = await supabase
      .from('points_rules')
      .insert({
        brand_id: brandId,
        rule_name,
        rule_type,
        points_per_dollar,
        fixed_points,
        min_order_amount,
        max_points_per_order,
        points_validity_days: points_validity_days || 365,
        start_date,
        end_date,
        priority: priority || 0,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error creating points rule:', error);
    return jsonResponse({ error: 'Failed to create points rule' }, 500);
  }
}

async function handleUpdateRule(request: Request, id: string, supabase: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const updateData: any = { updated_at: new Date().toISOString() };

    const fields = [
      'rule_name', 'rule_type', 'points_per_dollar', 'fixed_points',
      'min_order_amount', 'max_points_per_order', 'points_validity_days',
      'start_date', 'end_date', 'is_active', 'priority'
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('points_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error updating points rule:', error);
    return jsonResponse({ error: 'Failed to update points rule' }, 500);
  }
}

async function handleDeleteRule(id: string, supabase: any): Promise<Response> {
  try {
    const { error } = await supabase
      .from('points_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error deleting points rule:', error);
    return jsonResponse({ error: 'Failed to delete points rule' }, 500);
  }
}

// ==================== Redemption Options ====================

async function handleGetRedemptionOptions(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('points_redemptions')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('points_required');

    if (error) throw error;

    return jsonResponse({ redemptions: data || [] });
  } catch (error) {
    console.error('Error getting redemption options:', error);
    return jsonResponse({ error: 'Failed to get redemption options' }, 500);
  }
}

async function handleCreateRedemptionOption(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      redemption_name,
      redemption_type,
      points_required,
      discount_amount,
      discount_percent,
      product_id,
      min_order_amount,
      max_uses_per_customer,
      total_uses_limit,
      description,
      image_url,
      start_date,
      end_date,
    } = body;

    if (!redemption_name || !redemption_type || !points_required) {
      return jsonResponse({ error: 'redemption_name, redemption_type, and points_required are required' }, 400);
    }

    const { data, error } = await supabase
      .from('points_redemptions')
      .insert({
        brand_id: brandId,
        redemption_name,
        redemption_type,
        points_required,
        discount_amount,
        discount_percent,
        product_id,
        min_order_amount,
        max_uses_per_customer,
        total_uses_limit,
        description,
        image_url,
        start_date,
        end_date,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error creating redemption option:', error);
    return jsonResponse({ error: 'Failed to create redemption option' }, 500);
  }
}

async function handleUpdateRedemptionOption(request: Request, id: string, supabase: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const updateData: any = { updated_at: new Date().toISOString() };

    const fields = [
      'redemption_name', 'redemption_type', 'points_required',
      'discount_amount', 'discount_percent', 'product_id',
      'min_order_amount', 'max_uses_per_customer', 'total_uses_limit',
      'description', 'image_url', 'start_date', 'end_date', 'is_active'
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const { data, error } = await supabase
      .from('points_redemptions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error updating redemption option:', error);
    return jsonResponse({ error: 'Failed to update redemption option' }, 500);
  }
}

// ==================== Customer Points ====================

async function handleGetBalance(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');

    if (!customerId) {
      return jsonResponse({ error: 'customer_id is required' }, 400);
    }

    const { data: membership, error } = await supabase
      .from('customer_memberships')
      .select(`
        *,
        current_level:member_levels(*)
      `)
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!membership) {
      // Create membership if not exists
      const newMembership = await createMembership(supabase, brandId, customerId);
      return jsonResponse(newMembership);
    }

    return jsonResponse(membership);
  } catch (error) {
    console.error('Error getting points balance:', error);
    return jsonResponse({ error: 'Failed to get points balance' }, 500);
  }
}

async function createMembership(supabase: any, brandId: string | null, customerId: string): Promise<any> {
  // Get default level
  const { data: defaultLevel } = await supabase
    .from('member_levels')
    .select('id')
    .eq('brand_id', brandId)
    .eq('is_active', true)
    .order('level_order')
    .limit(1)
    .single();

  // Generate referral code
  const referralCode = generateReferralCode();

  const { data, error } = await supabase
    .from('customer_memberships')
    .insert({
      brand_id: brandId,
      customer_id: customerId,
      current_level_id: defaultLevel?.id,
      points_balance: 0,
      lifetime_points: 0,
      total_orders: 0,
      total_spent: 0,
      referral_code: referralCode,
    })
    .select(`
      *,
      current_level:member_levels(*)
    `)
    .single();

  if (error) throw error;
  return data;
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function handleGetHistory(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    if (!customerId) {
      return jsonResponse({ error: 'customer_id is required' }, 400);
    }

    const { data, error } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return jsonResponse({ history: data || [] });
  } catch (error) {
    console.error('Error getting points history:', error);
    return jsonResponse({ error: 'Failed to get points history' }, 500);
  }
}

async function handleEarnPoints(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      customer_id,
      transaction_type,
      points_amount,
      reference_type,
      reference_id,
      description,
    } = body;

    if (!customer_id || !transaction_type || !points_amount) {
      return jsonResponse({ error: 'customer_id, transaction_type, and points_amount are required' }, 400);
    }

    // Get or create membership
    let { data: membership } = await supabase
      .from('customer_memberships')
      .select('*, current_level:member_levels(*)')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .single();

    if (!membership) {
      membership = await createMembership(supabase, brandId, customer_id);
    }

    // Get points validity
    const { data: rule } = await supabase
      .from('points_rules')
      .select('points_validity_days')
      .eq('brand_id', brandId)
      .eq('rule_type', 'purchase')
      .eq('is_active', true)
      .limit(1)
      .single();

    const validityDays = rule?.points_validity_days || 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    // Apply level multiplier
    const multiplier = membership.current_level?.points_multiplier || 1.0;
    const finalPoints = Math.floor(points_amount * multiplier);
    const newBalance = membership.points_balance + finalPoints;

    // Create ledger entry
    const { data: ledger, error } = await supabase
      .from('points_ledger')
      .insert({
        brand_id: brandId,
        customer_id,
        membership_id: membership.id,
        transaction_type,
        points_amount: finalPoints,
        points_balance_after: newBalance,
        reference_type,
        reference_id,
        description: description || `Earned ${finalPoints} points`,
        multiplier_applied: multiplier,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({
      success: true,
      points_earned: finalPoints,
      multiplier,
      new_balance: newBalance,
      ledger,
    });
  } catch (error) {
    console.error('Error earning points:', error);
    return jsonResponse({ error: 'Failed to earn points' }, 500);
  }
}

async function handleRedeemPoints(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { customer_id, redemption_id, order_id } = body;

    if (!customer_id || !redemption_id) {
      return jsonResponse({ error: 'customer_id and redemption_id are required' }, 400);
    }

    // Get membership
    const { data: membership } = await supabase
      .from('customer_memberships')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .single();

    if (!membership) {
      return jsonResponse({ error: 'Membership not found' }, 404);
    }

    // Get redemption option
    const { data: redemption } = await supabase
      .from('points_redemptions')
      .select('*')
      .eq('id', redemption_id)
      .eq('is_active', true)
      .single();

    if (!redemption) {
      return jsonResponse({ error: 'Redemption option not found' }, 404);
    }

    // Check balance
    if (membership.points_balance < redemption.points_required) {
      return jsonResponse({
        error: 'Insufficient points',
        required: redemption.points_required,
        available: membership.points_balance,
      }, 400);
    }

    // Check usage limits
    if (redemption.total_uses_limit && redemption.current_uses >= redemption.total_uses_limit) {
      return jsonResponse({ error: 'Redemption limit reached' }, 400);
    }

    const newBalance = membership.points_balance - redemption.points_required;

    // Create ledger entry
    const { data: ledger, error } = await supabase
      .from('points_ledger')
      .insert({
        brand_id: brandId,
        customer_id,
        membership_id: membership.id,
        transaction_type: `redeem_${redemption.redemption_type}`,
        points_amount: -redemption.points_required,
        points_balance_after: newBalance,
        reference_type: 'redemption',
        reference_id: redemption_id,
        description: `Redeemed: ${redemption.redemption_name}`,
      })
      .select()
      .single();

    if (error) throw error;

    // Update redemption usage count
    await supabase
      .from('points_redemptions')
      .update({ current_uses: redemption.current_uses + 1 })
      .eq('id', redemption_id);

    // Generate reward
    let reward: any = {
      type: redemption.redemption_type,
      name: redemption.redemption_name,
    };

    if (redemption.redemption_type === 'discount_fixed') {
      reward.discount_amount = redemption.discount_amount;
    } else if (redemption.redemption_type === 'discount_percent') {
      reward.discount_percent = redemption.discount_percent;
    } else if (redemption.redemption_type === 'free_shipping') {
      reward.free_shipping = true;
    } else if (redemption.redemption_type === 'free_product') {
      reward.product_id = redemption.product_id;
    }

    return jsonResponse({
      success: true,
      points_redeemed: redemption.points_required,
      new_balance: newBalance,
      reward,
      ledger,
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    return jsonResponse({ error: 'Failed to redeem points' }, 500);
  }
}

async function handleAdjustPoints(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { customer_id, points_amount, reason } = body;

    if (!customer_id || points_amount === undefined) {
      return jsonResponse({ error: 'customer_id and points_amount are required' }, 400);
    }

    // Get membership
    const { data: membership } = await supabase
      .from('customer_memberships')
      .select('*')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .single();

    if (!membership) {
      return jsonResponse({ error: 'Membership not found' }, 404);
    }

    const newBalance = membership.points_balance + points_amount;

    if (newBalance < 0) {
      return jsonResponse({ error: 'Adjustment would result in negative balance' }, 400);
    }

    // Create ledger entry
    const { data: ledger, error } = await supabase
      .from('points_ledger')
      .insert({
        brand_id: brandId,
        customer_id,
        membership_id: membership.id,
        transaction_type: 'adjust',
        points_amount,
        points_balance_after: newBalance,
        description: reason || 'Manual adjustment',
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({
      success: true,
      adjustment: points_amount,
      new_balance: newBalance,
      ledger,
    });
  } catch (error) {
    console.error('Error adjusting points:', error);
    return jsonResponse({ error: 'Failed to adjust points' }, 500);
  }
}

async function handleCalculatePoints(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { order_amount, customer_id } = body;

    if (!order_amount) {
      return jsonResponse({ error: 'order_amount is required' }, 400);
    }

    // Get active rule
    const { data: rule } = await supabase
      .from('points_rules')
      .select('*')
      .eq('brand_id', brandId)
      .eq('rule_type', 'purchase')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (!rule) {
      return jsonResponse({ points: 0, message: 'No active points rule' });
    }

    // Check min order amount
    if (rule.min_order_amount && order_amount < rule.min_order_amount) {
      return jsonResponse({
        points: 0,
        message: `Minimum order amount is ${rule.min_order_amount}`,
      });
    }

    // Get customer multiplier
    let multiplier = 1.0;
    if (customer_id) {
      const { data: membership } = await supabase
        .from('customer_memberships')
        .select('current_level:member_levels(points_multiplier)')
        .eq('brand_id', brandId)
        .eq('customer_id', customer_id)
        .single();

      multiplier = membership?.current_level?.points_multiplier || 1.0;
    }

    let points = 0;
    if (rule.points_per_dollar) {
      points = Math.floor(order_amount * rule.points_per_dollar * multiplier);
    } else if (rule.fixed_points) {
      points = Math.floor(rule.fixed_points * multiplier);
    }

    if (rule.max_points_per_order && points > rule.max_points_per_order) {
      points = rule.max_points_per_order;
    }

    return jsonResponse({
      points,
      multiplier,
      rule_applied: rule.rule_name,
    });
  } catch (error) {
    console.error('Error calculating points:', error);
    return jsonResponse({ error: 'Failed to calculate points' }, 500);
  }
}

async function handleExpirePoints(supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get expired points entries
    const { data: expiredEntries } = await supabase
      .from('points_ledger')
      .select('*')
      .eq('brand_id', brandId)
      .lt('expires_at', new Date().toISOString())
      .is('expired_at', null)
      .gt('points_amount', 0);

    let totalExpired = 0;

    for (const entry of expiredEntries || []) {
      // Mark as expired
      await supabase
        .from('points_ledger')
        .update({ expired_at: new Date().toISOString() })
        .eq('id', entry.id);

      // Get current balance
      const { data: membership } = await supabase
        .from('customer_memberships')
        .select('points_balance')
        .eq('id', entry.membership_id)
        .single();

      if (membership) {
        const newBalance = Math.max(0, membership.points_balance - entry.points_amount);

        // Create expiration ledger entry
        await supabase.from('points_ledger').insert({
          brand_id: brandId,
          customer_id: entry.customer_id,
          membership_id: entry.membership_id,
          transaction_type: 'expire',
          points_amount: -entry.points_amount,
          points_balance_after: newBalance,
          description: 'Points expired',
        });

        totalExpired++;
      }
    }

    return jsonResponse({
      success: true,
      entries_expired: totalExpired,
    });
  } catch (error) {
    console.error('Error expiring points:', error);
    return jsonResponse({ error: 'Failed to expire points' }, 500);
  }
}
