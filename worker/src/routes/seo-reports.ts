/**
 * Automated SEO Reports Routes
 * Handles scheduled report generation and delivery
 */

import { Env } from '../index';
import { getSupabase } from '../utils/supabase';
import { jsonResponse } from '../utils/response';
import { sendResendEmail } from '../utils/email';

function getBrandId(request: Request): string | null {
  return request.headers.get('x-brand-id');
}

export async function handleSeoReports(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const supabase = getSupabase(env);
  const brandId = getBrandId(request);

  if (!brandId && !(path === '/api/seo-reports/run-scheduled' && method === 'POST')) {
    return jsonResponse({ error: 'Brand context missing' }, 400);
  }

  // Report configuration
  if (path === '/api/seo-reports/config' && method === 'GET') {
    return handleGetReportConfigs(supabase, brandId);
  }

  if (path === '/api/seo-reports/config' && method === 'POST') {
    return handleCreateReportConfig(request, supabase, brandId);
  }

  if (path.match(/^\/api\/seo-reports\/config\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop()!;
    return handleUpdateReportConfig(request, id, supabase, brandId);
  }

  if (path.match(/^\/api\/seo-reports\/config\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop()!;
    return handleDeleteReportConfig(id, supabase, brandId);
  }

  // Generate report manually
  if (path === '/api/seo-reports/generate' && method === 'POST') {
    return handleGenerateReport(request, env, supabase, brandId);
  }

  // Get report history
  if (path === '/api/seo-reports/history' && method === 'GET') {
    return handleGetReportHistory(request, supabase, brandId);
  }

  // Get single report
  if (path.match(/^\/api\/seo-reports\/[\w-]+$/) && method === 'GET') {
    const id = path.split('/').pop()!;
    return handleGetReport(id, supabase, brandId);
  }

  // Run scheduled reports (called by cron)
  if (path === '/api/seo-reports/run-scheduled' && method === 'POST') {
    return handleRunScheduledReports(env, supabase);
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

// ==================== Report Configuration ====================

async function handleGetReportConfigs(supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('automated_reports')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return jsonResponse({ configs: data || [] });
  } catch (error) {
    console.error('Error getting report configs:', error);
    return jsonResponse({ error: 'Failed to get report configs' }, 500);
  }
}

async function handleCreateReportConfig(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const {
      report_name,
      report_type,
      schedule_frequency,
      schedule_day,
      schedule_time,
      recipients,
      include_sections,
      custom_filters,
    } = body;

    if (!report_name || !report_type) {
      return jsonResponse({ error: 'report_name and report_type are required' }, 400);
    }

    // Calculate next run time
    const nextRunAt = calculateNextRunTime(schedule_frequency, schedule_day, schedule_time);

    const { data, error } = await supabase
      .from('automated_reports')
      .insert({
        brand_id: brandId,
        report_name,
        report_type,
        schedule_frequency: schedule_frequency || 'weekly',
        schedule_day: schedule_day || 1,
        schedule_time: schedule_time || '09:00:00',
        recipients: recipients || [],
        include_sections: include_sections || ['overview', 'rankings', 'issues', 'recommendations'],
        custom_filters: custom_filters || {},
        next_run_at: nextRunAt,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error creating report config:', error);
    return jsonResponse({ error: 'Failed to create report config' }, 500);
  }
}

async function handleUpdateReportConfig(request: Request, id: string, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const updateData: any = { updated_at: new Date().toISOString() };

    const allowedFields = [
      'report_name', 'report_type', 'schedule_frequency', 'schedule_day',
      'schedule_time', 'recipients', 'include_sections', 'custom_filters', 'is_active'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Recalculate next run time if schedule changed
    if (body.schedule_frequency || body.schedule_day || body.schedule_time) {
      updateData.next_run_at = calculateNextRunTime(
        body.schedule_frequency,
        body.schedule_day,
        body.schedule_time
      );
    }

    const { data, error } = await supabase
      .from('automated_reports')
      .update(updateData)
      .eq('brand_id', brandId)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error updating report config:', error);
    return jsonResponse({ error: 'Failed to update report config' }, 500);
  }
}

async function handleDeleteReportConfig(id: string, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { error } = await supabase
      .from('automated_reports')
      .delete()
      .eq('brand_id', brandId)
      .eq('id', id);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Error deleting report config:', error);
    return jsonResponse({ error: 'Failed to delete report config' }, 500);
  }
}

function calculateNextRunTime(frequency?: string, day?: number, time?: string): string {
  const now = new Date();
  const [hours, minutes] = (time || '09:00:00').split(':').map(Number);

  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  switch (frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      const targetDay = day || 1; // Monday by default
      const currentDay = nextRun.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && nextRun <= now)) {
        daysUntil += 7;
      }
      nextRun.setDate(nextRun.getDate() + daysUntil);
      break;

    case 'monthly':
      const targetDate = day || 1;
      nextRun.setDate(targetDate);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;

    default:
      nextRun.setDate(nextRun.getDate() + 7);
  }

  return nextRun.toISOString();
}

// ==================== Report Generation ====================

async function handleGenerateReport(request: Request, env: Env, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const body = await request.json() as any;
    const { report_type, include_sections, send_email, recipients } = body;

    // Generate report data
    const reportData = await generateReportData(supabase, brandId, report_type, include_sections);

    // Save report
    const { data: report, error } = await supabase
      .from('report_history')
      .insert({
        brand_id: brandId,
        report_data: reportData,
        overall_seo_score: reportData.overview?.average_seo_score || 0,
        total_pages_analyzed: reportData.overview?.total_pages || 0,
        issues_found: reportData.issues?.total || 0,
        improvements_since_last: reportData.overview?.improvements || 0,
        delivery_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Send email if requested
    if (send_email && recipients?.length > 0) {
      await sendReportEmail(env, report, recipients);
      
      await supabase
        .from('report_history')
        .update({
          delivered_to: recipients,
          delivery_status: 'sent',
        })
        .eq('brand_id', brandId)
        .eq('id', report.id);
    }

    return jsonResponse({
      report_id: report.id,
      report_data: reportData,
      sent_to: send_email ? recipients : [],
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return jsonResponse({ error: 'Failed to generate report' }, 500);
  }
}

async function generateReportData(
  supabase: any, 
  brandId: string | null, 
  reportType: string,
  sections: string[]
): Promise<any> {
  const report: any = {
    generated_at: new Date().toISOString(),
    report_type: reportType,
  };

  // Overview section
  if (sections.includes('overview')) {
    const { data: seoCache } = await supabase
      .from('content_seo_cache')
      .select('seo_score')
      .eq('brand_id', brandId);

    const { data: indexStatus } = await supabase
      .from('index_status')
      .select('is_indexed')
      .eq('brand_id', brandId);

    const { data: eeatScores } = await supabase
      .from('eeat_scores')
      .select('overall_score')
      .eq('brand_id', brandId);

    const avgSeoScore = seoCache?.length 
      ? Math.round(seoCache.reduce((sum: number, s: any) => sum + (s.seo_score || 0), 0) / seoCache.length)
      : 0;

    const avgEeatScore = eeatScores?.length
      ? Math.round(eeatScores.reduce((sum: number, s: any) => sum + (s.overall_score || 0), 0) / eeatScores.length)
      : 0;

    report.overview = {
      total_pages: indexStatus?.length || 0,
      indexed_pages: indexStatus?.filter((p: any) => p.is_indexed).length || 0,
      average_seo_score: avgSeoScore,
      average_eeat_score: avgEeatScore,
      index_rate: indexStatus?.length 
        ? Math.round((indexStatus.filter((p: any) => p.is_indexed).length / indexStatus.length) * 100)
        : 0,
    };
  }

  // Rankings section
  if (sections.includes('rankings')) {
    const { data: keywords } = await supabase
      .from('keyword_research')
      .select('keyword, current_ranking, previous_position, search_volume_monthly')
      .eq('brand_id', brandId)
      .eq('is_tracked', true)
      .order('current_ranking', { ascending: true, nullsFirst: false })
      .limit(20);

    report.rankings = {
      tracked_keywords: keywords?.length || 0,
      top_10: keywords?.filter((k: any) => k.current_ranking && k.current_ranking <= 10).length || 0,
      improving: keywords?.filter((k: any) => 
        k.previous_position && k.current_ranking && k.current_ranking < k.previous_position
      ).length || 0,
      declining: keywords?.filter((k: any) => 
        k.previous_position && k.current_ranking && k.current_ranking > k.previous_position
      ).length || 0,
      top_keywords: (keywords || []).slice(0, 10).map((k: any) => ({
        keyword: k.keyword,
        position: k.current_ranking,
        change: k.previous_position ? k.previous_position - k.current_ranking : 0,
        volume: k.search_volume_monthly,
      })),
    };
  }

  // Issues section
  if (sections.includes('issues')) {
    const { data: orphans } = await supabase
      .from('orphan_pages')
      .select('id')
      .eq('brand_id', brandId)
      .eq('is_resolved', false);

    const { data: lowDensity } = await supabase
      .from('link_density_analysis')
      .select('id')
      .eq('brand_id', brandId)
      .eq('density_status', 'too_low');

    const { data: notIndexed } = await supabase
      .from('index_status')
      .select('page_url')
      .eq('brand_id', brandId)
      .eq('is_indexed', false);

    const { data: lowEeat } = await supabase
      .from('eeat_scores')
      .select('id')
      .eq('brand_id', brandId)
      .lt('overall_score', 50);

    const { data: errors404 } = await supabase
      .from('error_404_logs')
      .select('id')
      .eq('brand_id', brandId)
      .eq('is_resolved', false);

    report.issues = {
      total: (orphans?.length || 0) + (lowDensity?.length || 0) + (notIndexed?.length || 0) + (lowEeat?.length || 0) + (errors404?.length || 0),
      orphan_pages: orphans?.length || 0,
      low_link_density: lowDensity?.length || 0,
      not_indexed: notIndexed?.length || 0,
      low_eeat: lowEeat?.length || 0,
      unresolved_404s: errors404?.length || 0,
      not_indexed_urls: (notIndexed || []).slice(0, 10).map((p: any) => p.page_url),
    };
  }

  // Recommendations section
  if (sections.includes('recommendations')) {
    report.recommendations = generateRecommendations(report);
  }

  return report;
}

function generateRecommendations(report: any): string[] {
  const recommendations: string[] = [];

  if (report.overview?.average_seo_score < 70) {
    recommendations.push('Improve on-page SEO: Focus on meta titles, descriptions, and content quality');
  }

  if (report.overview?.index_rate < 90) {
    recommendations.push('Submit unindexed pages to Google Search Console for faster indexing');
  }

  if (report.issues?.orphan_pages > 0) {
    recommendations.push(`Fix ${report.issues.orphan_pages} orphan pages by adding internal links`);
  }

  if (report.issues?.low_link_density > 0) {
    recommendations.push(`Add more internal links to ${report.issues.low_link_density} pages with low link density`);
  }

  if (report.issues?.low_eeat > 0) {
    recommendations.push(`Improve E-E-A-T signals on ${report.issues.low_eeat} pages`);
  }

  if (report.rankings?.declining > report.rankings?.improving) {
    recommendations.push('Review declining keywords and update content to maintain rankings');
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Continue monitoring and maintaining your SEO health');
  }

  return recommendations;
}

async function sendReportEmail(env: Env, report: any, recipients: string[]): Promise<void> {
  const html = generateReportEmailHtml(report);

  for (const recipient of recipients) {
    await sendResendEmail(env, {
      to: recipient,
      subject: `SEO Report - ${new Date().toLocaleDateString()}`,
      html,
    });
  }
}

function generateReportEmailHtml(report: any): string {
  const data = report.report_data;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; }
    .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .metric-label { font-size: 12px; color: #666; }
    .issue { padding: 8px 0; border-bottom: 1px solid #eee; }
    .recommendation { padding: 8px 0; border-left: 3px solid #4F46E5; padding-left: 10px; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin:0;">SEO Performance Report</h1>
      <p style="margin:5px 0 0 0;">Generated: ${new Date(data.generated_at).toLocaleDateString()}</p>
    </div>
    <div class="content">
      ${data.overview ? `
      <div class="section">
        <h2>Overview</h2>
        <div class="metric">
          <div class="metric-value">${data.overview.average_seo_score}</div>
          <div class="metric-label">Avg SEO Score</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.overview.index_rate}%</div>
          <div class="metric-label">Index Rate</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.overview.total_pages}</div>
          <div class="metric-label">Total Pages</div>
        </div>
      </div>
      ` : ''}
      
      ${data.rankings ? `
      <div class="section">
        <h2>Keyword Rankings</h2>
        <div class="metric">
          <div class="metric-value">${data.rankings.tracked_keywords}</div>
          <div class="metric-label">Tracked</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.rankings.top_10}</div>
          <div class="metric-label">Top 10</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: green;">↑ ${data.rankings.improving}</div>
          <div class="metric-label">Improving</div>
        </div>
        <div class="metric">
          <div class="metric-value" style="color: red;">↓ ${data.rankings.declining}</div>
          <div class="metric-label">Declining</div>
        </div>
      </div>
      ` : ''}
      
      ${data.issues ? `
      <div class="section">
        <h2>Issues Found (${data.issues.total})</h2>
        ${data.issues.orphan_pages ? `<div class="issue">🔗 ${data.issues.orphan_pages} orphan pages</div>` : ''}
        ${data.issues.low_link_density ? `<div class="issue">📊 ${data.issues.low_link_density} pages with low link density</div>` : ''}
        ${data.issues.not_indexed ? `<div class="issue">🔍 ${data.issues.not_indexed} pages not indexed</div>` : ''}
        ${data.issues.low_eeat ? `<div class="issue">⭐ ${data.issues.low_eeat} pages with low E-E-A-T</div>` : ''}
        ${data.issues.unresolved_404s ? `<div class="issue">❌ ${data.issues.unresolved_404s} unresolved 404 errors</div>` : ''}
      </div>
      ` : ''}
      
      ${data.recommendations?.length ? `
      <div class="section">
        <h2>Recommendations</h2>
        ${data.recommendations.map((r: string) => `<div class="recommendation">${r}</div>`).join('')}
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>
  `;
}

// ==================== Report History ====================

async function handleGetReportHistory(request: Request, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const reportId = url.searchParams.get('report_id');

    let query = supabase
      .from('report_history')
      .select('id, report_id, overall_seo_score, total_pages_analyzed, issues_found, delivery_status, generated_at')
      .eq('brand_id', brandId)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (reportId) {
      query = query.eq('report_id', reportId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return jsonResponse({ history: data || [] });
  } catch (error) {
    console.error('Error getting report history:', error);
    return jsonResponse({ error: 'Failed to get report history' }, 500);
  }
}

async function handleGetReport(id: string, supabase: any, brandId: string | null): Promise<Response> {
  try {
    const { data, error } = await supabase
      .from('report_history')
      .select('*')
      .eq('brand_id', brandId)
      .eq('id', id)
      .single();

    if (error) throw error;

    return jsonResponse(data);
  } catch (error) {
    console.error('Error getting report:', error);
    return jsonResponse({ error: 'Failed to get report' }, 500);
  }
}

// ==================== Scheduled Reports ====================

async function handleRunScheduledReports(env: Env, supabase: any): Promise<Response> {
  try {
    // Get reports due to run
    const { data: dueReports } = await supabase
      .from('automated_reports')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', new Date().toISOString());

    let processed = 0;
    let sent = 0;

    for (const config of dueReports || []) {
      try {
        // Generate report
        const reportData = await generateReportData(
          supabase,
          config.brand_id,
          config.report_type,
          config.include_sections
        );

        // Save report
        const { data: report } = await supabase
          .from('report_history')
          .insert({
            brand_id: config.brand_id,
            report_id: config.id,
            report_data: reportData,
            overall_seo_score: reportData.overview?.average_seo_score || 0,
            total_pages_analyzed: reportData.overview?.total_pages || 0,
            issues_found: reportData.issues?.total || 0,
            delivery_status: 'pending',
          })
          .select()
          .single();

        processed++;

        // Send emails
        if (config.recipients?.length > 0 && report) {
          await sendReportEmail(env, report, config.recipients);
          
          await supabase
            .from('report_history')
            .update({
              delivered_to: config.recipients,
              delivery_status: 'sent',
            })
            .eq('brand_id', config.brand_id)
            .eq('id', report.id);

          sent++;
        }

        // Update next run time
        const nextRunAt = calculateNextRunTime(
          config.schedule_frequency,
          config.schedule_day,
          config.schedule_time
        );

        await supabase
          .from('automated_reports')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRunAt,
          })
          .eq('brand_id', config.brand_id)
          .eq('id', config.id);

      } catch (err) {
        console.error('Error processing report:', config.id, err);
      }
    }

    return jsonResponse({
      success: true,
      processed,
      sent,
    });
  } catch (error) {
    console.error('Error running scheduled reports:', error);
    return jsonResponse({ error: 'Failed to run scheduled reports' }, 500);
  }
}
