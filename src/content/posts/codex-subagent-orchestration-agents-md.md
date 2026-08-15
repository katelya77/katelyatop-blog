---
title: Codex 子代理怎么编排才不乱？从 LINUX DO 的实践聊到 AGENTS.md 的真正用法
published: 2026-08-15
category: AI前沿
tags: [Codex, Agent, Subagent, AGENTS.md, AI编程, LINUX DO]
draft: false
pinned: false
comment: true
description: 从社区里的 Codex 子代理实践出发，结合 OpenAI 对多 Agent、AGENTS.md 与 Harness Engineering 的官方说明，整理一套更轻、更稳、更适合长期项目的编排思路。
---

最近逛 LINUX DO 时，我连续看到几篇关于 **Codex 子代理、AGENTS.md、Superpowers 与并行编排** 的讨论。它们表面上在分享配置文件，背后其实指向同一个问题：

> 当 AI Coding 从“一个模型帮我改代码”走向“多个 Agent 并行工作”，真正决定结果的已经不只是模型能力，而是你如何切任务、控制上下文、设计交接和验收。

我没有把社区里的提示词原样搬过来，而是重新对照了 OpenAI 关于 Codex、AGENTS.md、Multi-Agent 与 Harness Engineering 的官方说明，把其中值得长期保留的原则整理成这一篇。

## 一、为什么“规则越多”反而可能越差

很多人第一次开始认真配置 Codex，会下意识把所有要求都塞进 `AGENTS.md`：

- 项目结构；
- 编码规范；
- 测试命令；
- Git 规则；
- UI 约束；
- 部署流程；
- 安全规则；
- Reviewer 规则；
- Subagent 分工；
- 甚至连每一种任务的提示词都放进去。

这样做的直觉是“信息越完整，Agent 越聪明”，但长时间使用之后往往会出现相反结果：

1. 每次任务都要重复注入大量无关规则；
2. 真正重要的约束被埋在长文本中；
3. 小任务也被迫进入重流程；
4. 子代理继承太多上下文，角色边界越来越模糊；
5. 修改一条工作流规则时，需要重新维护一个越来越大的文件。

OpenAI 在 Harness Engineering 的官方文章里给出了一个很值得借鉴的思路：**把 `AGENTS.md` 当“目录”，而不是百科全书。**

也就是说，根目录只保留那些“每个任务都必须知道”的内容，其余知识沉淀在结构化文档里。

一个更健康的项目可能长这样：

```text
AGENTS.md
ARCHITECTURE.md
docs/
  design-docs/
  exec-plans/
  product-specs/
  runbooks/
.codex/
  agents/
    explorer.toml
    worker.toml
    reviewer.toml
```

根 `AGENTS.md` 负责告诉 Agent：

- 项目是什么；
- 哪些规则绝不能违反；
- 去哪里寻找更详细的信息；
- 哪些命令是最终验收标准。

而不是把所有细节一次性塞进上下文。

## 二、Multi-Agent 真正省下的不是时间，而是“上下文污染”

OpenAI 在 Codex App 的介绍里强调了多个 Agent 并行、独立线程以及 Worktree 隔离。社区里对 Subagent 的实践，也反复提到一个类似体验：**让不同 Agent 各自保持一个更小、更清晰的上下文，往往比让主 Agent 一个人把所有内容吃完更稳定。**

我更愿意把它理解成一种“上下文预算管理”。

例如一个中型功能需求，可以拆成：

```text
主 Agent
├─ Explorer：只读代码，定位相关模块与风险
├─ Worker A：处理后端逻辑
├─ Worker B：处理前端/UI
└─ Reviewer：只看 diff、测试和需求符合度
```

这里最重要的不是“同时跑四个模型”，而是每个 Agent 只需要看到它完成任务真正需要的信息。

### Explorer 不应该负责修复

Explorer 的职责应该非常单纯：

- 找入口；
- 找依赖；
- 找测试；
- 找历史实现；
- 汇报风险。

如果探索 Agent 一边查代码一边改文件，它很快就从“地图绘制者”变成了另一个 Worker，边界开始混乱。

### Worker 不应该重新做一遍全仓库研究

主 Agent 已经拿到 Explorer 的结论后，应该把一个**有边界的任务包**交给 Worker：

```text
目标：修复文章页 Hero 标题在移动端进入导航栏的问题
允许修改：ArticleHero.astro、article.css
不要修改：导航栏组件、后端逻辑、主题配置
验收：375px / 768px / 1024px 三个宽度下标题不越界
```

这比一句“帮我修一下标题 UI”稳定得多。

## 三、Reviewer 最有价值的地方：它没有参与实现

很多 AI Coding 工作流的一个隐性问题是：**负责写代码的 Agent，往往也是负责宣布“我写完了”的 Agent。**

这天然存在认知偏差。

所以在多 Agent 流程中，我认为 Reviewer 比额外再加一个 Worker 更重要。

Reviewer 最好只拿到：

- 原始需求；
- 最终 diff；
- 测试结果；
- 必要的上下文文档。

然后只回答几个问题：

1. 改动是否真的覆盖需求？
2. 有没有改到不应该改的范围？
3. 有没有遗漏边界条件？
4. 测试是否能证明结果，而不是仅仅“能跑”？
5. 有没有新增技术债？

一个没有参与实现的 Reviewer，往往更容易发现“实现看似漂亮，但其实偏题”的问题。

## 四、不要为了 Multi-Agent 而 Multi-Agent

这是我从社区实践里最想保留的一点。

有些任务天然不值得拆：

- 改一个 typo；
- 更新一条配置；
- 改 README 一句话；
- 已知位置的一行 bug；
- 单文件、小范围、可快速验证的修改。

如果这种任务也要：

`Planner → Explorer → Worker → Reviewer → Verifier`

那 Agent 编排本身就成了最大的成本。

一个更实用的判断方式是：

### 适合直接由主 Agent 完成

- 目标明确；
- 改动范围已知；
- 文件很少；
- 验收方式简单；
- 不存在明显并行价值。

### 适合使用 Subagent

- 需要跨模块搜索；
- 有两块以上相互独立的工作；
- 主上下文已经很长；
- 需要独立代码审查；
- 需要同时比较多种实现方案；
- 任务周期较长，中途可能发生上下文压缩。

## 五、AGENTS.md 应该写什么

如果让我重新设计一份轻量版，我会更倾向于下面这种结构：

```markdown
# 项目目标
一句话说明这个仓库做什么。

# 不可违反的约束
- 不破坏现有后端接口
- 不提交密钥
- 不跳过必要测试
- 不擅自修改部署架构

# 项目地图
- UI：src/components
- 内容：src/content
- 配置：src/config
- 测试：tests
- 详细架构：ARCHITECTURE.md

# 工作方式
- 小任务走最短路径
- 复杂任务先探索后实现
- 可并行且相互独立时才使用 Subagent
- Reviewer 不参与编码

# 验收
pnpm check
pnpm test
pnpm build
```

它的目标不是教 Agent 所有知识，而是让 Agent **知道什么最重要、去哪里继续找、最后怎么证明自己做对了。**

## 六、一个我更推荐的 Codex 子代理分工

对于个人项目，我认为不需要十几个角色，四个已经足够：

| 角色 | 主要职责 | 默认权限 |
| --- | --- | --- |
| Explorer | 查代码、找依赖、找风险 | 只读 |
| Worker | 实现一个边界清晰的任务 | 可写 |
| Reviewer | 审核 diff 与需求 | 只读 |
| Verifier | 跑测试、构建、回归 | 只读/执行 |

主 Agent 负责：

- 判断是否需要拆任务；
- 组织这些角色；
- 汇总结果；
- 对最终交付负责。

这比“每个角色都有复杂人格和几百行提示词”更容易长期维护。

## 七、我认为未来 AI Coding 的竞争点会从模型转向 Harness

如果把 2025 年看作“模型开始真正能写工程代码”，那么 2026 年越来越明显的趋势是：**模型能力正在逐渐商品化，而 Harness、上下文管理、工具权限、验证链路和多 Agent 协作成为新的差异化层。**

同一个模型，放在两个不同的工程环境里，最终效果可能完全不是一个级别。

真正高质量的 Agent 工作流更像一个软件团队：

```text
需求
  ↓
探索与拆解
  ↓
有限上下文任务包
  ↓
并行实现
  ↓
独立审查
  ↓
自动验证
  ↓
PR / CI / 部署
```

这也是为什么我越来越觉得：**未来值得学习的不只是“哪个模型最强”，而是如何设计一个让模型稳定工作的工程系统。**

## 参考资料

- LINUX DO：分享我自己使用的 Codex 子代理编排优化提示词（参考 Claude Code）  
  https://linux.do/t/topic/2607926
- LINUX DO：Codex 结合 Superpowers 的 AGENTS.md 轻量流程实践  
  https://linux.do/t/topic/1843525
- OpenAI：Harness engineering: leveraging Codex in an agent-first world  
  https://openai.com/index/harness-engineering/
- OpenAI：Introducing the Codex app  
  https://openai.com/index/introducing-the-codex-app/
- OpenAI：Introducing Codex / AGENTS.md 说明  
  https://openai.com/index/introducing-codex/

> 本文将社区讨论作为选题线索，并结合官方资料重新研究与整理，不是对原帖的逐段改写。
