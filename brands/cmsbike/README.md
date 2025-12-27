# CMS BIKE 品牌配置

> 折叠自行车电商独立站

## 品牌信息

| 项目 | 值 |
|------|-----|
| 品牌名称 | CMS BIKE |
| 品牌 Slug | `cmsbike` |
| 目标市场 | 欧洲 |
| 产品类型 | 折叠自行车 |
| AI 客服 | ✅ 启用 |

## 配置文件清单

```
brands/cmsbike/
├── README.md              # 本文件
├── .env.example           # 前端环境变量模板
├── .dev.vars.example      # 后端本地开发变量模板
├── init-brand.sql         # 数据库初始化（品牌+分类+AI设置）
└── init-products.sql      # 产品数据（待填充）
```

## 部署步骤

### 1. 域名配置
- [ ] 购买域名（建议：cmsbike.com 或 cmsbike.eu）
- [ ] 将 DNS 托管到 Cloudflare

### 2. 创建 Supabase 项目
- [ ] 区域选择：Frankfurt (eu-central-1)
- [ ] 记录 Project URL 和 API Keys

### 3. 初始化数据库
- [ ] 执行 `docs/database/` 下所有迁移 SQL
- [ ] 执行 `brands/cmsbike/init-brand.sql`
- [ ] 执行 `brands/cmsbike/init-products.sql`

### 4. 部署后端
- [ ] 配置 Secrets（见下方）
- [ ] 执行 `wrangler deploy`
- [ ] 绑定 api.cmsbike.com

### 5. 部署前端
- [ ] 配置环境变量
- [ ] 连接 GitHub 到 Cloudflare Pages
- [ ] 绑定 cmsbike.com

### 6. 第三方服务
- [ ] Stripe：创建欧洲区账户，启用 SEPA/Bancontact 等欧洲支付
- [ ] Resend：验证发件域名
- [ ] DeepSeek：获取 API Key

## 需要配置的 Secrets

```bash
# 后端 Secrets（通过 wrangler secret put 配置）
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
DEEPSEEK_API_KEY=sk-...
NOTIFY_EMAIL=orders@cmsbike.com
```

## 欧洲市场特殊配置

### 支付方式（Stripe）
- ✅ Cards（Visa/Mastercard）
- ✅ Apple Pay / Google Pay
- ✅ SEPA Direct Debit（欧元区银行转账）
- ✅ Bancontact（比利时）
- ✅ iDEAL（荷兰）
- ✅ Giropay（德国）
- ✅ Klarna（分期付款）

### GDPR 合规
- [ ] 添加 Cookie 同意横幅
- [ ] 创建隐私政策页面
- [ ] 添加数据删除请求功能

### 多语言（未来）
- 英语（默认）
- 德语
- 法语
- 荷兰语
