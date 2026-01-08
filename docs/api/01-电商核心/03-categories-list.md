# 获取分类列表

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/categories` |
| **方法** | `GET` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/categories.ts` |

## 描述

获取当前品牌的所有分类，返回树形结构（支持父子分类）。

## 数据来源

```
主表: categories
过滤: brand_id = 当前品牌, is_active = true
排序: sort_order ASC
树形构建: 通过 parent_id 自引用构建层级
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| 分类列表 | `categories` | `WHERE brand_id = ? AND is_active = true ORDER BY sort_order` |
| 产品数量 | `products` | `COUNT(*) WHERE category_id = ? AND is_active = true` |
| 父子关系 | `categories` | 通过 `parent_id` 自引用构建树形结构 |

## 请求示例

```
GET /api/categories
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `categories` | array | 分类树 |

### Category 对象

| 字段 | 类型 | 描述 | 来源 |
|------|------|------|------|
| `id` | string | 分类 ID | `categories.id` |
| `name` | string | 分类名称 | `categories.name` |
| `slug` | string | URL 标识 | `categories.slug` |
| `description` | string | 分类描述 | `categories.description` |
| `image_url` | string | 分类图片 | `categories.image_url` |
| `parent_id` | string | 父分类 ID | `categories.parent_id` |
| `sort_order` | number | 排序 | `categories.sort_order` |
| `product_count` | number | 产品数量 | COUNT `products` |
| `children` | array | 子分类列表 | 递归查询 `categories` |

## 响应示例

```json
{
  "success": true,
  "categories": [
    {
      "id": "uuid1",
      "name": "Electronics",
      "slug": "electronics",
      "parent_id": null,
      "product_count": 50,
      "children": [
        {
          "id": "uuid2",
          "name": "Phones",
          "slug": "phones",
          "parent_id": "uuid1",
          "product_count": 20,
          "children": []
        }
      ]
    }
  ]
}
```

## 错误码

| HTTP 状态码 | 错误信息 | 描述 |
|-------------|----------|------|
| 400 | Brand context missing | 缺少品牌上下文 |
| 500 | Failed to fetch categories | 服务器错误 |
