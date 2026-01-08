# [Admin] 更新订单状态

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/orders/:id/status` |
| **方法** | `PUT` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/admin/orders.ts` |

## 描述

更新订单状态，可触发相关邮件通知。

## 数据来源

```
更新表: orders
外部服务: Resend (发送邮件通知)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 更新状态 | `orders` | `UPDATE status, tracking_number, shipped_at` |
| 发送通知 | Resend API | 发货/送达邮件通知 |

## 路径参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `id` | string | 是 | 订单 ID |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `status` | string | 是 | 新状态 |
| `tracking_number` | string | 否 | 物流单号 (发货时) |
| `tracking_url` | string | 否 | 物流链接 |
| `notes` | string | 否 | 备注 |
| `send_notification` | boolean | 否 | 是否发送通知 |

### 状态流转

```
pending → paid → shipped → delivered
                    ↓
                cancelled
                    ↓
                refunded
```

## 请求示例

```json
{
  "status": "shipped",
  "tracking_number": "1Z999AA10123456784",
  "tracking_url": "https://tracking.ups.com/...",
  "send_notification": true
}
```

## 响应示例

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_number": "ORD-20240108-001",
    "status": "shipped",
    "tracking_number": "1Z999AA10123456784",
    "shipped_at": "2024-01-08T12:00:00Z"
  },
  "notification_sent": true
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Invalid status transition | 无效状态转换 |
| 404 | Order not found | 订单不存在 |
