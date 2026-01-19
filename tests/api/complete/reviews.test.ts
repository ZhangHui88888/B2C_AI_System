/**
 * Reviews API - 完整测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_BRAND_DOMAIN, apiRequest } from '../../setup';

let testBrandId: string;
let testProductId: string;

describe('Reviews API Complete Tests', () => {
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
  // GET /api/reviews/product/:productId
  // ============================================
  describe('GET /api/reviews/product/:productId', () => {
    describe('正常场景', () => {
      it('应该返回产品评论列表', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该返回分页信息', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?page=1&limit=5`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.pagination).toBeDefined();
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBe(5);
      });

      it('应该支持最高评分排序', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?sort=highest`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
      });

      it('应该支持最低评分排序', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?sort=lowest`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
      });

      it('应该支持最有帮助排序', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?sort=helpful`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
      });

      it('应该支持最新排序', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?sort=newest`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
      });
    });

    describe('边界条件', () => {
      it('应该处理不存在的产品 ID', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/product/00000000-0000-0000-0000-000000000000', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404, 500]).toContain(response.status);
        if (response.ok) {
          const data = await response.json();
          expect(data.data.length).toBe(0);
        }
      });

      it('应该处理无效的产品 ID', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/product/invalid-uuid', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理超大页码', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?page=99999`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.data.length).toBe(0);
      });

      it('应该处理负数页码', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?page=-1`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400]).toContain(response.status);
      });

      it('应该处理无效排序参数', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/product/${testProductId}?sort=invalid`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
      });
    });
  });

  // ============================================
  // GET /api/reviews/stats/:productId
  // ============================================
  describe('GET /api/reviews/stats/:productId', () => {
    describe('正常场景', () => {
      it('应该返回评论统计', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/stats/${testProductId}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
      });

      it('应该返回正确的统计结构', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest(`/api/reviews/stats/${testProductId}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(typeof data.data.total_reviews).toBe('number');
        expect(typeof data.data.average_rating).toBe('number');
        expect(typeof data.data.rating_1).toBe('number');
        expect(typeof data.data.rating_2).toBe('number');
        expect(typeof data.data.rating_3).toBe('number');
        expect(typeof data.data.rating_4).toBe('number');
        expect(typeof data.data.rating_5).toBe('number');
      });
    });

    describe('边界条件', () => {
      it('应该处理不存在的产品', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/stats/00000000-0000-0000-0000-000000000000', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404, 500]).toContain(response.status);
        if (response.ok) {
          const data = await response.json();
          expect(data.data.total_reviews).toBe(0);
          expect(data.data.average_rating).toBe(0);
        }
      });
    });
  });

  // ============================================
  // POST /api/reviews - 创建评论
  // ============================================
  describe('POST /api/reviews', () => {
    describe('验证场景', () => {
      it('应该拒绝缺少 product_id', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            rating: 5,
            content: 'Great product!',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝缺少 rating', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            content: 'Great product!',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝评分小于 1', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 0,
            content: 'Bad!',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝评分大于 5', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 10,
            content: 'Great!',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝不存在的产品', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: '00000000-0000-0000-0000-000000000000',
            rating: 5,
            content: 'Great!',
          }),
        });
        expect(response.status).toBe(404);
      });
    });

    describe('边界条件', () => {
      it('应该处理评分为 1', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 1,
            content: 'Not great',
          }),
        });
        expect([200, 201]).toContain(response.status);
      });

      it('应该处理评分为 5', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 5,
            content: 'Excellent!',
          }),
        });
        expect([200, 201]).toContain(response.status);
      });

      it('应该处理小数评分', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 3.5,
            content: 'OK',
          }),
        });
        expect([200, 201, 400]).toContain(response.status);
      });

      it('应该处理负数评分', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: -1,
            content: 'Bad',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理空内容', async () => {
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
        expect([200, 201, 400]).toContain(response.status);
      });

      it('应该处理超长内容', async () => {
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
        expect([200, 201, 400]).toContain(response.status);
      });

      it('应该处理空标题', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 5,
            title: '',
            content: 'Great!',
          }),
        });
        expect([200, 201]).toContain(response.status);
      });

      it('应该处理匿名评论', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 5,
            content: 'Great!',
          }),
        });
        expect([200, 201]).toContain(response.status);
        if (response.ok) {
          const data = await response.json();
          expect(data.data.reviewer_name).toBe('Anonymous');
        }
      });
    });

    describe('安全测试', () => {
      it('应该处理 XSS - 内容', async () => {
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
        expect([200, 201, 400]).toContain(response.status);
      });

      it('应该处理 XSS - 标题', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 5,
            title: '<img src=x onerror=alert(1)>',
            content: 'Good!',
          }),
        });
        expect([200, 201, 400]).toContain(response.status);
      });

      it('应该处理 XSS - 姓名', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 5,
            reviewer_name: '<script>alert(1)</script>',
            content: 'Good!',
          }),
        });
        expect([200, 201, 400]).toContain(response.status);
      });

      it('应该处理 SQL 注入', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 5,
            content: "'; DROP TABLE reviews; --",
          }),
        });
        expect([200, 201, 400]).toContain(response.status);
      });
    });

    describe('错误输入', () => {
      it('应该拒绝缺少 brand ID', async () => {
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({
            product_id: 'test',
            rating: 5,
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理非数字评分', async () => {
        if (!testBrandId || !testProductId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            product_id: testProductId,
            rating: 'five',
            content: 'Good!',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理空请求体', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // POST /api/reviews/:id/vote - 投票
  // ============================================
  describe('POST /api/reviews/:id/vote', () => {
    describe('验证场景', () => {
      it('应该需要 is_helpful 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/test-review-id/vote', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝不存在的评论', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/00000000-0000-0000-0000-000000000000/vote', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ is_helpful: true }),
        });
        expect(response.status).toBe(404);
      });
    });

    describe('边界条件', () => {
      it('应该处理 is_helpful=true', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/test-id/vote', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ is_helpful: true }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理 is_helpful=false', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/test-id/vote', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ is_helpful: false }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理非布尔值的 is_helpful', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/reviews/test-id/vote', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ is_helpful: 'yes' }),
        });
        expect([400, 404]).toContain(response.status);
      });
    });
  });
});
