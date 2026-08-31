---
title: 流式回答断了，为什么不能从最后一句继续？从 SGLang Raw Token Stream RFC 拆解“可恢复推理”
author: Katelya
published: 2026-08-26
category: 技术分享
tags: [SGLang, LLM Serving, Streaming, Token, Inference, Agent, Long Context, vLLM, Developer Tools, Reliability]
draft: false
pinned: false
comment: true
description: SGLang 在 2026 年 8 月 26 日出现了一份关于 resumable raw token stream 的新 RFC：与其只把解析后的文本 delta 推给客户端，不如让流式 Chat Completions 同时逐步暴露原始 token IDs，使中断后的任务能够用精确 token 前缀重新进入模型。本文拆开 SSE 重放、token-prefix resume、KV Cache、reasoning/tool parser、随机采样状态与 Agent 长任务恢复之间的区别，并给出一套可复现的故障注入测试方法。
---

我们平时看到大模型“流式输出”，很容易形成一种错觉：

> 屏幕上已经显示出来的文字，应该天然就是一个可以恢复的 checkpoint。

但真正做过 LLM Serving、长上下文 Agent、Coding Agent 或者远程推理网关的人，迟早会遇到一个很不舒服的问题：

- 模型已经生成了 3000 个 token；
- 浏览器断网；
- SSE 连接被重置；
- Worker 要滚动升级；
- Scheduler 要 drain；
- 某个长任务被抢占；
- 或者你主动想把请求迁移到另一台机器。

这时你到底能不能“从刚才那里继续”？

答案不是简单的能或不能。

因为“恢复流式回答”至少有三种完全不同的含义：

1. **Transport Resume：把已经生成过的 SSE chunk 重新发给客户端；**
2. **Generation Resume：让模型从已经生成的 token 前缀继续解码；**
3. **State Resume：连 KV Cache、recurrent state、采样器状态等运行时状态也一起恢复。**

这三件事看起来都叫 resume，工程成本却完全不是一个量级。

2026 年 8 月 26 日，SGLang 仓库出现了一份新的 RFC：

[Resumable raw token stream for /v1/chat/completions](https://github.com/sgl-project/sglang/issues/36431)

它提出的不是“做一个更稳定的 SSE”，而是一个更底层的想法：

> 对流式 Chat Completions，逐步暴露模型真正生成的 raw token IDs，使客户端能持续保存精确生成前缀，并在任务中断后把 `prompt_token_ids + output_token_ids_so_far` 重新作为输入继续生成。

这个提议看上去只是“多返回几个整数”。

但它实际上碰到了 LLM Serving 中一个非常关键的边界：

> **人类看到的文本流，不等于模型内部的生成轨迹。**

下面把这件事拆开。

---

## 1. 今天的 Chat Streaming 到底在流什么？

OpenAI-compatible `/v1/chat/completions` 的常见流式接口，本质上是不断发送结构化 delta。

最简单的情况是：

```text
模型 token
  ↓
detokenizer
  ↓
text delta
  ↓
SSE
  ↓
浏览器
```

如果模型只是普通聊天，这个模型看起来很自然。

例如模型内部生成：

```text
[1234, 567, 89, 42]
```

detokenize 后可能逐步得到：

```text
"你好"
"，"
"世界"
"！"
```

于是客户端只保存：

```text
你好，世界！
```

对于“展示内容”，这通常足够。

但如果你的目标变成：

> **中断后精确恢复模型的输入前缀**

文本就不再是最可靠的状态表示。

为什么？

因为 tokenizer 并不是“一个汉字 = 一个 token”，也不是“一个文本 delta = 一组唯一 token”。

实际系统里还存在：

- whitespace normalization；
- special tokens；
- byte fallback；
- Unicode 边界；
- incremental detokenization；
- reasoning parser；
- tool-call parser；
- structured output parser；
- stop token trimming。

客户端看到的文本，可能已经经过多层转换。

而真正让模型继续运行所需要的，是**模型词表空间中的 token prefix**。

---

## 2. SGLang 当前为什么不允许 Chat Streaming 直接 `return_token_ids`？

SGLang 当前主线代码已经存在 `return_token_ids` 和 `return_prompt_token_ids` 等扩展字段。

但在 `/v1/chat/completions` 的 streaming 路径中，代码会显式拒绝它们。

当前实现中可以看到类似约束：

```python
if request.stream:
    if request.return_prompt_token_ids:
        raise ValueError(...)

    if request.return_token_ids:
        raise ValueError(
            "return_token_ids is not supported with streaming on "
            "/v1/chat/completions..."
        )
```

源码：

[SGLang serving_chat.py](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/entrypoints/openai/serving_chat.py)

这并不是因为 SGLang 完全没有 token-ID streaming 的基础设施。

相反，`/v1/completions` 的 streaming 实现里已经存在对 output token IDs 做增量切片的逻辑：

```text
output_ids
  ↓
按照上一次发送位置切片
  ↓
chunk_token_ids
```

源码：

[SGLang serving_completions.py](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/entrypoints/openai/serving_completions.py)

所以今天这份 RFC 真正要补的，不只是“把某个字段从 false 改成 true”。

难点在于 **Chat Completions 比传统 Completions 多了一层语义解析系统**。

---

## 3. Reasoning 与 Tool Calling 让“文本 delta = token delta”彻底失效

这是整个问题最值得注意的地方。

现在的大模型输出已经不再只是：

```text
Hello world
```

模型原始生成序列可能同时包含：

- reasoning token；
- final answer token；
- tool name；
- tool arguments；
- special delimiters；
- parser control tokens。

然后 Serving 层再把这些 token 解析成 OpenAI-compatible 结构。

一个简化流程可能是：

```text
raw model tokens
      │
      ├── reasoning parser ──> reasoning_content
      │
      ├── tool parser ───────> tool_calls
      │
      └── text parser ───────> content
```

也就是说：

> **客户端收到的是协议层事件，而不是模型原始生成日志。**

某些 token 甚至可能：

- 不直接出现在 `content` 中；
- 被 parser 吃掉；
- 被合并进一个 tool call；
- 在多个 SSE chunk 之间重新切分。

于是，如果你试图这样做：

```python
resume_text = "".join(all_content_deltas)
new_prompt = old_prompt + resume_text
```

你很可能得到的只是“看起来像之前内容”的文本，而不是模型当时真正走过的 token prefix。

对于普通自然语言聊天，也许多数情况下看不出差异。

但对以下场景就可能出问题：

- JSON schema generation；
- function calling；
- reasoning model；
- code generation；
- grammar constrained decoding；
- tokenizer-sensitive prompt；
- 带特殊控制 token 的模型。

这就是为什么这份 RFC 强调：

> raw token-ID stream 应该独立于 parsed text / tool-call delta。

这个设计思路非常重要。

---

## 4. “Transport Resume”与“Generation Resume”不是一回事

很多现有系统已经支持“可恢复流式输出”。

但这里必须问一句：

> 它恢复的到底是什么？

### 4.1 第一类：SSE Replay

Cloudflare Agents 的 resumable streaming 是一个很典型的例子。

其官方文档描述的机制是：

- 服务端继续生成；
- chunk 被缓存到 SQLite；
- 客户端掉线以后重新连接；
- 服务端把缺失 chunk 重放；
- 然后继续接实时流。

文档：

[Cloudflare Agents - Resumable Streaming](https://github.com/cloudflare/agents/blob/main/docs/agents/chat-agents.md)

这种架构可以理解成：

```text
LLM generation continues
        │
        ▼
server-side stream buffer
        │
   client disconnects
        │
        ▼
client reconnects
        │
        ▼
replay missing chunks
```

它解决的是：

> **客户端连接不可靠。**

但如果真正的模型进程已经被杀掉，单纯 replay buffer 并不能让模型继续生成未来 token。

---

### 4.2 llama.cpp 也有类似的 SSE replay 思路

llama.cpp server 的开发文档中也存在 resumable streaming 设计：

- 每个 conversation 对应一个 stream session；
- 使用 bounded ring buffer 保存 SSE bytes；
- 客户端可按 offset 重新读取；
- producer 继续运行。

文档：

[llama.cpp server resumable streaming](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README-dev.md)

这同样非常有用。

但它主要解决的是：

```text
网络连接断了
≠
推理任务本身必须重启
```

而 SGLang 这次 RFC 讨论的是另一层问题：

```text
推理任务真的中断了
→
我能不能保存一个模型可重新消费的精确 token prefix？
```

这两个 resume 必须分开设计。

---

## 5. Raw Token Stream 到底提供了什么能力？

可以把 RFC 的核心状态简化成：

```text
P = prompt_token_ids
O = output_token_ids_so_far
```

中断时，客户端持久化：

```text
checkpoint = P + O
```

恢复时：

```text
input_ids = checkpoint
```

然后重新调用生成。

SGLang 本身的 generation API 已经支持 `input_ids` 作为文本输入形式之一。

文档：

[SGLang Sampling Parameters - input_ids](https://github.com/sgl-project/sglang/blob/main/docs/docs/basic_usage/sampling_params.mdx)

于是恢复链路变成：

```text
messages
   │
chat template
   │
P = prompt token IDs
   │
model generates O1 O2 O3 ...
   │
raw token stream
   │
client persists P + O
   │
request interrupted
   │
new request(input_ids=P+O)
   │
continue decoding
```

最大的价值是：

> 你不需要把“屏幕上的文本”重新猜回模型 token 序列。

---

## 6. 但它并不等于“零成本恢复”

这里很容易出现第二个误解：

> 既然 token 都保存了，那恢复是不是瞬间完成？

不一定。

Raw token prefix 解决的是**逻辑状态可重建性**，不是自动保存 GPU runtime state。

假设原请求：

```text
prompt = 100,000 tokens
output = 8,000 tokens
```

中断以后你把：

```text
108,000 tokens
```

重新作为 `input_ids` 发给另一台 Worker。

如果新 Worker 没有对应 KV Cache，它仍然必须对这 108k token 做 prefill，重建 attention state。

所以：

```text
Token Prefix Resume
≠
KV Cache Resume
```

更加准确地说：

```text
raw token checkpoint
解决“生成历史是什么”

KV checkpoint / cache transfer
解决“历史计算结果是否还在”
```

这是两条完全不同的优化轴。

---

## 7. Prefix Cache 能不能让恢复更快？

如果 Serving 系统的 prefix cache 恰好还保留：

```text
P + O[0:k]
```

那么恢复请求就有机会复用已有 cache。

这时流程可能变成：

```text
P + O
  │
lookup prefix cache
  │
命中已有部分 KV
  │
只 prefill 未命中的 suffix
  │
继续 decode
```

但这里有几个现实限制：

- 恢复请求可能被调度到另一台 Worker；
- cache 可能已经 eviction；
- tokenizer/config/model revision 必须一致；
- LoRA adapter 必须一致；
- multimodal embedding 状态可能不能仅靠 text token 重建；
- hybrid recurrent model 还可能有额外 recurrent state；
- speculative decoding 的 draft model 也有自己的状态。

所以真正成熟的 resumable serving 通常需要同时考虑：

```text
Protocol checkpoint
+ Scheduler routing
+ Prefix-cache locality
+ Runtime-state compatibility
```

而不是只加一个 HTTP 字段。

---

## 8. Raw Token IDs 仍然不等于“完全相同的未来输出”

再深入一步。

假设第一次请求已经生成：

```text
A B C D
```

然后中断。

你用精确 token prefix：

```text
Prompt + A B C D
```

恢复。

后面的 token 是否一定和“如果第一次请求没有中断”时完全相同？

**也不能一概而论。**

因为后续生成除了依赖 token prefix，还可能依赖：

- sampling RNG state；
- temperature；
- top-p / top-k；
- repetition penalty bookkeeping；
- speculative decoding state；
- distributed reduction numerical differences；
- model / kernel revision；
- deterministic execution configuration。

如果是：

```text
temperature = 0
```

并且执行环境稳定，那么 token-prefix continuation 更容易得到一致结果。

如果是随机采样：

```text
temperature > 0
```

即使 prefix 完全相同，恢复后的 future trajectory 也未必与原本未中断时一模一样，除非采样状态也被恢复或系统提供足够强的确定性保证。

所以我们最好区分两个目标：

### Semantic Resume

从同一个已生成 token prefix 继续，让输出语义自然衔接。

### Bitwise / Trajectory Resume

连未来 token 序列都和原请求不中断时完全相同。

后者明显更难。

---

## 9. Token Checkpoint 应该绑定哪些元数据？

如果未来真的实现生产级 raw-token resume，我不会只保存：

```json
{
  "token_ids": [1, 2, 3]
}
```

因为 token ID 本身只在一个确定的 tokenizer / model contract 下有意义。

更合理的 checkpoint 至少应该考虑：

```json
{
  "model": "...",
  "model_revision": "...",
  "tokenizer_revision": "...",
  "input_ids": [],
  "output_ids": [],
  "sampling": {
    "temperature": 0.0,
    "top_p": 1.0
  },
  "adapter": null,
  "created_at": "..."
}
```

如果是更严格的系统，还应该加入：

- chat template hash；
- tokenizer hash；
- LoRA identity；
- grammar / JSON schema identity；
- reasoning mode；
- tool schema version；
- server implementation version；
- model quantization identity。

可以把它理解成一个：

> **Generation Checkpoint Contract**

这个词是本文的工程归纳，不是 SGLang 官方术语。

---

## 10. 为什么 Tool Calling 特别需要 raw token checkpoint？

想象模型正在生成：

```json
{
  "name": "search_code",
  "arguments": {
    "query": "..."
  }
}
```

但 OpenAI-compatible stream 可能把它拆成很多 `tool_calls.delta`。

甚至 parser 会把模型特有格式：

```text
<tool_call>...</tool_call>
```

转换成标准字段。

如果中断发生在中间：

```text
raw token stream
   ↓
parser state
   ↓
partial JSON
```

你只保存 parser 输出，很难保证能够重新构造：

```text
模型真实 token prefix
```

这时 raw token checkpoint 很像数据库的 WAL：

- UI 可以有自己的 view；
- protocol 可以有自己的 parsed representation；
- 但恢复时应该依赖更接近事实源的数据。

当然，这个类比不是严格等价，只是为了说明分层思想。

---

## 11. 对 Coding Agent 来说，这比普通聊天重要得多

普通聊天中断一次，用户可能重新问一句就行。

Coding Agent 不一样。

一个真实 Agent 回合可能包含：

```text
读取 40 个文件
→
分析依赖图
→
规划修改
→
生成长 patch
→
准备 tool call
→
执行测试
→
继续修复
```

如果一次模型 generation 本身就非常长，中断会带来明显浪费。

尤其是：

- 100k+ context；
- reasoning-heavy model；
- 大型代码 diff；
- remote GPU；
- spot / preemptible instance；
- server rolling upgrade。

这时“可恢复生成”就不只是 UX 功能，而是资源效率问题。

可以粗略写成：

```text
Wasted Compute
≈
Repeated Prefill
+
Repeated Decode
+
Repeated Tool Planning
```

raw token checkpoint 至少可以减少“必须重新生成已经生成过的 decode prefix”这一部分浪费。

至于 prefill 是否能省，则取决于 cache locality 与 runtime state 是否还存在。

---

## 12. 我会怎样设计一套真正可复现的测试？

如果未来 SGLang 把 RFC 落地，我认为不能只测试：

```text
接口里有没有 output_ids 字段
```

应该做故障注入。

### 实验 A：纯文本确定性恢复

模型：固定模型。

参数：

```text
temperature=0
max_tokens=4096
```

流程：

1. 跑一份不中断 baseline；
2. 在第 512 / 1024 / 2048 token 强制断开；
3. 保存 raw output token IDs；
4. 用 `prompt_ids + output_ids` 恢复；
5. 比较恢复点之后的 token 序列。

指标：

```text
Prefix Exact Match
Post-resume Exact Match
Resume TTFT
Repeated Prefill Tokens
```

---

### 实验 B：文本重编码 vs raw token

做两条恢复路径。

路径 1：

```text
streamed text
→ tokenizer.encode(text)
→ resume
```

路径 2：

```text
raw output_ids
→ resume
```

比较最终输入 token 序列是否一致。

重点覆盖：

- 中文；
- emoji；
- 连续空格；
- Markdown code block；
- Unicode combining characters；
- special tokens。

目标不是预设“文本重编码一定错”，而是验证不同 tokenizer / parser 组合下它是否始终可靠。

---

### 实验 C：Tool Call 中断

让模型生成一个较长 tool call arguments。

在 JSON 中间强制中断。

分别保存：

```text
parsed tool delta
raw token IDs
```

然后测试恢复后：

- tool name 是否一致；
- arguments 是否合法；
- tool-call parser 是否重复触发；
- 是否产生 duplicated prefix。

---

### 实验 D：Reasoning Model

测试：

```text
raw reasoning tokens
→ parser
→ reasoning_content / final content
```

在 reasoning → final answer 边界附近中断。

观察 raw-token resume 是否会：

- 重复 reasoning delimiter；
- 重复 final-answer delimiter；
- 产生 parser state mismatch。

---

### 实验 E：随机采样

分别测试：

```text
temperature=0
```

和：

```text
temperature=0.8
```

不要只比较最终文本。

要比较：

```text
resume prefix 是否精确
future token trajectory 是否精确
```

这样才能把“状态恢复”和“采样确定性”分开。

---

### 实验 F：跨 Worker 恢复

Worker A 中断，Worker B 恢复。

记录：

```text
resume TTFT
prefix cache hit tokens
prefill tokens
GPU time
end-to-end latency
```

然后再做 Worker A 原地恢复作为对照。

这能直接回答：

> token checkpoint 在没有 KV locality 时到底能省多少？

---

## 13. 一个更完整的 Agent Serving 恢复架构

如果让我为长任务 Agent 做设计，我会把恢复能力分成四层。

### Layer 1：Transport Replay

保存 SSE/event chunks。

解决：

```text
浏览器断网
移动网络切换
WebSocket/SSE reconnect
```

---

### Layer 2：Generation Checkpoint

保存：

```text
prompt token IDs
+
raw output token IDs
```

解决：

```text
推理进程真正终止以后还能从逻辑 prefix 重建
```

---

### Layer 3：Runtime Cache

保存或迁移：

```text
KV Cache
recurrent state
possibly draft-model state
```

解决：

```text
避免长前缀重新 prefill
```

---

### Layer 4：Agent State

保存：

```text
messages
tool results
workspace state
file patches
approval state
budget
```

解决：

```text
模型 generation 恢复之后，整个 Agent workflow 仍然一致
```

很多产品今天只实现了 Layer 1 和 Layer 4。

而 SGLang 这份 RFC 有意思的地方，是它试图补 Layer 2。

Layer 3 则仍然是另一个更难的 serving / scheduler 问题。

---

## 14. 为什么这个 API 可能值得进入 OpenAI-compatible 扩展层？

现在推理框架越来越多：

- SGLang；
- vLLM；
- llama.cpp；
- TensorRT-LLM；
- 各云厂商自研 serving stack。

大家通常都兼容：

```text
/v1/chat/completions
```

但“高可靠长任务”需要的能力早已超出最初 Chat API 的设计目标。

如果每个框架分别发明：

```text
return_ids
return_token_ids
raw_tokens
resume_prefix
stream_checkpoint
```

客户端最终又会出现一层适配地狱。

所以从工程生态看，raw-token streaming 的价值不一定只在 SGLang 自己。

真正值得观察的问题是：

> **LLM Serving API 是否会逐渐从“文本生成接口”升级为“可恢复生成状态接口”？**

这比“多一个字段”重要得多。

---

## 15. 这件事和上午讲的 MCP Roadmap 有什么区别？

今天上午我写的是 MCP 的 Agent Runtime 演化：

- Tasks；
- Events；
- Identity；
- Progressive Discovery；
- HTTP transport。

它关心的是：

> Agent 与工具系统如何通信、委托和管理长任务。

而本文关心的是更底层的一层：

> 当 Agent 背后的模型 generation 自身被中断时，Serving Runtime 如何留下可以继续的精确生成前缀？

一个在 **Agent Protocol** 层。

一个在 **Model Serving State** 层。

二者最后确实可能在长任务 Agent 中相遇，但不是同一个问题。

---

## 16. 我认为这个 RFC 最值得继续追踪的五个问题

### ① Chat streaming 最终会不会逐 chunk 暴露 token IDs？

这是最直接的实现问题。

当前 SGLang chat streaming 明确拒绝 `return_token_ids`，所以 RFC 是否被接受、最终字段怎么设计，都值得继续观察。

### ② `sglext` 会不会成为稳定扩展命名空间？

如果 raw token stream 进入 `sglext`，客户端需要知道哪些字段是 SGLang extension，而不是误认为 OpenAI 标准字段。

### ③ `/v1/chat/completions` 是否会接受 `input_ids`？

这是 resume 体验是否顺滑的关键。

否则客户端还得绕到更底层 generation API。

### ④ Tool-call parser state 怎么处理？

raw token prefix 能恢复模型状态，但 parsed tool-call delta 是否能无歧义衔接，是另一个协议问题。

### ⑤ KV / Prefix Cache 如何与 token checkpoint 对齐？

这是决定“可恢复”最终能省多少 GPU 计算的核心性能问题。

---

## 结论：真正值得保存的不是“最后一句话”，而是生成轨迹

过去我们做 Chat UI 时，通常认为：

```text
messages[]
```

就是全部状态。

到了 Coding Agent、长上下文推理、分布式 Serving、可抢占 GPU 和长时间 reasoning 时代，这已经越来越不够。

模型生成过程本身开始拥有值得被持久化的状态。

SGLang 这份 2026 年 8 月 26 日的新 RFC 还只是提案，不应该把它写成已经 GA 的功能。

但它提出的问题非常真实：

> **如果客户端只拥有解析后的文本，而没有模型真实生成过的 token prefix，那么“恢复生成”就缺少一个稳定的事实源。**

raw token stream 提供的正是这个事实源候选。

不过工程上必须继续保持边界清晰：

```text
SSE Replay
≠
Token Prefix Resume
≠
KV Cache Resume
≠
Full Agent State Resume
```

如果未来要做真正可靠的长任务 Coding Agent，我更愿意把恢复体系设计成：

```text
事件流可重放
+
生成 token 可 checkpoint
+
缓存尽可能可复用
+
Agent workflow 独立持久化
```

而不是把希望全部寄托在“一条不会断的 HTTP 连接”上。

因为在真正的生产系统里，连接一定会断，Worker 一定会升级，GPU 一定会被重新调度。

**可靠系统的目标从来不是永不中断，而是中断以后仍然知道自己走到了哪里。**

---

## 参考资料

- SGLang RFC: [Resumable raw token stream for /v1/chat/completions](https://github.com/sgl-project/sglang/issues/36431)
- SGLang: [serving_chat.py](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/entrypoints/openai/serving_chat.py)
- SGLang: [serving_completions.py](https://github.com/sgl-project/sglang/blob/main/python/sglang/srt/entrypoints/openai/serving_completions.py)
- SGLang Docs: [Sampling Parameters / input_ids](https://github.com/sgl-project/sglang/blob/main/docs/docs/basic_usage/sampling_params.mdx)
- Cloudflare Agents: [Resumable Streaming](https://github.com/cloudflare/agents/blob/main/docs/agents/chat-agents.md)
- llama.cpp server: [Resumable streaming](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README-dev.md)
