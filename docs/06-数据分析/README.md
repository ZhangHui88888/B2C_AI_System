# 第6阶段：数据分析

> 销售数据看板与业务洞察

---

## 📋 功能模块

### 6.1 数据看板

| 功能 | 状态 | 说明 |
|------|------|------|
| 销售概览 | ✅ | 今日/本周/本月销售额 |
| 销售趋势图 | ✅ | Chart.js 折线图 |
| 产品排行榜 | ✅ | Top 10 热销产品 |
| 客户分析 | ✅ | 客户价值分层（RFM） |
| 转化漏斗 | ✅ | 浏览→加购→结算→支付 |

---

## 🗂️ 相关文件

### 后端 API
- `worker/src/routes/analytics.ts` - 数据分析 API

### 前端页面
- `frontend/src/pages/admin/analytics/` - 数据分析后台
- `frontend/src/pages/admin/analytics/index.astro` - 分析看板
- `frontend/src/pages/admin/analytics/sales.astro` - 销售分析
- `frontend/src/pages/admin/analytics/products.astro` - 产品分析
- `frontend/src/pages/admin/analytics/customers.astro` - 客户分析

---

## 🔧 API 接口

### 销售概览

```typescript
// GET /api/analytics/overview?period=today|week|month|year
{
  "total_revenue": 12580.00,
  "order_count": 156,
  "average_order_value": 80.64,
  "conversion_rate": 3.2,
  "comparison": {
    "revenue_change": 12.5,      // 较上期 %
    "order_change": 8.3
  }
}
```

### 销售趋势

```typescript
// GET /api/analytics/sales?start=2024-01-01&end=2024-01-31&granularity=day
{
  "data": [
    { "date": "2024-01-01", "revenue": 450.00, "orders": 6 },
    { "date": "2024-01-02", "revenue": 680.00, "orders": 9 },
    ...
  ]
}
```

### 产品排行

```typescript
// GET /api/analytics/products?limit=10&sort=revenue|quantity
{
  "products": [
    { "id": "uuid", "name": "Product A", "revenue": 2500, "quantity": 50 },
    ...
  ]
}
```

### 转化漏斗

```typescript
// GET /api/analytics/funnel?period=month
{
  "funnel": [
    { "stage": "view", "count": 10000 },
    { "stage": "add_to_cart", "count": 800 },
    { "stage": "checkout", "count": 400 },
    { "stage": "purchase", "count": 320 }
  ]
}
```

---

## 📊 数据可视化

使用 **Chart.js** 进行图表渲染：

- 销售趋势：折线图
- 产品排行：柱状图
- 转化漏斗：漏斗图
- 客户分布：饼图

---

## 💡 客户分层（RFM 模型）

| 分层 | Recency | Frequency | Monetary | 说明 |
|------|---------|-----------|----------|------|
| 高价值 | 近期 | 高频 | 高额 | VIP 客户 |
| 潜力客户 | 近期 | 低频 | 中等 | 需激活复购 |
| 流失风险 | 较久 | 曾高频 | 曾高额 | 需挽回 |
| 新客户 | 近期 | 首次 | - | 需培养 |
