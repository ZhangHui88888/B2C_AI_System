# 上报 Web Vitals

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/web-vitals` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/web-vitals.ts` |

## 描述

上报页面的 Core Web Vitals 指标数据。

## 数据来源

```
写入表: web_vitals
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 创建记录 | `web_vitals` | INSERT 性能指标记录 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `url` | string | 是 | 页面 URL |
| `lcp` | number | 否 | LCP (ms) |
| `fid` | number | 否 | FID (ms) |
| `cls` | number | 否 | CLS |
| `inp` | number | 否 | INP (ms) |
| `ttfb` | number | 否 | TTFB (ms) |
| `fcp` | number | 否 | FCP (ms) |
| `device_type` | string | 否 | 设备类型 |
| `connection_type` | string | 否 | 网络类型 |

## 请求示例

```json
{
  "url": "/products/iphone-15",
  "lcp": 2100,
  "fid": 80,
  "cls": 0.05,
  "inp": 150,
  "ttfb": 450,
  "device_type": "mobile",
  "connection_type": "4g"
}
```

## 响应示例

```json
{
  "success": true
}
```

## 指标说明

| 指标 | 全称 | 良好 | 需改进 | 差 |
|------|------|------|--------|-----|
| LCP | Largest Contentful Paint | ≤2.5s | ≤4.0s | >4.0s |
| FID | First Input Delay | ≤100ms | ≤300ms | >300ms |
| CLS | Cumulative Layout Shift | ≤0.1 | ≤0.25 | >0.25 |
| INP | Interaction to Next Paint | ≤200ms | ≤500ms | >500ms |
