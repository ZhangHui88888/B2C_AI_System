# [Admin] 创建产品

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/products` |
| **方法** | `POST` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/admin/products.ts` |

## 描述

创建新产品。

## 数据来源

```
写入表: products
验证表: categories (验证分类存在)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 验证分类 | `categories` | `WHERE brand_id = ? AND id = ?` |
| 生成 slug | 计算 | 由 name 生成 URL-safe slug |
| 创建产品 | `products` | INSERT 产品记录 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `name` | string | 是 | 产品名称 |
| `slug` | string | 否 | URL 标识 (自动生成) |
| `category_id` | string | 否 | 分类 ID |
| `price` | number | 是 | 价格 |
| `compare_price` | number | 否 | 原价 |
| `description` | string | 否 | 详细描述 |
| `main_image_url` | string | 否 | 主图 URL |
| `images` | array | 否 | 图片列表 |
| `sku` | string | 否 | SKU 编码 |
| `stock_quantity` | number | 否 | 库存数量 |
| `stock_status` | string | 否 | 库存状态 |
| `is_active` | boolean | 否 | 是否上架 |
| `is_featured` | boolean | 否 | 是否推荐 |
| `meta_title` | string | 否 | SEO 标题 |
| `meta_description` | string | 否 | SEO 描述 |

## 请求示例

```json
{
  "name": "iPhone 15 Pro",
  "price": 1199.00,
  "compare_price": 1299.00,
  "category_id": "uuid",
  "description": "<p>Product description...</p>",
  "main_image_url": "https://...",
  "stock_quantity": 100,
  "is_active": true,
  "is_featured": true
}
```

## 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "iPhone 15 Pro",
    "slug": "iphone-15-pro",
    "price": 1199.00,
    "created_at": "2024-01-08T12:00:00Z"
  }
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | name and price are required | 缺少必填字段 |
| 400 | slug already exists | Slug 已存在 |
