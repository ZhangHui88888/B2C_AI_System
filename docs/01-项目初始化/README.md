# 第1阶段：项目初始化

本阶段完成项目的基础架构搭建和数据库模型设计。

## 模块概述

- **1.1 基础架构** - 前后端项目结构、配置和工具链
- **1.2 数据库模型** - 完整的数据库表结构和关系设计

## 功能列表

| 序号 | 功能文档 | 状态 | 说明 |
|------|---------|------|------|
| 1.1 | [基础架构](./1.1-基础架构.md) | ✅ 已完成 | Astro前端、Worker后端、配置文件 |
| 1.2 | [数据库模型](./1.2-数据库模型.md) | ✅ 已完成 | 所有表结构、RLS策略、pgvector |

## 技术栈

- **前端**: Astro + TailwindCSS + TypeScript
- **后端**: Cloudflare Workers + Hono
- **数据库**: Supabase (PostgreSQL + pgvector)
- **部署**: Cloudflare Pages + Workers

## 相关文档

- [数据库脚本](../database/)
- [部署指南](../deployment/)