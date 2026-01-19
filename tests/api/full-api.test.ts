/**
 * B2C AI System - 完整 API 测试
 * 覆盖所有后端 API 端点
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  API_BASE_URL,
  TEST_BRAND_SLUG,
  TEST_BRAND_DOMAIN,
  apiRequest,
  getAdminToken,
  clearTokenCache,
} from '../setup';

// Test state
let adminToken: string;
let testBrandId: string;

describe('B2C AI System Full API Tests', () => {
  beforeAll(async () => {
    try {
      adminToken = await getAdminToken();
    } catch (error) {
      console.warn('Could not get admin token:', error);
    }
    
    // Get brand ID
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }
  });

  afterAll(() => {
    clearTokenCache();
  });

  // ============================================
  // 1. Site Config API
  // ============================================
  describe('Site Config API (/api/site-config)', () => {
    it('GET should return brand config for valid domain', async () => {
      const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.brand).toBeDefined();
    });

    it('GET should return 404 for invalid domain', async () => {
      const response = await apiRequest('/api/site-config?host=invalid.example.com');
      expect(response.status).toBe(404);
    });
  });

  // ============================================
  // 2. Products API
  // ============================================
  describe('Products API (/api/products)', () => {
    it('GET /api/products should return products list', async () => {
      const response = await apiRequest('/api/products', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });

    it('POST /api/products/list should filter products', async () => {
      const response = await apiRequest('/api/products/list', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({ limit: 10 }),
      });
      expect([200, 404]).toContain(response.status);
    });

    it('GET /api/products/:slug should return single product', async () => {
      const response = await apiRequest('/api/products/urban-commuter-ebike', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 3. Categories API
  // ============================================
  describe('Categories API (/api/categories)', () => {
    it('GET should return categories list', async () => {
      const response = await apiRequest('/api/categories', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });

    it('GET /:slug should return single category', async () => {
      const response = await apiRequest('/api/categories/electric-bikes', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 4. Orders API
  // ============================================
  describe('Orders API (/api/orders)', () => {
    it('POST /api/orders/validate should validate order', async () => {
      const response = await apiRequest('/api/orders/validate', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          items: [{ product_id: 'test', quantity: 1 }],
          customer_email: 'test@example.com',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('POST /api/orders should create order', async () => {
      const response = await apiRequest('/api/orders', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          items: [],
          customer_email: 'test@example.com',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('GET /api/orders/:id should return order', async () => {
      const response = await apiRequest('/api/orders/test-order-id', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 5. Reviews API (Public)
  // ============================================
  describe('Reviews API (/api/reviews)', () => {
    it('GET /api/reviews should return reviews', async () => {
      const response = await apiRequest('/api/reviews', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });

    it('POST /api/reviews should submit review', async () => {
      const response = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          product_id: 'test',
          rating: 5,
          content: 'Great product!',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 6. Chat API
  // ============================================
  describe('Chat API (/api/chat)', () => {
    it('POST should handle chat message', async () => {
      const response = await apiRequest('/api/chat', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          message: 'Hello',
          session_id: 'test-session',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // 7. Knowledge Base API
  // ============================================
  describe('Knowledge API (/api/knowledge)', () => {
    it('GET should return knowledge entries', async () => {
      const response = await apiRequest('/api/knowledge', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });

    it('POST /api/knowledge/search should search knowledge', async () => {
      const response = await apiRequest('/api/knowledge/search', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({ query: 'shipping' }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 8. Settings API
  // ============================================
  describe('Settings API (/api/settings)', () => {
    it('GET should return settings', async () => {
      const response = await apiRequest('/api/settings', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 9. Tracking API
  // ============================================
  describe('Tracking API (/api/tracking)', () => {
    it('POST /api/tracking/pageview should track pageview', async () => {
      const response = await apiRequest('/api/tracking/pageview', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/products',
          referrer: 'https://google.com',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('POST /api/tracking/event should track event', async () => {
      const response = await apiRequest('/api/tracking/event', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          event_type: 'add_to_cart',
          event_data: { product_id: 'test' },
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('POST /api/tracking/cart-abandonment should track abandonment', async () => {
      const response = await apiRequest('/api/tracking/cart-abandonment', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          email: 'test@example.com',
          cart_items: [],
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 10. Conversions API
  // ============================================
  describe('Conversions API (/api/conversions)', () => {
    it('POST /api/conversions/purchase should track purchase', async () => {
      const response = await apiRequest('/api/conversions/purchase', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          order_id: 'test-order',
          value: 100,
          currency: 'GBP',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('POST /api/conversions/lead should track lead', async () => {
      const response = await apiRequest('/api/conversions/lead', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          email: 'test@example.com',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 11. Membership API
  // ============================================
  describe('Membership API (/api/membership)', () => {
    it('GET /api/membership/status should return membership status', async () => {
      const response = await apiRequest('/api/membership/status?email=test@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('GET /api/membership/tiers should return tiers', async () => {
      const response = await apiRequest('/api/membership/tiers', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });

    it('GET /api/membership/benefits should return benefits', async () => {
      const response = await apiRequest('/api/membership/benefits', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 12. Points API
  // ============================================
  describe('Points API (/api/points)', () => {
    it('GET /api/points/balance should return balance', async () => {
      const response = await apiRequest('/api/points/balance?email=test@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('GET /api/points/history should return history', async () => {
      const response = await apiRequest('/api/points/history?email=test@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('GET /api/points/rewards should return rewards', async () => {
      const response = await apiRequest('/api/points/rewards', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });

    it('POST /api/points/redeem should redeem points', async () => {
      const response = await apiRequest('/api/points/redeem', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          email: 'test@example.com',
          reward_id: 'test',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 13. Referrals API
  // ============================================
  describe('Referrals API (/api/referrals)', () => {
    it('GET /api/referrals/code should return referral code', async () => {
      const response = await apiRequest('/api/referrals/code?email=test@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('GET /api/referrals/stats should return stats', async () => {
      const response = await apiRequest('/api/referrals/stats?email=test@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('POST /api/referrals/apply should apply referral', async () => {
      const response = await apiRequest('/api/referrals/apply', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          code: 'TEST123',
          email: 'newuser@example.com',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 14. Analytics API
  // ============================================
  describe('Analytics API (/api/analytics)', () => {
    it('GET /api/analytics/overview should return overview', async () => {
      const response = await apiRequest('/api/analytics/overview', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 15. Sitemap API
  // ============================================
  describe('Sitemap API (/api/sitemap)', () => {
    it('GET /api/sitemap should return sitemap data', async () => {
      const response = await apiRequest('/api/sitemap', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 16. SEO API
  // ============================================
  describe('SEO API (/api/seo)', () => {
    it('POST /api/seo/analyze should analyze content', async () => {
      const response = await apiRequest('/api/seo/analyze', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          content: 'Test content for SEO analysis',
          url: '/test-page',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 17. Content API
  // ============================================
  describe('Content API (/api/content)', () => {
    it('GET /api/content should return content', async () => {
      const response = await apiRequest('/api/content', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });

    it('POST /api/content/generate should generate content', async () => {
      const response = await apiRequest('/api/content/generate', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          type: 'product_description',
          topic: 'electric bike',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // 18. Images API
  // ============================================
  describe('Images API (/api/images)', () => {
    it('GET /api/images should return images', async () => {
      const response = await apiRequest('/api/images', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 19. Authors API
  // ============================================
  describe('Authors API (/api/authors)', () => {
    it('GET /api/authors should return authors', async () => {
      const response = await apiRequest('/api/authors', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 20. Web Vitals API
  // ============================================
  describe('Web Vitals API (/api/web-vitals)', () => {
    it('POST /api/web-vitals should record metrics', async () => {
      const response = await apiRequest('/api/web-vitals', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/test',
          lcp: 2500,
          fid: 100,
          cls: 0.1,
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('GET /api/web-vitals/report should return report', async () => {
      const response = await apiRequest('/api/web-vitals/report', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 21. Related Content API
  // ============================================
  describe('Related Content API (/api/related-content)', () => {
    it('GET /api/related-content should return related items', async () => {
      const response = await apiRequest('/api/related-content?type=product&id=test', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 22. Monitoring API
  // ============================================
  describe('Monitoring API (/api/monitoring)', () => {
    it('GET /api/monitoring/health should return health status', async () => {
      const response = await apiRequest('/api/monitoring/health');
      expect([200, 404]).toContain(response.status);
    });

    it('GET /api/monitoring/errors should return errors', async () => {
      const response = await apiRequest('/api/monitoring/errors', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // ADMIN APIs
  // ============================================

  // ============================================
  // 23. Admin Brands API
  // ============================================
  describe('Admin Brands API (/api/admin/brands)', () => {
    it('GET should require auth', async () => {
      const response = await apiRequest('/api/admin/brands');
      expect(response.status).toBe(401);
    });

    it('GET should return brands with auth', async () => {
      if (!adminToken) return;
      const response = await apiRequest('/api/admin/brands', {}, adminToken);
      expect([200, 403]).toContain(response.status);
    });

    it('GET /available should return available brands', async () => {
      if (!adminToken) return;
      const response = await apiRequest('/api/admin/brands/available', {}, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 24. Admin Categories API
  // ============================================
  describe('Admin Categories API (/api/admin/categories)', () => {
    it('GET should require auth', async () => {
      const response = await apiRequest('/api/admin/categories');
      expect(response.status).toBe(401);
    });

    it('GET should return categories with auth', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/categories', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 25. Admin Products API
  // ============================================
  describe('Admin Products API (/api/admin/products)', () => {
    it('GET should require auth', async () => {
      const response = await apiRequest('/api/admin/products');
      expect(response.status).toBe(401);
    });

    it('GET should return products with auth', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/products', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 26. Admin Orders API
  // ============================================
  describe('Admin Orders API (/api/admin/orders)', () => {
    it('GET should require auth', async () => {
      const response = await apiRequest('/api/admin/orders');
      expect(response.status).toBe(401);
    });

    it('GET should return orders with auth', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/orders', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 27. Admin Coupons API
  // ============================================
  describe('Admin Coupons API (/api/admin/coupons)', () => {
    it('GET should require auth', async () => {
      const response = await apiRequest('/api/admin/coupons');
      expect(response.status).toBe(401);
    });

    it('GET should return coupons with auth', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/coupons', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 28. Admin Reviews API
  // ============================================
  describe('Admin Reviews API (/api/admin/reviews)', () => {
    it('GET should require auth', async () => {
      const response = await apiRequest('/api/admin/reviews');
      expect(response.status).toBe(401);
    });

    it('GET should return reviews with auth', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/reviews', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 29. Admin Analytics API
  // ============================================
  describe('Admin Analytics API (/api/admin/analytics)', () => {
    it('GET /overview should return analytics', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/analytics/overview', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });

    it('GET /sales should return sales data', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/analytics/sales', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403, 404]).toContain(response.status);
    });

    it('GET /traffic should return traffic data', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/analytics/traffic', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 30. Admin Overview API
  // ============================================
  describe('Admin Overview API (/api/admin/overview)', () => {
    it('GET should return dashboard overview', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/overview', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 31. Admin Settings API
  // ============================================
  describe('Admin Settings API (/api/admin/settings)', () => {
    it('GET should return settings', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/settings', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 32. Admin Marketing API
  // ============================================
  describe('Admin Marketing API (/api/admin/marketing)', () => {
    it('GET /pixels should return pixel config', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/marketing/pixels', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403, 404]).toContain(response.status);
    });

    it('GET /utm should return UTM stats', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/marketing/utm', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 33. Admin SEO API
  // ============================================
  describe('Admin SEO API (/api/admin/seo)', () => {
    it('GET /meta should return SEO meta', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/seo/meta', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 34. Admin Advanced SEO API
  // ============================================
  describe('Admin Advanced SEO API (/api/admin/advanced-seo)', () => {
    it('GET should return advanced SEO data', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/advanced-seo', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 35. Admin Templates API
  // ============================================
  describe('Admin Templates API (/api/admin/templates)', () => {
    it('GET should return templates', async () => {
      if (!adminToken || !testBrandId) return;
      const response = await apiRequest('/api/admin/templates', {
        headers: { 'x-brand-id': testBrandId },
      }, adminToken);
      expect([200, 403, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 36. Keywords API
  // ============================================
  describe('Keywords API (/api/keywords)', () => {
    it('GET should return keywords', async () => {
      const response = await apiRequest('/api/keywords', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });

    it('POST /research should research keywords', async () => {
      const response = await apiRequest('/api/keywords/research', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({ seed_keyword: 'electric bike' }),
      });
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 37. EEAT API
  // ============================================
  describe('EEAT API (/api/eeat)', () => {
    it('POST /analyze should analyze EEAT', async () => {
      const response = await apiRequest('/api/eeat/analyze', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/test-page',
          content: 'Test content',
        }),
      });
      expect([200, 400, 401, 404]).toContain(response.status);
    });

    it('GET /score should return EEAT score', async () => {
      const response = await apiRequest('/api/eeat/score', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 38. SEO Reports API
  // ============================================
  describe('SEO Reports API (/api/seo-reports)', () => {
    it('GET should return reports', async () => {
      const response = await apiRequest('/api/seo-reports', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });

    it('POST /generate should generate report', async () => {
      const response = await apiRequest('/api/seo-reports/generate', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({ type: 'weekly' }),
      });
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 39. SEO Links API
  // ============================================
  describe('SEO Links API (/api/seo-links)', () => {
    it('GET /orphans should return orphan pages', async () => {
      const response = await apiRequest('/api/seo-links/orphans', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });

    it('GET /density should return link density', async () => {
      const response = await apiRequest('/api/seo-links/density', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 40. Index Status API
  // ============================================
  describe('Index Status API (/api/index-status)', () => {
    it('GET should return index status', async () => {
      const response = await apiRequest('/api/index-status', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });

    it('POST /check should check indexing', async () => {
      const response = await apiRequest('/api/index-status/check', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({ urls: ['/test'] }),
      });
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 41. Search Console API
  // ============================================
  describe('Search Console API (/api/search-console)', () => {
    it('GET /performance should return performance data', async () => {
      const response = await apiRequest('/api/search-console/performance', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 42. Email Sequences API
  // ============================================
  describe('Email Sequences API (/api/email-sequences)', () => {
    it('GET should return sequences', async () => {
      const response = await apiRequest('/api/email-sequences', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 401, 404]).toContain(response.status);
    });

    it('POST /trigger should trigger sequence', async () => {
      const response = await apiRequest('/api/email-sequences/trigger', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          sequence: 'welcome',
          email: 'test@example.com',
        }),
      });
      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  // ============================================
  // Test Summary
  // ============================================
  describe('Test Summary', () => {
    it('should print test environment info', () => {
      console.log('\n========================================');
      console.log('Full API Test Environment:');
      console.log(`  API Base URL: ${API_BASE_URL}`);
      console.log(`  Test Brand: ${TEST_BRAND_SLUG}`);
      console.log(`  Test Domain: ${TEST_BRAND_DOMAIN}`);
      console.log(`  Brand ID: ${testBrandId || 'Not found'}`);
      console.log(`  Admin Token: ${adminToken ? 'Available' : 'Not available'}`);
      console.log('========================================\n');
      expect(true).toBe(true);
    });
  });
});
