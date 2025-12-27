/**
 * E-E-A-T Scoring Routes
 * Experience, Expertise, Authoritativeness, Trustworthiness analysis
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleEeat(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  // Analyze single content
  if (path === '/api/eeat/analyze' && method === 'POST') {
    return handleAnalyzeEeat(request, env, supabase, brandId);
  }

  // Bulk analyze all content
  if (path === '/api/eeat/analyze-all' && method === 'POST') {
    return handleAnalyzeAllEeat(env, supabase, brandId);
  }

  // Get E-E-A-T scores
  if (path === '/api/eeat/scores' && method === 'GET') {
    return handleGetEeatScores(request, supabase, brandId);
  }

  // Get single score
  if (path.match(/^\/api\/eeat\/scores\/[\w-]+$/) && method === 'GET') {
    const id = path.split('/').pop()!;
    return handleGetEeatScore(id, supabase);
  }

  // Get improvement recommendations
  if (path === '/api/eeat/recommendations' && method === 'POST') {
    return handleGetRecommendations(request, env, supabase, brandId);
  }

  // Site-wide E-E-A-T summary
  if (path === '/api/eeat/summary' && method === 'GET') {
    return handleGetEeatSummary(supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== E-E-A-T Analysis ====================

async function handleAnalyzeEeat(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { content_type, content_id, content } = body;

    if (!content_type || !content_id) {
      return jsonResponse({ error: 'content_type and content_id are required' }, 400);
    }

    // Get content if not provided
    let contentData = content;
    let authorInfo = null;

    if (!contentData) {
      if (content_type === 'product') {
        const { data } = await supabase
          .from('products')
          .select('name, description, short_description, images, reviews_count, average_rating')
          .eq('id', content_id)
          .single();
        contentData = data;
      } else if (content_type === 'blog') {
        const { data } = await supabase
          .from('blog_posts')
          .select('title, content, author_id, featured_image')
          .eq('id', content_id)
          .single();
        contentData = data;

        if (data?.author_id) {
          const { data: author } = await supabase
            .from('authors')
            .select('name, bio, credentials, social_links, avatar_url')
            .eq('id', data.author_id)
            .single();
          authorInfo = author;
        }
      }
    }

    if (!contentData) {
      return jsonResponse({ error: 'Content not found' }, 404);
    }

    // Calculate E-E-A-T scores
    const scores = await calculateEeatScores(contentData, authorInfo, env);

    // Save scores
    const eeatData = {
      brand_id: brandId,
      content_type,
      content_id,
      experience_score: scores.experience.score,
      expertise_score: scores.expertise.score,
      authoritativeness_score: scores.authoritativeness.score,
      trustworthiness_score: scores.trustworthiness.score,
      overall_score: scores.overall,
      experience_factors: scores.experience.factors,
      expertise_factors: scores.expertise.factors,
      authority_factors: scores.authoritativeness.factors,
      trust_factors: scores.trustworthiness.factors,
      improvement_suggestions: scores.suggestions,
      analyzed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('eeat_scores')
      .upsert(eeatData, { onConflict: 'brand_id,content_type,content_id' })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({
      ...data,
      breakdown: scores,
    });
  } catch (error) {
    console.error('Error analyzing E-E-A-T:', error);
    return jsonResponse({ error: 'Failed to analyze E-E-A-T' }, 500);
  }
}

async function calculateEeatScores(content: any, author: any, env: Env): Promise<any> {
  const text = content.description || content.content || '';
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Experience factors
  const experienceFactors: any = {
    first_person_narrative: /\b(I|we|my|our)\b/i.test(text),
    specific_examples: /\b(for example|such as|specifically|in my experience)\b/i.test(text),
    real_world_usage: /\b(tested|tried|used|experience|hands-on)\b/i.test(text),
    case_studies: /\b(case study|results|outcome|before and after)\b/i.test(text),
    original_photos: (content.images || []).length > 0,
  };
  const experienceScore = calculateFactorScore(experienceFactors);

  // Expertise factors
  const expertiseFactors: any = {
    technical_depth: wordCount > 500,
    industry_terminology: /\b(methodology|analysis|research|data|study)\b/i.test(text),
    citations: /\b(according to|research shows|studies indicate|source:)\b/i.test(text),
    author_credentials: author?.credentials ? true : false,
    structured_content: /<h[2-6]>/i.test(text) || /^#+\s/m.test(text),
  };
  const expertiseScore = calculateFactorScore(expertiseFactors);

  // Authoritativeness factors
  const authorityFactors: any = {
    author_bio: author?.bio ? true : false,
    author_social: author?.social_links && Object.keys(author.social_links).length > 0,
    detailed_about: author?.credentials ? true : false,
    industry_recognition: false, // Would need external data
    backlinks: false, // Would need external data
  };
  const authorityScore = calculateFactorScore(authorityFactors);

  // Trustworthiness factors
  const trustFactors: any = {
    contact_info: true, // Assume present on site
    privacy_policy: true, // Assume present
    clear_authorship: author?.name ? true : false,
    factual_accuracy: true, // Would need fact-checking
    reviews_present: content.reviews_count > 0,
    positive_reviews: content.average_rating >= 4.0,
  };
  const trustScore = calculateFactorScore(trustFactors);

  // Overall score (weighted average)
  const overall = Math.round(
    experienceScore * 0.2 +
    expertiseScore * 0.3 +
    authorityScore * 0.25 +
    trustScore * 0.25
  );

  // Generate suggestions
  const suggestions = generateEeatSuggestions(
    experienceFactors,
    expertiseFactors,
    authorityFactors,
    trustFactors
  );

  return {
    overall,
    experience: { score: experienceScore, factors: experienceFactors },
    expertise: { score: expertiseScore, factors: expertiseFactors },
    authoritativeness: { score: authorityScore, factors: authorityFactors },
    trustworthiness: { score: trustScore, factors: trustFactors },
    suggestions,
  };
}

function calculateFactorScore(factors: Record<string, boolean>): number {
  const trueCount = Object.values(factors).filter(v => v === true).length;
  const totalCount = Object.keys(factors).length;
  return Math.round((trueCount / totalCount) * 100);
}

function generateEeatSuggestions(
  experience: Record<string, boolean>,
  expertise: Record<string, boolean>,
  authority: Record<string, boolean>,
  trust: Record<string, boolean>
): string[] {
  const suggestions: string[] = [];

  // Experience suggestions
  if (!experience.first_person_narrative) {
    suggestions.push('Add first-person narratives to show real experience with the topic');
  }
  if (!experience.specific_examples) {
    suggestions.push('Include specific examples and use cases');
  }
  if (!experience.original_photos) {
    suggestions.push('Add original photos showing real-world usage or results');
  }

  // Expertise suggestions
  if (!expertise.technical_depth) {
    suggestions.push('Expand content to provide more in-depth coverage (aim for 500+ words)');
  }
  if (!expertise.citations) {
    suggestions.push('Add citations and references to authoritative sources');
  }
  if (!expertise.author_credentials) {
    suggestions.push('Add author credentials and qualifications');
  }

  // Authority suggestions
  if (!authority.author_bio) {
    suggestions.push('Add a detailed author bio explaining expertise in the field');
  }
  if (!authority.author_social) {
    suggestions.push('Link to author social profiles to establish identity');
  }

  // Trust suggestions
  if (!trust.clear_authorship) {
    suggestions.push('Clearly display author name and credentials on the page');
  }
  if (!trust.reviews_present) {
    suggestions.push('Encourage customer reviews to build trust signals');
  }

  return suggestions;
}

async function handleAnalyzeAllEeat(env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    let analyzed = 0;

    // Analyze products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, description, images, reviews_count, average_rating')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .limit(50);

    for (const product of products || []) {
      const scores = await calculateEeatScores(product, null, env);

      await supabase.from('eeat_scores').upsert({
        brand_id: brandId,
        content_type: 'product',
        content_id: product.id,
        experience_score: scores.experience.score,
        expertise_score: scores.expertise.score,
        authoritativeness_score: scores.authoritativeness.score,
        trustworthiness_score: scores.trustworthiness.score,
        overall_score: scores.overall,
        experience_factors: scores.experience.factors,
        expertise_factors: scores.expertise.factors,
        authority_factors: scores.authoritativeness.factors,
        trust_factors: scores.trustworthiness.factors,
        improvement_suggestions: scores.suggestions,
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'brand_id,content_type,content_id' });

      analyzed++;
    }

    // Analyze blog posts
    const { data: blogs } = await supabase
      .from('blog_posts')
      .select('id, title, content, author_id')
      .eq('brand_id', brandId)
      .eq('status', 'published')
      .limit(50);

    for (const blog of blogs || []) {
      let author = null;
      if (blog.author_id) {
        const { data } = await supabase
          .from('authors')
          .select('name, bio, credentials, social_links')
          .eq('id', blog.author_id)
          .single();
        author = data;
      }

      const scores = await calculateEeatScores(blog, author, env);

      await supabase.from('eeat_scores').upsert({
        brand_id: brandId,
        content_type: 'blog',
        content_id: blog.id,
        experience_score: scores.experience.score,
        expertise_score: scores.expertise.score,
        authoritativeness_score: scores.authoritativeness.score,
        trustworthiness_score: scores.trustworthiness.score,
        overall_score: scores.overall,
        experience_factors: scores.experience.factors,
        expertise_factors: scores.expertise.factors,
        authority_factors: scores.authoritativeness.factors,
        trust_factors: scores.trustworthiness.factors,
        improvement_suggestions: scores.suggestions,
        analyzed_at: new Date().toISOString(),
      }, { onConflict: 'brand_id,content_type,content_id' });

      analyzed++;
    }

    return jsonResponse({
      success: true,
      analyzed,
    });
  } catch (error) {
    console.error('Error analyzing all E-E-A-T:', error);
    return jsonResponse({ error: 'Failed to analyze all E-E-A-T' }, 500);
  }
}

async function handleGetEeatScores(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const contentType = url.searchParams.get('content_type');
    const minScore = url.searchParams.get('min_score');
    const maxScore = url.searchParams.get('max_score');

    let query = supabase
      .from('eeat_scores')
      .select('*')
      .eq('brand_id', brandId)
      .order('overall_score', { ascending: true });

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    if (minScore) {
      query = query.gte('overall_score', parseInt(minScore, 10));
    }

    if (maxScore) {
      query = query.lte('overall_score', parseInt(maxScore, 10));
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({
      scores: data || [],
      total: data?.length || 0,
    });
  } catch (error) {
    console.error('Error getting E-E-A-T scores:', error);
    return jsonResponse({ error: 'Failed to get E-E-A-T scores' }, 500);
  }
}

async function handleGetEeatScore(id: string, supabase: any): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('eeat_scores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error getting E-E-A-T score:', error);
    return jsonResponse({ error: 'Failed to get E-E-A-T score' }, 500);
  }
}

async function handleGetRecommendations(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { content_type, content_id } = body;

    // Get current score
    const { data: score } = await supabase
      .from('eeat_scores')
      .select('*')
      .eq('brand_id', brandId)
      .eq('content_type', content_type)
      .eq('content_id', content_id)
      .single();

    if (!score) {
      return jsonResponse({ error: 'Score not found. Analyze content first.' }, 404);
    }

    // Use AI to generate detailed recommendations
    const prompt = `Based on this E-E-A-T analysis, provide specific actionable recommendations:

Current Scores:
- Experience: ${score.experience_score}/100
- Expertise: ${score.expertise_score}/100
- Authoritativeness: ${score.authoritativeness_score}/100
- Trustworthiness: ${score.trustworthiness_score}/100

Missing Factors:
${JSON.stringify(score.improvement_suggestions, null, 2)}

Provide 5 specific, actionable recommendations to improve E-E-A-T. Format as JSON:
{
  "recommendations": [
    {"priority": "high|medium|low", "category": "experience|expertise|authority|trust", "action": "...", "impact": "..."}
  ]
}`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are an SEO expert specializing in E-E-A-T optimization.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (response.ok) {
      const aiResponse = await response.json() as any;
      const content = aiResponse.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return jsonResponse({
          current_score: score.overall_score,
          ...parsed,
        });
      }
    }

    // Fallback to stored suggestions
    return jsonResponse({
      current_score: score.overall_score,
      recommendations: (score.improvement_suggestions || []).map((s: string) => ({
        priority: 'medium',
        action: s,
      })),
    });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return jsonResponse({ error: 'Failed to get recommendations' }, 500);
  }
}

async function handleGetEeatSummary(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data } = await supabase
      .from('eeat_scores')
      .select('content_type, overall_score, experience_score, expertise_score, authoritativeness_score, trustworthiness_score')
      .eq('brand_id', brandId);

    if (!data || data.length === 0) {
      return jsonResponse({
        message: 'No E-E-A-T scores found. Run analysis first.',
        total_analyzed: 0,
      });
    }

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const summary = {
      total_analyzed: data.length,
      average_scores: {
        overall: avg(data.map((d: any) => d.overall_score)),
        experience: avg(data.map((d: any) => d.experience_score)),
        expertise: avg(data.map((d: any) => d.expertise_score)),
        authoritativeness: avg(data.map((d: any) => d.authoritativeness_score)),
        trustworthiness: avg(data.map((d: any) => d.trustworthiness_score)),
      },
      by_content_type: {} as Record<string, any>,
      score_distribution: {
        excellent: data.filter((d: any) => d.overall_score >= 80).length,
        good: data.filter((d: any) => d.overall_score >= 60 && d.overall_score < 80).length,
        needs_improvement: data.filter((d: any) => d.overall_score >= 40 && d.overall_score < 60).length,
        poor: data.filter((d: any) => d.overall_score < 40).length,
      },
    };

    // Group by content type
    const types = [...new Set(data.map((d: any) => d.content_type))] as string[];
    for (const type of types) {
      const typeData = data.filter((d: any) => d.content_type === type);
      summary.by_content_type[type] = {
        count: typeData.length,
        average_score: avg(typeData.map((d: any) => d.overall_score)),
      };
    }

    return jsonResponse(summary);
  } catch (error) {
    console.error('Error getting E-E-A-T summary:', error);
    return jsonResponse({ error: 'Failed to get E-E-A-T summary' }, 500);
  }
}
