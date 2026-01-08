# 发送聊天消息

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/chat` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/chat.ts` |

## 描述

向 AI 客服发送消息，获取回复。支持 RAG 知识库检索和对话历史。

## 数据来源

```
读取表: brands.settings (AI配置), knowledge_base (RAG检索), conversations (对话历史)
写入表: conversations (保存消息)
外部服务: DeepSeek API (AI生成回复)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| AI 配置 | `brands.settings` | `ai_enabled`, `ai_system_prompt`, `ai_welcome_message` |
| 知识检索 | `knowledge_base` | 向量相似度搜索 `embedding <-> ?` |
| 对话历史 | `conversations` | `WHERE session_id = ? ORDER BY created_at` |
| 保存消息 | `conversations` | INSERT 用户消息和AI回复 |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `message` | string | 是 | 用户消息 |
| `sessionId` | string | 否 | 会话 ID (首次对话可不传) |

## 请求示例

```json
{
  "message": "What are your return policies?",
  "sessionId": "uuid"
}
```

## 响应参数

| 参数 | 类型 | 描述 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `reply` | string | AI 回复内容 |
| `sessionId` | string | 会话 ID |
| `aiEnabled` | boolean | AI 是否启用 |
| `needsHuman` | boolean | 是否需要人工介入 |
| `handoffMessage` | string | 转人工提示 (可选) |

## 响应示例

```json
{
  "success": true,
  "reply": "Our return policy allows returns within 30 days of purchase...",
  "sessionId": "uuid",
  "aiEnabled": true,
  "needsHuman": false
}
```

## 说明

1. AI 功能需在品牌设置中启用 (`ai_enabled`)
2. 包含敏感关键词 (如 "退款"、"投诉") 会触发转人工
3. 消息会保存到对话历史，后续对话可引用上下文
4. 支持 RAG 检索，AI 会参考知识库内容回答
