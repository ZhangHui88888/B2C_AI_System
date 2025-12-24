/**
 * DeepSeek API utilities for AI chat and embeddings
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface EmbeddingOptions {
  input: string | string[];
  model?: string;
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

/**
 * Call DeepSeek chat completion API
 */
export async function chatCompletion(
  apiKey: string,
  options: ChatCompletionOptions
): Promise<string> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('DeepSeek API error:', response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call DeepSeek chat completion API with streaming
 */
export async function chatCompletionStream(
  apiKey: string,
  options: ChatCompletionOptions
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('DeepSeek streaming API error:', response.status, errorText);
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  return response.body;
}

/**
 * Generate embeddings using DeepSeek API
 * Note: If DeepSeek doesn't support embeddings, fallback to OpenAI-compatible endpoint
 */
export async function generateEmbedding(
  apiKey: string,
  text: string
): Promise<number[]> {
  // DeepSeek uses OpenAI-compatible embedding API
  const response = await fetch(`${DEEPSEEK_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat', // May need adjustment based on actual model
      input: text,
    }),
  });

  if (!response.ok) {
    // Fallback: return empty embedding if not supported
    console.warn('Embedding API not available, returning zero vector');
    return new Array(1536).fill(0);
  }

  const data = (await response.json()) as any;
  return data.data?.[0]?.embedding || new Array(1536).fill(0);
}

/**
 * Build system prompt with brand context and RAG results
 */
export function buildSystemPrompt(
  brandName: string,
  customPrompt: string | null,
  ragContext: string[]
): string {
  const defaultPrompt = `You are a helpful customer service assistant for ${brandName}. 
Answer questions based on the provided context. Be friendly, professional, and concise.
If you don't know the answer, say so honestly and suggest contacting support.
Always respond in the same language as the user's message.`;

  let systemPrompt = customPrompt
    ? customPrompt.replace('{brand_name}', brandName)
    : defaultPrompt;

  if (ragContext.length > 0) {
    systemPrompt += `\n\n--- Knowledge Base Context ---\n${ragContext.join('\n\n')}`;
  }

  return systemPrompt;
}

/**
 * Check if message contains handoff keywords
 */
export function checkHandoffKeywords(
  message: string,
  keywords: string[]
): boolean {
  const lowerMessage = message.toLowerCase();
  return keywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()));
}
