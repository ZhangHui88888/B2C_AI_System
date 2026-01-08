# 上传图片

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/images/upload` |
| **方法** | `POST` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/images.ts` |

## 描述

上传图片到 Cloudflare Images，自动进行压缩和 WebP 转换。

## 数据来源

```
外部服务: Cloudflare Images API
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 上传图片 | Cloudflare Images | `POST /images/v1` |
| 生成变体 | Cloudflare Images | 自动生成 thumbnail/medium/large/webp |

## 请求参数

### Body (multipart/form-data)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `file` | File | 是 | 图片文件 |
| `folder` | string | 否 | 存储文件夹 |
| `alt` | string | 否 | Alt 描述 |

### 支持的格式

- JPEG/JPG
- PNG
- GIF
- WebP
- SVG

### 大小限制

- 最大 10MB

## 请求示例

```bash
curl -X POST /api/images/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@product.jpg" \
  -F "folder=products" \
  -F "alt=iPhone 15 Pro"
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `image` | object | 图片信息 |

### Image 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string | 图片 ID |
| `url` | string | 原始 URL |
| `variants` | object | 变体 URL |
| `width` | number | 宽度 |
| `height` | number | 高度 |

### Variants 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `thumbnail` | string | 缩略图 (150px) |
| `medium` | string | 中等 (600px) |
| `large` | string | 大图 (1200px) |
| `webp` | string | WebP 格式 |

## 响应示例

```json
{
  "success": true,
  "image": {
    "id": "cf-image-id",
    "url": "https://imagedelivery.net/xxx/original",
    "variants": {
      "thumbnail": "https://imagedelivery.net/xxx/thumbnail",
      "medium": "https://imagedelivery.net/xxx/medium",
      "large": "https://imagedelivery.net/xxx/large",
      "webp": "https://imagedelivery.net/xxx/webp"
    },
    "width": 2000,
    "height": 2000
  }
}
```
