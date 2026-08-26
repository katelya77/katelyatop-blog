---
title: MCP 正在从“工具协议”变成 Agent 运行时协议？拆解 2026 新 Roadmap 的五个方向
author: Katelya
published: 2026-08-26
category: 技术分享
tags: [MCP, Agent, AI Agent, Agent Runtime, OAuth, Tool Calling, Developer Tools, Protocol, Harness]
draft: false
pinned: false
comment: true
description: MCP 2026 年 8 月新 Roadmap 把重点放到 Agentic Messaging、HTTP-native Transport、Agent Identity、Progressive Discovery 与 SDK DX。本文不把 Roadmap 当新闻摘要，而是从长任务、异步事件、身份委托、工具目录膨胀、MCP Gateway 和 Coding Agent Harness 的工程约束出发，分析 MCP 为什么正在从“工具调用协议”向更完整的 Agent 运行时基础设施演化。
---

如果你在 2025 年第一次接触 MCP，你可能会把它理解成一件很简单的东西：

> **让模型用统一协议发现工具、调用工具、读取资源。**

这个理解并没有错。

但到了 2026 年 8 月，它已经越来越不够用了。

因为真正进入生产环境之后，大家遇到的问题已经不是：

- “Claude / Codex / Cursor 能不能调用这个工具？”
- “我能不能再接一个 GitHub MCP Server？”
- “这个数据库能不能暴露成 MCP？”

而变成了：

- 一个 Agent 任务跑 20 分钟甚至 2 小时，怎么持续拿到进度？
- 服务端完成工作以后，怎么主动把结果推回来，而不是客户端一直轮询？
- 一个云端 Agent 没有人守着浏览器点 OAuth consent，它应该用什么身份？
- 主 Agent 把一部分任务委托给 Subagent 时，权限如何同步缩小？
- MCP Server 有 200 个工具时，真的应该把 200 个 tool schema 一次性塞进模型上下文吗？
- 本地 stdio MCP 与远程 Streamable HTTP 为什么还要维护两套思维模型？
- `tools/call` 返回多种等价结果形式时，客户端到底应该把哪一种喂给模型？

这些问题，已经不是“Tool Calling API”可以单独解决的了。

2026 年 8 月 22 日，Model Context Protocol Core Maintainers 发布了新的 MCP Roadmap，并把接下来的重点明确拆成五类：

1. Agentic messaging primitives；
2. HTTP-native transport unification and hardening；
3. Agent identity and enterprise-ready security；
4. Improved primitives；
5. Improved SDK developer experience。

官方原文：

- The New MCP Roadmap
  https://blog.modelcontextprotocol.io/posts/mcp-roadmap/
- MCP Roadmap
  https://modelcontextprotocol.io/development/roadmap

这篇文章不打算把 Roadmap 翻译一遍。

我更想回答一个工程问题：

> **为什么 MCP 下一阶段的变化，看起来越来越像“Agent Runtime Protocol”，而不仅仅是“工具协议”？**

---

## 1. 先看一个最关键的变化：MCP 正在摆脱“一问一答”

最早期的工具协议有一个非常自然的假设：

```text
LLM
 ↓
call tool
 ↓
server executes
 ↓
return result
 ↓
LLM continues
```

这对很多任务完全够用。

例如：

- 查天气；
- 查数据库一条记录；
- 读取一个 GitHub Issue；
- 列出某个目录；
- 获取一段日志。

这些工作通常可以在几百毫秒到几秒内结束。

问题出现在真正的 Agent Workflow。

例如 Coding Agent 可能需要：

```text
读取仓库
  ↓
建立索引
  ↓
搜索调用链
  ↓
修改代码
  ↓
安装依赖
  ↓
跑单测
  ↓
跑 E2E
  ↓
发现失败
  ↓
修复
  ↓
再次验证
  ↓
生成 PR
```

这个过程不是一次 RPC。

它是一个**长生命周期工作单元**。

官方新 Roadmap 对这一点说得很直接：现代 agentic workload 已经不再适合普通 request-response 模式。任务可能持续很久，服务端可能需要流式返回结果，用户也可能需要中途 steering。

所以 MCP 接下来重点完善：

- Tasks；
- `subscriptions/listen`；
- progress notifications；
- server-initiated events；
- webhooks / channels；
- 长任务中的中途 steering。

这其实是在把一个工具调用协议，向“可管理任务生命周期”的方向推进。

---

## 2. 为什么 polling 对 Agent 来说是一个坏抽象？

假设你让 Agent 发起一个耗时 15 分钟的 GPU benchmark。

最简单的协议可能是：

```text
POST /run-benchmark
→ task_id=abc123
```

然后客户端不断：

```text
GET /task/abc123
GET /task/abc123
GET /task/abc123
GET /task/abc123
...
```

这种方式当然可以工作。

但一旦 Agent 数量、并发任务和执行时间上来，问题很快就出现。

### 问题一：无意义请求会指数增加

如果：

- 100 个 Agent；
- 每个 Agent 10 个活跃 Task；
- 每 2 秒轮询一次；

那么你会得到：

```text
100 × 10 × 0.5
= 500 requests / second
```

其中绝大部分请求只是在问一句：

> “好了没？”

### 问题二：状态变化无法及时通知

如果你把 polling interval 调成 30 秒减轻压力，那么任务完成后客户端最多要再等 30 秒才知道。

### 问题三：中途事件非常难表达

真实 Agent Task 不只有：

```text
pending
running
finished
failed
```

还可能出现：

```text
waiting_for_user
waiting_for_approval
blocked_by_policy
partial_result_available
retrying
rate_limited
budget_exceeded
```

这类状态天然更适合事件驱动。

因此 Roadmap 提到的 server-initiated events、webhooks、channels，本质上不是“协议多加几个 endpoint”。

它们是在解决：

> **Agent Runtime 如何从同步 RPC 转向事件驱动任务系统。**

---

## 3. Tasks 真正重要的不是“异步”，而是生命周期语义

很多人看到 MCP Tasks，第一反应可能是：

> 不就是 async job 吗？

但如果只理解成 async job，会低估它的价值。

真正重要的是：**Task 让协议开始承认 Agent 工作有生命周期。**

例如一个成熟的任务协议至少应该逐渐回答：

```text
谁创建了任务？
任务属于哪个用户？
任务当前状态是什么？
任务能否取消？
任务能否重试？
失败能否恢复？
结果保留多久？
客户端断线后能否重新连接？
任务完成后如何通知？
是否可以中途修改目标？
是否可以审批后继续？
```

这已经非常接近：

- Workflow Engine；
- Job Queue；
- Durable Execution；
- Agent Runtime；
- CI Pipeline。

这也是为什么 Tasks 不能只被看成一个 API 便利功能。

---

## 4. 一个很容易忽略的事实：2026-07-28 已经先把“无状态化”铺好了

新的 Roadmap 不是从零开始。

在 2026-07-28 MCP Specification 中，已经发生了两个对生产部署非常关键的变化：

- protocol-level sessions 被移除；
- initialization handshake 被移除。

官方解释很明确：这让 MCP Server 可以更容易横向扩展，而不必要求某个实例长期保存协议会话状态。

以前你可能需要：

```text
Client
   ↓
Load Balancer
   ↓
Server A ← session pinned here
```

如果 Server A 挂了，session state 可能就需要恢复。

无状态以后，更接近：

```text
             ┌→ Server A
Client → LB ─┼→ Server B
             └→ Server C
```

任何请求都可以被调度到任意实例。

这对：

- Kubernetes；
- Cloudflare Workers；
- Serverless；
- Edge Runtime；
- 多区域部署；
- Auto Scaling；

都更友好。

也就是说，Roadmap 里“Agentic Messaging”与“HTTP-native Transport”其实是相互配合的：

> **协议本身尽量无状态，但长任务状态由明确的 Task / Event primitive 管理。**

这是一个非常成熟的分层。

---

## 5. MCP 为什么越来越 HTTP-native？

新 Roadmap 的第二个方向是：

> HTTP-native transport unification and hardening

这看起来有点抽象。

但它背后的工程目标非常明确。

今天远程 MCP Server 已经越来越像普通 Web Service：

```text
DNS
TLS
HTTP
OAuth
Load Balancer
Gateway
WAF
Observability
Rate Limit
Identity
```

而不是某种特殊的“AI 网络协议”。

这是好事。

因为企业已经有几十年的 HTTP 基础设施。

如果 MCP 自己重新发明：

- session；
- transport；
- service discovery；
- auth；
- retry；
- proxy；

那它最终会变成一个很难进入企业网络的新孤岛。

相反，如果 MCP 尽量复用成熟 HTTP 语义，那么现有基础设施就可以直接工作：

```text
Agent
  ↓
Enterprise Gateway
  ↓
OAuth / WIF
  ↓
Rate Limit
  ↓
Audit
  ↓
MCP Server
```

这也是为什么“HTTP-native”实际上是 MCP 生产化非常重要的一步。

---

## 6. 更有意思的是：官方甚至希望 local MCP 也向同一模型靠近

Roadmap 提到一个值得注意的方向：

> 包括 local servers speaking Streamable HTTP over stdio

这意味着本地 MCP 与远程 MCP 的开发模型可能进一步统一。

今天开发者经常维护两套逻辑：

```text
Local
stdio
process lifecycle
local permissions
```

和：

```text
Remote
HTTP
OAuth
network retries
load balancing
```

如果最终 transport semantics 能高度统一，那么开发者可能只需要维护：

```text
MCP application semantics
        ↓
Streamable HTTP semantics
        ↓
local adapter / remote adapter
```

这会显著降低 SDK、测试与 client implementation 的复杂度。

我的判断是：

> **未来“stdio MCP”和“remote MCP”会越来越像部署方式差异，而不是两套协议世界。**

这是工程判断，不是官方已经承诺完成的事实。

---

## 7. Roadmap 第三个方向，可能才是 Agent 真正进入企业的门槛：Agent Identity

现在很多 MCP Authorization Flow 的隐含前提是：

```text
User
 ↓
Browser OAuth Consent
 ↓
Agent gets delegated token
```

对桌面 Agent 很合理。

例如：

- Claude Desktop；
- Cursor；
- VS Code；
- 本地 Codex；

用户就在电脑前。

但生产 Agent 完全不同。

它可能运行在：

- GitHub Actions；
- Kubernetes；
- Cloudflare Workers；
- Vercel Sandbox；
- AWS Lambda；
- 内部 Agent Platform；
- 长时间无人值守的 VPS。

这时候没有人会一直等着点：

```text
Authorize
```

更麻烦的是，Agent 可能还会继续创建 Subagent。

例如：

```text
Human
  ↓
Main Coding Agent
  ├─ Explorer Agent
  ├─ Test Agent
  └─ Deployment Agent
```

这时候权限应该是什么？

绝对不应该是：

```text
main token
  ↓ copy
subagent token
  ↓ copy
another subagent
```

因为这样权限只会复制，不会缩小。

---

## 8. Roadmap 里的关键词：DPoP、WIF、Token Exchange、ID-JAG

官方在 Agent Identity 方向明确提到：

- DPoP；
- Workload Identity Federation；
- ID-JAG；
- Enterprise-Managed Authorization；
- standard token exchange。

这些东西共同指向一个核心目标：

> **Agent 应该拥有“可验证的工作负载身份”，而不是到处复制长期 API Key。**

我们可以把旧模型画成：

```text
API_KEY=super-secret-long-lived-key
              ↓
Agent A
Agent B
CI
VPS
Docker
```

任何一个环境泄露，Key 都可能被长期滥用。

而未来更理想的是：

```text
Workload Identity
      ↓
Identity Provider
      ↓
short-lived token
      ↓
MCP Server
```

如果继续委托给 Subagent：

```text
Main Agent
scope = repo:read + repo:write + deploy:staging

       ↓ token exchange

Explorer Agent
scope = repo:read
```

这才是真正符合 Agent delegation 的权限模型。

---

## 9. 为什么 DPoP 对 Agent 特别重要？

传统 Bearer Token 有一个简单但危险的属性：

> **谁拿到 Token，谁就能用。**

如果日志、Prompt、环境变量、Crash Dump 或恶意 Tool 泄露了 Token，攻击者往往可以直接重放。

DPoP 的目标之一，是把 Token 与持有者的密钥证明绑定。

简单理解：

```text
Bearer token:
I have token → therefore I am allowed
```

DPoP：

```text
I have token
+
I can prove possession of bound private key
→ therefore I am allowed
```

对于会自动执行大量 Tool Call 的 Agent，这个差异非常重要。

因为 Agent Runtime 本身就是一个高频接触凭据的系统。

---

## 10. Agent Identity 不是“OAuth 再复杂一点”

我认为这里最容易出现一个误区：

> MCP 已经支持 OAuth，所以 Agent 身份问题解决了。

不对。

Human Delegation 与 Workload Identity 是两种不同问题。

### Human Delegation

```text
王奕章授权 Coding Agent
读取 GitHub 仓库
```

### Workload Identity

```text
GitHub Actions 中的 Agent
以 workflow workload 的身份
访问某个 MCP Server
```

### Delegated Agent Identity

```text
Main Agent
授权 Test Agent
只能读取测试结果
不能修改生产环境
```

它们需要不同的安全语义。

Roadmap 把 Agent Identity 单独提升为 priority area，本身就说明 MCP 已经开始面对“机器主体”而不是只有“人类用户”。

---

## 11. 第四个方向非常现实：工具太多了，模型真的会被拖垮

Roadmap 在 Improved Primitives 中点出了一个非常典型的问题：

> 一个 MCP Server 如果有 100 个工具，模型在用户提出第一个问题之前，就可能已经为整个工具表面支付 Context 成本。

这和我之前观察 Coding Agent Harness 时遇到的问题完全一致。

很多人以为：

```text
more tools = more capable agent
```

实际上在超过某个规模以后，很可能变成：

```text
more tools
→ larger system context
→ more similar tool descriptions
→ harder tool selection
→ more wrong calls
→ higher latency
→ higher token cost
```

这可以称为：

> **Tool Surface Area Problem**

---

## 12. 一个 200 Tool MCP Server 的隐藏成本

假设平均一个 Tool Schema，包括：

- name；
- description；
- JSON schema；
- 参数说明；

占 250 tokens。

200 个工具就是：

```text
200 × 250
= 50,000 tokens
```

还没问问题，Context 就已经消耗 5 万 token。

如果某个 Agent 一天创建 1000 个 session：

```text
50,000 × 1,000
= 50,000,000 input tokens
```

即使 KV cache、prefix cache、prompt cache 能降低部分推理成本，也无法完全消除：

- tool selection complexity；
- retrieval noise；
- schema ambiguity；
- model attention competition。

所以新 Roadmap 提出的 progressive discovery 非常值得关注。

---

## 13. Progressive Discovery：不要先把整个工具箱砸给模型

更合理的方式应该像搜索。

例如：

```text
User:
帮我检查 Cloudflare Pages 部署为什么失败
```

第一阶段模型只看到：

```text
search_tools(query)
get_tool_group(name)
```

然后：

```text
search_tools("Cloudflare Pages deployment logs")
```

返回：

```text
pages.get_deployment
pages.get_logs
pages.retry_deployment
```

这时候模型才加载这三个工具的完整 schema。

于是上下文从：

```text
200 tools
50k tokens
```

变成：

```text
2 discovery tools
+
3 relevant tools
```

这种架构和：

- RAG；
- command palette；
- package lazy loading；
- capability registry；

非常像。

---

## 14. Progressive Tool Discovery 会改变 MCP Server 的设计方式

以前 MCP Server 很容易做成：

```text
one server
  ├─ 150 tools
  ├─ 200 resources
  └─ 30 prompts
```

以后可能更合理的是：

```text
entry capability
      ↓
capability discovery
      ↓
load relevant namespace
      ↓
expose narrowed tool set
```

这里甚至会出现新的优化指标：

```text
Tool Discovery Precision
Tool Discovery Recall
Tool Schema Tokens per Task
Wrong Tool Invocation Rate
Time to First Correct Tool
```

这些指标比单纯统计“有多少 MCP tools”更有意义。

---

## 15. 一个很有意思的行业呼应：Harness 已经在主动缩 Tool Surface

这次 Roadmap 的 progressive discovery 并不是纯理论问题。

Harness 今年重构自己的 MCP Server 时，就把原本 130+ tools 收缩成 11 个高层工具，再通过 registry-based dispatch 支撑 125+ resource types。

Harness 官方给出的估算是：

```text
tool definition context
约 26% of 200K context
        ↓
约 1.6%
```

官方文章：

https://www.harness.io/blog/harness-mcp-server-redesign

这和 MCP Roadmap 现在提出的 progressive discovery，方向高度一致：

> **不是让模型看到更多工具，而是让模型在正确的时间看到正确的工具。**

---

## 16. 为什么这对 Coding Agent 特别重要？

Coding Agent 的工具集合天然会膨胀。

一个成熟 Coding Agent 可能同时接：

```text
filesystem
shell
git
github
browser
postgres
cloudflare
vercel
sentry
slack
jira
notion
linear
docker
kubernetes
```

每个系统再暴露几十个操作，很快就能达到几百工具。

如果全部加载：

```text
Agent = LLM + 300 tools
```

表面能力很强。

但模型每次都要在几百个候选之间判断：

> “我现在应该调用哪一个？”

所以未来成熟 Harness 很可能需要额外一层：

```text
Intent
 ↓
Capability Router
 ↓
Relevant MCP Namespace
 ↓
Tool Selection
 ↓
Execution
```

而不是：

```text
Intent
 ↓
300 tools
 ↓
pray
```

---

## 17. Improved Primitives 里还有一个容易被忽略的问题：结果契约不稳定

官方 Roadmap 提到：

`tools/call` response 现在可能以不止一种形式表达相同输出。

问题在于 MCP Server 开发者未必知道 Client 最终会把哪一种形式展示给模型。

这会导致一种非常隐蔽的兼容性问题：

```text
Server returns:
structuredContent
+
text content
```

Client A：

```text
prefer structuredContent
```

Client B：

```text
prefer text
```

Client C：

```text
merge both
```

于是同一个 Tool，在不同 Agent Client 中可能产生不同上下文。

对于普通 UI，这叫 rendering difference。

对于 Agent，这可能直接变成：

> **behavior difference**

因为模型看到的输入变了。

所以结果契约标准化，本质上也是 Agent determinism 的一部分。

---

## 18. 这和“同模型不同 Harness 表现不同”是同一个问题

今天大家已经越来越接受：

```text
Agent Quality ≠ Model Quality
```

更接近：

```text
Agent Quality
= Model
× Context
× Tools
× Runtime
× Policy
× Verification
```

如果 Tool Result Contract 不一致：

```text
same model
same task
same server
```

也可能因为 Client serialization 不同而产生不同结果。

因此 MCP primitive 的严格程度，会直接影响跨客户端 Agent 行为的一致性。

---

## 19. 第五个方向为什么是 SDK Developer Experience？

很多协议 Roadmap 会把 SDK DX 放在比较低的位置。

MCP 反而把它列成五大 priority 之一。

官方给出的一个原因非常有时代特征：

> 越来越多开发者不是自己逐行阅读 SDK，而是让 Coding Agent 根据 SDK 文档直接生成 MCP Client / Server。

这意味着：

```text
Documentation Quality
        ↓
Agent-generated Code Quality
```

以前糟糕文档的后果可能是：

> 开发者多查半小时 Stack Overflow。

现在糟糕文档的后果可能是：

```text
Coding Agent
  ↓
learns outdated API
  ↓
creates wrong implementation
  ↓
passes shallow test
  ↓
ships to production
```

SDK DX 已经不只是“开发者体验”，还是**Agent Coding Correctness 的输入数据质量**。

---

## 20. MCP SDK 以后需要一种新的指标：Agent Legibility

传统 SDK 经常优化：

```text
Human Readability
API Consistency
Type Safety
Docs Completeness
```

未来可能还需要一个维度：

> **Agent Legibility**

也就是：

```text
一个 Coding Agent
能不能仅凭官方文档
生成正确、最新、符合安全边界的实现？
```

可以设计一个 benchmark：

### Test A：Human-free MCP Server Generation

给 Coding Agent：

```text
只允许读取官方 SDK docs
实现一个具备 auth + tools + progress 的 MCP Server
```

然后跑 conformance suite。

指标：

```text
First-pass conformance rate
Retry count
Deprecated API usage
Security misconfiguration count
```

这会是很有价值的 SDK 质量测试。

---

## 21. Roadmap 五个方向，其实可以合并成一个更大的架构图

把它们放在一起：

```text
                 ┌────────────────────┐
                 │    Agent Client    │
                 └─────────┬──────────┘
                           │
                  Progressive Discovery
                           │
                 ┌─────────▼──────────┐
                 │ Capability Surface │
                 └─────────┬──────────┘
                           │
                    HTTP-native MCP
                           │
              ┌────────────▼────────────┐
              │ Identity / Authorization│
              │ DPoP / WIF / Exchange   │
              └────────────┬────────────┘
                           │
                  ┌────────▼────────┐
                  │    MCP Server    │
                  └────────┬────────┘
                           │
                      Task Runtime
                           │
              ┌────────────▼────────────┐
              │ Event / Progress / Push │
              └─────────────────────────┘
```

你会发现它已经覆盖：

- capability discovery；
- transport；
- identity；
- delegation；
- task lifecycle；
- events；
- result contract；
- SDK conformance。

这就是为什么我认为 MCP 正在从：

```text
Model ↔ Tool Protocol
```

向：

```text
Agent ↔ Runtime Capability Protocol
```

演化。

再次强调：

**“Agent Runtime Protocol”是本文的工程归纳，不是 MCP 官方给自己改的新名字。**

---

## 22. 但 MCP 并不会替代 Harness

看到这里很容易走到另一个极端：

> 那以后 Agent Harness 都由 MCP 解决？

不会。

MCP 解决的是 interoperable protocol primitives。

Harness 仍然负责：

```text
prompt policy
context selection
memory
planning
subagent orchestration
sandbox
verification
budget
retry policy
model routing
human approval
```

可以理解为：

```text
                 Agent Harness
        ┌──────────────────────────┐
        │ Planning                 │
        │ Context                  │
        │ Memory                   │
        │ Verification             │
        │ Policy                   │
        │ Budget                   │
        │                          │
        │      MCP Client          │
        └────────────┬─────────────┘
                     │
                     ▼
                  MCP Layer
                     │
                     ▼
               External Systems
```

MCP 是 Harness 的基础设施层之一，而不是 Harness 本身。

---

## 23. Roadmap 对 MCP Gateway 也有一个重要暗示

如果未来 MCP 真正出现：

- workload identity；
- token exchange；
- progressive discovery；
- event channels；
- task lifecycle；

那么企业里的 MCP Gateway 也会从今天的：

```text
proxy + auth + audit
```

升级成：

```text
Identity Broker
Capability Router
Policy Enforcement Point
Task Event Gateway
Audit Plane
Rate Limit
Cost Control
```

也就是说 MCP Gateway 可能越来越像 Agent Control Plane 的一部分。

这与 Cloudflare、Harness、Snowflake 等厂商近期围绕 MCP Gateway、AI Gateway、Agent policy 的投入是同一条趋势。

---

## 24. 对个人开发者来说，现在最值得做的不是“等新规范”

Roadmap 里的很多东西还在演进。

因此现在最糟糕的做法是：

> 等所有标准都稳定以后再设计架构。

更合理的是提前把系统设计成可迁移。

### 原则一：不要把长任务伪装成同步工具调用

不要写：

```text
run_full_ci()
```

然后 HTTP request 挂 40 分钟。

更合理：

```text
start_ci()
→ task_id

get_task(task_id)
subscribe_task(task_id)
```

### 原则二：不要让长期 Token 成为 Agent 身份

优先考虑：

```text
short-lived credential
workload identity
scoped token
```

而不是：

```text
.env
API_TOKEN=永久管理员凭据
```

### 原则三：不要一次暴露整个 Tool Catalog

如果工具超过几十个，就应该开始考虑：

```text
discovery
namespace
routing
lazy loading
```

### 原则四：Tool Result 要有稳定结构

推荐至少有：

```json
{
  "status": "success",
  "data": {},
  "summary": "...",
  "metadata": {}
}
```

不要只返回一段随意自然语言。

---

## 25. 如果你正在做 Coding Agent，可以现在做这四组实验

### 实验一：Tool Surface Benchmark

分别测试：

```text
20 tools
50 tools
100 tools
200 tools
```

固定：

- 同一模型；
- 同一 Prompt；
- 同一任务集；
- 同一温度。

统计：

```text
Tool Selection Accuracy
Wrong Tool Call Rate
Input Tokens
TTFT
Task Success Rate
```

然后再加入 progressive discovery 版本对比。

---

### 实验二：Polling vs Event-driven Task

构造 100 个长任务。

A：

```text
poll every 2 seconds
```

B：

```text
push / subscription
```

比较：

```text
request count
server CPU
network traffic
completion notification delay
client complexity
```

---

### 实验三：Bearer Token vs Scoped Short-lived Identity

模拟：

```text
Main Agent
Explorer Agent
Deployment Agent
```

检查：

```text
Explorer 是否能 deploy？
Deployment token 是否能读取不相关 repo？
token 泄露后多久失效？
是否能 revoke 单个 workload？
```

---

### 实验四：Cross-client Tool Result Parity

把同一个 MCP Server 接到多个 Client：

```text
Claude
Codex
Cursor
VS Code
自研 Agent
```

固定 Tool Call。

记录最终进入模型上下文的结果是否一致。

这能提前发现未来 Roadmap 所说的 result handling compatibility 问题。

---

## 26. 我会特别关注的三个指标

未来评估 MCP 架构，我认为至少应该加入三个指标。

### 1. Context Cost per Successful Task

```text
总 Tool Schema Tokens
+
Tool Result Tokens
+
Protocol Metadata Tokens
───────────────────────
成功任务数
```

### 2. Privilege Surface per Task

```text
任务实际需要权限
────────────────
Agent 实际获得权限
```

越接近 1 越好。

### 3. Event Latency

```text
server state changed
        ↓
agent became aware
```

这决定长任务交互体验。

---

## 27. MCP 未来最大的风险：协议越来越强，也越来越复杂

Roadmap 的方向基本合理。

但它也带来一个明显风险：

> MCP 会不会从一个很简单的 Tool Protocol，逐渐变成一个过度复杂的 Agent Platform Protocol？

因为现在已经在讨论：

```text
Tasks
Events
Subscriptions
Identity
Delegation
Discovery
Result Types
Transport
Extensions
```

如果所有东西都进入 Core，协议很容易膨胀。

好消息是当前 MCP 的治理方向相对克制。

官方正在把不少能力放入：

```text
extensions
experimental extensions
Working Groups
SEPs
```

而不是所有能力都强塞进核心规范。

这点非常重要。

---

## 28. 为什么 Extension Model 会决定 MCP 能不能长期活下来？

成熟协议一般都要面对一个矛盾：

```text
Core 太小
→ 不够用

Core 太大
→ 难实现、难兼容、难演进
```

MCP 更合理的结构应该是：

```text
Small Stable Core
        ↓
Official Extensions
        ↓
Experimental Extensions
        ↓
Domain-specific Extensions
```

例如：

```text
finance
healthcare
coding
payments
browser automation
```

都可能有不同扩展需求。

如果 extension lifecycle 做好，MCP 才能避免变成“一个协议解决全世界”。

---

## 29. 对 MCP Server 作者来说，Roadmap 带来的迁移清单

现在可以开始检查：

### Transport

- 是否依赖 server-side protocol session？
- 是否可以无状态横向扩容？
- 是否适合普通 HTTP gateway / load balancer？

### Task

- 是否存在超过几十秒的 Tool Call？
- 是否应该拆成 Task？
- 是否支持 cancel / retry / expiry？

### Identity

- 是否仍使用长期 API Key？
- 是否可以改成短期凭据？
- Subagent 是否拿到了过大的权限？

### Tool Surface

- Tool 数量是否已经超过模型容易选择的范围？
- 是否可以做 namespace / discovery？
- 是否测过 Tool Selection Accuracy？

### Result Contract

- structured result 是否稳定？
- text fallback 是否与 structured output 语义一致？
- 不同 Client 是否看到相同核心事实？

### SDK

- 是否跑官方 conformance tests？
- 是否锁定 SDK version？
- 是否使用 deprecated API？

---

## 30. 对 Agent Client 作者来说，重点则完全不同

Agent Client 应该开始准备：

```text
Task-aware runtime
Event subscription
Reconnect
Capability cache
Progressive discovery
Identity delegation
Result normalization
```

尤其不要再假设：

```text
MCP call == short synchronous function call
```

这个假设未来会越来越不成立。

---

## 31. 对企业平台来说，未来需要的是 MCP Control Plane

当 MCP Server 从 5 个增长到 500 个以后，企业不会继续手工配置：

```text
server URL
OAuth client
scope
allowed tools
```

最终一定会出现：

```text
MCP Registry
MCP Gateway
Identity Broker
Policy Engine
Audit
Observability
Cost Control
```

我更倾向把这一整层叫：

> **Agent Capability Control Plane**

因为它管理的不只是 MCP connection，而是 Agent 能力本身。

---

## 32. 一个可能的生产架构

```text
                    Human / CI / Agent
                           │
                           ▼
                  ┌─────────────────┐
                  │ Agent Harness   │
                  │ plan/context    │
                  │ verify/budget   │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ MCP Gateway     │
                  │ discovery      │
                  │ policy         │
                  │ audit          │
                  └────────┬────────┘
                           │
                 Workload Identity
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         GitHub MCP   Cloud MCP    Internal MCP
              │            │            │
              └────────────┼────────────┘
                           │
                           ▼
                     Task Runtime
                           │
                    Events / Progress
                           │
                           ▼
                     Agent Harness
```

这套架构里 MCP 不负责“思考”。

它负责的是：

> **让能力、任务、身份与结果以可互操作方式流动。**

---

## 33. 新 Roadmap 真正释放的三个信号

如果只记住三件事，我认为是这三个。

### 信号一：Agent 工作负载已经不再是普通 RPC

Tasks、Events、Progress、Steering 都说明长任务正在成为一等公民。

### 信号二：Agent 正在变成独立身份主体

WIF、DPoP、Token Exchange、delegation 说明机器身份开始进入协议核心讨论。

### 信号三：工具数量已经开始成为 Agent 性能问题

Progressive Discovery 说明 MCP 社区已经不再把“暴露更多 tools”简单等同于“Agent 更强”。

---

## 34. 最后：MCP 下一阶段竞争的不是“谁接的工具最多”

2025 年 MCP 的竞争很容易量化：

```text
支持多少 MCP Server？
有多少 Tools？
接了多少 SaaS？
```

2026 年以后，这些指标会越来越没有区分度。

真正重要的可能变成：

```text
能不能让长任务稳定运行？

能不能让 Agent 拥有自己的短期身份？

能不能把权限正确委托给 Subagent？

能不能在几百个工具中只暴露当前需要的几个？

能不能跨 Client 保持结果语义一致？

能不能在 Agent 中断、重连、扩缩容以后继续完成工作？
```

所以我更愿意这样理解新的 MCP Roadmap：

> **MCP 的第一阶段解决了“模型怎么调用外部世界”；下一阶段开始解决“Agent 怎么在外部世界里长期、可控、可扩展地工作”。**

这两句话听起来很接近。

但对应的工程复杂度完全不是一个数量级。

---

## 参考资料

### MCP 官方

- The New MCP Roadmap
  https://blog.modelcontextprotocol.io/posts/mcp-roadmap/
- MCP Roadmap
  https://modelcontextprotocol.io/development/roadmap
- MCP 2026-07-28 Specification
  https://modelcontextprotocol.io/specification/2026-07-28
- MCP Blog: The 2026-07-28 Specification
  https://blog.modelcontextprotocol.io/posts/2026-07-28-specification/
- MCP Authorization
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- MCP Tasks Extension
  https://modelcontextprotocol.io/extensions/tasks

### 工程案例

- Harness: Architecting MCP for AI Agents: Lessons from Our Redesign
  https://www.harness.io/blog/harness-mcp-server-redesign

### 相关阅读

- RFC 9449: OAuth 2.0 Demonstrating Proof of Possession (DPoP)
  https://www.rfc-editor.org/rfc/rfc9449

---

**事实边界说明：**

本文关于 2026 年 8 月 MCP Roadmap、2026-07-28 Specification、Tasks、Progressive Discovery、Agent Identity、DPoP、Workload Identity Federation、Token Exchange 等描述均来自 MCP 官方 Roadmap / Specification；“Agent Runtime Protocol”“Agent Capability Control Plane”“Agent Legibility”等术语是本文用于工程分析的归纳，并非 MCP 官方宣布的新产品名或正式规范名称。文中的架构图、成本示例和 benchmark 方案用于解释与实验设计，不代表官方性能数据。