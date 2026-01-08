# 电商核心模块测试

## 模块概述

电商核心模块包含产品、分类、购物车和订单相关的 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | 产品列表 | GET | `/api/products` | P0 |
| 2 | 产品详情 | GET | `/api/products/:slug` | P0 |
| 3 | 分类列表 | GET | `/api/categories` | P0 |
| 4 | 分类详情 | GET | `/api/categories/:slug` | P1 |
| 5 | 购物车验证 | POST | `/api/cart/validate` | P0 |
| 6 | 创建订单 | POST | `/api/orders` | P0 |
| 7 | 订单详情 | GET | `/api/orders/:id` | P0 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. 测试品牌
INSERT INTO brands (id, name, slug, is_active) VALUES 
  ('brand-test-001', 'Test Brand', 'test-brand', true);

-- 2. 测试分类 (含层级)
INSERT INTO categories (id, brand_id, name, slug, parent_id, is_active) VALUES
  ('cat-001', 'brand-test-001', '电子产品', 'electronics', null, true),
  ('cat-002', 'brand-test-001', '手机', 'phones', 'cat-001', true),
  ('cat-003', 'brand-test-001', '配件', 'accessories', 'cat-001', true);

-- 3. 测试产品 (不同状态)
INSERT INTO products (id, brand_id, category_id, name, slug, price, is_active, stock_status) VALUES
  ('prod-001', 'brand-test-001', 'cat-002', '测试手机A', 'test-phone-a', 999.00, true, 'in_stock'),
  ('prod-002', 'brand-test-001', 'cat-002', '测试手机B', 'test-phone-b', 1299.00, true, 'in_stock'),
  ('prod-003', 'brand-test-001', 'cat-003', '手机壳', 'phone-case', 29.00, true, 'in_stock'),
  ('prod-004', 'brand-test-001', 'cat-002', '下架产品', 'inactive-phone', 599.00, false, 'in_stock'),
  ('prod-005', 'brand-test-001', 'cat-002', '缺货产品', 'out-of-stock-phone', 799.00, true, 'out_of_stock');

-- 4. 测试客户
INSERT INTO customers (id, brand_id, email, name) VALUES
  ('cust-001', 'brand-test-001', 'test@example.com', 'Test Customer');
```

#### 数据验证

- [ ] 品牌数据存在且 `is_active = true`
- [ ] 分类层级关系正确 (parent_id)
- [ ] 产品分布在不同分类
- [ ] 包含各种库存状态的产品
- [ ] 包含上架/下架状态的产品

### 2. 环境配置

#### 请求头准备

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001"
}
```

#### Stripe 测试模式

- 确保使用 `sk_test_` 开头的测试密钥
- 准备测试卡号: `4242 4242 4242 4242`
- 配置 Webhook 端点接收测试事件

### 3. 测试账号准备

| 角色 | 邮箱 | 用途 |
|------|------|------|
| 普通客户 | test@example.com | 下单测试 |
| VIP 客户 | vip@example.com | 会员价格测试 |

### 4. 外部服务 Mock

#### Stripe API Mock

```javascript
// 测试时可使用 Stripe 测试模式
// 或配置本地 Mock 服务
const stripeMock = {
  paymentIntents: {
    create: async (params) => ({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_456',
      status: 'requires_payment_method'
    })
  }
};
```

## 测试场景

### 产品列表测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 默认列表 | 无参数 | 返回上架产品，分页 |
| 分类筛选 | `?category=phones` | 仅返回手机分类产品 |
| 价格排序 | `?sort=price_asc` | 按价格升序 |
| 搜索 | `?search=测试` | 返回匹配产品 |
| 分页 | `?page=2&limit=10` | 正确分页 |

### 订单创建测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 正常创建 | 有效商品+客户信息 | 返回订单 + Stripe Intent |
| 空购物车 | items: [] | 400 错误 |
| 无效商品 | 不存在的 product_id | 400 错误 |
| 缺货商品 | out_of_stock 产品 | 400 错误 |
| 超过库存 | quantity > 库存 | 400 错误 |

## 测试命令

```bash
# 运行电商核心模块测试
npm run test:api -- --grep "01-电商核心"

# 仅运行产品相关测试
npm run test:api -- --grep "products"

# 运行并生成覆盖率报告
npm run test:api -- --coverage --grep "01-电商核心"
```

## 注意事项

1. **订单测试后清理**: 测试创建的订单需要在测试后清理或标记
2. **Stripe Webhook**: 确保测试环境配置了正确的 Webhook 端点
3. **并发测试**: 库存相关测试注意并发场景
4. **金额精度**: 价格计算注意浮点数精度问题
