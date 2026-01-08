# 用户互动模块测试

## 模块概述

用户互动模块包含产品评论和 AI 智能客服聊天相关的 API 接口。

## 测试接口清单

| 序号 | 接口 | 方法 | 路径 | 优先级 |
|------|------|------|------|--------|
| 1 | 评论列表 | GET | `/api/reviews` | P0 |
| 2 | 评论统计 | GET | `/api/reviews/stats` | P1 |
| 3 | 提交评论 | POST | `/api/reviews` | P0 |
| 4 | 评论投票 | POST | `/api/reviews/:id/vote` | P1 |
| 5 | 发送聊天 | POST | `/api/chat` | P0 |
| 6 | 流式聊天 | POST | `/api/chat/stream` | P0 |

## 测试准备清单

### 1. 数据库准备

#### 必需的测试数据

```sql
-- 1. 依赖: 测试产品 (来自 01-电商核心)
-- 确保 products 表中有测试产品

-- 2. 测试评论 (不同状态和评分)
INSERT INTO reviews (id, brand_id, product_id, customer_name, customer_email, rating, title, content, status) VALUES
  ('rev-001', 'brand-test-001', 'prod-001', '张三', 'zhang@test.com', 5, '非常满意', '质量很好，推荐购买', 'approved'),
  ('rev-002', 'brand-test-001', 'prod-001', '李四', 'li@test.com', 4, '还不错', '性价比高', 'approved'),
  ('rev-003', 'brand-test-001', 'prod-001', '王五', 'wang@test.com', 3, '一般般', '有待改进', 'approved'),
  ('rev-004', 'brand-test-001', 'prod-001', '待审核', 'pending@test.com', 5, '待审核评论', '这是待审核的评论', 'pending'),
  ('rev-005', 'brand-test-001', 'prod-002', '赵六', 'zhao@test.com', 5, '好评', '很喜欢', 'approved');

-- 3. 测试投票记录
INSERT INTO review_votes (id, review_id, session_id, vote_type) VALUES
  ('vote-001', 'rev-001', 'session-001', 'helpful'),
  ('vote-002', 'rev-001', 'session-002', 'helpful');

-- 4. 知识库数据 (AI 聊天用)
INSERT INTO knowledge_base (id, brand_id, title, content, category, is_active) VALUES
  ('kb-001', 'brand-test-001', '退换货政策', '购买后7天内可无理由退换...', 'policy', true),
  ('kb-002', 'brand-test-001', '配送说明', '全国包邮，3-5个工作日送达...', 'shipping', true),
  ('kb-003', 'brand-test-001', '产品保修', '所有产品享受1年质保...', 'warranty', true);

-- 5. 测试对话记录
INSERT INTO conversations (id, brand_id, session_id, messages) VALUES
  ('conv-001', 'brand-test-001', 'session-test-001', '[]');
```

#### 数据验证

- [ ] 评论关联的产品存在
- [ ] 包含不同评分 (1-5) 的评论
- [ ] 包含不同状态 (pending/approved/rejected) 的评论
- [ ] 知识库数据已向量化 (用于 RAG)
- [ ] 投票记录存在用于统计测试

### 2. 环境配置

#### 请求头准备

```json
{
  "Content-Type": "application/json",
  "x-brand-id": "brand-test-001",
  "x-session-id": "test-session-001"
}
```

#### AI 服务配置

```bash
# .env.test
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
# 或使用 Mock 服务
AI_MOCK_ENABLED=true
```

### 3. 外部服务准备

#### DeepSeek API Mock (可选)

```javascript
// 用于测试环境减少 API 调用成本
const aiMock = {
  chat: async (messages) => ({
    choices: [{
      message: {
        content: '这是一个模拟的 AI 回复，用于测试目的。'
      }
    }]
  })
};
```

#### 向量数据库准备

- 确保知识库内容已生成向量嵌入
- 验证向量搜索功能正常

### 4. 测试账号准备

| 角色 | 标识 | 用途 |
|------|------|------|
| 新访客 | session-new-001 | 首次聊天测试 |
| 老访客 | session-old-001 | 历史对话测试 |
| 已购客户 | cust-001 | 已验证评论测试 |

## 测试场景

### 评论列表测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 产品评论 | `?product_id=prod-001` | 返回该产品已审核评论 |
| 评分筛选 | `?rating=5` | 仅返回 5 星评论 |
| 最新排序 | `?sort=newest` | 按时间降序 |
| 最热排序 | `?sort=helpful` | 按有用票数排序 |
| 分页 | `?page=1&limit=10` | 正确分页 |

### 提交评论测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 正常提交 | 完整评论信息 | 201 创建成功，status=pending |
| 缺少必填项 | 无 rating | 400 错误 |
| 评分越界 | rating=6 | 400 错误 |
| 重复提交 | 同 email+product | 400 已评论过 |
| XSS 防护 | content 含脚本 | 内容被转义 |

### AI 聊天测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 简单问候 | "你好" | 返回友好问候 |
| 产品咨询 | "手机A 价格多少" | 返回产品信息 |
| 政策查询 | "退货政策是什么" | 返回知识库内容 |
| 上下文对话 | 连续多轮对话 | 保持上下文 |
| 流式响应 | stream=true | SSE 格式响应 |

### 评论投票测试场景

| 场景 | 输入 | 预期结果 |
|------|------|----------|
| 首次投票 | vote_type=helpful | 投票成功 |
| 重复投票 | 同 session 再次投票 | 400 已投票 |
| 取消投票 | vote_type=null | 删除投票记录 |

## 测试命令

```bash
# 运行用户互动模块测试
npm run test:api -- --grep "02-用户互动"

# 仅运行评论相关测试
npm run test:api -- --grep "reviews"

# 仅运行聊天相关测试
npm run test:api -- --grep "chat"
```

## 注意事项

1. **AI 调用成本**: 测试环境建议使用 Mock 或限制调用次数
2. **流式响应测试**: 需要支持 SSE 的测试客户端
3. **向量搜索**: 确保测试数据已完成向量化
4. **评论审核**: 新评论默认 pending 状态，前端列表不显示
5. **并发投票**: 注意同一 session 的并发投票处理
