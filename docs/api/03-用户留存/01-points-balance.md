# 获取积分余额

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/points/balance` |
| **方法** | `GET` |
| **认证** | 需要 |
| **权限** | 登录用户 |
| **路由文件** | `worker/src/routes/points.ts` |

## 数据来源

```
主表: customer_points
聚合: SUM(points) 计算余额
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 可用余额 | `customer_points` | `SUM(points) WHERE customer_id = ? AND status = 'active'` |
| 待生效 | `customer_points` | `SUM(points) WHERE status = 'pending'` |
| 即将过期 | `customer_points` | `WHERE expires_at < NOW() + INTERVAL '30 days'` |

## 查询参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `customer_id` | string | 是 | 客户 ID |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `balance` | number | 当前可用积分 |
| `pending` | number | 待生效积分 |
| `lifetime` | number | 历史累计积分 |
| `expiring_soon` | number | 即将过期积分 |
| `expiring_date` | string | 最近过期日期 |

## 响应示例

```json
{
  "balance": 1500,
  "pending": 200,
  "lifetime": 5000,
  "expiring_soon": 300,
  "expiring_date": "2024-03-01"
}
```
