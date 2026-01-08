# 获取分类详情

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/categories/:slug` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/categories.ts` |

## 描述

根据 slug 获取单个分类的详细信息，包含子分类列表。

## 数据来源

```
主表: categories
过滤: brand_id = 当前品牌, slug = 参数值
子分类: categories WHERE parent_id = 当前分类ID
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 分类详情 | `categories` | `WHERE brand_id = ? AND slug = ?` |
| 子分类 | `categories` | `WHERE parent_id = 当前分类ID AND is_active = true` |

## 路径参数

| 参数 | 类型 | 必填 | 描述 | 对应字段 |
|------|------|------|------|----------|
| `slug` | string | 是 | 分类 URL 标识 | `categories.slug` |

## 请求示例

```
GET /api/categories/electronics
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `category` | object | 分类详情 |
| `subcategories` | array | 子分类列表 |

## 响应示例

```json
{
  "success": true,
  "category": {
    "id": "uuid1",
    "name": "Electronics",
    "slug": "electronics",
    "description": "电子产品分类",
    "image_url": "https://...",
    "parent_id": null,
    "meta_title": "Electronics - Best Deals",
    "meta_description": "Shop the best electronics..."
  },
  "subcategories": [
    {
      "id": "uuid2",
      "name": "Phones",
      "slug": "phones",
      "parent_id": "uuid1"
    }
  ]
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Category slug is required | 缺少 slug 参数 |
| 404 | Category not found | 分类不存在 |
