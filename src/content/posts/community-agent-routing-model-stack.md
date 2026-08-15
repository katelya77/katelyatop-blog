---
title: 模型越多越好吗？从 LINUX DO 与 NodeLoc 的真实使用讨论，聊聊 Agent 路由的下一步
published: 2026-08-15
category: AI工程
tags: [AI, Agent, Codex, 多模型, Harness, LINUX DO, NodeLoc]
draft: false
pinned: false
comment: true
description: 当 Grok、DeepSeek、Qwen、GPT、Claude 同时出现在一个工作流里，真正困难的已经不是“选哪个模型”，而是怎样管理任务、上下文、验证成本与失败恢复。结合 LINUX DO 和 NodeLoc 的社区实践，重新拆解多模型 Agent 路由。
---

# 模型越多越好吗？从 LINUX DO 与 NodeLoc 的真实使用讨论，聊聊 Agent 路由的下一步

最近逛 LINUX DO 和 NodeLoc，会有一种很明显的感觉：**AI 工具链正在迅速从“我该选哪个模型”变成“这么多模型到底应该怎么协作”。**

NodeLoc 上已经能看到把 Grok 4.5、DeepSeek V4 Flash、MiMo 等模型放进同一个入口的社区服务；LINUX DO 上则越来越多地讨论 Codex、Claude Code、Cursor、OpenCode、Oh My Pi 里的角色分配、Sub-agent、AGENTS.md 和上下文治理。

这其实说明了一个变化：

> 模型本身正在逐渐商品化，而真正拉开使用体验差距的，开始变成模型外面的 Harness、路由、上下文管理、验证与恢复机制。

很多人第一反应是：“那我就把最强的几个模型全接上，让它们互相讨论。”

听起来很美，但工程上往往没这么简单。

## 一、社区正在进入“模型堆栈”时代

在 NodeLoc 的社区帖子里，已经能看到一个入口同时提供 Grok、DeepSeek、MiMo 等多个模型的形态。这类服务最直观的价值当然是选择多，但它同时暴露了一个问题：**当模型选择不再稀缺，选择本身反而成为成本。**

参考：

- [NodeLoc：Grok 4.5 / DeepSeek V4 Flash / MiMo 多模型服务讨论](https://www.nodeloc.com/t/topic/100063)

LINUX DO 上的讨论则更进一步。

有人会给不同模型分配不同角色：默认任务用一个模型，深度推理用另一个，规划再换一个；也有人讨论 Codex 多 Agent 如何并行、怎样把环境排障交给 Sub-agent，避免主上下文被几十万 Token 的安装日志污染。

参考：

- [LINUX DO：OpenCode Go + Oh My Pi 的模型角色分配讨论](https://linux.do/t/topic/2559515)
- [LINUX DO：提高开发效率、节省上下文的 Sub-agent 技巧](https://linux.do/t/topic/2215149)
- [LINUX DO：多 Agent 架构是否真的能降本增效](https://linux.do/t/topic/2125977)

这些讨论拼在一起后，我觉得结论已经很明显：

**下一阶段的 AI 工程问题，不是“如何接更多模型”，而是“如何避免更多模型把系统变得更慢、更贵、更不可控”。**

## 二、多模型并不天然等于更便宜

多模型路由最常见的宣传逻辑是：

```text
简单任务 → 便宜模型
复杂任务 → 强模型
批量工作 → 快模型
最终审核 → 顶级模型
```

理论上合理。

但真正落地后，还有一些经常被忽略的成本。

### 1. 路由本身也消耗 Token

系统必须先判断任务属于哪一类。

如果这个判断依赖另一个 LLM，那么在真正开始干活之前，你已经多了一次推理。

### 2. Agent 之间的交接不是免费的

一个 Agent 完成探索后，需要把结果交给另一个 Agent。

最粗暴的方法是直接把完整上下文塞过去。

结果通常是：

- 上下文急剧膨胀；
- 相同代码被重复阅读；
- 每个 Agent 都重新理解一遍历史；
- 便宜模型省下来的调用成本，被上下文传递吃掉。

所以我越来越觉得，**真正应该传递的不是聊天记录，而是结构化状态。**

例如：

```yaml
task: 修复文章页标题进入导航栏的问题
status: reproduced
root_cause: Banner 内联 top 偏移覆盖主题样式
changed_files:
  - src/styles/...
validation:
  - unit: passed
  - playwright: pending
open_questions:
  - iPad 横屏需要再验证
```

这种交接比把几万行 JSONL 会话全部丢给下一个 Agent 更有效。

## 三、真正应该路由的是“任务”，不是“模型”

我更倾向于把路由拆成两层。

### 第一层：任务路由

先判断工作类型：

| 工作类型 | 更适合的执行方式 |
| --- | --- |
| 代码库搜索 | 快速、读密集型 Agent |
| 架构设计 | 强推理 Agent |
| UI 验证 | Browser / Playwright Agent |
| 文档整理 | 低成本长上下文模型 |
| 测试失败分析 | Debug 专项 Agent |
| 最终审查 | 独立 Reviewer |

这一层决定的是**需要什么能力**。

### 第二层：模型路由

确定能力之后，才去决定用哪个模型。

这时模型只是执行器。

例如：

```text
任务：大型仓库快速定位
↓
角色：Explorer
↓
需求：低延迟 + 大上下文 + 工具调用
↓
候选模型：A / B / C
↓
按价格、额度、稳定性动态选择
```

这样做比直接写：

```text
GPT = 写代码
DeepSeek = 中文
Qwen = 看图
Gemini = 搜资料
```

更容易长期维护。

因为模型版本更新太快，但“Explorer / Planner / Worker / Reviewer”这样的工作角色变化没有那么快。

## 四、上下文应该被当成一种有限资源

LINUX DO 上有一类实践我非常认同：**把和主任务关系不大的工作交给 Sub-agent，只让它返回结果。**

例如安装 Python 环境、确认某个命令版本、检查一个独立 API、寻找某个配置文件。

这些事情很容易产生大量日志，但它们真正有价值的输出可能只有一句：

> Playwright Chrome 已安装成功，版本与项目锁定配置兼容。

如果主 Agent 亲自完成整个安装过程，终端日志、错误重试和依赖解析都会进入主上下文。

一旦主上下文被噪声占满，后面真正做架构决策时，模型可用于理解业务的“注意力预算”反而变少。

所以一个成熟的 Harness 应该主动区分：

- **业务上下文**：必须长期保留；
- **执行日志**：通常只保留摘要；
- **临时探索**：Sub-agent 消化后返回结论；
- **验证证据**：以测试结果、截图、diff 形式保存；
- **历史聊天**：必要时压缩成 handoff，而不是无限堆积。

这也是为什么我认为 Context Engineering 会成为 Agent 工程里越来越重要的一部分。

## 五、多 Agent 最容易犯的错误：大家都在“干活”，没人负责收口

并行 Agent 看起来效率很高。

Explorer 在搜代码，Worker 在改文件，Reviewer 在看方案，Browser Agent 在跑页面。

问题是，如果没有一个明确的协调者，最后经常出现：

```text
Agent A：认为问题已经修复
Agent B：找到另一个实现路径
Agent C：基于旧代码继续修改
Agent D：测试的是修改前版本
```

大家都非常努力，然后仓库炸了。

因此我认为多 Agent 系统至少要有四个明确机制。

### 1. 单一任务状态源

所有 Agent 不应该各自维护一份“当前进度”。

任务的事实状态最好落在 Git、Issue、Plan 文件或结构化状态对象中。

### 2. 明确写权限

不是每一个 Agent 都应该直接改代码。

Explorer 最好只读；Reviewer 不应该一边审查一边偷偷修；真正有写权限的 Agent 数量越少，冲突越容易控制。

### 3. 验证门禁

“模型说完成了”不等于完成。

必须把完成定义成可观察条件，例如：

```text
pnpm test            PASS
pnpm astro check     PASS
pnpm build           PASS
Playwright           PASS
PR diff              仅包含预期文件
```

OpenAI 当前的 Codex 使用场景也越来越强调可重复工作流、验证操作、代码审查与长时间目标执行，而不是只让模型生成一段代码就结束。

参考：

- [OpenAI Codex Use Cases](https://developers.openai.com/codex/use-cases)

### 4. 失败后的恢复点

长任务最怕“跑了几个小时，最后一步失败，然后全部重来”。

因此每完成一个独立阶段，就应该留下：

- commit；
- checkpoint；
- 测试产物；
- handoff；
- 已验证结论。

Agent 的真正自动化能力，不只是“能一直运行”，而是**失败以后能从最近的可靠状态继续运行。**

## 六、我现在更看重 Harness，而不是排行榜第一名

过去我会非常关注：

> 哪个模型 SWE-bench 更高？哪个模型代码能力第一？

现在我仍然会看，但权重明显降低了。

对于真实项目，更影响体验的是：

1. 模型能不能稳定调用工具；
2. Harness 会不会正确管理上下文；
3. 搜索与代码理解是否足够快；
4. 有没有明确的权限模型；
5. 测试和浏览器验证能不能自动闭环；
6. 长任务失败后能不能恢复；
7. 多 Agent 是否真的减少了人的工作，而不是制造更多 review 工作。

一个 95 分的模型配上混乱的 Harness，最终体验可能不如一个 90 分模型配上优秀的工具链。

这也是 DeepSeek、Grok Build、Codex、Claude Code、OpenCode 等产品越来越值得从“系统”而不是单个模型去观察的原因。

## 七、给个人开发者的一个实用配置思路

如果不是大型团队，我反而不建议一开始就搞十几个 Agent。

可以从四个角色开始：

```text
Orchestrator
├── Explorer   只读搜索、建立代码地图
├── Worker     实现修改
├── Reviewer   独立审查 diff / 风险
└── Verifier   跑测试、浏览器、构建
```

再加三条规则：

```text
1. Explorer 不写代码
2. Reviewer 不直接修自己的审查意见
3. Verifier 只相信命令输出和可观察证据
```

这套结构已经足以覆盖绝大多数个人项目。

等你真的遇到瓶颈，再增加 Security、UI、Research、Docs 等专项 Agent。

不要为了“看起来很 Agentic”而制造 Agent。

## 结语

LINUX DO 和 NodeLoc 这类社区最大的价值，不只是提供新闻和资源链接，而是能看到很多**真实用户把新模型塞进真实工作流以后，到底哪里好用、哪里翻车。**

官方发布会告诉我们模型能做什么，社区则经常更早告诉我们：

> 它放进真实工程后，会发生什么。

而从最近这些讨论来看，我认为 AI Coding 的下一轮竞争重点已经越来越清晰：

**模型能力仍然重要，但 Harness、任务路由、上下文工程、验证闭环和恢复机制，会决定这些能力最终能释放多少。**

未来真正优秀的 AI 开发环境，可能不会要求用户每天研究“今天该切哪个模型”。

它应该理解任务，然后自动找到合适的角色、合适的模型和合适的验证方式。

到了那一步，我们管理的就不再是一堆模型，而是一套真正可以工作的数字团队。

---

## 参考资料

- [LINUX DO：多 Agent 架构是否真的能降本增效](https://linux.do/t/topic/2125977)
- [LINUX DO：提高开发效率、节省上下文的 Sub-agent 技巧](https://linux.do/t/topic/2215149)
- [LINUX DO：OpenCode Go + Oh My Pi 模型角色讨论](https://linux.do/t/topic/2559515)
- [LINUX DO：跨 Agent 会话与 handoff 讨论](https://linux.do/t/topic/2590975)
- [NodeLoc：Grok / DeepSeek / MiMo 多模型入口讨论](https://www.nodeloc.com/t/topic/100063)
- [OpenAI：Codex Use Cases](https://developers.openai.com/codex/use-cases)
