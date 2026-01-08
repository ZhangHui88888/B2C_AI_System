# 系统管理模块测试

## 模块概述

系统管理模块包含站点配置、品牌管理和系统设置等 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | 获取站点配置 | GET | `/api/site-config` | P0 |
| 2 | 获取品牌列表 | GET | `/api/admin/brands` | P1 |
| 3 | 获取品牌设置 | GET | `/api/admin/settings` | P0 |
| 4 | 更新品牌设置 | PUT | `/api/admin/settings` | P0 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. 测试品牌 (多品牌)
INSERT INTO brands (id, name, slug, logo_url, settings, is_active) VALUES
  ('brand-test-001', 'Test Brand A', 'test-brand-a', 
   'https://example.com/logo-a.png',
   '{"currency": "USD", "timezone": "America/New_York", "theme": {"primary_color": "#3B82F6"}}',
   true),
  ('brand-test-002', 'Test Brand B', 'test-brand-b',
   'https://example.com/logo-b.png', 
   '{"currency": "CNY", "timezone": "Asia/Shanghai", "theme": {"primary_color": "#EF4444"}}',
   true),
  ('brand-test-003', 'Inactive Brand', 'inactive-brand',
   null,
   '{}',
   false);

-- 2. 域名绑定
INSERT INTO brand_domains (id, brand_id, domain, is_primary) VALUES
  ('domain-001', 'brand-test-001', 'brand-a.example.com', true),
  ('domain-002', 'brand-test-001', 'www.brand-a.example.com', false),
  ('domain-003', 'brand-test-002', 'brand-b.example.com', true),
  ('domain-004', 'brand-test-002', 'brand-b.cn', false);

-- 3. 品牌设置
INSERT INTO settings (id, brand_id, key, value, category) VALUES
  ('set-001', 'brand-test-001', 'shipping_default_cost', '9.99', 'shipping'),
  ('set-002', 'brand-test-001', 'shipping_free_threshold', '99', 'shipping'),
  ('set-003', 'brand-test-001', 'tax_rate', '0.08', 'tax'),
  ('set-004', 'brand-test-001', 'contact_email', 'support@brand-a.com', 'contact'),
  ('set-005', 'brand-test-001', 'social_facebook', 'https://facebook.com/brand-a', 'social'),
  ('set-006', 'brand-test-002', 'shipping_default_cost', '15', 'shipping'),
  ('set-007', 'brand-test-002', 'currency', 'CNY', 'general');

-- 4. 管理员用户
INSERT INTO admin_users (id, email, name, role, brand_ids, is_active) VALUES
  ('admin-001', 'super@example.com', 'Super Admin', 'super_admin', '[]', true),
  ('admin-002', 'brand-a@example.com', 'Brand A Admin', 'brand_admin', '["brand-test-001"]', true),
  ('admin-003', 'brand-b@example.com', 'Brand B Admin', 'brand_admin', '["brand-test-002"]', true),
  ('admin-004', 'viewer@example.com', 'Viewer', 'brand_viewer', '["brand-test-001"]', true);
```

#### 数据验证

- [ ] 多个品牌存在且配置不同
- [ ] 域名正确绑定到品牌
- [ ] 设置项覆盖各分类
- [ ] 管理员角色分配正确
- [ ] 包含活跃和非活跃品牌

### 2. 环境配置

#### 请求头准备 (公开接口)

```json
{
  "Content-Type": "application/json",
  "Host": "brand-a.example.com"
}
```

#### 请求头准备 (管理接口)

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001",
  "Authorization": "Bearer <admin_token>"
}
```

### 3. 测试账号准备

| 角色 | 邮箱 | 权限 | 可访问品牌 |
|------|------|------|-----------|
| 超级管理员 | super@example.com | super_admin | 全部 |
| 品牌A管理员 | brand-a@example.com | brand_admin | brand-test-001 |
| 品牌B管理员 | brand-b@example.com | brand_admin | brand-test-002 |
| 只读用户 | viewer@example.com | brand_viewer | brand-test-001 |

### 4. 认证 Token 获取

```bash
# 超级管理员 Token
curl -X POST /api/admin/auth/login \
  -d '{"email": "super@example.com", "password": "superpass"}'

# 品牌管理员 Token
curl -X POST /api/admin/auth/login \
  -d '{"email": "brand-a@example.com", "password": "brandpass"}'
```

## 测试场景

### 站点配置测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 域名识别 | Host: brand-a.example.com | 返回品牌 A 配置 |
| 备用域名 | Host: www.brand-a.example.com | 返回品牌 A 配置 |
| 另一品牌 | Host: brand-b.example.com | 返回品牌 B 配置 |
| 未知域名 | Host: unknown.example.com | 404 或默认配置 |
| 非活跃品牌 | 绑定到 inactive-brand | 404 或错误 |
| 显式指定 | ?host=brand-a.example.com | 返回品牌 A |

### 品牌列表测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 超级管理员 | super_admin Token | 返回所有品牌 |
| 品牌管理员 | brand_admin Token | 403 无权限 |
| 分页 | page=1&limit=10 | 正确分页 |
| 状态筛选 | is_active=true | 仅活跃品牌 |
| 统计信息 | 默认 | 包含产品/订单数量 |

### 获取设置测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 品牌管理员 | brand_admin Token | 返回本品牌设置 |
| 只读用户 | brand_viewer Token | 返回本品牌设置 |
| 跨品牌访问 | 品牌 A Token 访问品牌 B | 403 无权限 |
| 超级管理员 | super_admin + 任意品牌 | 成功 |

### 更新设置测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 单项更新 | key=shipping_cost, value=12.99 | 更新成功 |
| 批量更新 | 多个 key-value | 批量更新成功 |
| 只读用户 | brand_viewer Token | 403 无权限 |
| 无效 key | key=invalid_key | 400 或忽略 |
| 类型验证 | tax_rate="abc" | 400 类型错误 |
| 品牌隔离 | 更新其他品牌 | 403 无权限 |

## 测试命令

```bash
# 运行系统管理模块测试
npm run test:api -- --grep "07-系统管理"

# 仅运行站点配置测试
npm run test:api -- --grep "site-config"

# 仅运行品牌管理测试
npm run test:api -- --grep "brands"

# 仅运行设置测试
npm run test:api -- --grep "settings"

# 测试站点配置 (手动)
curl -X GET https://brand-a.example.com/api/site-config
```

## 注意事项

1. **多品牌隔离**: 严格测试品牌间的数据隔离
2. **域名解析**: 测试环境需配置测试域名或 Mock Host 头
3. **权限边界**: 仔细测试各角色的权限边界
4. **设置缓存**: 设置更新后可能有缓存，注意清除
5. **敏感设置**: 某些设置 (如 API Key) 不应返回完整值
6. **默认值**: 缺失设置应有合理默认值
