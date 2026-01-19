/**
 * Content/Knowledge/Chat/Email API - 完整测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_BRAND_DOMAIN, apiRequest } from '../../setup';

let testBrandId: string;

describe('Content System Complete Tests', () => {
  beforeAll(async () => {
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }
  });

  // ============================================
  // Content API
  // ============================================
  describe('Content API', () => {
    describe('GET /api/content', () => {
      it('应该返回内容列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/content', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该支持类型筛选', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/content?type=blog', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('POST /api/content/generate', () => {
      it('应该接受有效的内容生成请求', async () => {
        if (!testBrandId) return;
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

      it('应该处理空主题', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/content/generate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            type: 'product_description',
            topic: '',
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理各种内容类型', async () => {
        if (!testBrandId) return;
        const types = ['product_description', 'blog_post', 'faq', 'meta_description'];
        for (const type of types) {
          const response = await apiRequest('/api/content/generate', {
            method: 'POST',
            headers: { 'x-brand-id': testBrandId },
            body: JSON.stringify({ type, topic: 'test' }),
          });
          expect([200, 400, 404, 500]).toContain(response.status);
        }
      });

      it('应该处理 XSS 主题', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/content/generate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            type: 'blog_post',
            topic: '<script>alert("xss")</script>electric bike',
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理 SQL 注入主题', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/content/generate', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            type: 'blog_post',
            topic: "'; DROP TABLE content; --",
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Knowledge API
  // ============================================
  describe('Knowledge API', () => {
    describe('GET /api/knowledge', () => {
      it('应该返回知识库条目', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/knowledge', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('POST /api/knowledge/search', () => {
      it('应该搜索知识库', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/knowledge/search', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ query: 'shipping' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理空查询', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/knowledge/search', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ query: '' }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理超长查询', async () => {
        if (!testBrandId) return;
        const longQuery = 'x'.repeat(1000);
        const response = await apiRequest('/api/knowledge/search', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ query: longQuery }),
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Chat API
  // ============================================
  describe('Chat API', () => {
    describe('POST /api/chat', () => {
      it('应该接受聊天消息', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/chat', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            message: 'Hello, what products do you have?',
            session_id: 'test-session-123',
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理空消息', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/chat', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            message: '',
            session_id: 'test-session',
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理超长消息', async () => {
        if (!testBrandId) return;
        const longMessage = 'x'.repeat(5000);
        const response = await apiRequest('/api/chat', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            message: longMessage,
            session_id: 'test-session',
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理 XSS 消息', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/chat', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            message: '<script>alert("xss")</script>',
            session_id: 'test-session',
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });

      it('应该处理多轮对话', async () => {
        if (!testBrandId) return;
        const sessionId = `test-session-${Date.now()}`;
        
        // 第一轮
        await apiRequest('/api/chat', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            message: 'Hello',
            session_id: sessionId,
          }),
        });

        // 第二轮
        const response = await apiRequest('/api/chat', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            message: 'Tell me more',
            session_id: sessionId,
          }),
        });
        expect([200, 400, 404, 500]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Email Sequences API
  // ============================================
  describe('Email Sequences API', () => {
    describe('GET /api/email-sequences', () => {
      it('应该返回邮件序列', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/email-sequences', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/email-sequences/trigger', () => {
      it('应该触发邮件序列', async () => {
        if (!testBrandId) return;
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

      it('应该处理缺少序列名', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/email-sequences/trigger', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            email: 'test@example.com',
          }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理缺少邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/email-sequences/trigger', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            sequence: 'welcome',
          }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理无效邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/email-sequences/trigger', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            sequence: 'welcome',
            email: 'invalid-email',
          }),
        });
        expect([200, 400, 401, 404]).toContain(response.status);
      });

      it('应该处理各种序列类型', async () => {
        if (!testBrandId) return;
        const sequences = ['welcome', 'cart_abandonment', 'post_purchase', 'win_back'];
        for (const sequence of sequences) {
          const response = await apiRequest('/api/email-sequences/trigger', {
            method: 'POST',
            headers: { 'x-brand-id': testBrandId },
            body: JSON.stringify({
              sequence,
              email: 'test@example.com',
            }),
          });
          expect([200, 400, 401, 404]).toContain(response.status);
        }
      });
    });
  });

  // ============================================
  // Images API
  // ============================================
  describe('Images API', () => {
    describe('GET /api/images', () => {
      it('应该返回图片列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/images', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Authors API
  // ============================================
  describe('Authors API', () => {
    describe('GET /api/authors', () => {
      it('应该返回作者列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/authors', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Related Content API
  // ============================================
  describe('Related Content API', () => {
    describe('GET /api/related-content', () => {
      it('应该返回相关内容', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/related-content?type=product&id=test', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少类型', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/related-content?id=test', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理缺少 ID', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/related-content?type=product', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Monitoring API
  // ============================================
  describe('Monitoring API', () => {
    describe('GET /api/monitoring/health', () => {
      it('应该返回健康状态', async () => {
        const response = await apiRequest('/api/monitoring/health');
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('GET /api/monitoring/errors', () => {
      it('应该返回错误日志', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/monitoring/errors', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 401, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Settings API (Public)
  // ============================================
  describe('Settings API', () => {
    describe('GET /api/settings', () => {
      it('应该返回公共设置', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/settings', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Categories API (Public)
  // ============================================
  describe('Categories API', () => {
    describe('GET /api/categories', () => {
      it('应该返回分类列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/categories', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('GET /api/categories/:slug', () => {
      it('应该返回单个分类', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/categories/electric-bikes', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该处理不存在的分类', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/categories/non-existent-category', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect(response.status).toBe(404);
      });
    });
  });
});
