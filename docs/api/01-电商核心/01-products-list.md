# 获取产品列表

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/products/list` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/products.ts` |

## 描述

获取当前品牌的产品列表，支持分类筛选、搜索、排序和分页。

## 数据来源

```
主表: products
关联: categories (通过 category_id 外键)
过滤: brand_id = 当前品牌, is_active = true
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 产品列表 | `products` | `SELECT * FROM products WHERE brand_id = ? AND is_active = true` |
| 分类信息 | `categories` | JOIN `categories` ON `products.category_id = categories.id` |
| 分类ID解析 | `categories` | 通过 `category` slug 查询 `categories.id` |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 默认值 | 描述 | 对应字段 |
|------|------|------|--------|------|----------|
| `category` | string | 否 | - | 分类 slug | `categories.slug` -> `products.category_id` |
| `page` | number | 否 | 1 | 页码 | 分页计算 |
| `pageSize` | number | 否 | 12 | 每页数量 | 分页计算 |
| `sort` | string | 否 | `newest` | 排序方式 | `products.price` / `products.created_at` |
| `search` | string | 否 | - | 搜索关键词 | `products.name` / `products.description` (ILIKE) |
| `featured` | boolean | 否 | - | 仅显示推荐产品 | `products.is_featured` |
| `price_min` | number | 否 | - | 最低价格 | `products.price >= ?` |
| `price_max` | number | 否 | - | 最高价格 | `products.price <= ?` |

### 排序方式 (sort)

| 值 | 描述 |
|----|------|
| `newest` | 最新上架 |
| `price_asc` | 价格从低到高 |
| `price_desc` | 价格从高到低 |
| `featured` | 推荐优先 |
| `best_selling` | 畅销优先 |

## 请求示例

```json
{
  "category": "electronics",
  "page": 1,
  "pageSize": 12,
  "sort": "price_asc",
  "search": "phone",
  "price_min": 100,
  "price_max": 500
}
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `products` | array | 产品列表 |
| `pagination` | object | 分页信息 |
| `total` | number | 总数量 |

### Product 对象

| 字段 | 类型 | 描述 | 来源 |
|------|------|------|------|
| `id` | string | 产品 ID | `products.id` |
| `name` | string | 产品名称 | `products.name` |
| `slug` | string | URL 标识 | `products.slug` |
| `price` | number | 价格 | `products.price` |
| `compare_price` | number | 原价 | `products.compare_price` |
| `main_image_url` | string | 主图 URL | `products.main_image_url` |
| `is_featured` | boolean | 是否推荐 | `products.is_featured` |
| `categories` | object | 所属分类 | JOIN `categories` |

## 响应示例

```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "name": "iPhone 15",
      "slug": "iphone-15",
      "price": 999.00,
      "compare_price": 1099.00,
      "main_image_url": "https://...",
      "is_featured": true,
      "categories": {
        "name": "Electronics",
        "slug": "electronics"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 100,
    "totalPages": 9
  },
  "total": 100
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Brand context missing | 缺少品牌上下文 |
| 500 | Failed to fetch products | 服务器错误 |
