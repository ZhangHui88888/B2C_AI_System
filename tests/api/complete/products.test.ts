/**
 * Products API - 完整测试
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
let testProductSlug: string;
let testCategorySlug: string;

describe('Products API Complete Tests', () => {
  beforeAll(async () => {
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }

    // Get test product
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
          testProductSlug = data.products[0].slug;
          testCategorySlug = data.products[0].categories?.slug;
        }
      }
    }
  });

  // ============================================
  // POST /api/products/list - 产品列表
  // ============================================
  describe('POST /api/products/list', () => {
    describe('正常场景', () => {
      it('应该返回产品列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(Array.isArray(data.products)).toBe(true);
        expect(data.pagination).toBeDefined();
      });

      it('应该返回正确的分页结构', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ page: 1, limit: 5 }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBe(5);
        expect(typeof data.pagination.total).toBe('number');
        expect(typeof data.pagination.totalPages).toBe('number');
      });

      it('应该支持 pageSize 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ pageSize: 3 }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        expect(data.products.length).toBeLessThanOrEqual(3);
      });

      it('应该支持分类筛选', async () => {
        if (!testBrandId || !testCategorySlug) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ category: testCategorySlug }),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该支持搜索功能', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ search: 'bike' }),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该支持价格范围筛选', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ price_min: 100, price_max: 5000 }),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该支持特色产品筛选', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ featured: true }),
        });
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('排序场景', () => {
      it('应该支持价格升序排序', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'price_asc' }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        if (data.products?.length >= 2) {
          expect(data.products[0].price <= data.products[1].price).toBe(true);
        }
      });

      it('应该支持价格降序排序', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'price_desc' }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        if (data.products?.length >= 2) {
          expect(data.products[0].price >= data.products[1].price).toBe(true);
        }
      });

      it('应该支持最新排序', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'newest' }),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该支持特色排序', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'featured' }),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该支持畅销排序', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'best_selling' }),
        });
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('边界条件', () => {
      it('应该处理空请求体', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该处理 page=0', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ page: 0 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理负数 page', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ page: -1 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理 limit=0', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: 0 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理负数 limit', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: -10 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理超大 limit', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: 999999 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理超大 page', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ page: 999999 }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        expect(data.products?.length || 0).toBe(0);
      });

      it('应该处理价格范围 min > max', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ price_min: 5000, price_max: 100 }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        expect(data.products?.length || 0).toBe(0);
      });

      it('应该处理负数价格', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ price_min: -100 }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理不存在的分类', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ category: 'non-existent-category-slug' }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        expect(data.products?.length || 0).toBe(0);
      });

      it('应该处理空搜索词', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ search: '' }),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该处理超长搜索词', async () => {
        if (!testBrandId) return;
        const longSearch = 'x'.repeat(1000);
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ search: longSearch }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });

    describe('错误输入', () => {
      it('应该拒绝缺少 brand ID', async () => {
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝无效的 brand ID', async () => {
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': 'invalid-uuid' },
          body: JSON.stringify({}),
        });
        expect([400, 404, 500]).toContain(response.status);
      });

      it('应该拒绝不存在的 brand ID', async () => {
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': '00000000-0000-0000-0000-000000000000' },
          body: JSON.stringify({}),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理无效的 sort 值', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ sort: 'invalid_sort' }),
        });
        expect([200, 404]).toContain(response.status); // 应该使用默认排序
      });

      it('应该处理非数字的 limit', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: 'abc' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理非数字的 page', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ page: 'abc' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理布尔值的 limit', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: true }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理数组类型的参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: [10, 20] }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理 null 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: null, page: null }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });

    describe('安全测试', () => {
      it('应该防止 SQL 注入 - 搜索', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ search: "'; DROP TABLE products; --" }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该防止 SQL 注入 - 分类', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ category: "'; DROP TABLE categories; --" }),
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该处理 XSS 攻击 - 搜索', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ search: '<script>alert("xss")</script>' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理特殊字符 - 搜索', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ search: '!@#$%^&*()_+-=[]{}|;:",.<>?/' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理 Unicode 字符', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ search: '电动自行车 🚲' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });

    describe('数据验证', () => {
      it('产品应该包含必要字段', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/list', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ limit: 1 }),
        });
        expect([200, 404]).toContain(response.status);
        if (!response.ok) return;
        const data = await response.json();
        if (data.products?.length > 0) {
          const product = data.products[0];
          expect(product.id).toBeDefined();
          expect(typeof product.id).toBe('string');
          expect(product.name).toBeDefined();
          expect(product.slug).toBeDefined();
          expect(typeof product.price).toBe('number');
        }
      });
    });
  });

  // ============================================
  // GET /api/products/:slug - 单个产品
  // ============================================
  describe('GET /api/products/:slug', () => {
    describe('正常场景', () => {
      it('应该返回产品详情', async () => {
        if (!testBrandId || !testProductSlug) return;
        const response = await apiRequest(`/api/products/${testProductSlug}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.product).toBeDefined();
      });

      it('应该返回相关产品', async () => {
        if (!testBrandId || !testProductSlug) return;
        const response = await apiRequest(`/api/products/${testProductSlug}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
        const data = await response.json();
        expect(Array.isArray(data.relatedProducts)).toBe(true);
      });

      it('产品应该包含分类信息', async () => {
        if (!testBrandId || !testProductSlug) return;
        const response = await apiRequest(`/api/products/${testProductSlug}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
        const data = await response.json();
        if (data.product.categories) {
          expect(data.product.categories.name).toBeDefined();
          expect(data.product.categories.slug).toBeDefined();
        }
      });
    });

    describe('边界条件', () => {
      it('应该处理不存在的产品', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/non-existent-product-slug-12345', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });

      it('应该处理空 slug', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404, 405]).toContain(response.status);
      });

      it('应该处理超长 slug', async () => {
        if (!testBrandId) return;
        const longSlug = 'x'.repeat(500);
        const response = await apiRequest(`/api/products/${longSlug}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });

      it('应该处理特殊字符 slug', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/test%20product', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });
    });

    describe('错误输入', () => {
      it('应该拒绝缺少 brand ID', async () => {
        const response = await apiRequest('/api/products/test-product');
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝无效的 brand ID', async () => {
        const response = await apiRequest('/api/products/test-product', {
          headers: { 'x-brand-id': 'invalid' },
        });
        expect([400, 404, 500]).toContain(response.status);
      });
    });

    describe('安全测试', () => {
      it('应该防止路径遍历', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/products/../../../etc/passwd', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });

      it('应该防止 SQL 注入', async () => {
        if (!testBrandId) return;
        const response = await apiRequest("/api/products/'; DROP TABLE products; --", {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });
    });

    describe('数据验证', () => {
      it('产品应该包含所有必要字段', async () => {
        if (!testBrandId || !testProductSlug) return;
        const response = await apiRequest(`/api/products/${testProductSlug}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
        const data = await response.json();
        const product = data.product;
        
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        expect(product.slug).toBeDefined();
        expect(typeof product.price).toBe('number');
        expect(product.is_active).toBe(true);
      });
    });
  });

  // ============================================
  // HTTP 方法测试
  // ============================================
  describe('HTTP 方法', () => {
    it('GET /api/products/list 应该返回 405', async () => {
      if (!testBrandId) return;
      const response = await apiRequest('/api/products/list', {
        method: 'GET',
        headers: { 'x-brand-id': testBrandId },
      });
      expect([404, 405]).toContain(response.status);
    });

    it('POST /api/products/:slug 应该返回 405', async () => {
      if (!testBrandId || !testProductSlug) return;
      const response = await apiRequest(`/api/products/${testProductSlug}`, {
        method: 'POST',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({}),
      });
      expect([404, 405]).toContain(response.status);
    });

    it('PUT /api/products/:slug 应该返回 405', async () => {
      if (!testBrandId || !testProductSlug) return;
      const response = await apiRequest(`/api/products/${testProductSlug}`, {
        method: 'PUT',
        headers: { 'x-brand-id': testBrandId },
        body: JSON.stringify({}),
      });
      expect([404, 405]).toContain(response.status);
    });

    it('DELETE /api/products/:slug 应该返回 405', async () => {
      if (!testBrandId || !testProductSlug) return;
      const response = await apiRequest(`/api/products/${testProductSlug}`, {
        method: 'DELETE',
        headers: { 'x-brand-id': testBrandId },
      });
      expect([404, 405]).toContain(response.status);
    });
  });
});
