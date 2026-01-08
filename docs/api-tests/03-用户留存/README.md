# 用户留存模块测试

## 模块概述

用户留存模块包含积分系统、会员等级和推荐有礼相关的 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | 积分余额 | GET | `/api/points/balance` | P0 |
| 2 | 积分历史 | GET | `/api/points/history` | P1 |
| 3 | 积分规则 | GET | `/api/points/rules` | P1 |
| 4 | 赚取积分 | POST | `/api/points/earn` | P0 |
| 5 | 兑换积分 | POST | `/api/points/redeem` | P0 |
| 6 | 会员等级列表 | GET | `/api/membership/levels` | P1 |
| 7 | 客户会员信息 | GET | `/api/membership/customer` | P0 |
| 8 | 获取推荐码 | GET | `/api/referrals/code` | P1 |
| 9 | 推荐统计 | GET | `/api/referrals/stats` | P1 |
| 10 | 应用推荐码 | POST | `/api/referrals/apply` | P0 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. 会员等级配置
INSERT INTO membership_levels (id, brand_id, name, level_order, min_points, discount_rate, benefits, is_active) VALUES
  ('level-001', 'brand-test-001', '普通会员', 1, 0, 0, '{"free_shipping_threshold": 99}', true),
  ('level-002', 'brand-test-001', '银卡会员', 2, 1000, 5, '{"free_shipping_threshold": 49, "birthday_points": 100}', true),
  ('level-003', 'brand-test-001', '金卡会员', 3, 5000, 10, '{"free_shipping_threshold": 0, "birthday_points": 200}', true),
  ('level-004', 'brand-test-001', '钻石会员', 4, 20000, 15, '{"free_shipping_threshold": 0, "birthday_points": 500, "exclusive_products": true}', true);

-- 2. 积分规则配置
INSERT INTO points_rules (id, brand_id, action, points, description, is_active) VALUES
  ('rule-001', 'brand-test-001', 'register', 100, '注册送积分', true),
  ('rule-002', 'brand-test-001', 'order', 1, '消费1元得1积分', true),
  ('rule-003', 'brand-test-001', 'review', 50, '评论送积分', true),
  ('rule-004', 'brand-test-001', 'referral', 200, '推荐好友送积分', true),
  ('rule-005', 'brand-test-001', 'daily_login', 5, '每日签到', true);

-- 3. 测试客户 (不同积分等级)
INSERT INTO customers (id, brand_id, email, name, total_points, current_level_id) VALUES
  ('cust-points-001', 'brand-test-001', 'newuser@test.com', '新用户', 0, 'level-001'),
  ('cust-points-002', 'brand-test-001', 'silver@test.com', '银卡用户', 1500, 'level-002'),
  ('cust-points-003', 'brand-test-001', 'gold@test.com', '金卡用户', 8000, 'level-003'),
  ('cust-points-004', 'brand-test-001', 'diamond@test.com', '钻石用户', 25000, 'level-004');

-- 4. 积分记录
INSERT INTO customer_points (id, customer_id, brand_id, points, action, description, status, expires_at) VALUES
  ('cp-001', 'cust-points-002', 'brand-test-001', 100, 'register', '注册奖励', 'active', null),
  ('cp-002', 'cust-points-002', 'brand-test-001', 500, 'order', '订单 #1001 奖励', 'active', '2025-12-31'),
  ('cp-003', 'cust-points-002', 'brand-test-001', -200, 'redeem', '兑换优惠券', 'used', null),
  ('cp-004', 'cust-points-002', 'brand-test-001', 100, 'order', '即将过期', 'active', '2025-01-15');

-- 5. 推荐码
INSERT INTO referral_codes (id, customer_id, brand_id, code, uses_count, is_active) VALUES
  ('ref-001', 'cust-points-003', 'brand-test-001', 'GOLD2025', 5, true),
  ('ref-002', 'cust-points-004', 'brand-test-001', 'VIP888', 20, true);

-- 6. 推荐记录
INSERT INTO referrals (id, brand_id, referrer_id, referred_id, code, status, points_awarded) VALUES
  ('referral-001', 'brand-test-001', 'cust-points-003', 'cust-points-001', 'GOLD2025', 'completed', 200);
```

#### 数据验证

- [ ] 会员等级按 `level_order` 正确排序
- [ ] 积分规则覆盖各种场景
- [ ] 测试客户分布在不同等级
- [ ] 积分记录包含不同状态 (active/used/expired)
- [ ] 包含即将过期的积分用于测试
- [ ] 推荐码和推荐记录关联正确

### 2. 环境配置

#### 请求头准备

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001",
  "Authorization": "Bearer <customer_token>"
}
```

#### 认证 Token 准备

```bash
# 为不同等级客户获取 Token
curl -X POST /api/auth/login -d '{"email": "silver@test.com", "password": "test123"}'
```

### 3. 时间相关准备

#### 积分过期测试

- 准备一条 `expires_at` 为当前时间之前的记录 (已过期)
- 准备一条 `expires_at` 为未来 7 天内的记录 (即将过期)
- 准备一条 `expires_at` 为 null 的记录 (永不过期)

#### 定时任务 Mock

```javascript
// Mock 当前时间用于过期测试
jest.useFakeTimers();
jest.setSystemTime(new Date('2025-01-08'));
```

### 4. 测试账号准备

| 角色 | 邮箱 | 积分 | 等级 | 用途 |
|------|------|------|------|------|
| 新用户 | newuser@test.com | 0 | 普通 | 首次积分获取 |
| 银卡用户 | silver@test.com | 1500 | 银卡 | 积分兑换测试 |
| 金卡用户 | gold@test.com | 8000 | 金卡 | 推荐功能测试 |
| 钻石用户 | diamond@test.com | 25000 | 钻石 | 高级权益测试 |

## 测试场景

### 积分余额测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 查询余额 | customer_id | 返回可用余额、待生效、即将过期 |
| 新用户余额 | 新注册用户 | 余额为 0 |
| 过期积分 | 有过期积分的用户 | 不计入可用余额 |

### 赚取积分测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 注册奖励 | action=register | 增加 100 积分 |
| 订单奖励 | action=order, amount=100 | 增加 100 积分 |
| 评论奖励 | action=review | 增加 50 积分 |
| 重复领取 | 同一 action 重复 | 400 已领取 |
| 每日签到 | action=daily_login | 每天仅一次 |

### 兑换积分测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 正常兑换 | points=500 | 扣除积分，返回优惠券 |
| 余额不足 | points > 可用余额 | 400 余额不足 |
| 负数积分 | points=-100 | 400 参数错误 |
| 最低兑换 | points < 最低门槛 | 400 未达最低要求 |

### 会员等级测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 等级列表 | 无参数 | 返回所有等级及权益 |
| 客户等级 | customer_id | 返回当前等级和进度 |
| 升级判断 | 积分达标 | 自动升级 |
| 降级判断 | 年度积分不足 | 降级提醒 |

### 推荐系统测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 获取推荐码 | customer_id | 返回唯一推荐码 |
| 应用推荐码 | 有效推荐码 | 双方获得积分 |
| 无效推荐码 | 不存在的码 | 400 无效 |
| 自己推荐自己 | 自己的推荐码 | 400 不能推荐自己 |
| 已被推荐 | 已有推荐记录 | 400 已使用过推荐码 |

## 测试命令

```bash
# 运行用户留存模块测试
npm run test:api -- --grep "03-用户留存"

# 仅运行积分相关测试
npm run test:api -- --grep "points"

# 仅运行会员相关测试
npm run test:api -- --grep "membership"

# 仅运行推荐相关测试
npm run test:api -- --grep "referrals"
```

## 注意事项

1. **积分一致性**: 确保 `customer_points` 表的 SUM 与 `customers.total_points` 一致
2. **并发扣款**: 测试同时兑换积分的并发场景
3. **过期处理**: 测试定时任务对过期积分的处理
4. **等级计算**: 升降级逻辑需要考虑年度累计
5. **推荐防刷**: 同 IP/设备的推荐限制
