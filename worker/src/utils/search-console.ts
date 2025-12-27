/**
 * Google Search Console API Integration
 * URL inspection, indexing, and performance data
 */

// ============================================
// Types
// ============================================

interface SearchConsoleConfig {
  accessToken: string;
  siteUrl: string; // e.g., 'sc-domain:example.com' or 'https://example.com/'
}

interface PerformanceRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dimensions?: ('date' | 'query' | 'page' | 'country' | 'device' | 'searchAppearance')[];
  dimensionFilterGroups?: Array<{
    groupType?: 'and';
    filters: Array<{
      dimension: string;
      operator: 'equals' | 'contains' | 'notContains' | 'includingRegex' | 'excludingRegex';
      expression: string;
    }>;
  }>;
  rowLimit?: number;
  startRow?: number;
  dataState?: 'all' | 'final';
}

interface PerformanceRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PerformanceResponse {
  rows?: PerformanceRow[];
  responseAggregationType?: string;
}

interface InspectionResult {
  inspectionResultLink?: string;
  indexStatusResult?: {
    verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'NEUTRAL' | 'VERDICT_UNSPECIFIED';
    coverageState: string;
    robotsTxtState: string;
    indexingState: string;
    lastCrawlTime?: string;
    pageFetchState: string;
    googleCanonical?: string;
    userCanonical?: string;
    referringUrls?: string[];
    crawledAs?: 'DESKTOP' | 'MOBILE' | 'CRAWLING_USER_AGENT_UNSPECIFIED';
  };
  mobileUsabilityResult?: {
    verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'NEUTRAL' | 'VERDICT_UNSPECIFIED';
    issues?: Array<{
      issueType: string;
      severity: string;
      message: string;
    }>;
  };
  richResultsResult?: {
    verdict: 'PASS' | 'PARTIAL' | 'FAIL' | 'NEUTRAL' | 'VERDICT_UNSPECIFIED';
    detectedItems?: Array<{
      richResultType: string;
      items?: Array<{
        name?: string;
        issues?: Array<{
          issueMessage: string;
          severity: string;
        }>;
      }>;
    }>;
  };
}

interface SitemapInfo {
  path: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  lastDownloaded?: string;
  warnings?: number;
  errors?: number;
  contents?: Array<{
    type: string;
    submitted?: string;
    indexed?: string;
  }>;
}

// ============================================
// API Client
// ============================================

class SearchConsoleClient {
  private config: SearchConsoleConfig;
  private baseUrl = 'https://searchconsole.googleapis.com/v1';

  constructor(config: SearchConsoleConfig) {
    this.config = config;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.accessToken}`,
          ...options.headers,
        },
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // Performance Data
  // ============================================

  async getPerformance(params: PerformanceRequest): Promise<{
    success: boolean;
    data?: PerformanceResponse;
    error?: string;
  }> {
    const encodedSiteUrl = encodeURIComponent(this.config.siteUrl);
    return this.request<PerformanceResponse>(
      `/sites/${encodedSiteUrl}/searchAnalytics/query`,
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  async getTopQueries(
    startDate: string,
    endDate: string,
    limit: number = 100
  ): Promise<{ success: boolean; data?: PerformanceRow[]; error?: string }> {
    const result = await this.getPerformance({
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit: limit,
    });

    return {
      success: result.success,
      data: result.data?.rows,
      error: result.error,
    };
  }

  async getTopPages(
    startDate: string,
    endDate: string,
    limit: number = 100
  ): Promise<{ success: boolean; data?: PerformanceRow[]; error?: string }> {
    const result = await this.getPerformance({
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: limit,
    });

    return {
      success: result.success,
      data: result.data?.rows,
      error: result.error,
    };
  }

  async getPerformanceByDevice(
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; data?: PerformanceRow[]; error?: string }> {
    const result = await this.getPerformance({
      startDate,
      endDate,
      dimensions: ['device'],
    });

    return {
      success: result.success,
      data: result.data?.rows,
      error: result.error,
    };
  }

  async getPerformanceByCountry(
    startDate: string,
    endDate: string,
    limit: number = 50
  ): Promise<{ success: boolean; data?: PerformanceRow[]; error?: string }> {
    const result = await this.getPerformance({
      startDate,
      endDate,
      dimensions: ['country'],
      rowLimit: limit,
    });

    return {
      success: result.success,
      data: result.data?.rows,
      error: result.error,
    };
  }

  async getDailyPerformance(
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; data?: PerformanceRow[]; error?: string }> {
    const result = await this.getPerformance({
      startDate,
      endDate,
      dimensions: ['date'],
    });

    return {
      success: result.success,
      data: result.data?.rows,
      error: result.error,
    };
  }

  // ============================================
  // URL Inspection
  // ============================================

  async inspectUrl(pageUrl: string): Promise<{
    success: boolean;
    data?: InspectionResult;
    error?: string;
  }> {
    return this.request<InspectionResult>('/urlInspection/index:inspect', {
      method: 'POST',
      body: JSON.stringify({
        inspectionUrl: pageUrl,
        siteUrl: this.config.siteUrl,
      }),
    });
  }

  async batchInspectUrls(pageUrls: string[]): Promise<{
    success: boolean;
    results: Array<{ url: string; result?: InspectionResult; error?: string }>;
  }> {
    const results = await Promise.all(
      pageUrls.map(async (url) => {
        const result = await this.inspectUrl(url);
        return {
          url,
          result: result.data,
          error: result.error,
        };
      })
    );

    return {
      success: results.every((r) => !r.error),
      results,
    };
  }

  // ============================================
  // Sitemaps
  // ============================================

  async listSitemaps(): Promise<{
    success: boolean;
    data?: SitemapInfo[];
    error?: string;
  }> {
    const encodedSiteUrl = encodeURIComponent(this.config.siteUrl);
    const result = await this.request<{ sitemap?: SitemapInfo[] }>(
      `/sites/${encodedSiteUrl}/sitemaps`
    );

    return {
      success: result.success,
      data: result.data?.sitemap,
      error: result.error,
    };
  }

  async getSitemap(sitemapUrl: string): Promise<{
    success: boolean;
    data?: SitemapInfo;
    error?: string;
  }> {
    const encodedSiteUrl = encodeURIComponent(this.config.siteUrl);
    const encodedSitemapUrl = encodeURIComponent(sitemapUrl);
    return this.request<SitemapInfo>(
      `/sites/${encodedSiteUrl}/sitemaps/${encodedSitemapUrl}`
    );
  }

  async submitSitemap(sitemapUrl: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const encodedSiteUrl = encodeURIComponent(this.config.siteUrl);
    const encodedSitemapUrl = encodeURIComponent(sitemapUrl);
    const result = await this.request(
      `/sites/${encodedSiteUrl}/sitemaps/${encodedSitemapUrl}`,
      { method: 'PUT' }
    );

    return { success: result.success, error: result.error };
  }

  async deleteSitemap(sitemapUrl: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const encodedSiteUrl = encodeURIComponent(this.config.siteUrl);
    const encodedSitemapUrl = encodeURIComponent(sitemapUrl);
    const result = await this.request(
      `/sites/${encodedSiteUrl}/sitemaps/${encodedSitemapUrl}`,
      { method: 'DELETE' }
    );

    return { success: result.success, error: result.error };
  }

  // ============================================
  // Sites
  // ============================================

  async listSites(): Promise<{
    success: boolean;
    data?: Array<{ siteUrl: string; permissionLevel: string }>;
    error?: string;
  }> {
    const result = await this.request<{
      siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
    }>('/sites');

    return {
      success: result.success,
      data: result.data?.siteEntry,
      error: result.error,
    };
  }

  async getSite(): Promise<{
    success: boolean;
    data?: { siteUrl: string; permissionLevel: string };
    error?: string;
  }> {
    const encodedSiteUrl = encodeURIComponent(this.config.siteUrl);
    return this.request(`/sites/${encodedSiteUrl}`);
  }
}

// ============================================
// Factory Function
// ============================================

export function createSearchConsoleClient(
  config: SearchConsoleConfig
): SearchConsoleClient {
  return new SearchConsoleClient(config);
}

// ============================================
// Helper Functions
// ============================================

export function formatDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
}

export function formatPosition(position: number): string {
  return position.toFixed(1);
}

// ============================================
// OAuth Helper (for getting access token)
// ============================================

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json() as OAuthTokenResponse;

    if (!response.ok) {
      return { success: false, error: (data as any).error_description || 'Token refresh failed' };
    }

    return { success: true, accessToken: data.access_token };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function getOAuthUrl(
  clientId: string,
  redirectUri: string,
  state?: string
): string {
  const scopes = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/webmasters',
  ];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    ...(state && { state }),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json() as OAuthTokenResponse;

    if (!response.ok) {
      return { success: false, error: (data as any).error_description || 'Token exchange failed' };
    }

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
