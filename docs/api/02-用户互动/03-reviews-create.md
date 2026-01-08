# 提交评论

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/reviews` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/reviews.ts` |

## 描述

为产品提交评论，评论默认为待审核状态。

## 数据来源

```
写入表: reviews
验证表: products (验证产品存在), orders (验证购买记录)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 验证产品 | `products` | `WHERE brand_id = ? AND id = ?` |
| 验证购买 | `orders` | `WHERE customer_email = ? AND items包含product_id` |
| 创建评论 | `reviews` | INSERT 评论记录, status='pending' |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `product_id` | string | 是 | 产品 ID |
| `rating` | number | 是 | 评分 (1-5) |
| `title` | string | 否 | 评论标题 |
| `content` | string | 否 | 评论内容 |
| `reviewer_name` | string | 否 | 评论者名称 |
| `reviewer_email` | string | 否 | 评论者邮箱 |
| `images` | array | 否 | 评论图片 URL |

## 请求示例

```json
{
  "product_id": "uuid",
  "rating": 5,
  "title": "Excellent product!",
  "content": "Very happy with my purchase...",
  "reviewer_name": "John Doe",
  "reviewer_email": "john@example.com"
}
```

## 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "product_id": "product-uuid",
    "rating": 5,
    "title": "Excellent product!",
    "is_verified_purchase": true,
    "status": "pending",
    "created_at": "2024-01-08T12:00:00Z"
  }
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | product_id and rating are required | 缺少必填字段 |
| 400 | Rating must be between 1 and 5 | 评分超出范围 |
| 404 | Product not found | 产品不存在 |
