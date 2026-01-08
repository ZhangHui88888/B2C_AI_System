# Admin Security（后台安全）设计与实现

> 目的：把后台从“能用”升级到“安全可控（多租户 SaaS）”。

## 1. 威胁模型（必须解决的问题）

- **未鉴权访问**：任何人访问 `/api/admin/*` 都能读写后台数据。
- **越权访问**：普通后台用户能跨品牌操作其他 brand 的数据。
- **前端直连 Supabase**：即使 UI 做了限制，也容易绕过（直接调用 Supabase）。

## 2. 权限模型（原则）

- **Owner（平台所有者）**
  - 由 Worker 环境变量 `OWNER_EMAIL` 指定。
  - 允许跨品牌管理。

- **非 Owner（品牌后台用户）**
  - 只能访问自己被分配的品牌（brand-scoped）。

- **品牌上下文（brand context）**
  - 后台对 `/api/admin/*` 请求强制要求携带：`x-brand-id`。
  - Worker 对 `x-brand-id` 做授权校验。

## 3. 鉴权（Authentication）

- 前端登录使用 Supabase Auth（email/password）。
- 前端每次调用 `/api/admin/*` 必须带：
  - `Authorization: Bearer <supabase_jwt>`

Worker 侧：
- 校验 token 有效性：`supabase.auth.getUser(token)`。

## 4. 授权（Authorization）

### 4.1 Owner 识别

- `isOwner = (user.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase()) && env.OWNER_EMAIL 非空`

### 4.2 brand 管理权限

- `x-brand-id` 为具体 brand：
  - Owner：放行
  - 非 Owner：必须在 `admin_users.brand_ids` 或 `brand_user_assignments` 中有分配记录

- `x-brand-id = all`：
  - 仅允许 Owner 使用（用于跨品牌看板/汇总视图）

## 5. 前端实现要点（AdminLayout + BrandSwitcher）

### 5.1 AdminLayout 自动注入请求头

- 对所有 `/api/admin/*` 的 fetch 注入：
  - `Authorization`
  - `x-brand-id`（来自 cookie `brand_id`）

### 5.2 BrandSwitcher 获取可用品牌

- BrandSwitcher 不再直连 Supabase。
- 调用 Worker：`GET /api/admin/brands/available`
  - 返回 `brands: []` + `isOwner: boolean`
- 仅当 `isOwner=true` 才渲染 All Brands。

## 6. Worker 新增/调整的接口

- `GET /api/admin/brands/available`
  - Owner：返回所有 active brands
  - 非 Owner：返回被分配的 brands

## 7. 如何验证

- 登录后台后，Network 中应看到：
  - `GET /api/admin/brands/available` 返回 200

- 配置 `OWNER_EMAIL` 后：
  - Owner 登录应显示 All Brands
  - 非 Owner 不应显示 All Brands

## 8. 如何回滚

- 回滚前端 UI：
  - 恢复 BrandSwitcher 旧逻辑（不建议）

- 回滚安全模型（不建议）：
  - 去掉 Worker 对 `/api/admin/*` 的 JWT 校验/授权
  - 这会重新引入严重安全风险
