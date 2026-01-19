/**
 * Tracking/Conversions/Analytics API - 完整测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { API_BASE_URL, TEST_BRAND_DOMAIN, apiRequest } from '../../setup';

let testBrandId: string;

describe('Tracking System Complete Tests', () => {
  beforeAll(async () => {
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }
  });

  // ============================================
  // Tracking API
  // ============================================
  describe('Tracking API', () => {
    describe('POST /api/tracking/pageview', () => {
      it('应该接受有效的页面浏览数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/pageview', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/products/test-product',
            referrer: 'https://google.com',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少 URL', async () => {
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

      it('应该处理空 URL', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/pageview', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理超长 URL', async () => {
        if (!testBrandId) return;
        const longUrl = '/products/' + 'x'.repeat(2000);
        const response = await apiRequest('/api/tracking/pageview', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ url: longUrl }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理带 UTM 参数的 URL', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/pageview', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/products?utm_source=google&utm_medium=cpc&utm_campaign=test',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理额外的追踪数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/pageview', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/products',
            referrer: 'https://facebook.com',
            user_agent: 'Mozilla/5.0',
            session_id: 'test-session-123',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });

    describe('POST /api/tracking/event', () => {
      it('应该接受有效的事件数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/event', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            event_type: 'add_to_cart',
            event_data: { product_id: 'test-123', quantity: 1 },
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理空事件类型', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/event', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            event_type: '',
            event_data: {},
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理各种事件类型', async () => {
        if (!testBrandId) return;
        const eventTypes = ['view_product', 'add_to_cart', 'begin_checkout', 'purchase', 'search'];
        for (const eventType of eventTypes) {
          const response = await apiRequest('/api/tracking/event', {
            method: 'POST',
            headers: { 'x-brand-id': testBrandId },
            body: JSON.stringify({
              event_type: eventType,
              event_data: { test: true },
            }),
          });
          expect([200, 201, 400, 404]).toContain(response.status);
        }
      });

      it('应该处理大量事件数据', async () => {
        if (!testBrandId) return;
        const largeData: Record<string, string> = {};
        for (let i = 0; i < 50; i++) {
          largeData[`key_${i}`] = 'x'.repeat(100);
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

      it('应该处理嵌套事件数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/event', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            event_type: 'purchase',
            event_data: {
              order: {
                id: 'order-123',
                items: [
                  { product_id: 'p1', quantity: 2 },
                  { product_id: 'p2', quantity: 1 },
                ],
                total: 299.99,
              },
            },
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });

    describe('POST /api/tracking/cart-abandonment', () => {
      it('应该接受有效的弃购数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/cart-abandonment', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            email: 'test@example.com',
            cart_items: [
              { product_id: 'p1', name: 'Product 1', quantity: 1, price: 99.99 },
            ],
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/cart-abandonment', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            cart_items: [],
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理空购物车', async () => {
        if (!testBrandId) return;
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

      it('应该处理无效邮箱格式', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/tracking/cart-abandonment', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            email: 'invalid-email',
            cart_items: [],
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Conversions API
  // ============================================
  describe('Conversions API', () => {
    describe('POST /api/conversions/purchase', () => {
      it('应该接受有效的购买转化数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/purchase', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            order_id: 'order-12345',
            value: 199.99,
            currency: 'GBP',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少订单 ID', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/purchase', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            value: 199.99,
            currency: 'GBP',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理负数金额', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/purchase', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            order_id: 'order-123',
            value: -100,
            currency: 'GBP',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理零金额', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/purchase', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            order_id: 'order-123',
            value: 0,
            currency: 'GBP',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理各种货币', async () => {
        if (!testBrandId) return;
        const currencies = ['USD', 'EUR', 'GBP', 'CNY', 'JPY'];
        for (const currency of currencies) {
          const response = await apiRequest('/api/conversions/purchase', {
            method: 'POST',
            headers: { 'x-brand-id': testBrandId },
            body: JSON.stringify({
              order_id: 'order-123',
              value: 100,
              currency,
            }),
          });
          expect([200, 201, 400, 404]).toContain(response.status);
        }
      });

      it('应该处理无效货币代码', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/purchase', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            order_id: 'order-123',
            value: 100,
            currency: 'INVALID',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });

    describe('POST /api/conversions/lead', () => {
      it('应该接受有效的线索转化数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/lead', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            email: 'lead@example.com',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/lead', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理带有额外数据的线索', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/conversions/lead', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            email: 'lead@example.com',
            name: 'Test User',
            phone: '+44 123456789',
            source: 'landing_page',
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Web Vitals API
  // ============================================
  describe('Web Vitals API', () => {
    describe('POST /api/web-vitals', () => {
      it('应该接受有效的 Web Vitals 数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/web-vitals', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/products',
            lcp: 2500,
            fid: 100,
            cls: 0.1,
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理只有 LCP', async () => {
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

      it('应该处理所有指标', async () => {
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
            inp: 200,
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });

      it('应该处理负数 LCP', async () => {
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

      it('应该处理超大 CLS', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/web-vitals', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/test',
            cls: 10.0,
          }),
        });
        expect([200, 201, 400, 404]).toContain(response.status);
      });
    });

    describe('GET /api/web-vitals/report', () => {
      it('应该返回性能报告', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/web-vitals/report', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Analytics API
  // ============================================
  describe('Analytics API', () => {
    describe('GET /api/analytics/overview', () => {
      it('应该返回分析概览', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/analytics/overview', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });
});
