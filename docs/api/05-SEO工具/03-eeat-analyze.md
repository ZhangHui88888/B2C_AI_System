# E-E-A-T 评分分析

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/eeat/analyze` |
| **方法** | `POST` |
| **认证** | 需要 (Admin) |
| **权限** | brand_manage |
| **路由文件** | `worker/src/routes/eeat.ts` |

## 描述

分析内容的 E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) 评分。

## 数据来源

```
读取表: products / content_library (根据 content_type)
读取表: authors (作者信息用于 E-E-A-T 评估)
外部服务: DeepSeek API (AI 分析)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| 读取内容 | `products` / `content_library` | `WHERE brand_id = ? AND id = ?` |
| 作者信息 | `authors` | `WHERE id = content.author_id` |
| AI 分析 | DeepSeek API | 评估四维度得分 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `content_type` | string | 是 | 内容类型 |
| `content_id` | string | 是 | 内容 ID |

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `scores` | object | 四维评分 |
| `overall_score` | number | 总体评分 |
| `improvements` | array | 改进建议 |

### Scores 对象

| 字段 | 类型 | 描述 |
|------|------|------|
| `experience` | number | 经验分 (0-100) |
| `expertise` | number | 专业分 (0-100) |
| `authoritativeness` | number | 权威分 (0-100) |
| `trustworthiness` | number | 信任分 (0-100) |

## 响应示例

```json
{
  "success": true,
  "overall_score": 72,
  "scores": {
    "experience": 65,
    "expertise": 80,
    "authoritativeness": 70,
    "trustworthiness": 75
  },
  "improvements": [
    {
      "dimension": "experience",
      "priority": "high",
      "suggestion": "Add first-hand product usage photos",
      "impact": 15
    }
  ]
}
```

## 说明

- **Experience (经验)**: 作者是否有实际使用/体验
- **Expertise (专业)**: 作者是否有相关专业知识
- **Authoritativeness (权威)**: 作者/网站是否是该领域的权威
- **Trustworthiness (信任)**: 内容是否准确、诚实、安全
