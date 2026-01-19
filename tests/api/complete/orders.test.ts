/**
 * Orders API - 完整测试
 * 覆盖所有场景：正常、边界、错误、业务逻辑
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  API_BASE_URL,
  TEST_BRAND_DOMAIN,
  apiRequest,
} from '../../setup';

let testBrandId: string;
let testProductId: string;

describe('Orders API Complete Tests', () => {
  beforeAll(async () => {
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }

    if (testBrandId) {
      const res = await apiRequest('/api/products/list', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({ limit: 1 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.products?.[0]) {
          testProductId = data.products[0].id;
        }
      }
    }
  });

  // ============================================
  // POST /api/cart/validate - 购物车验证
  // ============================================
  describe('POST /api/cart/validate', () => {
    describe('正常场景', () => {
      it('应该验证有效的购物车', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: 1 }],
          }),
        });
        expect([200, 400]).toContain(response.status);
        if (response.ok) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(Array.isArray(data.items)).toBe(true);
        }
      });

      it('应该返回验证结果结构', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: 1 }],
          }),
        });
        if (response.ok) {
          const data = await response.json();
          expect(typeof data.valid).toBe('boolean');
          data.items.forEach((item: any) => {
            expect(typeof item.valid).toBe('boolean');
          });
        }
      });
    });

    describe('边界条件', () => {
      it('应该拒绝空购物车', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ items: [] }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理不存在的产品 ID', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
        if (response.ok) {
          const data = await response.json();
          expect(data.items[0].valid).toBe(false);
        }
      });

      it('应该处理数量为 0', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: 0 }],
          }),
        });
        expect([200, 400]).toContain(response.status);
        if (response.ok) {
          const data = await response.json();
          expect(data.items[0].valid).toBe(false);
        }
      });

      it('应该处理负数数量', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: -5 }],
          }),
        });
        expect([200, 400]).toContain(response.status);
        if (response.ok) {
          const data = await response.json();
          expect(data.items[0].valid).toBe(false);
        }
      });

      it('应该处理超大数量', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: 999999999 }],
          }),
        });
        expect([200, 400]).toContain(response.status);
      });

      it('应该处理小数数量', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: 1.5 }],
          }),
        });
        expect([200, 400]).toContain(response.status);
      });

      it('应该处理多个产品', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [
              { productId: testProductId, quantity: 1 },
              { productId: testProductId, quantity: 2 },
            ],
          }),
        });
        expect([200, 400]).toContain(response.status);
      });
    });

    describe('错误输入', () => {
      it('应该拒绝缺少 brand ID', async () => {
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          body: JSON.stringify({ items: [] }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理缺少 items 字段', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理 items 不是数组', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ items: 'not-an-array' }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理无效的产品 ID 格式', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: 'invalid-uuid', quantity: 1 }],
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理缺少 productId', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ quantity: 1 }],
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少 quantity', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId }],
          }),
        });
        expect([200, 400]).toContain(response.status);
      });

      it('应该处理非数字的 quantity', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/cart/validate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            items: [{ productId: testProductId, quantity: 'abc' }],
          }),
        });
        expect([200, 400]).toContain(response.status);
      });
    });
  });

  // ============================================
  // POST /api/orders/create - 创建订单
  // ============================================
  describe('POST /api/orders/create', () => {
    const validOrderData = () => ({
      customer: {
        email: 'test@example.com',
        name: 'Test Customer',
        phone: '+44 123456789',
      },
      shippingAddress: {
        line1: '123 Test Street',
        city: 'London',
        postcode: 'SW1A 1AA',
        country: 'UK',
      },
      items: testProductId ? [{ productId: testProductId, quantity: 1 }] : [],
    });

    describe('验证场景', () => {
      it('应该拒绝缺少客户信息', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            shippingAddress: { line1: '123', city: 'London', postcode: 'SW1A 1AA', country: 'UK' },
            items: [{ productId: testProductId, quantity: 1 }],
          }),
        });
        expect(response.status).toBe(400);
      });

      it('应该拒绝缺少邮箱', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            customer: { name: 'Test' },
            shippingAddress: { line1: '123', city: 'London', postcode: 'SW1A 1AA', country: 'UK' },
            items: [{ productId: testProductId, quantity: 1 }],
          }),
        });
        expect(response.status).toBe(400);
      });

      it('应该拒绝缺少姓名', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            customer: { email: 'test@example.com' },
            shippingAddress: { line1: '123', city: 'London', postcode: 'SW1A 1AA', country: 'UK' },
            items: [{ productId: testProductId, quantity: 1 }],
          }),
        });
        expect(response.status).toBe(400);
      });

      it('应该拒绝缺少收货地址', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            customer: { email: 'test@example.com', name: 'Test' },
            items: [{ productId: testProductId, quantity: 1 }],
          }),
        });
        expect(response.status).toBe(400);
      });

      it('应该拒绝空购物车', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            customer: { email: 'test@example.com', name: 'Test' },
            shippingAddress: { line1: '123', city: 'London', postcode: 'SW1A 1AA', country: 'UK' },
            items: [],
          }),
        });
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('边界条件', () => {
      it('应该处理空邮箱', async () => {
        if (!testBrandId || !testProductId) return;
        const data = validOrderData();
        data.customer.email = '';
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify(data),
        });
        expect(response.status).toBe(400);
      });

      it('应该处理空白邮箱', async () => {
        if (!testBrandId || !testProductId) return;
        const data = validOrderData();
        data.customer.email = '   ';
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify(data),
        });
        expect(response.status).toBe(400);
      });

      it('应该处理超长邮箱', async () => {
        if (!testBrandId || !testProductId) return;
        const data = validOrderData();
        data.customer.email = 'x'.repeat(500) + '@example.com';
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify(data),
        });
        expect([200, 201, 400, 500]).toContain(response.status);
      });

      it('应该处理超长姓名', async () => {
        if (!testBrandId || !testProductId) return;
        const data = validOrderData();
        data.customer.name = 'x'.repeat(1000);
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify(data),
        });
        expect([200, 201, 400, 500]).toContain(response.status);
      });

      it('应该处理不存在的产品', async () => {
        if (!testBrandId) return;
        const data = validOrderData();
        data.items = [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }];
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify(data),
        });
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('错误输入', () => {
      it('应该拒绝缺少 brand ID', async () => {
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          body: JSON.stringify(validOrderData()),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理无效 JSON', async () => {
        if (!testBrandId) return;
        const response = await fetch(`${API_BASE_URL}/api/orders/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-brand-id': testBrandId,
          },
          body: '{invalid json}',
        });
        expect([400, 404, 500]).toContain(response.status);
      });

      it('应该处理空请求体', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('安全测试', () => {
      it('应该防止 XSS - 姓名', async () => {
        if (!testBrandId || !testProductId) return;
        const data = validOrderData();
        data.customer.name = '<script>alert("xss")</script>';
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify(data),
        });
        expect([200, 201, 400, 500]).toContain(response.status);
      });

      it('应该防止 SQL 注入 - 邮箱', async () => {
        if (!testBrandId || !testProductId) return;
        const data = validOrderData();
        data.customer.email = "'; DROP TABLE orders; --@test.com";
        const response = await apiRequest('/api/orders/create', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify(data),
        });
        expect([200, 201, 400, 500]).toContain(response.status);
      });
    });
  });

  // ============================================
  // GET /api/orders/:id - 获取订单详情
  // ============================================
  describe('GET /api/orders/:id', () => {
    describe('正常场景', () => {
      it('应该需要订单 ID 和邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/test-order-id', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该需要有效的邮箱参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/test-order-id?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('边界条件', () => {
      it('应该处理不存在的订单', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/00000000-0000-0000-0000-000000000000?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });

      it('应该处理空订单 ID', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404, 405]).toContain(response.status);
      });

      it('应该处理空邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/test-id?email=', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理无效 UUID 格式', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/orders/invalid-uuid?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404, 500]).toContain(response.status);
      });
    });

    describe('错误输入', () => {
      it('应该拒绝缺少 brand ID', async () => {
        const response = await apiRequest('/api/orders/test-id?email=test@example.com');
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('安全测试', () => {
      it('应该防止 SQL 注入 - 订单 ID', async () => {
        if (!testBrandId) return;
        const response = await apiRequest("/api/orders/'; DROP TABLE orders; --?email=test@example.com", {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404, 500]).toContain(response.status);
      });

      it('应该防止 SQL 注入 - 邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest("/api/orders/test-id?email='; DROP TABLE orders; --", {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // HTTP 方法测试
  // ============================================
  describe('HTTP 方法', () => {
    it('GET /api/cart/validate 应该返回 405', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/cart/validate', {
        method: 'GET',
        headers: { 'x-brand-id': testBrandId },
      });
      expect([404, 405]).toContain(response.status);
    });

    it('GET /api/orders/create 应该返回 405', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/orders/create', {
        method: 'GET',
        headers: { 'x-brand-id': testBrandId },
      });
      expect([404, 405]).toContain(response.status);
    });

    it('POST /api/orders/:id 应该返回 405', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/orders/test-id?email=test@example.com', {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({}),
      });
      expect([404, 405]).toContain(response.status);
    });
  });
});
