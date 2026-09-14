---
title: "Agent Loop 不一定要和执行环境绑在一起：拆解 OpenAI Agents API × Vercel Sandbox 的持久化运行时"
published: 2026-09-14
category: "AI前沿"
tags: ["OpenAI","Vercel","Agents API","Sandbox","Agent Runtime","Queues"]
draft: false
pinned: false
comment: true
description: "Vercel 2026-09-10 公布 OpenAI Agents API 集成：Agent loop 与 session state 由 OpenAI 管理，Vercel 负责应用、Queues 和隔离 Sandbox。本文拆解控制面、执行面、持久工作区与恢复边界，并给出长任务 Agent 的验证方法。"
---

长任务 Coding Agent 经常被描述成“模型 + 工具调用循环”，但真正上线后，最难处理的往往不是下一次调用哪个工具，而是：会话断了怎么办、执行容器死了怎么办、文件如何跨轮次保留、Webhook 重复投递会不会创建两个 Worker、空闲时是否还要养一台机器。

2026 年 9 月 10 日，Vercel 公布了 OpenAI Agents API 的集成方案。官方给出的职责划分很清楚：OpenAI 管理 Agent loop 与 session state，Vercel 托管应用，并通过签名 Webhook、Vercel Queues 和 Vercel Sandbox 为每个 Agent session 提供隔离代码执行与文件访问；工作区可以跨后续指令保留，同时整体架构能够 scale to zero。

## 先拆开四种状态，否则“持久 Agent”很容易说不清

一个可恢复 Agent 至少存在四种不同状态。

第一种是**对话状态**：用户说了什么、模型已经回复什么、当前 session 的逻辑历史。第二种是**Agent loop 状态**：现在处于等待模型、调用工具、等待工具结果还是继续推理。第三种是**执行环境状态**：当前 Sandbox 是否存在、进程是否存活、依赖是否安装。第四种是**工作区状态**：Agent 已经修改的文件、生成的构建产物以及下一轮需要继续读取的数据。

把四者塞进同一台长期 VM 的确简单，但它会把可靠性和成本绑死在一个进程上。Vercel 公开的参考架构选择把职责拆开：OpenAI 维护 Agent session 和 loop；Vercel Functions 接收事件；Queues 承担异步协调；Sandbox 只负责隔离执行；持久 workspace 则让后续指令重新连接到已有文件状态。

这种分层最重要的收益不是“用了更多云产品”，而是允许每一层单独失败和恢复。Web 请求结束不代表 Agent 必须结束，Sandbox 被重新连接也不意味着对话历史丢失，控制面空闲时也不需要保持常驻 Worker。

## 为什么 Webhook 后面还需要 Queue

如果 Agent 平台直接用 Webhook 启动一个 Sandbox 并执行长任务，会遇到典型的分布式系统问题：Webhook 可能重试，函数可能超时，Worker 可能在处理中断，同一个 session 也可能连续收到事件。

因此 Queue 的价值是把“收到事件”和“完成执行”解耦。一个更稳健的处理流程可以抽象成：

```text
OpenAI event
  -> verify signed webhook
  -> enqueue(session_id, event_id)
  -> worker claims job
  -> find or create sandbox
  -> execute requested tool work
  -> persist workspace/result
  -> acknowledge job
```

这里至少需要两个幂等键：`event_id` 防止同一事件重复执行，`session_id` 用于定位对应工作区。创建 Sandbox 也不应该只依赖“当前内存里有没有对象”，而应由可恢复的映射关系决定。

官方强调 signed OpenAI webhooks 与 Vercel Queues 的组合，本质上就是把外部 Agent loop 和内部执行资源之间增加一个可靠控制面。它不是为了让模型更聪明，而是为了让失败不会轻易变成重复副作用。

## Persistent Workspace 不等于“永远运行的容器”

“文件跨 follow-up instruction 保留”很容易被误解为 Sandbox 必须一直在线。实际上，持久工作区和常驻计算是两个概念。前者要求文件状态能够被后续 session 找回，后者要求 CPU/内存一直占用。

Scale-to-zero 架构希望保留前者、避免后者。Agent 完成一轮任务后，可以释放不必要的执行资源；下一条指令到来时，再根据 session 恢复或重新连接工作区。这对 Coding Agent 尤其重要，因为安装依赖、修改代码、生成测试文件都属于“需要连续文件语义，但不一定需要连续 CPU”的状态。

验证这种能力时，不应该只测“连续发两条消息”。更有价值的是主动制造中断：第一轮让 Agent 创建文件并安装依赖，等待 Sandbox 进入可回收状态，再发送 follow-up；检查文件是否存在、路径是否一致、是否重复执行初始化脚本，以及旧进程状态是否被错误假设为仍然存在。

## 安全边界：隔离执行只是第一步

Vercel 说明每个 Agent session 使用隔离执行环境，这能减少不同任务之间的文件和进程污染，但并不能自动解决权限问题。真正进入生产环境还需要限制 Sandbox 中可见的凭据、网络出口和可调用服务。

一个实用原则是：Agent loop 拥有“决定下一步做什么”的逻辑权，但 Sandbox 只拿“完成当前步骤所需的最小能力”。例如代码分析任务不应默认获得生产数据库写权限；部署任务需要的短期凭据也不应该长期写进 workspace。

同时，持久 workspace 本身也是安全资产。它可能保存源代码、生成文件、日志甚至模型写下的临时配置，因此需要明确生命周期、租户隔离和清理策略。持久化提高恢复能力，也扩大了需要治理的数据面。

## 怎么验证一个长任务 Agent 是否真的可恢复

可以设计五组故障注入，而不是只看 Happy Path。

第一组在模型请求完成后、工具执行前重复投递同一 Webhook，检查是否只执行一次。第二组在 Sandbox 执行到一半时终止 Worker，观察 Queue 是否能够重新领取任务。第三组完成一次代码修改后释放计算资源，再发送 follow-up，检查 workspace 是否连续。第四组同时向同一 session 发送两条指令，确认系统是否有明确的串行化或冲突策略。第五组让不同 session 创建同名文件，确认隔离边界不会串数据。

建议记录的指标也不只是 token 和延迟，而包括 Resume Success Rate、Duplicate Side-effect Count、Workspace Recovery Time、Sandbox Cold-start Time、Queue Retry Count，以及每个成功任务的实际计算成本。

## Agent 基础设施正在从“一个进程”变成控制面与执行面

OpenAI Agents API 与 Vercel Sandbox 的组合值得关注，不是因为它宣告了唯一正确架构，而是因为它把一个长期被混在一起的问题显式拆开：**Agent 的思考循环、会话状态和代码执行环境并不必须由同一个运行时拥有。**

当 Agent 任务从几十秒增长到几十分钟甚至跨多轮人工指令时，这种分离会越来越重要。模型负责决策，Agent 平台负责 session，Queue 负责可靠交付，Sandbox 负责隔离副作用，workspace 负责连续文件状态。每层都有自己的失败模式，也因此可以拥有独立的恢复策略。

真正成熟的 Agent Runtime，不是“永不崩溃的容器”，而是即使某一层崩溃，也能知道任务进行到了哪里、哪些副作用已经发生、哪些状态必须恢复，以及下一步怎样安全继续。

> 本文事实依据：Vercel 2026-09-10 官方 Changelog《Build with OpenAI Agents API on Vercel》：https://vercel.com/changelog/build-with-openai-agents-api-on-vercel
