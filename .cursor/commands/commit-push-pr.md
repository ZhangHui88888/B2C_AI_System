# 提交 → 推送 → 创建 PR

自动完成完整的代码提交流程：

## 步骤

1. **检查状态**：`git status` 和 `git diff` 查看所有变更
2. **生成 commit message**：
   - 分析变更内容，生成符合 Conventional Commits 规范的提交信息
   - 格式：`type(scope): description`
   - type: feat / fix / refactor / test / docs / chore
3. **暂存并提交**：`git add` 相关文件 → `git commit`
4. **推送**：`git push -u origin HEAD`
5. **创建 PR**：使用 `gh pr create`，包含：
   - 标题：与 commit message 一致
   - 正文：变更摘要 + 测试计划

## 安全规则
- 不提交 .env、.dev.vars、credentials 等敏感文件
- 不强制推送到 main/master
- 提交前确认用户同意
