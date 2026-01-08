# 验证购物车

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/cart/validate` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/orders.ts` |

## 描述

验证购物车中的商品是否有效（在售、有库存、价格正确）。

## 数据来源

```
主表: products
过滤: brand_id = 当前品牌, id IN (购物车商品ID列表)
验证: is_active, stock_status, price
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 商品信息 | `products` | `WHERE brand_id = ? AND id IN (?)` |
| 库存状态 | `products` | `stock_status`, `stock_quantity` 字段 |
| 当前价格 | `products` | `price` 字段 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `items` | array | 是 | 购物车商品列表 |

### Item 对象

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `productId` | string | 是 | 产品 ID |
| `quantity` | number | 是 | 数量 |

## 请求示例

```json
{
  "items": [
    {"productId": "uuid1", "quantity": 2},
    {"productId": "uuid2", "quantity": 1}
  ]
}
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `valid` | boolean | 购物车是否全部有效 |
| `items` | array | 验证后的商品列表 |

### ValidatedItem 对象

| 字段 | 类型 | 描述 | 来源 |
|------|------|------|------|
| `productId` | string | 产品 ID | 请求参数 |
| `quantity` | number | 数量 | 请求参数 |
| `valid` | boolean | 该商品是否有效 | 计算: `is_active` AND `stock_status` |
| `currentPrice` | number | 当前实际价格 | `products.price` |
| `stockStatus` | string | 库存状态 | `products.stock_status` |
| `stockQuantity` | number | 可用库存 | `products.stock_quantity` |

## 响应示例

```json
{
  "success": true,
  "valid": true,
  "items": [
    {
      "productId": "uuid1",
      "quantity": 2,
      "valid": true,
      "currentPrice": 99.00,
      "stockStatus": "in_stock",
      "stockQuantity": 50
    }
  ]
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Cart is empty | 购物车为空 |
| 500 | Failed to validate cart | 服务器错误 |
