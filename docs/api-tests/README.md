# API 测试文档

本目录包含各 API 模块的测试准备文档和测试用例。

## 目录结构

```
api-tests/
├── 01-电商核心/          # 产品、分类、购物车、订单
├── 02-用户互动/          # 评论、AI 聊天
├── 03-用户留存/          # 积分、会员、推荐
├── 04-营销追踪/          # UTM、Pixel、转化
├── 05-SEO工具/           # Meta 生成、关键词、E-E-A-T
├── 06-技术监控/          # Web Vitals、图片上传
├── 07-系统管理/          # 站点配置、品牌、设置
└── 08-管理后台/          # 管理端 CRUD 操作
```

## 测试环境

| 环境 | 用途 | URL |
|------|------|-----|
| 本地开发 | 开发调试 | `http://localhost:8787` |
| 测试环境 | 集成测试 | `https://api-test.example.com` |
| 生产环境 | 仅验证 | `https://api.example.com` |

## 通用准备事项

### 1. 环境变量配置

```bash
# .env.test
SUPABASE_URL=your_test_supabase_url
SUPABASE_ANON_KEY=your_test_anon_key
STRIPE_SECRET_KEY=sk_test_xxx
DEEPSEEK_API_KEY=your_api_key
CF_ACCOUNT_ID=your_cf_account
CF_IMAGES_TOKEN=your_cf_token
RESEND_API_KEY=your_resend_key
```

### 2. 测试数据库

- 使用独立的 Supabase 测试项目
- 每次测试前重置测试数据
- 准备标准测试数据集 (seed data)

### 3. 测试工具

| 工具 | 用途 |
|------|------|
| **Bruno / Postman** | 手动 API 测试 |
| **Vitest** | 自动化单元测试 |
| **Playwright** | E2E 集成测试 |

### 4. 认证准备

```bash
# 获取测试 Token
curl -X POST https://api-test.example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "testpass"}'
```

## 测试执行顺序

1. **07-系统管理** - 先确保品牌配置正确
2. **01-电商核心** - 产品、分类基础数据
3. **02-用户互动** - 依赖产品数据
4. **03-用户留存** - 依赖客户数据
5. **04-营销追踪** - 依赖订单数据
6. **05-SEO工具** - 依赖产品/内容数据
7. **06-技术监控** - 独立测试
8. **08-管理后台** - 综合管理功能

## 测试报告

测试完成后生成报告至 `reports/` 目录：

```bash
npm run test:api -- --reporter=html
```
