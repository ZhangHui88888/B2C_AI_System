# 获取评论统计

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/reviews/stats/:productId` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/reviews.ts` |

## 描述

获取指定产品的评论统计信息。

## 数据来源

```
主表: reviews
聚合: COUNT, AVG, GROUP BY rating
过滤: brand_id = 当前品牌, product_id = 参数值, status = 'approved'
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 总评论数 | `reviews` | `COUNT(*) WHERE status = 'approved'` |
| 平均评分 | `reviews` | `AVG(rating) WHERE status = 'approved'` |
| 各星级数量 | `reviews` | `COUNT(*) GROUP BY rating` |
| 验证购买数 | `reviews` | `COUNT(*) WHERE is_verified_purchase = true` |

## 路径参数

| 参数 | 类型 | 必填 | 描述 | 对应字段 |
|------|------|------|------|----------|
| `productId` | string | 是 | 产品 ID | `reviews.product_id` |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `data` | object | 统计数据 |

### Stats 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `total_reviews` | number | 评论总数 |
| `average_rating` | number | 平均评分 |
| `rating_1` | number | 1星数量 |
| `rating_2` | number | 2星数量 |
| `rating_3` | number | 3星数量 |
| `rating_4` | number | 4星数量 |
| `rating_5` | number | 5星数量 |
| `verified_count` | number | 验证购买数量 |

## 响应示例

```json
{
  "success": true,
  "data": {
    "total_reviews": 150,
    "average_rating": 4.5,
    "rating_1": 5,
    "rating_2": 10,
    "rating_3": 15,
    "rating_4": 40,
    "rating_5": 80,
    "verified_count": 120
  }
}
```
