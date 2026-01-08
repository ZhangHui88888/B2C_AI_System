# [Admin] 获取数据概览

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/overview` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | brand_viewer |
| **路由文件** | `worker/src/routes/admin/analytics.ts` |

## 描述

获取仪表板数据概览，包括销售、订单、流量等关键指标。

## 数据来源

```
聚合表: orders, customers, products, daily_analytics
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 收入统计 | `orders` | `SUM(total) WHERE brand_id = ? AND status = 'paid'` |
| 订单统计 | `orders` | `COUNT(*) WHERE brand_id = ?` |
| 客户统计 | `customers` | `COUNT(*) WHERE brand_id = ?` |
| 产品统计 | `products` | `COUNT(*) WHERE brand_id = ?` |
| 图表数据 | `daily_analytics` | `WHERE brand_id = ? AND date BETWEEN ? AND ?` |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `period` | string | 否 | `7d` | 时间范围 |

### 时间范围 (period)

| 值 | 描述 |
|----|------|
| `today` | 今日 |
| `7d` | 近7天 |
| `30d` | 近30天 |
| `90d` | 近90天 |
| `year` | 本年 |

## 响应参数

### Data 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `revenue` | object | 收入统计 |
| `orders` | object | 订单统计 |
| `customers` | object | 客户统计 |
| `products` | object | 产品统计 |
| `chart` | array | 图表数据 |

## 响应示例

```json
{
  "success": true,
  "data": {
    "revenue": {
      "total": 125000.00,
      "change": 12.5,
      "previous": 111111.11
    },
    "orders": {
      "total": 520,
      "change": 8.3,
      "previous": 480
    },
    "customers": {
      "total": 350,
      "new": 45,
      "returning": 305
    },
    "products": {
      "total": 150,
      "active": 142,
      "out_of_stock": 8
    },
    "chart": [
      {"date": "2024-01-01", "revenue": 15000, "orders": 65},
      {"date": "2024-01-02", "revenue": 18000, "orders": 78}
    ]
  }
}
```
