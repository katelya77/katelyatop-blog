---
title: Agent Coding 下一站不是更长的 AGENTS.md，而是“可执行计划”：3.6 万个开源仓库透露的新趋势
published: 2026-08-16
category: AI前沿
tags: [Agent, Coding Agent, AGENTS.md, Codex, GitHub Copilot, Harness Engineering, AI编程]
draft: false
pinned: false
comment: true
description: 从 2026 年 8 月的新研究出发，结合 OpenAI Harness Engineering 与 GitHub Copilot 的最新指令体系，分析为什么长期规则应该留在 AGENTS.md，而任务意图、实施步骤、验证结果与决策日志正在迁移到版本化 Agent Plans。
---

过去半年，AI Coding 圈最常见的建议之一是：**给仓库写一份好的 `AGENTS.md`。**

这当然没错。但当项目真正开始让 Codex、Copilot、Claude Code 或其他 Coding Agent 连续承担复杂任务后，一个新的问题会迅速出现：

> 如果把架构规则、开发规范、当前任务、实施步骤、临时决策、测试结果和剩余 TODO 全塞进同一份长期指令文件，它迟早会从“导航地图”膨胀成“上下文垃圾场”。

2026 年 8 月 5 日发布的一项新研究，恰好给这个问题提供了一个很有意思的观察窗口。研究者筛选了 **36,710 个工程化 GitHub 仓库**，最终找到 **85 份保存在仓库里的 Markdown Agent Plan，来自 10 个仓库**。样本还很小，不能证明 Agent Plan 已经成为行业标准，但它透露出一种值得关注的工程趋势：**团队开始把“长期规则”和“当前任务的执行状态”拆成两类不同的版本化资产。**

这篇文章不讨论怎样写一份更长的提示词，而是想回答一个更实际的问题：

**当 Coding Agent 从一次性助手变成项目参与者，我们应该怎样给它保存“下一步该做什么”？**

## 一、AGENTS.md 解决的是“我在这个仓库应该怎么工作”

先把几个容易混淆的概念拆开。

`AGENTS.md` 最适合承载的是**稳定、跨任务、长期有效**的信息，例如：

- 项目结构和关键目录；
- 构建、测试、Lint 命令；
- 不允许破坏的架构边界；
- 代码风格与提交约束；
- 哪些文档是事实源；
- 修改某类代码前应该先阅读什么。

OpenAI 在 Harness Engineering 的公开实践中给出了一个很值得借鉴的原则：**不要把 `AGENTS.md` 当百科全书，而要把它当目录。**

他们描述的仓库知识体系把真正的架构、设计、产品、可靠性、安全和执行计划放在结构化 `docs/` 中；短小稳定的 `AGENTS.md` 只负责告诉 Agent 应该去哪里找下一层信息。

这实际上是在做一种 **Progressive Disclosure（渐进披露）**：

```text
AGENTS.md
   ↓
找到与当前任务相关的文档
   ↓
只加载必要上下文
   ↓
执行 / 验证 / 更新状态
```

相比“开局把整个项目知识库塞进上下文”，这种方式更容易控制 Token，也更容易保持事实源唯一。

## 二、Agent Plan 解决的是另一件事：这一次具体要怎么做

长期规则并不能代替任务计划。

假设任务是：

> 把一个旧的鉴权模块迁移到新的 Session API，同时不能破坏移动端登录。

`AGENTS.md` 可以告诉 Agent：

- 鉴权代码在哪里；
- 测试命令是什么；
- 不允许直接修改数据库 schema；
- API 兼容策略在哪里查看。

但它不应该长期保存：

- 这次迁移分哪 5 步；
- 第 2 步为什么放弃方案 A；
- 已经修改了哪些文件；
- 哪个测试还失败；
- 下一轮应该从哪里继续。

这些信息属于**任务状态**，而不是**仓库宪法**。

这也是 Agent Plan 最有价值的地方。

8 月的新研究发现，现有 Plan 文件最常出现的信息包括：

1. 实施步骤；
2. 具体文件和代码位置；
3. 测试与验证信息。

而它们覆盖的任务并不只是一类，包括维护、设计、构建、质量工作和流程支持。

换句话说，Plan 更像是 Agent 的**可版本化工作记忆**。

## 三、为什么这件事在多 Agent 时代尤其重要

单 Agent、单 Session 时，我们很容易产生一种错觉：聊天历史就是状态。

但只要进入下面任何一种场景，这个假设就会失效：

- 一个任务跨越几小时甚至几天；
- 主 Agent 把调查交给 Subagent；
- PR 被 CI 打回后换一个 Agent 修复；
- 人类开发者中途接管，再交回给 Agent；
- 同一个仓库同时使用 Codex、Copilot CLI、Claude Code；
- 会话被压缩、重启或上下文截断。

如果关键决策只存在聊天记录里，下一位执行者就需要重新考古。

而一个仓库内的 Plan 可以成为交接协议：

```markdown
# Goal
迁移 Session API，保持移动端兼容。

# Constraints
- 不改数据库 schema
- 保持 /v1/login 响应兼容

# Steps
- [x] 建立兼容层
- [x] 迁移 Web 调用
- [ ] 迁移移动端 refresh token
- [ ] 跑完整回归

# Decisions
- 2026-08-16：放弃方案 A，因为旧客户端无法解析新 cookie 属性。

# Verification
- unit: pass
- web e2e: pass
- mobile regression: pending
```

这段东西的价值不在于文笔，而在于**任何下一位 Agent 都能恢复任务状态**。

## 四、GitHub 的指令体系也正在走向分层

GitHub Copilot 当前的官方文档已经把自定义能力拆得相当细：

- `.github/copilot-instructions.md`：仓库级长期指令；
- `.github/instructions/*.instructions.md`：按路径生效的长期指令；
- `AGENTS.md`：可供 Agent 使用的指令；
- Prompt files：可复用任务模板；
- Custom agents：带独立工具和行为约束的专家 Agent；
- Skills：按需加载的任务工作流；
- MCP：连接外部系统与数据。

Copilot CLI 甚至会发现 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md` 等多种指令文件，并允许查看当前会话实际加载了哪些规则。

这说明“一个巨型 system prompt 包办所有事情”的时代正在过去。

更合理的思路是按**生命周期**拆上下文：

| 内容 | 生命周期 | 更适合放哪里 |
| --- | --- | --- |
| 架构边界 | 月/年 | AGENTS.md / docs |
| 某目录编码规范 | 月/年 | path-specific instructions |
| 常用任务流程 | 周/月 | Skill / Prompt |
| 当前任务实施步骤 | 小时/天 | Agent Plan |
| 当前执行日志 | 分钟/小时 | Plan progress / CI |
| 外部实时信息 | 秒/分钟 | MCP / API |

这比按“哪个 AI 工具使用”来划分文件更稳定。

## 五、Plan 不应该变成第二份需求文档

看到这里，很容易走向另一个极端：每个小修改都写 500 行计划。

这同样会失败。

我更推荐把任务分成三档。

### 1. 小任务：临时计划即可

例如改一个文案、修一个明确的 CSS 问题。

不需要持久化 Plan，Agent 自己列三步然后完成即可。

### 2. 中任务：轻量 Plan

涉及多个文件、需要测试，但可以在一个工作周期内完成。

建议只保留：

```text
Goal
Constraints
Steps
Verification
```

几十行通常已经足够。

### 3. 长任务：版本化 Execution Plan

跨模块、跨 Session、多人或多 Agent 协作时，再增加：

```text
Context
Non-goals
Decisions
Progress
Risks
Rollback
Handoff
```

重点不是写得详细，而是让**中断后可以恢复**。

## 六、一个好的 Plan 必须能被 CI“闭环”

如果 Plan 永远写着：

```text
- [ ] 测试
```

但没有任何机器证据，它很快就会和现实脱节。

更强的做法是让计划与工程验证产生连接：

```text
Plan
 ↓
代码变更
 ↓
Lint / Unit / E2E / Build
 ↓
结果写回 Verification
 ↓
Reviewer 检查目标是否真的完成
```

OpenAI 的 Harness Engineering 实践里，执行计划、已完成计划和技术债会一起版本化，并通过专门的 Linter / CI 检查知识库结构与陈旧信息。

这给我最大的启发不是“大家都应该复制同一套目录”，而是：

> **Agent 的记忆如果不能被真实系统验证，就只是另一种聊天记录。**

## 七、不要把 Plan 当成隐藏的 Chain-of-Thought

还有一个很重要的边界。

我们需要持久化的是**工程事实和决策结果**，而不是要求模型把内部推理过程全部写出来。

Plan 应该记录：

- 选择了什么方案；
- 为什么这个决策对工程有影响；
- 哪些约束导致方案变化；
- 当前验证结果；
- 下一步动作。

不需要记录冗长的逐 token 思考过程。

这既更干净，也更适合团队审阅。

## 八、我会怎样给一个真实仓库设计 Agent 上下文

如果今天重新设计一个长期由 Coding Agent 参与维护的项目，我会采用下面的层级：

```text
AGENTS.md                  # 100 行左右，导航 + 硬约束
ARCHITECTURE.md            # 稳定架构地图
docs/
  product/
  security/
  reliability/
  references/
  plans/
    active/
    completed/
.github/
  instructions/           # 路径规则
  skills/                  # 可复用工作流
```

每次复杂任务创建一个独立 Plan：

```text
docs/plans/active/2026-08-session-api-migration.md
```

完成后移动到 `completed/`，而不是继续污染长期入口。

同时给 Plan 定一个非常简单的质量标准：

- 新 Agent 只看 Plan 能否知道目标？
- 能否知道已经做了什么？
- 能否知道剩下什么？
- 能否找到验证证据？
- 能否知道哪些决策不能随便推翻？

五个问题都能回答，这份 Plan 就已经有用了。

## 九、研究数据也提醒我们：现在还非常早期

这里必须避免把趋势吹成事实。

36,710 个仓库里只找到 10 个仓库保留了研究定义下的 Agent Plan，这说明这种做法目前依然高度集中，而不是已经普及。

但早期并不意味着不重要。

很多工程习惯在成为“最佳实践”之前，都会先出现在少数真正被规模问题逼到墙角的项目里。

更值得观察的是：随着 Agent 执行时间越来越长、Subagent 越来越普遍、一个仓库同时接入多个 Coding Agent，**可恢复的任务状态**会从“锦上添花”变成基础设施。

## 十、结论：把提示词工程升级成状态工程

过去我们优化 Coding Agent，最常问的是：

> Prompt 怎么写得更聪明？

现在更应该问：

> Agent 中断之后，下一个执行者怎样无损接班？

`AGENTS.md` 负责长期规则，文档负责事实，Skill 负责可复用流程，MCP 负责外部能力，而 Agent Plan 负责保存当前任务的**目标、进度、决策与验证状态**。

当这些东西各自承担清晰职责之后，Coding Agent 才真正开始从“一次性的聊天机器人”变成“可以参与软件工程流程的执行者”。

这也是我认为 Harness Engineering 接下来最值得关注的一条线：

**模型能力决定上限，但状态能不能被可靠地交接，决定 Agent 到底能连续工作多久。**

---

## 参考资料

- Abubakar et al., *An Exploratory Study of Agent Plans for Agentic AI Coding Tools in Open-Source Software*, arXiv:2608.04661，2026-08-05。
- OpenAI, *Harness engineering: leveraging Codex in an agent-first world*。
- OpenAI, *Introducing Codex*。
- GitHub Docs, *Support for different types of custom instructions*。
- GitHub Docs, *Copilot customization cheat sheet*。
- GitHub Docs, *Adding custom instructions for GitHub Copilot CLI*。

> 本文基于公开研究与官方文档独立整理。社区讨论用于发现问题和选题，不把论坛传闻当作官方事实；文中的目录结构与工程建议属于作者根据资料做出的实践归纳。