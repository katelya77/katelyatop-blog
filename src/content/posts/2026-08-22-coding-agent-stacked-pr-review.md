---
title: Coding Agent 最大的问题不是写得慢，而是一次写太多：从 Stacked PR 重构 AI 代码评审

author: Katelya
published: 2026-08-22
category: 技术分享
tags: [Coding Agent, GitHub, Stacked PR, Code Review, Copilot, AI Engineering, DevEx]
draft: false
pinned: false
comment: true
description: Coding Agent 可以在几分钟内生成上千行改动，但评审者的认知带宽没有同步增长。本文从 GitHub stacked pull requests 出发，拆解为什么 Agent 时代真正需要优化的是 change decomposition、review surface、CI 边界与依赖链，而不是继续追求“一次生成更多代码”。
---

过去讨论 Coding Agent，最常见的问题是：

```text
它能不能一次完成更大的任务？
```

但真正把 Agent 接进真实仓库以后，我越来越觉得这不是最重要的问题。

一个 Agent 如果能在 8 分钟内修改 20 个文件、写 1200 行代码、补测试、改接口、顺手重构几个旧模块，表面上看生产力很高；但如果最后落下来的是一个没有清晰边界的巨大 Pull Request，那么真正的瓶颈只会从“写代码”转移到“人类怎么确认这些代码是对的”。

于是 Agent 时代出现了一个非常现实的反直觉现象：

> **生成代码的吞吐越来越高，评审代码的吞吐却没有同步提高。**

GitHub 在 2026 年 8 月公开的一篇工程文章里，专门用 stacked pull requests 讨论这个问题。官方示例把一个 1700+ 行、同时涉及数据层、API、业务连接与 UI 的巨大改动，拆成多个存在明确依赖关系的小 PR，让每一层都可以独立理解、验证和评审。

这篇文章不复述 GitHub 教程，而是从 Coding Agent 工程的角度进一步拆开一个问题：

**未来 AI 开发流程真正需要优化的，可能不是“让 Agent 一次写更多”，而是“让 Agent 自动生成更容易被人类验证的变更结构”。**

## 1. Agent 让“大 PR”问题变得更严重了

传统人工开发里，一个 PR 变得过大通常是渐进发生的。

你先改一个模块，再发现接口要调整，再补几个测试，最后 UI 也跟着改。

等准备提交时才发现：

```text
26 files changed
+1847 / -612
```

Coding Agent 不一样。

它可以在一轮任务里极快地完成跨层修改：

```text
需求分析
  ↓
搜索仓库
  ↓
改 schema
  ↓
改 API
  ↓
改 service
  ↓
改 UI
  ↓
补 test
  ↓
跑 lint / build
```

从 Agent 视角看，这是一条连续任务链。

从 Reviewer 视角看，却可能是六个不同的评审问题被压进同一个 diff。

例如一个“给聊天应用增加商品搜索”的任务，可能同时包含：

- 数据模型；
- seed data；
- API validation；
- search endpoint；
- chat grounding；
- loading / empty / error states；
- 产品引用卡片 UI。

这些内容虽然都属于同一个 Feature，但它们并不属于同一个认知单元。

因此真正的问题不是：

```text
Agent 有没有完成整个 feature？
```

而是：

```text
Reviewer 能不能在有限注意力里证明每个变化都正确？
```

## 2. Code Review 的瓶颈是“认知工作集”

Review 一个 PR 并不是逐行检查代码有没有语法错误。

真正困难的是 Reviewer 需要在脑内建立一个临时模型：

```text
旧系统怎么工作？
这次为什么改？
有哪些新增状态？
数据从哪里来？
接口契约变了吗？
异常路径是什么？
测试覆盖了什么？
有没有引入跨模块副作用？
```

PR 越大，这个临时模型越难维持。

可以把它理解成一种 **review working set**。

如果一个 PR 同时要求 Reviewer 记住：

```text
数据库 schema
+ API 参数校验
+ service abstraction
+ React state
+ cache invalidation
+ Playwright 测试
```

那不是“多看几行代码”的问题，而是 Reviewer 必须不断在不同抽象层之间切换。

这也是为什么 1000 行改动不一定只是 100 行改动的十倍评审成本。

认知切换会让成本非线性上升。

## 3. Stacked PR 的核心不是“多个 PR”，而是依赖结构显式化

Stacked PR 经常被简单理解成：

> 把一个大 PR 拆成几个小 PR。

这还不够准确。

真正关键的是：**这些 PR 之间有明确顺序和依赖关系。**

例如：

```text
main
 ↓
L1: feat/catalog-data
 ↓
L2: feat/search-api
 ↓
L3: feat/chat-grounding
 ↓
L4: feat/grounded-ui
```

这里每一层都不是独立平行分支。

L2 依赖 L1，L3 依赖 L2，L4 依赖 L3。

于是整个 Feature 被重新表示成：

```text
Feature = 一条可验证的依赖链
```

而不是：

```text
Feature = 一个巨大 diff
```

这对 Coding Agent 特别重要，因为 Agent 本身非常擅长做依赖分析和任务分解。

## 4. 为什么 Agent 比人更适合维护 Stack？

过去很多团队不愿意用 stacked PR，并不是因为不知道“小 PR 更好”，而是因为维护起来麻烦。

传统人工流程里需要不断处理：

```text
branch A 更新
→ branch B 要 rebase
→ branch C 又依赖 B
→ review 修复进入 A
→ 后面全部同步
```

于是很容易变成：

```text
review 更轻松
但 branch management 更痛苦
```

Coding Agent 恰好能吃掉这一类机械成本。

它可以负责：

- 维护依赖顺序；
- 自动 rebase / restack；
- 检查每层 CI；
- 根据底层 review 修改同步后续层；
- 更新 PR description；
- 重新跑受影响测试；
- 提醒 stack 中哪一层变得 stale。

换句话说，人类真正不擅长的 stacked PR 运维，反而正好是 Agent 很擅长的确定性工作。

所以 Agent 并不是让 stacked PR 过时，而可能让 stacked PR 第一次真正变得低成本。

## 5. 一个更适合 Agent 的任务分解方式

我不会直接告诉 Agent：

```text
实现完整商品搜索功能
```

然后期待它最后自动生成一个漂亮 PR。

更可靠的 Harness 应该先要求生成 change graph。

例如：

```text
Goal: 商品搜索

Dependency graph:

Data model
  ↓
Search service
  ↓
API endpoint
  ↓
Chat integration
  ↓
UI citation state
```

然后再根据几个规则决定是否应该拆层。

### 规则一：不同抽象层尽量拆开

数据库、API、业务逻辑、UI 通常天然适合不同 PR。

### 规则二：不同 reviewer ownership 尽量拆开

例如：

```text
Data owner → L1
Backend owner → L2
Frontend owner → L3/L4
```

这比把所有人都拉进一个大 PR 更有效。

### 规则三：每层应该有独立验证信号

例如：

```text
L1 → unit test / schema validation
L2 → API contract test
L3 → integration test
L4 → browser / visual test
```

如果一个层无法独立验证，说明拆分边界可能还不够好。

### 规则四：不要为了“小”而切碎

反面极端也存在。

如果一个 60 行改动被拆成 8 个 PR，Reviewer 反而要来回跳转更多上下文。

真正目标不是：

```text
PR 越小越好
```

而是：

```text
每个 PR 恰好对应一个可独立理解的 change unit
```

## 6. 我更关心“Review Surface”，而不是 LOC

传统 PR 规模经常用 lines changed 衡量。

例如：

```text
small < 200 LOC
medium < 500 LOC
large > 1000 LOC
```

但 Agent 时代我更想引入一个概念：

**Review Surface。**

它不只是行数，而是 Reviewer 需要同时理解多少种变化。

例如两个 PR 都是 400 行。

PR A：

```text
新增一个独立 parser
+ parser unit tests
```

PR B：

```text
改数据库字段
+ 改 API
+ 改 auth
+ 改 UI
+ 改缓存策略
```

它们的 LOC 相近，但评审难度完全不同。

可以粗略把 review surface 表示成：

```text
Review Surface
≈ changed modules
× abstraction layers
× behavior paths
× ownership boundaries
```

这不是严格数学公式，但比单看 LOC 更接近现实。

## 7. Coding Agent 的任务成功率应该把“可评审性”算进去

现在很多 Agent benchmark 只判断：

```text
tests passed ?
```

或者：

```text
issue resolved ?
```

但企业实际采用 Agent 时，还有一个关键指标：

```text
这个 patch 是否容易被安全地接受？
```

我会增加几项指标。

### Review Time

从 PR ready 到 Reviewer 能做出 accept / request changes 的时间。

### Review Reopen Count

一个 PR 因上下文不清、scope 混杂而来回要求拆分多少次。

### Cross-layer Correction Rate

Reviewer 修复底层问题以后，有多少上层逻辑也需要跟着重做。

### Change Rejection Cost

如果最后决定不要这个 Feature，回滚需要撤销多少无关改动。

### Reviewer Context Switches

一次 Review 需要切换多少技术域。

这些指标能区分两种 Agent：

```text
Agent A：一次写 1800 行，测试全绿
Agent B：拆成 4 层，每层验证清晰
```

在真实团队里，B 往往更容易进入生产。

## 8. Stack 中每一层都应该有自己的 CI Gate

Stacked PR 最大的风险之一，是大家把所有验证都推到最顶层。

这样底层 PR 看起来虽然小，但并不能证明自身正确。

更合理的是：

```text
L1
  → unit tests
  → type check
  → schema validation

L2
  → inherited L1
  → API contract tests

L3
  → inherited L2
  → integration tests

L4
  → inherited L3
  → Playwright / visual verification
```

这里一个非常重要的原则是：

> **每层负责证明自己新增的风险。**

底层已经验证过的事实，不需要 Reviewer 在每一层重新从零证明。

这也是 stack 能降低认知成本的原因。

## 9. Review 顺序为什么通常应该 bottom-up？

GitHub 的官方文章提到一个很实用的阅读方式：可以先从 Stack 顶部理解最终目标，但具体 Review 应该从底层往上。

原因很简单。

假设：

```text
L4 UI
依赖 L3 chat integration
依赖 L2 API
依赖 L1 data model
```

如果 L1 的数据模型设计就是错的，那么直接 Review L4 的 UI 细节价值有限。

底层稳定以后，上层的语义才有可靠基础。

因此更合理的流程是：

```text
先理解 top-level intent
       ↓
Review L1
       ↓
Review L2
       ↓
Review L3
       ↓
Review L4
```

对于 Agent 生成的改动，这一点更关键。

Agent 很可能在最初错误假设上继续构建大量后续代码。

越早在底层阻断错误，浪费越少。

## 10. Agent 应该什么时候自动拆 Stack？

不是所有任务都值得 stacked PR。

我会给 Harness 设置一些触发条件。

例如满足任意两三项时自动进入 decomposition mode：

```text
changed files > 10
estimated diff > 500 LOC
跨越 3 个以上目录
涉及 DB + API + UI
需要多个 reviewer ownership
存在明确依赖链
预计任务时间 > 30 min
```

然后 Agent 输出：

```text
Proposed stack:
L1: foundation
L2: backend behavior
L3: integration
L4: UI
```

由人或 policy 选择是否接受。

这比等 PR 已经膨胀到 2000 行再人工要求“请拆一下”高效得多。

## 11. Stack 不是 Micro-PR 狂热

有一种错误实践是：

```text
一个函数一个 PR
一个类型一个 PR
一个测试一个 PR
```

这样会让依赖链变得比代码本身还复杂。

正确拆分应该满足一个基本条件：

> 每层都能够用一句话解释“为什么它自己就是一个完整的变化”。

例如：

```text
L1: 建立商品数据模型与查询接口
L2: 暴露搜索 API 并完成参数校验
L3: 让 Chat 基于真实搜索结果生成回答
L4: 增加引用卡片与错误状态 UI
```

每一句都对应一个明确的行为边界。

如果你无法描述某层的独立价值，它可能只是机械切片，而不是工程切片。

## 12. 对 Agent 来说，Stack 还是一种 Context Management

这个角度我认为特别值得重视。

如果 Agent 一次处理整个 2000 行 Feature，它自己的上下文也会越来越脏：

```text
数据库决策
+ API schema
+ UI state
+ 测试日志
+ review feedback
+ browser output
```

而 stacked workflow 可以天然帮助 Agent 分隔工作集。

例如：

```text
L1 Agent context
只关注 data layer

L2 Agent context
继承 L1 contract
但不需要保留 L1 的所有探索日志

L3 Agent context
只需要 API contract + chat code
```

这和 subagent / context pruning 的逻辑非常接近。

所以 stacked PR 不只是 Git 分支管理技巧，也可以成为 **Agent context boundary**。

## 13. 一个我会采用的 Coding Agent Stack Harness

如果自己设计，我会把流程做成：

```text
User Goal
   ↓
Repository Analysis
   ↓
Change Graph
   ↓
Stack Planner
   ↓
┌──────────────┐
│ L1 Executor  │ → verify → commit
└──────┬───────┘
       ↓
┌──────────────┐
│ L2 Executor  │ → verify → commit
└──────┬───────┘
       ↓
┌──────────────┐
│ L3 Executor  │ → verify → commit
└──────┬───────┘
       ↓
Stack Submit
   ↓
Human Review Bottom-up
```

每一层 Agent 都只拿：

```text
原始 goal
+ 当前 layer specification
+ 上一层的稳定 contract
+ 当前相关代码
```

而不是完整保留所有历史工具结果。

这会明显减少 context drift。

## 14. 怎么做一次 A/B 实验？

如果你团队已经在用 Coding Agent，可以选 10 个真实中型 Feature 做对照。

### A 组：Single PR

让 Agent 自由实现完整 Feature。

记录：

```text
总 diff
CI failure 次数
review time
review comments
返工次数
最终 merge 时间
```

### B 组：Stacked PR

模型、工具和任务不变，只增加 stack planner。

再记录：

```text
每层 diff
每层 CI
底层修改传播次数
review time
总 merge time
```

最后重点比较：

```text
Time to first review
P50 review duration
P90 review duration
Reviewer correction rate
Total human attention time
```

不要只比较 Agent 完成代码花了多久。

如果 Agent 多花 5 分钟做 decomposition，但 Reviewer 少花 40 分钟理解 diff，整体吞吐才是真正提升。

## 15. 真正应该优化的是 Accepted Change Throughput

Coding Agent 很容易让团队关注一个危险指标：

```text
Generated LOC / day
```

这个指标几乎必然会暴涨。

但组织真正想要的是：

```text
被验证、被接受、能安全上线的变化数量
```

也就是我更愿意叫：

**Accepted Change Throughput。**

可以粗略表示成：

```text
Generated Changes
× Verification Quality
× Reviewability
× Acceptance Rate
```

如果生成速度提高 5 倍，但 Reviewability 降低一半、返工率翻倍，最终收益不会有想象中那么大。

Stacked PR 的价值，就在于它不是提高“写代码速度”，而是在修复 Agent 时代最容易被忽略的后半段吞吐。

## 16. 一个适合个人项目的轻量版本

个人开发者没有多个 reviewer，也不一定需要完整 `gh stack` 流程。

但仍然可以借鉴同样的设计。

例如一个较大 Feature，先让 Agent按顺序做：

```text
Commit 1: data / types
Commit 2: core behavior
Commit 3: UI
Commit 4: tests / polish
```

每个 commit 都保持：

```text
可构建
可验证
说明清楚
```

即使最终只提交一个 PR，review / rollback / bisect 都会轻松很多。

所以 stacked thinking 的价值并不依赖团队规模。

## 17. 我对 Agent-native Git 工作流的判断

过去 Git 工作流主要是围绕“人写代码”设计的。

Agent 时代会逐渐出现新的基础动作：

```text
Task decomposition
Dependency graph
Layered branch creation
Automated restack
Per-layer CI
Review-aware context
Change propagation
```

这些动作很可能最终会成为 Coding Agent Harness 的标准能力。

模型只负责生成代码还不够。

真正成熟的 Agent 应该知道：

```text
这次改动是不是太大？
应该怎样拆？
哪些改动属于同一风险边界？
哪一层应该先验证？
review feedback 应该影响后面哪些层？
```

这才是从“AI code generator”进入“AI software engineer”真正需要的工程能力。

## 结语

Coding Agent 的最大优势，是能够极快地跨越仓库完成复杂修改。

它最大的风险，也来自同一个地方：**它太容易一次做太多。**

当生成代码不再昂贵以后，下一阶段真正稀缺的资源会变成：

```text
Reviewer attention
Verification bandwidth
Change isolation
Trust
```

Stacked PR 的意义不是回到“慢慢写代码”，而是让高速生成的改动重新获得清晰结构。

所以以后我判断一个 Coding Agent 是否成熟，不会只看它能不能一次完成 2000 行 Feature。

我更关心：

> **它能不能主动把一个大任务拆成一组有依赖顺序、每层可独立验证、可被人类快速理解的变化？**

当 Agent 开始优化这个问题时，AI Coding 才真正开始进入团队工程效率，而不只是代码生成速度比赛。

---

## 参考资料

- GitHub Engineering — *Turn one giant AI-generated pull request to a reviewable stack*, 2026-08-04: https://github.blog/engineering/turn-one-giant-ai-generated-pull-request-to-a-reviewable-stack/
- GitHub Docs / GitHub CLI — stacked pull request 与 `gh stack` 相关官方资料
- GitHub Changelog — Copilot CLI 近期 subagent / task management 与 agent workflow 更新

> 本文中的 Review Surface、Accepted Change Throughput、自动拆层触发条件与 Harness 结构属于基于 GitHub 官方 stacked PR 机制做出的工程分析，并非 GitHub 官方 benchmark 或强制实践。文中没有虚构团队性能数据。
