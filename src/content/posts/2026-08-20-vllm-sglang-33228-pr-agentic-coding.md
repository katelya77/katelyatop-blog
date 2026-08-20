---
title: AI Coding Agent 让开源项目快了 20 倍？从 vLLM/SGLang 33228 个 PR 看懂真正的工程信号
author: Katelya
published: 2026-08-20
category: 技术分享
tags: [Coding Agent, vLLM, SGLang, GitHub, AI Engineering, Open Source, Developer Productivity]
draft: false
pinned: false
comment: true
description: 基于一项覆盖 vLLM 与 SGLang 共 33228 个合并 PR 的最新纵向研究，拆解 AI Coding 时代开源基础设施开发速度、PR 周期、评论密度与机器人贡献的真实变化，并给出团队评估 Agent 效率时更可靠的指标框架。
---

过去一年，一个很诱人的叙事是：**Coding Agent 正在让软件开发速度指数级增长。**

但“项目更新更快”与“Agent 直接写出了更多代码”其实是两回事。2026 年 8 月 14 日提交到 arXiv 的一项新研究，恰好提供了一组很适合拆解这个问题的数据：研究者统计了 vLLM 从 2023 年 2 月到 2026 年 6 月的 18,290 个合并 PR，以及 SGLang 从 2024 年 1 月到 2026 年 6 月的 14,938 个合并 PR，总计 **33,228 个 PR**。

论文报告，在其划分的最新阶段里，vLLM 的 PR throughput 相比早期增长约 21 倍，SGLang 约 17.9 倍；与此同时，bot-authored PR 对这部分增长的直接贡献却低于 0.2%。

这组数字最值得讨论的地方，不是“AI 让程序员快了 20 倍”，而恰恰是：**为什么仓库速度暴涨，但直接由机器人提交的 PR 却少得惊人？**

> 说明：本文中的 21×、17.9×、cycle time、bot contribution 等数字来自论文作者对 GitHub 历史数据的描述性统计，不应被理解为 Coding Agent 的因果实验结果。

## 1. 先别把 21× 当成 Agent benchmark

一个项目单位时间内合并更多 PR，可能同时来自很多因素：

- 项目本身进入高速增长期；
- contributor 数量增加；
- PR 被拆得更小；
- CI、review 与 release 流程成熟；
- 模型与硬件生态快速迭代，外部需求增加；
- AI 辅助编码降低了搜索、阅读、重构和测试成本；
- maintainer 使用机器人做 review、triage 或自动检查。

所以最危险的推导是：

```text
PR throughput 增长 21×
        ↓
AI Coding Agent 生产力增长 21×
```

这中间缺失了因果链。

论文更适合作为一个 **engineering signal**：AI 辅助开发快速普及的时期，两个高活跃 AI Infra 项目的协作结构发生了什么变化。

## 2. 真正值得关注的是“人变多了，而且循环变短了”

研究中一个很重要的现象，是两个项目的 monthly unique authors 都持续增长。这意味着 throughput 的上涨并不是简单地由少数 maintainer 疯狂提交造成的。

在最新阶段，论文报告的 median merge cycle time 为：

| 项目 | Median cycle time | P90 cycle time |
| --- | ---: | ---: |
| vLLM | 1.04 天 | 16.8 天 |
| SGLang | 0.62 天 | 14.3 天 |

这里能看到一个典型的长尾：大多数 PR 可以较快完成，但复杂改动依然可能拖上两周甚至更久。

这对 Coding Agent 特别有启发。Agent 最容易压缩的通常不是最困难的算法决策，而是大量循环成本：

```text
定位代码 → 修改 → 跑测试 → 读失败日志 → 再修改
```

如果每轮少花 5～15 分钟，最终表现出来的并不一定是“一个 Agent 独立完成一个 PR”，而可能是**同一个人一天能推进更多并行 PR**。

## 3. Bot PR 很少，不代表 AI 没参与

论文称 bot-authored PR 对 throughput 增长的贡献低于 0.2%。这很容易被反向解读成“AI Coding 没什么用”。

同样不成立。

今天的 Claude Code、Codex、Copilot、Cursor 等工具，很多输出最后仍然由人的 GitHub 身份提交。Git history 看到的是：

```text
Author: human@example.com
```

但生成过程可能已经是：

```text
人提出任务
  ↓
Agent 搜索仓库
  ↓
Agent 修改 6 个文件
  ↓
Agent 跑测试并修复
  ↓
人 review
  ↓
人的账号 commit / PR
```

只统计 `bot-authored PR` 会严重低估 AI-assisted development。

因此，这项研究更准确的结论应该是：**高速增长主要没有表现为“机器人账号取代人类账号提交 PR”。** 至于每个 human-authored PR 背后用了多少 AI，仅靠公开 GitHub metadata 很难确定。

## 4. 评论密度上涨，可能比代码量更有意思

论文还报告，PR comment density 相比早期在 vLLM 增长约 4.2 倍、SGLang 增长约 3.8 倍，并估计 bot comments 贡献了其中约 15%～20% 的增长。

为什么这件事重要？

因为现代 Coding Agent 的价值开始从“写代码”移动到**压缩反馈环**：

- 自动总结 diff；
- 找潜在 regression；
- 解释 CI failure；
- 提醒 benchmark 缺失；
- 检查 API compatibility；
- 生成 review 建议；
- 自动回答 reviewer 的重复问题。

一个成熟的 AI-native 仓库未必会出现大量机器人直接 merge 代码，却可能出现更多自动 review 与机器反馈。

从工程效率看，这甚至比“AI 写了多少行”更关键。

## 5. 为什么 vLLM / SGLang 是一个特殊样本

这两个仓库不能直接代表普通 Web 项目。

vLLM 与 SGLang 都处在极高速变化的推理基础设施赛道。新 GPU、新模型架构、量化格式、attention backend、speculative decoding、MoE kernel、distributed serving 等变化，会天然制造大量 PR。

例如一个新模型上线，可能同时需要：

```text
model definition
→ weight loader
→ quantization
→ attention backend
→ scheduler compatibility
→ distributed path
→ tests
→ docs / cookbook
```

这类项目本身就具有很强的并行开发属性。

因此，如果一家 5 人 SaaS 团队看到“21×”就要求接入 Agent 后季度 feature 数也增长 21 倍，指标设计从第一天就错了。

## 6. 团队真正应该测什么？

如果要判断 Coding Agent 是否提高工程效率，我更建议建立一套自己的 longitudinal baseline，而不是拿 SWE-bench 或别人的 PR 数量套进来。

### 指标一：Time to first working patch

从任务创建到第一次能够通过核心测试的 patch，需要多久？

Agent 很擅长减少 repository exploration 和 boilerplate 修改，这个指标通常最先变化。

### 指标二：Human intervention count

完成一次任务，人需要中断 Agent 多少次？

```text
0 次：自主完成
1～2 次：正常协作
5 次以上：Harness / context / tool design 可能有问题
```

单纯看任务是否完成，会掩盖大量人工救场。

### 指标三：Review correction rate

Agent 的 patch 提交 review 后，有多少比例需要因为以下问题返工：

- 功能错误；
- 测试不足；
- scope creep；
- 安全问题；
- API compatibility；
- 性能 regression。

如果 PR 数量翻倍，但 review correction 也翻倍，团队并没有真正获得两倍产能。

### 指标四：Cycle time 的 P50 / P90

只看平均值很容易被几个超长 PR 污染。

更有意义的是：

```text
P50：常规任务有没有明显变快？
P90：复杂任务的长尾有没有被 Agent 缩短？
```

如果 P50 大幅下降但 P90 不动，说明 Agent 主要在解决 routine work，而复杂架构决策仍然是瓶颈。

### 指标五：CI rerun / failed attempt

Agent 可以更快地产生 patch，也可以更快地产生错误 patch。

因此建议记录：

```text
每个 merged PR 的失败 CI 次数
每个任务的 test rerun 次数
每个任务消耗的 token / compute
```

最终应该优化的是 **cost per accepted change**，而不是 token/s 或代码生成速度。

## 7. Coding Agent 的真正放大器可能是 Harness

把这项研究与最近的 Agent 工程实践放在一起，会出现一个更有意思的判断：未来项目速度的差距，可能越来越来自 **Harness + workflow**，而不仅是模型能力。

一个裸模型只能输出代码；一个完整 Harness 会提供：

```text
Repo Context
   ↓
Planning
   ↓
Search / Read / Edit
   ↓
Sandbox Execution
   ↓
Test / Lint / Build
   ↓
Failure Feedback
   ↓
Review Gate
   ↓
PR
```

当每一环都可自动闭环时，人类开发者从“亲自执行每一步”变成“定义目标 + 审核关键决策”。

这能解释为什么 AI 的影响可能大量隐藏在人类账号背后：**Agent 不一定成为 contributor，它更像 contributor 的执行层。**

## 8. 一个适合自己团队的 A/B 实验

如果你已经在用 Coding Agent，可以用两周做一个很简单的实验。

第一周保留现有开发方式，记录 20～50 个真实任务：

```text
任务类型
开始时间
first patch 时间
merge 时间
失败 CI 次数
review 修改次数
人工介入次数
```

第二周使用固定 Agent + 固定模型 + 固定 Harness，再记录同一组指标。

注意不要只挑“Agent 擅长的任务”。最好分层：

| 类型 | 示例 |
| --- | --- |
| Routine | 改配置、补测试、依赖升级 |
| Repository-wide | API rename、跨目录重构 |
| Debug | 根据日志定位 regression |
| Feature | 新增完整业务功能 |
| Infra | CI、Docker、部署、性能优化 |

最终比较 P50/P90，而不是挑一个最漂亮的 demo。

## 9. 我从 33,228 个 PR 里真正看到什么

这项研究最有价值的地方，是提醒我们不要再用“AI 写了多少代码”理解 AI Coding。

至少在 vLLM 和 SGLang 这两个高速项目里，公开数据呈现的是：

1. PR throughput 大幅增长；
2. contributor participation 同时扩大；
3. median cycle time 已经很短，但复杂 PR 仍有明显长尾；
4. review/comment activity 显著增加；
5. 直接 bot-authored PR 只占增长中的极小部分。

这更像一种 **human + AI + automation 的协作系统扩容**，而不是机器人把程序员替换掉。

下一阶段真正值得追踪的问题，也不是“哪个 Coding Agent benchmark 又高了 3 分”，而是：

> 当 Agent 被嵌入 search、edit、test、review、CI 与 PR 的完整链路后，一个工程团队的 accepted change throughput 能提高多少，同时 defect rate 与 compute cost 是否仍然可控？

这才是 Coding Agent 从 Demo 走向工程生产力之后真正的 benchmark。

## 参考资料

- Jiada Li, Xuesong Ye, Olamide Olowoniyi, *Engineering Signals of Human-AI Collaboration in the Agentic Coding Era: A Longitudinal Analysis of 33,228 Pull Requests from vLLM and SGLang*, arXiv:2608.13884, 2026-08-14: https://arxiv.org/abs/2608.13884
- vLLM: https://github.com/vllm-project/vllm
- SGLang: https://github.com/sgl-project/sglang

本文对论文数据的解释属于工程分析；论文采用的是观察性、描述性纵向统计，因此本文不会把相关性包装成“AI 导致 20× 生产力”的因果结论。
