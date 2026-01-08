# [Admin] 审核评论

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/reviews/:id` |
| **方法** | `PUT` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/admin/reviews.ts` |

## 描述

审核评论状态或添加商家回复。

## 数据来源

```
更新表: reviews
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 更新状态 | `reviews` | `UPDATE status, approved_at, approved_by` |
| 添加回复 | `reviews` | `UPDATE merchant_reply, merchant_reply_at` |

## 路径参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | string | 是 | 评论 ID |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `status` | string | 否 | 新状态 |
| `is_featured` | boolean | 否 | 是否精选 |
| `merchant_reply` | string | 否 | 商家回复 |

## 请求示例

审核通过：
```json
{
  "status": "approved",
  "is_featured": true
}
```

添加回复：
```json
{
  "merchant_reply": "Thank you for your feedback!"
}
```

## 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "approved",
    "is_featured": true,
    "merchant_reply": "Thank you...",
    "merchant_reply_at": "2024-01-08T12:00:00Z",
    "approved_at": "2024-01-08T12:00:00Z"
  }
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | No valid fields to update | 无有效更新字段 |
| 404 | Review not found | 评论不存在 |
