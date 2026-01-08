# 获取客户会员信息

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/membership/customers/:customerId` |
| **方法** | `GET` |
| **认证** | 需要 |
| **权限** | 登录用户 |

## 路径参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `customerId` | string | 是 | 客户 ID |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `membership` | object | 会员信息 |

### Membership 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `customer_id` | string | 客户 ID |
| `current_level` | object | 当前等级 |
| `next_level` | object | 下一等级 |
| `total_points` | number | 累计积分 |
| `total_spent` | number | 累计消费 |
| `points_to_next` | number | 距下一等级积分 |
| `spent_to_next` | number | 距下一等级消费 |
| `progress_percent` | number | 升级进度 (%) |
| `benefits` | object | 当前权益 |

## 响应示例

```json
{
  "membership": {
    "customer_id": "uuid",
    "current_level": {
      "level_name": "Silver",
      "badge_color": "#C0C0C0"
    },
    "next_level": {
      "level_name": "Gold",
      "badge_color": "#FFD700"
    },
    "total_points": 3500,
    "total_spent": 450.00,
    "points_to_next": 1500,
    "spent_to_next": 50.00,
    "progress_percent": 70,
    "benefits": {
      "points_multiplier": 1.2,
      "discount_percentage": 5,
      "free_shipping_threshold": 75
    }
  }
}
```
