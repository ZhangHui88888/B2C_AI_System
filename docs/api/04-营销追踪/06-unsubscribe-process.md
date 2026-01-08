# 处理退订

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/tracking/unsubscribe` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |

## 描述

处理邮件退订请求。

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `token` | string | 是 | 退订令牌 |
| `preferences` | object | 否 | 偏好设置 |

### Preferences 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `marketing` | boolean | 营销邮件 |
| `order_updates` | boolean | 订单更新 |
| `newsletter` | boolean | 新闻邮件 |

## 请求示例

```json
{
  "token": "unsubscribe-token",
  "preferences": {
    "marketing": false,
    "order_updates": true,
    "newsletter": false
  }
}
```

## 响应示例

```json
{
  "success": true,
  "message": "Subscription preferences updated"
}
```
