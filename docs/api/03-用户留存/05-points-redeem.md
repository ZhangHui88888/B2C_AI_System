# 兑换积分

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/points/redeem` |
| **方法** | `POST` |
| **认证** | 需要 |
| **权限** | 登录用户 |

## 描述

使用积分兑换折扣或礼品。

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `customer_id` | string | 是 | 客户 ID |
| `points` | number | 是 | 兑换积分数 |
| `redemption_type` | string | 是 | 兑换类型 |
| `order_id` | string | 否 | 订单 ID (折扣时) |

### 兑换类型 (redemption_type)

| 值 | 描述 |
|----|------|
| `discount` | 订单折扣 |
| `coupon` | 兑换优惠券 |
| `gift` | 兑换礼品 |

## 请求示例

```json
{
  "customer_id": "uuid",
  "points": 500,
  "redemption_type": "discount",
  "order_id": "order-uuid"
}
```

## 响应示例

```json
{
  "success": true,
  "transaction": {
    "id": "uuid",
    "type": "redeem",
    "points": -500,
    "balance_after": 1000
  },
  "new_balance": 1000,
  "discount_amount": 5.00
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Insufficient points | 积分不足 |
