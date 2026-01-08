# [Admin] 获取订单列表

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/orders` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/admin/orders.ts` |

## 描述

获取当前品牌的订单列表。

## 数据来源

```
主表: orders
过滤: brand_id = 当前品牌
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 订单列表 | `orders` | `WHERE brand_id = ?` |
| 订单统计 | `orders` | `COUNT(*), SUM(total) GROUP BY status` |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | number | 否 | 1 | 页码 |
| `limit` | number | 否 | 20 | 每页数量 |
| `status` | string | 否 | - | 状态筛选 |
| `search` | string | 否 | - | 搜索 (订单号/邮箱) |
| `date_from` | string | 否 | - | 开始日期 |
| `date_to` | string | 否 | - | 结束日期 |

### 订单状态 (status)

| 值 | 描述 |
|----|------|
| `pending` | 待支付 |
| `paid` | 已支付 |
| `shipped` | 已发货 |
| `delivered` | 已送达 |
| `cancelled` | 已取消 |
| `refunded` | 已退款 |

## 响应示例

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "order_number": "ORD-20240108-001",
      "customer_email": "john@example.com",
      "customer_name": "John Doe",
      "total": 999.00,
      "status": "paid",
      "items_count": 2,
      "created_at": "2024-01-08T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  },
  "stats": {
    "total_orders": 500,
    "total_revenue": 125000.00,
    "pending_count": 15
  }
}
```
