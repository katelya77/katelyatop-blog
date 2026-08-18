---
title: SGLang 为什么会“吃掉”一大块显存？从 GDN recurrent state 看混合注意力模型的长上下文成本
author: Katelya
published: 2026-08-18
category: 技术分享
tags: [SGLang, vLLM, GDN, Qwen, LLM推理, 长上下文, GPU]
draft: false
pinned: false
comment: true
description: 从近期社区里 SGLang 与 vLLM 显存差异的真实问题出发，拆解 Gated Delta Network 混合注意力模型为何除了 KV Cache 之外还需要 recurrent state，以及部署长上下文模型时应该怎样做容量规划。
---

最近在折腾本地大模型推理时，我看到一个很有代表性的现象：同一张接近 96GB 显存的 Blackwell 工作站卡、相近的模型和并发设置，SGLang 启动后可能明确预留十几 GB 的 **recurrent state**，结果能留给 KV Cache 的空间明显变少；而另一套 serving runtime 给出的 KV token 容量却大得多。

第一反应很容易是：**SGLang 显存管理是不是有问题？**

但如果模型已经不是传统的“每层都做标准 Transformer attention”，只盯着 KV Cache 其实会把问题看错。Qwen 新一代混合架构以及其他 linear-attention 模型正在把推理服务器带进一个新的容量规划阶段：除了权重、KV Cache、CUDA Graph 和临时 workspace，我们还必须认真计算 **recurrent state**。

本文不把社区里的单机数字当成官方 benchmark，而是借这个现象解释背后的机制，并给出我认为更实用的排查方法。

## 1. 先把两个概念拆开：KV Cache 和 recurrent state 不是一回事

传统 self-attention 在生成第 `t` 个 token 时，需要访问前面 token 的 Key / Value。为了不重复计算，推理框架会缓存这些 K/V：

```text
显存 ≈ 模型权重 + KV Cache + runtime overhead
```

序列越长、并发请求越多，KV Cache 通常越大。这也是为什么过去谈“128K 上下文需要多少显存”，大家首先想到 KV Cache。

GDN（Gated Delta Network）代表的是另一条路线。SGLang 官方文档把它描述为一种 **O(n) 的 linear attention mechanism**；在混合模型里，GDN linear-attention layer 会和标准 full-attention layer 交替出现。

关键变化在这里：linear attention 不一定需要为每个历史 token 保存完整 K/V，而是维护一个能够递归更新的状态。

可以把它抽象理解成：

```text
state_t = update(state_(t-1), token_t)
```

于是服务端的显存模型更像：

```text
显存 ≈ 权重
     + full-attention layers 的 KV Cache
     + linear-attention layers 的 recurrent state
     + CUDA Graph / workspace / allocator overhead
```

**“KV Cache 变少”不等于“历史信息完全免费”。**

它只是把一部分随 token 长度增长的存储，换成了另一种状态表示。

## 2. 为什么 recurrent state 会看起来特别大？

真正容易忽略的是：线上 serving 不是只维护一个序列。

如果 runtime 为大量并发 request slot 准备 GDN state，那么状态成本更接近：

```text
GDN state memory
≈ slots × GDN layers × state size per layer × dtype bytes
```

这意味着它和 KV Cache 有完全不同的增长维度。

KV Cache 对 **上下文长度** 极其敏感；recurrent state 则可能更容易受到 **并发 slot 数、层数、state shape 和精度** 影响。

所以出现下面这种现象并不矛盾：

- 模型理论上使用 linear attention，长序列的渐进成本更漂亮；
- 服务器为了同时承载很多请求，启动时却先预留了一块很显眼的 recurrent-state 显存；
- 最终日志显示可用于 KV Cache 的空间反而比预想的小。

换句话说，**长上下文效率和高并发显存效率不是同一个指标。**

## 3. SGLang 官方实现其实已经把 GDN 当成独立子系统

这一点从 SGLang 的文档设计就能看出来。

标准 attention backend 用 `--attention-backend` 管理，而 GDN 并不是简单塞进同一个开关。对于需要 GDN 的模型，runtime 会自动启用 linear attention，并提供独立的：

```bash
--linear-attn-backend
--linear-attn-decode-backend
--linear-attn-prefill-backend
```

SGLang 当前文档列出了 Triton、CuTe DSL、FlashInfer 等不同路径，并且对 Blackwell 不同计算能力、prefill/decode 阶段都有额外限制。

这背后的工程含义比“哪个 kernel 快”更重要：

**混合模型已经同时存在两套 attention 生命周期。**

full attention 关心 KV page、prefix cache；linear attention 还要关心 recurrent state、state checkpoint、对应 kernel 和 prefill/decode 状态传递。

因此，拿传统 Transformer 的调参经验直接套上去，越来越容易得出错误结论。

## 4. 为什么不能只比较“两个框架显示多少 KV tokens”

假设 A runtime 报告 350K KV token capacity，B runtime 报告 75K，我们不能立刻推出：

> A 的显存效率是 B 的四倍多。

至少需要继续核对四件事。

### 第一，两个 runtime 是否采用相同的 state 策略？

一个框架可能显式预分配 recurrent states，另一个可能按需分配、复用、offload，或者使用不同的并发上限。

### 第二，最大并发是不是一致？

如果 state 是 per-slot 的，那么 concurrency 本身就是一项显存参数。只对齐 `gpu-memory-utilization` 并不等于对齐了真实资源模型。

### 第三，state dtype 是否一致？

BF16、FP16 或更低精度状态的大小不同。SGLang 文档甚至会根据 recurrent-state dtype 决定某些 Blackwell GDN prefill backend 是否自动启用。

### 第四，最终业务指标是什么？

对个人 Coding Agent，我更在意：

```text
单请求 64K~128K context 是否稳定
TTFT 是否可接受
decode tok/s 是否稳定
连续跑几小时是否 OOM
```

而不是服务器理论上还能再塞多少个 request slot。

如果目标是 API 服务商，问题才会变成：

```text
固定 P99 延迟下的 requests/s
每 GPU 可承载并发
每百万 token 的 GPU 成本
```

两个场景根本不该用同一组参数做胜负判断。

## 5. 我会怎样排查一台“显存莫名少了 18GB”的服务器

如果我遇到类似问题，不会第一时间换框架，而会先把显存拆账。

### Step 1：记录空载基线

```bash
nvidia-smi
```

先确认没有桌面环境、旧 Python worker 或其他容器偷显存。

### Step 2：只启动模型，不发请求

记录：

```text
模型加载后显存
runtime 日志中的 KV capacity
recurrent state allocation
最大并发 / request slots
CUDA Graph 占用
```

### Step 3：把并发作为变量，而不是常量

分别测试低并发、中并发和默认并发。

如果 request slot 降低以后 recurrent-state reservation 明显下降，就已经定位到容量模型，而不是简单的“显存泄漏”。

### Step 4：再测试 context length

固定并发，逐级测试：

```text
8K → 32K → 64K → 128K
```

这样才能区分：到底是 KV Cache 在增长，还是固定 state reservation 已经提前吃掉了预算。

### Step 5：最后才比较 vLLM / SGLang

两个 runtime 至少统一：

```text
model / quant
context length
max concurrency
GPU memory fraction
dtype
speculative decoding
prefix cache
batch / chunked prefill policy
```

否则所谓 benchmark 很可能只是比较了两套默认配置。

## 6. 对个人本地 Agent，我反而会主动降低“服务器思维”

这是我觉得最值得记录的一点。

很多 serving 框架默认面向的是高吞吐 API，而个人 Coding Agent 常常只有 1～4 条活跃会话。为了一个永远不会出现的 128 路并发，提前保留大量状态显存，其实是在拿最宝贵的资源换一个用不到的指标。

我的调参优先级会是：

1. 先保证目标 context 能完整跑下来；
2. 把 concurrency 压到真实需求附近；
3. 再打开 prefix caching / speculative decoding；
4. 观察 TTFT 与 decode throughput；
5. 最后才追求极限 batch throughput。

这和“把 `gpu-memory-utilization` 拉到 0.95 然后祈祷不 OOM”是完全不同的思路。

## 7. 混合注意力正在改变推理框架的比较方式

过去比较 vLLM、SGLang 很容易变成几个数字：吞吐、TTFT、TPS、KV Cache utilization。

但 GDN、KDA 等 linear/hybrid attention 越来越普遍以后，我认为至少还要加三个维度：

- **state memory per concurrent sequence**；
- **state checkpoint / prefix reuse 的成本**；
- **prefill 与 decode 对不同 attention backend 的兼容性**。

SGLang 最近的 release 工作里已经能看到大量围绕 GDN/KDA 的优化：state layout 转置、projection fusion、CuTeDSL decode kernel、packed decode 等。这说明 recurrent state 并不是边缘实现细节，而正在成为推理 runtime 的核心优化对象。

## 结语

社区里“为什么 SGLang 比 vLLM 少了这么多 KV token”这个问题很有价值，因为它暴露了一个正在发生的范式变化：**我们已经不能继续只用 KV Cache 思维理解所有 LLM serving。**

对于混合 attention 模型，一块 GPU 的可用容量至少要拆成权重、full-attention KV、linear-attention recurrent state 和 runtime overhead 四部分，再结合并发与上下文长度判断。

所以看到十几 GB recurrent state 时，我不会先下结论说框架浪费显存。更值得问的是：

> 这些 state 是为多少并发预留的？我的实际 workload 真的需要它们吗？

把这个问题回答清楚，往往比继续换量化、砍上下文甚至换 GPU 更有效。

---

### 参考资料

- SGLang Attention Backend 文档：<https://docs.sglang.ai/advanced_features/attention_backend.html>
- SGLang GitHub / Releases：<https://github.com/sgl-project/sglang>
- 社区问题线索：2026-08-17 LocalLLaMA 关于 Qwen 系列模型在 SGLang / vLLM 下 GDN state 与 KV capacity 差异的讨论。社区数据仅作为问题样本，本文没有把单机结果视为官方 benchmark。
