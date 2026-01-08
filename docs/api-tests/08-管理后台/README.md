# 管理后台模块测试

## 模块概述

管理后台模块包含管理端的数据概览、产品管理、订单管理和评论管理等 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | 数据概览 | GET | `/api/admin/overview` | P0 |
| 2 | 产品列表 | GET | `/api/admin/products` | P0 |
| 3 | 创建产品 | POST | `/api/admin/products` | P0 |
| 4 | 订单列表 | GET | `/api/admin/orders` | P0 |
| 5 | 更新订单状态 | PUT | `/api/admin/orders/:id/status` | P0 |
| 6 | 评论列表 | GET | `/api/admin/reviews` | P1 |
| 7 | 审核评论 | PUT | `/api/admin/reviews/:id` | P1 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. 依赖数据：品牌、分类 (来自 07-系统管理 和 01-电商核心)

-- 2. 测试订单 (不同状态)
INSERT INTO orders (id, brand_id, order_number, customer_email, customer_name, items, subtotal, shipping_cost, total, status, created_at) VALUES
  ('order-001', 'brand-test-001', 'ORD-2025-0001', 'customer1@test.com', '客户A',
   '[{"product_id": "prod-001", "name": "测试手机A", "price": 999, "quantity": 1}]',
   999.00, 0, 999.00, 'pending', NOW() - INTERVAL '1 hour'),
  ('order-002', 'brand-test-001', 'ORD-2025-0002', 'customer2@test.com', '客户B',
   '[{"product_id": "prod-002", "name": "测试手机B", "price": 1299, "quantity": 2}]',
   2598.00, 0, 2598.00, 'paid', NOW() - INTERVAL '2 hours'),
  ('order-003', 'brand-test-001', 'ORD-2025-0003', 'customer3@test.com', '客户C',
   '[{"product_id": "prod-001", "name": "测试手机A", "price": 999, "quantity": 1}]',
   999.00, 9.99, 1008.99, 'shipped', NOW() - INTERVAL '3 days'),
  ('order-004', 'brand-test-001', 'ORD-2025-0004', 'customer4@test.com', '客户D',
   '[{"product_id": "prod-003", "name": "手机壳", "price": 29, "quantity": 3}]',
   87.00, 9.99, 96.99, 'delivered', NOW() - INTERVAL '7 days'),
  ('order-005', 'brand-test-001', 'ORD-2025-0005', 'customer5@test.com', '客户E',
   '[{"product_id": "prod-001", "name": "测试手机A", "price": 999, "quantity": 1}]',
   999.00, 0, 999.00, 'cancelled', NOW() - INTERVAL '5 days');

-- 3. 测试评论 (不同状态)
INSERT INTO reviews (id, brand_id, product_id, customer_name, customer_email, rating, title, content, status, created_at) VALUES
  ('rev-admin-001', 'brand-test-001', 'prod-001', '待审核用户', 'pending@test.com', 4, '等待审核', '这是一条待审核的评论', 'pending', NOW()),
  ('rev-admin-002', 'brand-test-001', 'prod-001', '已审核用户', 'approved@test.com', 5, '已通过', '这是一条已通过的评论', 'approved', NOW() - INTERVAL '1 day'),
  ('rev-admin-003', 'brand-test-001', 'prod-002', '被拒绝用户', 'rejected@test.com', 1, '被拒绝', '这是一条被拒绝的评论', 'rejected', NOW() - INTERVAL '2 days');

-- 4. 每日统计数据 (用于概览图表)
INSERT INTO daily_analytics (id, brand_id, date, revenue, orders_count, visitors, page_views, conversion_rate) VALUES
  ('da-001', 'brand-test-001', CURRENT_DATE - 6, 5000.00, 10, 500, 2000, 2.0),
  ('da-002', 'brand-test-001', CURRENT_DATE - 5, 6000.00, 12, 600, 2400, 2.0),
  ('da-003', 'brand-test-001', CURRENT_DATE - 4, 4500.00, 9, 450, 1800, 2.0),
  ('da-004', 'brand-test-001', CURRENT_DATE - 3, 7000.00, 14, 700, 2800, 2.0),
  ('da-005', 'brand-test-001', CURRENT_DATE - 2, 5500.00, 11, 550, 2200, 2.0),
  ('da-006', 'brand-test-001', CURRENT_DATE - 1, 8000.00, 16, 800, 3200, 2.0),
  ('da-007', 'brand-test-001', CURRENT_DATE, 3000.00, 6, 300, 1200, 2.0);
```

#### 数据验证

- [ ] 订单覆盖所有状态 (pending/paid/shipped/delivered/cancelled)
- [ ] 评论覆盖所有状态 (pending/approved/rejected)
- [ ] 每日统计数据连续 7 天
- [ ] 数据与品牌正确关联
- [ ] 产品数据已存在 (来自 01-电商核心)

### 2. 环境配置

#### 请求头准备

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001",
  "Authorization": "Bearer <admin_token>"
}
```

#### 邮件服务配置

```bash
# .env.test
RESEND_API_KEY=re_test_xxx

# 或使用 Mock
EMAIL_MOCK=true
```

### 3. 外部服务 Mock

#### Resend (邮件) Mock

```javascript
const resendMock = {
  emails: {
    send: async (params) => {
      console.log('Mock email sent:', params.to, params.subject);
      return { id: 'email_mock_123' };
    }
  }
};
```

### 4. 测试账号准备

| 角色 | 邮箱 | 权限 | 用途 |
|------|------|------|------|
| 品牌管理员 | brand-a@example.com | brand_manage | 完整 CRUD |
| 只读用户 | viewer@example.com | brand_viewer | 仅查看 |

## 测试场景

### 数据概览测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 默认 7 天 | period=7d | 返回 7 天统计 |
| 30 天 | period=30d | 返回 30 天统计 |
| 今日 | period=today | 返回今日数据 |
| 图表数据 | 默认 | 按天聚合的趋势数据 |
| 关键指标 | 默认 | 收入/订单/客户/转化率 |
| 同比数据 | 默认 | 与上一周期对比 |

### 产品列表测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 默认列表 | 无参数 | 返回所有产品 (含下架) |
| 状态筛选 | status=active | 仅上架产品 |
| 分类筛选 | category_id=cat-001 | 指定分类产品 |
| 搜索 | search=手机 | 名称匹配的产品 |
| 分页 | page=1&limit=10 | 正确分页 |
| 排序 | sort=created_at&order=desc | 最新创建的在前 |

### 创建产品测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 完整信息 | 所有必填字段 | 创建成功 |
| 最小信息 | 仅 name+price | 创建成功 |
| 缺少必填 | 无 name | 400 错误 |
| 重复 slug | 已存在的 slug | 400 或自动修改 |
| 无效分类 | 不存在的 category_id | 400 错误 |
| 负数价格 | price=-100 | 400 错误 |
| 自动生成 slug | 不传 slug | 由 name 生成 |

### 订单列表测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 默认列表 | 无参数 | 所有订单，最新在前 |
| 状态筛选 | status=pending | 仅待处理订单 |
| 日期筛选 | date_from=2025-01-01 | 指定日期后的订单 |
| 搜索订单号 | search=ORD-2025-0001 | 匹配的订单 |
| 搜索邮箱 | search=customer1@test.com | 匹配的订单 |
| 统计信息 | 默认 | 各状态订单数量 |

### 更新订单状态测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 发货 | status=shipped, tracking=xxx | 更新成功，发送邮件 |
| 送达 | status=delivered | 更新成功，发送邮件 |
| 取消 | status=cancelled | 更新成功 |
| 无效状态转换 | pending->delivered | 400 无效转换 |
| 已取消订单 | 更新已取消订单 | 400 不可更新 |
| 添加物流号 | tracking_number=SF123 | 更新成功 |

### 评论列表测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 默认列表 | 无参数 | 所有评论 (含待审核) |
| 状态筛选 | status=pending | 仅待审核评论 |
| 产品筛选 | product_id=prod-001 | 指定产品评论 |
| 评分筛选 | rating=5 | 仅 5 星评论 |
| 分页 | page=1&limit=10 | 正确分页 |

### 审核评论测试场景 (Admin)

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 通过审核 | status=approved | 更新成功 |
| 拒绝审核 | status=rejected | 更新成功 |
| 添加回复 | merchant_reply=xxx | 添加商家回复 |
| 只读用户 | brand_viewer Token | 403 无权限 |
| 跨品牌 | 其他品牌的评论 | 404 或 403 |

## 测试命令

```bash
# 运行管理后台模块测试
npm run test:api -- --grep "08-管理后台"

# 仅运行概览测试
npm run test:api -- --grep "overview"

# 仅运行产品管理测试
npm run test:api -- --grep "admin/products"

# 仅运行订单管理测试
npm run test:api -- --grep "admin/orders"

# 仅运行评论管理测试
npm run test:api -- --grep "admin/reviews"
```

## 注意事项

1. **权限测试**: 每个接口都要测试不同角色的权限
2. **品牌隔离**: 确保管理员只能访问自己品牌的数据
3. **状态机**: 订单状态转换有约束，需测试所有边界
4. **邮件发送**: 状态更新可能触发邮件，测试环境使用 Mock
5. **数据一致性**: 产品下架后相关订单/评论的处理
6. **并发更新**: 测试同时更新同一订单的情况
7. **审计日志**: 管理操作应有日志记录
