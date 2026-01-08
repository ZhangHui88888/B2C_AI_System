# 获取站点配置

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/site-config` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/site-config.ts` |

## 描述

根据域名获取品牌配置信息，用于前端初始化。

## 数据来源

```
主表: brands
域名绑定: brand_domains (多域名支持)
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 域名解析 | `brand_domains` | `WHERE domain = ?` |
| 品牌信息 | `brands` | `WHERE id = ? AND is_active = true` |
| 品牌设置 | `brands.settings` | JSONB 字段 |

## 查询参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `host` | string | 否 | 域名 (不传则使用请求 Host) |

## 请求示例

```
GET /api/site-config
GET /api/site-config?host=brand-a.com
```

## 响应参数

### Brand 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 品牌 ID |
| `name` | string | 品牌名称 |
| `slug` | string | 品牌标识 |
| `logo_url` | string | Logo URL |
| `favicon_url` | string | Favicon URL |
| `theme` | object | 主题配置 |
| `social_links` | object | 社交媒体链接 |
| `contact_info` | object | 联系信息 |

### Theme 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `primary_color` | string | 主色调 |
| `secondary_color` | string | 次色调 |
| `font_family` | string | 字体 |

## 响应示例

```json
{
  "brand": {
    "id": "uuid",
    "name": "Brand A",
    "slug": "brand-a",
    "logo_url": "https://...",
    "theme": {
      "primary_color": "#3B82F6",
      "secondary_color": "#10B981"
    },
    "social_links": {
      "facebook": "https://facebook.com/brand-a",
      "instagram": "https://instagram.com/brand-a"
    },
    "contact_info": {
      "email": "support@brand-a.com",
      "phone": "+1-800-123-4567"
    }
  }
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 404 | Site not found | 域名未绑定或品牌已禁用 |

## 说明

1. 前端通过此接口获取品牌配置，初始化主题和样式
2. 品牌识别优先级：brand_domains 表 > brands.domain 字段
3. 本地开发时支持 localhost 自动匹配第一个品牌
