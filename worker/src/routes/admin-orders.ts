/**
 * Admin Order API routes
 * Order management operations for admin panel
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { sendResendEmail } from '../utils/email';
import Stripe from 'stripe';

const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed'];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled', 'failed'],
  paid: ['processing', 'shipped', 'refunded'],
  processing: ['shipped', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
  failed: [],
};

function isValidTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) || false;
}

export async function handleAdminOrders(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);

  // GET /api/admin/orders/:id - Get order details (admin view)
  if (path.match(/^\/api\/admin\/orders\/[^\/]+$/) && request.method === 'GET') {
    const id = path.replace('/api/admin/orders/', '');
    
    try {
      const { data: order, error } = await supabase
        .from(Tables.ORDERS)
        .select('*')
        .eq('id', id)
        .single();

      if (error || !order) {
        return errorResponse('Order not found', 404);
      }

      return jsonResponse({ success: true, order });
    } catch (err) {
      console.error('Error fetching order:', err);
      return errorResponse('Failed to fetch order', 500);
    }
  }

  // PUT /api/admin/orders/:id/status - Update order status
  if (path.match(/^\/api\/admin\/orders\/[^\/]+\/status$/) && request.method === 'PUT') {
    const id = path.replace('/api/admin/orders/', '').replace('/status', '');
    
    try {
      const { status } = await request.json() as { status: string };

      if (!status || !VALID_STATUSES.includes(status)) {
        return errorResponse('Invalid status', 400);
      }

      // Get current order
      const { data: order, error: fetchError } = await supabase
        .from(Tables.ORDERS)
        .select('id, status')
        .eq('id', id)
        .single();

      if (fetchError || !order) {
        return errorResponse('Order not found', 404);
      }

      // Validate transition
      if (!isValidTransition(order.status, status)) {
        return errorResponse(`Cannot transition from ${order.status} to ${status}`, 400);
      }

      // Update status
      const { error } = await supabase
        .from(Tables.ORDERS)
        .update({ status })
        .eq('id', id);

      if (error) {
        console.error('Error updating order status:', error);
        return errorResponse('Failed to update status', 500);
      }

      return jsonResponse({ success: true, status });
    } catch (err) {
      console.error('Error updating order status:', err);
      return errorResponse('Failed to update status', 500);
    }
  }

  // PUT /api/admin/orders/:id/shipping - Update shipping/tracking info
  if (path.match(/^\/api\/admin\/orders\/[^\/]+\/shipping$/) && request.method === 'PUT') {
    const id = path.replace('/api/admin/orders/', '').replace('/shipping', '');
    
    try {
      const { tracking_number, tracking_url, mark_shipped, send_notification } = await request.json() as {
        tracking_number: string;
        tracking_url?: string;
        mark_shipped?: boolean;
        send_notification?: boolean;
      };

      if (!tracking_number) {
        return errorResponse('Tracking number is required', 400);
      }

      // Get current order
      const { data: order, error: fetchError } = await supabase
        .from(Tables.ORDERS)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !order) {
        return errorResponse('Order not found', 404);
      }

      // Update tracking info
      const updateData: Record<string, unknown> = {
        tracking_number,
        tracking_url: tracking_url || null,
      };

      if (mark_shipped && (order.status === 'paid' || order.status === 'processing')) {
        updateData.status = 'shipped';
      }

      const { error } = await supabase
        .from(Tables.ORDERS)
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating shipping info:', error);
        return errorResponse('Failed to update shipping info', 500);
      }

      // Send shipping notification email
      if (send_notification && order.customer_email) {
        try {
          const trackingLink = tracking_url 
            ? `<a href="${tracking_url}" style="color:#4F46E5;">Track your package</a>`
            : '';

          await sendResendEmail(env, {
            to: order.customer_email,
            subject: `Your order has been shipped! ${order.order_number ? `(${order.order_number})` : ''}`,
            html: `
              <div style="font-family:Inter,Arial,sans-serif; line-height:1.5;">
                <h2 style="margin:0 0 12px;">Good news, ${order.customer_name || 'Customer'}!</h2>
                <p>Your order has been shipped and is on its way to you.</p>
                <div style="margin:16px 0; padding:16px; background:#f3f4f6; border-radius:8px;">
                  <p style="margin:0 0 8px;"><strong>Tracking Number:</strong> ${tracking_number}</p>
                  ${trackingLink ? `<p style="margin:0;">${trackingLink}</p>` : ''}
                </div>
                <p style="color:#666; font-size:12px;">If you have any questions, reply to this email.</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error('Failed to send shipping notification:', emailErr);
        }
      }

      return jsonResponse({ success: true });
    } catch (err) {
      console.error('Error updating shipping info:', err);
      return errorResponse('Failed to update shipping info', 500);
    }
  }

  // PUT /api/admin/orders/:id/notes - Update order notes
  if (path.match(/^\/api\/admin\/orders\/[^\/]+\/notes$/) && request.method === 'PUT') {
    const id = path.replace('/api/admin/orders/', '').replace('/notes', '');
    
    try {
      const { notes } = await request.json() as { notes: string };

      const { error } = await supabase
        .from(Tables.ORDERS)
        .update({ notes: notes || null })
        .eq('id', id);

      if (error) {
        console.error('Error updating order notes:', error);
        return errorResponse('Failed to save notes', 500);
      }

      return jsonResponse({ success: true });
    } catch (err) {
      console.error('Error updating order notes:', err);
      return errorResponse('Failed to save notes', 500);
    }
  }

  // POST /api/admin/orders/:id/refund - Issue refund
  if (path.match(/^\/api\/admin\/orders\/[^\/]+\/refund$/) && request.method === 'POST') {
    const id = path.replace('/api/admin/orders/', '').replace('/refund', '');
    
    try {
      // Get order
      const { data: order, error: fetchError } = await supabase
        .from(Tables.ORDERS)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !order) {
        return errorResponse('Order not found', 404);
      }

      if (!order.payment_intent_id) {
        return errorResponse('No payment found for this order', 400);
      }

      if (order.status === 'refunded') {
        return errorResponse('Order has already been refunded', 400);
      }

      if (!['paid', 'processing', 'shipped', 'delivered'].includes(order.status)) {
        return errorResponse('Cannot refund order in current status', 400);
      }

      // Process refund via Stripe
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      
      try {
        await stripe.refunds.create({
          payment_intent: order.payment_intent_id,
        });
      } catch (stripeErr: any) {
        console.error('Stripe refund error:', stripeErr);
        return errorResponse(stripeErr.message || 'Failed to process refund', 500);
      }

      // Update order status
      await supabase
        .from(Tables.ORDERS)
        .update({ status: 'refunded' })
        .eq('id', id);

      // Send refund notification email
      if (order.customer_email) {
        try {
          await sendResendEmail(env, {
            to: order.customer_email,
            subject: `Refund processed ${order.order_number ? `(${order.order_number})` : ''}`,
            html: `
              <div style="font-family:Inter,Arial,sans-serif; line-height:1.5;">
                <h2 style="margin:0 0 12px;">Refund Processed</h2>
                <p>Hi ${order.customer_name || 'Customer'},</p>
                <p>We've processed a refund for your order. The amount of <strong>$${(order.total || order.total_amount || 0).toFixed(2)}</strong> will be returned to your original payment method within 5-10 business days.</p>
                <p style="color:#666; font-size:12px;">If you have any questions, reply to this email.</p>
              </div>
            `,
          });
        } catch (emailErr) {
          console.error('Failed to send refund notification:', emailErr);
        }
      }

      return jsonResponse({ success: true, message: 'Refund processed successfully' });
    } catch (err) {
      console.error('Error processing refund:', err);
      return errorResponse('Failed to process refund', 500);
    }
  }

  // POST /api/admin/orders/:id/resend-email - Resend confirmation email
  if (path.match(/^\/api\/admin\/orders\/[^\/]+\/resend-email$/) && request.method === 'POST') {
    const id = path.replace('/api/admin/orders/', '').replace('/resend-email', '');
    
    try {
      // Get order
      const { data: order, error: fetchError } = await supabase
        .from(Tables.ORDERS)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !order) {
        return errorResponse('Order not found', 404);
      }

      if (!order.customer_email) {
        return errorResponse('No customer email found', 400);
      }

      // Format items for email
      const items = Array.isArray(order.items) ? order.items : [];
      const itemsHtml = items.map((item: any) => `
        <tr>
          <td style="padding:8px 0;">${item.name || 'Item'}</td>
          <td style="padding:8px 12px; text-align:right;">${item.quantity || 1}</td>
          <td style="padding:8px 0; text-align:right;">$${(item.unit_price || 0).toFixed(2)}</td>
        </tr>
      `).join('');

      await sendResendEmail(env, {
        to: order.customer_email,
        subject: `Order Confirmation ${order.order_number ? `(${order.order_number})` : ''}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif; line-height:1.5;">
            <h2 style="margin:0 0 12px;">Thanks for your order${order.customer_name ? `, ${order.customer_name}` : ''}!</h2>
            <p>Order ID: <strong>${order.order_number || id}</strong></p>
            <p>Total: <strong>$${(order.total || order.total_amount || 0).toFixed(2)}</strong></p>
            
            <div style="margin:16px 0;">
              <h3 style="margin:0 0 8px;">Items</h3>
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left; padding:8px 0; border-bottom:1px solid #e5e7eb;">Item</th>
                    <th style="text-align:right; padding:8px 12px; border-bottom:1px solid #e5e7eb;">Qty</th>
                    <th style="text-align:right; padding:8px 0; border-bottom:1px solid #e5e7eb;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>
            
            <p style="color:#666; font-size:12px;">If you have any questions, reply to this email.</p>
          </div>
        `,
      });

      return jsonResponse({ success: true, message: 'Email sent successfully' });
    } catch (err) {
      console.error('Error sending email:', err);
      return errorResponse('Failed to send email', 500);
    }
  }

  // POST /api/admin/orders/:id/invite-review - Send review invitation email
  if (path.match(/^\/api\/admin\/orders\/[^\/]+\/invite-review$/) && request.method === 'POST') {
    const id = path.replace('/api/admin/orders/', '').replace('/invite-review', '');
    
    try {
      // Get order with items
      const { data: order, error: fetchError } = await supabase
        .from(Tables.ORDERS)
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !order) {
        return errorResponse('Order not found', 404);
      }

      if (!order.customer_email) {
        return errorResponse('No customer email found', 400);
      }

      if (order.status !== 'delivered') {
        return errorResponse('Can only invite reviews for delivered orders', 400);
      }

      // Check if already invited
      if (order.review_invited_at) {
        return errorResponse('Review invitation already sent for this order', 400);
      }

      // Get brand settings for store name
      const { data: brandSettings } = await supabase
        .from(Tables.SETTINGS)
        .select('value')
        .eq('brand_id', order.brand_id)
        .eq('key', 'store_name')
        .single();

      const storeName = brandSettings?.value || 'Our Store';

      // Format products for review
      const items = Array.isArray(order.items) ? order.items : [];
      const productListHtml = items.map((item: any) => `
        <div style="padding:12px 0; border-bottom:1px solid #e5e7eb;">
          <p style="margin:0; font-weight:500;">${item.name || 'Product'}</p>
        </div>
      `).join('');

      // Generate review link (pointing to a review page with order context)
      const reviewUrl = `${new URL(request.url).origin}/review?order=${id}&email=${encodeURIComponent(order.customer_email)}`;

      await sendResendEmail(env, {
        to: order.customer_email,
        subject: `How was your order? Share your experience! ${order.order_number ? `(${order.order_number})` : ''}`,
        html: `
          <div style="font-family:Inter,Arial,sans-serif; line-height:1.6; max-width:600px; margin:0 auto;">
            <h2 style="margin:0 0 16px; color:#111827;">Hi ${order.customer_name || 'there'}!</h2>
            
            <p style="color:#4b5563;">We hope you're enjoying your recent purchase from ${storeName}. Your feedback helps us improve and helps other customers make informed decisions.</p>
            
            <div style="margin:24px 0; padding:20px; background:#f9fafb; border-radius:12px;">
              <h3 style="margin:0 0 12px; color:#111827; font-size:16px;">Your Order</h3>
              ${productListHtml}
            </div>
            
            <div style="text-align:center; margin:32px 0;">
              <a href="${reviewUrl}" style="display:inline-block; padding:14px 32px; background:#4F46E5; color:white; text-decoration:none; border-radius:8px; font-weight:600;">
                Write a Review
              </a>
            </div>
            
            <p style="color:#6b7280; font-size:14px;">It only takes a minute, and your honest feedback (positive or constructive) is greatly appreciated!</p>
            
            <div style="margin-top:32px; padding-top:20px; border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af; font-size:12px; margin:0;">
                Thank you for shopping with ${storeName}.<br>
                If you have any questions, simply reply to this email.
              </p>
            </div>
          </div>
        `,
      });

      // Mark order as review invited
      await supabase
        .from(Tables.ORDERS)
        .update({ review_invited_at: new Date().toISOString() })
        .eq('id', id);

      return jsonResponse({ success: true, message: 'Review invitation sent successfully' });
    } catch (err) {
      console.error('Error sending review invitation:', err);
      return errorResponse('Failed to send review invitation', 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}
