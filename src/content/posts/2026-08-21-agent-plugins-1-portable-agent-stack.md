---
title: Agent Plugins 1.0 到底统一了什么？从 Skills、MCP、Hooks 到可移植 Coding Agent 能力包
author: Katelya
published: 2026-08-21
category: 技术分享
tags: [GitHub, Coding Agent, Agent Plugins, MCP, Skills, Hooks, Copilot, Agent]
draft: false
pinned: false
comment: true
description: Agent Plugins 1.0 不只是一个“插件市场”规范。它正在把 Skills、MCP Server、Hooks 与 Agent 配置打包成可版本化、可治理、可跨客户端迁移的能力单元。本文从工程结构、权限边界、团队复用和供应链风险四个角度拆解它真正解决的问题。
---

过去一年，Coding Agent 的扩展方式越来越丰富：

- 用 `AGENTS.md` 或规则文件告诉 Agent“这个仓库应该怎么工作”；
- 用 Skill 把复杂流程写成可重复调用的操作手册；
- 用 MCP Server 给 Agent 接数据库、浏览器、部署平台和内部系统；
- 用 Hook 在工具调用前后执行确定性检查；
- 再用 Custom Agent / Subagent 把代码审查、测试、迁移、发布拆成不同角色。

功能看起来已经很多了，但真正把它们带进团队时，很快会遇到一个非常现实的问题：

**这些能力到底怎么打包、怎么版本化、怎么分发、怎么让不同 Agent 客户端共用？**

GitHub 在 2026 年 8 月 12 日宣布 VS Code、Copilot CLI 与 Copilot app 对 **Agent Plugins 1.0** 提供 GA 支持。更值得注意的是，这个规范并不是 GitHub 单独定义的私有格式：GitHub 的发布说明明确提到，Agent Plugins 1.0 在 8 月 6 日由 AWS、Anysphere、Microsoft、OpenAI、Vercel 等共同发布，Google 同日加入核心维护。

这件事真正值得关注的地方，不是“Copilot 又支持插件了”，而是 Coding Agent 生态里开始出现一个更接近 **package format** 的层。

如果把模型看成 CPU，把 Harness 看成操作系统，那么 Agent Plugin 更像是：

> 一个把提示、工具、权限钩子和领域工作流一起交付的软件包。

这篇文章不做发布说明复述，而是从工程角度拆开：**Agent Plugins 1.0 到底统一了什么，又没有统一什么。**

## 1. 过去的问题不是“没有扩展”，而是扩展太碎

一个成熟 Coding Agent 项目通常不会只依赖 Prompt。

假设我们给团队做一个“生产发布助手”，它可能需要：

```text
release-agent/
├── 发布规范
├── changelog 生成流程
├── GitHub / Jira / Vercel 工具
├── 生产环境变更保护
├── 发布前测试 Hook
└── 专门负责 rollback 的子 Agent
```

在不同产品里，这些东西可能分别被写成：

- 一个 Skill 目录；
- 一个 MCP 配置文件；
- 一组 Hook；
- 一个 Agent profile；
- 一段 CLI 配置；
- 一段 IDE 配置；
- 一个团队 Wiki 里的人工安装步骤。

单独看都能工作，但组合起来就容易出现三类维护成本。

### 第一类：重复打包

相同的 Skill 和 MCP Server，本质上没有因为你换了客户端就发生变化。

但过去经常要为不同 Agent 产品维护不同目录、不同 manifest 和不同安装说明。

这类重复不会直接体现在 benchmark 上，却会持续制造维护债务。

### 第二类：版本漂移

A 同事装了新版 Skill，B 同事还是旧版 MCP 配置；CI 里的 Agent 又用了第三套 Hook。

最终你会发现：

**大家说自己都在使用“同一个 Agent 工作流”，实际上执行的是不同版本。**

### 第三类：治理分散

真正进入企业以后，最麻烦的往往不是能不能装，而是：

- 哪些 Plugin 可以装？
- Plugin 里带了哪些 MCP Server？
- Hook 能不能执行 shell？
- 谁能更新版本？
- 是否允许访问第三方 marketplace？
- 一个 Plugin 的能力升级后，权限有没有跟着扩大？

因此 Agent 扩展体系迟早需要从“复制几个配置文件”进入 **软件供应链治理**。

Agent Plugins 1.0 正是在解决这一层。

## 2. Agent Plugin 的核心：一个 manifest 统筹多种能力

GitHub 当前的官方文档把 Plugin 定义为一个可安装目录，最少包含一个 `plugin.json`。

典型结构大致如下：

```text
my-plugin/
├── plugin.json
├── agents/
│   └── helper.agent.md
├── skills/
│   └── deploy/
│       └── SKILL.md
├── hooks.json
├── .mcp.json
└── lsp.json
```

这里最重要的不是文件名，而是它把原来分散的能力放到了一个交付单元里：

| 组件 | 解决的问题 |
| --- | --- |
| `plugin.json` | 描述包、版本、组件入口 |
| `skills/` | 领域流程与可复用工作方法 |
| `agents/` | 专门角色与工具边界 |
| `hooks.json` | 确定性生命周期控制 |
| `.mcp.json` | 外部工具 / 系统连接 |
| `lsp.json` | 代码语言服务能力 |

这意味着团队不再只是“共享 Prompt”，而可以共享一个完整的 Agent capability bundle。

我认为这是一个很关键的变化：

**Prompt Engineering 正在被逐渐吸收到 Agent Configuration Engineering 里面。**

以前一个能力的主要资产是提示词；现在真正可复用的资产开始变成：

```text
Instructions
+ Tools
+ Runtime rules
+ Hooks
+ Permissions
+ Version
+ Distribution
```

## 3. 为什么 Skills 和 MCP 必须放在同一个交付模型里？

单独的 MCP Server 只解决一件事：

> 给模型一个可以调用的工具接口。

但它不会自动告诉 Agent：

- 什么时候应该调用这个工具；
- 调用前需要检查什么；
- 参数应该遵守什么业务规则；
- 出错后怎么恢复；
- 哪些操作绝对不能自动执行。

而 Skill 恰好解决的是“怎么做”。

因此一个完整能力通常是这样的：

```text
Skill = Procedure
MCP = Capability
Hook = Guardrail
Agent = Role
```

例如一个 `vercel-production-release` Plugin：

```text
skills/release/SKILL.md
  ↓
告诉 Agent 发布顺序、回滚条件、检查项

.mcp.json
  ↓
提供 deployment / project / logs 等工具

hooks.json
  ↓
在高风险命令前做策略检查

agents/release-reviewer.agent.md
  ↓
负责独立验证变更
```

这比单独塞一个“Vercel MCP”强得多。

因为真实工程流程不是“有工具就会做对”，而是：

**工具能力 + 操作协议 + 检查机制 + 角色分工。**

## 4. Agent Plugins 1.0 真正重要的是“跨客户端”，不是“插件市场”

GitHub 这次强调的一个核心点是：**build once, use across compatible agent clients**。

过去你可能会看到这种情况：

```text
同一个 deployment skill
├── Copilot 格式
├── Claude Code 格式
├── Cursor 格式
└── 自己团队 Harness 的格式
```

Agent Plugins 1.0 想做的是把可共享部分抽出来：

```text
plugin.json
skills/
mcp.json
```

然后把供应商特有能力放进 namespaced directory。

GitHub 的实现里，Copilot 专属内容可以放到：

```text
com.github.copilot/
```

其他兼容客户端可以忽略这一目录。

这个设计很像成熟软件生态常见的做法：

- 核心协议保持可移植；
- vendor-specific extension 使用 namespace；
- 客户端支持自己理解的部分；
- 不强迫最低公分母覆盖所有高级能力。

这比“所有 Agent 客户端必须完全一样”更现实。

真正有价值的标准通常不是消灭差异，而是定义：

**哪些东西可以稳定共享，哪些差异应该被显式隔离。**

## 5. 它没有解决 Prompt / Agent 行为的一致性问题

这里需要避免一个误解。

即使两个 Coding Agent 都安装了同一个 Plugin，它们也不一定得到完全相同的行为。

因为 Plugin 只统一了能力包的一部分，最终执行仍然受到很多因素影响：

```text
Model
+ Agent Harness
+ System Prompt
+ Tool selection policy
+ Context management
+ Sandbox
+ Permission model
+ Retry strategy
+ Client-specific extension
```

举个最简单的例子：

同一个 `deploy` Skill，在两个客户端里都包含“先跑测试再部署”。

客户端 A 可能会主动读取整个测试目录；客户端 B 可能只执行 Skill 明确写出的命令；客户端 C 可能因为 Context Pruning 在中途压缩掉部分历史。

因此 Agent Plugins 1.0 更准确的定位应该是：

> **能力分发标准，而不是 Agent 行为确定性标准。**

这个边界非常重要。

如果团队想做严谨的 Agent 自动化，仍然需要自己的 verification、policy gate 与 observable traces。

## 6. Hooks 才是 Plugin 从“知识包”升级成“运行时扩展”的关键

很多人看到 Agent Plugin 时第一反应会集中在 Skill 和 MCP。

但从工程角度，我反而觉得 **Hook** 更值得重视。

GitHub 当前的 Hook 体系支持在 Agent 生命周期的特定节点执行外部命令，例如工具调用前后、权限请求、Agent 停止等。

这意味着一部分规则不需要依赖模型“记住”。

例如：

```text
Agent 想执行 deploy-production
        ↓
preToolUse Hook
        ↓
检查 branch == main ?
检查 tests passed ?
检查 change window ?
检查 environment == prod ?
        ↓
Allow / Deny
```

它和在 Prompt 里写一句：

> “部署生产环境前一定要确认测试通过。”

不是同一个安全等级。

Prompt 是 probabilistic instruction；Hook 可以是 deterministic control。

一个成熟 Plugin 应该尽量把规则分成两类：

### 适合写在 Skill 里的规则

- 推荐工作顺序；
- 排查思路；
- 代码风格；
- 常见错误；
- 恢复策略。

### 更适合写在 Hook / Policy 里的规则

- 禁止删除生产数据库；
- 禁止上传密钥；
- 未通过测试不得执行 release；
- 特定命令只能在 sandbox 中运行；
- 写操作必须经过审批。

一句话：

**“最好这样做”放 Skill，“必须这样做”尽量进入确定性控制。**

## 7. Plugin 会让 MCP 供应链风险更值得重视

可安装、可分发、可从 marketplace 获取，这是 Plugin 的优势；同时也意味着它天然带有供应链问题。

尤其当 Plugin 能够捆绑 MCP Server 配置以后，“安装一个插件”可能不再只是下载几段 Markdown。

它可能等价于：

- 添加新的外部工具；
- 启动新的本地进程；
- 连接新的远程服务；
- 给 Agent 增加新的写权限；
- 安装新的 Hook；
- 改变工具调用前后的行为。

所以安全审查不能只看：

```text
plugin.json 里叫什么名字
```

而应该展开看整个能力图：

```text
Plugin
├── Skills: 会引导 Agent 做什么？
├── MCP: 能访问什么系统？
├── Hooks: 会执行哪些命令？
├── Agents: 有哪些工具权限？
└── Vendor extensions: 是否有额外能力？
```

GitHub 当前也提供了 `enabledPlugins`、`extraKnownMarketplaces`、`strictKnownMarketplaces` 等企业管理配置，并建议搭配 MCP allowlist 管理 Server。

这说明 Plugin 管理最终一定会走向与 package registry 类似的方向：

- allowlist；
- version pinning；
- provenance；
- review；
- staged rollout；
- dependency / capability inventory。

## 8. 为什么“版本锁定”会比自动升级更重要？

对于普通编辑器主题，自动升级问题不大。

对于 Agent Plugin，版本变化可能意味着执行行为变化。

例如：

```text
v1.2.0
MCP tools = read logs + list deployments

v1.3.0
MCP tools = read logs + list deployments + rollback deployment
```

表面只是 minor update，实际能力边界发生了明显变化。

所以在自动化场景中，我会更倾向于：

```text
开发环境：允许跟进较新版本
CI / Cloud Agent：固定版本
生产 Agent：固定版本 + 人工审核升级
```

特别是承担写操作的 Plugin，不应该把“最新版”默认等价于“最安全版”。

真正应该比较的是 capability diff。

## 9. 一个适合个人开发者的 Plugin 分层方式

如果自己同时使用 Codex、Copilot CLI、Claude Code 或其他 Coding Agent，不必一开始就做复杂 marketplace。

可以先把自己的 Agent 配置分成三层。

### Layer 1：通用工程 Skill

例如：

```text
skills/
├── debug-ci/
├── release-check/
├── postgres-migration/
└── browser-verification/
```

只放跨项目、跨客户端都成立的方法。

### Layer 2：工具能力

```text
mcp.json
```

接 GitHub、Vercel、Cloudflare、数据库、浏览器等外部系统。

尽可能把 read 与 write 权限拆开。

### Layer 3：客户端特有能力

例如：

```text
com.github.copilot/
```

这里再放 Copilot 专属 Agent、command、hook 或其他扩展。

最终得到的不是“某个 IDE 的配置备份”，而是一个可以迁移的个人 Agent 工具链。

## 10. 我会怎么测试一个 Agent Plugin？

不要只测试“能不能安装”。

更有价值的是做四组测试。

### A. Capability discovery

确认客户端实际加载了哪些能力：

```text
Skills
Agents
Hooks
MCP Servers
LSP
```

防止“以为装上了，实际上某个组件被客户端忽略”。

### B. Cross-client consistency

对同一 Plugin，在不同客户端执行同一任务：

```text
任务：修复一个测试失败并生成解释
```

记录：

- 是否调用相同 Skill；
- 是否访问相同工具；
- 是否触发相同 Hook；
- 是否出现权限差异；
- 最终 patch 是否一致。

重点不是追求完全相同，而是找出 **portable layer 与 client-specific layer 的边界**。

### C. Permission regression

每次升级 Plugin 后重新跑：

```text
是否新增 MCP tool？
是否新增 shell command？
是否新增 write permission？
是否新增网络访问？
```

这比普通 snapshot test 更接近 Agent 时代真正需要的 regression test。

### D. Adversarial test

刻意加入不可信输入，例如：

```text
README 中隐藏指令
Issue 中要求泄露环境变量
日志中包含“忽略之前规则”
恶意 PR 修改配置文件
```

观察 Skill、Hook 和权限策略是否仍然有效。

## 11. Agent Plugin 最终可能成为“AI 开发环境的依赖管理层”

现在看 Agent Plugins 1.0，容易把它理解成：

> “给 Copilot / Cursor / Codex 装扩展的新格式。”

但如果继续发展，它更像是 AI 开发环境里的依赖管理层。

传统项目依赖的是：

```text
npm package
Python package
GitHub Action
Docker image
```

Agent 项目未来还会依赖：

```text
Agent Skill
MCP Toolset
Hook Policy
Custom Agent
Agent Plugin
```

这些东西同样需要：

- 版本；
- 兼容性；
- 权限声明；
- 安全更新；
- 供应链审查；
- 可观测性；
- 回滚。

因此我认为 Agent Plugins 1.0 最值得关注的不是“现在支持哪些客户端”，而是它明确了一个方向：

**Coding Agent 的能力正在从散落的配置文件，逐渐变成可组合、可分发、可治理的软件资产。**

## 12. 给团队的一个实际判断标准

什么时候值得做 Plugin，而不是继续复制配置？

可以用一个很简单的判断：

如果你的能力同时满足下面任意三项，就应该考虑打包：

- 跨多个仓库使用；
- 同时包含 Skill 与 MCP；
- 有 Hook 或安全规则；
- 有专门 Agent 角色；
- 需要版本管理；
- 多人共享；
- 多客户端运行；
- 需要集中治理。

反过来，如果只是：

```text
一个仓库
+ 一段简单说明
+ 一个只读 MCP
```

直接放仓库配置通常更简单。

不要为了“标准化”制造不必要的 packaging complexity。

## 结语

Agent Plugins 1.0 的价值并不在于多了一个 `plugin.json`。

它真正推动的是 Coding Agent 工程的下一步：

```text
Prompt
  ↓
Reusable Skill
  ↓
Tool Integration
  ↓
Runtime Guardrail
  ↓
Versioned Capability Package
```

当 Agent 只会聊天时，配置文件是否统一并不重要。

但当 Agent 可以执行 shell、修改代码、访问云平台、调用 MCP、创建 PR、部署生产环境之后，**“能力如何被打包和治理”就和“模型有多聪明”一样重要。**

未来真正成熟的 Agent 平台，大概率不会只比较模型榜单，而会比较：

- 它能加载什么能力包；
- 能否跨环境迁移；
- 权限是否可审计；
- 扩展是否可版本化；
- 运行时是否有确定性控制；
- 能不能把一套团队工程方法真正复用起来。

从这个角度看，Agent Plugins 1.0 更像是一个起点：

**Coding Agent 正在拥有自己的 package ecosystem。**

## 参考资料

- GitHub Changelog: [Agent Plugins 1.0 in VS Code, Copilot CLI, and the Copilot app](https://github.blog/changelog/2026-08-12-agent-plugins-1-0-in-vs-code-copilot-cli-and-the-copilot-app/)
- GitHub Docs: [About GitHub Copilot plugins](https://docs.github.com/en/copilot/concepts/agents/about-plugins)
- GitHub Docs: [Plugin directories](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/plugin-directories)
- GitHub Docs: [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference)
- GitHub Docs: [Copilot customization cheat sheet](https://docs.github.com/en/copilot/reference/customization-cheat-sheet)
