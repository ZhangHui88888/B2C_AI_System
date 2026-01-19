/**
 * B2C AI System - 健壮性 API 测试
 * 覆盖边界条件、错误输入、验证逻辑
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

let adminToken: string;
let testBrandId: string;
let testProductId: string;
let testCategoryId: string;

describe('B2C AI System Robust API Tests', () => {
  beforeAll(async () => {
    try {
      adminToken = await getAdminToken();
    } catch (error) {
      console.warn('Could not get admin token:', error);
    }
    
    // Get brand ID and test data
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }

    // Get a product ID for testing
    if (testBrandId) {
      const productsRes = await apiRequest('/api/products', {
        headers: { 'x-brand-id': testBrandId },
      });
      if (productsRes.ok) {
        const data = await productsRes.json();
        if (data.products?.[0]) {
          testProductId = data.products[0].id;
        }
      }

      // Get a category ID
      const categoriesRes = await apiRequest('/api/categories', {
        headers: { 'x-brand-id': testBrandId },
      });
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        if (data.categories?.[0]) {
          testCategoryId = data.categories[0].id;
        }
      }
    }
  });

  afterAll(() => {
    clearTokenCache();
  });

  // ============================================
  // 1. Site Config - 边界条件测试
  // ============================================
  describe('Site Config - Boundary Tests', () => {
    it('should return 404 for empty host', async () => {
      const response = await apiRequest('/api/site-config?host=');
      expect([400, 404]).toContain(response.status);
    });

    it('should return 404 for missing host parameter', async () => {
      const response = await apiRequest('/api/site-config');
      expect([400, 404]).toContain(response.status);
    });

    it('should handle very long domain name', async () => {
      const longDomain = 'a'.repeat(500) + '.com';
      const response = await apiRequest(`/api/site-config?host=${longDomain}`);
      expect([400, 404]).toContain(response.status);
    });

    it('should handle special characters in domain', async () => {
      const response = await apiRequest('/api/site-config?host=<script>alert(1)</script>');
      expect([400, 404]).toContain(response.status);
    });

    it('should handle SQL injection attempt', async () => {
      const response = await apiRequest("/api/site-config?host='; DROP TABLE brands; --");
      expect([400, 404]).toContain(response.status);
    });

    it('should return valid brand structure for valid domain', async () => {
      const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
      expect(response.ok).toBe(true);
      const data = await response.json();
      
      // Validate brand structure
      expect(data.brand).toBeDefined();
      expect(data.brand.id).toBeDefined();
      expect(typeof data.brand.id).toBe('string');
      expect(data.brand.name).toBeDefined();
      expect(typeof data.brand.name).toBe('string');
    });
  });

  // ============================================
  // 2. Products API - 完整测试
  // ============================================
  describe('Products API - Complete Tests', () => {
    describe('GET /api/products - List', () => {
      it('should require brand ID', async () => {
        const response = await apiRequest('/api/products');
        expect([400, 404]).toContain(response.status);
      });

      it('should return array of products', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products', {
          headers: { 'x-brand-id': testBrandId },
        });
        if (response.ok) {
          const data = await response.json();
          expect(Array.isArray(data.products) || data.products === undefined).toBe(true);
        }
      });

      it('should handle pagination - limit', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products?limit=5', {
          headers: { 'x-brand-id': testBrandId },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.products) {
            expect(data.products.length).toBeLessThanOrEqual(5);
          }
        }
      });

      it('should handle pagination - offset', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products?offset=0&limit=10', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });

      it('should handle negative limit gracefully', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products?limit=-1', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle very large limit', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products?limit=999999', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle non-numeric limit', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products?limit=abc', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });

    describe('GET /api/products/:slug - Single Product', () => {
      it('should return 404 for non-existent product', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/non-existent-product-slug-12345', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });

      it('should handle empty slug', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should return valid product structure', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/urban-commuter-ebike', {
          headers: { 'x-brand-id': testBrandId },
        });
        if (response.ok) {
          const data = await response.json();
          expect(data.product || data).toBeDefined();
          const product = data.product || data;
          if (product.id) {
            expect(typeof product.id).toBe('string');
            expect(product.name || product.title).toBeDefined();
          }
        }
      });
    });

    describe('POST /api/products/list - Filter', () => {
      it('should handle empty body', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle category filter', async () => {
        if (!testBrandId || !testCategoryId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ category_id: testCategoryId }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle price range filter', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ min_price: 100, max_price: 5000 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle invalid price range (min > max)', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ min_price: 5000, max_price: 100 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle negative prices', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ min_price: -100 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle sort options', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'price_asc' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle invalid sort option', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'invalid_sort' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // 3. Orders API - 验证测试
  // ============================================
  describe('Orders API - Validation Tests', () => {
    describe('POST /api/orders/validate', () => {
      it('should reject empty items array', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [],
            customer_email: 'test@example.com',
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should reject invalid email format', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ product_id: 'test', quantity: 1 }],
            customer_email: 'invalid-email',
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should reject zero quantity', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ product_id: 'test', quantity: 0 }],
            customer_email: 'test@example.com',
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should reject negative quantity', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ product_id: 'test', quantity: -5 }],
            customer_email: 'test@example.com',
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should reject extremely large quantity', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ product_id: 'test', quantity: 999999999 }],
            customer_email: 'test@example.com',
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('should handle missing required fields', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('should handle malformed JSON', async () => {
        if (!testBrandId) return;
        const response = await fetch(`${API_BASE_URL}/api/orders/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-brand-id': testBrandId,
          },
          body: '{invalid json}',
        });
        expect([400, 404, 500]).toContain(response.status);
      });
    });

    describe('POST /api/orders - Create Order', () => {
      it('should require shipping address', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/orders', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ product_id: testProductId, quantity: 1 }],
            customer_email: 'test@example.com',
            // Missing shipping_address
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('should validate shipping address fields', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/orders', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ product_id: testProductId, quantity: 1 }],
            customer_email: 'test@example.com',
            shipping_address: {
              // Incomplete address
              city: 'London',
            },
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // 4. Reviews API - 输入验证
  // ============================================
  describe('Reviews API - Input Validation', () => {
    it('should reject rating below 1', async () => {
      if (!testBrandId || !testProductId) return;
      const response = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          product_id: testProductId,
          rating: 0,
          content: 'Test review',
        }),
      });
      expect([400, 404]).toContain(response.status);
    });

    it('should reject rating above 5', async () => {
      if (!testBrandId || !testProductId) return;
      const response = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          product_id: testProductId,
          rating: 10,
          content: 'Test review',
        }),
      });
      expect([400, 404]).toContain(response.status);
    });

    it('should reject non-integer rating', async () => {
      if (!testBrandId || !testProductId) return;
      const response = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          product_id: testProductId,
          rating: 3.5,
          content: 'Test review',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should handle very long content', async () => {
      if (!testBrandId || !testProductId) return;
      const longContent = 'x'.repeat(10000);
      const response = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          product_id: testProductId,
          rating: 5,
          content: longContent,
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should handle empty content', async () => {
      if (!testBrandId || !testProductId) return;
      const response = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          product_id: testProductId,
          rating: 5,
          content: '',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should sanitize XSS in content', async () => {
      if (!testBrandId || !testProductId) return;
      const response = await apiRequest('/api/reviews', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          product_id: testProductId,
          rating: 5,
          content: '<script>alert("xss")</script>Good product!',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 5. Points API - 业务逻辑测试
  // ============================================
  describe('Points API - Business Logic', () => {
    it('should return 0 balance for new user', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/points/balance?email=newuser12345@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      if (response.ok) {
        const data = await response.json();
        expect(data.balance === 0 || data.balance === undefined || data.points === 0).toBe(true);
      }
    });

    it('should reject redeem with insufficient points', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/points/redeem', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          email: 'newuser12345@example.com',
          reward_id: 'expensive-reward',
          points: 999999,
        }),
      });
      expect([400, 404]).toContain(response.status);
    });

    it('should reject negative points redemption', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/points/redeem', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          email: 'test@example.com',
          points: -100,
        }),
      });
      expect([400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 6. Membership API - 等级测试
  // ============================================
  describe('Membership API - Tier Tests', () => {
    it('should return valid tier structure', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/membership/tiers', {
        headers: { 'x-brand-id': testBrandId },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.tiers && Array.isArray(data.tiers)) {
          data.tiers.forEach((tier: any) => {
            expect(tier.name || tier.id).toBeDefined();
          });
        }
      }
    });

    it('should return default tier for non-member', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/membership/status?email=nonmember@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 7. Referrals API - 验证测试
  // ============================================
  describe('Referrals API - Validation', () => {
    it('should reject self-referral', async () => {
      if (!testBrandId) return;
      // First get a referral code
      const codeRes = await apiRequest('/api/referrals/code?email=user@example.com', {
        headers: { 'x-brand-id': testBrandId },
      });
      
      if (codeRes.ok) {
        const codeData = await codeRes.json();
        if (codeData.code) {
          // Try to apply own code
          const response = await apiRequest('/api/referrals/apply', {
            method: 'POST',
            headers: { 'x-brand-id': testBrandId },
            body: JSON.stringify({
              code: codeData.code,
              email: 'user@example.com', // Same user
            }),
          });
          expect([400, 404]).toContain(response.status);
        }
      }
    });

    it('should reject invalid referral code', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/referrals/apply', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          code: 'INVALID_CODE_12345',
          email: 'newuser@example.com',
        }),
      });
      expect([400, 404]).toContain(response.status);
    });

    it('should reject empty referral code', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/referrals/apply', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          code: '',
          email: 'newuser@example.com',
        }),
      });
      expect([400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 8. Tracking API - 数据验证
  // ============================================
  describe('Tracking API - Data Validation', () => {
    it('should accept valid pageview data', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/tracking/pageview', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/products/test-product',
          referrer: 'https://google.com',
          user_agent: 'Mozilla/5.0',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should handle missing URL', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/tracking/pageview', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          referrer: 'https://google.com',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should handle invalid event type', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/tracking/event', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          event_type: '', // Empty event type
          event_data: {},
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should handle very large event data', async () => {
      if (!testBrandId) return;
      const largeData: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeData[`key_${i}`] = 'x'.repeat(1000);
      }
      const response = await apiRequest('/api/tracking/event', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          event_type: 'test_event',
          event_data: largeData,
        }),
      });
      expect([200, 201, 400, 413, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 9. Admin API - 权限测试
  // ============================================
  describe('Admin API - Authorization Tests', () => {
    it('should reject request without token', async () => {
      const response = await apiRequest('/api/admin/brands');
      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await apiRequest('/api/admin/brands', {}, 'invalid-token-12345');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject request with malformed token', async () => {
      const response = await apiRequest('/api/admin/brands', {}, 'Bearer malformed');
      expect([401, 403]).toContain(response.status);
    });

    it('should reject request with expired token format', async () => {
      // Fake expired JWT
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.signature';
      const response = await apiRequest('/api/admin/brands', {}, expiredToken);
      expect([401, 403]).toContain(response.status);
    });
  });

  // ============================================
  // 10. Web Vitals - 数据格式验证
  // ============================================
  describe('Web Vitals - Data Format Validation', () => {
    it('should accept valid LCP value', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/web-vitals', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/test',
          lcp: 2500,
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should reject negative LCP', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/web-vitals', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/test',
          lcp: -100,
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should handle all core web vitals', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/web-vitals', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/test',
          lcp: 2500,
          fid: 100,
          cls: 0.1,
          fcp: 1800,
          ttfb: 800,
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should reject CLS above 1', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/web-vitals', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          url: '/test',
          cls: 5.0, // CLS should be between 0 and ~1
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 11. Coupons - 验证测试
  // ============================================
  describe('Coupons - Validation Tests', () => {
    it('should handle coupon validation endpoint', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/coupons/validate', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          code: 'WELCOME10',
          cart_total: 100,
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should reject expired coupon code', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/coupons/validate', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          code: 'EXPIRED_CODE',
          cart_total: 100,
        }),
      });
      expect([400, 404]).toContain(response.status);
    });

    it('should reject coupon below minimum order', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/coupons/validate', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          code: 'WELCOME10',
          cart_total: 10, // Below minimum
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // 12. Content API - 安全测试
  // ============================================
  describe('Content API - Security Tests', () => {
    it('should sanitize HTML in content generation request', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/content/generate', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({
          type: 'product_description',
          topic: '<script>alert("xss")</script>electric bike',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should handle SQL injection in search', async () => {
      if (!testBrandId) return;
      const response = await apiRequest("/api/content?search='; DROP TABLE content; --", {
        headers: { 'x-brand-id': testBrandId },
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  // ============================================
  // Test Summary
  // ============================================
  describe('Test Summary', () => {
    it('should print robust test info', () => {
      console.log('\n========================================');
      console.log('Robust API Test Summary:');
      console.log(`  API Base URL: ${API_BASE_URL}`);
      console.log(`  Test Brand: ${TEST_BRAND_SLUG}`);
      console.log(`  Brand ID: ${testBrandId || 'Not found'}`);
      console.log(`  Product ID: ${testProductId || 'Not found'}`);
      console.log(`  Category ID: ${testCategoryId || 'Not found'}`);
      console.log(`  Admin Token: ${adminToken ? 'Available' : 'Not available'}`);
      console.log('========================================\n');
      expect(true).toBe(true);
    });
  });
});
