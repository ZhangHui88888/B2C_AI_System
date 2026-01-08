# [Admin] 获取品牌列表

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/brands` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | super_admin 或 Owner |
| **路由文件** | `worker/src/routes/admin/brands.ts` |

## 描述

获取系统中所有品牌列表（仅超级管理员可访问）。

## 数据来源

```
主表: brands
关联: brand_domains (域名列表)
统计: products, orders (聚合统计)
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 品牌列表 | `brands` | `SELECT * FROM brands` |
| 域名列表 | `brand_domains` | `WHERE brand_id = ?` |
| 产品统计 | `products` | `COUNT(*) WHERE brand_id = ?` |
| 订单统计 | `orders` | `COUNT(*), SUM(total) WHERE brand_id = ?` |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | number | 否 | 1 | 页码 |
| `limit` | number | 否 | 20 | 每页数量 |
| `is_active` | boolean | 否 | - | 状态筛选 |

## 响应参数

### Brand 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 品牌 ID |
| `name` | string | 品牌名称 |
| `slug` | string | 品牌标识 |
| `domain` | string | 主域名 |
| `domains` | array | 所有域名 |
| `logo_url` | string | Logo URL |
| `is_active` | boolean | 是否启用 |
| `stats` | object | 统计数据 |
| `created_at` | string | 创建时间 |

## 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid1",
      "name": "Brand A",
      "slug": "brand-a",
      "domain": "brand-a.com",
      "domains": ["brand-a.com", "www.brand-a.com"],
      "is_active": true,
      "stats": {
        "products_count": 150,
        "orders_count": 1200,
        "revenue": 85000.00
      },
      "created_at": "2023-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```
