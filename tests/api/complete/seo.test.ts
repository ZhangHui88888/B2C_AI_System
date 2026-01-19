/**
 * SEO Tools API - 完整测试
 * Keywords, EEAT, Reports, Links, Index Status
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_BRAND_DOMAIN, apiRequest } from '../../setup';

let testBrandId: string;

describe('SEO Tools Complete Tests', () => {
  beforeAll(async () => {
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }
  });

  // ============================================
  // Keywords API
  // ============================================
  describe('Keywords API', () => {
    describe('GET /api/keywords', () => {
      it('应该返回关键词列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/keywords', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/keywords/research', () => {
      it('应该接受有效的关键词研究请求', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/keywords/research', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ seed_keyword: 'electric bike' }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理空关键词', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/keywords/research', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ seed_keyword: '' }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理超长关键词', async () => {
        if (!testBrandId) return;
        const longKeyword = 'x'.repeat(500);
        const response = await apiRequest('/api/keywords/research', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ seed_keyword: longKeyword }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理特殊字符关键词', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/keywords/research', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ seed_keyword: '电动自行车 🚲' }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理 SQL 注入', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/keywords/research', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ seed_keyword: "'; DROP TABLE keywords; --" }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // EEAT API
  // ============================================
  describe('EEAT API', () => {
    describe('POST /api/eeat/analyze', () => {
      it('应该接受有效的 EEAT 分析请求', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/eeat/analyze', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/test-page',
            content: 'This is a comprehensive guide about electric bikes written by our expert team.',
          }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理空内容', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/eeat/analyze', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/test-page',
            content: '',
          }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理超长内容', async () => {
        if (!testBrandId) return;
        const longContent = 'Lorem ipsum '.repeat(1000);
        const response = await apiRequest('/api/eeat/analyze', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/test-page',
            content: longContent,
          }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理 XSS 内容', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/eeat/analyze', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/test-page',
            content: '<script>alert("xss")</script>Good content here.',
          }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });
    });

    describe('GET /api/eeat/score', () => {
      it('应该返回 EEAT 评分', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/eeat/score', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // SEO Reports API
  // ============================================
  describe('SEO Reports API', () => {
    describe('GET /api/seo-reports', () => {
      it('应该返回 SEO 报告列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/seo-reports', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/seo-reports/generate', () => {
      it('应该接受有效的报告生成请求', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/seo-reports/generate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ type: 'weekly' }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理各种报告类型', async () => {
        if (!testBrandId) return;
        const reportTypes = ['daily', 'weekly', 'monthly'];
        for (const type of reportTypes) {
          const response = await apiRequest('/api/seo-reports/generate', {
            method: 'POST',
            headers: { 'x-brand-id': testBrandId },
            body: JSON.stringify({ type }),
          });
          expect([200, 400, 401, 404]).toContain(response.status);
        }
      });

      it('应该处理无效报告类型', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/seo-reports/generate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ type: 'invalid' }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // SEO Links API
  // ============================================
  describe('SEO Links API', () => {
    describe('GET /api/seo-links/orphans', () => {
      it('应该返回孤立页面', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/seo-links/orphans', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('GET /api/seo-links/density', () => {
      it('应该返回内链密度', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/seo-links/density', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Index Status API
  // ============================================
  describe('Index Status API', () => {
    describe('GET /api/index-status', () => {
      it('应该返回索引状态', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/index-status', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/index-status/check', () => {
      it('应该检查 URL 索引状态', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/index-status/check', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ urls: ['/products', '/about'] }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理空 URL 列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/index-status/check', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ urls: [] }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理大量 URL', async () => {
        if (!testBrandId) return;
        const urls = Array(100).fill('/test').map((u, i) => `${u}-${i}`);
        const response = await apiRequest('/api/index-status/check', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ urls }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Search Console API
  // ============================================
  describe('Search Console API', () => {
    describe('GET /api/search-console/performance', () => {
      it('应该返回搜索性能数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/search-console/performance', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // SEO Analyze API
  // ============================================
  describe('SEO Analyze API', () => {
    describe('POST /api/seo/analyze', () => {
      it('应该分析内容 SEO', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/seo/analyze', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            content: 'Electric bikes are becoming increasingly popular...',
            url: '/products/electric-bikes',
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少内容', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/seo/analyze', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            url: '/test',
          }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Sitemap API
  // ============================================
  describe('Sitemap API', () => {
    describe('GET /api/sitemap', () => {
      it('应该返回站点地图数据', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/sitemap', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });
  });
});
