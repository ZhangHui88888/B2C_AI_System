# 获取会员等级

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/membership/levels` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/membership.ts` |

## 描述

获取当前品牌的会员等级列表及权益说明。

## 数据来源

```
主表: membership_levels
过滤: brand_id = 当前品牌, is_active = true
排序: level_order ASC
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 等级列表 | `membership_levels` | `WHERE brand_id = ? AND is_active = true ORDER BY level_order` |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `levels` | array | 等级列表 |

### Level 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 等级 ID |
| `level_name` | string | 等级名称 |
| `level_code` | string | 等级代码 |
| `level_order` | number | 等级顺序 |
| `min_points` | number | 升级所需积分 |
| `min_spent` | number | 升级所需消费额 |
| `points_multiplier` | number | 积分倍率 |
| `discount_percentage` | number | 折扣百分比 |
| `free_shipping_threshold` | number | 免运费门槛 |
| `badge_color` | string | 徽章颜色 |
| `description` | string | 等级描述 |

## 响应示例

```json
{
  "levels": [
    {
      "id": "uuid1",
      "level_name": "Bronze",
      "level_code": "bronze",
      "level_order": 1,
      "min_points": 0,
      "min_spent": 0,
      "points_multiplier": 1.0,
      "discount_percentage": 0,
      "free_shipping_threshold": 100,
      "badge_color": "#CD7F32"
    },
    {
      "id": "uuid2",
      "level_name": "Silver",
      "level_code": "silver",
      "level_order": 2,
      "min_points": 1000,
      "min_spent": 200,
      "points_multiplier": 1.2,
      "discount_percentage": 5,
      "badge_color": "#C0C0C0"
    },
    {
      "id": "uuid3",
      "level_name": "Gold",
      "level_code": "gold",
      "level_order": 3,
      "min_points": 5000,
      "min_spent": 500,
      "points_multiplier": 1.5,
      "discount_percentage": 10,
      "free_shipping_threshold": 0,
      "badge_color": "#FFD700"
    }
  ]
}
```
