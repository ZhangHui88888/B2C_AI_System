# 发送服务端转化事件

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/conversions/send` |
| **方法** | `POST` |
| **认证** | 内部调用 |
| **权限** | 系统 |
| **路由文件** | `worker/src/routes/conversions.ts` |

## 描述

将转化事件发送到各广告平台的 Conversions API（Facebook CAPI、Google Ads、TikTok、Pinterest）。

## 数据来源

```
读取表: tracking_pixels_config (获取平台配置)
写入表: conversion_events (记录转化事件)
外部服务: Facebook CAPI, Google Ads API, TikTok Events API, Pinterest Conversions API
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| Pixel 配置 | `tracking_pixels_config` | `WHERE brand_id = ?` |
| 记录转化 | `conversion_events` | INSERT 事件记录及各平台发送结果 |
| 发送 FB | Facebook CAPI | `POST /v18.0/{pixel_id}/events` |
| 发送 Google | Google Ads API | Enhanced Conversions |
| 发送 TikTok | TikTok Events API | `POST /open_api/v1.3/pixel/track/` |
| 发送 Pinterest | Pinterest API | `POST /conversion_events` |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `event_name` | string | 是 | 事件名称 |
| `event_data` | object | 是 | 事件数据 |
| `user_data` | object | 是 | 用户数据 |
| `platforms` | array | 否 | 目标平台 |

### EventData 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `value` | number | 金额 |
| `currency` | string | 货币 |
| `order_id` | string | 订单 ID |
| `content_ids` | array | 产品 ID |
| `num_items` | number | 商品数量 |

### UserData 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `email` | string | 邮箱 (哈希) |
| `phone` | string | 电话 (哈希) |
| `city` | string | 城市 |
| `country` | string | 国家 |
| `client_ip_address` | string | IP 地址 |
| `fbc` | string | Facebook click ID |
| `fbp` | string | Facebook browser ID |

## 请求示例

```json
{
  "event_name": "Purchase",
  "event_data": {
    "value": 99.99,
    "currency": "USD",
    "order_id": "ORD-001",
    "content_ids": ["product-uuid"]
  },
  "user_data": {
    "email": "john@example.com",
    "country": "US"
  },
  "platforms": ["facebook", "google", "tiktok", "pinterest"]
}
```

## 响应示例

```json
{
  "success": true,
  "results": {
    "facebook": {"success": true, "events_received": 1},
    "google": {"success": true},
    "tiktok": {"success": true},
    "pinterest": {"success": true}
  }
}
```

## 说明

1. 用户数据会在发送前进行 SHA-256 哈希处理
2. 此接口通常由 Stripe Webhook 自动调用
3. 转化事件会记录到数据库用于归因分析
