# 技术监控模块测试

## 模块概述

技术监控模块包含 Core Web Vitals 监控和图片上传处理等 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | 上报 Web Vitals | POST | `/api/web-vitals` | P0 |
| 2 | 获取 Web Vitals 统计 | GET | `/api/web-vitals/stats` | P1 |
| 3 | 上传图片 | POST | `/api/images/upload` | P0 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. Web Vitals 历史数据
INSERT INTO web_vitals (id, brand_id, url, lcp, fid, cls, inp, ttfb, device_type, connection_type, created_at) VALUES
  -- 桌面端数据
  ('wv-001', 'brand-test-001', '/products/test-phone-a', 1200, 50, 0.05, 120, 200, 'desktop', '4g', NOW() - INTERVAL '1 day'),
  ('wv-002', 'brand-test-001', '/products/test-phone-a', 1500, 80, 0.08, 150, 250, 'desktop', '4g', NOW() - INTERVAL '1 day'),
  ('wv-003', 'brand-test-001', '/products/test-phone-a', 2000, 100, 0.1, 180, 300, 'desktop', '4g', NOW() - INTERVAL '2 days'),
  -- 移动端数据
  ('wv-004', 'brand-test-001', '/products/test-phone-a', 2500, 150, 0.15, 250, 400, 'mobile', '4g', NOW() - INTERVAL '1 day'),
  ('wv-005', 'brand-test-001', '/products/test-phone-a', 3000, 200, 0.2, 300, 500, 'mobile', '3g', NOW() - INTERVAL '1 day'),
  -- 不同页面
  ('wv-006', 'brand-test-001', '/', 800, 30, 0.02, 80, 150, 'desktop', '4g', NOW() - INTERVAL '1 day'),
  ('wv-007', 'brand-test-001', '/category/phones', 1000, 40, 0.03, 100, 180, 'desktop', '4g', NOW() - INTERVAL '1 day');

-- 数据应覆盖:
-- - 不同时间范围 (用于趋势分析)
-- - 不同设备类型 (desktop/mobile/tablet)
-- - 不同网络类型 (4g/3g/wifi)
-- - 不同页面 (用于页面对比)
```

#### 数据验证

- [ ] Web Vitals 数据覆盖多个时间点
- [ ] 包含不同设备类型的数据
- [ ] 包含不同网络类型的数据
- [ ] 数据值在合理范围内

### 2. 环境配置

#### 请求头准备

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001"
}
```

#### 图片上传请求头

```json
{
  "Content-Type": "multipart/form-data",
  "x-brand-id": "brand-test-001",
  "Authorization": "Bearer <admin_token>"
}
```

#### Cloudflare Images 配置

```bash
# .env.test
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_IMAGES_TOKEN=your_cloudflare_images_token

# 或使用 Mock
CF_IMAGES_MOCK=true
```

### 3. 外部服务 Mock

#### Cloudflare Images Mock

```javascript
const cloudflareImagesMock = {
  upload: async (file, options) => ({
    result: {
      id: 'cf-image-test-123',
      filename: file.name,
      variants: [
        'https://imagedelivery.net/xxx/cf-image-test-123/thumbnail',
        'https://imagedelivery.net/xxx/cf-image-test-123/medium',
        'https://imagedelivery.net/xxx/cf-image-test-123/large',
        'https://imagedelivery.net/xxx/cf-image-test-123/public'
      ]
    },
    success: true
  }),
  
  delete: async (imageId) => ({
    result: {},
    success: true
  })
};
```

### 4. 测试文件准备

#### 测试图片文件

```
test-files/
├── valid-image.jpg      # 有效 JPEG 图片 (< 10MB)
├── valid-image.png      # 有效 PNG 图片
├── valid-image.webp     # 有效 WebP 图片
├── large-image.jpg      # 超大图片 (> 10MB)
├── invalid-file.txt     # 非图片文件
├── corrupted-image.jpg  # 损坏的图片文件
└── animated.gif         # 动态 GIF
```

#### 创建测试图片

```javascript
// 生成测试用的 1x1 像素图片
const createTestImage = (format = 'png') => {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 100, 100);
  return canvas.toDataURL(`image/${format}`);
};
```

### 5. 测试账号准备

| 角色 | 权限 | 用途 |
|------|------|------|
| Admin | brand_manage | 图片上传、统计查看 |
| 匿名用户 | 无 | Web Vitals 上报 |

## 测试场景

### Web Vitals 上报测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 完整指标 | LCP+FID+CLS+INP+TTFB | 记录成功 |
| 部分指标 | 仅 LCP | 记录成功 (其他为 null) |
| 异常值 | LCP=-100 | 400 或记录但标记异常 |
| 批量上报 | 数组格式 | 批量记录成功 |
| 设备信息 | 含 device_type | 正确分类 |

### Web Vitals 统计测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 默认统计 | 无参数 | 返回 30 天 P75 数据 |
| 指定天数 | days=7 | 返回 7 天数据 |
| 指定页面 | url=/products/xxx | 仅该页面数据 |
| 设备筛选 | device_type=mobile | 仅移动端数据 |
| 趋势数据 | 默认 | 按天聚合趋势 |
| 页面排名 | 默认 | 最慢页面列表 |

### 图片上传测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| JPEG 上传 | valid-image.jpg | 上传成功，返回 URL |
| PNG 上传 | valid-image.png | 上传成功，返回 URL |
| WebP 上传 | valid-image.webp | 上传成功 |
| 文件过大 | large-image.jpg | 400 文件过大 |
| 非图片文件 | invalid-file.txt | 400 不支持的格式 |
| 损坏文件 | corrupted-image.jpg | 400 文件损坏 |
| 指定文件夹 | folder=products | 存储到指定目录 |
| 自定义 Alt | alt=产品图片 | 保存 Alt 信息 |
| 返回变体 | 默认 | 返回多尺寸 URL |

## 测试命令

```bash
# 运行技术监控模块测试
npm run test:api -- --grep "06-技术监控"

# 仅运行 Web Vitals 测试
npm run test:api -- --grep "web-vitals"

# 仅运行图片上传测试
npm run test:api -- --grep "images"

# 测试图片上传 (手动)
curl -X POST https://api-test.example.com/api/images/upload \
  -H "Authorization: Bearer <token>" \
  -H "x-brand-id: brand-test-001" \
  -F "file=@test-files/valid-image.jpg" \
  -F "folder=test" \
  -F "alt=测试图片"
```

## 注意事项

1. **Web Vitals 数据量**: 生产环境数据量大，测试注意性能
2. **P75 计算**: 确保样本量足够才有统计意义
3. **图片存储**: 测试后清理上传的测试图片
4. **CDN 缓存**: 图片 URL 可能有 CDN 缓存
5. **文件大小限制**: 注意 Cloudflare Workers 请求大小限制 (100MB)
6. **隐私合规**: Web Vitals 不应包含 PII 信息
