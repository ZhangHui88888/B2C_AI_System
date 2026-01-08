# [Admin] 获取评论列表

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/reviews` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/admin/reviews.ts` |

## 描述

获取品牌的所有评论，包括待审核的评论。

## 数据来源

```
主表: reviews
关联: products (产品信息)
过滤: brand_id = 当前品牌 (不过滤 status)
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 评论列表 | `reviews` | `WHERE brand_id = ?` |
| 产品信息 | `products` | JOIN `products` ON `reviews.product_id` |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | number | 否 | 1 | 页码 |
| `limit` | number | 否 | 20 | 每页数量 |
| `status` | string | 否 | - | 状态筛选 |
| `product_id` | string | 否 | - | 产品筛选 |
| `rating` | number | 否 | - | 评分筛选 |

### 评论状态 (status)

| 值 | 描述 |
|----|------|
| `pending` | 待审核 |
| `approved` | 已通过 |
| `rejected` | 已拒绝 |
| `spam` | 垃圾评论 |

## 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "product_id": "product-uuid",
      "product": {
        "name": "iPhone 15",
        "slug": "iphone-15"
      },
      "rating": 5,
      "title": "Great product",
      "content": "Very satisfied...",
      "reviewer_name": "John D.",
      "reviewer_email": "john@example.com",
      "is_verified_purchase": true,
      "status": "pending",
      "created_at": "2024-01-08T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```
