# 获取积分历史

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/points/history` |
| **方法** | `GET` |
| **认证** | 需要 |
| **权限** | 登录用户 |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `customer_id` | string | 是 | - | 客户 ID |
| `page` | number | 否 | 1 | 页码 |
| `limit` | number | 否 | 20 | 每页数量 |
| `type` | string | 否 | - | 交易类型筛选 |

### 交易类型 (type)

| 值 | 描述 |
|----|------|
| `earn` | 获得积分 |
| `redeem` | 兑换消费 |
| `expire` | 过期扣除 |
| `adjust` | 手动调整 |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `transactions` | array | 交易记录列表 |
| `pagination` | object | 分页信息 |

### Transaction 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 记录 ID |
| `type` | string | 交易类型 |
| `points` | number | 积分数量 (正/负) |
| `balance_after` | number | 交易后余额 |
| `description` | string | 描述 |
| `created_at` | string | 创建时间 |

## 响应示例

```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "earn",
      "points": 100,
      "balance_after": 1500,
      "description": "Order #ORD-001 purchase reward",
      "created_at": "2024-01-08T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```
