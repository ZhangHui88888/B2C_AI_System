# 第9阶段：流量与转化

> 广告追踪、邮件营销与用户留存系统

---

## 📋 功能模块

### 9.1 广告追踪

| 功能 | 状态 | 说明 |
|------|------|------|
| Facebook Pixel | ✅ | 客户端 + 服务端 |
| Google Ads 转化 | ✅ | gtag.js |
| TikTok Pixel | ✅ | 客户端 + 服务端 |
| Pinterest Tag | ✅ | 客户端 + 服务端 |
| 服务端事件 | ✅ | Conversions API |

### 9.2 UTM 追踪

| 功能 | 状态 | 说明 |
|------|------|------|
| UTM 参数解析 | ✅ | 自动解析 |
| 来源归因存储 | ✅ | utm_tracking 表 |
| 来源报表 | ✅ | getAttributionReport |

### 9.3 邮件营销

| 功能 | 状态 | 说明 |
|------|------|------|
| 订单确认邮件 | ✅ | 自动发送 |
| 发货通知邮件 | ✅ | 自动发送 |
| 弃购挽回 | ✅ | abandoned_carts + 邮件序列 |
| 欢迎邮件序列 | ✅ | 多步骤自动化 |
| 复购提醒 | ✅ | repurchase_reminders |
| 退订管理 | ✅ | email_subscriptions |

### 9.4 优惠券系统

| 功能 | 状态 | 说明 |
|------|------|------|
| 优惠券创建 | ✅ | 百分比/固定金额 |
| 优惠码生成 | ✅ | 自动/手动 |
| 优惠码验证 | ✅ | 实时验证 |
| 使用统计 | ✅ | 使用次数/金额 |

### 9.5 用户留存

| 功能 | 状态 | 说明 |
|------|------|------|
| 积分系统 | ✅ | 消费得积分 |
| 会员等级 | ✅ | 等级权益 |
| 推荐有礼 | ✅ | 双向奖励 |

---

## 🗂️ 相关文件

### 后端 API
- `worker/src/routes/tracking.ts` - UTM/弃购追踪
- `worker/src/routes/conversions.ts` - 服务端转化
- `worker/src/routes/email-sequences.ts` - 邮件序列
- `worker/src/routes/points.ts` - 积分系统
- `worker/src/routes/membership.ts` - 会员等级
- `worker/src/routes/referrals.ts` - 推荐有礼

### 工具类
- `worker/src/utils/conversions-api.ts` - Conversions API

### 数据库
- `docs/database/013_marketing_tracking.sql` - 营销追踪表
- `docs/database/014_email_sequences.sql` - 邮件序列表
- `docs/database/017_user_retention.sql` - 用户留存表

### 前端组件
- `frontend/src/lib/tracking.ts` - 追踪库
- `frontend/src/components/TrackingScripts.astro` - Pixel 脚本

### 前端页面
- `frontend/src/pages/admin/marketing/` - 营销管理
- `frontend/src/pages/admin/marketing/pixels.astro` - Pixel 配置
- `frontend/src/pages/admin/marketing/utm.astro` - UTM 报表
- `frontend/src/pages/admin/marketing/emails.astro` - 邮件序列

---

## 🔧 Pixel 配置

### 前端脚本

```astro
<!-- TrackingScripts.astro -->
<script>
  // Facebook Pixel
  !function(f,b,e,v,n,t,s)...
  fbq('init', '{FB_PIXEL_ID}');
  fbq('track', 'PageView');
  
  // TikTok Pixel
  !function(w,d,t)...
  ttq.load('{TIKTOK_PIXEL_ID}');
  ttq.page();
</script>
```

### 服务端事件

```typescript
// POST /api/conversions/facebook
{
  "event_name": "Purchase",
  "event_time": 1703721600,
  "user_data": {
    "em": "hashed_email",
    "ph": "hashed_phone"
  },
  "custom_data": {
    "currency": "EUR",
    "value": 99.00,
    "content_ids": ["product-1"]
  }
}
```

---

## 📧 邮件序列

### 弃购挽回序列

```
弃购发生
    │
    ├── 1小时后 → 邮件1：温馨提醒
    │
    ├── 24小时后 → 邮件2：限时优惠
    │
    └── 72小时后 → 邮件3：最后机会
```

### 欢迎邮件序列

```
新用户注册
    │
    ├── 立即 → 邮件1：欢迎 + 首单优惠
    │
    ├── 3天后 → 邮件2：品牌故事
    │
    └── 7天后 → 邮件3：热销推荐
```

---

## 🎁 积分规则

| 行为 | 积分 |
|------|------|
| 首次注册 | +100 |
| 完成订单 | +消费金额 |
| 写评价 | +50 |
| 分享商品 | +20 |
| 推荐好友 | +200 |

### 会员等级

| 等级 | 累计消费 | 权益 |
|------|----------|------|
| 普通 | €0+ | 基础积分 |
| 银卡 | €200+ | 1.2x 积分 |
| 金卡 | €500+ | 1.5x 积分 + 免运费 |
| 钻石 | €1000+ | 2x 积分 + 专属折扣 |
