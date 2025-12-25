/**
 * Content Generation API routes
 * AI-powered video scripts and marketing copy generation
 */

import type { Env } from '../index';
import { getSupabase, Tables } from '../utils/supabase';
import { jsonResponse, errorResponse } from '../utils/response';
import { getBrandId } from '../middleware/brand';
import { chatCompletion, type ChatMessage } from '../utils/deepseek';

type ContentType = 'script' | 'caption' | 'description';
type Platform = 'tiktok' | 'instagram' | 'pinterest' | 'facebook' | 'youtube';
type VideoType = 'unboxing' | 'review' | 'tutorial' | 'promo';
type ToneStyle = 'professional' | 'casual' | 'luxury' | 'playful' | 'informative';

interface GenerateScriptRequest {
  productId: string;
  videoType: VideoType;
  platform?: Platform;
  tone?: ToneStyle;
  duration?: number;
  language?: string;
}

interface GenerateCopyRequest {
  productId: string;
  copyType: 'long_description' | 'short_description' | 'social_post' | 'email';
  platform?: Platform;
  tone?: ToneStyle;
  language?: string;
}

interface ContentEntry {
  id?: string;
  type: ContentType;
  product_id?: string;
  content: string;
  platform?: Platform;
  status?: 'draft' | 'approved' | 'published';
}

export async function handleContent(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId) {
    return errorResponse('Brand context missing', 500);
  }

  // GET /api/content - List content entries
  if (request.method === 'GET' && path === '/api/content') {
    return await listContent(supabase, brandId, request);
  }

  // POST /api/content/generate/script - Generate video script
  if (request.method === 'POST' && path === '/api/content/generate/script') {
    return await generateScript(env, supabase, brandId, request);
  }

  // POST /api/content/generate/copy - Generate marketing copy
  if (request.method === 'POST' && path === '/api/content/generate/copy') {
    return await generateCopy(env, supabase, brandId, request);
  }

  // POST /api/content - Save content entry
  if (request.method === 'POST' && path === '/api/content') {
    return await saveContent(supabase, brandId, request);
  }

  // PUT /api/content/:id - Update content entry
  if (request.method === 'PUT' && path.startsWith('/api/content/')) {
    const id = path.replace('/api/content/', '');
    return await updateContent(supabase, brandId, id, request);
  }

  // DELETE /api/content/:id - Delete content entry
  if (request.method === 'DELETE' && path.startsWith('/api/content/')) {
    const id = path.replace('/api/content/', '');
    return await deleteContent(supabase, brandId, id);
  }

  return errorResponse('Not found', 404);
}

async function listContent(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const type = url.searchParams.get('type') as ContentType | null;
  const platform = url.searchParams.get('platform') as Platform | null;
  const productId = url.searchParams.get('product_id');
  const slug = url.searchParams.get('slug');
  const status = url.searchParams.get('status');
  const authorId = url.searchParams.get('author_id');

  // If slug is provided, return single item
  if (slug) {
    let query = supabase
      .from(Tables.CONTENT_LIBRARY)
      .select('*, author:authors(id, name, slug, avatar_url, bio, credentials, social_links)')
      .eq('brand_id', brandId)
      .eq('slug', slug);

    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.single();

    if (error || !data) {
      return errorResponse('Content not found', 404);
    }

    return jsonResponse({ success: true, data });
  }

  let query = supabase
    .from(Tables.CONTENT_LIBRARY)
    .select('id, type, product_id, content, platform, status, title, meta_description, slug, author_id, created_at, updated_at, author:authors(id, name, slug, avatar_url)', { count: 'exact' })
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);
  if (platform) query = query.eq('platform', platform);
  if (productId) query = query.eq('product_id', productId);
  if (status) query = query.eq('status', status);
  if (authorId) query = query.eq('author_id', authorId);

  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('List content error:', error);
    return errorResponse('Failed to list content', 500);
  }

  return jsonResponse({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

async function generateScript(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as GenerateScriptRequest;

  if (!body.productId || !body.videoType) {
    return errorResponse('productId and videoType are required', 400);
  }

  // Get product details
  const { data: product, error: productError } = await supabase
    .from(Tables.PRODUCTS)
    .select('name, description, short_description, price, compare_price')
    .eq('brand_id', brandId)
    .eq('id', body.productId)
    .single();

  if (productError || !product) {
    return errorResponse('Product not found', 404);
  }

  const platform = body.platform || 'tiktok';
  const tone = body.tone || 'casual';
  const duration = body.duration || 30;
  const language = body.language || 'English';

  const videoTypeDescriptions: Record<VideoType, string> = {
    unboxing: 'exciting unboxing experience showing the product packaging and first impressions',
    review: 'honest product review highlighting features, pros, and real-world usage',
    tutorial: 'step-by-step tutorial showing how to use the product effectively',
    promo: 'promotional content emphasizing value proposition and limited-time offers',
  };

  const prompt = buildScriptPrompt({
    productName: product.name,
    description: product.description || product.short_description || '',
    price: product.price,
    comparePrice: product.compare_price,
    videoType: body.videoType,
    videoTypeDescription: videoTypeDescriptions[body.videoType],
    platform,
    tone,
    duration,
    language,
  });

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: getScriptSystemPrompt(platform, tone) },
      { role: 'user', content: prompt },
    ];

    const script = await chatCompletion(env.DEEPSEEK_API_KEY, {
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    });

    return jsonResponse({
      success: true,
      script,
      metadata: {
        productId: body.productId,
        productName: product.name,
        videoType: body.videoType,
        platform,
        tone,
        duration,
        language,
      },
    });
  } catch (error) {
    console.error('Script generation error:', error);
    return errorResponse('Failed to generate script', 500);
  }
}

async function generateCopy(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as GenerateCopyRequest;

  if (!body.productId || !body.copyType) {
    return errorResponse('productId and copyType are required', 400);
  }

  // Get product details
  const { data: product, error: productError } = await supabase
    .from(Tables.PRODUCTS)
    .select('name, description, short_description, price, compare_price')
    .eq('brand_id', brandId)
    .eq('id', body.productId)
    .single();

  if (productError || !product) {
    return errorResponse('Product not found', 404);
  }

  const platform = body.platform || 'instagram';
  const tone = body.tone || 'professional';
  const language = body.language || 'English';

  const prompt = buildCopyPrompt({
    productName: product.name,
    description: product.description || product.short_description || '',
    price: product.price,
    comparePrice: product.compare_price,
    copyType: body.copyType,
    platform,
    tone,
    language,
  });

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: getCopySystemPrompt(body.copyType, tone) },
      { role: 'user', content: prompt },
    ];

    const copy = await chatCompletion(env.DEEPSEEK_API_KEY, {
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    return jsonResponse({
      success: true,
      copy,
      metadata: {
        productId: body.productId,
        productName: product.name,
        copyType: body.copyType,
        platform,
        tone,
        language,
      },
    });
  } catch (error) {
    console.error('Copy generation error:', error);
    return errorResponse('Failed to generate copy', 500);
  }
}

async function saveContent(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as ContentEntry;

  if (!body.content || !body.type) {
    return errorResponse('content and type are required', 400);
  }

  const { data, error } = await supabase
    .from(Tables.CONTENT_LIBRARY)
    .insert({
      brand_id: brandId,
      type: body.type,
      product_id: body.product_id || null,
      content: body.content,
      platform: body.platform || null,
      status: body.status || 'draft',
    })
    .select('id, type, product_id, content, platform, status, created_at')
    .single();

  if (error) {
    console.error('Save content error:', error);
    return errorResponse('Failed to save content', 500);
  }

  return jsonResponse({ success: true, data });
}

async function updateContent(
  supabase: any,
  brandId: string,
  id: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Partial<ContentEntry>;

  const updateData: any = {};
  if (body.content !== undefined) updateData.content = body.content;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.platform !== undefined) updateData.platform = body.platform;

  if (Object.keys(updateData).length === 0) {
    return errorResponse('No valid fields to update', 400);
  }

  const { data, error } = await supabase
    .from(Tables.CONTENT_LIBRARY)
    .update(updateData)
    .eq('id', id)
    .eq('brand_id', brandId)
    .select('id, type, product_id, content, platform, status, created_at, updated_at')
    .single();

  if (error) {
    console.error('Update content error:', error);
    return errorResponse('Failed to update content', 500);
  }

  return jsonResponse({ success: true, data });
}

async function deleteContent(
  supabase: any,
  brandId: string,
  id: string
): Promise<Response> {
  const { error } = await supabase
    .from(Tables.CONTENT_LIBRARY)
    .delete()
    .eq('id', id)
    .eq('brand_id', brandId);

  if (error) {
    console.error('Delete content error:', error);
    return errorResponse('Failed to delete content', 500);
  }

  return jsonResponse({ success: true });
}

function getScriptSystemPrompt(platform: string, tone: string): string {
  return `You are an expert social media content creator specializing in ${platform} video scripts.
Your scripts are optimized for engagement and conversions.
Write in a ${tone} tone that resonates with the target audience.
Always structure scripts with:
1. HOOK (0-3 seconds): Grab attention immediately
2. PROBLEM/SETUP (3-10 seconds): Relate to viewer's pain point
3. SOLUTION/DEMO (10-25 seconds): Show the product solving the problem
4. CTA (last 5 seconds): Clear call-to-action

Include visual directions in [brackets] and spoken text in plain format.
Suggest relevant hashtags and music style at the end.`;
}

function getCopySystemPrompt(copyType: string, tone: string): string {
  const typeInstructions: Record<string, string> = {
    long_description: 'Write a comprehensive product description for an e-commerce product page. Include features, benefits, use cases, and specifications.',
    short_description: 'Write a concise, compelling product summary suitable for product cards and listings. Maximum 2-3 sentences.',
    social_post: 'Write an engaging social media post that drives engagement and clicks. Include emojis, hashtags, and a clear CTA.',
    email: 'Write a marketing email that converts. Include a compelling subject line, engaging body copy, and clear CTA.',
  };

  return `You are an expert e-commerce copywriter with a ${tone} writing style.
${typeInstructions[copyType] || 'Write compelling marketing copy.'}
Focus on benefits over features. Use power words that drive action.
Write in a way that connects emotionally with the target audience.`;
}

function buildScriptPrompt(params: {
  productName: string;
  description: string;
  price: number;
  comparePrice?: number | null;
  videoType: string;
  videoTypeDescription: string;
  platform: string;
  tone: string;
  duration: number;
  language: string;
}): string {
  const discount = params.comparePrice
    ? Math.round((1 - params.price / params.comparePrice) * 100)
    : null;

  return `Create a ${params.duration}-second ${params.videoType} video script for ${params.platform}.

PRODUCT DETAILS:
- Name: ${params.productName}
- Description: ${params.description}
- Price: $${params.price}${discount ? ` (${discount}% OFF from $${params.comparePrice})` : ''}

VIDEO TYPE: ${params.videoTypeDescription}

REQUIREMENTS:
- Language: ${params.language}
- Tone: ${params.tone}
- Duration: ~${params.duration} seconds
- Include scene directions, spoken text, and timing
- End with hashtag suggestions and music style recommendation

Generate a complete, ready-to-film script.`;
}

function buildCopyPrompt(params: {
  productName: string;
  description: string;
  price: number;
  comparePrice?: number | null;
  copyType: string;
  platform: string;
  tone: string;
  language: string;
}): string {
  const discount = params.comparePrice
    ? Math.round((1 - params.price / params.comparePrice) * 100)
    : null;

  const typeInstructions: Record<string, string> = {
    long_description: 'Write a detailed product description (300-500 words) for the product page.',
    short_description: 'Write a brief product summary (50-100 words) for listings.',
    social_post: `Write an engaging ${params.platform} post with emojis and hashtags.`,
    email: 'Write a promotional email with subject line, preview text, and body.',
  };

  return `${typeInstructions[params.copyType] || 'Write marketing copy for this product.'}

PRODUCT DETAILS:
- Name: ${params.productName}
- Description: ${params.description}
- Price: $${params.price}${discount ? ` (${discount}% OFF from $${params.comparePrice})` : ''}

REQUIREMENTS:
- Language: ${params.language}
- Tone: ${params.tone}
- Platform: ${params.platform}

Generate compelling, conversion-focused copy.`;
}
