# AI 生成 SEO Meta

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/seo/generate-meta` |
| **方法** | `POST` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/seo.ts` |

## 描述

使用 AI 为产品或内容生成 SEO meta 标签。

## 数据来源

```
读取表: products / categories / content_library (根据 content_type)
更新表: 同上 (写入生成的 meta)
外部服务: DeepSeek API (生成内容)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 读取内容 | `products` / `categories` | `WHERE brand_id = ? AND id = ?` |
| AI 生成 | DeepSeek API | 根据内容生成 meta |
| 保存结果 | `products.seo_title/seo_description` | UPDATE 生成的 meta |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `content_type` | string | 是 | 内容类型 |
| `content_id` | string | 是 | 内容 ID |
| `language` | string | 否 | 语言 (默认 en) |

### 内容类型 (content_type)

| 值 | 描述 |
|----|------|
| `product` | 产品 |
| `category` | 分类 |
| `blog_post` | 博客文章 |
| `page` | 页面 |

## 请求示例

```json
{
  "content_type": "product",
  "content_id": "uuid",
  "language": "en"
}
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `meta` | object | 生成的 Meta |
| `suggestions` | array | 优化建议 |

### Meta 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `title` | string | SEO 标题 |
| `description` | string | SEO 描述 |
| `keywords` | array | 关键词列表 |
| `og_title` | string | OG 标题 |
| `og_description` | string | OG 描述 |

## 响应示例

```json
{
  "success": true,
  "meta": {
    "title": "iPhone 15 Pro Max - Best Price | Brand Store",
    "description": "Shop the latest iPhone 15 Pro Max with free shipping...",
    "keywords": ["iPhone 15 Pro Max", "Apple smartphone"],
    "og_title": "iPhone 15 Pro Max - Premium Smartphone",
    "og_description": "Experience the future with iPhone 15 Pro Max..."
  },
  "suggestions": [
    "Consider adding price in the title for better CTR"
  ]
}
```
