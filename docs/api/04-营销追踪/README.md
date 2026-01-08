# 04-营销追踪

营销追踪功能 API，对应功能文档第9章"流量与转化"。

## 接口列表

### UTM 追踪 (tracking.ts)
- [01-记录 UTM](./01-utm-record.md) - `POST /api/tracking/utm`

### 弃购挽回 (tracking.ts)
- [02-更新购物车追踪](./02-cart-update.md) - `POST /api/tracking/cart`

### Pixel 事件 (tracking.ts)
- [03-记录 Pixel 事件](./03-pixel-record.md) - `POST /api/tracking/pixel`

### 服务端转化 (conversions.ts)
- [04-发送转化事件](./04-conversions-send.md) - `POST /api/conversions/send`

### 邮件序列 (email-sequences.ts)
- [05-获取邮件序列](./05-email-sequences-list.md) - `GET /api/email/sequences`

### 退订管理 (tracking.ts)
- [06-处理退订](./06-unsubscribe-process.md) - `POST /api/tracking/unsubscribe`
