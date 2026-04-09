# AGENTS.md

This file provides guidance to AI coding agents (Cursor, Claude Code, etc.) when working with code in this repository.

## Project Overview

DTC 内容电商平台 — 基于 Astro、Cloudflare Workers 和 Supabase 的多品牌直接面向消费者电商系统，支持 AI 客服和内容生成。

子项目：
- **frontend/** — Astro 5 前端（SSR on Cloudflare Pages）
- **worker/** — Cloudflare Workers API 后端
- **tests/** — Vitest 单元测试 + Playwright E2E 测试
- **docs/** — API 文档、数据库迁移、架构图
- **brands/** — 品牌产品目录

## Build & Run Commands

### Frontend (frontend)
```bash
cd frontend && npm install
cd frontend && npm run dev      # 本地开发服务器
cd frontend && npm run build    # 生产构建
```

### Worker (worker)
```bash
cd worker && npm install
cd worker && npx wrangler dev   # 本地 Worker 开发
cd worker && npx wrangler deploy  # 部署到 Cloudflare
```

### Tests (tests)
```bash
cd tests && npm install
cd tests && npx vitest          # 运行 API 测试
cd tests && npx playwright test # 运行 E2E 测试
```

## Architecture

### System Architecture
```
用户层 (brand-a.com, brand-b.com, /admin)
  → Cloudflare Pages (Astro SSR)
  → Cloudflare Workers (CORS / Brand / Auth 中间件)
  → KV 缓存
  → Supabase (PostgreSQL, RLS)
  → 外部服务 (Stripe, DeepSeek, Resend, Tracking Pixels)
```

### Multi-Brand Architecture
- 同一套代码支持多品牌独立域名
- 数据通过 `brand_id` 隔离
- Worker 中间件自动解析品牌上下文

### Frontend (Astro)
- Astro 5 with SSR adapter for Cloudflare
- TailwindCSS 3.4 for styling
- @supabase/supabase-js for client-side data
- Pages in `src/pages/`, components in `src/components/`
- Admin dashboard at `/admin/*` routes

### Worker API (Cloudflare Workers)
- TypeScript, deployed via Wrangler
- Routes in `src/routes/`, utilities in `src/utils/`
- Middleware chain: CORS → Brand resolution → Auth
- Supabase service_role for database operations
- Stripe for payment processing

### Database (Supabase/PostgreSQL)
- 22 migration scripts in `docs/database/`
- RLS enabled on all tables, service_role only access
- Brand isolation enforced at Worker API layer
- Key domains: products, orders, customers, content, marketing, SEO

### AI Integration
- DeepSeek for RAG customer service and content generation
- Knowledge base with vector embeddings (pgvector)
- Streaming responses for chat interface

## Database Domains

| Domain | Tables |
|--------|--------|
| Core | brands, products, categories, customers, orders, order_items |
| Content | content_library, authors, knowledge_base |
| AI | conversations, messages |
| Marketing | tracking_pixels_config, pixel_events, abandoned_carts, utm_visits |
| Retention | coupons, points_transactions, referral_codes, membership_levels |
| SEO | keyword_research, seo_reports, eeat_scores, web_vitals |
| Admin | admin_users, brand_user_assignments |

## Key Conventions

- **Git**: Conventional Commits format. Branch strategy: `main` + `feature/*`
- **TypeScript**: Strict mode, no `any`
- **Environment**: Secrets in `.dev.vars` (worker) and `.env` (frontend), never committed
- **Deployment**: Wrangler for Workers, Cloudflare Pages for frontend

## Git Worktree 并行开发

本项目支持 Git Worktrees 并行开发：

```bash
git worktree add ../wt-<功能名> -b feature/<功能名> main
git worktree list
git worktree remove ../wt-<功能名>
```

- Worktree 目录命名：`../wt-<功能名>`（与主仓库同级）
- 分支命名：`feature/<功能名>` 或 `bugfix/<问题描述>`
- 推荐起步 2-3 个并行 worktree，完成后及时清理

## External Dependencies

- **Supabase** — PostgreSQL database with RLS
- **Cloudflare** — Workers (API), Pages (frontend), KV (cache), R2 (storage)
- **Stripe** — Payment processing
- **DeepSeek** — AI model for RAG and content generation
- **Resend** — Transactional email service
