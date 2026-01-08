# 获取订单详情

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/orders/:id` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 (需验证邮箱) |
| **路由文件** | `worker/src/routes/orders.ts` |

## 描述

根据订单 ID 和客户邮箱获取订单详情。

## 数据来源

```
主表: orders
过滤: brand_id = 当前品牌, id = 参数值, customer_email = 查询参数
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 订单信息 | `orders` | `WHERE brand_id = ? AND id = ? AND customer_email = ?` |
| 订单商品 | `orders.items` | JSONB 字段，存储订单快照 |

## 路径参数

| 参数 | 类型 | 必填 | 描述 | 对应字段 |
|------|------|------|------|----------|
| `id` | string | 是 | 订单 ID | `orders.id` |

## 查询参数

| 参数 | 类型 | 必填 | 描述 | 对应字段 |
|------|------|------|------|----------|
| `email` | string | 是 | 客户邮箱 | `orders.customer_email` |

## 请求示例

```
GET /api/orders/uuid?email=john@example.com
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `order` | object | 订单详情 |

### Order 对象

| 字段 | 类型 | 描述 | 来源 |
|------|------|------|------|
| `id` | string | 订单 ID | `orders.id` |
| `order_number` | string | 订单号 | `orders.order_number` |
| `customer_email` | string | 客户邮箱 | `orders.customer_email` |
| `customer_name` | string | 客户姓名 | `orders.customer_name` |
| `shipping_address` | object | 收货地址 | `orders.shipping_address` (JSONB) |
| `items` | array | 订单商品 | `orders.items` (JSONB) |
| `subtotal` | number | 商品小计 | `orders.subtotal` |
| `shipping_cost` | number | 运费 | `orders.shipping_cost` |
| `total` | number | 订单总额 | `orders.total` |
| `status` | string | 订单状态 | `orders.status` (order_status_enum) |
| `created_at` | string | 创建时间 | `orders.created_at` |

### 订单状态 (status)

| 值 | 描述 |
|----|------|
| `pending` | 待支付 |
| `paid` | 已支付 |
| `shipped` | 已发货 |
| `delivered` | 已送达 |
| `cancelled` | 已取消 |
| `refunded` | 已退款 |

## 响应示例

```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "order_number": "ORD-20240108-001",
    "customer_email": "john@example.com",
    "customer_name": "John Doe",
    "items": [
      {
        "product_id": "uuid1",
        "name": "iPhone 15",
        "quantity": 1,
        "unit_price": 999.00,
        "line_total": 999.00
      }
    ],
    "subtotal": 999.00,
    "shipping_cost": 0,
    "total": 999.00,
    "status": "paid",
    "created_at": "2024-01-08T12:00:00Z"
  }
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Order ID and email are required | 缺少必填参数 |
| 404 | Order not found | 订单不存在或邮箱不匹配 |
