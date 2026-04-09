# 保存工作检查点

保存当前工作状态，以便后续回滚或恢复。

## 步骤

1. **创建 stash 或 commit**：
   - 如果有未暂存的更改，创建 `git stash` 并命名
   - 或创建一个 WIP commit：`git commit -m "WIP: checkpoint - [简述当前状态]"`

2. **记录当前上下文**：
   写入 `.cursor/memory/checkpoint.md`：
   - 当前正在做什么
   - 哪些文件被修改了
   - 下一步计划是什么
   - 已知的未解决问题

3. **报告**：告知用户检查点已保存，以及如何恢复。
