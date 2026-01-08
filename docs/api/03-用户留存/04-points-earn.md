# 获得积分

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/points/earn` |
| **方法** | `POST` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |

## 描述

为客户增加积分，通常由订单完成后自动触发。

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `customer_id` | string | 是 | 客户 ID |
| `points` | number | 是 | 积分数量 |
| `description` | string | 否 | 描述说明 |
| `reference_type` | string | 否 | 关联类型 |
| `reference_id` | string | 否 | 关联 ID |

## 请求示例

```json
{
  "customer_id": "uuid",
  "points": 100,
  "description": "Order #ORD-001 purchase reward",
  "reference_type": "order",
  "reference_id": "order-uuid"
}
```

## 响应示例

```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "type": "earn",
    "points": 100,
    "balance_after": 1600
  },
  "new_balance": 1600
}
```
