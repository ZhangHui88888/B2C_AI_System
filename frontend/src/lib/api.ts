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
}

export const api = new ApiClient(API_BASE_URL);
