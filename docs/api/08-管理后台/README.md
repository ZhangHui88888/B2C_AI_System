# 08-管理后台

管理后台 API，对应功能文档第4章"管理后台"。

## 接口列表

### 数据概览
- [01-获取数据概览](./01-overview.md) - `GET /api/admin/overview`

### 产品管理
- [02-获取产品列表](./02-products-list.md) - `GET /api/admin/products`
- [03-创建产品](./03-products-create.md) - `POST /api/admin/products`

### 订单管理
- [04-获取订单列表](./04-orders-list.md) - `GET /api/admin/orders`
- [05-更新订单状态](./05-orders-status.md) - `PUT /api/admin/orders/:id/status`

### 评论管理
- [06-获取评论列表](./06-reviews-list.md) - `GET /api/admin/reviews`
- [07-审核评论](./07-reviews-approve.md) - `PUT /api/admin/reviews/:id`
