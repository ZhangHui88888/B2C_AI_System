# Git Worktree 并行开发管理

管理 Git Worktrees，实现多功能分支并行开发。每个 worktree 是独立目录，用独立 Cursor 窗口打开，互不干扰。

## 操作

### 创建 worktree（开始并行任务时）
```bash
git worktree add ../wt-<功能名> -b feature/<功能名> main

# 示例
git worktree add ../wt-checkout -b feature/checkout main
git worktree add ../wt-ai-chat -b feature/ai-chat main
```

创建后提示用户：用 `File → Open Folder` 在新 Cursor 窗口打开 worktree 目录。

### 查看 worktree 状态
```bash
git worktree list
```

### 完成并清理 worktree
```bash
git checkout main
git merge feature/<功能名>
git worktree remove ../wt-<功能名>
git push origin --delete feature/<功能名>
```

## 命名规范
- worktree 目录：`../wt-<简短功能名>`（与主仓库同级）
- 功能分支：`feature/<功能名>`
- 修复分支：`bugfix/<问题描述>`

## 注意事项
- 每个 worktree 锁定一个分支，不能多个 worktree 共用同一分支
- worktree 中的 `.cursor/memory/context.md` 是独立的，互不干扰
- 推荐起步 2-3 个并行 worktree，模块耦合度高时不宜过多
- 完成后及时清理，避免 worktree 堆积
