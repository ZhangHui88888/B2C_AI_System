# 更新购物车追踪

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/tracking/cart` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/tracking.ts` |

## 描述

更新购物车追踪数据，用于弃购挽回功能。

## 数据来源

```
写入表: abandoned_carts
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| UPSERT 购物车 | `abandoned_carts` | `ON CONFLICT (brand_id, session_id) DO UPDATE` |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `session_id` | string | 是 | 会话 ID |
| `email` | string | 否 | 客户邮箱 |
| `items` | array | 是 | 购物车商品 |
| `total` | number | 否 | 购物车总额 |

### CartItem 对象

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `product_id` | string | 是 | 产品 ID |
| `name` | string | 是 | 产品名称 |
| `price` | number | 是 | 单价 |
| `quantity` | number | 是 | 数量 |
| `image_url` | string | 否 | 产品图片 |

## 请求示例

```json
{
  "session_id": "uuid",
  "email": "customer@example.com",
  "items": [
    {
      "product_id": "uuid1",
      "name": "iPhone 15",
      "price": 999.00,
      "quantity": 1,
      "image_url": "https://..."
    }
  ],
  "total": 999.00
}
```

## 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "session_id": "session-uuid",
    "email": "customer@example.com",
    "status": "active",
    "created_at": "2024-01-08T12:00:00Z"
  }
}
```

## 说明

1. 前端每次购物车变更时调用此接口
2. 如果提供邮箱，可用于发送弃购挽回邮件
3. 购物车状态：`active` / `recovered` / `converted`
