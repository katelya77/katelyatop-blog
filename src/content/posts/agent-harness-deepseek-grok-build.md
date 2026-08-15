---
title: 从 DeepSeek Harness 到 Grok Build：为什么 Harness 正在成为 Agent 时代的关键基础设施
author: Katelya
published: 2026-08-15
category: AI前沿
tags: [Agent, Harness, DeepSeek, Grok Build, MCP, AI编程]
draft: false
pinned: false
comment: true
description: 模型越来越强，但真正让 Coding Agent 稳定工作的往往是外层 Harness。本文从 DeepSeek V4 生态和 xAI 开源 Grok Build 出发，拆解 Harness 到底负责什么。
---

# 从 DeepSeek Harness 到 Grok Build：为什么 Harness 正在成为 Agent 时代的关键基础设施

2026 年讨论 Coding Agent 时，我觉得有一个词会越来越常见：**Harness**。

它很容易被翻译成“外壳”“框架”或者“运行时”，但这些词都只说对了一部分。

如果把大模型比作发动机，那么 Harness 更像整台车的 **变速箱、方向盘、刹车、仪表盘和控制系统**。

发动机马力再大，如果外面的控制系统不可靠，最后仍然跑不好。

## 先澄清：DeepSeek Harness 并不是一个唯一的官方产品

最近社区里出现了不少以 `deepseek-harness` 为名的项目，也有开发者围绕 DeepSeek V4 的 tool calling、reasoning history、streaming、cache 和长上下文行为做适配。

这里必须先区分两个概念：

- **DeepSeek V4 / DeepSeek API**：DeepSeek 官方模型与接口；
- **DeepSeek Harness**：更多时候是社区对“把 DeepSeek 接入 Agent 工作流的适配层”的称呼，并不存在一个唯一、统一的官方 DeepSeek Harness 产品。

这一点很重要。否则很容易把某个第三方 GitHub 项目的行为，误写成 DeepSeek 官方协议本身。

## 那 Harness 到底在干什么？

一个最小的聊天程序只需要：

```text
User Prompt
   ↓
Model API
   ↓
Assistant Text
```

但一个真正的 Coding Agent 至少会变成：

```text
Goal
 ↓
Context Builder
 ↓
Model
 ↓
Tool Calls ──→ Shell / Files / Browser / Git / MCP
 ↑                         ↓
 └──── Result + State + Retry + Verification
```

Harness 就存在于这条循环里。

它通常负责以下事情。

### 1. Context Assembly

模型并不知道你的仓库里哪些文件最重要。

Harness 要决定：

- system prompt 放什么；
- 当前 git diff 要不要加入；
- 哪些文件需要读取；
- tool result 保存多久；
- 上下文快满时怎么 compact；
- 哪些内容应该缓存，哪些应该丢弃。

一个 1M context 模型如果每轮都把垃圾信息塞满上下文，照样会变慢、变贵、变笨。

所以“上下文窗口大”与“上下文管理好”是两回事。

### 2. Tool Dispatch

模型输出一个 `tool_call` 只是开始。

Harness 还要处理：

- 参数是否合法；
- 文件路径是否越界；
- shell 命令是否危险；
- 多个并行 tool call 如何聚合；
- 工具失败是否重试；
- 工具返回结果是否需要截断。

很多所谓“模型 Agent 能力差”，实际可能是 Harness 把 tool call 解析错了。

### 3. State

长任务最怕模型“做到一半忘了自己在干什么”。

Harness 往往需要维护：

- todo / plan；
- 当前阶段；
- 已修改文件；
- 测试结果；
- 用户批准状态；
- 是否已经验证最终结果。

这也是为什么 CLI Agent 经常会有 plan mode、goal mode、task list 和 session resume。

### 4. Permission 与 Sandbox

让模型执行 shell 意味着模型可能拥有非常大的权限。

一个好的 Harness 不应该只问“模型想执行什么”，还要判断：

- 是否允许写出仓库；
- 是否允许删除文件；
- 是否允许联网；
- 是否允许修改 git history；
- 是否应该在 sandbox 中执行；
- 哪些操作必须人工确认。

这部分通常不会出现在模型 benchmark 里，却直接决定 Agent 能不能安全地用于真实项目。

### 5. Verification

模型说“完成了”，不代表真的完成了。

Harness 应该尽可能把“完成”的标准外部化，例如：

```bash
pnpm test
pnpm build
git diff --check
```

如果测试失败，就把失败结果重新送给模型继续修。

Agent 从 demo 走向工程，最关键的变化之一就是：

> 不再相信模型自称成功，而是让环境给出成功证据。

## xAI 为什么把 Grok Build 开源很有意思

2026 年 7 月 15 日，xAI 宣布开源 Grok Build。

官方公开的不只是一个简单 CLI，而是包括：

- agent loop；
- context assembly；
- tool dispatch；
- file / shell / search tools；
- terminal UI；
- skills；
- plugins；
- hooks；
- MCP servers；
- subagents。

这相当于把“模型外面的那一层”直接摊开给开发者看。

Grok Build 的仓库本身是 Rust 项目，可以交互式运行，也可以 headless 用于脚本和 CI，还支持通过 ACP 接入编辑器。

这让我觉得 2026 年 Coding Agent 的竞争已经从：

> 谁的模型更会写代码？

变成：

> 谁能让一个足够聪明的模型，在真实计算机环境里更稳定地工作？

## 为什么 DeepSeek V4 特别需要 Harness

DeepSeek V4-Pro 支持 1M context，并明显强化 Agentic 能力。

这会放大 Harness 的重要性。

因为长上下文意味着一次会话里可能出现：

- 数百次工具调用；
- 大量 reasoning history；
- 多轮代码修改；
- 长时间 streaming；
- 巨大的 prefix cache；
- 复杂的错误恢复。

任何一个协议细节没处理好，都可能让“模型很强”变成“实际很难用”。

社区围绕 DeepSeek V4 出现 Harness 项目，本质上就是在补这个工程层。

## MCP、Skills、Plugins 最终都会落到 Harness

现在 AI 工具生态里有很多名词：

- MCP；
- Skills；
- Plugins；
- Hooks；
- Subagents；
- ACP。

它们并不是互相替代的东西。

MCP 更多解决“工具如何被发现和调用”，Skills 解决“可复用工作方法”，Plugins 扩展能力，Hooks 在关键生命周期插入逻辑，Subagents 解决任务并行或职责隔离。

最终谁负责把这些东西加载、排序、授权、执行和记录？

还是 Harness。

## 我认为未来会出现“模型与 Harness 解耦”

现在很多 coding agent 把模型与运行时绑定得很紧。

但从 Grok Build 开源、OpenCode、Claude Code 兼容层、DeepSeek/Qwen 的多协议 API 等趋势来看，我觉得以后会越来越像浏览器与搜索引擎：

- Harness 是长期使用的工作环境；
- 模型是可以切换的智能后端。

一个优秀 Harness 可能同时支持 DeepSeek、Grok、Qwen、GPT 或本地模型。

这样开发者真正沉淀的资产就会变成：

- 项目规则；
- skills；
- MCP；
- 权限配置；
- memory；
- 自动化 workflow；
- eval。

而不是某一个模型的 prompt。

## 我的判断

如果 2024 年大家研究 Prompt，2025 年大家研究 Tool Calling，那么 2026 年非常值得研究的就是 **Harness Engineering**。

模型会不断升级，但一个可靠 Agent 需要的状态管理、上下文管理、权限、安全、重试和验证不会消失。

真正能把 AI 变成生产力的，往往不是最后那一点 benchmark，而是这些不那么“性感”的工程细节。

所以之后这个博客除了追新模型，我也会持续关注各家 Agent Harness 的设计。

这可能比单纯追逐“下一个模型编号”更有长期价值。

## 参考资料

- xAI：Grok Build is Now Open Source  
  https://x.ai/news/grok-build-open-source
- xAI 官方 Grok Build 仓库  
  https://github.com/xai-org/grok-build
- DeepSeek 官方 Agent 生态仓库  
  https://github.com/deepseek-ai/awesome-deepseek-agent
- DeepSeek V4 Preview Release  
  https://api-docs.deepseek.com/news/news260424
