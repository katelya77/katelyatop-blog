---
title: Coding Agent 真正的护城河不是模型：从 Vercel Harness 拆开工具循环、Sandbox 与 Context Pruning
author: Katelya
published: 2026-08-19
category: 技术分享
tags: [Coding Agent, Agent Harness, Vercel, AI SDK, Sandbox, Context Engineering, AGENTS.md, 开发工具]
draft: false
pinned: false
comment: true
description: 从 Vercel 新近公开的 Coding Agent Harness 教程出发，拆解为什么真正决定 Agent 能否长期工作的往往不是模型榜单，而是工具契约、执行隔离、上下文裁剪、子代理和验证闭环，并给出一套适合个人开发者复现的最小架构。
---

最近 Coding Agent 的讨论越来越容易滑向一个问题：**到底该用哪个模型？**

但如果你真的让 Agent 连续工作半小时、修改几十个文件、执行测试、读日志，再回头看失败现场，会发现很多问题并不是模型“不会写代码”：

- 读过一次的 5000 行文件永久留在上下文里；
- `bash` 权限过大，模型一次误判就可能执行破坏性命令；
- 工具返回几十 KB 日志，把真正重要的任务状态挤出去；
- Agent 写完代码就宣布完成，却没有跑 typecheck / lint / test / build；
- 一个探索任务和一个实现任务共享同一份上下文，最后两边都被污染；
- 云端执行环境超时后消失，Agent 自己却不知道生命周期已经结束。

Vercel 最近更新的 Academy 课程 **Build Your Own AI Coding Agent Harness** 很适合拿来理解这个问题。它没有把重点放在“再套一层 Prompt”，而是从 tool loop、工具契约、安全门、Sandbox abstraction、context pruning、subagent、human-in-the-loop 和 verification 一层层搭起一个 Coding Agent Harness。

这篇文章不照抄课程，而是借它回答一个更实用的问题：**如果今天自己做一个能长期工作的 Coding Agent，最少需要哪些基础设施？**

## 1. Harness 到底是什么？

最小 Agent 很容易写：

```text
用户任务
  ↓
LLM
  ↓
工具调用
  ↓
工具结果
  └────────→ LLM（循环）
```

给模型 `read`、`write`、`bash` 三个工具，它已经可以表现得很像 Coding Agent。

问题是，demo 能跑不代表系统能长期跑。

**Harness 可以理解为包在模型外面的执行控制层。** 它决定：

```text
模型能看到什么
模型能调用什么
每个工具能做什么
危险动作什么时候需要批准
代码在哪里执行
旧上下文什么时候被压缩/删除
失败后如何恢复
什么条件才算“任务完成”
```

所以同一个模型放进不同 Harness，实际 Coding 体验可以差得非常大。

这也是为什么只比较 SWE-bench 或某个模型的 coding score，经常无法解释真实开发体验。

## 2. 第一层：Tool Loop 不是 while(true) 那么简单

一个成熟的工具循环至少需要区分三类状态：

```text
Reasoning / Planning
        ↓
Tool Execution
        ↓
Observation
        ↓
Continue / Verify / Stop
```

最危险的实现，是让“模型说完成”直接等于任务完成。

更稳妥的做法是把停止条件拆开：

1. 模型认为任务已经完成；
2. Harness 检查是否满足验证条件；
3. 必要时执行 typecheck / lint / test / build；
4. 验证失败，把结构化错误重新交给 Agent；
5. 验证成功，才允许结束。

这其实是在把自然语言承诺变成**机器可验证的完成条件**。

例如：

```ts
const gates = [
  "pnpm typecheck",
  "pnpm lint",
  "pnpm test",
  "pnpm build",
]
```

真实项目不一定四项全跑，但思路很重要：**Agent 的“我完成了”不能成为唯一 truth source。**

## 3. 第二层：工具描述其实就是 Agent 的 API

很多人会花大量时间调 system prompt，却只给工具写一句：

```text
bash: execute shell commands
```

这相当于给人一把万能钥匙，却没有告诉他哪扇门可以开。

Vercel 的 Harness 教程强调把工具描述做成更明确的 contract。工程上可以把每个工具至少写成：

```text
WHEN TO USE
WHEN NOT TO USE
INPUT CONTRACT
SAFETY / SIDE EFFECTS
EXAMPLES
```

例如 `writeFile` 和 `editFile` 应该明确区分：

- 新文件优先 `writeFile`；
- 已存在文件的小范围修改优先 `editFile`；
- 不允许用 write 静默覆盖未知内容；
- 修改后需要重新读取关键区域或运行验证。

这里有一个容易忽略的结论：

> 工具描述并不只是文档，它本身就是模型的“动作选择接口”。

工具越多，如果契约越模糊，Agent 反而越容易选错。

## 4. 第三层：不要把 bash 权限问题交给 Prompt

“请不要执行危险命令”不是安全边界。

因为 Prompt 是行为引导，不是权限系统。

更合理的结构应该是：

```text
LLM
 ↓
Tool Request
 ↓
Policy / Approval Gate
 ├─ safe → execute
 ├─ uncertain → ask / review
 └─ blocked → reject
 ↓
Sandbox
```

例如只读命令可以自动执行：

```text
pwd
ls
cat
rg
git diff
git status
```

而下面这些操作应该进入更严格的策略：

```text
rm
sudo
curl | sh
git push
npm publish
数据库 destructive migration
生产环境变更
```

真正可靠的 Agent 应该做到：**模型即使判断错了，执行层仍能兜底。**

## 5. 第四层：Sandbox 不是“云服务器换个名字”

Coding Agent 天然需要执行不完全可信的内容：

- 用户仓库里的脚本；
- npm/pip install 的依赖；
- 测试命令；
- Agent 自己生成的代码；
- Issue 中提供的复现脚本。

因此把 Agent 直接放在宿主机执行，本质上是在把模型输出升级成系统权限。

Vercel 的思路是把工具依赖到统一的 `Sandbox` interface，而不是直接依赖 Node `child_process`：

```ts
interface Sandbox {
  readFile(path: string): Promise<string>
  exec(command: string): Promise<ExecResult>
  stop(): Promise<void>
}
```

底层可以替换为：

```text
Local Sandbox
In-memory Sandbox
Remote MicroVM / Cloud Sandbox
```

这样工具层不需要知道代码究竟跑在哪里。

这个抽象非常关键，因为个人开发阶段可以用本地环境快速迭代，真正允许 Agent 接触陌生仓库时再切隔离执行层，而不用重写全部工具。

## 6. Context Pruning：长上下文不等于可以不管理上下文

这是目前 Coding Agent 最容易被低估的一层。

假设 Agent 每轮读取：

```text
文件：12K tokens
测试日志：8K tokens
搜索结果：5K tokens
```

10 轮之后，即使模型拥有非常大的 context window，也会出现两个问题。

第一是**成本**。大量已经失去价值的 observation 仍会参与后续请求。

第二是**注意力污染**。旧日志、旧代码和已经修复的错误继续存在，模型可能反复引用过时状态。

因此 Context Pruning 不只是为了“塞得下”，更是为了维持信息的新鲜度。

一种简单策略是：

```text
永久保留：
- system / policy
- 用户原始目标
- 当前计划
- 最近关键决策

有限保留：
- 最近 N 次工具结果
- 当前正在修改文件的关键片段

压缩或删除：
- 已解决错误日志
- 大段重复文件内容
- 旧搜索结果
- 成功命令的冗长 stdout
```

甚至可以给工具输出设置硬上限：

```text
rg → 最多 100 matches
build log → 保留 error + 前后窗口
readFile → 默认按 range 读取
```

这往往比单纯换一个 1M context 模型更有效。

## 7. 为什么 Explorer 和 Executor 应该分开？

当任务变复杂后，一个 Agent 同时负责：

```text
理解仓库
搜索实现
设计方案
修改代码
跑测试
排查失败
```

上下文很快就会变成一锅粥。

子代理真正有价值的地方，不是“多开几个模型显得高级”，而是**隔离上下文和权限**。

例如：

### Explorer

只允许：

```text
read
grep
git log
目录遍历
```

输出：

```text
相关文件
调用链
可能修改点
风险
```

### Executor

拿到 Explorer 的压缩结果后，只处理实现：

```text
edit
write
bash（受控）
test
```

于是主 Agent 不需要把 Explorer 看过的所有文件重新塞进上下文。

对于便宜模型与强模型混合使用，这里还可以做 model routing：探索/分类交给低成本模型，关键实现和复杂 debugging 再升级模型。

## 8. AGENTS.md 的价值不是“再加一份 Prompt”

项目级 Agent 配置最有价值的信息通常不是“你是一名优秀工程师”，而是仓库事实：

```md
# Project Rules

- package manager: pnpm
- run `pnpm lint` before finishing
- do not modify generated files under src/generated
- database migrations must be additive
- use existing UI components before adding dependencies
```

这些规则应该由 Harness 在进入仓库时自动发现并注入，而不是每次让用户重新说明。

更进一步，可以按目录加载局部规则：

```text
repo/AGENTS.md
repo/frontend/AGENTS.md
repo/backend/AGENTS.md
```

这样 Agent 在处理 frontend 时不需要携带全部 backend 约束。

本质上，这是一种**按作用域加载 context** 的机制。

## 9. 一个个人开发者能复现的最小 Harness

如果不是要造下一个 Claude Code，而只是想做自己的 Coding Agent，我会从下面这个版本开始：

```text
                ┌──────────────┐
                │  User Goal   │
                └──────┬───────┘
                       ↓
              ┌─────────────────┐
              │   Main Agent    │
              └───┬─────────┬───┘
                  │         │
          explore │         │ execute
                  ↓         ↓
          ┌───────────┐  ┌───────────┐
          │ Explorer  │  │ Executor  │
          └─────┬─────┘  └─────┬─────┘
                │              ↓
                │       Approval Policy
                │              ↓
                └──────→   Sandbox
                               ↓
                     typecheck/lint/test
                               ↓
                         Verify Gate
```

第一版只需要做好六件事：

1. `read / grep / edit / write / bash` 工具；
2. bash allowlist + destructive command gate；
3. 每个工具限制输出大小；
4. 自动读取项目级 `AGENTS.md`；
5. stale tool result pruning；
6. 完成前强制 verification。

先把这六个做扎实，再考虑 browser、MCP、memory、多 Agent swarm。

## 10. 怎么 benchmark Harness，而不是只 benchmark 模型？

我更推荐准备一个固定仓库，重复做五类任务：

| 任务 | 观察指标 |
| --- | --- |
| 定位 bug，不改代码 | 搜索轮数、错误文件率、token 消耗 |
| 跨 5~10 文件重构 | diff 正确率、回滚次数 |
| 修复 failing test | 首次修复率、测试循环次数 |
| 30 分钟长任务 | context 增长、instruction drift |
| 陌生仓库任务 | 危险命令次数、人工批准次数 |

然后分别测试：

```text
A. 不 pruning
B. pruning tool output
C. pruning + Explorer subagent
D. pruning + subagent + verification gate
```

模型保持不变。

如果 D 的成功率明显提升，你测到的就是 Harness 带来的收益，而不是把所有改进都归功于 LLM。

同时记录：

```text
TTFT
总输入 tokens
总输出 tokens
工具调用次数
失败工具调用次数
测试执行次数
最终 wall-clock time
```

这样才有机会回答“更复杂的 Agent 架构到底值不值”。

## 11. 一个越来越重要的工程判断：Context Window 是资源，不是垃圾桶

过去一年模型上下文不断变长，很容易形成一种错觉：

> 既然能塞 200K、1M tokens，那就全部塞进去。

Coding Agent 恰好说明了为什么这不成立。

Agent 的问题不是只有“记不住”，还有：

```text
记住了太多过期信息
不知道哪条信息仍然有效
工具结果重复
状态与文件系统现实脱节
验证结论已经变化
```

因此未来优秀 Harness 的竞争点，很可能不是“支持最大上下文”，而是：

**能否持续把最相关、最新、可验证的信息留在工作集里。**

这也是 context engineering 和普通 prompt engineering 最大的区别之一。

## 12. 结论

Vercel 这套 Coding Agent Harness 教程真正值得看的，不是某个 TypeScript API，而是它把 Agent 工程拆成了清晰的控制面：

```text
模型负责判断
工具负责能力
Policy 负责权限
Sandbox 负责隔离
Context Manager 负责工作集
Subagent 负责上下文分工
Verification 负责事实闭环
Lifecycle 负责长期运行
```

当模型能力越来越接近时，这些外围系统反而越来越决定实际体验。

如果你的 Agent 经常“前十分钟很聪明，半小时后开始失忆”，先别急着换模型。

先检查：**是不是把所有工具输出都永久塞在 context 里？是不是没有验证门？是不是 bash 没有执行层权限控制？是不是探索和实现共享了一份越来越脏的上下文？**

很多时候，Coding Agent 真正需要升级的不是 brain，而是 harness。

## 参考资料

- Vercel Academy — Build Your Own AI Coding Agent Harness: https://vercel.com/academy/build-ai-agent-harness
- Vercel Academy — Builders Guide to the AI SDK: https://vercel.com/academy/ai-sdk
- Vercel Sandbox 文档与实践指南: https://vercel.com/docs/vercel-sandbox
- Anthropic — 2026 Agentic Coding Trends Report: https://resources.anthropic.com/2026-agentic-coding-trends-report
- Bui, *Building AI Coding Agents for the Terminal: Scaffolding, Harness, Context Engineering, and Lessons Learned*, arXiv:2603.05344

> 注：本文对 Harness 架构、benchmark 设计和最小实现的部分属于基于公开资料给出的工程分析，并非 Vercel 官方性能结论。文中没有把未经复现的社区数据作为实测结果。