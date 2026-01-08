# 创建订单

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/orders/create` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/orders.ts` |

## 描述

创建订单并生成 Stripe PaymentIntent，返回 client_secret 用于前端完成支付。

## 数据来源

```
写入表: orders, customers
读取表: products (验证价格), brands (获取设置)
外部服务: Stripe API (创建 PaymentIntent)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 验证商品 | `products` | 读取价格、库存状态 |
| 获取运费设置 | `brands.settings` | `shipping_default_cost`, `shipping_free_threshold` |
| 创建/更新客户 | `customers` | UPSERT by `brand_id + email` |
| 创建订单 | `orders` | INSERT 订单记录 |
| 创建支付 | Stripe API | `paymentIntents.create()` |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `customer` | object | 是 | 客户信息 |
| `shippingAddress` | object | 是 | 收货地址 |
| `items` | array | 是 | 购物车商品 |

### Customer 对象

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `email` | string | 是 | 邮箱 |
| `name` | string | 是 | 姓名 |
| `phone` | string | 否 | 电话 |

### ShippingAddress 对象

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `line1` | string | 是 | 地址行1 |
| `line2` | string | 否 | 地址行2 |
| `city` | string | 是 | 城市 |
| `state` | string | 是 | 州/省 |
| `postal_code` | string | 是 | 邮编 |
| `country` | string | 是 | 国家 |

### Item 对象

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `productId` | string | 是 | 产品 ID |
| `quantity` | number | 是 | 数量 |

## 请求示例

```json
{
  "customer": {
    "email": "john@example.com",
    "name": "John Doe",
    "phone": "+1234567890"
  },
  "shippingAddress": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US"
  },
  "items": [
    {"productId": "uuid1", "quantity": 2}
  ]
}
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `orderId` | string | 订单 ID |
| `clientSecret` | string | Stripe PaymentIntent client_secret |

## 响应示例

```json
{
  "success": true,
  "orderId": "uuid",
  "clientSecret": "pi_xxx_secret_xxx"
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Missing required checkout fields | 缺少必填字段 |
| 400 | Cart is empty | 购物车为空 |
| 400 | Some items are no longer available | 商品不可用 |
| 500 | Failed to create order | 创建订单失败 |
| 500 | Failed to create payment | 创建支付失败 |

## 说明

1. 价格在服务端重新计算，不使用前端传入的价格
2. 运费根据品牌设置计算（满额免运费）
3. 前端使用 `clientSecret` 调用 Stripe.js 完成支付
