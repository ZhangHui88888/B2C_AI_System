# [Admin] 更新品牌设置

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/settings` |
| **方法** | `PUT` |
| **认证** | 需要 (Admin) |
| **权限** | brand_admin |
| **路由文件** | `worker/src/routes/admin/settings.ts` |

## 描述

更新品牌设置项。

## 数据来源

```
写入表: settings
更新表: brands.settings (JSONB)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| UPSERT 设置 | `settings` | `ON CONFLICT (brand_id, key) DO UPDATE` |
| 更新品牌 | `brands.settings` | UPDATE JSONB 字段 |

## 请求参数

### Body (JSON)

单项更新：
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `key` | string | 是 | 设置键 |
| `value` | any | 是 | 设置值 |

批量更新：
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `settings` | object | 是 | 设置键值对 |

## 请求示例

单项更新：
```json
{
  "key": "shipping_free_threshold",
  "value": 100
}
```

批量更新：
```json
{
  "settings": {
    "shipping_free_threshold": 100,
    "ai_enabled": true,
    "ai_welcome_message": "Welcome! How can I assist you?"
  }
}
```

## 响应示例

```json
{
  "success": true,
  "updated": ["shipping_free_threshold", "ai_enabled", "ai_welcome_message"]
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Invalid setting key | 无效设置键 |
| 401 | Unauthorized | 未认证 |
| 403 | Forbidden | 无权限 |
