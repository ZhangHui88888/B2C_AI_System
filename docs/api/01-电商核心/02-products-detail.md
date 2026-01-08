# 获取产品详情

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/products/:slug` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/products.ts` |

## 描述

根据 slug 获取单个产品的详细信息，包含关联产品推荐。

## 数据来源

```
主表: products
关联: categories (通过 category_id 外键)
相关产品: products (同 category_id 的其他产品)
过滤: brand_id = 当前品牌, slug = 参数值, is_active = true
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 产品详情 | `products` | `WHERE brand_id = ? AND slug = ? AND is_active = true` |
| 分类信息 | `categories` | JOIN `categories` ON `products.category_id = categories.id` |
| 相关产品 | `products` | `WHERE category_id = 产品分类 AND id != 当前产品 LIMIT 4` |

## 路径参数

| 参数 | 类型 | 必填 | 描述 | 对应字段 |
|------|------|------|------|----------|
| `slug` | string | 是 | 产品 URL 标识 | `products.slug` |

## 请求示例

```
GET /api/products/iphone-15
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `product` | object | 产品详情 |
| `relatedProducts` | array | 相关产品 (同分类) |

### Product 对象

| 字段 | 类型 | 描述 | 来源 |
|------|------|------|------|
| `id` | string | 产品 ID | `products.id` |
| `name` | string | 产品名称 | `products.name` |
| `slug` | string | URL 标识 | `products.slug` |
| `price` | number | 价格 | `products.price` |
| `compare_price` | number | 原价 | `products.compare_price` |
| `description` | text | 详细描述 | `products.description` |
| `main_image_url` | string | 主图 URL | `products.main_image_url` |
| `images` | array | 图片列表 | `products.images` |
| `stock_status` | string | 库存状态 | `products.stock_status` |
| `stock_quantity` | number | 库存数量 | `products.stock_quantity` |
| `meta_title` | string | SEO 标题 | `products.seo_title` |
| `meta_description` | string | SEO 描述 | `products.seo_description` |
| `categories` | object | 所属分类 | JOIN `categories` |

## 响应示例

```json
{
  "success": true,
  "product": {
    "id": "uuid",
    "name": "iPhone 15",
    "slug": "iphone-15",
    "price": 999.00,
    "compare_price": 1099.00,
    "description": "<p>详细产品描述...</p>",
    "main_image_url": "https://...",
    "images": ["https://img1.jpg", "https://img2.jpg"],
    "stock_status": "in_stock",
    "stock_quantity": 50,
    "categories": {
      "name": "Electronics",
      "slug": "electronics"
    }
  },
  "relatedProducts": [
    {
      "id": "uuid2",
      "name": "iPhone 15 Pro",
      "slug": "iphone-15-pro",
      "price": 1199.00,
      "main_image_url": "https://..."
    }
  ]
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Product slug is required | 缺少 slug 参数 |
| 404 | Product not found | 产品不存在或已下架 |
