# 评论投票

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/reviews/:id/vote` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/reviews.ts` |

## 描述

为评论投票（有帮助/没帮助），每个 IP 只能投票一次。

## 数据来源

```
写入表: review_votes
更新表: reviews (helpful_count / not_helpful_count)
去重: 通过 voter_ip 或 customer_id 防止重复投票
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 检查重复 | `review_votes` | `WHERE review_id = ? AND voter_ip = ?` |
| 创建投票 | `review_votes` | INSERT 投票记录 |
| 更新计数 | `reviews` | UPDATE `helpful_count` 或 `not_helpful_count` |

## 路径参数

| 参数 | 类型 | 必填 | 描述 | 对应字段 |
|------|------|------|------|----------|
| `id` | string | 是 | 评论 ID | `review_votes.review_id` |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `is_helpful` | boolean | 是 | 是否有帮助 |

## 请求示例

```json
{
  "is_helpful": true
}
```

## 响应示例

```json
{
  "success": true
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | is_helpful is required | 缺少必填字段 |
| 400 | You have already voted | 重复投票 |
| 404 | Review not found | 评论不存在 |
