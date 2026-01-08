# [Admin] 获取产品列表

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/products` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/admin/products.ts` |

## 描述

获取当前品牌的产品列表，包含所有状态的产品。

## 数据来源

```
主表: products
过滤: brand_id = 当前品牌 (不过滤 is_active)
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 产品列表 | `products` | `WHERE brand_id = ?` |
| 分类信息 | `categories` | JOIN `categories` ON `products.category_id` |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | number | 否 | 1 | 页码 |
| `limit` | number | 否 | 20 | 每页数量 |
| `status` | string | 否 | - | 状态筛选 |
| `category_id` | string | 否 | - | 分类筛选 |
| `search` | string | 否 | - | 搜索关键词 |
| `sort` | string | 否 | `created_at` | 排序字段 |
| `order` | string | 否 | `desc` | 排序方向 |

## 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "iPhone 15",
      "slug": "iphone-15",
      "price": 999.00,
      "stock_quantity": 50,
      "is_active": true,
      "is_featured": true,
      "created_at": "2024-01-08T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
