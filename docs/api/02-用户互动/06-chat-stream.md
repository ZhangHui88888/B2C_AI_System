# 流式聊天

## 基本信息

| 项目 | 值 |
|------|-----|
| **路径** | `/api/chat/stream` |
| **方法** | `POST` |
| **认证** | 不需要 |
| **权限** | 公开 |
| **路由文件** | `worker/src/routes/chat.ts` |

## 描述

向 AI 客服发送消息，获取流式回复 (Server-Sent Events)。

## 数据来源

```
读取表: brands.settings (AI配置), knowledge_base (RAG检索), conversations (对话历史)
写入表: conversations (保存消息)
外部服务: DeepSeek API (stream=true)
```

| 操作 | 来源/目标表 | 说明 |
|------|-------------|------|
| AI 配置 | `brands.settings` | `ai_enabled`, `ai_system_prompt` |
| 知识检索 | `knowledge_base` | 向量相似度搜索 `embedding <-> ?` |
| 对话历史 | `conversations` | `WHERE session_id = ?` |
| 保存消息 | `conversations` | INSERT 完整回复 (流结束后) |

## 请求参数

### Body (JSON)

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `message` | string | 是 | 用户消息 |
| `sessionId` | string | 否 | 会话 ID |

## 响应格式

响应为 Server-Sent Events (SSE) 流：

```
Content-Type: text/event-stream
```

### 事件格式

```
data: {"content": "部分回复内容"}

data: {"content": "更多内容"}

data: {"done": true, "sessionId": "uuid", "needsHuman": false}

data: [DONE]
```

## 前端使用示例

```javascript
const response = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello', sessionId })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(line => line.startsWith('data:'));
  
  for (const line of lines) {
    const data = line.replace('data: ', '').trim();
    if (data === '[DONE]') continue;
    
    const parsed = JSON.parse(data);
    if (parsed.content) {
      appendToChat(parsed.content);
    }
  }
}
```
