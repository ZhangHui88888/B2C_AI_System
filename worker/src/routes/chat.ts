/**
 * AI Chat API routes
 * Placeholder - to be fully implemented in Step 3.3
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse, streamResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';

export async function handleChat(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const body = (await request.json().catch(() => ({}))) as any;
  const message = typeof body?.message === 'string' ? body.message : '';
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';

  if (!message) {
    return errorResponse('Message is required', 400);
  }

  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // Check if AI is enabled
  const { data: aiSetting } = await supabase
    .from(Tables.SETTINGS)
    .select('value')
    .eq('brand_id', brandId)
    .eq('key', 'ai_enabled')
    .single();

  const aiEnabled = aiSetting?.value === true;

  if (!aiEnabled) {
    // Return fallback message when AI is disabled
    const { data: fallbackSetting } = await supabase
      .from(Tables.SETTINGS)
      .select('value')
      .eq('brand_id', brandId)
      .eq('key', 'ai_fallback_message')
      .single();

    const fallbackMessage = fallbackSetting?.value || 
      'Thank you for your message! Our team will get back to you soon. For urgent inquiries, please email support@example.com';

    return jsonResponse({
      success: true,
      reply: fallbackMessage,
      aiEnabled: false,
    });
  }

  // POST /api/chat - Regular chat response
  if (path === '/api/chat') {
    // Placeholder - full RAG implementation in Step 3.3
    const reply = `Thank you for your message: "${message}". This is a placeholder response. Full AI chat will be implemented in Step 3.3.`;

    // Save conversation to database
    const resolvedSessionId = sessionId || crypto.randomUUID();
    await saveConversation(supabase, brandId, resolvedSessionId, 'user', message);
    await saveConversation(supabase, brandId, resolvedSessionId, 'assistant', reply);

    return jsonResponse({
      success: true,
      reply,
      aiEnabled: true,
    });
  }

  // POST /api/chat/stream - Streaming chat response
  if (path === '/api/chat/stream') {
    // Placeholder - full streaming implementation in Step 3.3
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const words = `Thank you for your message. This is a placeholder streaming response. Full AI streaming will be implemented in Step 3.3.`.split(' ');
        
        for (const word of words) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: word + ' ' })}\n\n`));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return streamResponse(stream);
  }

  return errorResponse('Not found', 404);
}

async function saveConversation(
  supabase: any,
  brandId: string,
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  message: string
): Promise<void> {
  try {
    await supabase.from(Tables.CONVERSATIONS).insert({
      brand_id: brandId,
      session_id: sessionId,
      role,
      message,
    });
  } catch (error) {
    console.error('Failed to save conversation:', error);
  }
}
