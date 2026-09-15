---
title: "Auto 不再只是一个按钮：从 GitHub Copilot 三档模型路由拆解 Coding Agent 的成本、质量与延迟预算"
published: 2026-09-15
category: "AI前沿"
tags: ["GitHub Copilot", "Coding Agent", "模型路由", "成本优化", "延迟", "工程实践"]
draft: false
pinned: false
comment: true
description: "GitHub Copilot 的 Auto 模型选择新增 efficiency、balance、intelligence 三档，但三档并不是固定绑定三组模型。本文从官方机制出发，拆解按请求动态路由背后的成本、质量、延迟三角，以及团队如何建立可验证的 Agent 模型路由策略。"
image: "https://github.blog/wp-content/uploads/2024/05/copilot.jpg"
---

# Auto 不再只是一个按钮：从 GitHub Copilot 三档模型路由拆解 Coding Agent 的成本、质量与延迟预算

2026 年 9 月 14 日，GitHub 给 Copilot 的 Auto model selection 增加了三种偏好：**efficiency、balance、intelligence**。这看起来像一个很小的产品设置，但它其实暴露了 Coding Agent 正在发生的一次基础设施变化：模型选择开始从“用户先挑模型，再开始任务”，变成“系统先理解当前请求，再决定这一步值得花多少钱、等多久、调用多强的模型”。

需要先划清事实边界。GitHub 官方说明，三档使用的是**同一组可用模型**，区别是 Auto 在每个 prompt 上如何权衡成本、质量与响应时间；即使选择 intelligence，一个简单的 docstring 任务仍可能被路由到更小、更高效的模型。官方同时说明，实际计费取决于 Auto 最终选中的模型，而不是用户选择的档位；付费订阅者通过 Auto 产生的计费用量继续享有 10% 折扣。

这意味着，“intelligence = 永远用最强模型”“efficiency = 永远用最便宜模型”都不是准确理解。更接近真实系统的抽象是：**档位改变路由器的目标函数，而不是直接指定后端模型。**

## 一、模型路由真正优化的是一个多目标函数

如果只有一个模型，Agent 的成本估算很简单：输入 token、输出 token、工具调用和运行时相加即可。但当系统拥有多个不同价格、速度和能力的模型时，问题变成了一个动态决策：

```text
route(prompt, context, task_state)
  -> candidate models
  -> estimate quality / latency / cost
  -> choose one model
```

可以把路由器的目标函数粗略写成：

```text
score(model) =
  wq * expected_quality
  - wc * expected_cost
  - wl * expected_latency
  - wr * failure_risk
```

这里的 `wq / wc / wl / wr` 才是 efficiency、balance、intelligence 这类偏好真正可能影响的东西。这个公式是工程抽象，并不是 GitHub 公布的内部算法。

关键点在于，**任务难度不是会话级常量，而是 turn 级变量**。同一个 Coding Agent 会话可能先让模型读取目录、再修改一个函数、随后分析失败测试，最后处理跨模块架构问题。把整段会话固定在一个昂贵模型上，可能浪费大量简单步骤；固定在一个小模型上，又可能让真正困难的步骤反复失败。

所以更合理的调度粒度不是“这个用户今天用什么模型”，而是“当前这一轮需要什么能力”。

## 二、为什么最便宜的单次调用可能是最贵的任务

模型路由最容易犯的错误，是只比较每百万 token 的价格。

假设模型 A 单次调用成本只有模型 B 的三分之一，但在一个复杂重构任务中，A 平均需要 4 次尝试才能得到可接受 patch，而 B 通常 1 次完成。真正应该比较的是：

```text
Cost per Accepted Change
= Σ(模型调用 + 工具执行 + Sandbox + CI + 人工复核成本)
  / 最终被接受的变更数
```

这也是为什么“efficiency”不能简单翻译成“永远选最便宜模型”。对于补 docstring、解释报错、生成小型测试夹具，较小模型通常很合理；但对跨模块重构、复杂类型错误、并发 bug 或安全边界分析，如果小模型导致更多 retry、更多无效 diff 和更多 CI 失败，总任务成本反而会上升。

团队可以记录四个比 token 单价更有意义的指标：

- **First-pass acceptance rate**：第一次生成的修改无需重大返工即可接受的比例；
- **Retry amplification**：一个用户任务最终触发了多少次模型重新推理；
- **CI correction count**：为了让测试、类型检查和构建通过，需要额外修正多少轮；
- **Cost per accepted task**：完成一个最终被接受任务的端到端费用。

模型路由器如果只优化“单次请求便宜”，而不看这些指标，很容易做出局部最优、全局更贵的决策。

## 三、延迟预算应该分成 TTFT 和任务完成时间

Coding Agent 的“快”也不是一个数字。

对交互式问答，用户最敏感的是首 token 时间（TTFT）；对后台 Agent，用户更关心的是从任务提交到 PR 可审查的总时间。一个模型首字很快，但需要连续三轮修复测试，最终任务仍然可能更慢。

因此建议把延迟拆成：

```text
T_total = T_queue
        + T_model
        + T_tool
        + T_sandbox
        + T_ci
        + T_retry
```

对“解释这个函数”一类前台请求，可以提高 `T_model` 的权重；对“把这个 issue 修好并提交 PR”的后台任务，则应该更关注 `T_total` 和 retry。

这也是动态路由比固定模型更有价值的地方：路由器可以在低风险步骤优先响应速度，在高风险步骤提高质量预算。

## 四、Coding Agent 需要的是分阶段路由，而不是模型排行榜

一个成熟的 Agent Harness 可以把任务拆成不同阶段，并给每个阶段不同预算：

```yaml
routing:
  explore:
    objective: efficiency
    max_retries: 1
  plan:
    objective: balance
    max_retries: 2
  implement:
    objective: balance
    escalate_on: [large_diff, cross_module_change]
  verify:
    objective: intelligence
    escalate_on: [test_failure, security_sensitive]
```

这同样只是可复现的工程示例，不是 GitHub Copilot 的配置格式。

这里最重要的设计是 **escalation**。不要一开始就把所有请求送到最高能力模型，也不要让小模型无限重试。更好的策略是：低成本尝试一次，如果触发明确的失败信号，再升级模型。

失败信号可以来自确定性系统，而不是让模型自己判断自己是否“想得不够好”：

- TypeScript / Rust / Go 编译失败；
- 单元测试或 Playwright 回归失败；
- diff 超过预设文件数或行数；
- 修改触及认证、权限、支付、密钥等敏感路径；
- 同一个错误连续出现两次；
- reviewer 要求重新设计而不是局部修补。

这样模型路由就从“AI 猜 AI”变成了**模型判断 + 确定性反馈**的闭环。

## 五、如何验证 Auto 路由到底有没有价值

GitHub 没有在这次公告中公开 Auto 内部每个 prompt 的具体模型评分，因此外部测试不应该伪造“路由算法已经被逆向出来”的结论。我们真正能验证的是端到端结果。

可以准备一组固定任务：

```text
A. 给已有函数补 docstring
B. 修复一个单文件边界条件 bug
C. 根据失败测试定位跨模块问题
D. 完成包含数据库 + API + UI 的小型功能
E. 审查一个包含权限变更的 PR
```

分别在可用的不同路由偏好下运行，并保存：

```csv
task,tier,total_time,retries,ci_failures,accepted,cost
A,efficiency,...
A,balance,...
A,intelligence,...
```

至少重复多轮，并使用同一仓库快照、同一任务描述和同一验收测试。不要只比较一次生成的主观观感，也不要把不同日期、不同代码状态的任务混在一起。

最终可以画出三条 Pareto frontier：成本—成功率、延迟—成功率、成本—总完成时间。只有当某个策略在相同成功率下更便宜，或在相同预算下成功率更高，才能说它对你的工作负载更优。

## 六、团队真正需要的是“预算策略即代码”

Auto model selection 的意义不只在 Copilot 本身。随着 Coding Agent 同时拥有模型、浏览器、Shell、MCP、Sandbox 和 CI，团队会越来越需要把“这一类任务最多允许花多少资源”写成可审计策略。

例如：

```yaml
agent_budget:
  docs:
    max_cost_usd: 0.20
    quality_target: standard
  bugfix:
    max_cost_usd: 1.00
    quality_target: balanced
  security_review:
    max_cost_usd: 3.00
    quality_target: high
    require_human_approval: true
```

预算策略应该和权限策略一样进入版本控制。原因很简单：当模型路由完全隐藏在客户端设置里，团队很难解释“为什么本周 Agent 成本突然翻倍”；当预算、升级条件和验收指标被记录下来，成本变化就可以被回溯。

进一步还可以把路由决策写入 telemetry：

```json
{
  "task": "fix-auth-regression",
  "phase": "verify",
  "route_policy": "high-quality",
  "attempt": 2,
  "trigger": "security-sensitive-path",
  "result": "tests-passed"
}
```

这里不要求暴露供应商的私有模型评分，只要求记录团队自己的决策原因。

## 七、真正的变化：模型正在从产品选择变成运行时资源

过去我们讨论“哪个模型最好”，往往默认一次任务对应一个模型。动态路由把问题改写成：**哪一步需要哪种能力，什么失败信号值得升级，以及为了一个最终被接受的结果愿意支付多少。**

GitHub 这次三档 Auto 设置仍然是用户层面的产品能力，而且官方没有公开内部路由细节。但它代表的工程方向已经很清楚：Coding Agent 的模型层正在越来越像云计算的调度层——CPU、GPU、内存不会由用户为每个函数手动挑选，模型也可能逐渐从一个显式品牌按钮变成由 Harness 根据任务动态分配的运行时资源。

对个人开发者，最实用的做法不是每天追逐“最强模型排行榜”，而是先记录自己的任务成功率、重试次数、CI 修正次数和端到端成本。对团队，则应该进一步把预算、升级条件和验证门槛变成可版本化策略。

当这些数据建立起来之后，efficiency、balance、intelligence 才不只是三个 UI 标签，而会变成一套可以被测量、比较和治理的工程选择。

---

## 已核验资料

- GitHub Changelog（2026-09-14）：[Configure cost and quality in Copilot auto model selection](https://github.blog/changelog/2026-09-14-configure-cost-and-quality-in-copilot-auto-model-selection/)
- GitHub Changelog（2026-09-10）：[GitHub Copilot weekly releases — September 7](https://github.blog/changelog/2026-09-10-github-copilot-weekly-releases-september-7/)
