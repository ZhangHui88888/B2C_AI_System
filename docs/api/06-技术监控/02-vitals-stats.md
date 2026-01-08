# 获取 Web Vitals 统计

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/web-vitals/stats` |
| **方法** | `GET` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/web-vitals.ts` |

## 描述

获取网站的 Core Web Vitals 统计数据和趋势。

## 数据来源

```
主表: web_vitals
聚合: PERCENTILE_CONT(0.75) 计算 P75
```

| 数据 | 来源表 | 查询方式 |
|------|--------|----------|
| P75 指标 | `web_vitals` | `PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY lcp)` |
| 趋势数据 | `web_vitals` | `GROUP BY DATE(created_at)` |
| 页面排名 | `web_vitals` | `GROUP BY url ORDER BY lcp_p75 DESC` |

## 查询参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `days` | number | 否 | 30 | 统计天数 |
| `url` | string | 否 | - | 指定页面 |
| `device_type` | string | 否 | - | 设备类型 |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `summary` | object | 汇总数据 |
| `trend` | array | 趋势数据 |
| `pages` | array | 页面排名 |

### Summary 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `lcp_p75` | number | LCP 75分位 |
| `fid_p75` | number | FID 75分位 |
| `cls_p75` | number | CLS 75分位 |
| `inp_p75` | number | INP 75分位 |
| `good_percent` | number | 良好比例 |
| `samples` | number | 样本数 |

## 响应示例

```json
{
  "success": true,
  "summary": {
    "lcp_p75": 2200,
    "fid_p75": 95,
    "cls_p75": 0.08,
    "inp_p75": 180,
    "good_percent": 72,
    "samples": 15000
  },
  "trend": [
    {"date": "2024-01-08", "lcp_p75": 2200, "samples": 2100}
  ],
  "pages": [
    {"url": "/", "lcp_p75": 1800, "status": "good"},
    {"url": "/products", "lcp_p75": 2800, "status": "needs_improvement"}
  ]
}
```
