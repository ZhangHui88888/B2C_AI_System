# 获取 Sitemap

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/sitemap.xml` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/sitemap.ts` |

## 描述

动态生成网站 Sitemap XML，包含产品、分类和博客页面。

## 数据来源

```
读取表: products, categories, content_library (blog)
过滤: brand_id = 当前品牌 (根据域名识别), is_active = true
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 产品页 | `products` | `WHERE brand_id = ? AND is_active = true` |
| 分类页 | `categories` | `WHERE brand_id = ? AND is_active = true` |
| 博客页 | `content_library` | `WHERE brand_id = ? AND type = 'blog' AND status = 'published'` |

## 请求示例

```
GET /sitemap.xml
```

## 响应格式

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://brand.com/</loc>
    <lastmod>2024-01-08</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://brand.com/products</loc>
    <lastmod>2024-01-08</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://brand.com/products/iphone-15</loc>
    <lastmod>2024-01-07</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

## 响应头

```
Content-Type: application/xml
Cache-Control: public, max-age=3600
```

## 说明

1. Sitemap 根据请求域名自动生成对应品牌的内容
2. 仅包含 `is_active=true` 的产品和分类
3. 结果会缓存 1 小时
4. 大型站点会自动分片 (sitemap-index)
