/**
 * Referral Program Routes
 * Handles referral codes, tracking, and rewards
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleReferrals(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  // Referral Config
  if (path === '/api/referrals/config' && method === 'GET') {
    return handleGetConfig(supabase, brandId);
  }

  if (path === '/api/referrals/config' && method === 'POST') {
    return handleSaveConfig(request, supabase, brandId);
  }

  // Validate referral code
  if (path === '/api/referrals/validate' && method === 'POST') {
    return handleValidateCode(request, supabase, brandId);
  }

  // Apply referral
  if (path === '/api/referrals/apply' && method === 'POST') {
    return handleApplyReferral(request, supabase, brandId);
  }

  // Complete referral (after qualifying purchase)
  if (path === '/api/referrals/complete' && method === 'POST') {
    return handleCompleteReferral(request, supabase, brandId);
  }

  // Get referrals for customer
  if (path === '/api/referrals/customer' && method === 'GET') {
    return handleGetCustomerReferrals(request, supabase, brandId);
  }

  // Get all referrals (admin)
  if (path === '/api/referrals' && method === 'GET') {
    return handleGetAllReferrals(request, supabase, brandId);
  }

  // Get referral stats
  if (path === '/api/referrals/stats' && method === 'GET') {
    return handleGetReferralStats(supabase, brandId);
  }

  // Generate share link
  if (path === '/api/referrals/share-link' && method === 'POST') {
    return handleGetShareLink(request, supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Referral Config ====================

async function handleGetConfig(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('referral_config')
      .select('*')
      .eq('brand_id', brandId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Return default config if none exists
    if (!data) {
      return jsonResponse({
        config: {
          referrer_points: 100,
          referee_points: 50,
          referrer_discount_amount: null,
          referrer_discount_percent: null,
          referee_discount_amount: null,
          referee_discount_percent: 10,
          min_order_amount: 0,
          require_first_purchase: true,
          max_referrals_per_customer: null,
          share_message: 'Join using my referral code and get 10% off your first order!',
          is_active: false,
        },
        is_default: true,
      });
    }

    return jsonResponse({ config: data, is_default: false });
  } catch (error) {
    console.error('Error getting referral config:', error);
    return jsonResponse({ error: 'Failed to get referral config' }, 500);
  }
}

async function handleSaveConfig(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      referrer_points,
      referrer_discount_amount,
      referrer_discount_percent,
      referee_points,
      referee_discount_amount,
      referee_discount_percent,
      min_order_amount,
      require_first_purchase,
      max_referrals_per_customer,
      share_message,
      email_subject,
      email_template,
      is_active,
    } = body;

    const configData = {
      brand_id: brandId,
      referrer_points: referrer_points || 0,
      referrer_discount_amount,
      referrer_discount_percent,
      referee_points: referee_points || 0,
      referee_discount_amount,
      referee_discount_percent,
      min_order_amount: min_order_amount || 0,
      require_first_purchase: require_first_purchase ?? true,
      max_referrals_per_customer,
      share_message,
      email_subject,
      email_template,
      is_active: is_active ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('referral_config')
      .upsert(configData, { onConflict: 'brand_id' })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error saving referral config:', error);
    return jsonResponse({ error: 'Failed to save referral config' }, 500);
  }
}

// ==================== Validate & Apply ====================

async function handleValidateCode(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { referral_code, customer_id } = body;

    if (!referral_code) {
      return jsonResponse({ error: 'referral_code is required' }, 400);
    }

    // Find the referrer by code
    const { data: referrer } = await supabase
      .from('customer_memberships')
      .select('*, customer:customers(id, email, first_name)')
      .eq('brand_id', brandId)
      .eq('referral_code', referral_code.toUpperCase())
      .single();

    if (!referrer) {
      return jsonResponse({ valid: false, error: 'Invalid referral code' }, 400);
    }

    // Can't refer yourself
    if (customer_id && referrer.customer_id === customer_id) {
      return jsonResponse({ valid: false, error: 'You cannot use your own referral code' }, 400);
    }

    // Check if already referred
    if (customer_id) {
      const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('brand_id', brandId)
        .eq('referee_id', customer_id)
        .limit(1);

      if (existing && existing.length > 0) {
        return jsonResponse({ valid: false, error: 'You have already been referred' }, 400);
      }
    }

    // Get config
    const { data: config } = await supabase
      .from('referral_config')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .single();

    if (!config) {
      return jsonResponse({ valid: false, error: 'Referral program is not active' }, 400);
    }

    // Check max referrals
    if (config.max_referrals_per_customer) {
      if (referrer.referral_count >= config.max_referrals_per_customer) {
        return jsonResponse({ valid: false, error: 'Referrer has reached maximum referrals' }, 400);
      }
    }

    return jsonResponse({
      valid: true,
      referrer: {
        first_name: referrer.customer?.first_name,
      },
      benefits: {
        referee_points: config.referee_points,
        referee_discount_amount: config.referee_discount_amount,
        referee_discount_percent: config.referee_discount_percent,
      },
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    return jsonResponse({ error: 'Failed to validate referral code' }, 500);
  }
}

async function handleApplyReferral(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { referral_code, referee_id } = body;

    if (!referral_code || !referee_id) {
      return jsonResponse({ error: 'referral_code and referee_id are required' }, 400);
    }

    // Validate first
    const { data: referrer } = await supabase
      .from('customer_memberships')
      .select('*')
      .eq('brand_id', brandId)
      .eq('referral_code', referral_code.toUpperCase())
      .single();

    if (!referrer) {
      return jsonResponse({ error: 'Invalid referral code' }, 400);
    }

    if (referrer.customer_id === referee_id) {
      return jsonResponse({ error: 'You cannot refer yourself' }, 400);
    }

    // Check if already referred
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('brand_id', brandId)
      .eq('referee_id', referee_id)
      .limit(1);

    if (existing && existing.length > 0) {
      return jsonResponse({ error: 'Already referred' }, 400);
    }

    // Get config
    const { data: config } = await supabase
      .from('referral_config')
      .select('*')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .single();

    if (!config) {
      return jsonResponse({ error: 'Referral program is not active' }, 400);
    }

    // Calculate expiration (30 days to complete)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create referral record
    const { data: referral, error } = await supabase
      .from('referrals')
      .insert({
        brand_id: brandId,
        referrer_id: referrer.customer_id,
        referee_id,
        referral_code: referral_code.toUpperCase(),
        status: 'pending',
        referrer_reward_type: config.referrer_points ? 'points' : config.referrer_discount_amount ? 'discount_fixed' : 'discount_percent',
        referrer_reward_amount: config.referrer_points || config.referrer_discount_amount || config.referrer_discount_percent,
        referee_reward_type: config.referee_points ? 'points' : config.referee_discount_amount ? 'discount_fixed' : 'discount_percent',
        referee_reward_amount: config.referee_points || config.referee_discount_amount || config.referee_discount_percent,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update referee's membership with referred_by
    await supabase
      .from('customer_memberships')
      .update({ referred_by: referrer.customer_id })
      .eq('brand_id', brandId)
      .eq('customer_id', referee_id);

    return jsonResponse({
      success: true,
      referral,
      message: config.require_first_purchase
        ? 'Referral applied! Complete a purchase to receive your reward.'
        : 'Referral applied!',
    });
  } catch (error) {
    console.error('Error applying referral:', error);
    return jsonResponse({ error: 'Failed to apply referral' }, 500);
  }
}

async function handleCompleteReferral(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { order_id, referee_id, order_amount } = body;

    if (!order_id || !referee_id) {
      return jsonResponse({ error: 'order_id and referee_id are required' }, 400);
    }

    // Find pending referral
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('brand_id', brandId)
      .eq('referee_id', referee_id)
      .eq('status', 'pending')
      .single();

    if (!referral) {
      return jsonResponse({ message: 'No pending referral found' });
    }

    // Check if expired
    if (referral.expires_at && new Date(referral.expires_at) < new Date()) {
      await supabase
        .from('referrals')
        .update({ status: 'expired' })
        .eq('id', referral.id);
      return jsonResponse({ error: 'Referral has expired' }, 400);
    }

    // Get config
    const { data: config } = await supabase
      .from('referral_config')
      .select('*')
      .eq('brand_id', brandId)
      .single();

    // Check min order amount
    if (config?.min_order_amount && order_amount < config.min_order_amount) {
      return jsonResponse({
        error: `Minimum order amount of ${config.min_order_amount} required`,
      }, 400);
    }

    // Update referral status
    await supabase
      .from('referrals')
      .update({
        status: 'completed',
        qualifying_order_id: order_id,
        order_amount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', referral.id);

    const rewards: any = { referrer: null, referee: null };

    // Award referrer
    if (referral.referrer_reward_type === 'points' && referral.referrer_reward_amount) {
      const { data: referrerMembership } = await supabase
        .from('customer_memberships')
        .select('id, points_balance')
        .eq('brand_id', brandId)
        .eq('customer_id', referral.referrer_id)
        .single();

      if (referrerMembership) {
        const newBalance = referrerMembership.points_balance + referral.referrer_reward_amount;

        await supabase.from('points_ledger').insert({
          brand_id: brandId,
          customer_id: referral.referrer_id,
          membership_id: referrerMembership.id,
          transaction_type: 'earn_referral',
          points_amount: referral.referrer_reward_amount,
          points_balance_after: newBalance,
          reference_type: 'referral',
          reference_id: referral.id,
          description: 'Referral reward',
        });

        // Update referral count
        await supabase
          .from('customer_memberships')
          .update({ referral_count: supabase.raw('referral_count + 1') })
          .eq('id', referrerMembership.id);

        rewards.referrer = { type: 'points', amount: referral.referrer_reward_amount };
      }

      await supabase
        .from('referrals')
        .update({
          referrer_reward_given: true,
          referrer_reward_given_at: new Date().toISOString(),
        })
        .eq('id', referral.id);
    }

    // Award referee
    if (referral.referee_reward_type === 'points' && referral.referee_reward_amount) {
      const { data: refereeMembership } = await supabase
        .from('customer_memberships')
        .select('id, points_balance')
        .eq('brand_id', brandId)
        .eq('customer_id', referee_id)
        .single();

      if (refereeMembership) {
        const newBalance = refereeMembership.points_balance + referral.referee_reward_amount;

        await supabase.from('points_ledger').insert({
          brand_id: brandId,
          customer_id: referee_id,
          membership_id: refereeMembership.id,
          transaction_type: 'earn_referral',
          points_amount: referral.referee_reward_amount,
          points_balance_after: newBalance,
          reference_type: 'referral',
          reference_id: referral.id,
          description: 'Welcome referral bonus',
        });

        rewards.referee = { type: 'points', amount: referral.referee_reward_amount };
      }

      await supabase
        .from('referrals')
        .update({
          referee_reward_given: true,
          referee_reward_given_at: new Date().toISOString(),
        })
        .eq('id', referral.id);
    }

    return jsonResponse({
      success: true,
      referral_id: referral.id,
      rewards,
    });
  } catch (error) {
    console.error('Error completing referral:', error);
    return jsonResponse({ error: 'Failed to complete referral' }, 500);
  }
}

// ==================== Get Referrals ====================

async function handleGetCustomerReferrals(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customer_id');

    if (!customerId) {
      return jsonResponse({ error: 'customer_id is required' }, 400);
    }

    // Get customer's referral code
    const { data: membership } = await supabase
      .from('customer_memberships')
      .select('referral_code, referral_count')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .single();

    // Get referrals made by this customer
    const { data: referrals } = await supabase
      .from('referrals')
      .select(`
        *,
        referee:customers!referrals_referee_id_fkey(email, first_name)
      `)
      .eq('brand_id', brandId)
      .eq('referrer_id', customerId)
      .order('referred_at', { ascending: false });

    // Calculate stats
    const stats = {
      total_referrals: referrals?.length || 0,
      completed: referrals?.filter((r: any) => r.status === 'completed').length || 0,
      pending: referrals?.filter((r: any) => r.status === 'pending').length || 0,
      total_points_earned: referrals
        ?.filter((r: any) => r.referrer_reward_given && r.referrer_reward_type === 'points')
        .reduce((sum: number, r: any) => sum + (r.referrer_reward_amount || 0), 0) || 0,
    };

    return jsonResponse({
      referral_code: membership?.referral_code,
      referrals: referrals || [],
      stats,
    });
  } catch (error) {
    console.error('Error getting customer referrals:', error);
    return jsonResponse({ error: 'Failed to get customer referrals' }, 500);
  }
}

async function handleGetAllReferrals(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    let query = supabase
      .from('referrals')
      .select(`
        *,
        referrer:customers!referrals_referrer_id_fkey(email, first_name, last_name),
        referee:customers!referrals_referee_id_fkey(email, first_name, last_name)
      `)
      .eq('brand_id', brandId)
      .order('referred_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({ referrals: data || [] });
  } catch (error) {
    console.error('Error getting all referrals:', error);
    return jsonResponse({ error: 'Failed to get referrals' }, 500);
  }
}

// ==================== Stats ====================

async function handleGetReferralStats(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data: referrals } = await supabase
      .from('referrals')
      .select('status, order_amount, referrer_reward_amount, referrer_reward_type, referrer_reward_given')
      .eq('brand_id', brandId);

    const stats = {
      total_referrals: referrals?.length || 0,
      by_status: {
        pending: 0,
        completed: 0,
        expired: 0,
        cancelled: 0,
      },
      total_revenue_from_referrals: 0,
      total_points_awarded: 0,
      conversion_rate: 0,
    };

    for (const r of referrals || []) {
      stats.by_status[r.status as keyof typeof stats.by_status]++;

      if (r.status === 'completed') {
        stats.total_revenue_from_referrals += parseFloat(r.order_amount || 0);
      }

      if (r.referrer_reward_given && r.referrer_reward_type === 'points') {
        stats.total_points_awarded += r.referrer_reward_amount || 0;
      }
    }

    if (stats.total_referrals > 0) {
      stats.conversion_rate = Math.round((stats.by_status.completed / stats.total_referrals) * 100);
    }

    return jsonResponse(stats);
  } catch (error) {
    console.error('Error getting referral stats:', error);
    return jsonResponse({ error: 'Failed to get referral stats' }, 500);
  }
}

// ==================== Share Link ====================

async function handleGetShareLink(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { customer_id, base_url } = body;

    if (!customer_id) {
      return jsonResponse({ error: 'customer_id is required' }, 400);
    }

    // Get or create referral code
    let { data: membership } = await supabase
      .from('customer_memberships')
      .select('referral_code')
      .eq('brand_id', brandId)
      .eq('customer_id', customer_id)
      .single();

    if (!membership?.referral_code) {
      // Generate code
      const referralCode = generateReferralCode();
      await supabase
        .from('customer_memberships')
        .update({ referral_code: referralCode })
        .eq('brand_id', brandId)
        .eq('customer_id', customer_id);
      membership = { referral_code: referralCode };
    }

    // Get config for share message
    const { data: config } = await supabase
      .from('referral_config')
      .select('share_message')
      .eq('brand_id', brandId)
      .single();

    const shareUrl = `${base_url || ''}?ref=${membership.referral_code}`;

    return jsonResponse({
      referral_code: membership.referral_code,
      share_url: shareUrl,
      share_message: config?.share_message || `Use my referral code ${membership.referral_code} for a special discount!`,
    });
  } catch (error) {
    console.error('Error getting share link:', error);
    return jsonResponse({ error: 'Failed to get share link' }, 500);
  }
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
