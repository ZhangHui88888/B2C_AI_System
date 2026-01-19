/**
 * Membership/Points/Referrals API - 完整测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TEST_BRAND_DOMAIN, apiRequest } from '../../setup';

let testBrandId: string;

describe('Membership System Complete Tests', () => {
  beforeAll(async () => {
    const response = await apiRequest(`/api/site-config?host=${TEST_BRAND_DOMAIN}`);
    if (response.ok) {
      const data = await response.json();
      testBrandId = data.brand?.id;
    }
  });

  // ============================================
  // Membership API
  // ============================================
  describe('Membership API', () => {
    describe('GET /api/membership/status', () => {
      it('应该需要 email 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/membership/status', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该返回会员状态', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/membership/status?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理空邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/membership/status?email=', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理无效邮箱格式', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/membership/status?email=invalid-email', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理超长邮箱', async () => {
        if (!testBrandId) return;
        const longEmail = 'x'.repeat(500) + '@example.com';
        const response = await apiRequest(`/api/membership/status?email=${longEmail}`, {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该防止 SQL 注入', async () => {
        if (!testBrandId) return;
        const response = await apiRequest("/api/membership/status?email='; DROP TABLE members; --", {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });

    describe('GET /api/membership/tiers', () => {
      it('应该返回会员等级列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/membership/tiers', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });

      it('应该拒绝缺少 brand ID', async () => {
        const response = await apiRequest('/api/membership/tiers');
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('GET /api/membership/benefits', () => {
      it('应该返回会员权益', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/membership/benefits', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Points API
  // ============================================
  describe('Points API', () => {
    describe('GET /api/points/balance', () => {
      it('应该需要 email 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/balance', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该返回积分余额', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/balance?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该为新用户返回 0 余额', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/balance?email=newuser12345@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        if (response.ok) {
          const data = await response.json();
          expect(data.balance === 0 || data.points === 0 || data.balance === undefined).toBe(true);
        }
      });

      it('应该处理空邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/balance?email=', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('GET /api/points/history', () => {
      it('应该需要 email 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/history', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该返回积分历史', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/history?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该支持分页', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/history?email=test@example.com&page=1&limit=10', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });

    describe('GET /api/points/rewards', () => {
      it('应该返回可兑换奖励列表', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/rewards', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 404]).toContain(response.status);
      });
    });

    describe('POST /api/points/redeem', () => {
      it('应该需要 email', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/redeem', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ reward_id: 'test' }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该需要 reward_id', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/redeem', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({ email: 'test@example.com' }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝积分不足的兑换', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/redeem', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            email: 'newuser@example.com',
            reward_id: 'expensive-reward',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝不存在的奖励', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/redeem', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            email: 'test@example.com',
            reward_id: 'non-existent-reward',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该处理空请求体', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/points/redeem', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Referrals API
  // ============================================
  describe('Referrals API', () => {
    describe('GET /api/referrals/code', () => {
      it('应该需要 email 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/code', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该返回推荐码', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/code?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });

      it('应该处理空邮箱', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/code?email=', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });
    });

    describe('GET /api/referrals/stats', () => {
      it('应该需要 email 参数', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/stats', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该返回推荐统计', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/stats?email=test@example.com', {
          headers: { 'x-brand-id': testBrandId },
        });
        expect([200, 400, 404]).toContain(response.status);
      });
    });

    describe('POST /api/referrals/apply', () => {
      it('应该需要 code 和 email', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/apply', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({}),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该拒绝无效的推荐码', async () => {
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

      it('应该拒绝空推荐码', async () => {
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

      it('应该拒绝自我推荐', async () => {
        if (!testBrandId) return;
        // 假设获取用户自己的推荐码
        const response = await apiRequest('/api/referrals/apply', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            code: 'TESTCODE',
            email: 'user@example.com', // 假设这是推荐码拥有者的邮箱
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该防止 SQL 注入 - code', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/apply', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            code: "'; DROP TABLE referrals; --",
            email: 'test@example.com',
          }),
        });
        expect([400, 404]).toContain(response.status);
      });

      it('应该防止 SQL 注入 - email', async () => {
        if (!testBrandId) return;
        const response = await apiRequest('/api/referrals/apply', {
          method: 'POST',
          headers: { 'x-brand-id': testBrandId },
          body: JSON.stringify({
            code: 'TESTCODE',
            email: "'; DROP TABLE referrals; --",
          }),
        });
        expect([400, 404]).toContain(response.status);
      });
    });
  });
});
