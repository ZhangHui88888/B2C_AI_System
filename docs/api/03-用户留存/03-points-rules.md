# 获取积分规则

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/points/rules` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |

## 描述

获取当前品牌的积分获取规则。

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `rules` | array | 规则列表 |

### Rule 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 规则 ID |
| `rule_name` | string | 规则名称 |
| `rule_type` | string | 规则类型 |
| `points_per_dollar` | number | 每美元积分 |
| `fixed_points` | number | 固定积分 |
| `min_order_amount` | number | 最低订单金额 |
| `max_points_per_order` | number | 单笔最高积分 |
| `points_validity_days` | number | 积分有效期(天) |
| `is_active` | boolean | 是否启用 |

### 规则类型 (rule_type)

| 值 | 描述 |
|----|------|
| `purchase` | 购物获得 |
| `review` | 评论获得 |
| `referral` | 推荐获得 |
| `birthday` | 生日获得 |
| `signup` | 注册获得 |

## 响应示例

```json
{
  "rules": [
    {
      "id": "uuid1",
      "rule_name": "Purchase Reward",
      "rule_type": "purchase",
      "points_per_dollar": 10,
      "max_points_per_order": 1000,
      "points_validity_days": 365,
      "is_active": true
    }
  ]
}
```
