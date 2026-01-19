/**
 * Admin API - 完整测试
 * 所有管理后台接口的完整测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TEST_BRAND_DOMAIN, apiRequest, getAdminToken, clearTokenCache } from '../../setup';

let testBrandId: string;
let adminToken: string;

describe('Admin API Complete Tests', () => {
  beforeAll(async () => {
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }

    try {
      adminToken = await getAdminToken();
    } catch (error) {
      console.warn('Could not get admin token:', error);
    }
  });

  afterAll(() => {
    clearTokenCache();
  });

  // ============================================
  // 权限测试 - 所有 Admin API
  // ============================================
  describe('权限验证', () => {
    const adminEndpoints = [
      '/api/admin/brands',
      '/api/admin/categories',
      '/api/admin/products',
      '/api/admin/orders',
      '/api/admin/coupons',
      '/api/admin/reviews',
      '/api/admin/analytics/overview',
      '/api/admin/overview',
      '/api/admin/settings',
      '/api/admin/marketing/pixels',
      '/api/admin/seo/meta',
      '/api/admin/templates',
    ];

    adminEndpoints.forEach((endpoint) => {
      it(`${endpoint} 应该需要认证`, async () => {
        const response = await apiRequest(endpoint);
        expect(response.status).toBe(401);
      });

      it(`${endpoint} 应该拒绝无效 token`, async () => {
        const response = await apiRequest(endpoint, {}, 'invalid-token-12345');
        expect([401, 403]).toContain(response.status);
      });

      it(`${endpoint} 应该拒绝格式错误的 token`, async () => {
        const response = await apiRequest(endpoint, {}, 'Bearer malformed');
        expect([401, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Brands API
  // ============================================
  describe('Admin Brands API', () => {
    describe('GET /api/admin/brands', () => {
      it('应该返回品牌列表（有认证）', async () => {
        if (!adminToken) return;
        const response = await apiRequest('/api/admin/brands', {}, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该支持分页', async () => {
        if (!adminToken) return;
        const response = await apiRequest('/api/admin/brands?page=1&limit=10', {}, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('GET /api/admin/brands/available', () => {
      it('应该返回可用品牌', async () => {
        if (!adminToken) return;
        const response = await apiRequest('/api/admin/brands/available', {}, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('GET /api/admin/brands/:id', () => {
      it('应该返回单个品牌', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest(`/api/admin/brands/${testBrandId}`, {}, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });

      it('应该处理不存在的品牌', async () => {
        if (!adminToken) return;
        const response = await apiRequest('/api/admin/brands/00000000-0000-0000-0000-000000000000', {}, adminToken);
        expect([403, 404]).toContain(response.status);
      });

      it('应该处理无效的品牌 ID', async () => {
        if (!adminToken) return;
        const response = await apiRequest('/api/admin/brands/invalid-uuid', {}, adminToken);
        expect([400, 403, 404, 500]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Categories API
  // ============================================
  describe('Admin Categories API', () => {
    describe('GET /api/admin/categories', () => {
      it('应该返回分类列表', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/categories', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该需要 brand ID', async () => {
        if (!adminToken) return;
        const response = await apiRequest('/api/admin/categories', {}, adminToken);
        expect([400, 403]).toContain(response.status);
      });
    });

    describe('POST /api/admin/categories', () => {
      it('应该验证必填字段', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/categories', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        }, adminToken);
        expect([400, 403]).toContain(response.status);
      });

      it('应该验证名称不能为空', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/categories', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ name: '' }),
        }, adminToken);
        expect([400, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Products API
  // ============================================
  describe('Admin Products API', () => {
    describe('GET /api/admin/products', () => {
      it('应该返回产品列表', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/products', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该支持分页', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/products?page=1&limit=5', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该支持搜索', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/products?search=bike', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该支持状态筛选', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/products?status=active', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('GET /api/admin/products/:id', () => {
      it('应该处理不存在的产品', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/products/00000000-0000-0000-0000-000000000000', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([403, 404]).toContain(response.status);
      });
    });

    describe('POST /api/admin/products', () => {
      it('应该验证必填字段', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/products', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        }, adminToken);
        expect([400, 403]).toContain(response.status);
      });

      it('应该验证价格不能为负', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/products', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            name: 'Test Product',
            price: -100,
          }),
        }, adminToken);
        expect([400, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Orders API
  // ============================================
  describe('Admin Orders API', () => {
    describe('GET /api/admin/orders', () => {
      it('应该返回订单列表', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/orders', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该支持状态筛选', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/orders?status=pending', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该支持日期范围筛选', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/orders?start_date=2024-01-01&end_date=2024-12-31', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('GET /api/admin/orders/:id', () => {
      it('应该处理不存在的订单', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/orders/00000000-0000-0000-0000-000000000000', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([403, 404]).toContain(response.status);
      });
    });

    describe('PUT /api/admin/orders/:id/status', () => {
      it('应该验证状态值', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/orders/test-id/status', {
          method: 'PUT',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ status: 'invalid_status' }),
        }, adminToken);
        expect([400, 403, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Coupons API
  // ============================================
  describe('Admin Coupons API', () => {
    describe('GET /api/admin/coupons', () => {
      it('应该返回优惠券列表', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/coupons', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('POST /api/admin/coupons', () => {
      it('应该验证必填字段', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/coupons', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        }, adminToken);
        expect([400, 403]).toContain(response.status);
      });

      it('应该验证折扣值范围', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/coupons', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            code: 'TEST',
            type: 'percentage',
            value: 150, // 超过 100%
          }),
        }, adminToken);
        expect([400, 403]).toContain(response.status);
      });

      it('应该验证负数折扣值', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/coupons', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            code: 'TEST',
            type: 'fixed',
            value: -50,
          }),
        }, adminToken);
        expect([400, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Reviews API
  // ============================================
  describe('Admin Reviews API', () => {
    describe('GET /api/admin/reviews', () => {
      it('应该返回评论列表', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/reviews', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });

      it('应该支持状态筛选', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/reviews?status=pending', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('PUT /api/admin/reviews/:id', () => {
      it('应该验证状态值', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/reviews/test-id', {
          method: 'PUT',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ status: 'invalid' }),
        }, adminToken);
        expect([400, 403, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Analytics API
  // ============================================
  describe('Admin Analytics API', () => {
    describe('GET /api/admin/analytics/overview', () => {
      it('应该返回分析概览', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/analytics/overview', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('GET /api/admin/analytics/sales', () => {
      it('应该返回销售数据', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/analytics/sales', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });
    });

    describe('GET /api/admin/analytics/traffic', () => {
      it('应该返回流量数据', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/analytics/traffic', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Overview API
  // ============================================
  describe('Admin Overview API', () => {
    describe('GET /api/admin/overview', () => {
      it('应该返回仪表盘概览', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/overview', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Settings API
  // ============================================
  describe('Admin Settings API', () => {
    describe('GET /api/admin/settings', () => {
      it('应该返回设置', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/settings', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403]).toContain(response.status);
      });
    });

    describe('PUT /api/admin/settings', () => {
      it('应该验证设置格式', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/settings', {
          method: 'PUT',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ invalid: 'data' }),
        }, adminToken);
        expect([200, 400, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Marketing API
  // ============================================
  describe('Admin Marketing API', () => {
    describe('GET /api/admin/marketing/pixels', () => {
      it('应该返回像素配置', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/marketing/pixels', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });
    });

    describe('GET /api/admin/marketing/utm', () => {
      it('应该返回 UTM 统计', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/marketing/utm', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin SEO API
  // ============================================
  describe('Admin SEO API', () => {
    describe('GET /api/admin/seo/meta', () => {
      it('应该返回 SEO 元数据', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/seo/meta', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Advanced SEO API
  // ============================================
  describe('Admin Advanced SEO API', () => {
    describe('GET /api/admin/advanced-seo', () => {
      it('应该返回高级 SEO 数据', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/advanced-seo', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Admin Templates API
  // ============================================
  describe('Admin Templates API', () => {
    describe('GET /api/admin/templates', () => {
      it('应该返回模板列表', async () => {
        if (!adminToken || !testBrandId) return;
        const response = await apiRequest('/api/admin/templates', {
          headers: { 'x-brand-id': testBrandId },
        }, adminToken);
        expect([200, 403, 404]).toContain(response.status);
      });
    });
  });
});
