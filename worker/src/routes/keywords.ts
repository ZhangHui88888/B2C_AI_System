/**
 * Keyword Research & Search Intent Classification Routes
 * Handles keyword research, intent classification, and ranking monitoring
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleKeywords(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  // Keyword Research
  if (path === '/api/keywords/research' && method === 'POST') {
    return handleResearchKeyword(request, env, supabase, brandId);
  }

  if (path === '/api/keywords/bulk-research' && method === 'POST') {
    return handleBulkResearch(request, env, supabase, brandId);
  }

  if (path === '/api/keywords' && method === 'GET') {
    return handleGetKeywords(request, supabase, brandId);
  }

  if (path.match(/^\/api\/keywords\/[\w-]+$/) && method === 'GET') {
    const id = path.split('/').pop()!;
    return handleGetKeyword(id, supabase);
  }

  if (path.match(/^\/api\/keywords\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop()!;
    return handleUpdateKeyword(request, id, supabase);
  }

  if (path.match(/^\/api\/keywords\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    return handleDeleteKeyword(id, supabase);
  }

  // Search Intent Classification
  if (path === '/api/keywords/classify-intent' && method === 'POST') {
    return handleClassifyIntent(request, env);
  }

  // Keyword Rankings
  if (path === '/api/keywords/rankings/check' && method === 'POST') {
    return handleCheckRankings(request, env, supabase, brandId);
  }

  if (path === '/api/keywords/rankings' && method === 'GET') {
    return handleGetRankings(request, supabase, brandId);
  }

  if (path === '/api/keywords/rankings/history' && method === 'GET') {
    return handleGetRankingHistory(request, supabase, brandId);
  }

  // Suggestions
  if (path === '/api/keywords/suggestions' && method === 'POST') {
    return handleGetKeywordSuggestions(request, env, supabase, brandId);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Keyword Research ====================

async function handleResearchKeyword(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { keyword, target_page_type, target_page_id } = body;

    if (!keyword) {
      return jsonResponse({ error: 'keyword is required' }, 400);
    }

    const normalizedKeyword = keyword.toLowerCase().trim();

    // Use AI to analyze the keyword
    const analysis = await analyzeKeywordWithAI(keyword, env);

    const keywordData = {
      brand_id: brandId,
      keyword: keyword.trim(),
      keyword_normalized: normalizedKeyword,
      search_intent: analysis.intent,
      intent_confidence: analysis.intentConfidence,
      search_volume_monthly: analysis.estimatedVolume,
      keyword_difficulty: analysis.difficulty,
      competition_level: analysis.competition,
      trend_direction: analysis.trend,
      related_keywords: analysis.relatedKeywords,
      long_tail_variations: analysis.longTailVariations,
      target_page_type,
      target_page_id,
      ai_suggestions: analysis.suggestions,
      is_tracked: false,
      priority: 'medium',
      last_researched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('keyword_research')
      .upsert(keywordData, { onConflict: 'brand_id,keyword_normalized' })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error researching keyword:', error);
    return jsonResponse({ error: 'Failed to research keyword' }, 500);
  }
}

async function analyzeKeywordWithAI(keyword: string, env: Env): Promise<any> {
  try {
    const prompt = `Analyze this keyword for SEO: "${keyword}"

Provide analysis in JSON format:
{
  "intent": "informational|navigational|transactional|commercial",
  "intentConfidence": 0.0-1.0,
  "estimatedVolume": number (monthly searches estimate),
  "difficulty": 0-100,
  "competition": "low|medium|high",
  "trend": "up|down|stable",
  "relatedKeywords": ["keyword1", "keyword2", "keyword3"],
  "longTailVariations": ["long tail 1", "long tail 2", "long tail 3"],
  "suggestions": "Brief SEO suggestions for this keyword"
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
          { role: 'system', content: 'You are an SEO expert. Analyze keywords and provide data in JSON format only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const aiResponse = await response.json() as any;
    const content = aiResponse.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Default values if AI fails
    return getDefaultKeywordAnalysis(keyword);
  } catch (error) {
    console.error('AI keyword analysis failed:', error);
    return getDefaultKeywordAnalysis(keyword);
  }
}

function getDefaultKeywordAnalysis(keyword: string): any {
  const words = keyword.split(' ').length;
  return {
    intent: words >= 4 ? 'informational' : 'transactional',
    intentConfidence: 0.5,
    estimatedVolume: 100,
    difficulty: 50,
    competition: 'medium',
    trend: 'stable',
    relatedKeywords: [],
    longTailVariations: [],
    suggestions: 'Create quality content targeting this keyword.',
  };
}

async function handleBulkResearch(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { keywords } = body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return jsonResponse({ error: 'keywords array is required' }, 400);
    }

    const results: any[] = [];
    const batchSize = 3;

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (keyword: string) => {
        try {
          const normalizedKeyword = keyword.toLowerCase().trim();
          const analysis = await analyzeKeywordWithAI(keyword, env);

          const keywordData = {
            brand_id: brandId,
            keyword: keyword.trim(),
            keyword_normalized: normalizedKeyword,
            search_intent: analysis.intent,
            intent_confidence: analysis.intentConfidence,
            search_volume_monthly: analysis.estimatedVolume,
            keyword_difficulty: analysis.difficulty,
            competition_level: analysis.competition,
            related_keywords: analysis.relatedKeywords,
            long_tail_variations: analysis.longTailVariations,
            ai_suggestions: analysis.suggestions,
            last_researched_at: new Date().toISOString(),
          };

          await supabase
            .from('keyword_research')
            .upsert(keywordData, { onConflict: 'brand_id,keyword_normalized' });

          results.push({ keyword, success: true });
        } catch (err) {
          results.push({ keyword, success: false, error: String(err) });
        }
      }));

      // Rate limiting
      if (i + batchSize < keywords.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return jsonResponse({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Error bulk researching keywords:', error);
    return jsonResponse({ error: 'Failed to bulk research keywords' }, 500);
  }
}

async function handleGetKeywords(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const intent = url.searchParams.get('intent');
    const tracked = url.searchParams.get('tracked');
    const priority = url.searchParams.get('priority');
    const search = url.searchParams.get('search');

    let query = supabase
      .from('keyword_research')
      .select('*')
      .eq('brand_id', brandId)
      .order('search_volume_monthly', { ascending: false, nullsFirst: false });

    if (intent) {
      query = query.eq('search_intent', intent);
    }

    if (tracked !== null) {
      query = query.eq('is_tracked', tracked === 'true');
    }

    if (priority) {
      query = query.eq('priority', priority);
    }

    if (search) {
      query = query.ilike('keyword', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate summary stats
    const summary = {
      total: data?.length || 0,
      tracked: data?.filter((k: any) => k.is_tracked).length || 0,
      by_intent: {
        informational: data?.filter((k: any) => k.search_intent === 'informational').length || 0,
        navigational: data?.filter((k: any) => k.search_intent === 'navigational').length || 0,
        transactional: data?.filter((k: any) => k.search_intent === 'transactional').length || 0,
        commercial: data?.filter((k: any) => k.search_intent === 'commercial').length || 0,
      },
    };

    return jsonResponse({
      keywords: data || [],
      summary,
    });
  } catch (error) {
    console.error('Error getting keywords:', error);
    return jsonResponse({ error: 'Failed to get keywords' }, 500);
  }
}

async function handleGetKeyword(id: string, supabase: any): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('keyword_research')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error getting keyword:', error);
    return jsonResponse({ error: 'Failed to get keyword' }, 500);
  }
}

async function handleUpdateKeyword(request: Request, id: string, supabase: any): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { is_tracked, priority, target_page_type, target_page_id } = body;

    const updateData: any = { updated_at: new Date().toISOString() };

    if (is_tracked !== undefined) updateData.is_tracked = is_tracked;
    if (priority) updateData.priority = priority;
    if (target_page_type) updateData.target_page_type = target_page_type;
    if (target_page_id) updateData.target_page_id = target_page_id;

    const { data, error } = await supabase
      .from('keyword_research')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error updating keyword:', error);
    return jsonResponse({ error: 'Failed to update keyword' }, 500);
  }
}

async function handleDeleteKeyword(id: string, supabase: any): Promise<Response> {
  try {
    const { error } = await supabase
      .from('keyword_research')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error deleting keyword:', error);
    return jsonResponse({ error: 'Failed to delete keyword' }, 500);
  }
}

// ==================== Search Intent Classification ====================

async function handleClassifyIntent(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { keywords } = body;

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return jsonResponse({ error: 'keywords array is required' }, 400);
    }

    const prompt = `Classify the search intent for these keywords. For each keyword, determine if the intent is:
- informational: user wants to learn something
- navigational: user wants to find a specific page/site
- transactional: user wants to buy something
- commercial: user is researching before buying

Keywords to classify:
${keywords.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}

Respond in JSON format:
{
  "classifications": [
    {"keyword": "...", "intent": "...", "confidence": 0.0-1.0, "reasoning": "..."}
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
          { role: 'system', content: 'You are an SEO expert specializing in search intent analysis. Respond only in JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const aiResponse = await response.json() as any;
    const content = aiResponse.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return jsonResponse(parsed);
    }

    return jsonResponse({ error: 'Failed to parse AI response' }, 500);
  } catch (error) {
    console.error('Error classifying intent:', error);
    return jsonResponse({ error: 'Failed to classify intent' }, 500);
  }
}

// ==================== Keyword Rankings ====================

async function handleCheckRankings(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    // Get tracked keywords
    const { data: trackedKeywords } = await supabase
      .from('keyword_research')
      .select('id, keyword, current_ranking')
      .eq('brand_id', brandId)
      .eq('is_tracked', true);

    if (!trackedKeywords || trackedKeywords.length === 0) {
      return jsonResponse({ message: 'No tracked keywords found' });
    }

    const results: any[] = [];

    for (const kw of trackedKeywords) {
      // In production, this would call a ranking API (e.g., SerpAPI, DataForSEO)
      // For now, we simulate ranking changes
      const previousPosition = kw.current_ranking || null;
      const newPosition = simulateRankingCheck();
      const positionChange = previousPosition && newPosition ? previousPosition - newPosition : 0;

      // Save ranking history
      await supabase.from('keyword_rankings').insert({
        brand_id: brandId,
        keyword_id: kw.id,
        keyword: kw.keyword,
        position: newPosition,
        previous_position: previousPosition,
        position_change: positionChange,
        search_engine: 'google',
        country: 'us',
        device_type: 'desktop',
        checked_at: new Date().toISOString(),
      });

      // Update keyword with current ranking
      await supabase
        .from('keyword_research')
        .update({
          current_ranking: newPosition,
          previous_position: previousPosition,
          updated_at: new Date().toISOString(),
        })
        .eq('id', kw.id);

      results.push({
        keyword: kw.keyword,
        position: newPosition,
        previous_position: previousPosition,
        change: positionChange,
      });
    }

    return jsonResponse({
      success: true,
      checked: results.length,
      results,
    });
  } catch (error) {
    console.error('Error checking rankings:', error);
    return jsonResponse({ error: 'Failed to check rankings' }, 500);
  }
}

function simulateRankingCheck(): number | null {
  // Simulate: 70% chance of ranking, position 1-100
  if (Math.random() > 0.3) {
    return Math.floor(Math.random() * 100) + 1;
  }
  return null;
}

async function handleGetRankings(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('keyword_research')
      .select('id, keyword, current_ranking, previous_position, search_volume_monthly, keyword_difficulty')
      .eq('brand_id', brandId)
      .eq('is_tracked', true)
      .order('current_ranking', { ascending: true, nullsFirst: false });

    if (error) throw error;

    const summary = {
      total_tracked: data?.length || 0,
      ranking: data?.filter((k: any) => k.current_ranking !== null).length || 0,
      top_10: data?.filter((k: any) => k.current_ranking && k.current_ranking <= 10).length || 0,
      top_20: data?.filter((k: any) => k.current_ranking && k.current_ranking <= 20).length || 0,
      improving: data?.filter((k: any) => k.previous_position && k.current_ranking && k.current_ranking < k.previous_position).length || 0,
      declining: data?.filter((k: any) => k.previous_position && k.current_ranking && k.current_ranking > k.previous_position).length || 0,
    };

    return jsonResponse({
      keywords: data || [],
      summary,
    });
  } catch (error) {
    console.error('Error getting rankings:', error);
    return jsonResponse({ error: 'Failed to get rankings' }, 500);
  }
}

async function handleGetRankingHistory(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const keywordId = url.searchParams.get('keyword_id');
    const days = parseInt(url.searchParams.get('days') || '30', 10);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('keyword_rankings')
      .select('*')
      .eq('brand_id', brandId)
      .gte('checked_at', startDate.toISOString())
      .order('checked_at', { ascending: false });

    if (keywordId) {
      query = query.eq('keyword_id', keywordId);
    }

    const { data, error } = await query.limit(500);

    if (error) throw error;

    return jsonResponse({
      history: data || [],
      period_days: days,
    });
  } catch (error) {
    console.error('Error getting ranking history:', error);
    return jsonResponse({ error: 'Failed to get ranking history' }, 500);
  }
}

// ==================== Keyword Suggestions ====================

async function handleGetKeywordSuggestions(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { seed_keyword, count = 10 } = body;

    if (!seed_keyword) {
      return jsonResponse({ error: 'seed_keyword is required' }, 400);
    }

    const prompt = `Generate ${count} SEO keyword suggestions related to: "${seed_keyword}"

Include a mix of:
- Related terms
- Long-tail variations
- Question-based keywords
- Commercial intent keywords

Respond in JSON:
{
  "suggestions": [
    {"keyword": "...", "intent": "...", "estimated_volume": number, "difficulty": "low|medium|high"}
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
          { role: 'system', content: 'You are an SEO keyword research expert. Suggest relevant keywords.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error('AI API request failed');
    }

    const aiResponse = await response.json() as any;
    const content = aiResponse.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return jsonResponse(parsed);
    }

    return jsonResponse({ suggestions: [] });
  } catch (error) {
    console.error('Error getting keyword suggestions:', error);
    return jsonResponse({ error: 'Failed to get keyword suggestions' }, 500);
  }
}
