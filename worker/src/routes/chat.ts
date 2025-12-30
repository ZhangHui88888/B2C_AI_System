/**
 * AI Chat API routes
 * Multi-brand AI customer service with RAG support
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse, streamResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import {
  chatCompletion,
  chatCompletionStream,
  generateEmbedding,
  buildSystemPrompt,
  checkHandoffKeywords,
  type ChatMessage,
} from '../utils/deepseek';

interface BrandAIConfig {
  enabled: boolean;
  systemPrompt: string | null;
  welcomeMessage: string;
  maxContextMessages: number;
  handoffKeywords: string[];
  brandName: string;
}

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
    return errorResponse('Brand context missing', 400);
  }

  // Load brand AI configuration
  const config = await loadBrandAIConfig(supabase, brandId);

  if (!config.enabled) {
    return jsonResponse({
      success: true,
      reply: config.welcomeMessage || 'Thank you for your message! Our team will get back to you soon.',
      aiEnabled: false,
    });
  }

  // Check for handoff keywords
  const needsHuman = checkHandoffKeywords(message, config.handoffKeywords);

  // POST /api/chat - Regular chat response
  if (path === '/api/chat') {
    return await handleRegularChat(env, supabase, brandId, message, sessionId, config, needsHuman);
  }

  // POST /api/chat/stream - Streaming chat response
  if (path === '/api/chat/stream') {
    return await handleStreamChat(env, supabase, brandId, message, sessionId, config, needsHuman);
  }

  return errorResponse('Not found', 404);
}

async function handleRegularChat(
  env: Env,
  supabase: any,
  brandId: string,
  message: string,
  sessionId: string,
  config: BrandAIConfig,
  needsHuman: boolean
): Promise<Response> {
  const resolvedSessionId = sessionId || crypto.randomUUID();

  try {
    // Save user message
    await saveConversation(supabase, brandId, resolvedSessionId, 'user', message);

    // Get RAG context
    const ragContext = await searchKnowledgeBase(env, supabase, brandId, message);

    // Get conversation history
    const history = await getConversationHistory(supabase, brandId, resolvedSessionId, config.maxContextMessages);

    // Build messages for AI
    const systemPrompt = buildSystemPrompt(config.brandName, config.systemPrompt, ragContext);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    // Call DeepSeek API
    const reply = await chatCompletion(env.DEEPSEEK_API_KEY, { messages });

    // Save assistant reply
    await saveConversation(supabase, brandId, resolvedSessionId, 'assistant', reply);

    return jsonResponse({
      success: true,
      reply,
      sessionId: resolvedSessionId,
      aiEnabled: true,
      needsHuman,
      ...(needsHuman && {
        handoffMessage: 'Your request has been flagged for human support. Our team will follow up soon.',
      }),
    });
  } catch (error) {
    console.error('Chat error:', error);
    return jsonResponse({
      success: true,
      reply: 'I apologize, but I encountered an issue processing your request. Please try again or contact our support team.',
      sessionId: resolvedSessionId,
      aiEnabled: true,
      error: true,
    });
  }
}

async function handleStreamChat(
  env: Env,
  supabase: any,
  brandId: string,
  message: string,
  sessionId: string,
  config: BrandAIConfig,
  needsHuman: boolean
): Promise<Response> {
  const resolvedSessionId = sessionId || crypto.randomUUID();
  const encoder = new TextEncoder();

  try {
    // Save user message
    await saveConversation(supabase, brandId, resolvedSessionId, 'user', message);

    // Get RAG context
    const ragContext = await searchKnowledgeBase(env, supabase, brandId, message);

    // Get conversation history
    const history = await getConversationHistory(supabase, brandId, resolvedSessionId, config.maxContextMessages);

    // Build messages for AI
    const systemPrompt = buildSystemPrompt(config.brandName, config.systemPrompt, ragContext);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    // Get streaming response from DeepSeek
    const deepseekStream = await chatCompletionStream(env.DEEPSEEK_API_KEY, { messages });

    // Transform stream to SSE format and collect full response
    let fullResponse = '';
    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = deepseekStream.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data:'));

            for (const line of lines) {
              const data = line.replace('data:', '').trim();
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullResponse += content;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }

          // Send metadata at end
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                sessionId: resolvedSessionId,
                needsHuman,
              })}\n\n`
            )
          );

          controller.close();

          // Save full response after stream completes
          if (fullResponse) {
            await saveConversation(supabase, brandId, resolvedSessionId, 'assistant', fullResponse);
          }
        } catch (err) {
          console.error('Stream processing error:', err);
          controller.error(err);
        }
      },
    });

    return streamResponse(transformedStream);
  } catch (error) {
    console.error('Stream chat error:', error);
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              content: 'I apologize, but I encountered an issue. Please try again.',
              error: true,
            })}\n\n`
          )
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return streamResponse(errorStream);
  }
}

async function loadBrandAIConfig(supabase: any, brandId: string): Promise<BrandAIConfig> {
  // Get brand info
  const { data: brand } = await supabase
    .from(Tables.BRANDS)
    .select('name')
    .eq('id', brandId)
    .single();

  // Get all AI settings for this brand
  const { data: settings } = await supabase
    .from(Tables.SETTINGS)
    .select('key, value')
    .eq('brand_id', brandId)
    .in('key', [
      'ai_enabled',
      'ai_system_prompt',
      'ai_welcome_message',
      'ai_max_context_messages',
      'ai_handoff_keywords',
    ]);

  const settingsMap = new Map<string, any>();
  for (const s of settings || []) {
    settingsMap.set(s.key, s.value);
  }

  const aiEnabledValue = settingsMap.get('ai_enabled');
  const aiEnabled = aiEnabledValue === true || aiEnabledValue === 'true';

  return {
    enabled: aiEnabled,
    systemPrompt: settingsMap.get('ai_system_prompt') || null,
    welcomeMessage: settingsMap.get('ai_welcome_message') || 'Hello! How can I help you today?',
    maxContextMessages: Number(settingsMap.get('ai_max_context_messages')) || 10,
    handoffKeywords: Array.isArray(settingsMap.get('ai_handoff_keywords'))
      ? settingsMap.get('ai_handoff_keywords')
      : ['complaint', 'refund', 'human', 'manager', '投诉', '退款', '人工'],
    brandName: brand?.name || 'Our Store',
  };
}

async function searchKnowledgeBase(
  env: Env,
  supabase: any,
  brandId: string,
  query: string
): Promise<string[]> {
  try {
    // Generate embedding for query
    const embedding = await generateEmbedding(env.DEEPSEEK_API_KEY, query);

    // Check if we got a valid embedding (not all zeros)
    const hasValidEmbedding = embedding.some((v) => v !== 0);

    if (hasValidEmbedding) {
      // Use vector similarity search
      const { data: results, error } = await supabase.rpc('match_knowledge', {
        query_embedding: embedding,
        match_brand_id: brandId,
        match_count: 5,
        match_threshold: 0.7,
      });

      if (!error && results?.length > 0) {
        return results.map((r: any) => {
          const prefix = r.title ? `[${r.title}] ` : '';
          return `${prefix}${r.content}`;
        });
      }
    }

    // Fallback: text search
    const { data: textResults } = await supabase
      .from(Tables.KNOWLEDGE_BASE)
      .select('content, title')
      .eq('brand_id', brandId)
      .textSearch('content', query.split(' ').join(' & '))
      .limit(3);

    if (textResults?.length > 0) {
      return textResults.map((r: any) => {
        const prefix = r.title ? `[${r.title}] ` : '';
        return `${prefix}${r.content}`;
      });
    }

    return [];
  } catch (error) {
    console.error('Knowledge base search error:', error);
    return [];
  }
}

async function getConversationHistory(
  supabase: any,
  brandId: string,
  sessionId: string,
  limit: number
): Promise<ChatMessage[]> {
  const { data: messages } = await supabase
    .from(Tables.CONVERSATIONS)
    .select('role, message')
    .eq('brand_id', brandId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!messages) return [];

  return messages
    .filter((m: any) => m.role === 'user' || m.role === 'assistant')
    .map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.message,
    }));
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
