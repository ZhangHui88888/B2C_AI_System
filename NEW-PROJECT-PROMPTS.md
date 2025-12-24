# DTC 内容电商项目 - 分步提示词文档

> 本文档用于引导 AI 分步骤生成完整的 DTC 内容电商项目
> 覆盖 Phase1（MVP 验证）和 Phase2（家族规模化）的所有功能

---

## 使用说明

1. **开启新对话**后，按顺序提供每个步骤的提示词
2. 每个步骤完成后，确认功能正常再进入下一步
3. 标注 `[Phase2]` 的步骤可以在 MVP 验证成功后再实现
4. 每个提示词都是独立的，可以根据需要调整顺序

---

## 第一阶段：项目初始化

### 步骤 1.1：创建项目基础架构

```
创建一个 DTC（Direct-to-Consumer）内容电商独立站项目，技术栈要求：

前端：
- Astro 5.x（静态生成，SEO 友好）
- TailwindCSS 4.x（现代 UI）
- TypeScript（可选）

后端：
- Cloudflare Workers（边缘计算）
- Supabase（PostgreSQL 数据库）

部署：
- Cloudflare Pages（前端）
- Cloudflare Workers（API）

项目结构：
├── frontend/          # Astro 前端
│   ├── src/
│   │   ├── pages/     # 页面
│   │   ├── components/ # 组件
│   │   ├── layouts/   # 布局
│   │   └── styles/    # 样式
│   └── public/        # 静态资源
├── worker/            # Cloudflare Worker 后端
│   └── src/
└── docs/              # 文档

请创建项目基础结构，包含必要的配置文件（package.json, astro.config.mjs, wrangler.toml 等）。
```

### 步骤 1.2：设计数据库模型

```
为 DTC 电商项目设计 Supabase 数据库模型，需要以下表：

1. products（产品表）
   - id, name, slug, description, short_description
   - price, compare_price（原价，用于显示折扣）
   - cost（成本价，用于计算利润）
   - main_image_url, images（数组）
   - category_id, supplier_info（供应商信息 JSON）
   - shipping_weight, shipping_time（预计发货时间）
   - is_active, is_featured, stock_status
   - seo_title, seo_description
   - created_at, updated_at

2. categories（分类表）
   - id, name, slug, description, image_url
   - parent_id, sort_order, is_active

3. orders（订单表）
   - id, order_number（订单号）
   - customer_email, customer_name, customer_phone
   - shipping_address（JSON：street, city, state, country, zip）
   - items（JSON 数组：product_id, name, quantity, price）
   - subtotal, shipping_cost, total
   - status（pending, paid, shipped, delivered, cancelled, refunded）
   - payment_intent_id（Stripe）
   - tracking_number, tracking_url
   - notes, created_at, updated_at

4. customers（客户表）
   - id, email, name, phone
   - total_orders, total_spent
   - first_order_at, last_order_at
   - created_at

5. conversations（AI 对话表）
   - id, session_id, role, message, metadata, created_at

6. knowledge_base（知识库表）
   - id, content, metadata, embedding_id, created_at

7. settings（系统设置表）
   - id, key, value（JSON）, updated_at

8. content_library（内容库表）[用于 AI 生成的内容]
   - id, type（script/caption/description）
   - product_id, content, platform（tiktok/instagram/pinterest）
   - status（draft/approved/published）
   - performance_data（JSON）
   - created_at, updated_at

请生成完整的 SQL 建表语句，包含索引和 RLS 策略。
```

---

## 第二阶段：前端页面开发

### 步骤 2.1：首页和布局组件

```
创建电商网站的首页和基础布局组件：

1. Layout.astro（主布局）
   - 响应式 Header（Logo、导航菜单、购物车图标带数量）
   - 移动端汉堡菜单
   - Footer（公司信息、快速链接、社交媒体图标）
   - SEO meta 标签插槽

2. 首页（index.astro）包含：
   - Hero 区域：大图/视频背景 + 主标题 + CTA 按钮
   - 热销产品轮播（4-6 个）
   - 分类展示网格
   - 社会证明区域（评价/媒体报道）
   - 品牌故事简介
   - Email 订阅表单

3. 组件：
   - ProductCard.astro（产品卡片：图片、名称、价格、加入购物车）
   - CategoryCard.astro（分类卡片）
   - Newsletter.astro（邮件订阅）

设计要求：
- 现代简约风格，适合 DTC 品牌
- 移动端优先设计
- 加载速度优化（图片懒加载）
- 深色/浅色主题切换（可选）
```

### 步骤 2.2：产品列表和详情页

```
创建产品相关页面：

1. 产品列表页（/products）
   - 左侧筛选栏：分类、价格区间、排序
   - 产品网格（响应式：移动端 2 列，桌面 3-4 列）
   - 分页或无限滚动
   - 快速预览弹窗

2. 产品详情页（/products/[slug]）
   - 图片画廊（主图 + 缩略图切换，支持放大）
   - 产品名称、价格（显示原价和折扣价）
   - 简短描述
   - 数量选择器 + 加入购物车按钮
   - 产品详情 Tab：描述、规格、发货信息
   - 客户评价区域
   - 相关产品推荐

3. 分类页面（/category/[slug]）
   - 分类标题和描述
   - 该分类下的产品列表

SEO 要求：
- 每个产品页独立的 title/description
- Schema.org Product 结构化数据
- Open Graph 和 Twitter Card
```

### 步骤 2.3：购物车和结算页面

```
创建购物车和结算流程：

1. 购物车功能
   - 购物车状态管理（localStorage + 全局状态）
   - 迷你购物车（点击图标展开侧边栏）
   - 购物车页面（/cart）：
     * 产品列表（图片、名称、价格、数量调整、删除）
     * 小计、运费、总计
     * 优惠码输入框
     * 继续购物 / 去结算按钮

2. 结算页面（/checkout）
   - 步骤指示器：信息 → 支付 → 确认
   - 联系信息表单：邮箱、姓名、电话
   - 收货地址表单：国家、地址、城市、州/省、邮编
   - 订单摘要（右侧固定）
   - Stripe 支付集成（信用卡、Apple Pay、Google Pay）
   - 表单验证（前端 + 后端）

3. 订单确认页面（/order/[id]/thank-you）
   - 订单号和状态
   - 订单详情
   - 预计发货时间
   - 继续购物按钮

4. 订单追踪页面（/order/[id]）
   - 订单状态时间线
   - 物流信息（如有）
```

### 步骤 2.4：静态页面

```
创建必要的静态页面：

1. 关于我们（/about）
   - 品牌故事
   - 使命愿景
   - 团队介绍（可选）

2. 联系我们（/contact）
   - 联系表单
   - 邮箱、社交媒体链接
   - FAQ 常见问题

3. 政策页面
   - 隐私政策（/privacy）
   - 服务条款（/terms）
   - 退换货政策（/returns）
   - 发货说明（/shipping）

4. FAQ 页面（/faq）
   - 分类的常见问题
   - Schema.org FAQPage 结构化数据

5. 博客（/blog 和 /blog/[slug]）
   - 博客列表页
   - 博客详情页（Markdown 渲染）
   - 用于 SEO 内容营销
```

---

## 第三阶段：后端 API 开发

### 步骤 3.1：基础 API 架构

```
创建 Cloudflare Worker 后端 API：

1. 路由结构
   - POST /api/products/list - 获取产品列表（支持筛选、分页）
   - GET /api/products/:slug - 获取产品详情
   - GET /api/categories - 获取分类列表

2. 基础中间件
   - CORS 处理
   - 错误处理
   - 请求日志

3. Supabase 连接
   - 封装数据库查询方法
   - 连接池管理

4. 环境变量配置
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY

请创建完整的 Worker 代码结构，包含路由处理和数据库操作。
```

### 步骤 3.2：订单和支付 API

```
创建订单和 Stripe 支付相关 API：

1. 购物车相关
   - POST /api/cart/validate - 验证购物车（检查库存、价格）

2. 订单相关
   - POST /api/orders/create - 创建订单（验证 + 创建 PaymentIntent）
   - GET /api/orders/:id - 获取订单详情（需验证邮箱）
   - POST /api/orders/:id/cancel - 取消订单

3. Stripe 支付
   - POST /api/stripe/create-payment-intent - 创建支付意向
   - POST /api/stripe/webhook - Stripe Webhook 处理
     * payment_intent.succeeded - 支付成功，更新订单状态
     * payment_intent.payment_failed - 支付失败处理
   - Webhook 签名验证

4. 邮件通知（使用 Resend）
   - 订单确认邮件
   - 发货通知邮件
   - 新订单管理员通知

环境变量：
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY
- NOTIFY_EMAIL
```

### 步骤 3.3：AI 客服 API

```
创建 AI 客服功能（RAG 架构）：

1. 对话 API
   - POST /api/chat - 普通对话
   - POST /api/chat/stream - 流式响应（SSE）

2. RAG 知识库检索
   - Cloudflare Vectorize 向量存储
   - DeepSeek Embedding 模型（1024 维）
   - 相似度搜索（Top 3，阈值 0.7）
   - 回退到 Supabase 全文搜索

3. 知识库管理
   - POST /api/knowledge/add - 添加知识
   - POST /api/knowledge/migrate - 批量迁移到向量库
   - GET /api/knowledge/list - 知识列表

4. 多语言支持
   - 自动检测用户语言
   - 关键词提取（非英文 → 英文搜索）
   - 用相同语言回复

5. 系统提示词
   - 从 settings 表读取
   - 包含：角色定义、公司信息、产品范围、回复规则

环境变量：
- DEEPSEEK_API_KEY
- VECTORIZE_INDEX（Cloudflare Vectorize 索引名）
```

---

## 第四阶段：管理后台

### 步骤 4.1：后台框架和仪表盘

```
创建管理后台：

1. 后台路由结构（/admin/*）
   - /admin - 登录页
   - /admin/dashboard - 仪表盘
   - /admin/products - 产品管理
   - /admin/orders - 订单管理
   - /admin/customers - 客户管理
   - /admin/content - 内容管理
   - /admin/settings - 系统设置

2. 认证机制
   - 简单密码认证（localStorage 存储状态）
   - 或 Supabase Auth（更安全）

3. 仪表盘内容
   - 统计卡片：今日订单、今日销售额、待发货、本月利润
   - 最近订单列表（5 条）
   - 销售趋势图（7 天/30 天）
   - 热销产品 Top 5

4. 通用组件
   - AdminLayout.astro（后台布局：侧边栏 + 主内容区）
   - DataTable（数据表格：排序、筛选、分页）
   - Modal（弹窗）
   - Toast（消息提示）
```

### 步骤 4.2：产品管理

```
创建产品管理功能：

1. 产品列表（/admin/products）
   - 表格显示：图片、名称、价格、成本、库存状态、分类
   - 筛选：分类、状态、搜索
   - 操作：编辑、删除、复制

2. 产品编辑（/admin/products/[id]）
   - 基本信息：名称、描述、短描述
   - 价格设置：售价、原价、成本
   - 图片上传：主图、多图（支持拖拽排序）
   - 分类选择
   - 供应商信息：来源、链接、备注
   - 发货设置：重量、预计时间
   - SEO 设置：标题、描述
   - 状态：上架/下架、精选

3. 产品创建（/admin/products/new）
   - 同编辑页面
   - 自动生成 slug

4. 批量操作
   - 批量上架/下架
   - 批量删除
```

### 步骤 4.3：订单管理

```
创建订单管理功能：

1. 订单列表（/admin/orders）
   - 表格：订单号、客户、金额、状态、时间
   - 筛选：状态、时间范围、搜索
   - 状态标签颜色区分

2. 订单详情（/admin/orders/[id]）
   - 客户信息：姓名、邮箱、电话
   - 收货地址
   - 订单商品列表
   - 金额明细：小计、运费、总计
   - 支付信息：Stripe Payment ID
   - 状态更新：下拉菜单切换
   - 物流信息：填写快递单号、跟踪链接
   - 备注区域

3. 状态流转
   - pending（待支付）→ paid（已支付）→ shipped（已发货）→ delivered（已送达）
   - 可取消（cancelled）或退款（refunded）

4. 操作按钮
   - 发送发货通知邮件
   - 查看 Stripe 支付详情（跳转）
   - 退款（调用 Stripe API）
```

### 步骤 4.4：系统设置

```
创建系统设置页面：

1. AI 客服设置
   - AI 开关（开启/关闭）
   - 欢迎消息（AI 关闭时显示）
   - 系统提示词（定义 AI 角色）
   - 自动学习开关

2. 店铺设置
   - 店铺名称
   - Logo 上传
   - 联系邮箱
   - WhatsApp 号码
   - 社交媒体链接

3. 支付设置
   - Stripe 模式（测试/生产）
   - 支持的货币

4. 发货设置
   - 默认运费
   - 免运费门槛
   - 发货区域

5. 邮件模板
   - 订单确认邮件模板
   - 发货通知邮件模板
```

---

## 第五阶段：AI 内容生成工具

### 步骤 5.1：视频脚本生成

```
创建 AI 视频脚本生成功能：

1. 脚本生成页面（/admin/content/scripts）
   - 选择产品
   - 选择视频类型：
     * 产品展示（15-30 秒）
     * 问题解决（30-45 秒）
     * 对比测试（20-40 秒）
     * 开箱视频（30-60 秒）
     * 使用场景（20-40 秒）
   - 选择平台：TikTok / Instagram Reels / YouTube Shorts
   - 生成按钮

2. 生成结果
   - Hook（前 3 秒抓眼球）
   - 主体内容（分镜头描述）
   - CTA（行动号召）
   - 推荐配乐风格
   - 推荐 Hashtags

3. 批量生成
   - 一次生成多个不同风格的脚本
   - 保存到 content_library 表

4. AI 提示词优化
   - 预设经过验证的提示词模板
   - 包含爆款视频套路（标题、Hook）
```

### 步骤 5.2：产品描述和文案生成

```
创建 AI 文案生成功能：

1. 产品描述生成
   - 输入：产品基本信息、卖点
   - 输出：
     * SEO 优化的长描述（200-500 字）
     * 短描述（50-100 字）
     * 产品特点列表（5-8 条）
     * Meta 标题和描述

2. 社交媒体文案
   - Instagram 帖子文案（含 emoji、hashtags）
   - Pinterest 描述
   - Facebook 帖子

3. 邮件营销文案
   - 新品上架邮件
   - 促销活动邮件
   - 购物车召回邮件
   - 邮件主题行（A/B 测试版本）

4. 多语言翻译
   - 英文 → 德语、法语、西班牙语
   - 保持营销语气

5. 文案库管理
   - 保存生成的文案
   - 标记已使用/未使用
   - 按产品/类型筛选
```

---

## 第六阶段：数据分析和优化

### 步骤 6.1：数据看板

```
创建数据分析看板：

1. 销售数据（/admin/analytics）
   - 今日/本周/本月销售额
   - 订单数量趋势图
   - 平均订单金额
   - 转化率（访客 → 订单）

2. 产品数据
   - 热销产品排行
   - 产品浏览量
   - 加购率 vs 购买率
   - 库存预警

3. 客户数据
   - 新客 vs 老客比例
   - 复购率
   - 客户来源分析
   - 地区分布

4. 利润分析
   - 毛利润计算（售价 - 成本 - 运费）
   - 利润率趋势
   - 各产品利润贡献

5. 内容效果（后期）
   - 各平台引流数据
   - 视频播放量 vs 转化
```

### 步骤 6.2：SEO 自动化

```
创建 SEO 自动化工具：

1. SEO 检查器
   - 扫描所有产品页面
   - 检查：title、description、H1、图片 alt
   - 生成 SEO 健康报告

2. 自动优化
   - AI 生成 SEO 优化的标题和描述
   - 批量更新产品 SEO 信息
   - 自动生成结构化数据

3. Sitemap 管理
   - 自动生成 sitemap.xml
   - 提交到 Google/Bing（脚本）

4. 博客内容生成
   - 基于产品生成相关博客文章
   - 关键词研究建议
   - 内部链接建议
```

---

## 第七阶段：[Phase2] 多品牌/家族协作

### 步骤 7.1：多租户架构

```
[Phase2] 扩展为多品牌/多站点支持：

1. 品牌/站点管理
   - brands 表：id, name, domain, settings（JSON）, owner_id
   - 每个品牌独立的：产品、订单、设置

2. 用户和权限
   - users 表：id, email, name, role（admin/operator）
   - brand_users 表：user_id, brand_id, role

3. 数据隔离
   - 所有查询添加 brand_id 过滤
   - RLS 策略基于 brand_id

4. 共享资源
   - 知识库模板共享
   - 供应商信息共享
   - 内容模板共享
```

### 步骤 7.2：协作管理功能

```
[Phase2] 创建家族协作管理功能：

1. 总后台（Super Admin）
   - 所有品牌概览
   - 总销售数据汇总
   - 用户管理
   - 技术服务费管理

2. 品牌后台（Brand Admin）
   - 只能看到自己品牌的数据
   - 产品、订单、内容管理

3. 数据看板
   - 各品牌销售对比
   - 月度业绩排行
   - 整体利润汇总

4. 知识共享
   - 经验分享板块
   - 爆款产品/视频分享
   - 供应商推荐
```

---

## 第八阶段：部署和运维

### 步骤 8.1：部署配置

```
配置完整的部署流程：

1. Cloudflare Pages（前端）
   - GitHub 连接
   - 构建命令：npm run build
   - 输出目录：dist
   - 环境变量配置

2. Cloudflare Workers（后端）
   - wrangler.toml 配置
   - Secrets 配置（API Keys）
   - 绑定：Vectorize、KV（可选）

3. 自定义域名
   - DNS 配置
   - SSL 证书（自动）

4. GitHub Actions（可选）
   - 自动化测试
   - 自动化部署
```

### 步骤 8.2：监控和维护

```
创建监控和维护工具：

1. 日志查看
   - Worker 实时日志（wrangler tail）
   - 错误日志收集

2. 性能监控
   - 页面加载速度
   - API 响应时间
   - 错误率

3. 备份策略
   - Supabase 自动备份
   - 定期导出订单数据

4. 安全检查
   - API 限流
   - Stripe Webhook 验证
   - 敏感数据脱敏
```

---

## 环境变量清单

在部署前，确保配置以下环境变量：

### 前端（.env）
```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_STRIPE_PUBLISHABLE_KEY=
PUBLIC_SITE_URL=
```

### Worker（wrangler.toml secrets）
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
DEEPSEEK_API_KEY=
RESEND_API_KEY=
NOTIFY_EMAIL=
```

---

## 提示词使用建议

1. **每次只提供一个步骤的提示词**，等待 AI 完成后再继续
2. **如遇问题**，可以追加说明或调整要求
3. **保存进度**，每完成一个阶段可以提交 Git
4. **测试验证**，每个功能完成后本地测试
5. **按需跳过**，某些步骤可根据实际需求跳过或简化

---

## 进度跟踪

| 阶段 | 步骤 | 状态 | 备注 |
|-----|------|------|------|
| 1. 初始化 | 1.1 基础架构 | ✅ | 已完成 |
| 1. 初始化 | 1.2 数据库模型 | ✅ | 已完成 |
| 2. 前端 | 2.1 首页布局 | ⬜ | |
| 2. 前端 | 2.2 产品页面 | ⬜ | |
| 2. 前端 | 2.3 购物结算 | ⬜ | |
| 2. 前端 | 2.4 静态页面 | ⬜ | |
| 3. 后端 | 3.1 基础 API | ⬜ | |
| 3. 后端 | 3.2 订单支付 | ⬜ | |
| 3. 后端 | 3.3 AI 客服 | ⬜ | |
| 4. 后台 | 4.1 仪表盘 | ⬜ | |
| 4. 后台 | 4.2 产品管理 | ⬜ | |
| 4. 后台 | 4.3 订单管理 | ⬜ | |
| 4. 后台 | 4.4 系统设置 | ⬜ | |
| 5. AI 内容 | 5.1 视频脚本 | ⬜ | |
| 5. AI 内容 | 5.2 文案生成 | ⬜ | |
| 6. 分析 | 6.1 数据看板 | ⬜ | |
| 6. 分析 | 6.2 SEO 工具 | ⬜ | |
| 7. Phase2 | 7.1 多租户 | ⬜ | MVP 后 |
| 7. Phase2 | 7.2 协作管理 | ⬜ | MVP 后 |
| 8. 部署 | 8.1 部署配置 | ⬜ | |
| 8. 部署 | 8.2 监控维护 | ⬜ | |

---

**预计完成时间：** 
- Phase1 MVP：1-2 周（步骤 1-6）
- Phase2 扩展：额外 1 周（步骤 7）
