---
title: "把 Codex Agent Loop 放进 Durable Object：Cloudflare 实验性 Harness 的恢复边界"
published: 2026-11-10
category: "AI前沿"
tags: ["Codex","Cloudflare Workers","Durable Objects","AI Agent","Wasm","可靠性"]
draft: false
pinned: false
comment: true
description: "Cloudflare 在 2026 年 11 月公布了一个实验性的 Agents SDK 示例：把 Codex 派生的 Rust/Wasm turn loop 放入 Durable Object，并用 Tasks、Sessions、Streams 与 Workspace 组织执行、恢复、历史和文件状态。本文从材料中的官方变更说明与示例仓库出发，拆解它解决了什么问题、哪些状态可以恢复，以及如何建立不夸大可靠性的验收清单。"
image: "https://developers.cloudflare.com/changelog/post/2026-11-09-codex-harness/og.png?v=07916f154d67e97a"
---

Cloudflare 在 2026 年 11 月 9 日的官方 Changelog 中公布了一个实验性的 Agents SDK 示例：在 Cloudflare Workers 的 Durable Object 中运行 Codex agent loop。这个案例值得关注的地方，不是又增加了一个“可以调用模型的 Agent”，而是把一次长时间、可被打断、包含工具调用的代理执行，拆成了可以持久化和重放的几类状态。

材料中的实现改编自 Codex 的 Rust turn-processing 代码，并通过 WebAssembly 运行在 Workers 环境。官方示例仓库则将它描述为一个 Worker-native coding harness：它在普通 Durable Object 中承载 Codex 派生的 Rust/Wasm turn loop，并把 CodexHarness 作为 Lifecycle capability 组合进去。

这里的证据等级需要先说清楚：S8 是 Cloudflare 官方 Changelog，S10 是 Cloudflare Agents 官方仓库中的示例目录，因此可以支持“官方发布了这个实验性示例”和“示例包含哪些组件”的判断；但材料没有证明它已经成为稳定产品能力，也没有提供生产环境吞吐、延迟、故障率或成本数据。下文讨论的是架构含义和验收方法，不把示例包装成生产保证。

## 一次 Agent 执行为什么需要多种状态

最容易误解的设计，是把 Agent 看成一个函数：输入用户提示，调用模型，再返回答案。对于编码型代理，这个函数通常会穿插多个步骤：读取文件、调用模型、解析工具请求、修改工作区、再次调用模型，最后生成结果。任何一步发生进程重启、网络断开或客户端重连，简单的内存循环都会丢失上下文。

Cloudflare 示例没有把所有状态塞进一个“任务表”，而是按职责拆开：Tasks 负责模型调用与工具执行的日志和恢复；Sessions 保存对话历史并负责上下文压缩；Streams 保存有序事件，供重新连接后的客户端重放；Workspace 保存持久化文件。CodexHarness 则把这些能力编排成一个可被 Durable Object 生命周期管理的代理循环。

这种拆分的关键价值，是把三个经常混在一起的问题分离开：

1. 代理现在执行到了哪一步；
2. 用户或模型已经看到了哪些历史；
3. 工作区中哪些文件已经被读写。

如果只保存最终答案，无法判断中断发生在模型调用前、工具执行中还是工具结果返回后；如果只保存聊天记录，又无法恢复文件状态；如果只保存任务状态，客户端重连时也无法知道应该补发哪些事件。分层状态并不自动带来可靠性，但它让可靠性可以被分别检查。

## Durable Object 在这里承担什么角色

材料中的代码把 Coder 定义为 Durable Object，并在对象实例中创建 Tasks、Streams、Sessions 和 Workspace。Workspace 使用 Durable Object 的存储上下文保存文件，其他能力则通过 Lifecycle.install(this) 注册到对象生命周期中。换句话说，Durable Object 不是单纯的 HTTP 路由，而是某个代理会话的有状态执行容器。

可以把一次会话抽象为下面的关系：

```text
Coder Durable Object
├── Sessions   对话、提示、助手消息、工具输出与上下文压缩
├── Tasks      模型调用、工具步骤、完成记录与恢复
├── Streams    按顺序排列的事件与断线后的重放
├── Workspace  持久化文件读写
└── CodexHarness
    └── Codex 派生的 Rust/Wasm turn loop
```

这套关系并不意味着每个组件都保存同一份数据。相反，验收时应检查它们是否保持一致：Tasks 记录的工具步骤，是否能在 Sessions 中找到对应的输出；Streams 重放的事件，是否能对应到某个会话和任务；Workspace 的文件版本，是否能解释工具执行的结果。

官方 Changelog 对 Tasks 的描述尤其重要：已完成的步骤在重启后可以复用已经记录的结果，被中断的步骤可以再次运行。这两句话分别对应两种不同的恢复路径。第一种是避免重复执行，第二种是允许重试。不能从中推导出所有工具都具备 exactly-once 语义，也不能推导出外部副作用会自动回滚。

因此，工程上的安全结论是：只要工具可能产生外部副作用，就必须把“重复运行是否安全”作为工具自身的契约。读文件、计算补丁这类操作通常更容易重试；发送邮件、创建资源、执行不可逆脚本则需要幂等键、去重记录或人工确认。Durable Object 能保存执行记录，但不会替工具定义副作用边界。

## 从官方示例提取可检查的配置骨架

材料给出的核心初始化结构大致如下，实际项目应以示例仓库当前版本的 API 为准：

```ts
export class Coder extends DurableObject {
  tasks = new Tasks();
  streams = new Streams();
  sessions = new Sessions();
  workspace = new Workspace({ storage: this.ctx.storage });

  codex = new CodexHarness({
    tasks: this.tasks,
    streams: this.streams,
    sessions: this.sessions,
    workspace: this.workspace,
    model: createAI({ binding: this.env.AI, id: "default" })(
      "openai/gpt-6.1-sol"
    ),
  });

  lifecycle = Lifecycle.install(this)
    .use(this.tasks)
    .use(this.streams)
    .use(this.sessions)
    .use(this.codex);
}
```

这段配置至少暴露出四个必须核对的边界。第一，模型调用依赖 AI binding，而不是代码中直接写入 API 密钥。S8 说明，要使用示例中的模型，需要通过默认网关配置 Unified Billing 或保存的 OpenAI API key；这属于账户和网关配置前提，不是 Harness 自动获得模型权限。

第二，Workspace 明确绑定到 Durable Object 的存储上下文。验收时不能只看到代理回复成功，还要确认重启或重新连接后，工作区中的文件仍能被读取。第三，Tasks、Streams、Sessions 和 CodexHarness 都被安装到同一生命周期中，缺少其中一个组件时，执行、历史或事件恢复可能不完整。第四，示例使用的是 GPT-6.1 Sol 作为模型配置示例，材料并未给出该模型的性能、价格或可用性承诺，不能据此比较生产方案。

如果需要快速审阅示例代码，可以使用不改变仓库内容的检查命令：

```bash
git clone https://github.com/cloudflare/agents.git
cd agents
find examples/next/harnesses/codex -maxdepth 2 -type f | sort
sed -n '1,220p' examples/next/harnesses/codex/README.md
```

这些命令只能帮助定位公开示例，不等于完成部署验证。真正的部署还需要根据仓库中的 package、Wrangler 和环境配置执行项目规定的安装与发布流程；材料没有提供一条经过验证的完整部署命令，因此不应把上述检查命令写成上线步骤。

## 恢复测试应该如何设计

一个合格的恢复验证，不能只在最后打印“任务成功”。至少需要把执行拆成可定位的阶段，并为每个阶段准备中断点。

第一组测试验证已完成步骤的复用。让代理完成一个确定性的文件读取或内容计算，记录任务结果和事件序号；随后模拟 Durable Object 重启或重新进入会话，检查系统是否复用已记录的完成结果，而不是无条件再次调用模型或工具。这里要关注的是结果和调用次数，不是单看最终文本。

第二组测试验证中断步骤的重试。在工具执行尚未产生完成记录时断开执行，再恢复会话，确认该步骤能够重新运行，并检查重复运行是否造成额外副作用。对于只读工具，应验证返回值一致；对于写操作，应提前设计幂等策略，不能用“最终看起来没问题”替代检查。

第三组测试验证事件重放。客户端在 Streams 已经产生部分事件后断开，再次连接时应能从明确的事件位置继续获得有序记录。测试需要记录事件 ID 或顺序号，并检查是否出现跳过、重复或乱序。Sessions 的历史也要单独检查，因为事件流完整不代表上下文压缩后的会话历史完整。

第四组测试验证工作区一致性。让工具创建或修改一个明确文件，随后中断、恢复并重新读取；同时检查文件内容、任务记录和会话中的工具输出是否能够互相解释。若三者不一致，说明系统虽然“恢复了运行”，但没有恢复到可审计状态。

可以将结果记录成一张最小验收表：

| 场景 | 必须观察 | 不能直接推出 |
| --- | --- | --- |
| 已完成步骤后重启 | 结果可复用，事件仍有序 | 所有步骤都 exactly-once |
| 中断步骤后恢复 | 步骤可再次运行 | 外部副作用自动回滚 |
| 客户端断线重连 | 事件可按序重放 | 会话历史永不压缩 |
| 文件写入后恢复 | Workspace 内容一致 | 任意并发写入都安全 |
| 模型调用失败 | 失败状态可定位 | 自动重试一定降低成本 |

## 失败边界比“可恢复”更重要

“可恢复”不是一个二元标签。至少要区分执行恢复、上下文恢复、事件恢复和文件恢复。四者中任何一项缺失，都可能让用户看到一个形式上继续运行、实际上状态已经错位的代理。

模型调用的重试还会带来预算问题。材料说明已完成步骤可以复用，而中断步骤可以再次运行，但没有给出重试次数、超时、费用上限或退避策略。因此这些策略不能从示例中臆造，应用必须自行定义：哪些错误允许重试，最多重试几次，何时转人工处理，重试后的模型和工具调用如何计费。

同样不能把 Streams 当成永久审计日志。官方材料只说明它保存有序事件并支持重新连接后的重放，并未承诺无限保留、跨对象查询或合规审计属性。若系统需要长期审计，应另行定义保留周期、访问控制、脱敏和导出机制。

Workspace 也不是天然安全沙箱。示例说明它提供读写持久文件的能力，但材料没有证明它会自动限制路径、阻止敏感文件读取或隔离任意命令执行。生产设计需要把工具权限、文件范围和凭据注入分开评估，不能因为代码运行在 Workers 或 Durable Object 中，就默认代理可以安全执行所有操作。

## 一个更现实的采用判断

这个案例最有价值的启发，是把 Agent 可靠性从“模型答得好不好”转成“状态是否可解释、步骤是否可恢复、失败是否可控”。它适合用作架构原型：用 Durable Object 绑定会话，用 Tasks 记录步骤，用 Sessions 管理上下文，用 Streams 支持重连，用 Workspace 保存代理工作区。

但它还不足以单独证明生产就绪。采用前至少要补齐四类证据：真实运行时的部署与权限配置、不同中断点下的恢复测试、工具副作用的幂等设计，以及模型调用的成本和超时策略。尤其要避免把“官方提供示例”改写成“官方保证服务等级”。

我的工程判断是：这类 Harness 的核心竞争力不在于把 Codex 循环搬到边缘运行时，而在于把一次不可见的长循环拆成可记录、可重放、可恢复的状态机。它真正的验收标准也不是 Agent 最终能否生成一段代码，而是当模型调用、工具执行、客户端连接或运行时实例任一环节失败时，系统能否明确回答三件事：已经完成了什么，接下来会重做什么，以及哪些外部变化绝不会被自动撤销。

## 参考资料

- [Workers, Agents - Run the Codex agent loop on Cloudflare Workers](https://developers.cloudflare.com/changelog/post/2026-11-09-codex-harness/)
- [github.com](https://github.com/cloudflare/agents/tree/main/examples/next/harnesses/codex)
- [github.com](https://github.com/cloudflare/cloudflare-docs)
