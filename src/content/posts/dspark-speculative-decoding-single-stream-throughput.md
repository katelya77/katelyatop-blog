---
title: DSpark 的“60%~85% 加速”为什么不等于你的 Coding Agent 快 85%？拆开 speculative decoding 的单流与吞吐账

author: Katelya
published: 2026-08-18
category: 技术分享
tags: [DSpark, Speculative Decoding, vLLM, SGLang, DeepSeek, Coding Agent, LLM推理]
draft: false
pinned: false
comment: true
description: 从近期 DSpark 在 vLLM 社区移植与 Qwen3.8 本地推理讨论出发，解释 speculative decoding 为什么必须区分单请求 latency、接受长度和高并发 throughput，以及如何为个人 Coding Agent 做不容易被 headline 误导的实测。
---

最近看本地推理社区时，我发现 **DSpark** 开始频繁和“更快的 Coding Agent”一起出现。它很容易让人产生一个直觉：既然 speculative decoding 能一次猜多个 token，论文或项目又给出了很漂亮的加速数字，那把它打开以后，我的单人 OpenCode / Codex 类工作流是不是也能直接快几十个百分点？

答案是：**不一定，而且这个“不一定”恰好是推理 benchmark 最容易看错的地方。**

这几天一个很值得研究的社区工程项目把 DeepSeek-V4-Flash 的 DSpark drafter 移植到 vLLM，并用 reference oracle 做逐 token / 中间状态校验。作者后来还修掉了一个会让 draft sliding window 变 stale 的真实 bug。更有意思的不是某个绝对 TPS，而是修复以后仍然暴露出的规律：**单用户 decode 的收益，和高并发服务的 throughput 收益根本不是同一个东西。**

本文不把社区项目的单机结果当作 vLLM、SGLang 或 DeepSeek 的官方 benchmark。我要借它拆开 speculative decoding 的性能账，并给个人 Coding Agent 一套更靠谱的测试方法。

## 1. speculative decoding 到底在省什么？

普通 autoregressive decode 每轮大致做一件事：

```text
大模型 forward → 得到下一个 token → 再 forward → 再得到一个 token
```

问题是 decode 阶段经常受显存带宽、kernel launch 和小 batch 利用率限制。为了生成一个 token，仍然要把大模型的大量权重搬一遍。

speculative decoding 的核心思路是先让一个更便宜的 drafter 猜一串 token，再让 target model 一次验证多个候选：

```text
Draft:   t1 → t2 → t3 → t4 → t5
Target:  一次验证这批候选
Accept:  t1 ✓  t2 ✓  t3 ✓  t4 ✗
```

如果平均每次 target forward 能确认不止一个 token，那么昂贵 target model 的调用就被摊薄了。

所以一个很重要的量是 **accepted length**。粗略地说，接受得越长，越有机会降低每个最终 token 对 target forward 的需求。

但注意：

> accepted length 不是最终加速比。

因为 drafter 本身也要计算，验证更宽的 token block 也有成本，调度、KV/state 更新、采样和同步同样有成本。

## 2. 为什么“接受 4 个 token”不等于 4 倍快？

可以用一个简化模型理解：

```text
T_step = T_draft + T_verify + T_scheduler + T_state
```

一轮最终接受 `A` 个 token，那么近似的单位 token 成本是：

```text
T_token ≈ T_step / A
```

如果 drafter 很重，`T_draft` 会吃掉收益；如果 verify kernel 没有很好地并行，`T_verify` 也不会免费；如果接受率随着 draft depth 快速下降，多猜的后几个 token 可能只是在增加验证成本。

因此实际调优不是“num_speculative_tokens 越大越好”，而是在寻找：

```text
额外 draft/verify 成本
          vs
平均接受长度增加
```

之间的平衡点。

这也是为什么同一种 speculative 方法，在自然语言续写、结构化 JSON、代码生成和高温度采样上的表现可能完全不同。

## 3. DSpark 更值得注意的是“调度”，不只是“多猜几个 token”

DSpark 这一类方法真正有意思的地方，是它并不只想把 drafter 做得更准。

公开实现和近期移植讨论里反复出现一个关键词：**confidence-scheduled verification**。

直观理解是，drafter 不只是给候选 token，还尝试判断后续候选有多大概率继续存活。如果某条请求后半段 draft 的生存概率已经很低，系统可以少验证一些低价值候选，把 batch 中腾出来的计算位置让给别的请求。

这就产生了两个完全不同的收益来源：

```text
A. 单请求收益
更长 accepted tokens
→ 同一个请求更少做昂贵 target step

B. 多请求收益
动态缩短低价值 verify work
→ batch 空间让给其他请求
→ 整台 GPU 的吞吐提高
```

**B 在只有一个活跃请求时几乎没有东西可以“让”。**

这就是理解 headline benchmark 的关键。

## 4. 单流 latency 和服务吞吐必须分开看

假设一个推理系统宣传：

```text
throughput +60%
```

它可能意味着在固定延迟约束、一定并发量下：

```text
原来：GPU 同时稳定服务 100 个请求
现在：GPU 同时稳定服务 160 个请求
```

但个人 Coding Agent 关心的往往是：

```text
我这一条请求原来 100 tok/s
现在是不是 160 tok/s？
```

这两个问题没有等价关系。

高并发 serving 的 scheduler 可以把不同请求拼成 batch，利用某个请求空出来的验证槽位；而单流生成没有第二条请求来吃这块资源。

因此以后看到 speculative decoding 的“加速 XX%”，我会先找 benchmark 的三个条件：

1. **batch / concurrency 是多少？**
2. **指标是 output tok/s、request throughput，还是 time-to-completion？**
3. **baseline 是普通 decode、MTP，还是另一套 speculative decoding？**

这三个条件不写清楚，数字基本不能直接拿来指导自己的机器。

## 5. 最近的 vLLM 社区移植为什么很有参考价值？

近期一个针对 DeepSeek-V4-Flash 的社区 vLLM DSpark port 做了一件我很喜欢的事：作者没有只看最终 TPS，而是建立 reference oracle，对 draft 中间状态、attention、Markov head 和最终 token 做校验。

他们后来定位到一个很典型的状态管理 bug：speculative step 一次可能接受多个位置，但实现最初只把 bonus position 的 `main_kv` 写回 sliding window，遗漏了中间已接受位置。

后果是：

```text
接受多个 token
→ 逻辑位置向前跳多格
→ window 却只更新一格
→ 旧状态比例越来越高
→ drafter 后续看到 stale context
→ acceptance 逐步下降
```

这个案例对我最大的启发不是某个具体加速数字，而是：

> speculative decoding 是一个状态一致性问题，不只是“外挂一个小模型”。

对于带 sliding window、MTP、hybrid attention 或 recurrent state 的新模型尤其如此。只要 target KV、draft state、position id、accepted block 的推进规则有一处不同步，性能甚至正确性都可能出问题。

## 6. 还有一个坑：模型“能加载”不等于 speculator 真正接对了

这几天社区还出现了 Qwen3.8-27B DSpark 在 vLLM 上的适配讨论。一个非常典型的问题来自 checkpoint 里的 architecture 名称与 runtime registry 路由不一致：权重和配置里已经存在 DSpark 所需字段，但模型类名称可能把 runtime 引到另一套实现。

这种问题特别容易制造一种错觉：

```text
文件都下载了
配置也识别了
服务甚至开始启动了
= 支持完成
```

实际上 speculative stack 至少还要确认：

```text
checkpoint architecture
→ runtime model registry
→ drafter implementation
→ speculative method
→ target model hidden/state interface
→ verifier / scheduler
```

整个链条是一致的。

所以我不建议为了“跑起来”随便改 config 里的 architecture 然后就开始做 benchmark。至少先确认对应 runtime 版本确实存在目标模型类，并用确定性 prompt 检查 speculative on/off 的输出一致性。

## 7. 如果是个人 Coding Agent，我会怎么测？

我不会先跑一个平均 TPS，然后宣布谁更快，而会准备四组 workload。

### A. 可预测文本

例如：

```text
生成重复格式的数据结构
补全固定模板
输出规则化 Markdown
```

这类任务 drafter 容易猜中，通常最能展示 speculative decoding 的上限。

### B. 常规代码生成

例如实现一个已有明确接口的 REST endpoint、React component 或 CRUD。

这是 Coding Agent 最常见的负载。

### C. 新颖推理 / 算法代码

要求模型现场推导逻辑，而不是继续高概率模板。

这类 token 分布更难预测，draft acceptance 往往更值得观察。

### D. 长上下文仓库修改

把 32K、64K 甚至更长的真实代码上下文送进去，再要求生成 patch。

这里不仅要看 decode，还要看 prefill、KV/state 占用和 speculative state 是否让可用上下文缩水。

每组至少记录：

```text
TTFT
output tok/s
end-to-end completion time
accepted tokens / draft step
GPU memory
最终输出是否一致或质量是否明显变化
```

然后做三组对照：

```text
Baseline: speculative off
MTP:      如果模型原生支持
DSpark:   相同 target model / quant / context
```

这样得到的结果才真正能回答：**它适不适合我的 Agent。**

## 8. 高并发 API 服务应该换一套测试方法

如果部署的是多人 API，测试重点反过来：

```text
concurrency: 1 / 8 / 32 / 64 / 128
```

在每一级并发下记录：

```text
request/s
aggregate output tok/s
P50 / P95 / P99 latency
TTFT
TPOT
GPU utilization
OOM / queueing
```

尤其要画出：

```text
吞吐 ↑
延迟 ↑
```

之间的曲线，而不是只挑最高吞吐点。

如果一种 confidence scheduler 的优势主要在并发 32 以后才出现，那么它对 API 服务商非常有价值，但对单人工作站可能几乎不是购买新 GPU 或换 runtime 的理由。

## 9. 我现在怎么看 vLLM / SGLang 的 speculative 路线？

我越来越不想用“谁支持的 speculator 更多”来比较两个框架。

真正应该看的是四层：

```text
模型层：drafter / MTP 的质量
状态层：KV、recurrent state、position 是否一致
执行层：verify kernel 是否高效
调度层：并发时能不能把 speculative 的空隙真正变成吞吐
```

只完成第一层，demo 可以跑；四层都做好，才会变成 production advantage。

SGLang 长期强调高性能 serving 与 speculative execution；vLLM 则拥有非常成熟的通用 serving 生态。新模型越来越多地把 MTP、hybrid attention、专用 drafter 一起交付以后，二者竞争的重点也会从“有没有 speculative decoding”转向：**谁能把模型特有的预测结构和 scheduler 更紧密地融合。**

## 10. 给本地推理玩家的一条判断原则

如果你只有一张 5090 / RTX PRO，主要跑个人 Agent，我建议看到任何 speculative benchmark 时先问：

> 这个数字是“我的这一条回答更快”，还是“同一张卡能同时服务更多人”？

如果是后者，不要把它自动换算成单流 TPS。

如果你真的想优化个人体验，优先级通常应该是：

```text
模型/量化能否完整驻留
→ 目标 context 是否稳定
→ TTFT
→ 单流 decode
→ speculative accepted length
→ 最后才是高并发 aggregate throughput
```

这和服务商的排序完全不同。

## 结语

speculative decoding 是我认为未来两年推理栈里最值得持续跟的一条线，因为模型厂商已经不满足于只发布一个 target checkpoint：MTP head、专用 drafter、confidence head 和 scheduler 正逐渐变成模型系统的一部分。

但也正因为它越来越复杂，**一个“+85%”会比以前更需要上下文。**

单流 latency、accepted length、batch throughput、并发调度收益是四个不同指标。把它们混成一个“更快”，最后很容易在自己的 Coding Agent 上得到完全不同的体验。

所以我更愿意把 speculative decoding 当成一套完整系统来测：先验证状态正确，再测 accepted length；先区分单流和并发，再讨论 headline speedup。

这比追着某个 TPS 截图换框架，要可靠得多。

---

### 参考资料

- vLLM 官方仓库：<https://github.com/vllm-project/vllm>
- SGLang 官方仓库：<https://github.com/sgl-project/sglang>
- 社区 DSpark vLLM 工程移植与验证记录：<https://github.com/vladimir-voinea/dspark-vllm-gb10>
- 近期社区 Qwen3.8-27B / DSpark 适配讨论用于发现工程问题；文中没有把社区单机数据作为官方 benchmark。