# 第7阶段：高级 SEO/GEO 工具

> 全方位 SEO 优化与监控工具集

---

## 📋 功能模块

### 7.1 页面级 SEO

| 功能 | 状态 | 说明 |
|------|------|------|
| Title 标签编辑器 | ✅ | 批量编辑 |
| Description 编辑器 | ✅ | 批量编辑 |
| 关键词密度分析 | ✅ | 内容分析页面 |
| 重复 Meta 检测 | ✅ | SEO 仪表盘 |
| 批量 Meta 生成 | ✅ | AI 批量生成 |
| Alt 文本检查 | ✅ | 内容分析 |
| Alt 文本 AI 建议 | ✅ | 自动建议 |
| 图片压缩 | ✅ | Cloudflare Images |
| WebP 转换 | ✅ | images.ts |
| 孤立页面检测 | ✅ | seo-links.ts |
| 内链密度分析 | ✅ | seo-links.ts |
| 相关内容推荐 | ✅ | related-content.ts |

### 7.2 技术 SEO

| 功能 | 状态 | 说明 |
|------|------|------|
| Sitemap 管理界面 | ✅ | 可视化管理 |
| Sitemap 分片 | ✅ | 大站点支持 |
| Robots.txt 编辑器 | ✅ | 在线编辑 |
| 301 重定向管理 | ✅ | 批量管理 |
| 404 页面监控 | ✅ | 错误追踪 |
| Core Web Vitals | ✅ | LCP/FID/CLS/INP |

### 7.3 内容 SEO

| 功能 | 状态 | 说明 |
|------|------|------|
| 关键词研究 | ✅ | keywords.ts |
| 搜索意图分类 | ✅ | 信息/交易/导航/商业 |
| 内容评分系统 | ✅ | 综合评分 |
| 可读性分析 | ✅ | Flesch 评分 |
| E-E-A-T 评分 | ✅ | 经验/专业/权威/信任 |

### 7.4 监控与报告

| 功能 | 状态 | 说明 |
|------|------|------|
| 关键词排名监控 | ✅ | 每日追踪 |
| 索引状态检查 | ✅ | 批量检查 |
| Search Console 集成 | ✅ | OAuth 授权 |
| 自动化报告 | ✅ | 周/月报告 |

### 7.5 GEO 优化

| 功能 | 状态 | 说明 |
|------|------|------|
| AI 爬虫识别 | ✅ | Robots.txt 配置 |

---

## 🗂️ 相关文件

### 后端 API
- `worker/src/routes/keywords.ts` - 关键词研究
- `worker/src/routes/eeat.ts` - E-E-A-T 评分
- `worker/src/routes/seo-reports.ts` - 自动化报告
- `worker/src/routes/seo-links.ts` - 内链分析
- `worker/src/routes/related-content.ts` - 相关推荐
- `worker/src/routes/images.ts` - 图片处理
- `worker/src/routes/web-vitals.ts` - 性能监控
- `worker/src/routes/search-console.ts` - Search Console

### 工具类
- `worker/src/utils/image-processing.ts` - 图片处理
- `worker/src/utils/search-console.ts` - SC API

### 数据库
- `docs/database/010_seo_tools.sql` - SEO 工具表
- `docs/database/015_web_vitals.sql` - 性能数据表
- `docs/database/016_advanced_seo_analysis.sql` - 高级分析表

### 前端页面
- `frontend/src/pages/admin/seo/` - SEO 管理后台
- `frontend/src/pages/admin/seo/keywords.astro` - 关键词
- `frontend/src/pages/admin/seo/eeat.astro` - E-E-A-T
- `frontend/src/pages/admin/seo/reports.astro` - 报告
- `frontend/src/components/WebVitals.astro` - 性能组件

---

## 🔧 关键 API

### 关键词研究

```typescript
// POST /api/keywords/research
{
  "seed_keyword": "folding bike",
  "language": "en",
  "country": "de"
}
// 返回：搜索量、竞争度、相关词、长尾词
```

### E-E-A-T 评分

```typescript
// POST /api/eeat/analyze
{
  "url": "/products/cms-urban-pro",
  "content_type": "product"
}
// 返回：Experience/Expertise/Authority/Trust 各维度分数
```

### Core Web Vitals

```typescript
// POST /api/web-vitals
{
  "url": "/products/bike-1",
  "lcp": 2.1,
  "fid": 50,
  "cls": 0.05,
  "inp": 120
}
```

---

## 📊 E-E-A-T 评分维度

| 维度 | 英文 | 评估要点 |
|------|------|----------|
| 经验 | Experience | 作者是否有实际使用经验 |
| 专业 | Expertise | 内容是否专业准确 |
| 权威 | Authoritativeness | 作者/网站是否权威 |
| 信任 | Trustworthiness | 是否值得信赖 |
