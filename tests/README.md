# B2C AI System 测试模块

完整的自动化测试套件，包含 API 测试和 E2E 端到端测试。

## 目录结构

```
tests/
├── README.md                    # 本文档
├── package.json                 # 测试依赖
├── tsconfig.json               # TypeScript 配置
├── vitest.config.ts            # Vitest 配置
├── playwright.config.ts        # Playwright 配置
├── setup.ts                    # 测试工具函数
├── .env.example                # 环境变量模板
├── data/
│   └── test_data.sql           # 测试数据 SQL
├── api/
│   └── api.test.ts             # API 自动化测试
└── e2e/
    └── e2e.test.ts             # E2E 端到端测试
```

---

## 快速开始

### 第一步：导入测试数据

1. 打开 Supabase Dashboard → SQL Editor
2. 复制 `data/test_data.sql` 的内容
3. 粘贴并执行

**测试数据包含：**
| 类型 | 数量 | 说明 |
|------|------|------|
| 品牌 | 1 | CMSBike Test (slug: cmsbike-test) |
| 分类 | 3 | Electric Bikes, Accessories, Spare Parts |
| 产品 | 6 | 电动自行车、配件、零件 |
| 优惠券 | 2 | WELCOME10 (10% off), SUMMER50 (£50 off) |
| 订单 | 3 | 不同状态的测试订单 |
| 客户 | 2 | 测试客户数据 |
| 评论 | 3 | 产品评论 |
| 知识库 | 4 | AI 客服知识 |

### 第二步：安装测试依赖

```bash
cd tests
npm install
npx playwright install chromium
```

### 第三步：配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# API 地址
API_BASE_URL=https://api.cmsbike.uk
FRONTEND_URL=https://cmsbike.uk

# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# 测试管理员账号
TEST_ADMIN_EMAIL=652364972@qq.com
TEST_ADMIN_PASSWORD=your-password

# 测试品牌
TEST_BRAND_SLUG=cmsbike-test
TEST_BRAND_DOMAIN=xk-truck.cn
```

### 第四步：运行测试

```bash
# 运行所有 API 测试
npm run test:api

# 运行所有 E2E 测试
npm run test:e2e

# 运行 E2E 测试（带浏览器界面）
npm run test:e2e:headed

# 运行 E2E 测试（Playwright UI 模式）
npm run test:e2e:ui

# 运行所有测试
npm test
```

---

## 测试覆盖范围

### API 测试 (api/api.test.ts)

| 模块 | 测试点 |
|------|--------|
| **公共 API** | site-config, products, categories |
| **品牌管理** | 列表、详情、权限验证 |
| **分类管理** | 列表、详情 |
| **产品管理** | 列表、详情、CRUD |
| **订单管理** | 列表、详情、状态更新 |
| **优惠券** | 列表、验证 |
| **评论系统** | 列表、审核 |
| **SEO 工具** | Meta 生成、分析 |
| **营销追踪** | Pageview、事件追踪 |
| **AI 聊天** | 消息发送 |

### E2E 测试 (e2e/e2e.test.ts)

| 场景 | 测试点 |
|------|--------|
| **公共页面** | 首页、产品页、购物车、联系页 |
| **后台登录** | 登录表单、错误处理、成功登录 |
| **后台管理** | Dashboard、产品、订单、品牌 |
| **购物流程** | 添加购物车、结账 |
| **SEO** | Meta 标签、Robots.txt、Sitemap |
| **响应式** | 手机、平板、桌面 |
| **性能** | 页面加载时间 |
| **错误处理** | 404 页面 |
| **可访问性** | 标题结构、表单标签 |

---

## 测试数据详情

### 测试产品

| 产品名 | 价格 | 分类 | 状态 |
|--------|------|------|------|
| Urban Commuter E-Bike | £1,299.99 | Electric Bikes | in_stock |
| Mountain Explorer E-Bike | £1,899.99 | Electric Bikes | in_stock |
| Folding City E-Bike | £899.99 | Electric Bikes | low_stock |
| Smart Bike Helmet | £149.99 | Accessories | in_stock |
| Heavy Duty Bike Lock | £79.99 | Accessories | in_stock |
| E-Bike Battery Pack 48V | £399.99 | Spare Parts | in_stock |

### 测试优惠券

| 代码 | 折扣 | 最低消费 | 有效期 |
|------|------|----------|--------|
| WELCOME10 | 10% | £50 | 1 年 |
| SUMMER50 | £50 | £500 | 3 个月 |

### 测试订单

| 订单号 | 客户 | 金额 | 状态 |
|--------|------|------|------|
| ORD-TEST-001 | John Smith | £1,299.99 | paid |
| ORD-TEST-002 | Jane Doe | £309.97 | shipped |
| ORD-TEST-003 | Bob Wilson | £1,849.99 | pending |

---

## 故障排除

### 常见问题

**1. "Cannot find module" 错误**
```bash
npm install
```

**2. Playwright 浏览器未安装**
```bash
npx playwright install chromium
```

**3. 测试连接超时**
- 检查 `API_BASE_URL` 和 `FRONTEND_URL` 是否正确
- 确保网络可以访问测试服务器

**4. 认证失败**
- 检查 `TEST_ADMIN_EMAIL` 和 `TEST_ADMIN_PASSWORD`
- 确保 Supabase 服务密钥正确

**5. 测试数据不存在**
- 重新执行 `data/test_data.sql`
- 检查 Supabase 中的数据

---

## 扩展测试

### 添加新的 API 测试

编辑 `api/api.test.ts`：

```typescript
describe('New Feature APIs', () => {
  it('should test new endpoint', async () => {
    const response = await apiRequest('/api/new-endpoint', {}, adminToken);
    expect(response.ok).toBe(true);
  });
});
```

### 添加新的 E2E 测试

编辑 `e2e/e2e.test.ts`：

```typescript
test.describe('New Feature', () => {
  test('should test new page', async ({ page }) => {
    await page.goto('/new-page');
    await expect(page.locator('h1')).toBeVisible();
  });
});
```
