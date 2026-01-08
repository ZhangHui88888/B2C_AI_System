# 记录 Pixel 事件

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/tracking/pixel` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/tracking.ts` |

## 描述

记录广告平台 Pixel 事件，用于转化追踪分析。

## 数据来源

```
写入表: pixel_events
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 创建事件 | `pixel_events` | INSERT Pixel 事件记录 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `event_name` | string | 是 | 事件名称 |
| `event_data` | object | 否 | 事件数据 |
| `session_id` | string | 否 | 会话 ID |

### 标准事件名称

| 事件 | 描述 |
|------|------|
| `PageView` | 页面浏览 |
| `ViewContent` | 查看内容 |
| `AddToCart` | 加入购物车 |
| `InitiateCheckout` | 发起结账 |
| `Purchase` | 购买完成 |
| `Search` | 搜索 |
| `Lead` | 潜在客户 |

## 请求示例

```json
{
  "event_name": "Purchase",
  "event_data": {
    "value": 99.99,
    "currency": "USD",
    "content_ids": ["uuid1"],
    "content_type": "product",
    "num_items": 1
  },
  "session_id": "uuid"
}
```

## 响应示例

```json
{
  "success": true
}
```
