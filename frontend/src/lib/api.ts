// API Client for Cloudflare Worker Backend

const API_BASE_URL = import.meta.env.PUBLIC_API_URL || '';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP error ${response.status}`,
        };
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Products
  async getProducts(params?: {
    category?: string;
    page?: number;
    limit?: number;
    sort?: 'price_asc' | 'price_desc' | 'newest' | 'featured' | 'best_selling';
    search?: string;
    featured?: boolean;
    price_min?: number;
    price_max?: number;
  }) {
    return this.request<{
      success: boolean;
      products: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/api/products/list', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }

  async getProduct(slug: string) {
    return this.request<any>(`/api/products/${slug}`);
  }

  // Categories
  async getCategories() {
    return this.request<any[]>('/api/categories');
  }

  // Cart
  async validateCart(items: any[]) {
    return this.request<{ valid: boolean; items: any[] }>('/api/cart/validate', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // Orders
  async createOrder(orderData: any) {
    return this.request<{ orderId: string; clientSecret: string }>('/api/orders/create', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getOrder(orderId: string, email: string) {
    return this.request<any>(`/api/orders/${orderId}?email=${encodeURIComponent(email)}`);
  }

  // Chat
  async sendMessage(message: string, sessionId: string) {
    return this.request<{ reply: string }>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message, sessionId }),
    });
  }

  // Streaming chat response
  async streamMessage(
    message: string,
    sessionId: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              onChunk(parsed.content);
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  }

  // Knowledge Base Management
  async listKnowledge(params?: { page?: number; limit?: number; source_type?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.source_type) query.set('source_type', params.source_type);
    const qs = query.toString();
    return this.request<{
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/knowledge${qs ? `?${qs}` : ''}`);
  }

  async addKnowledge(entry: { title?: string; content: string; source_type?: string }) {
    return this.request<{ data: any; hasEmbedding: boolean }>('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateKnowledge(id: string, entry: { title?: string; content: string }) {
    return this.request<{ data: any; hasEmbedding: boolean }>(`/api/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
  }

  async deleteKnowledge(id: string) {
    return this.request<{ success: boolean }>(`/api/knowledge/${id}`, {
      method: 'DELETE',
    });
  }

  async syncKnowledge(sources?: string[]) {
    return this.request<{ message: string; results: any }>('/api/knowledge/sync', {
      method: 'POST',
      body: JSON.stringify({ sources }),
    });
  }

  // Content Generation
  async listContent(params?: {
    page?: number;
    limit?: number;
    type?: 'script' | 'caption' | 'description';
    platform?: string;
    product_id?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.type) query.set('type', params.type);
    if (params?.platform) query.set('platform', params.platform);
    if (params?.product_id) query.set('product_id', params.product_id);
    const qs = query.toString();
    return this.request<{
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/content${qs ? `?${qs}` : ''}`);
  }

  async generateScript(params: {
    productId: string;
    videoType: 'unboxing' | 'review' | 'tutorial' | 'promo';
    platform?: string;
    tone?: string;
    duration?: number;
    language?: string;
  }) {
    return this.request<{ script: string; metadata: any }>('/api/content/generate/script', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async generateCopy(params: {
    productId: string;
    copyType: 'long_description' | 'short_description' | 'social_post' | 'email';
    platform?: string;
    tone?: string;
    language?: string;
  }) {
    return this.request<{ copy: string; metadata: any }>('/api/content/generate/copy', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async saveContent(entry: {
    type: 'script' | 'caption' | 'description';
    content: string;
    product_id?: string;
    platform?: string;
    status?: 'draft' | 'approved' | 'published';
  }) {
    return this.request<{ data: any }>('/api/content', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  async updateContent(id: string, entry: { content?: string; status?: string; platform?: string }) {
    return this.request<{ data: any }>(`/api/content/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    });
  }

  async deleteContent(id: string) {
    return this.request<{ success: boolean }>(`/api/content/${id}`, {
      method: 'DELETE',
    });
  }

  // Newsletter
  async subscribeNewsletter(email: string) {
    return this.request<{ success: boolean }>('/api/newsletter/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // Contact form
  async submitContact(data: { name: string; email: string; message: string }) {
    return this.request<{ success: boolean }>('/api/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Analytics
  async getAnalyticsOverview(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{
      period: { days: number; start: string; end: string };
      today: { revenue: number; orders: number };
      summary: {
        revenue: { value: number; change: number; previous: number };
        orders: { value: number; change: number; previous: number };
        avgOrderValue: { value: number; change: number; previous: number };
        customers: number;
        products: number;
      };
    }>(`/api/analytics/overview${query}`);
  }

  async getSalesTrend(params?: { days?: number; granularity?: 'day' | 'week' | 'month' }) {
    const query = new URLSearchParams();
    if (params?.days) query.set('days', String(params.days));
    if (params?.granularity) query.set('granularity', params.granularity);
    const qs = query.toString();
    return this.request<{
      granularity: string;
      days: number;
      trend: Array<{ date: string; revenue: number; orders: number }>;
    }>(`/api/analytics/sales${qs ? `?${qs}` : ''}`);
  }

  async getProductRankings(params?: { days?: number; limit?: number; sort?: 'revenue' | 'quantity' }) {
    const query = new URLSearchParams();
    if (params?.days) query.set('days', String(params.days));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return this.request<{
      days: number;
      sortBy: string;
      rankings: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
    }>(`/api/analytics/products${qs ? `?${qs}` : ''}`);
  }

  async getCustomerAnalytics(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{
      days: number;
      summary: {
        total: number;
        new: number;
        repeatCustomers: number;
        repeatRate: number;
        avgLifetimeValue: number;
      };
      tiers: {
        high: { count: number; threshold: string };
        medium: { count: number; threshold: string };
        low: { count: number; threshold: string };
      };
    }>(`/api/analytics/customers${query}`);
  }

  async getConversionFunnel(days?: number) {
    const query = days ? `?days=${days}` : '';
    return this.request<{
      days: number;
      funnel: Array<{ stage: string; count: number; rate: number }>;
      conversionRate: number;
      note: string;
    }>(`/api/analytics/funnel${query}`);
  }

  // Authors
  async listAuthors(params?: { page?: number; limit?: number; active?: boolean }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.active !== undefined) query.set('active', String(params.active));
    const qs = query.toString();
    return this.request<{
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/authors${qs ? `?${qs}` : ''}`);
  }

  async getAuthor(id: string) {
    return this.request<{ data: any }>(`/api/authors/${id}`);
  }

  async createAuthor(data: {
    name: string;
    slug?: string;
    avatar_url?: string;
    bio?: string;
    credentials?: string[];
    social_links?: Record<string, string>;
  }) {
    return this.request<{ data: any }>('/api/authors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAuthor(id: string, data: Partial<{
    name: string;
    slug: string;
    avatar_url: string;
    bio: string;
    credentials: string[];
    social_links: Record<string, string>;
    is_active: boolean;
  }>) {
    return this.request<{ data: any }>(`/api/authors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAuthor(id: string) {
    return this.request<{ success: boolean }>(`/api/authors/${id}`, {
      method: 'DELETE',
    });
  }

  // Reviews API
  async getReviews(params?: {
    status?: string;
    product_id?: string;
    page?: number;
    limit?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.product_id) searchParams.set('product_id', params.product_id);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    return this.request<{ data: any[]; pagination: any }>(`/api/reviews${query ? `?${query}` : ''}`);
  }

  async getProductReviews(productId: string, params?: {
    page?: number;
    limit?: number;
    sort?: 'newest' | 'highest' | 'lowest' | 'helpful';
  }) {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.sort) searchParams.set('sort', params.sort);
    const query = searchParams.toString();
    return this.request<{ data: any[]; pagination: any }>(`/api/reviews/product/${productId}${query ? `?${query}` : ''}`);
  }

  async getReviewStats(productId: string) {
    return this.request<{ data: any }>(`/api/reviews/stats/${productId}`);
  }

  async createReview(data: {
    product_id: string;
    rating: number;
    title?: string;
    content?: string;
    reviewer_name?: string;
    reviewer_email?: string;
    images?: string[];
  }) {
    return this.request<{ data: any }>('/api/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReview(id: string, data: {
    status?: 'pending' | 'approved' | 'rejected' | 'spam';
    is_featured?: boolean;
  }) {
    return this.request<{ data: any }>(`/api/reviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReview(id: string) {
    return this.request<{ success: boolean }>(`/api/reviews/${id}`, {
      method: 'DELETE',
    });
  }

  async addReviewReply(id: string, reply: string, repliedBy?: string) {
    return this.request<{ data: any }>(`/api/reviews/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply, replied_by: repliedBy }),
    });
  }

  async voteReview(id: string, isHelpful: boolean) {
    return this.request<{ success: boolean }>(`/api/reviews/${id}/vote`, {
      method: 'POST',
      body: JSON.stringify({ is_helpful: isHelpful }),
    });
  }

  // Blog Posts (from content_library)
  async getBlogPosts(params?: {
    page?: number;
    limit?: number;
    status?: 'draft' | 'approved' | 'published';
    author_id?: string;
  }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.author_id) query.set('author_id', params.author_id);
    query.set('type', 'blog');
    const qs = query.toString();
    return this.request<{
      data: any[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/content${qs ? `?${qs}` : ''}`);
  }

  async getBlogPost(id: string) {
    return this.request<{ data: any }>(`/api/content/${id}`);
  }

  async getBlogPostBySlug(slug: string) {
    const query = new URLSearchParams();
    query.set('type', 'blog');
    query.set('slug', slug);
    query.set('status', 'published');
    return this.request<{ data: any }>(`/api/content?${query.toString()}`);
  }

  async getAuthorBySlug(slug: string) {
    const query = new URLSearchParams();
    query.set('slug', slug);
    return this.request<{ data: any }>(`/api/authors?${query.toString()}`);
  }
}

export const api = new ApiClient(API_BASE_URL);
