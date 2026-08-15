---
title: 把 Computer Use 变成 MCP 工具：Windows 上让不同 Agent 共用桌面能力，真正难的是权限边界
published: 2026-08-15
category: AI前沿
tags: [MCP, Computer Use, Codex, Claude Code, Windows, Agent, LINUX DO]
draft: false
pinned: false
comment: true
description: 从 LINUX DO 上的 codex-cua-mcp 社区项目出发，重新梳理“把 Computer Use 封装成 MCP Server”这类方案的架构价值、适用场景与安全边界。
---

最近在 LINUX DO 看到一个挺有意思的社区项目：作者尝试把 Codex 的 Computer Use 能力封装成 MCP Server，让 Claude Code 或其他支持 MCP 的 Agent 也能调用 Windows 桌面操作能力。

这件事最值得关注的地方，不是“又多了一个能自动点鼠标的工具”，而是它把一个越来越重要的 Agent 工程问题摆到了台面上：

> **当模型、Agent 客户端和工具能力开始彼此解耦，Computer Use 是否也能像数据库、浏览器、文件系统一样，成为一个可插拔的标准工具？**

这一篇我不照搬社区教程，而是从架构角度重新拆开来看。

## 一、先把几个概念分开

很多人第一次接触 Computer Use，会把下面几件事混在一起：

1. **模型是否看得懂屏幕**；
2. **Agent 是否能调用桌面工具**；
3. **工具是否有权限控制鼠标键盘**；
4. **执行结果如何回传给模型**；
5. **是否支持跨客户端复用。**

实际上这五层完全可以拆开。

一个最简单的抽象是：

```text
LLM / Agent
    ↓
Tool Calling / MCP Client
    ↓
MCP Server
    ↓
Computer Use Adapter
    ↓
Windows Desktop
```

模型负责“决定要做什么”，MCP 负责“怎么调用工具”，桌面适配层负责“真正执行点击、输入、截图等动作”。

一旦这样理解，Computer Use 就不再是某个模型的专属能力，而更像一个可以被不同 Agent 调度的执行器。

## 二、为什么 MCP 是一个自然的接口层

OpenAI 当前的 Codex 本身已经支持 MCP Client，同时还提供实验性的 `codex mcp-server`，允许其他 MCP 客户端把 Codex 当作工具调用。

这说明一个趋势已经非常明显：

**Agent 与 Agent、Agent 与工具之间，正在从“每家做一套私有接入”向协议化接口靠拢。**

MCP 解决的核心问题并不是让模型突然变聪明，而是降低集成复杂度。

假设你有：

- Claude Code；
- Codex；
- Qwen Code；
- 自己写的 Agent；
- 一个浏览器自动化工具；
- 一个桌面自动化工具；
- 一个数据库查询工具。

如果每个 Agent 都要为每个工具写一次私有适配，复杂度会迅速膨胀。

而 MCP 的思路更接近：

```text
多个 Agent
   ↓
统一工具协议
   ↓
多个 MCP Server
```

这也是社区里“把 Computer Use 封成 MCP”这个想法真正有价值的地方。

## 三、没有多模态模型，也能做 Computer Use 吗？

社区作者提到，即使使用的模型本身不是典型的视觉模型，也可以通过工具链间接完成部分 Computer Use 工作。

这里要注意一个很重要的区别：

### 模型原生视觉理解

模型直接接收屏幕截图，理解 UI，再决定下一步操作。

这种方式通常更自然，例如：

- 找到一个没有固定坐标的按钮；
- 判断弹窗内容；
- 理解图标、布局、错误提示；
- 应对界面位置变化。

### 工具侧完成感知

另一种方案是让 Computer Use 工具自己承担更多工作，例如：

- OCR；
- UI Automation Tree；
- 控件识别；
- 坐标查询；
- 当前窗口检测；
- 截图后由另一层能力解析。

然后只把结构化结果交给模型。

所以“非多模态模型也能操作电脑”并不神奇，本质上是**把视觉理解的一部分从模型层迁移到了工具层。**

但它通常也会付出代价：

- 对复杂 UI 的鲁棒性较差；
- 步骤可能更多；
- 误操作恢复更困难；
- 对工具实现质量更敏感。

## 四、真正需要设计的是权限，而不是点击速度

Computer Use 一旦进入 MCP 工具体系，最大的风险就不再是“它能不能点按钮”，而是：

> **它到底能点哪些按钮？**

如果一个 Agent 同时拥有：

- Shell；
- 浏览器；
- 文件系统；
- Windows 桌面控制；
- 网络；
- 登录态；

那它实际上已经拥有非常接近真实用户的操作权限。

因此我认为一个成熟的 Computer Use MCP 至少应该考虑下面几层控制。

### 1. 应用白名单

例如只允许：

```text
VS Code
Chrome
Windows Terminal
Notepad
```

而不是默认整个桌面都可以操作。

### 2. 高风险动作确认

这些操作不应该静默执行：

- 删除文件；
- 发送邮件/消息；
- 支付；
- 修改系统设置；
- 安装软件；
- 提交生产环境变更；
- 粘贴密钥；
- 点击不可逆按钮。

### 3. 每一步保留可审计记录

理想情况下，每个动作都应该留下：

```text
时间
Agent
目标窗口
动作
参数
截图/状态
结果
```

这样出问题时才能回答“到底是谁在什么时候点了什么”。

### 4. Secret 与剪贴板隔离

桌面 Agent 很容易碰到：

- 浏览器密码管理器；
- API Key；
- SSH 私钥；
- Token；
- 剪贴板历史。

因此桌面控制层最好不要天然拥有读取一切敏感数据的权限。

## 五、Computer Use 最适合什么任务

我不认为 Computer Use 应该替代 API。

如果一个系统已经有稳定 API，那么 API 几乎永远更可靠：

```text
API > CLI > DOM/Accessibility Tree > Computer Use 坐标操作
```

越往右，越依赖界面状态，也越容易因为布局变化而失败。

Computer Use 真正有优势的是那些**没有 API，但人类每天又不得不操作 GUI** 的工作。

例如：

- 老旧企业软件；
- Windows 专有客户端；
- 某些后台工具；
- 只能通过 GUI 完成的测试流程；
- 需要同时跨多个桌面应用的操作；
- GUI 回归测试；
- 临时自动化。

这也是为什么我觉得“Computer Use + MCP”值得关注：它让这些最后一公里的 GUI 自动化，可以被更高层 Agent 调度。

## 六、一个更合理的 Agent Desktop 架构

如果让我自己设计，我不会让主 Agent 直接拥有无限桌面权限，而会增加一层 Desktop Worker：

```text
主 Agent
   ↓
任务描述
   ↓
Desktop Worker
   ↓
Computer Use MCP
   ↓
Windows
```

Desktop Worker 的上下文里只保留当前桌面任务，例如：

> 打开浏览器，进入测试环境，确认登录页在 1280×720 下是否出现横向滚动条。只允许访问测试域名，不允许提交表单。

它完成后只返回：

- 是否通过；
- 截图；
- 发现的问题；
- 必要的 UI 状态。

而不是把主 Agent 的整个项目上下文和所有权限一起带进去。

这会比“让一个超级 Agent 拥有所有工具”安全得多。

## 七、为什么这类社区项目值得长期观察

社区里的 `codex-cua-mcp` 目前更像一个探索性工程项目，而不是某种通用标准答案。

但它所代表的方向非常重要：

> 模型不一定拥有所有能力，Agent 客户端也不一定绑定某个模型；真正可复用的能力，应该尽量沉到协议化工具层。

未来你完全可能看到这样的组合：

```text
便宜模型：做分类、搜索、整理
强推理模型：做规划和决策
Coding Agent：修改代码
Browser Agent：处理网页
Desktop Agent：操作 GUI
Verifier：做最终检查
```

它们之间通过标准协议连接，而不是所有事情都交给一个“万能聊天窗口”。

这比单纯比较“谁家的模型 benchmark 高 2 分”更值得开发者关注。

## 参考资料

- LINUX DO：在 Windows 下的任何 Agent 使用 Computer Use  
  https://linux.do/t/topic/2490658
- 社区项目：RS-Nocsi/codex-cua-mcp  
  https://github.com/RS-Nocsi/codex-cua-mcp
- OpenAI Codex：MCP Server Interface（experimental）  
  https://github.com/openai/codex/blob/main/codex-rs/docs/codex_mcp_interface.md
- OpenAI Codex README：MCP client / server 说明  
  https://github.com/openai/codex/blob/main/codex-rs/README.md

> 这是一篇基于社区项目进行架构再研究的文章，不代表 OpenAI 对第三方 `codex-cua-mcp` 项目的官方背书。
