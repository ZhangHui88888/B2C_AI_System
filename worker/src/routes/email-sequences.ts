/**
 * Email Sequences API routes
 * Welcome emails, repurchase reminders, automated campaigns
 */

import type { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { sendResendEmail } from '../utils/email';

const Tables = {
  EMAIL_SEQUENCES: 'email_sequences',
  EMAIL_SEQUENCE_STEPS: 'email_sequence_steps',
  EMAIL_SEQUENCE_ENROLLMENTS: 'email_sequence_enrollments',
  EMAIL_SEQUENCE_LOGS: 'email_sequence_logs',
  REPURCHASE_REMINDERS: 'repurchase_reminders',
  REPURCHASE_REMINDER_QUEUE: 'repurchase_reminder_queue',
  EMAIL_SUBSCRIPTIONS: 'email_subscriptions',
  CUSTOMERS: 'customers',
};

export async function handleEmailSequences(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // ============================================
  // SEQUENCE MANAGEMENT
  // ============================================

  // GET /api/email-sequences - List sequences
  if (request.method === 'GET' && path === '/api/email-sequences') {
    return await listSequences(supabase, brandId, request);
  }

  // POST /api/email-sequences - Create sequence
  if (request.method === 'POST' && path === '/api/email-sequences') {
    return await createSequence(supabase, brandId, request);
  }

  // GET /api/email-sequences/:id - Get sequence with steps
  if (request.method === 'GET' && path.match(/^\/api\/email-sequences\/[^/]+$/)) {
    const id = path.replace('/api/email-sequences/', '');
    return await getSequence(supabase, brandId, id);
  }

  // PUT /api/email-sequences/:id - Update sequence
  if (request.method === 'PUT' && path.match(/^\/api\/email-sequences\/[^/]+$/)) {
    const id = path.replace('/api/email-sequences/', '');
    return await updateSequence(supabase, brandId, id, request);
  }

  // DELETE /api/email-sequences/:id - Delete sequence
  if (request.method === 'DELETE' && path.match(/^\/api\/email-sequences\/[^/]+$/)) {
    const id = path.replace('/api/email-sequences/', '');
    return await deleteSequence(supabase, brandId, id);
  }

  // ============================================
  // SEQUENCE STEPS
  // ============================================

  // POST /api/email-sequences/:id/steps - Add step
  if (request.method === 'POST' && path.match(/^\/api\/email-sequences\/[^/]+\/steps$/)) {
    const sequenceId = path.replace('/api/email-sequences/', '').replace('/steps', '');
    return await addStep(supabase, sequenceId, request);
  }

  // PUT /api/email-sequences/:id/steps/:stepId - Update step
  if (request.method === 'PUT' && path.match(/^\/api\/email-sequences\/[^/]+\/steps\/[^/]+$/)) {
    const parts = path.split('/');
    const stepId = parts[parts.length - 1];
    return await updateStep(supabase, stepId, request);
  }

  // DELETE /api/email-sequences/:id/steps/:stepId - Delete step
  if (request.method === 'DELETE' && path.match(/^\/api\/email-sequences\/[^/]+\/steps\/[^/]+$/)) {
    const parts = path.split('/');
    const stepId = parts[parts.length - 1];
    return await deleteStep(supabase, stepId);
  }

  // ============================================
  // ENROLLMENTS
  // ============================================

  // GET /api/email-sequences/enrollments - List enrollments
  if (request.method === 'GET' && path === '/api/email-sequences/enrollments') {
    return await listEnrollments(supabase, brandId, request);
  }

  // POST /api/email-sequences/enroll - Enroll subscriber
  if (request.method === 'POST' && path === '/api/email-sequences/enroll') {
    return await enrollSubscriber(supabase, brandId, request);
  }

  // PUT /api/email-sequences/enrollments/:id/pause - Pause enrollment
  if (request.method === 'PUT' && path.match(/^\/api\/email-sequences\/enrollments\/[^/]+\/pause$/)) {
    const id = path.replace('/api/email-sequences/enrollments/', '').replace('/pause', '');
    return await updateEnrollmentStatus(supabase, id, 'paused');
  }

  // PUT /api/email-sequences/enrollments/:id/resume - Resume enrollment
  if (request.method === 'PUT' && path.match(/^\/api\/email-sequences\/enrollments\/[^/]+\/resume$/)) {
    const id = path.replace('/api/email-sequences/enrollments/', '').replace('/resume', '');
    return await updateEnrollmentStatus(supabase, id, 'active');
  }

  // PUT /api/email-sequences/enrollments/:id/cancel - Cancel enrollment
  if (request.method === 'PUT' && path.match(/^\/api\/email-sequences\/enrollments\/[^/]+\/cancel$/)) {
    const id = path.replace('/api/email-sequences/enrollments/', '').replace('/cancel', '');
    return await updateEnrollmentStatus(supabase, id, 'cancelled');
  }

  // ============================================
  // REPURCHASE REMINDERS
  // ============================================

  // GET /api/email-sequences/repurchase - List repurchase reminders
  if (request.method === 'GET' && path === '/api/email-sequences/repurchase') {
    return await listRepurchaseReminders(supabase, brandId);
  }

  // POST /api/email-sequences/repurchase - Create repurchase reminder
  if (request.method === 'POST' && path === '/api/email-sequences/repurchase') {
    return await createRepurchaseReminder(supabase, brandId, request);
  }

  // PUT /api/email-sequences/repurchase/:id - Update repurchase reminder
  if (request.method === 'PUT' && path.match(/^\/api\/email-sequences\/repurchase\/[^/]+$/)) {
    const id = path.replace('/api/email-sequences/repurchase/', '');
    return await updateRepurchaseReminder(supabase, id, request);
  }

  // DELETE /api/email-sequences/repurchase/:id - Delete repurchase reminder
  if (request.method === 'DELETE' && path.match(/^\/api\/email-sequences\/repurchase\/[^/]+$/)) {
    const id = path.replace('/api/email-sequences/repurchase/', '');
    return await deleteRepurchaseReminder(supabase, id);
  }

  // ============================================
  // CRON ENDPOINTS (for scheduled tasks)
  // ============================================

  // POST /api/email-sequences/process - Process pending emails (cron)
  if (request.method === 'POST' && path === '/api/email-sequences/process') {
    return await processSequenceEmails(supabase, env);
  }

  // POST /api/email-sequences/process-repurchase - Process repurchase reminders (cron)
  if (request.method === 'POST' && path === '/api/email-sequences/process-repurchase') {
    return await processRepurchaseReminders(supabase, env);
  }

  return errorResponse('Not found', 404);
}

// ============================================
// SEQUENCE MANAGEMENT FUNCTIONS
// ============================================

async function listSequences(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    let query = supabase
      .from(Tables.EMAIL_SEQUENCES)
      .select('*, email_sequence_steps(count)')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('sequence_type', type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return jsonResponse({ data });
  } catch (error: any) {
    console.error('List sequences error:', error);
    return errorResponse(error.message || 'Failed to list sequences', 500);
  }
}

async function createSequence(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      name,
      slug,
      description,
      sequence_type,
      trigger_event,
      trigger_delay_hours,
      is_active,
    } = body;

    if (!name || !sequence_type || !trigger_event) {
      return errorResponse('name, sequence_type, and trigger_event are required', 400);
    }

    const { data, error } = await supabase
      .from(Tables.EMAIL_SEQUENCES)
      .insert({
        brand_id: brandId,
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        sequence_type,
        trigger_event,
        trigger_delay_hours: trigger_delay_hours || 0,
        is_active: is_active !== false,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data }, 201);
  } catch (error: any) {
    console.error('Create sequence error:', error);
    return errorResponse(error.message || 'Failed to create sequence', 500);
  }
}

async function getSequence(
  supabase: any,
  brandId: string,
  id: string
): Promise<Response> {
  try {
    const { data: sequence, error } = await supabase
      .from(Tables.EMAIL_SEQUENCES)
      .select('*')
      .eq('brand_id', brandId)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!sequence) return errorResponse('Sequence not found', 404);

    // Get steps
    const { data: steps } = await supabase
      .from(Tables.EMAIL_SEQUENCE_STEPS)
      .select('*')
      .eq('sequence_id', id)
      .order('step_number', { ascending: true });

    // Get enrollment stats
    const { data: stats } = await supabase
      .from(Tables.EMAIL_SEQUENCE_ENROLLMENTS)
      .select('status')
      .eq('sequence_id', id);

    const enrollmentStats = {
      total: stats?.length || 0,
      active: stats?.filter((s: any) => s.status === 'active').length || 0,
      completed: stats?.filter((s: any) => s.status === 'completed').length || 0,
      converted: stats?.filter((s: any) => s.status === 'converted').length || 0,
    };

    return jsonResponse({
      data: {
        ...sequence,
        steps: steps || [],
        stats: enrollmentStats,
      },
    });
  } catch (error: any) {
    console.error('Get sequence error:', error);
    return errorResponse(error.message || 'Failed to get sequence', 500);
  }
}

async function updateSequence(
  supabase: any,
  brandId: string,
  id: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;

    const { data, error } = await supabase
      .from(Tables.EMAIL_SEQUENCES)
      .update(body)
      .eq('brand_id', brandId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Update sequence error:', error);
    return errorResponse(error.message || 'Failed to update sequence', 500);
  }
}

async function deleteSequence(
  supabase: any,
  brandId: string,
  id: string
): Promise<Response> {
  try {
    const { error } = await supabase
      .from(Tables.EMAIL_SEQUENCES)
      .delete()
      .eq('brand_id', brandId)
      .eq('id', id);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Delete sequence error:', error);
    return errorResponse(error.message || 'Failed to delete sequence', 500);
  }
}

// ============================================
// STEP MANAGEMENT FUNCTIONS
// ============================================

async function addStep(
  supabase: any,
  sequenceId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      step_number,
      name,
      subject,
      preview_text,
      html_content,
      plain_text_content,
      delay_hours,
      send_conditions,
    } = body;

    if (!name || !subject || !html_content) {
      return errorResponse('name, subject, and html_content are required', 400);
    }

    // Auto-calculate step number if not provided
    let stepNum = step_number;
    if (!stepNum) {
      const { data: existing } = await supabase
        .from(Tables.EMAIL_SEQUENCE_STEPS)
        .select('step_number')
        .eq('sequence_id', sequenceId)
        .order('step_number', { ascending: false })
        .limit(1);

      stepNum = (existing?.[0]?.step_number || 0) + 1;
    }

    const { data, error } = await supabase
      .from(Tables.EMAIL_SEQUENCE_STEPS)
      .insert({
        sequence_id: sequenceId,
        step_number: stepNum,
        name,
        subject,
        preview_text,
        html_content,
        plain_text_content,
        delay_hours: delay_hours || 0,
        send_conditions: send_conditions || {},
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data }, 201);
  } catch (error: any) {
    console.error('Add step error:', error);
    return errorResponse(error.message || 'Failed to add step', 500);
  }
}

async function updateStep(
  supabase: any,
  stepId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;

    const { data, error } = await supabase
      .from(Tables.EMAIL_SEQUENCE_STEPS)
      .update(body)
      .eq('id', stepId)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Update step error:', error);
    return errorResponse(error.message || 'Failed to update step', 500);
  }
}

async function deleteStep(supabase: any, stepId: string): Promise<Response> {
  try {
    const { error } = await supabase
      .from(Tables.EMAIL_SEQUENCE_STEPS)
      .delete()
      .eq('id', stepId);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Delete step error:', error);
    return errorResponse(error.message || 'Failed to delete step', 500);
  }
}

// ============================================
// ENROLLMENT FUNCTIONS
// ============================================

async function listEnrollments(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sequenceId = url.searchParams.get('sequence_id');
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from(Tables.EMAIL_SEQUENCE_ENROLLMENTS)
      .select('*, email_sequences(name, sequence_type)', { count: 'exact' })
      .eq('brand_id', brandId)
      .order('enrolled_at', { ascending: false });

    if (sequenceId) query = query.eq('sequence_id', sequenceId);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    return jsonResponse({
      data,
      pagination: { total: count || 0, limit, offset },
    });
  } catch (error: any) {
    console.error('List enrollments error:', error);
    return errorResponse(error.message || 'Failed to list enrollments', 500);
  }
}

async function enrollSubscriber(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { sequence_id, email, customer_id, trigger_data } = body;

    if (!sequence_id || !email) {
      return errorResponse('sequence_id and email are required', 400);
    }

    // Get sequence
    const { data: sequence } = await supabase
      .from(Tables.EMAIL_SEQUENCES)
      .select('trigger_delay_hours')
      .eq('id', sequence_id)
      .single();

    const delayHours = sequence?.trigger_delay_hours || 0;

    const { data, error } = await supabase
      .from(Tables.EMAIL_SEQUENCE_ENROLLMENTS)
      .insert({
        brand_id: brandId,
        sequence_id,
        email,
        customer_id,
        current_step: 0,
        status: 'active',
        next_email_at: new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString(),
        trigger_data: trigger_data || {},
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return errorResponse('Email already enrolled in this sequence', 409);
      }
      throw error;
    }

    return jsonResponse({ success: true, data }, 201);
  } catch (error: any) {
    console.error('Enroll subscriber error:', error);
    return errorResponse(error.message || 'Failed to enroll subscriber', 500);
  }
}

async function updateEnrollmentStatus(
  supabase: any,
  id: string,
  status: string
): Promise<Response> {
  try {
    const updateData: any = { status };

    if (status === 'active') {
      // Resume - set next email time
      updateData.next_email_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(Tables.EMAIL_SEQUENCE_ENROLLMENTS)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Update enrollment status error:', error);
    return errorResponse(error.message || 'Failed to update enrollment', 500);
  }
}

// ============================================
// REPURCHASE REMINDER FUNCTIONS
// ============================================

async function listRepurchaseReminders(
  supabase: any,
  brandId: string
): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from(Tables.REPURCHASE_REMINDERS)
      .select('*, products(name), categories(name)')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return jsonResponse({ data });
  } catch (error: any) {
    console.error('List repurchase reminders error:', error);
    return errorResponse(error.message || 'Failed to list reminders', 500);
  }
}

async function createRepurchaseReminder(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      name,
      product_id,
      category_id,
      reminder_days,
      subject,
      html_content,
      discount_code,
      discount_percent,
    } = body;

    if (!name || !reminder_days || !subject || !html_content) {
      return errorResponse('name, reminder_days, subject, and html_content are required', 400);
    }

    const { data, error } = await supabase
      .from(Tables.REPURCHASE_REMINDERS)
      .insert({
        brand_id: brandId,
        name,
        product_id,
        category_id,
        reminder_days,
        subject,
        html_content,
        discount_code,
        discount_percent,
      })
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data }, 201);
  } catch (error: any) {
    console.error('Create repurchase reminder error:', error);
    return errorResponse(error.message || 'Failed to create reminder', 500);
  }
}

async function updateRepurchaseReminder(
  supabase: any,
  id: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json() as any;

    const { data, error } = await supabase
      .from(Tables.REPURCHASE_REMINDERS)
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error('Update repurchase reminder error:', error);
    return errorResponse(error.message || 'Failed to update reminder', 500);
  }
}

async function deleteRepurchaseReminder(
  supabase: any,
  id: string
): Promise<Response> {
  try {
    const { error } = await supabase
      .from(Tables.REPURCHASE_REMINDERS)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error('Delete repurchase reminder error:', error);
    return errorResponse(error.message || 'Failed to delete reminder', 500);
  }
}

// ============================================
// CRON PROCESSING FUNCTIONS
// ============================================

async function processSequenceEmails(
  supabase: any,
  env: Env
): Promise<Response> {
  try {
    // Get pending emails using the helper function
    const { data: pending, error } = await supabase.rpc('get_pending_sequence_emails', {
      p_limit: 50,
    });

    if (error) throw error;

    const results = [];
    for (const item of pending || []) {
      try {
        // Check send conditions
        const conditions = item.send_conditions || {};
        let shouldSkip = false;

        if (conditions.skip_if_purchased && item.customer_id) {
          // Check if customer made a purchase since enrollment
          const { data: orders } = await supabase
            .from('orders')
            .select('id')
            .eq('brand_id', item.brand_id)
            .eq('customer_email', item.email)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (orders && orders.length > 0) {
            shouldSkip = true;
            // Mark as converted
            await supabase
              .from(Tables.EMAIL_SEQUENCE_ENROLLMENTS)
              .update({ status: 'converted', completed_at: new Date().toISOString() })
              .eq('id', item.enrollment_id);
          }
        }

        if (shouldSkip) {
          results.push({ enrollment_id: item.enrollment_id, status: 'skipped', reason: 'condition_not_met' });
          continue;
        }

        // Send email
        await sendResendEmail(env, {
          to: item.email,
          subject: item.subject,
          html: item.html_content,
        });

        // Log the send
        await supabase.from(Tables.EMAIL_SEQUENCE_LOGS).insert({
          enrollment_id: item.enrollment_id,
          step_id: item.step_id,
        });

        // Get next step delay
        const { data: nextStep } = await supabase
          .from(Tables.EMAIL_SEQUENCE_STEPS)
          .select('delay_hours')
          .eq('sequence_id', item.sequence_id)
          .eq('step_number', item.step_number + 1)
          .single();

        // Update enrollment
        const nextEmailAt = nextStep
          ? new Date(Date.now() + (nextStep.delay_hours || 24) * 60 * 60 * 1000).toISOString()
          : null;

        await supabase
          .from(Tables.EMAIL_SEQUENCE_ENROLLMENTS)
          .update({
            current_step: item.step_number,
            emails_sent: supabase.sql`emails_sent + 1`,
            last_email_at: new Date().toISOString(),
            next_email_at: nextEmailAt,
            status: nextStep ? 'active' : 'completed',
            completed_at: nextStep ? null : new Date().toISOString(),
          })
          .eq('id', item.enrollment_id);

        results.push({ enrollment_id: item.enrollment_id, status: 'sent' });
      } catch (sendError: any) {
        results.push({ enrollment_id: item.enrollment_id, status: 'failed', error: sendError.message });
      }
    }

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (error: any) {
    console.error('Process sequence emails error:', error);
    return errorResponse(error.message || 'Failed to process emails', 500);
  }
}

async function processRepurchaseReminders(
  supabase: any,
  env: Env
): Promise<Response> {
  try {
    // Get pending reminders
    const { data: pending, error } = await supabase.rpc('get_pending_repurchase_reminders', {
      p_limit: 50,
    });

    if (error) throw error;

    const results = [];
    for (const item of pending || []) {
      try {
        // Prepare email content with discount code
        let htmlContent = item.html_content;
        if (item.discount_code) {
          htmlContent = htmlContent.replace(/\{\{discount_code\}\}/g, item.discount_code);
        }
        if (item.discount_percent) {
          htmlContent = htmlContent.replace(/\{\{discount_percent\}\}/g, `${item.discount_percent}%`);
        }

        // Send email
        await sendResendEmail(env, {
          to: item.customer_email,
          subject: item.subject,
          html: htmlContent,
        });

        // Update queue status
        await supabase
          .from(Tables.REPURCHASE_REMINDER_QUEUE)
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', item.queue_id);

        results.push({ queue_id: item.queue_id, status: 'sent' });
      } catch (sendError: any) {
        await supabase
          .from(Tables.REPURCHASE_REMINDER_QUEUE)
          .update({ status: 'failed', send_error: sendError.message })
          .eq('id', item.queue_id);

        results.push({ queue_id: item.queue_id, status: 'failed', error: sendError.message });
      }
    }

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (error: any) {
    console.error('Process repurchase reminders error:', error);
    return errorResponse(error.message || 'Failed to process reminders', 500);
  }
}
