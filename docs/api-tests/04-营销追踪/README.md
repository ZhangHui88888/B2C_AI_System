# 营销追踪模块测试

## 模块概述

营销追踪模块包含 UTM 追踪、弃购挽回、Pixel 事件和服务端转化等 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | 记录 UTM | POST | `/api/tracking/utm` | P0 |
| 2 | 更新购物车追踪 | POST | `/api/tracking/cart` | P0 |
| 3 | 记录 Pixel 事件 | POST | `/api/tracking/pixel` | P0 |
| 4 | 发送转化事件 | POST | `/api/conversions/send` | P0 |
| 5 | 获取邮件序列 | GET | `/api/email-sequences` | P1 |
| 6 | 处理退订 | POST | `/api/unsubscribe` | P1 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. Pixel 配置
INSERT INTO tracking_pixels_config (id, brand_id, platform, pixel_id, access_token, is_active) VALUES
  ('pixel-001', 'brand-test-001', 'facebook', 'fb_pixel_test_123', 'fb_access_token_test', true),
  ('pixel-002', 'brand-test-001', 'google', 'AW-TEST123', 'google_token_test', true),
  ('pixel-003', 'brand-test-001', 'tiktok', 'tiktok_pixel_test', 'tiktok_token_test', true),
  ('pixel-004', 'brand-test-001', 'pinterest', 'pinterest_tag_test', 'pinterest_token_test', true);

-- 2. 邮件序列配置
INSERT INTO email_sequences (id, brand_id, name, trigger_type, delay_minutes, template_id, is_active) VALUES
  ('seq-001', 'brand-test-001', '弃购挽回-1小时', 'abandoned_cart', 60, 'tpl-cart-1', true),
  ('seq-002', 'brand-test-001', '弃购挽回-24小时', 'abandoned_cart', 1440, 'tpl-cart-2', true),
  ('seq-003', 'brand-test-001', '欢迎邮件', 'welcome', 0, 'tpl-welcome', true),
  ('seq-004', 'brand-test-001', '复购提醒-30天', 'repurchase', 43200, 'tpl-repurchase', true);

-- 3. 测试弃购记录
INSERT INTO abandoned_carts (id, brand_id, session_id, email, items, total, created_at, reminder_sent) VALUES
  ('cart-001', 'brand-test-001', 'session-abc-001', 'cart@test.com', 
   '[{"product_id": "prod-001", "name": "测试手机A", "price": 999, "quantity": 1}]', 
   999.00, NOW() - INTERVAL '2 hours', false),
  ('cart-002', 'brand-test-001', 'session-abc-002', null, 
   '[{"product_id": "prod-002", "name": "测试手机B", "price": 1299, "quantity": 1}]', 
   1299.00, NOW() - INTERVAL '1 hour', false);

-- 4. UTM 追踪记录
INSERT INTO utm_tracking (id, brand_id, session_id, utm_source, utm_medium, utm_campaign, landing_page) VALUES
  ('utm-001', 'brand-test-001', 'session-utm-001', 'google', 'cpc', 'spring_sale', '/products/test-phone-a');

-- 5. 退订名单
INSERT INTO email_unsubscribes (id, brand_id, email, reason, unsubscribed_at) VALUES
  ('unsub-001', 'brand-test-001', 'unsubscribed@test.com', 'too_many_emails', NOW());
```

#### 数据验证

- [ ] Pixel 配置覆盖四个主要平台 (FB/Google/TikTok/Pinterest)
- [ ] 邮件序列包含不同触发类型
- [ ] 弃购记录包含有邮箱和无邮箱的情况
- [ ] UTM 记录用于归因测试
- [ ] 退订名单用于过滤测试

### 2. 环境配置

#### 请求头准备

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001",
  "x-session-id": "test-session-001",
  "x-forwarded-for": "1.2.3.4",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
}
```

#### 外部服务 API Keys

```bash
# .env.test
# Facebook Conversions API
FB_PIXEL_ID=test_pixel_id
FB_ACCESS_TOKEN=test_access_token

# Google Ads
GOOGLE_ADS_CUSTOMER_ID=123-456-7890
GOOGLE_ADS_CONVERSION_ACTION_ID=test_action

# TikTok Events API
TIKTOK_PIXEL_ID=test_tiktok_pixel
TIKTOK_ACCESS_TOKEN=test_tiktok_token

# Pinterest Conversions API
PINTEREST_AD_ACCOUNT_ID=test_pinterest_account
PINTEREST_ACCESS_TOKEN=test_pinterest_token

# 邮件服务
RESEND_API_KEY=re_test_xxx
```

### 3. 外部服务 Mock

#### Facebook Conversions API Mock

```javascript
const fbMock = {
  sendEvent: async (pixelId, events) => ({
    events_received: events.length,
    fbtrace_id: 'test_trace_123'
  })
};
```

#### Google Ads API Mock

```javascript
const googleAdsMock = {
  uploadConversion: async (customerId, conversion) => ({
    results: [{ conversionAction: 'customers/123/conversionActions/456' }]
  })
};
```

#### TikTok Events API Mock

```javascript
const tiktokMock = {
  trackEvent: async (pixelCode, events) => ({
    code: 0,
    message: 'OK'
  })
};
```

#### Pinterest Conversions API Mock

```javascript
const pinterestMock = {
  sendConversionEvent: async (adAccountId, events) => ({
    num_events_received: events.length,
    num_events_processed: events.length
  })
};
```

#### Resend (邮件) Mock

```javascript
const resendMock = {
  emails: {
    send: async (params) => ({
      id: 'email_test_123'
    })
  }
};
```

### 4. 测试工具准备

| 工具 | 用途 |
|------|------|
| **nock** | HTTP 请求 Mock |
| **msw** | Service Worker Mock |
| **Webhook.site** | 测试 Webhook 回调 |

## 测试场景

### UTM 追踪测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 完整 UTM | 所有 UTM 参数 | 记录成功 |
| 部分 UTM | 仅 utm_source | 记录成功 |
| 无 UTM | 空参数 | 不创建记录 |
| 重复 session | 同一 session_id | 更新记录 |

### 弃购追踪测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 新建购物车 | 首次提交 | 创建记录 |
| 更新购物车 | 同 session 更新 | UPSERT 更新 |
| 添加邮箱 | 后续填入邮箱 | 更新 email 字段 |
| 清空购物车 | items: [] | 删除或标记完成 |

### Pixel 事件测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| PageView | event_name=PageView | 记录成功 |
| ViewContent | 产品浏览事件 | 包含产品信息 |
| AddToCart | 加购事件 | 包含商品和价格 |
| Purchase | 购买事件 | 包含订单信息 |

### 服务端转化测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 全平台发送 | platforms: all | 发送到 4 个平台 |
| 指定平台 | platforms: ['facebook'] | 仅发送 FB |
| 平台未配置 | 未启用的平台 | 跳过该平台 |
| API 失败 | Mock 失败响应 | 记录失败状态 |
| 部分成功 | 部分平台失败 | 记录各平台状态 |

### 邮件序列测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 弃购 1 小时 | 购物车创建 1 小时后 | 触发邮件 |
| 已退订用户 | 在退订名单中 | 不发送 |
| 已购买 | 购物车已转化 | 不发送挽回邮件 |

### 退订处理测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 正常退订 | 有效邮箱 | 加入退订名单 |
| 已退订 | 已在名单中 | 返回成功 (幂等) |
| 无效邮箱 | 格式错误 | 400 错误 |

## 测试命令

```bash
# 运行营销追踪模块测试
npm run test:api -- --grep "04-营销追踪"

# 仅运行 UTM 相关测试
npm run test:api -- --grep "utm"

# 仅运行转化相关测试
npm run test:api -- --grep "conversions"

# 运行带 Mock 的测试
npm run test:api -- --grep "04-营销追踪" --mock-external
```

## 注意事项

1. **API 调用成本**: 测试环境必须使用 Mock，避免真实 API 调用
2. **用户隐私**: 测试数据不要使用真实用户信息
3. **事件去重**: 各平台对重复事件的处理方式不同
4. **时区处理**: 事件时间戳需要注意时区转换
5. **重试机制**: 测试 API 失败后的重试逻辑
6. **退订合规**: 确保退订后不再发送任何邮件 (CAN-SPAM 合规)
