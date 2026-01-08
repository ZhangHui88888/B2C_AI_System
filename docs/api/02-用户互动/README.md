# 02-用户互动

用户互动功能 API，包括产品评论和 AI 智能客服。

## 接口列表

### 评论系统 (reviews.ts)
- [01-获取产品评论](./01-reviews-list.md) - `GET /api/reviews/product/:productId`
- [02-获取评论统计](./02-reviews-stats.md) - `GET /api/reviews/stats/:productId`
- [03-提交评论](./03-reviews-create.md) - `POST /api/reviews`
- [04-评论投票](./04-reviews-vote.md) - `POST /api/reviews/:id/vote`

### AI 客服 (chat.ts)
- [05-发送消息](./05-chat-send.md) - `POST /api/chat`
- [06-流式对话](./06-chat-stream.md) - `POST /api/chat/stream`
