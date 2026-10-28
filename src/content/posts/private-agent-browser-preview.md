---
title: "让 AI Agent 看见私有开发服务器：从 Cloudflare Internal Hosts 拆解浏览器预览边界"
published: 2026-10-29
category: "AI前沿"
tags: ["AI Agent","Cloudflare Workers","浏览器自动化","开发环境","安全边界"]
draft: false
pinned: false
comment: true
description: "Cloudflare Agents SDK 新增 Internal Hosts，让持久化浏览器能够访问容器中的私有开发服务器，而无需把预览地址暴露到公网。本文从请求路径、Durable Object 接线、Harness 集成和安全验证出发，拆解这项能力适合解决什么问题、哪些边界仍需自行治理，以及如何把“Agent 看见页面”变成可审计的工程流程。"
image: "https://developers.cloudflare.com/changelog/post/2026-10-28-browser-internal-hostnames/og.png?v=9521c50736fe9a1e"
---

## 先把问题说清楚：Agent 为什么需要一个“看得见”的开发环境

让 AI Agent 编写网站，最容易被低估的部分不是生成代码，而是确认代码在真实浏览器里是否成立。静态检查可以发现语法错误，单元测试可以验证函数，但布局、交互、资源加载、路由跳转和浏览器运行时行为，最终仍然需要一个能打开页面的浏览器。

传统做法通常有两条路。第一条是把本地开发服务器暴露到公网，再把临时 URL 交给 Agent；第二条是把构建产物上传到某个可访问环境，再让浏览器检查。前者扩大了攻击面，后者增加了发布、清理和状态同步成本。两种方式都把“预览”误当成了“部署”：为了让浏览器看一眼页面，开发者不得不创建一个更大的网络暴露面。

Cloudflare 在 2026 年 10 月 28 日发布的 Agents SDK 更新提供了另一种模型：Internal Hosts。官方描述是，持久化浏览器可以访问 Agent 在容器中提供的开发服务器，而这些服务器不需要暴露到公共互联网。浏览器请求特定的内部主机名，例如 `preview.internal`，请求会回到 Agent 自己的处理逻辑，而不是解析到互联网中的公共站点。

这个变化的核心不是又增加了一个域名后缀，而是把“浏览器能访问什么”从公共网络路由中分离出来。浏览器仍然拥有真实的页面观察能力，但被观察的服务可以继续留在沙箱、工作区或同一套 Worker 运行环境中。

## Internal Hosts 的架构：浏览器入口不是公网入口

从官方示例可以抽象出四个组件：浏览器配置、内部主机路由、Durable Object 生命周期接线，以及 Agent Harness 的工具注册。

第一层是浏览器配置。`internalHosts` 用来声明浏览器有哪些内部主机，以及每个主机如何把请求转发给 Agent。示例中的 `preview.internal` 不是一个需要购买或委派 DNS 的域名，它更像浏览器内部识别的一项能力名称。模型可以通过 `browser.assignHost()` 选择主机，再由主机配置决定实际服务什么内容，例如某个端口或某个目录。

第二层是请求路由。Cloudflare 示例导出了 `InternalHostRouter`，并把它交给浏览器运行时。内部主机请求不会走普通公网 DNS，也不会直接把开发端口绑定到互联网，而是回调 Durable Object 中的内部处理函数。官方示例使用 `fetchInternalHost()` 将浏览器请求接到应用自身的逻辑上。

第三层是 Durable Object。它不只是一个保存会话的容器，也承担浏览器与 Agent 之间的生命周期连接。浏览器会话、内部主机路由、模型调用和工作区状态需要在同一套运行上下文里协作，因此示例将 `Browser`、AI 初始化和注册表放入 Durable Object 中。这样做的工程含义是：预览请求不是一个孤立的 HTTP 反向代理，而是 Agent 会话能力的一部分。

第四层是 Harness 集成。官方示例通过 `browserTool` 把浏览器能力注册到 Pi Harness，也提供了 AI SDK、TanStack AI 等内置适配器。没有现成适配器时，也可以通过 `browser.session()` 实现自己的工具连接。这说明 Internal Hosts 位于浏览器能力层，而不是某个单一 Agent 框架的私有功能。

可以把完整链路写成：

```text
Agent 选择 preview.internal
        |
浏览器向 InternalHostRouter 发起内部请求
        |
Durable Object 执行 fetchInternalHost()
        |
连接沙箱端口、工作区目录或 Service Binding
        |
浏览器返回页面、资源和交互结果
```

这条链路最重要的性质，是“可访问”与“可公开访问”不再是同一个状态。Agent 可以看到页面，不代表互联网用户可以看到页面。

## 如何接入：先建立最小可验证链路

官方更新要求使用 Agents SDK 0.31.0 或更高版本。版本检查应当放在实现的第一步，而不是出现运行时错误后再猜测原因。

```bash
npm ls agents
npm view agents version
```

如果项目已经存在锁文件，优先确认实际解析到的版本，而不是只看 `package.json` 中的范围。更新依赖时应保留锁文件变更，并在 CI 中重复版本检查：

```bash
npm install agents@^0.31.0
npm ls agents
```

接着，把验证拆成四个最小问题，而不是一开始就接入完整 Agent：

```text
1. Durable Object 能否正常启动？
2. Browser 是否能创建持久化会话？
3. preview.internal 是否能被路由到 fetchInternalHost()？
4. 该函数是否能返回开发服务器的 HTML、脚本和静态资源？
```

一个最小的配置形态可以表达为下面这样。它不是完整可运行项目，而是用于核对职责边界的骨架：

```ts
import { Browser, browserRun } from "agents/browser";

const browser = new Browser({
  provider: browserRun(env.BROWSER, {
    internalHosts: {
      router: this.ctx.exports.InternalHostRouter,
      hosts: {
        "preview.internal": {
          description: "Agent workspace dev servers"
        }
      }
    }
  })
});
```

真正的端口访问逻辑仍然需要由应用提供，例如示例中的 `fetchSandboxPort`。这点很关键：SDK 负责把内部主机请求送到你的应用，但它不会替你决定哪个端口可信、哪个目录可读、哪个工作区属于当前会话。内部主机是访问能力，不是自动生成的沙箱策略。

如果目标不是访问沙箱端口，而是访问另一个 Worker，官方材料还给出了 Service Binding 方向。此时验证重点从“端口是否开放”变成“绑定是否指向预期 Worker，以及该 Worker 是否继续执行自己的鉴权和资源隔离”。

## 验证清单：页面能打开，不等于边界正确

第一项是网络暴露验证。开发服务器应只监听 Agent 能够访问的内部位置，不能因为增加了 Internal Hosts，就顺手把端口绑定到公网接口。检查时至少确认：外部网络无法直接访问该开发端口；浏览器通过 `preview.internal` 可以访问；两条路径的响应结果不能被混淆。

第二项是主机选择验证。官方设计允许为主机增加 target schema，让模型选择它要服务的端口或目录。这个能力提高了通用性，也扩大了模型选择目标的范围。工程上应限制可选项，而不是把任意端口、任意路径交给模型自由组合。最小配置应当是显式白名单：

```ts
type PreviewTarget = "frontend" | "docs";

const targets: Record<PreviewTarget, number> = {
  frontend: 3000,
  docs: 4173
};
```

第三项是资源完整性验证。首页返回 200 只能说明入口存在，不能说明页面可用。应继续检查脚本、样式、字体、图片和客户端路由。尤其是开发服务器常常返回相对路径资源，如果内部主机只代理 HTML 而没有正确处理后续请求，Agent 得到的可能是一张没有样式的“假页面”。

第四项是交互验证。浏览器需要真正执行点击、输入、跳转和错误回退。若页面依赖 WebSocket、Server-Sent Events 或长轮询，必须分别确认这些连接是否经过同一内部主机机制。材料只证明 Internal Hosts 能让浏览器访问私有开发服务器，并没有证明所有实时协议在每种 Harness 中都自动可用，因此不能把“页面打开”推导成“所有交互都可用”。

第五项是状态隔离验证。两个 Agent 会话不能因为使用同一个 `preview.internal` 就读到彼此的工作区、端口或 Durable Object 状态。测试可以创建两个不同会话，分别启动不同内容，再比较浏览器返回结果。只要出现串页，就说明路由键、对象实例或工作区绑定缺少会话维度。

第六项是失败路径验证。至少应覆盖端口未启动、目标不存在、开发服务器返回 500、静态资源超时和会话结束后的再次访问。内部访问失败应显示明确错误，不应退化成一个看似成功的空白页面。对 Agent 来说，明确的失败比错误页面更有价值，因为它能触发修复或重新启动流程。

## 安全边界：私有预览仍然是一个高权限工具

“不暴露公网”只解决了入口暴露问题，没有解决内容授权问题。浏览器能访问内部主机，意味着 Agent 具备读取该主机响应的能力。如果路由逻辑把整个工作区映射出来，源代码、环境配置、构建缓存和生成文件都有可能进入浏览器上下文。

因此，内部主机的最小权限应当同时限制三件事：主机名、目标资源和会话生命周期。主机名限制请求入口；目标资源限制端口或目录；生命周期限制访问在任务结束后继续存在。任何一项缺失，都可能让“预览能力”变成“工作区读取能力”。

还要区分应用鉴权与预览鉴权。开发服务器原本可能依赖公网反向代理、登录 Cookie 或测试账号；当它被放进 Internal Hosts 后，浏览器到开发服务器之间的路径发生变化，原有鉴权假设需要重新检查。不能因为请求没有经过公网，就认为页面天然可信。

模型路由也不能替代这些治理措施。GitHub Copilot Fusion 的官方说明展示了单模型、级联和批评复核等编排方式，并允许管理员控制可用模型。那解决的是“哪个模型参与任务、如何编排”的问题；Internal Hosts 解决的是“浏览器如何访问私有预览”的问题。二者可以同时存在，但模型选择策略不能成为资源授权策略。一个更强的模型并不会自动获得更合理的端口权限。

## 失败边界与工程取舍

Internal Hosts 最适合“Agent 在生成代码后立即检查页面”的闭环，而不是替代测试环境、预发布环境或面向用户的演示站点。它的优势是短路径、低暴露和较少的发布中间物；代价是需要自己维护端口发现、资源代理、会话隔离和生命周期清理。

如果任务只需要检查静态 HTML，上传构建产物可能更简单；如果任务需要操作真实浏览器、验证客户端路由或观察交互状态，私有开发服务器更有价值。如果团队已经有成熟的预览环境，新增 Internal Hosts 的收益可能主要体现在减少公网临时 URL，而不是替换整套发布流程。

另一个取舍是调试透明度。自动编排的 Agent 可能在一次任务中反复修改代码、启动服务器和刷新页面。若只记录最终截图，无法判断页面是首次生成就正确，还是经过多次失败后才恢复。工程上应记录至少三类事件：选择了哪个内部主机和目标、请求是否成功、浏览器观察到的验证结果。这样才能将一次“Agent 看到了页面”还原为可审计的执行链。

## 原创结论：预览能力的价值在于缩短反馈环，而不是扩大可见性

把私有开发服务器交给 Agent 访问，真正改变的是反馈环：代码、运行时、浏览器和修复动作可以在同一会话中连续发生。它不是把本地服务“发布出去”，而是为浏览器增加一条受控的内部观察通道。

但这条通道越方便，越应该把权限设计前置。一个可靠的实现应当满足四个条件：浏览器能打开真实页面；外部网络无法绕过内部路由访问服务；不同会话之间严格隔离；所有失败和目标选择都有可追踪记录。

因此，评价这项能力不应只问“Agent 能不能看到网页”，而应问：它看到的是哪个会话的哪个目标，访问经过了哪条路径，失败时谁能定位原因，任务结束后权限是否消失。只有当这些问题都有明确答案时，浏览器预览才不是一个演示功能，而是可以纳入工程治理的 Agent 工具。

## 参考资料

- [Agents, Browser Run - Agents SDK: Preview dev servers in the browser without public URLs](https://developers.cloudflare.com/changelog/post/2026-10-28-browser-internal-hostnames/)
- [Route and orchestrate models with GitHub Copilot Fusion](https://github.blog/changelog/2026-10-28-route-and-orchestrate-models-with-github-copilot-fusion)
