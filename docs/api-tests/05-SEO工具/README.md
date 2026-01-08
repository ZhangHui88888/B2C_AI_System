# SEO 工具模块测试

## 模块概述

SEO 工具模块包含 AI 生成 Meta、关键词研究、E-E-A-T 分析和 Sitemap 等 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | AI 生成 Meta | POST | `/api/seo/generate-meta` | P0 |
| 2 | 关键词研究 | POST | `/api/keywords/research` | P1 |
| 3 | E-E-A-T 分析 | POST | `/api/eeat/analyze` | P1 |
| 4 | 获取 Sitemap | GET | `/sitemap.xml` | P0 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. 测试产品 (用于 Meta 生成)
-- 确保 products 表中有详细描述的产品

-- 2. 测试内容 (用于 E-E-A-T 分析)
INSERT INTO content_library (id, brand_id, type, title, content, slug, status, author_id) VALUES
  ('content-001', 'brand-test-001', 'blog', 'SEO优化指南', '这是一篇关于SEO优化的详细指南...', 'seo-guide', 'published', 'author-001'),
  ('content-002', 'brand-test-001', 'blog', '产品使用教程', '本文介绍如何正确使用我们的产品...', 'product-tutorial', 'published', 'author-001'),
  ('content-003', 'brand-test-001', 'blog', '草稿文章', '这是一篇未发布的草稿...', 'draft-post', 'draft', 'author-001');

-- 3. 作者信息 (用于 E-E-A-T 评估)
INSERT INTO authors (id, brand_id, name, bio, credentials, social_links) VALUES
  ('author-001', 'brand-test-001', '张专家', 
   '10年行业经验的技术专家', 
   '{"certifications": ["Google认证", "行业协会会员"], "years_experience": 10}',
   '{"linkedin": "https://linkedin.com/in/expert", "twitter": "https://twitter.com/expert"}');

-- 4. 关键词研究历史
INSERT INTO keyword_research (id, brand_id, seed_keyword, keywords, search_volume, difficulty, created_at) VALUES
  ('kw-001', 'brand-test-001', '手机', 
   '[{"keyword": "手机推荐", "volume": 10000, "difficulty": 45}, {"keyword": "手机评测", "volume": 8000, "difficulty": 40}]',
   18000, 42, NOW());
```

#### 数据验证

- [ ] 产品有完整的名称、描述信息
- [ ] 内容库有已发布和草稿状态的文章
- [ ] 作者信息包含资质证明 (E-E-A-T)
- [ ] 关键词研究有历史数据可查询

### 2. 环境配置

#### 请求头准备

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001",
  "Authorization": "Bearer <admin_token>"
}
```

#### AI 服务配置

```bash
# .env.test
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 关键词研究 API (可选)
SEMRUSH_API_KEY=your_semrush_key
AHREFS_API_KEY=your_ahrefs_key
```

### 3. 外部服务 Mock

#### DeepSeek API Mock (Meta 生成)

```javascript
const deepseekMock = {
  generateMeta: async (content) => ({
    choices: [{
      message: {
        content: JSON.stringify({
          seo_title: '测试产品 - 高性价比推荐 | 品牌名',
          seo_description: '这是一款高性价比的测试产品，具有优质功能...',
          keywords: ['测试产品', '高性价比', '推荐']
        })
      }
    }]
  })
};
```

#### DeepSeek API Mock (E-E-A-T 分析)

```javascript
const eeatMock = {
  analyze: async (content, authorInfo) => ({
    choices: [{
      message: {
        content: JSON.stringify({
          experience: { score: 85, feedback: '内容展示了实际使用经验' },
          expertise: { score: 90, feedback: '专业术语使用准确' },
          authoritativeness: { score: 75, feedback: '可增加外部引用' },
          trustworthiness: { score: 80, feedback: '信息来源可信' },
          overall_score: 82.5,
          suggestions: ['建议添加更多数据支持', '可引用权威来源']
        })
      }
    }]
  })
};
```

#### 关键词研究 API Mock

```javascript
const keywordMock = {
  research: async (seedKeyword) => ({
    keywords: [
      { keyword: `${seedKeyword}推荐`, volume: 10000, difficulty: 45, cpc: 1.5 },
      { keyword: `${seedKeyword}评测`, volume: 8000, difficulty: 40, cpc: 1.2 },
      { keyword: `最好的${seedKeyword}`, volume: 5000, difficulty: 55, cpc: 2.0 }
    ]
  })
};
```

### 4. 测试账号准备

| 角色 | 权限 | 用途 |
|------|------|------|
| Admin | brand_manage | SEO 工具操作 |
| Viewer | brand_viewer | 只读访问 (应被拒绝) |

## 测试场景

### AI 生成 Meta 测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 产品 Meta | content_type=product | 生成产品 SEO 标题和描述 |
| 分类 Meta | content_type=category | 生成分类 SEO 信息 |
| 文章 Meta | content_type=blog | 生成文章 SEO 信息 |
| 不存在的内容 | 无效 content_id | 404 错误 |
| 保存结果 | save=true | Meta 写入数据库 |

### 关键词研究测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 基础研究 | seed_keyword=手机 | 返回相关关键词列表 |
| 指定语言 | language=zh-CN | 中文关键词 |
| 指定地区 | country=CN | 中国区数据 |
| 结果限制 | limit=10 | 最多返回 10 个 |
| 保存结果 | save=true | 保存到 keyword_research |

### E-E-A-T 分析测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 产品分析 | content_type=product | 四维度评分 |
| 文章分析 | content_type=blog | 四维度评分 + 改进建议 |
| 有作者信息 | 关联 author_id | 考虑作者资质 |
| 无作者信息 | author_id=null | 降低权威性评分 |

### Sitemap 测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 默认 Sitemap | GET /sitemap.xml | 返回有效 XML |
| 包含产品 | is_active=true 的产品 | 产品 URL 在 Sitemap 中 |
| 排除下架 | is_active=false 的产品 | 不包含下架产品 |
| 包含分类 | 活跃分类 | 分类 URL 在 Sitemap 中 |
| 包含文章 | published 文章 | 文章 URL 在 Sitemap 中 |
| 多品牌隔离 | 不同域名访问 | 仅返回该品牌数据 |

## 测试命令

```bash
# 运行 SEO 工具模块测试
npm run test:api -- --grep "05-SEO工具"

# 仅运行 Meta 生成测试
npm run test:api -- --grep "generate-meta"

# 仅运行 Sitemap 测试
npm run test:api -- --grep "sitemap"

# 验证 Sitemap XML 格式
curl https://api-test.example.com/sitemap.xml | xmllint --noout -
```

## 注意事项

1. **AI 调用成本**: 测试环境使用 Mock，避免真实 API 调用
2. **Sitemap 缓存**: 注意 Sitemap 可能有缓存，测试时清除
3. **SEO 字符限制**: Title 约 60 字符，Description 约 160 字符
4. **多语言支持**: 测试不同语言的 Meta 生成
5. **XML 有效性**: Sitemap 必须是有效的 XML 格式
