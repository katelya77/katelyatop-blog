---
title: Grok 4.5 来了：比“4.6 传闻”更值得关注的，是它正在进入真实开发工作流
author: Katelya
published: 2026-08-15
category: AI前沿
tags: [Grok, xAI, AI编程, Agent, GitHub Copilot]
draft: false
pinned: false
comment: true
description: 截至 2026 年 8 月，xAI 官方主力新模型是 Grok 4.5，而不是尚未正式发布的 Grok 4.6。本文关注它在 coding、agentic tasks 与 GitHub Copilot 中的真实落地。
---

# Grok 4.5 来了：比“4.6 传闻”更值得关注的，是它正在进入真实开发工作流

最近 AI 圈里很容易看到各种“下一代型号”的说法，Grok 也不例外。

但截至 2026 年 8 月 15 日，我能从 xAI 官方渠道确认到的最新正式主力版本是 **Grok 4.5**。没有足够官方证据支持把“Grok 4.6”写成已经正式发布的产品。

这也是我之后写 AI 时讯准备坚持的一条原则：**宁可晚一点，也不把型号传闻写成新闻。**

而真正值得关注的，是 Grok 4.5 已经从“模型发布”迅速进入 GitHub Copilot、Grok Build、Web/iOS/Android/X 等真实工作流。

## Grok 4.5 的定位已经很明确

xAI 在 2026 年 7 月 16 日发布 Grok 4.5，官方把重点放在三类任务：

- coding；
- agentic tasks；
- knowledge work。

这三个词其实比单纯的“推理更强”更值得研究。

前两年模型升级经常围绕数学、知识问答和 benchmark 展开，而现在厂商越来越强调 **能不能在真实环境中连续做事**。

例如一个 coding agent 需要的不只是写出函数，还要能够：

1. 阅读整个仓库；
2. 判断应该修改哪些文件；
3. 调用 shell / test / browser；
4. 处理失败结果；
5. 继续修改；
6. 最后给出可以合并的 diff。

这已经是一个“工作系统”，不是一次问答。

## 它为什么和普通聊天模型不一样

xAI 在 Grok 4.5 发布页中反复强调 real-world engineering 和 agentic coding。

官方给出了 DeepSWE、SWE Bench Pro、Terminal Bench 等评测结果，但这些数字应该按照厂商 benchmark 的正常方式理解：它们可以帮助判断趋势，却不能简单等同于“某模型在所有代码任务里一定更好”。

对我来说，更有价值的是模型设计方向已经变得非常清楚：

> 模型需要更长时间保持目标，持续调用工具，并在中途遇到错误时自己修正路线。

如果一个模型单轮代码生成非常强，却在第 15 次 tool call 后开始丢失目标，那么它依然很难成为可靠的工程 Agent。

## 7 月 28 日：Grok 4.5 进入 GitHub Copilot

xAI 在 7 月 28 日宣布 Grok 4.5 进入 GitHub Copilot。

这件事的重要性不在于“又多了一个模型选择器选项”，而在于它直接进入了数百万开发者原本就使用的 IDE / CLI / GitHub 工作流。

对模型厂商来说，2026 年的竞争越来越像：

**谁能成为开发环境中的默认劳动力，而不只是聊天网站里的默认模型。**

模型能力和分发渠道开始变得同样重要。

一个开发者不一定愿意为了某个模型重建自己的整套工作流，但如果它直接出现在 Copilot、Cursor、IDE、CLI 或现有 Agent 平台里，切换成本就会大幅降低。

## Grok Build 是另一个关键拼图

Grok 4.5 的价值不能脱离 Grok Build 单独看。

Grok Build 是 xAI 的终端 coding agent。它可以读取和编辑仓库、执行 shell、搜索网页、运行长任务，并通过 TUI 与用户交互。

2026 年 7 月，xAI 甚至把 Grok Build 的 Harness 和 TUI 开源了。

这说明 xAI 自己也在承认一个事实：

**模型本身只是 Agent 系统的一部分。**

真正决定实际体验的还包括 context assembly、tool dispatch、权限、任务状态、重试、diff review、MCP、skills、plugins 和 subagents。

我会另外单独写一篇文章讲 Harness，因为我认为这是 2026 年 AI 工程里最容易被普通用户忽略、但最值得学习的一层。

## Grok 4.5 的一个有趣信号：和 Cursor 一起训练

xAI 官方提到 Grok 4.5 was trained alongside Cursor。

不管具体训练合作细节如何，这句话释放出的方向很明显：coding model 的训练正在越来越靠近真实开发工具和真实工程任务。

未来一个“最强编程模型”可能不是在 HumanEval 里多拿几分，而是：

- 对仓库结构理解更稳；
- 更少无意义 tool call；
- 更少反复读取同一个文件；
- 失败后能正确恢复；
- 知道什么时候该测试；
- 能处理几百个文件的大型重构；
- 能在 PR review 中定位真正的问题。

这些能力很难用一个单一 benchmark 完整描述，但它们直接决定开发者愿不愿意每天用。

## “更聪明”之外，2026 年更重要的是持久性

我现在观察前沿模型时，会越来越重视一个词：**persistence**。

以前 AI 很像一个很聪明但记性有限的顾问。你问一次，它回答一次。

现在的目标更像一个工程搭档：

> 给它一个目标，它能连续工作、不断验证、直到任务真的完成。

Grok 4.5、GPT-5.6、DeepSeek V4，以及各家的 coding agent 都在往这个方向走。

这也是为什么模型上下文、工具系统和 Harness 变得越来越重要。

## 关于 Grok 4.6：目前应该怎么写？

截至本文撰写时间，我没有在 xAI 官方 News 中找到 Grok 4.6 的正式发布公告。

因此合理的表述是：

- 可以关注 Grok 后续版本；
- 可以讨论泄露或传闻，但必须明确来源级别；
- 不能把“Grok 4.6 已正式发布”写成确定事实。

等 xAI 真正发布时，再单独写正式版更新会更有价值。

## 我的判断

Grok 4.5 最值得关注的地方，不是某一张 benchmark 表。

而是它和 Grok Build、GitHub Copilot 一起，展示了 2026 年模型竞争的新形态：

**Frontier Model + Agent Harness + Developer Distribution。**

模型负责智能，Harness 负责把智能变成可靠行动，IDE / CLI / 平台负责把它送到用户真正工作的地方。

谁能把这三层做顺，谁才有机会真正成为开发者每天使用的 AI。

## 参考资料

- xAI：Introducing Grok 4.5  
  https://x.ai/news/grok-4-5
- xAI：Grok 4.5 in GitHub Copilot  
  https://x.ai/news/grok-github-copilot
- xAI：Introducing Grok Build  
  https://x.ai/news/grok-build-cli
- xAI：Grok Build is Now Open Source  
  https://x.ai/news/grok-build-open-source
