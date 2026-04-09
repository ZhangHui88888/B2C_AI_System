# 提交前全面验证

在提交代码前执行以下检查清单：

## 1. 构建检查
- 前端：`cd frontend && npm run build`
- Worker：`cd worker && npx wrangler deploy --dry-run`
- 确认无编译错误

## 2. 测试检查
- API 测试：`cd tests && npx vitest`
- E2E 测试：`cd tests && npx playwright test`
- 确认测试覆盖率不低于现有水平

## 3. 代码质量
- 运行 TypeScript 类型检查
- 检查是否有 `console.log`、`debugger`、`TODO` 遗留
- 确认无硬编码的密钥或凭据

## 4. 安全扫描
- 检查依赖是否有已知漏洞
- 确认无 .env / .dev.vars 文件被提交
- 检查 RLS 策略是否完整
- 验证 Stripe webhook 签名校验

## 5. 输出
以清单形式报告每项检查的通过/失败状态，标注需要修复的问题。
