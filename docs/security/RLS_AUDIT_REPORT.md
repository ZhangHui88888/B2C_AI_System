# RLS 策略审计报告

**审计日期**: 2026-01-07  
**审计范围**: 所有数据库表的 Row Level Security 策略

## 1. 当前 RLS 架构

### 1.1 策略演进

| 迁移文件 | 描述 | 状态 |
|----------|------|------|
| `002_rls_policies.sql` | 原始策略：公开读取活跃记录，service_role 全权限 | 已执行 |
| `019_saas_rls_hardening.sql` | 为 admin 表添加 service_role 策略 | 已执行 |
| `020_public_service_role_only.sql` | **核弹策略**：仅允许 service_role 访问 | 待确认 |

### 1.2 当前安全模型

如果 `020_public_service_role_only.sql` 已执行：
- ✅ **所有表启用 RLS**
- ✅ **仅 service_role 可访问**
- ✅ **品牌隔离由 Worker API 层强制执行**
- ✅ **前端 anon key 直连被完全阻止**

## 2. 需要品牌隔离的表清单

### 2.1 核心业务表 (001_initial_schema.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `brands` | - (主表) | 品牌配置 |
| `categories` | ✅ FK | 产品分类 |
| `products` | ✅ FK | 产品信息 |
| `orders` | ✅ FK | 订单数据 |
| `customers` | ✅ FK | 客户信息 |
| `conversations` | ✅ FK | AI 聊天记录 |
| `knowledge_base` | ✅ FK | 知识库 |
| `settings` | ✅ FK | 品牌设置 |
| `content_library` | ✅ FK | 内容库 |

### 2.2 订单支付表 (005_orders_payment.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `order_items` | 通过 order_id 关联 | 订单项 |

### 2.3 内容质量表 (005_content_quality.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `authors` | ✅ FK | 作者信息 |

### 2.4 评论表 (006_reviews.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `reviews` | ✅ FK | 产品评论 |

### 2.5 优惠券表 (007_coupons.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `coupons` | ✅ FK | 优惠券 |

### 2.6 Admin 用户表 (008_admin_users.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `admin_users` | brand_ids[] | 管理员 |

### 2.7 博客表 (009_blog_support.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `blog_posts` | ✅ FK | 博客文章 |
| `blog_tags` | ✅ FK | 标签 |

### 2.8 SEO 工具表 (010_seo_tools.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `seo_metadata` | ✅ FK | SEO 元数据 |
| `seo_keywords` | ✅ FK | 关键词 |
| `seo_pages` | ✅ FK | 页面配置 |

### 2.9 多品牌管理表 (011_multi_brand_management.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `brand_domains` | ✅ FK | 域名映射 |
| `brand_user_assignments` | ✅ FK | 用户分配 |
| `shared_templates` | owner_brand_id | 共享模板 |
| `cross_brand_analytics` | ✅ FK | 跨品牌分析 |

### 2.10 内容原创性表 (012_content_originality.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `content_differentiation_logs` | ✅ FK | 差异化日志 |
| `originality_check_logs` | ✅ FK | 原创性检查 |

### 2.11 营销追踪表 (013_marketing_tracking.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `utm_sessions` | ✅ FK | UTM 会话 |
| `abandoned_carts` | ✅ FK | 弃购购物车 |
| `pixel_events` | ✅ FK | Pixel 事件 |
| `tracking_pixels_config` | ✅ FK | Pixel 配置 |

### 2.12 邮件序列表 (014_email_sequences.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `email_sequences` | ✅ FK | 邮件序列 |
| `email_sequence_steps` | 通过 sequence_id | 序列步骤 |
| `email_subscribers` | ✅ FK | 订阅者 |
| `email_send_logs` | ✅ FK | 发送日志 |

### 2.13 Web Vitals 表 (015_web_vitals.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `web_vitals_metrics` | ✅ FK | 性能指标 |
| `search_console_tokens` | ✅ FK | GSC Token |

### 2.14 高级 SEO 分析表 (016_advanced_seo_analysis.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `keyword_research` | ✅ FK | 关键词研究 |
| `seo_rankings` | ✅ FK | 排名监控 |
| `index_status` | ✅ FK | 索引状态 |
| `orphan_pages` | ✅ FK | 孤立页面 |
| `internal_links` | ✅ FK | 内链分析 |
| `seo_reports` | ✅ FK | SEO 报告 |
| `eeat_scores` | ✅ FK | E-E-A-T 评分 |

### 2.15 用户留存表 (017_user_retention.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `customer_points` | ✅ FK | 积分 |
| `points_transactions` | ✅ FK | 积分交易 |
| `membership_tiers` | ✅ FK | 会员等级 |
| `customer_memberships` | ✅ FK | 会员关系 |
| `referral_codes` | ✅ FK | 推荐码 |
| `referral_rewards` | ✅ FK | 推荐奖励 |

### 2.16 转化事件表 (018_conversions_events.sql)

| 表名 | brand_id | 用途 |
|------|----------|------|
| `conversion_events` | ✅ FK | 转化事件 |

## 3. 安全评估

### 3.1 优点

1. **Worker API 层完全控制** - 所有数据访问通过 Worker，可精确控制 brand_id 过滤
2. **service_role 隔离** - 前端无法直接访问数据库
3. **统一认证** - Admin API 使用 JWT + 品牌权限验证

### 3.2 风险点

1. **Worker 代码漏洞** - 如果 Worker 代码遗漏 brand_id 过滤，会导致数据泄露
2. **无数据库级防护** - RLS 未在 DB 层强制品牌隔离，依赖应用层
3. **Service Role Key 泄露** - 如果 Worker 的 service_role key 泄露，攻击者可访问所有数据

### 3.3 建议

#### 选项 A：保持当前架构（推荐）

当前 "service_role only" 模式是安全的，因为：
- 前端已完全迁移到 Worker API
- Worker 代码已实现品牌隔离
- 无直接 Supabase 连接

**后续工作**：
- 定期审计 Worker 代码确保 brand_id 过滤完整
- 添加 Worker 单元测试覆盖品牌隔离逻辑

#### 选项 B：添加数据库级品牌隔离（可选增强）

为关键表添加基于 JWT claims 的 RLS 策略：

```sql
-- 示例：使用 JWT claim 中的 brand_id
CREATE POLICY "Brand isolation for products"
ON products FOR ALL
USING (
  auth.role() = 'service_role' 
  OR brand_id = (auth.jwt() ->> 'brand_id')::uuid
);
```

**注意**：这需要修改 Worker 以在请求中传递 brand_id claim。

## 4. 结论

当前 RLS 架构 **安全可用**，品牌隔离由 Worker API 层强制执行。

**已验证**：
- ✅ 前端无 SSR Supabase 直连
- ✅ 所有 Admin API 使用认证 + 品牌权限
- ✅ 公开 API 使用 x-brand-id header 过滤

**待办**：
- [ ] 确认 `020_public_service_role_only.sql` 已在生产环境执行
- [ ] Worker 代码品牌隔离覆盖率审计
- [ ] 添加品牌隔离单元测试
