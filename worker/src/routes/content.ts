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
  author_id?: string;
  title?: string;
  is_ai_generated?: boolean;
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

  // POST /api/content/check-originality - Check content originality
  if (request.method === 'POST' && path === '/api/content/check-originality') {
    return await checkOriginality(env, supabase, brandId, request);
  }

  // POST /api/content/differentiate - Generate differentiated content
  if (request.method === 'POST' && path === '/api/content/differentiate') {
    return await differentiateContent(env, supabase, brandId, request);
  }

  // GET /api/content/stale - Get stale content that needs updating
  if (request.method === 'GET' && path === '/api/content/stale') {
    return await getStaleContent(supabase, brandId, request);
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

  // Check publish rate limit if publishing directly
  if (body.status === 'published') {
    const { data: limitCheck } = await supabase.rpc('get_daily_publish_count', {
      p_brand_id: brandId,
      p_content_type: body.type,
    });
    const dailyLimit = 10; // Could be fetched from settings
    if (typeof limitCheck === 'number' && limitCheck >= dailyLimit) {
      return errorResponse(`Daily publish limit (${dailyLimit}) reached for ${body.type}`, 429);
    }
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
      author_id: body.author_id || null,
      title: body.title || null,
      is_ai_generated: body.is_ai_generated !== false,
      ai_generated_at: new Date().toISOString(),
    })
    .select('id, type, product_id, content, platform, status, author_id, is_ai_generated, created_at')
    .single();

  // Log publish if published
  if (!error && data && body.status === 'published') {
    await supabase.from('content_publish_logs').insert({
      brand_id: brandId,
      content_id: data.id,
      content_type: body.type,
    });
  }

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

  // Check publish rate limit if changing to published
  if (body.status === 'published') {
    const { data: existing } = await supabase
      .from(Tables.CONTENT_LIBRARY)
      .select('type, status')
      .eq('id', id)
      .eq('brand_id', brandId)
      .single();

    if (existing && existing.status !== 'published') {
      const { data: limitCheck } = await supabase.rpc('get_daily_publish_count', {
        p_brand_id: brandId,
        p_content_type: existing.type,
      });
      const dailyLimit = 10;
      if (typeof limitCheck === 'number' && limitCheck >= dailyLimit) {
        return errorResponse(`Daily publish limit (${dailyLimit}) reached`, 429);
      }
    }

    updateData.last_review_at = new Date().toISOString();
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

  // Log publish if status changed to published
  if (data && body.status === 'published') {
    await supabase.from('content_publish_logs').insert({
      brand_id: brandId,
      content_id: data.id,
      content_type: data.type,
    });
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

// ============================================
// Phase 5: AI Content Quality Features
// ============================================

interface OriginalityCheckRequest {
  content: string;
  contentId?: string;
}

interface OriginalityResult {
  score: number; // 0-100, higher = more original
  analysis: {
    uniquePhrases: number;
    commonPatterns: string[];
    suggestions: string[];
    overallAssessment: string;
  };
  flags: {
    hasGenericOpening: boolean;
    hasRepetitiveStructure: boolean;
    lacksSpecificDetails: boolean;
    hasAIPatterns: boolean;
  };
}

/**
 * Check content originality using AI analysis
 * Analyzes content for uniqueness, AI patterns, and generic structures
 */
async function checkOriginality(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as OriginalityCheckRequest;

  if (!body.content || body.content.trim().length < 50) {
    return errorResponse('Content must be at least 50 characters', 400);
  }

  const systemPrompt = `You are an expert content analyst specializing in detecting AI-generated content and assessing originality.
Your task is to analyze the provided content and return a JSON assessment.

Analyze for:
1. Generic phrases commonly used by AI (e.g., "In today's world", "It's important to note", "When it comes to")
2. Repetitive sentence structures
3. Lack of specific details, data, or unique perspectives
4. Overly formal or stilted language
5. Missing brand voice or personality
6. Lack of real examples or case studies

Return ONLY valid JSON in this exact format:
{
  "score": <number 0-100>,
  "uniquePhrases": <number of unique/original phrases found>,
  "commonPatterns": [<list of generic patterns detected>],
  "suggestions": [<list of specific improvement suggestions>],
  "overallAssessment": "<2-3 sentence summary>",
  "hasGenericOpening": <boolean>,
  "hasRepetitiveStructure": <boolean>,
  "lacksSpecificDetails": <boolean>,
  "hasAIPatterns": <boolean>
}`;

  const userPrompt = `Analyze this content for originality:\n\n${body.content}`;

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await chatCompletion(env.DEEPSEEK_API_KEY, {
      messages,
      temperature: 0.3,
      max_tokens: 1000,
    });

    // Parse the JSON response
    let analysis;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse originality response:', parseError);
      // Return a default analysis if parsing fails
      analysis = {
        score: 50,
        uniquePhrases: 0,
        commonPatterns: ['Unable to analyze'],
        suggestions: ['Please try again or manually review the content'],
        overallAssessment: 'Analysis could not be completed. Please review manually.',
        hasGenericOpening: false,
        hasRepetitiveStructure: false,
        lacksSpecificDetails: false,
        hasAIPatterns: false,
      };
    }

    const result: OriginalityResult = {
      score: Math.min(100, Math.max(0, analysis.score || 50)),
      analysis: {
        uniquePhrases: analysis.uniquePhrases || 0,
        commonPatterns: analysis.commonPatterns || [],
        suggestions: analysis.suggestions || [],
        overallAssessment: analysis.overallAssessment || '',
      },
      flags: {
        hasGenericOpening: analysis.hasGenericOpening || false,
        hasRepetitiveStructure: analysis.hasRepetitiveStructure || false,
        lacksSpecificDetails: analysis.lacksSpecificDetails || false,
        hasAIPatterns: analysis.hasAIPatterns || false,
      },
    };

    // If contentId provided, save the originality score
    if (body.contentId) {
      await supabase
        .from(Tables.CONTENT_LIBRARY)
        .update({
          originality_score: result.score,
          originality_checked_at: new Date().toISOString(),
        })
        .eq('id', body.contentId)
        .eq('brand_id', brandId);
    }

    return jsonResponse({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Originality check error:', error);
    return errorResponse('Failed to check originality', 500);
  }
}

interface DifferentiateRequest {
  productId: string;
  baseContent?: string;
  contentType: 'description' | 'social_post' | 'email' | 'blog';
  tone?: ToneStyle;
  includeReviews?: boolean;
  includeSpecs?: boolean;
  includeComparisons?: boolean;
  language?: string;
}

/**
 * Generate differentiated content by incorporating real product data
 * Uses actual product details, reviews, specs, and comparisons to create unique content
 */
async function differentiateContent(
  env: Env,
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as DifferentiateRequest;

  if (!body.productId || !body.contentType) {
    return errorResponse('productId and contentType are required', 400);
  }

  // Fetch comprehensive product data
  const { data: product, error: productError } = await supabase
    .from(Tables.PRODUCTS)
    .select(`
      id, name, slug, description, short_description, price, compare_price,
      images, specifications, features, sku, stock_quantity
    `)
    .eq('brand_id', brandId)
    .eq('id', body.productId)
    .single();

  if (productError || !product) {
    return errorResponse('Product not found', 404);
  }

  // Fetch approved reviews for social proof
  let reviews: any[] = [];
  if (body.includeReviews !== false) {
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('rating, title, content, reviewer_name, is_verified_purchase')
      .eq('product_id', body.productId)
      .eq('status', 'approved')
      .order('rating', { ascending: false })
      .limit(5);
    reviews = reviewData || [];
  }

  // Fetch similar products for comparison context
  let similarProducts: any[] = [];
  if (body.includeComparisons) {
    const { data: similar } = await supabase
      .from(Tables.PRODUCTS)
      .select('name, price, short_description')
      .eq('brand_id', brandId)
      .neq('id', body.productId)
      .eq('is_active', true)
      .limit(3);
    similarProducts = similar || [];
  }

  // Fetch brand settings for voice/personality
  const { data: settings } = await supabase
    .from(Tables.SETTINGS)
    .select('value')
    .eq('brand_id', brandId)
    .eq('key', 'brand_voice')
    .single();

  const brandVoice = settings?.value || 'professional and approachable';
  const tone = body.tone || 'professional';
  const language = body.language || 'English';

  // Build comprehensive context for differentiation
  const productContext = buildProductContext(product, reviews, similarProducts, body.includeSpecs);

  const systemPrompt = getDifferentiationSystemPrompt(body.contentType, tone, brandVoice);
  const userPrompt = buildDifferentiationPrompt({
    contentType: body.contentType,
    productContext,
    baseContent: body.baseContent,
    language,
  });

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const differentiatedContent = await chatCompletion(env.DEEPSEEK_API_KEY, {
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    });

    return jsonResponse({
      success: true,
      content: differentiatedContent,
      metadata: {
        productId: body.productId,
        productName: product.name,
        contentType: body.contentType,
        tone,
        language,
        dataUsed: {
          hasReviews: reviews.length > 0,
          reviewCount: reviews.length,
          hasSpecs: body.includeSpecs && !!product.specifications,
          hasComparisons: similarProducts.length > 0,
        },
      },
    });
  } catch (error) {
    console.error('Content differentiation error:', error);
    return errorResponse('Failed to generate differentiated content', 500);
  }
}

function buildProductContext(
  product: any,
  reviews: any[],
  similarProducts: any[],
  includeSpecs?: boolean
): string {
  let context = `PRODUCT: ${product.name}
SKU: ${product.sku || 'N/A'}
Price: $${product.price}${product.compare_price ? ` (was $${product.compare_price})` : ''}
Stock: ${product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}

DESCRIPTION:
${product.description || product.short_description || 'No description available'}
`;

  if (product.features && Array.isArray(product.features)) {
    context += `\nKEY FEATURES:\n${product.features.map((f: string) => `• ${f}`).join('\n')}`;
  }

  if (includeSpecs && product.specifications) {
    const specs = typeof product.specifications === 'string' 
      ? JSON.parse(product.specifications) 
      : product.specifications;
    if (typeof specs === 'object') {
      context += '\n\nSPECIFICATIONS:\n';
      for (const [key, value] of Object.entries(specs)) {
        context += `• ${key}: ${value}\n`;
      }
    }
  }

  if (reviews.length > 0) {
    context += '\n\nCUSTOMER REVIEWS:\n';
    reviews.forEach((review, i) => {
      context += `${i + 1}. "${review.title || 'Great product!'}" - ${review.rating}/5 stars`;
      if (review.is_verified_purchase) context += ' (Verified Purchase)';
      context += `\n   "${review.content?.slice(0, 150) || 'Highly recommended!'}"\n`;
    });
  }

  if (similarProducts.length > 0) {
    context += '\n\nRELATED PRODUCTS (for comparison):\n';
    similarProducts.forEach((p) => {
      context += `• ${p.name} - $${p.price}\n`;
    });
  }

  return context;
}

function getDifferentiationSystemPrompt(
  contentType: string,
  tone: string,
  brandVoice: string
): string {
  const typeInstructions: Record<string, string> = {
    description: `Create a unique, compelling product description that:
- Opens with a specific benefit or use case, NOT a generic statement
- Includes real data points (specs, dimensions, materials)
- References actual customer feedback naturally
- Addresses specific pain points the product solves
- Uses sensory language and concrete examples`,
    
    social_post: `Create a scroll-stopping social media post that:
- Opens with a hook based on real product benefits
- Includes a specific detail or stat that stands out
- Uses customer voice/quotes naturally
- Ends with a clear, compelling CTA
- Feels authentic, not salesy`,
    
    email: `Create a personalized marketing email that:
- Has a subject line referencing a specific benefit
- Opens with a relatable scenario or problem
- Weaves in real customer testimonials
- Includes specific product details as proof points
- Ends with urgency tied to real factors (stock, seasonality)`,
    
    blog: `Create an informative blog post that:
- Provides genuine value beyond just selling
- Includes real specifications and comparisons
- References customer experiences and use cases
- Offers tips and insights related to the product
- Establishes expertise through detailed knowledge`,
  };

  return `You are an expert e-commerce copywriter with a ${tone} style that embodies ${brandVoice}.

Your goal is to create HIGHLY DIFFERENTIATED content that:
1. Uses SPECIFIC product details - never generic filler
2. Incorporates REAL customer feedback naturally
3. Includes CONCRETE data points (numbers, specs, comparisons)
4. Avoids AI-typical phrases like "In today's world", "It's important to", "When it comes to"
5. Feels human-written with personality and authenticity

${typeInstructions[contentType] || 'Create unique, differentiated marketing content.'}

CRITICAL: Every sentence should contain specific information. No filler. No generic claims.`;
}

function buildDifferentiationPrompt(params: {
  contentType: string;
  productContext: string;
  baseContent?: string;
  language: string;
}): string {
  let prompt = `Using the following REAL product data, create unique ${params.contentType} content in ${params.language}:

${params.productContext}
`;

  if (params.baseContent) {
    prompt += `\nBASE CONTENT TO IMPROVE (make it more unique and specific):\n${params.baseContent}\n`;
  }

  prompt += `
REQUIREMENTS:
- Use specific details from the product data above
- Include at least one customer quote or reference if reviews are available
- Mention specific numbers (price, specs, ratings) where relevant
- Avoid generic phrases - every sentence should be specific to THIS product
- Write in ${params.language}

Generate the differentiated content now:`;

  return prompt;
}

/**
 * Get stale content that needs updating
 * Returns content that hasn't been reviewed/updated in a specified period
 */
async function getStaleContent(
  supabase: any,
  brandId: string,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const daysOld = parseInt(url.searchParams.get('days') || '30');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const contentType = url.searchParams.get('type');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  let query = supabase
    .from(Tables.CONTENT_LIBRARY)
    .select('id, type, title, content, platform, status, created_at, updated_at, last_review_at, originality_score, product_id')
    .eq('brand_id', brandId)
    .eq('status', 'published')
    .or(`updated_at.lt.${cutoffDate.toISOString()},last_review_at.lt.${cutoffDate.toISOString()},last_review_at.is.null`)
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (contentType) {
    query = query.eq('type', contentType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Get stale content error:', error);
    return errorResponse('Failed to fetch stale content', 500);
  }

  // Calculate staleness score for each item
  const now = new Date().getTime();
  const staleContent = (data || []).map((item: any) => {
    const lastUpdate = new Date(item.updated_at || item.created_at).getTime();
    const daysSinceUpdate = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
    
    return {
      ...item,
      daysSinceUpdate,
      staleness: daysSinceUpdate > 90 ? 'critical' : daysSinceUpdate > 60 ? 'high' : 'medium',
      needsOriginalityCheck: !item.originality_score,
    };
  });

  return jsonResponse({
    success: true,
    data: staleContent,
    summary: {
      total: staleContent.length,
      critical: staleContent.filter((c: any) => c.staleness === 'critical').length,
      high: staleContent.filter((c: any) => c.staleness === 'high').length,
      medium: staleContent.filter((c: any) => c.staleness === 'medium').length,
      needsOriginalityCheck: staleContent.filter((c: any) => c.needsOriginalityCheck).length,
    },
  });
}
