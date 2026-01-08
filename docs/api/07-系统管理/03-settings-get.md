# [Admin] 获取品牌设置

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/admin/settings` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | brand_viewer |
| **路由文件** | `worker/src/routes/admin/settings.ts` |

## 描述

获取当前品牌的所有设置项。

## 数据来源

```
主表: settings
关联: brands.settings (JSONB 字段也存储部分设置)
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 设置列表 | `settings` | `WHERE brand_id = ?` |
| 品牌设置 | `brands.settings` | `SELECT settings FROM brands WHERE id = ?` |

## 响应参数

### Settings 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `currency` | string | 货币 |
| `timezone` | string | 时区 |
| `shipping_default_cost` | number | 默认运费 |
| `shipping_free_threshold` | number | 免运费门槛 |
| `tax_rate` | number | 税率 |
| `ai_enabled` | boolean | AI 客服开关 |
| `ai_welcome_message` | string | AI 欢迎语 |
| `ai_system_prompt` | string | AI 系统提示词 |
| `email_from_name` | string | 邮件发件人 |
| `email_from_address` | string | 邮件发件地址 |

## 响应示例

```json
{
  "success": true,
  "settings": {
    "currency": "USD",
    "timezone": "America/New_York",
    "shipping_default_cost": 9.99,
    "shipping_free_threshold": 50,
    "tax_rate": 0,
    "ai_enabled": true,
    "ai_welcome_message": "Hi! How can I help you today?",
    "email_from_name": "Brand Store",
    "email_from_address": "noreply@brand.com"
  }
}
```
