---
title: "搜索要收录、训练又想拒绝：从 Cloudflare Mixed-use Crawler 拆解 AI 爬虫的用途边界"
published: 2026-09-20
category: "AI前沿"
tags: ["Cloudflare","AI Crawler","robots.txt","Web Security","AI Training","Search"]
draft: false
pinned: false
comment: true
description: "Cloudflare 正在把 Search 与 AI Training 从同一个 crawler identity 中拆成可表达的用途边界。本文从 robots.txt、mixed-use crawler、执行层和可观测性出发，讨论站点如何避免把‘允许搜索’误写成‘允许训练’。"
---

过去管理爬虫时，一个 User-Agent 往往对应一种相对稳定的用途：搜索引擎抓取网页，然后把用户带回网站。生成式 AI 改变了这个假设。同一个 crawler identity 可能同时服务搜索索引、AI 摘要和模型训练，而站长真正想表达的策略往往不是简单的“允许”或“拒绝”。

Cloudflare 在 2026 年 9 月公布了一组针对 mixed-use AI crawlers 的新控制。官方给出的核心目标是：网站可以继续允许搜索发现，同时单独表达“不允许用于 AI training”的偏好，并通过新的 Accountable 分类识别愿意尊重这种用途区分的 crawler。[S1]

这件事真正值得工程团队关注的，不是 robots.txt 又多了一条规则，而是 **crawler identity 与 crawler purpose 开始被拆开**。

## User-Agent 不是授权用途

传统 robots.txt 的基本判断单位接近：

```text
User-Agent -> Allow / Disallow path
```

但在 AI 场景里，实际策略更像：

```text
Crawler identity
  -> Search: allow
  -> AI answer / summary: conditional
  -> Training: deny
```

如果仍把 User-Agent 当成唯一权限主体，就会出现一个结构性冲突：同一个 crawler 同时承担搜索和训练时，站长只能全部放行或全部阻断。前者可能超出内容授权意图，后者又会损失传统搜索发现能力。

Cloudflare 公布的数据也说明这不是边缘情况。其网络观察中，mixed-use crawler 已经成为 verified crawler traffic 中的重要类别；与此同时，阻止搜索抓取和限制 AI training 的站点比例明显不同。[S1] 这意味着站长实际表达的是“用途策略”，而不是简单的“机器人黑名单”。

## robots.txt 是 Preference，不是强制安全边界

这里最容易出现的误解，是把新的 `Disallow AI Training` 理解成防火墙规则。

robots.txt 本质上仍是一种公开声明。守规则的 crawler 会读取并尊重它，但恶意客户端完全可以忽略。因此生产架构最好明确分成两层：

1. **Preference Layer**：robots.txt、meta directive 或平台控制面，用于公开表达允许的用途。
2. **Enforcement Layer**：WAF、Bot Management、认证、速率限制和访问控制，用于真正决定请求能否抵达内容。

这和 API 的 `README` 与 IAM policy 很像。README 可以告诉调用方“请不要执行删除操作”，但真正的删除权限仍应该由服务端授权系统控制。

如果内容具有明确商业价值，单独依赖 robots.txt 不是安全设计；如果目标是向大型合规 crawler 表达用途偏好，robots.txt 又恰好是低摩擦、可缓存、跨平台的公开接口。

## Accountable 的价值在于把“承诺”变成可观察属性

Cloudflare 的新方向还引入了 Accountable mixed-use crawler 的概念：平台不只是看到一个机器人名称，而是关心运营方是否提供训练退出机制、是否让搜索与训练偏好可以分别表达，以及是否提供相应透明度。[S1]

从工程角度看，这类似给 crawler 增加 capability metadata：

```yaml
crawler: examplebot
purposes:
  search: true
  training: true
controls:
  honors_no_training: true
  url_level_reporting: true
```

当然，真实平台并不一定采用这份 YAML；这里的结构只是为了说明设计思想。重要的是，策略判断不再只依赖名字，而开始依赖“它承诺什么、平台观察到什么”。

## 站点应该测试最终生产语义，而不是只测试仓库文件

使用 CDN 或边缘平台后，`robots.txt` 可能不再完全由源站静态文件决定。控制面可以生成或 prepend 规则，缓存层也可能暂时保留旧版本。因此 CI 只检查仓库里的 `public/robots.txt` 并不够。

更可靠的 production contract test 应直接请求最终域名，例如检查：

- HTTP 状态是否为 200；
- 原有搜索 crawler 规则是否仍存在；
- AI training 偏好是否出现在最终响应；
- 自己原先的 `Disallow` 是否没有被平台规则覆盖；
- CDN purge 后不同 PoP 的结果是否逐渐收敛。

不要 snapshot 整个文件。平台可能调整注释、排序或格式。测试应该围绕语义断言，例如“training deny 存在”“Googlebot 没被误伤”。

## 对个人技术博客，一个更实用的策略矩阵

技术博客通常同时希望获得搜索流量、AI 引用和原创内容保护，因此可以先写出用途矩阵，再映射到具体平台设置：

| 用途 | 默认策略 | 原因 |
| --- | --- | --- |
| 传统搜索索引 | Allow | 保留可发现性 |
| 用户主动触发的 Agent 抓取 | Allow / Rate limit | 用户意图明确，但仍需防滥用 |
| AI 摘要与答案引用 | 视站点目标决定 | 可能带来曝光，也可能减少回访 |
| 模型训练 | Explicit choice | 与搜索发现不是同一价值交换 |
| 未识别高频抓取 | Challenge / Limit | 无法仅凭自报身份建立信任 |

这个矩阵比“Block AI Bots = on/off”更接近真实需求。

## 更大的变化：Web Policy 正在从身份控制走向用途控制

AI Agent 会让这个问题继续扩大。未来一个请求可能来自浏览器、搜索 crawler、用户授权 Agent 或后台训练任务；它们甚至可能共享相同云出口和 HTTP 栈。仅依赖 IP、User-Agent 或 ASN 很难准确表达授权。

因此值得持续观察的是：Web 的访问策略是否会逐渐拥有更明确的 **purpose、delegation 与 accountability** 信号。Cloudflare 当前的 mixed-use crawler 控制只是其中一个现实案例。

对站长而言，现在最重要的动作并不是追逐每一个新机器人名称，而是先回答三个问题：谁可以读取、为了什么用途读取、如果对方不遵守声明我是否还有执行层。把这三件事拆开，AI crawler policy 才不会随着下一个 User-Agent 出现再次重写。

## 参考资料

[S1]: https://blog.cloudflare.com/accountable-mixed-use-ai-crawlers/
[S2]: https://blog.cloudflare.com/content-independence-day-ai-options/
