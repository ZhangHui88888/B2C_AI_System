# 获取产品评论

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/reviews/product/:productId` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/reviews.ts` |

## 描述

获取指定产品的已审核评论列表，支持排序和分页。

## 数据来源

```
主表: reviews
过滤: brand_id = 当前品牌, product_id = 参数值, status = 'approved'
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 评论列表 | `reviews` | `WHERE brand_id = ? AND product_id = ? AND status = 'approved'` |
| 商家回复 | `reviews` | `merchant_reply`, `merchant_reply_at` 字段 |

## 路径参数

| 参数 | 类型 | 必填 | 描述 | 对应字段 |
|------|------|------|------|----------|
| `productId` | string | 是 | 产品 ID | `reviews.product_id` |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | number | 否 | 1 | 页码 |
| `limit` | number | 否 | 10 | 每页数量 |
| `sort` | string | 否 | `newest` | 排序方式 |

### 排序方式 (sort)

| 值 | 描述 |
|----|------|
| `newest` | 最新评论 |
| `highest` | 评分最高 |
| `lowest` | 评分最低 |
| `helpful` | 最有帮助 |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `data` | array | 评论列表 |
| `pagination` | object | 分页信息 |

### Review 对象

| 字段 | 类型 | 描述 | 来源 |
|------|------|------|------|
| `id` | string | 评论 ID | `reviews.id` |
| `rating` | number | 评分 (1-5) | `reviews.rating` |
| `title` | string | 评论标题 | `reviews.title` |
| `content` | string | 评论内容 | `reviews.content` |
| `reviewer_name` | string | 评论者名称 | `reviews.reviewer_name` |
| `images` | array | 评论图片 | `reviews.images` |
| `is_verified_purchase` | boolean | 是否验证购买 | `reviews.is_verified_purchase` |
| `helpful_count` | number | 有帮助数 | `reviews.helpful_count` |
| `merchant_reply` | string | 商家回复 | `reviews.merchant_reply` |
| `created_at` | string | 评论时间 | `reviews.created_at` |

## 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "title": "Great product!",
      "content": "Very satisfied...",
      "reviewer_name": "John D.",
      "is_verified_purchase": true,
      "helpful_count": 15,
      "merchant_reply": "Thank you!",
      "created_at": "2024-01-08T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```
