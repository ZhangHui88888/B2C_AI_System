# 获取推荐统计

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/referrals/stats` |
| **方法** | `GET` |
| **认证** | 需要 |
| **权限** | 登录用户 |

## 查询参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `customer_id` | string | 是 | 客户 ID |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `total_referrals` | number | 总推荐人数 |
| `successful_referrals` | number | 成功转化数 |
| `pending_referrals` | number | 待转化数 |
| `total_rewards` | number | 累计获得积分 |
| `recent_referrals` | array | 最近推荐记录 |

### Referral 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `referee_name` | string | 被推荐人名称 (脱敏) |
| `status` | string | 状态 |
| `reward_points` | number | 获得积分 |
| `created_at` | string | 推荐时间 |

## 响应示例

```json
{
  "total_referrals": 15,
  "successful_referrals": 10,
  "pending_referrals": 5,
  "total_rewards": 5000,
  "recent_referrals": [
    {
      "referee_name": "J***n",
      "status": "converted",
      "reward_points": 500,
      "created_at": "2024-01-05T00:00:00Z"
    }
  ]
}
```
