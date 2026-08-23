---
title: 同一个模型，为什么 RL 训练和推理算出的 logprob 还能不一样？拆解 vLLM × SkyRL 的 IsoExec
author: Katelya
published: 2026-08-23
category: 技术分享
tags: [vLLM, SkyRL, Reinforcement Learning, LLM, Inference, Megatron, Gated DeltaNet, Numerical Stability]
draft: false
pinned: false
comment: true
description: vLLM 与 SkyRL 在 2026 年 8 月发布 IsoExec，用统一执行契约与数值一致内核减少 rollout 和 trainer 之间的 logprob mismatch。本文从浮点非结合性、并行布局、Gated DeltaNet、工程调试与 benchmark 设计拆开这一问题，并解释为什么“数值一致”不等于“奖励一定更高”。
---

很多人第一次接触 LLM 强化学习系统时，会默认一个非常自然的前提：

> **只要模型参数一样、输入 token 一样，那么 rollout engine 和 trainer 算出来的 log probability 应该也一样。**

数学上，这个判断看起来完全正确。

工程上，却不一定。

2026 年 8 月 21 日，vLLM 与 SkyRL 团队发布了 **IsoExec**，专门解决 RL 系统里一个长期容易被误判成“算法不稳定”的问题：**训练端和推理端即使执行的是同一个 policy，也可能因为 kernel、batch shape、并行布局与 reduction order 不同，最终得到不同的 logprob。**

官方文章：

- [IsoExec: Unified Execution to Eliminate Trainer-Inference Mismatch in SkyRL](https://vllm-project.github.io/2026/08/21/isoexec.html)
- [SkyRL-IsoExec implementation](https://github.com/zanderjiang/SkyRL-IsoExec)

这件事真正重要的地方，不只是“数值误差变小了”。

它提出了一个很值得推广到整个 AI 系统工程里的思路：

> **当一个逻辑模型要跨多个 runtime 执行时，仅仅保证权重一致还不够，还需要明确约束它的数值执行语义。**

## 1. 为什么 RL 特别容易暴露这个问题？

典型的 LLM RL pipeline 往往至少有两套系统：

```text
Prompt
  │
  ▼
Rollout Engine
(vLLM / SGLang)
  │
  ├─ sample token
  ├─ record rollout logprob
  ▼
Trajectory
  │
  ▼
Trainer
(Megatron / FSDP / etc.)
  │
  ├─ recompute token logprob
  ├─ advantage / ratio / KL
  ▼
Optimizer Step
```

rollout engine 的目标通常是：

- 高吞吐；
- 高效 KV cache；
- 快速 decode；
- CUDA Graph；
- continuous batching；
- speculative / optimized kernels。

trainer 的目标却不同：

- 保存 activation；
- 计算 gradient；
- optimizer state；
- sequence parallel；
- tensor / expert parallel；
- 支持 backward。

所以虽然两边“模型名一样”，真正执行的计算路径往往并不一样。

这就是 mismatch 的土壤。

## 2. 浮点数不是实数：`(a+b)+c` 不一定等于 `a+(b+c)`

IsoExec 的问题根源并不神秘，它来自计算机体系结构里最基础的事实之一：

```text
(a + b) + c != a + (b + c)
```

对于 IEEE 浮点运算，舍入会发生在每一次有限精度计算之后。

因此，只要 reduction tree 变了，最后几个 bit 就可能发生变化。

单次 GEMM 里的一点点差别通常并不可怕。

问题是 LLM 有：

- 数十层甚至上百层；
- 大规模矩阵乘；
- attention reduction；
- MoE router；
- normalization；
- TP/EP/SP/CP 跨卡通信。

误差经过很多层传播后，最终可能反映到 token logits 与 logprob 上。

对于普通聊天推理，这种差别通常没有什么值得紧张的。

但在 RL 里，logprob 恰恰可能直接进入训练目标。

## 3. “同一个 policy”其实有两个含义

讨论 RL 的 on-policy 时，我们通常说：

```text
rollout policy μ
trainer policy π
```

理想状态下：

```text
μ = π
```

很多系统会把“权重相同”理解成这件事已经成立。

更严格地看，其实至少有两层：

### 参数层一致

```text
weights_rollout == weights_trainer
```

### 数值执行层一致

```text
forward_rollout(x) ≈ forward_trainer(x)
```

如果 kernel、dtype、并行拆分和 reduction order 不一样，那么第一条成立，不代表第二条严格成立。

所以 IsoExec 关注的是第二层。

## 4. 为什么这个误差会影响 RL？

很多 RL 方法都会用到 rollout 与当前 policy 的概率信息。

简化理解，可以把某些计算写成：

```text
ratio = exp(logp_trainer - logp_rollout)
```

理想情况下，如果模型实际上没有改变：

```text
logp_trainer ≈ logp_rollout
ratio ≈ 1
```

但如果两个 runtime 自己就制造了差异，那么系统可能观察到：

```text
ratio != 1
```

这时算法层看到的是“policy probability 变了”，实际上根因可能只是 execution path 不同。

这会让问题变得很难 debug：

```text
Reward 设计？
KL 设置？
Importance sampling？
Clipping？
模型更新？
还是 runtime 数值差异？
```

这些问题会混在一起。

## 5. IsoExec 的核心不是一个新 kernel，而是 Execution Contract

IsoExec 最有意思的设计之一，是它没有只说：

> “我们做了一套 deterministic kernel。”

它提出了 **Execution Contract**。

也就是把会影响数值结果的执行细节显式写成契约。

官方给出的结构包含类似：

```text
ExecutionContract
├─ cases
├─ composition
├─ claims
└─ identities
```

这里可以把它理解为：

### cases

当前是什么执行场景：

- trainer forward；
- engine prefill；
- engine decode。

### composition

每一段计算具体使用：

- 哪个 kernel；
- 什么 accumulation dtype；
- 什么 reduction 参数；
- 什么 decomposition。

### claims

哪些不变量已经被验证：

- topology invariance；
- batch invariance；
- parallelism invariance。

### identities

对执行契约本身生成 digest，用来检查两个 runtime 是否真的在执行相同的 numerical policy。

这个思路比“配置文件写一样”严格得多。

## 6. 为什么要给契约做 digest？

这里很像软件供应链里的 lockfile。

假设 rollout 和 trainer 都声明：

```text
model = Qwen3.5-35B-A3B
```

这仍然不能证明：

```text
kernel implementation
accumulation dtype
reduction schedule
parallel size
```

完全一致。

IsoExec 为契约计算 SHA-256 identity，官方把身份分成例如：

```text
semantic
numerical_policy
deployment
```

其中最关键的是前两类。

可以把它理解成：

```text
model checksum
+
numerical execution checksum
```

这让 runtime mismatch 从“猜”变成了可以被程序检查的状态。

## 7. 并行策略为什么会改变结果？

训练和推理通常不会使用完全相同的 parallel layout。

常见并行维度包括：

```text
DP  Data Parallel
PP  Pipeline Parallel
TP  Tensor Parallel
EP  Expert Parallel
SP  Sequence Parallel
CP  Context Parallel
```

其中有些只是移动 tensor，有些却会改变 reduction 的拆分方式。

例如 TP 可能把矩阵 contraction 分到多个 rank 上，再通过 collective reduction 合并。

如果：

```text
TP=2
```

和：

```text
TP=8
```

采用的分块方式不同，那么浮点加法顺序也可能不同。

数学表达式仍然一样，bit-level execution 却已经不同。

## 8. 固定 reduction tree 是怎么回事？

想让不同 parallel layout 得到更稳定的结果，一个自然办法是固定 reduction 的逻辑顺序。

可以想象有四个 partial result：

```text
A B C D
```

不固定时可能出现：

```text
((A+B)+C)+D
```

也可能是：

```text
(A+B)+(C+D)
```

IsoExec 使用固定 reduction 思路，让不同拓扑尽可能遵守同一个 arithmetic schedule。

官方实现中还讨论了在 K dimension 上构造固定 leaves 与 binary reduction tree。

真正需要一致的不是“哪张 GPU 算了什么”，而是：

> **最终这些 partial values 以什么数值顺序被组合。**

## 9. MoE 会让问题更复杂

对于 Dense 模型，主要关注 GEMM、attention 和 normalization。

MoE 还多了一层：

```text
router
  │
  ├─ expert A
  ├─ expert B
  └─ expert C
       │
       ▼
expert output combine
```

当 expert parallelism 改变时，expert 可能分布在不同 rank。

如果最后按照 rank 顺序合并输出，而不是固定 routing order，那么 parallel layout 改变后 arithmetic order 也跟着改变。

IsoExec 的工程思路是：

```text
combine by deterministic routing order
```

而不是：

```text
combine by accidental rank order
```

这个区别非常值得注意。

## 10. Gated DeltaNet 是这件事里更难的一块

如果只是普通 Transformer attention，大家对训练和 decode 的差异已经比较熟悉。

线性注意力 / recurrent hybrid architecture 会更麻烦。

像 Gated DeltaNet 这类结构：

训练时为了吞吐，往往使用 chunkwise parallel 形式；

decode 时为了单 token 效率，又更适合 recurrent form。

数学上两者可能等价。

浮点执行上却不一定等价。

官方文章测到 FLA chunkwise-parallel kernel 与 vLLM fused recurrent kernel 的 GDN layer output：

```text
mean absolute difference ≈ 1.7e-2
max difference           ≈ 0.25
```

这个量级已经不是“最后一位小数偶尔飘一下”的直觉了。

## 11. CPR：Chunkwise-Parallel Recurrent

为了解决 GDN 的训练 / prefill / decode 一致性，IsoExec 引入了 **CPR，Chunkwise-Parallel Recurrent**。

它试图同时满足两件互相拉扯的目标：

```text
Numerical alignment
        +
Parallel efficiency
```

如果为了 bitwise consistency，把所有阶段都强制改成完全 serial recurrent，理论上容易对齐，但训练吞吐可能惨不忍睹。

所以 CPR 的意义就在于：

> 让 recurrence 保持统一数值语义，同时仍然能够按 chunk 做并行计算。

这类设计特别适合正在快速增加的 hybrid attention model。

## 12. 官方实验结果到底说明了什么？

IsoExec 官方实验使用：

```text
Model: Qwen3.5-35B-A3B
Training: DAPO
Hardware: 8 × H100
Mode: synchronous RL
Steps: 50
```

rollout 与 trainer 的平均绝对 logprob difference：

```text
Native SkyRL: 1.648e-2
IsoExec:      6.744e-7
```

平均 per-step maximum difference：

```text
Native: 5.073
IsoExec: 7.358e-6
```

从 numerical parity 的角度看，这是非常明显的变化。

## 13. 但代价也非常真实：约 25% 全步 overhead

官方同时给出了 timing。

```text
Generation
Native:  591.3 s
IsoExec: 776.6 s
Overhead: +31.3%
```

```text
Policy training
Native:  498.6 s
IsoExec: 591.3 s
Overhead: +18.6%
```

```text
Full RL step
Native:  1224.6 s
IsoExec: 1534.0 s
Overhead: +25.3%
```

因此，正确的表述不是：

> IsoExec 免费消除了 RL mismatch。

而应该是：

> IsoExec 用一部分吞吐换取更严格、可验证的跨 runtime 数值一致性。

这是一笔工程 trade-off。

## 14. 最值得强调的一句：官方并没有声称 reward 明显变好了

这一点很重要。

官方明确指出，在这次短的 50-step run 里，**没有观察到消除 mismatch 带来的明显 reward improvement**。

这反而让实验更可信。

因为 numerical consistency 能证明的是：

```text
减少 runtime 作为额外变量
```

它不能自动证明：

```text
RL 算法一定学得更好
```

如果把“logprob 更一致”直接写成“模型能力更强”，就是典型的过度解读。

## 15. IsoExec 真正提升的可能首先是可调试性

很多 infra 优化的价值，并不首先体现在最终 reward。

它可能先体现在：

```text
更容易复现
更容易 bisect
更容易定位 regression
更容易验证新 kernel
更容易比较 RL algorithm
```

假设你在引入一个新的 GRPO variant 后 reward 崩了。

以前你可能需要同时怀疑：

```text
算法实现
reward model
sampling
trainer
rollout engine
parallel layout
kernel
```

如果 runtime numerical policy 被固定，排查空间就会缩小很多。

这就是工程价值。

## 16. 这和“随机种子固定”完全不是一回事

很多人遇到 reproducibility 问题，第一反应是：

```text
seed = 42
```

但 seed 主要控制随机过程。

IsoExec 处理的却是 deterministic computation 里的 numerical divergence。

即使：

```text
seed 一样
权重一样
input 一样
```

只要：

```text
kernel 不一样
reduction order 不一样
parallel layout 不一样
```

结果仍然可能不同。

所以 reproducibility 至少可以拆成：

```text
Randomness reproducibility
Data reproducibility
Model-state reproducibility
Execution reproducibility
```

IsoExec 主要补的是最后一层。

## 17. 这对普通 vLLM 用户有影响吗？

如果你只是：

- 部署一个聊天 API；
- 本地跑 Qwen；
- 做普通 RAG；
- 跑单一推理服务；

那么通常没必要为了 bitwise consistency 牺牲 25% 左右的端到端性能。

但如果你在做：

- RLHF / GRPO / DAPO；
- rollout 与 trainer 分离；
- 多种 parallel layout；
- kernel 开发；
- RL infra benchmark；
- model architecture research；

那么这个问题就非常值得重视。

## 18. 我会怎样给 RL infra 做一套 mismatch benchmark？

比起只看 reward curve，我更建议至少记录四层指标。

### A. Token parity

固定：

```text
weights
prompt
sampled token sequence
```

比较：

```text
rollout logprob
trainer recomputed logprob
```

指标：

```text
mean abs diff
P50 / P95 / P99 diff
max diff
```

### B. Parallel-layout parity

分别跑：

```text
TP1
TP2
TP4
TP8
EP variants
SP on/off
```

验证相同 token 的数值漂移。

### C. Batch invariance

同一条 request 分别放进：

```text
batch size 1
batch size 8
batch size 64
```

看它的 forward result 是否被“同 batch 里的其他样本”影响。

### D. Training impact

最后才看：

```text
reward
KL
clipping ratio
loss
training stability
wall-clock
GPU utilization
```

这样可以避免把系统问题和算法问题搅在一起。

## 19. Benchmark 不应该只问“更准了吗？”

对于 IsoExec 这类基础设施，更合理的问题是：

```text
1. mismatch 降低多少？
2. throughput 损失多少？
3. memory 增加多少？
4. 新模型接入成本多少？
5. 新 kernel 要验证多久？
6. debug 时间是否减少？
7. reward 是否真的更稳定？
```

因为最终选择往往不是：

```text
accuracy vs no accuracy
```

而是：

```text
numerical consistency
        vs
system throughput
```

## 20. 一个很现实的工程策略：不要所有环境都强制最严格一致

我更倾向于分层使用。

### 开发 / correctness 环境

开启严格 execution contract：

```text
high consistency
slow acceptable
```

用于：

- kernel validation；
- regression；
- algorithm debugging。

### 大规模训练环境

如果已经确认某些 mismatch 不影响训练目标，则可以针对 throughput 做更激进优化。

也就是：

```text
Correctness Profile
Performance Profile
```

而不是让所有 workload 永远支付同一份 determinism tax。

## 21. Execution Contract 这个概念可能不只属于 RL

我认为 IsoExec 最值得借鉴的并不是某个具体 kernel，而是“执行契约”这个抽象。

未来 AI infra 越来越多会跨：

```text
PyTorch
vLLM
SGLang
TensorRT-LLM
Megatron
FSDP
custom runtime
```

如果一个模型需要在这些系统之间迁移，除了：

```text
model config
weights
```

我们可能还需要记录：

```text
numerical execution policy
```

它会越来越像：

```text
AI runtime lockfile
```

## 22. 对 Coding Agent / 自动优化系统也有启发

现在越来越多 Coding Agent 会自动：

- 改 kernel；
- 调 TP/EP 参数；
- 换 attention backend；
- 做 quantization；
- 修改 compile flag；
- 生成 benchmark patch。

如果评价标准只有：

```text
tokens/s ↑
```

Agent 很容易做出“更快但语义悄悄漂移”的优化。

更安全的 acceptance gate 应该是：

```text
Performance Gain
      AND
Numerical Contract Pass
```

也就是说：

> **性能优化 Agent 不能只拥有 benchmark，还必须拥有 correctness oracle。**

IsoExec 的 execution contract 正好提供了一种可以自动化验证的方向。

## 23. 为什么这个方向在 hybrid model 时代会更重要？

现在模型 architecture 已经越来越不只是标准 Transformer。

我们开始看到：

```text
full attention
sliding window
linear attention
Gated DeltaNet
MoE
hybrid recurrent blocks
```

不同 layer 类型在 training / prefill / decode 里可能天然采用不同算法。

架构越混合：

```text
runtime execution gap 越容易扩大
```

这也是为什么 GDN 在 IsoExec 里占了很大篇幅。

## 24. 当前不要过度外推的几个结论

IsoExec 很有价值，但目前仍然不应该外推出以下说法。

### “所有 RL reward collapse 都是 logprob mismatch”

不是。

reward collapse 可以来自很多算法和数据问题。

### “bitwise consistency 一定提升最终模型能力”

官方当前短实验没有证明这一点。

### “25% overhead 是固定成本”

也不是。

这个数字来自官方指定硬件、模型、并行策略与 50-step workload，不应该直接推广到所有模型。

### “普通 inference 也应该全面开启”

没有必要。

这是典型的 workload-specific correctness requirement。

## 25. 我认为 IsoExec 最重要的工程信号

过去几年，我们优化 LLM runtime 时关注的关键词主要是：

```text
吞吐
延迟
显存
KV Cache
并行
量化
```

IsoExec 把另一个指标推到了更前面：

```text
Numerical Execution Identity
```

也就是：

> 两个 runtime 到底是不是在“数值意义上执行同一个模型”？

这个问题在普通 serving 时代不一定最重要。

但在 RL、自动 kernel 优化、跨 runtime 训练与复杂 hybrid architecture 里，它会越来越重要。

## 结语

IsoExec 不是一次简单的“vLLM 又快了多少”的发布。

它更像是在提醒整个 RL infra 社区：

```text
Same weights
≠
Same execution
```

而：

```text
Same mathematical graph
≠
Same floating-point result
```

它通过统一 execution contract、batch/parallelism invariant kernels，以及针对 Gated DeltaNet 的 CPR，把 rollout engine 与 trainer 之间长期隐藏的 numerical mismatch 变成一个可以显式描述、校验和 benchmark 的工程对象。

官方当前实验里，代价也很明确：大约 **25.3% full-step overhead**；收益则主要首先体现在 logprob parity 与系统可调试性，而不是已经被证明的 reward 提升。

这反而是我认为它最值得关注的地方。

真正成熟的 AI infra，不应该只追求：

```text
更快
```

还应该能够回答：

```text
我到底算的是不是同一件事？
```

---

## 参考资料

- [vLLM Blog — IsoExec: Unified Execution to Eliminate Trainer-Inference Mismatch in SkyRL](https://vllm-project.github.io/2026/08/21/isoexec.html)
- [SkyRL-IsoExec](https://github.com/zanderjiang/SkyRL-IsoExec)
- [vLLM RFC — Logprobs/Logits Semantics and Determinism Across the vLLM Ecosystem](https://github.com/vllm-project/vllm/issues/42259)
