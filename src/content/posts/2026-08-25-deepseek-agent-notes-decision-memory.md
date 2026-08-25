---
title: AI 写代码最怕的不是“屎山”，而是没人记得为什么：拆解 DeepSeek Harness 的 Agent Notes 决策记忆层
author: Katelya
published: 2026-08-25
category: 技术分享
tags: [DeepSeek, Agent, Coding Agent, Harness, Software Engineering, ADR, Context Engineering, Developer Tools]
draft: false
pinned: false
comment: true
description: 2026 年 8 月，一篇关于 DeepSeek Harness Agent Notes 的社区讨论再次把一个老问题推到台前：AI Coding Agent 能快速生成代码，但代码之外的决策理由、被放弃的方案和验证边界往往没有被保存。本文回查 DeepSeek Harness 官方仓库，拆解其 proposed / implemented / rejected 生命周期、强制 alternatives、格式校验与归档机制，并讨论如何把“决策记忆”变成 Coding Agent 的长期工程资产，而不是把所有历史都塞进上下文窗口。
---

AI Coding 进入真实项目以后，一个很反直觉的问题正在变得越来越严重：

**代码写得越快，团队越容易忘记为什么这么写。**

模型可以在十分钟里完成过去半天的重构，也可以在一个下午连续修改十几个模块。短期看，这当然是生产力提升。

但三个月后你再回来看，常常只剩下最终代码：

- 为什么这里用了事件队列，而不是直接调用？
- 为什么这个缓存没有做成全局单例？
- 为什么某个看起来“更简单”的实现当时被否掉了？
- 这个 workaround 是临时妥协，还是一个必须长期保持的兼容性约束？
- 某个测试到底在保护业务行为，还是只是在锁死历史实现？

如果这些信息只存在于当时那次 Agent 会话里，那么会话结束以后，项目实际上就失去了一部分工程记忆。

2026 年 8 月 24 日，LINUX DO 上一篇讨论 DeepSeek Harness 的帖子重新把这个问题带火。帖子作者观察到 DeepSeek Harness 仓库中存在大量 `.agents/notes/`，并尝试把这种做法抽象成一个通用 Skill。这个观察值得关注，但真正有价值的部分不是“DeepSeek 写了很多 notes”这个表面现象，而是官方仓库里已经把 Agent Notes 做成了一套相当严格的工程制度。

社区讨论：

- [LINUX DO：偷师 DeepSeek 团队：如何不让 AI 写成屎山](https://linux.do/t/topic/2800453)
- [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness)

这篇文章不讨论某个 Skill 本身好不好用，而是尝试回答一个更重要的问题：

> **当 Coding Agent 的代码生成速度开始超过人类理解速度时，项目是否需要一层独立于代码、聊天记录和普通文档之外的“决策记忆层”？**

## 先说结论：Agent Notes 不是“给 AI 写日记”

DeepSeek Harness 官方对 Agent Note 的定义非常明确：

它记录的是影响代码库的**决策或提案**，尤其是代码和普通文档难以携带的两类信息：

1. 为什么做这个决定；
2. 为此放弃了什么。

官方说明位于：

[deepseek-harness/.agents/notes/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/README.md)

这和传统开发里的 ADR（Architecture Decision Record）很像，但 DeepSeek Harness 做了几个更适合 Agent 时代的强化。

最关键的是：它没有把 notes 当作“写不写都行”的软性习惯，而是尽可能变成机器可检查的仓库契约。

## 第一层：把“状态”直接编码进路径

DeepSeek Harness 的 Agent Notes 按生命周期组织：

```text
.agents/notes/
├── proposed/
├── implemented/
├── rejected/
└── archived/
```

一个设计想法刚提出时，放在 `proposed/`。

真正上线以后，移动到 `implemented/`。

评审后决定不做，则进入 `rejected/`。

已经完成历史使命、未来参考价值较低的 implemented note，才会进入 `archived/`。

这件事看起来很小，但它解决了普通 Markdown 文档经常出现的问题：

**你不知道这份文档到底还是计划、已经实现、已经放弃，还是早就过期。**

传统项目里经常能看到这种文件：

```text
docs/new-cache-design.md
```

文件写得非常完整，但半年后没人知道：

- 到底实现了吗？
- 实现的是不是文档里的版本？
- 后来有没有回滚？
- 文档里哪些内容已经不成立？

DeepSeek Harness 选择把生命周期变成目录结构的一部分。

这其实是一种非常朴素但有效的状态机。

## 第二层：必须记录“Alternatives considered”

很多工程文档只写：

> 我们最终采用了方案 A。

但真正最有价值的信息往往不是 A 是什么，而是：

> **为什么不是 B？为什么不是 C？**

DeepSeek Harness 的 Agent Note 格式要求每一篇都包含 `Alternatives considered`。

对于已经实现的决策，标准骨架大致是：

```markdown
## Problem
## Decision
## Alternatives considered
## Consequences
```

这比“写一篇技术总结”强得多。

因为工程项目最大的重复劳动之一，就是几年后新成员重新提出一个当年已经评估并放弃过的方案。

如果仓库只留下最终实现，那么后来的人看到当前代码时很容易产生这种错觉：

> “这里怎么写得这么复杂？我改成更简单的方案不就好了？”

结果改完以后，过去踩过的坑重新出现。

所以 Agent Notes 真正保护的，不只是“知识”，而是**已经支付过成本的失败探索**。

## 第三层：implemented 不是历史快照，而是“当前事实”

这是我认为 DeepSeek Harness 这套机制里最重要、也最容易被忽略的一点。

官方要求：

如果一个 implemented Agent Note 里提到的文件路径、包名、配置项、默认值等事实后来发生变化，那么相关代码变更应该同时更新这篇 note。

注意，这并不是让你重新解释当初的决策。

**决策理由不能随便改，但承载这个决策的当前事实必须保持同步。**

举个例子。

假设 2026 年 3 月你决定：

```text
任务状态必须持久化到数据库，不能只放内存。
```

当时实现位于：

```text
packages/runtime/task-store.ts
```

几个月后模块移动到了：

```text
packages/state/task-repository.ts
```

如果 Agent Note 仍然指向旧文件，那么它虽然保留了正确的“why”，却失去了作为当前工程导航的价值。

DeepSeek Harness 因此把 Agent Notes 设计成一种介于 ADR 和活文档之间的东西：

```text
过去的决策理由：尽量稳定
当前实现事实：持续同步
```

这是很适合 Coding Agent 的模式。

因为 Agent 最擅长的事情之一，正是机械地同步路径、名称和结构变化。

## 第四层：不是所有决定都值得永久保存

如果只强调“记录一切”，很快又会得到另一个问题：

**文档爆炸。**

几百篇 notes 最后可能变成一个新的垃圾场。

DeepSeek Harness 对此也有专门的归档规则。

官方明确区分：

有些已经实现的决定虽然很旧，但它们仍然具有长期价值，例如：

- 安全边界；
- wire / durable data 语义；
- 不允许重新引入的行为；
- 某项兼容性保证；
- 一个未来很可能再次被提出的替代方案。

这些应该继续留在 active tree。

而那些已经完成使命、未来几乎不会再影响设计判断的记录，可以进入 `archived/`。

更有意思的是，archive 以后文件会被冻结。

也就是说：

**归档不是“再整理一下旧文档”，而是封存历史证据。**

这种设计可以避免一个很常见的问题：多年以后的人为了让文档“看起来更现代”，无意中把过去真正发生过的决策过程重写了。

## 为什么这套东西在 Agent 时代比过去更重要？

因为 Coding Agent 改变了软件工程里的一个比例：

```text
生成代码的速度
──────────────
理解代码的速度
```

这个比值正在快速上升。

过去一个开发者花两天实现一个复杂模块，过程中大量决策天然存在于他的工作记忆里。

现在 Agent 可能 30 分钟完成同样规模的改动。

代码出现得更快，但人类并没有因此获得 16 倍的理解能力。

于是“实现”和“理解”之间开始形成债务。

我更愿意把它叫做：

> **Decision Debt，决策债务。**

Technical Debt 通常描述代码本身未来需要支付的维护成本。

Decision Debt 则是：

> 系统已经做出了一个决定，但团队失去了这个决定的背景、约束和替代方案，因此未来任何修改都必须重新考古。

Coding Agent 越强，这种债务越容易累积。

## 聊天记录为什么不能替代 Agent Notes？

很多人会说：Agent 的历史会话里不是都有吗？

理论上有。

工程上不够。

### 1. 会话不是仓库的一部分

代码 clone 到另一台机器后还在，聊天记录未必在。

新成员拿到仓库，也通常拿不到你半年前所有 Agent conversation。

### 2. 会话噪声太大

一次复杂任务可能有几万甚至几十万 token。

真正值得长期保留的决策也许只有 20 行。

把整个会话当文档，本质上类似于把所有 Slack 聊天记录当系统设计文档。

信息存在，但检索成本极高。

### 3. 会话里的结论可能已经被后续步骤推翻

Agent 在第 10 轮可能建议方案 A，第 25 轮发现问题以后改成 B。

如果未来只做语义搜索，很可能同时召回两个相互矛盾的结论。

### 4. 会话没有明确生命周期

proposal、implemented、rejected 常常混在一起。

这正是 Agent Notes 用路径状态机解决的问题。

## AGENTS.md 也不能完全替代它

`AGENTS.md` 非常适合放：

- 当前开发规范；
- 常用命令；
- 测试要求；
- 目录约定；
- 不允许违反的工程规则。

但它不适合记录几百个历史设计决定。

如果把所有背景都塞进 `AGENTS.md`，最终会得到一个巨大的系统 Prompt。

每次任务都加载大量和当前修改完全无关的历史信息。

所以更合理的分层是：

```text
AGENTS.md
    ↓
当前必须遵守的高频规则

Agent Notes
    ↓
按需检索的决策历史

Git history
    ↓
最终事实与精确变更记录
```

三者不是替代关系，而是不同索引层。

## Agent Notes 与 ADR 有什么区别？

本质上，它们属于同一个家族。

但传统 ADR 往往有几个现实问题：

- 只记录大架构决定，小而关键的行为契约没人写；
- 写完以后从不更新；
- 没有强制格式；
- 没有生命周期；
- CI 不检查；
- Agent 不知道什么时候应该创建或更新。

DeepSeek Harness 的做法更像：

> **把 ADR 从“文化习惯”升级成 repo-level protocol。**

尤其适合 Agent，因为机器特别擅长遵守这些确定性协议。

## 真正关键的不是“让 Agent 多写文档”，而是建立触发条件

如果给 Agent 一条模糊规则：

> 每次改代码都写一篇总结。

结果通常很糟。

你会得到大量没有信息密度的内容：

> “本次修改优化了代码结构，提高了可维护性。”

这种文档几乎没有价值。

真正应该定义的是 **什么时候必须留下决策记录**。

DeepSeek Harness 的官方规则把 non-trivial change 定义得很宽，包括：

- 行为变化；
- 架构变化；
- 跨文件或跨包契约变化；
- 工具与流程变化；
- 测试策略变化；
- 磁盘、网络或配置格式变化；
- 未来维护者可能重新讨论的决定。

这比“代码超过 200 行就写文档”合理得多。

因为一个 5 行修改可能改变非常重要的权限语义，而一个 500 行机械重命名可能完全不需要新增决策记录。

## 我会再加一个判断：是否存在“未来诱人的错误方案”

除了 DeepSeek Harness 的规则，我认为 Agent 可以额外问自己一个问题：

> **未来维护者看到这里，会不会很自然地提出一个看起来更简单、实际上已经被证明有问题的方案？**

如果答案是会，那么这个决定非常值得记录。

例如：

```text
为什么这里不用全局缓存？
为什么不并行执行？
为什么不直接重试？
为什么必须保持顺序？
为什么不能删掉这个“多余”的校验？
```

这些都是高价值 Agent Note 候选。

## 对个人 Coding Agent，最小实现不需要 700 篇 notes

看到 DeepSeek Harness 这么完整的制度，很容易走向另一个极端：

“那我是不是也要复制整套？”

不需要。

个人项目可以先从极简版本开始：

```text
.agents/
└── decisions/
    ├── proposed/
    ├── implemented/
    └── rejected/
```

每篇只强制五件事：

```markdown
# Decision: <title>

## Problem

## Decision

## Alternatives considered

## Consequences

## Verification
```

然后给 Agent 一个明确规则：

```text
如果修改改变了跨模块契约、数据格式、安全边界、并发语义、
缓存策略、失败恢复方式或长期维护成本，则检查是否已有对应 decision note。
已有则更新，没有则创建。
```

这已经能解决 80% 的问题。

## 更进一步：把它变成 Context Retrieval，而不是 Context Bloat

Agent Notes 最大的潜在价值，不是让人手工阅读几百篇 Markdown。

而是成为 Agent 的结构化检索语料。

例如 Agent 准备修改：

```text
packages/cache/
```

Harness 可以先执行：

```text
1. 根据路径、symbol 和关键词检索相关 implemented notes
2. 只加载 top-k 最相关记录
3. 把这些决策作为任务上下文
4. 修改完成后检查是否需要更新对应 note
```

这样形成闭环：

```text
过去决策
   ↓
按需检索
   ↓
Agent 修改代码
   ↓
验证
   ↓
更新决策记录
   ↓
未来任务继续检索
```

这比把整个仓库历史塞进超长上下文高效得多。

长上下文不是无限记忆。

**真正可维护的 Agent memory，必须有筛选、生命周期和结构。**

## 可以给 Agent Notes 建哪些自动检查？

DeepSeek Harness 已经在做格式与结构校验。如果迁移到一般项目，我认为最值得加入 CI 的是以下几类。

### 1. Path / Status consistency

例如：

```text
implemented/xxx.md
```

文件内部却写：

```text
Status: proposed
```

直接失败。

### 2. Alternatives 非空

禁止：

```markdown
## Alternatives considered

None.
```

至少需要说明为什么当前方案不是“随手选的”。

### 3. 文件引用有效

如果 note 指向：

```text
packages/foo/bar.ts
```

但文件已经移动或删除，CI 应提醒更新。

### 4. 重大契约修改需要 decision note

可以根据目录做粗粒度 gate。

例如修改：

```text
schema/
auth/
protocol/
migrations/
```

PR 中却没有新增或更新任何 decision note，则提示 reviewer 检查。

不要一开始就硬 fail，先做 warning 更现实。

### 5. Rejected decision 的重新引入检测

这是一个很有 Agent 时代特色的能力。

假设过去明确拒绝：

```text
在 worker 中共享 global mutable singleton
```

未来 Coding Agent 又生成类似实现时，可以通过静态规则或 review agent 自动召回对应 rejected note。

这相当于把“组织记忆”直接变成代码审查信号。

## 如何评估这套机制到底有没有用？

不要用“文档数量”作为 KPI。

那只会制造 Markdown。

我会更关注四个指标。

### Decision Rediscovery Time

半年后的开发者第一次看到一段复杂实现，到理解“为什么这样设计”需要多久？

理想情况：

```text
grep / semantic search → 1 篇 note → 5 分钟
```

而不是：

```text
git blame → 翻 8 个 PR → 找聊天记录 → 问原作者
```

### Re-litigation Rate

同一个已经评估过的失败方案，被团队重新讨论多少次？

Agent Notes 如果有效，这个比例应该下降。

### Stale Decision Rate

implemented note 中有多少引用已经和代码现实不一致？

这个指标越高，说明制度已经变成“写完即忘”。

### Context Retrieval Precision

Agent 在修改代码前召回的历史 notes 中，有多少真正影响当前任务？

如果每次都召回几十篇无关记录，那么“决策记忆”又变成了上下文污染。

## 一个非常重要的风险：Agent 会制造“虚假的理由”

任何让 AI 自动写设计文档的系统都有一个危险：

**模型可能事后合理化。**

代码已经写完了，Agent 再补一篇 note，然后非常自信地声称：

> “我们比较了 A/B/C，最终因为性能选择 B。”

但真实开发过程中可能根本没有比较过 A 和 C。

所以 DeepSeek Harness 官方强调的一个原则非常重要：

> alternatives 应该被记录，而不是被发明。

我建议所有自动 decision-note 工作流加一条规则：

```text
无法从当前任务对话、PR discussion、issue 或已有证据确认的替代方案，
禁止写成“我们曾经考虑过”。
```

可以写：

```text
Open question
```

但不要伪造历史。

**工程记忆最怕的不是缺失，而是错误记忆。**

## 最适合的工作流：Decision Note 和代码一起进入 PR

不要让 Agent 在 merge 后补文档。

最稳的流程是：

```text
任务开始
  ↓
检索相关历史 decision
  ↓
实现代码
  ↓
测试 / benchmark / verification
  ↓
新增或更新 decision note
  ↓
同一个 PR review
  ↓
merge
```

这样 reviewer 可以同时看到：

```text
What changed
Why changed
What alternatives lost
What trade-off we accepted
How we verified it
```

这比让 reviewer 只面对一坨 diff 强得多。

## 这和我之前讨论的 Stacked PR 是互补关系

Stacked PR 解决的是：

> **一次改动太大，人类 review surface 过载。**

Agent Notes 解决的是：

> **即使当时 review 通过了，几个月后决策背景仍可能丢失。**

一个优化空间维度，一个优化时间维度。

可以这样理解：

```text
Stacked PR
降低“当前这一刻”的认知负担

Agent Notes
降低“未来重新理解”的认知负担
```

对于高频使用 Coding Agent 的团队，两者其实应该同时存在。

## 最后：真正的 Agent Memory，不应该只是更长的 Context Window

过去一年，很多 Agent 系统谈 memory 时，第一反应仍然是：

- 更大的上下文窗口；
- 自动摘要；
- vector database；
- 对话历史压缩；
- session persistence。

这些都重要。

但软件工程还有一种非常特殊的 memory：

> **Decision Memory。**

它不是“发生过什么”，而是：

```text
我们为什么做这个选择？
当时还有哪些可行方案？
为什么它们输了？
这个决定带来了什么代价？
什么条件变化以后应该重新评估？
```

这类信息如果没有在决策发生时结构化保存，之后再强的模型也只能从代码里猜。

DeepSeek Harness 的 `.agents/notes/` 最值得借鉴的地方，不是目录名，也不是某个 Markdown 模板。

真正值得借鉴的是一个工程判断：

> **当 Agent 开始承担越来越多实现工作时，仓库必须同时保存“代码事实”和“决策事实”。**

代码告诉未来的 Agent：

> 系统现在是什么样。

Decision Notes 告诉它：

> 为什么它必须是这样，以及哪些看起来诱人的路我们已经走过、并决定不再走。

这可能会成为下一代 Coding Agent Harness 里，和 Tool、Sandbox、Context Pruning、Verification 同样基础的一层。

---

## 参考资料

- [DeepSeek Harness GitHub](https://github.com/deepseek-ai/deepseek-harness)
- [DeepSeek Harness Agent Notes 规范](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/README.md)
- [DeepSeek Harness Skill Provider 实现](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/skill/skill/src/index.ts)
- [LINUX DO：偷师 DeepSeek 团队：如何不让 AI 写成屎山](https://linux.do/t/topic/2800453)

> 注：社区帖子中的数量统计和使用体验属于社区观察；本文关于 Agent Notes 生命周期、目录结构、格式要求、alternatives、归档与校验机制的描述均以 DeepSeek Harness 官方仓库当前内容为准。