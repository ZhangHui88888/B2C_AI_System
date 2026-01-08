# 01-电商核心

电商基础功能 API，包括产品、分类、购物车、订单和支付。

## 接口列表

### 产品 (products.ts)
- [01-获取产品列表](./01-products-list.md) - `POST /api/products/list`
- [02-获取产品详情](./02-products-detail.md) - `GET /api/products/:slug`

### 分类 (categories.ts)
- [03-获取分类列表](./03-categories-list.md) - `GET /api/categories`
- [04-获取分类详情](./04-categories-detail.md) - `GET /api/categories/:slug`

### 购物车 (orders.ts)
- [05-验证购物车](./05-cart-validate.md) - `POST /api/cart/validate`

### 订单 (orders.ts)
- [06-创建订单](./06-orders-create.md) - `POST /api/orders/create`
- [07-获取订单详情](./07-orders-detail.md) - `GET /api/orders/:id`

### 支付 (Stripe Webhook)
- 支付回调由 Stripe Webhook 处理，无需手动调用
