# 获取邮件序列

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/email/sequences` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |

## 描述

获取品牌的邮件序列列表。

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `sequences` | array | 序列列表 |

### Sequence 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 序列 ID |
| `name` | string | 序列名称 |
| `type` | string | 类型 |
| `trigger` | string | 触发条件 |
| `steps_count` | number | 步骤数 |
| `is_active` | boolean | 是否启用 |
| `stats` | object | 统计数据 |

### 序列类型 (type)

| 值 | 描述 |
|----|------|
| `welcome` | 欢迎序列 |
| `abandoned_cart` | 弃购挽回 |
| `post_purchase` | 购后序列 |
| `winback` | 复购提醒 |

## 响应示例

```json
{
  "success": true,
  "sequences": [
    {
      "id": "uuid1",
      "name": "Welcome Series",
      "type": "welcome",
      "trigger": "signup",
      "steps_count": 3,
      "is_active": true,
      "stats": {
        "total_sent": 5000,
        "open_rate": 45.5,
        "click_rate": 12.3,
        "conversion_rate": 3.2
      }
    }
  ]
}
```
