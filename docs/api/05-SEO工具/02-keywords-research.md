# 关键词研究

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/keywords/research` |
| **方法** | `POST` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/keywords.ts` |

## 描述

根据种子关键词进行扩展研究。

## 数据来源

```
写入表: keyword_research
外部服务: 关键词研究 API (搜索量/难度等数据)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 保存结果 | `keyword_research` | INSERT 关键词研究结果 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `seed_keyword` | string | 是 | 种子关键词 |
| `language` | string | 否 | 语言代码 |
| `country` | string | 否 | 国家代码 |
| `limit` | number | 否 | 返回数量 (默认 50) |

## 请求示例

```json
{
  "seed_keyword": "wireless headphones",
  "language": "en",
  "country": "US",
  "limit": 20
}
```

## 响应参数

### Keyword 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `keyword` | string | 关键词 |
| `search_volume` | number | 月搜索量 |
| `difficulty` | number | 难度 (0-100) |
| `cpc` | number | 每次点击成本 |
| `competition` | string | 竞争程度 |
| `intent` | string | 搜索意图 |
| `trend` | string | 趋势 |

### 搜索意图 (intent)

| 值 | 描述 |
|----|------|
| `informational` | 信息类 |
| `navigational` | 导航类 |
| `commercial` | 商业类 |
| `transactional` | 交易类 |

## 响应示例

```json
{
  "success": true,
  "seed_stats": {
    "search_volume": 110000,
    "difficulty": 65,
    "cpc": 1.25
  },
  "keywords": [
    {
      "keyword": "best wireless headphones 2024",
      "search_volume": 45000,
      "difficulty": 58,
      "cpc": 1.50,
      "competition": "medium",
      "intent": "commercial",
      "trend": "rising"
    }
  ]
}
```
