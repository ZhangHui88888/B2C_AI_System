# 记录 UTM 参数

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/tracking/utm` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/tracking.ts` |

## 描述

记录用户访问的 UTM 参数，用于来源归因分析。

## 数据来源

```
写入表: utm_tracking
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 创建记录 | `utm_tracking` | INSERT UTM 追踪记录 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `session_id` | string | 是 | 会话 ID |
| `utm_source` | string | 否 | 流量来源 |
| `utm_medium` | string | 否 | 媒介类型 |
| `utm_campaign` | string | 否 | 活动名称 |
| `utm_term` | string | 否 | 关键词 |
| `utm_content` | string | 否 | 内容标识 |
| `referrer` | string | 否 | 来源 URL |
| `landing_page` | string | 否 | 着陆页 |
| `device_type` | string | 否 | 设备类型 |

## 请求示例

```json
{
  "session_id": "uuid",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "summer_sale",
  "referrer": "https://google.com",
  "landing_page": "/products",
  "device_type": "mobile"
}
```

## 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "session_id": "session-uuid",
    "utm_source": "google",
    "utm_medium": "cpc",
    "created_at": "2024-01-08T12:00:00Z"
  }
}
```
