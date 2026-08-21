---
title: CI 里为什么不该继续存长期 Token？从 GitHub Actions OIDC 到 Vercel Trusted Sources 的无密钥边界
author: Katelya
published: 2026-08-21
category: 技术分享
tags: [GitHub Actions, OIDC, Vercel, CI/CD, DevSecOps, Zero Trust, Security, Deployment]
draft: false
pinned: false
comment: true
description: OIDC 正在把 CI/CD 从“把长期 Token 塞进 Secrets”推向“按任务签发短期身份”。但 GitHub Actions OIDC、Vercel OIDC Federation、Trusted Sources 与 Vercel CLI 部署认证并不是同一件事。本文拆解四条身份链路、常见误区、最小权限设计与可复现实验方法。
---

很多 CI/CD 教程的第一步仍然是：

```text
Settings → Secrets → New repository secret
```

然后你会陆续塞进去：

```text
VERCEL_TOKEN
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
CLOUDFLARE_API_TOKEN
NPM_TOKEN
PYPI_TOKEN
...
```

短期看，这很方便。

长期看，它实际上是在做一件风险很高的事情：

> 把“可以长期代表某个用户或服务执行操作的身份证”复制到另一个系统里，再期待它永远不会泄漏。

只要 CI 能读取这个 Secret，第三方 Action、依赖供应链、错误日志、调试脚本、被攻破的 Runner，甚至一个权限过大的 Pull Request Workflow，都可能成为泄漏路径。

OpenID Connect，也就是 OIDC，正在改变这套模型。

它不是让 CI “没有身份”，而是把认证方式从：

```text
长期静态凭据
```

变成：

```text
当前这一次 Workflow Job 的可验证短期身份
```

不过最近在 GitHub Actions、Vercel、云平台和各种部署工具之间讨论 OIDC 时，经常会出现一个误区：

**“GitHub Actions 支持 OIDC，所以我可以把所有 Vercel Token 都删掉了。”**

这句话目前并不准确。

因为下面几件事情虽然都叫 OIDC，但解决的是不同方向的问题：

1. GitHub Actions 用 OIDC 去换 AWS / GCP / Azure 等云平台的短期凭证；
2. Vercel 自己作为 OIDC Identity Provider，让 Vercel Build / Function 去访问外部服务；
3. Vercel Trusted Sources 接受 GitHub Actions 等外部 IdP 的 OIDC Token，用于访问受 Deployment Protection 保护的部署；
4. GitHub Actions 调用 Vercel CLI 创建 Deployment，目前官方指南依然使用 `VERCEL_TOKEN`。

如果把这四条链路混成一件事，就很容易得到错误的安全结论。

这篇文章不只是讲“怎么开启 OIDC”，而是把这四条身份链路彻底拆开，并讨论一个更重要的问题：

> **无长期密钥 CI 的边界到底在哪里？**

---

## 1. 传统 CI Secret 的问题，不只是“可能泄漏”

假设一个 GitHub Actions Workflow 需要把构建产物部署到某个云平台。

传统方案大概是：

```text
Cloud Provider
    ↓ 创建 Access Key
GitHub Repository Secret
    ↓ 注入环境变量
GitHub Actions Job
    ↓ 调用 CLI / SDK
Cloud Provider API
```

这种方式的问题有四层。

### 1.1 Secret 生命周期通常远大于 Job 生命周期

一次 CI Job 可能只跑 8 分钟。

但你放进去的 Token 可能：

- 30 天不过期；
- 90 天不过期；
- 一年不过期；
- 甚至根本没有自动过期时间。

这意味着：

```text
任务生命周期 = 8 分钟
凭据生命周期 = 几个月甚至永久
```

两个生命周期严重不匹配。

真正合理的模型应该更接近：

```text
Job 启动
  ↓
获得短期身份
  ↓
完成任务
  ↓
凭据自动失效
```

而不是把一个长期有效的万能钥匙交给每一次 Job。

### 1.2 Secret 需要人工轮换

长期 Token 最大的问题之一是 Rotation。

你必须记住：

1. 去服务商重新创建 Token；
2. 更新 GitHub Secret；
3. 确认旧 Token 已撤销；
4. 确认所有引用这个 Secret 的 Workflow 没有断；
5. 如果 Token 属于某个个人账号，还要处理人员离职或权限变化。

现实里，很多 Token 最终会变成：

> “不知道谁创建的，但删了怕 CI 挂，所以一直留着。”

这就是典型的凭据债务。

### 1.3 Secret 的权限经常比任务需要的大

例如一次 Workflow 只是需要上传一个对象到 S3。

但为了省事，可能直接把拥有整个 AWS Account 大量权限的 Access Key 塞进 GitHub。

这时攻击者只需要攻破一次 CI，就不是拿到“上传这个对象”的权限，而可能拿到：

```text
一个长期、跨环境、跨资源的云账号权限
```

### 1.4 Secret 本身很难表达“谁正在使用我”

一个静态 Token 通常只表达：

```text
持有者拥有某权限
```

但它无法天然证明：

```text
这是 owner/repo 的 main 分支
这是 deploy-production.yml
这是 production environment
这是某个经过审核的 commit
```

OIDC 的价值就在这里开始出现。

---

## 2. GitHub Actions OIDC：CI Job 不再拿固定身份证，而是出示“任务证明”

GitHub 官方文档对 OIDC 的基本描述非常直接：Workflow 可以从 GitHub 的 OIDC Provider 获取一个短期 Token，并把它交给支持 OIDC 的云服务。

云服务验证这个 Token 的签名和 Claims 后，再发放自己的短期 Access Token。

整体流程是：

```text
GitHub Actions Job
        │
        │ 请求 OIDC Token
        ▼
GitHub OIDC Provider
        │
        │ JWT：repo / ref / environment / workflow ...
        ▼
Cloud Provider / Service
        │
        │ 验证 issuer + claims
        ▼
短期访问凭据
        │
        ▼
执行部署 / 上传 / API 操作
```

这里最关键的一点是：

**GitHub 的 OIDC Token 本身通常不是云平台 API Key。**

它更像一个由 GitHub 签名的声明：

> “我证明现在有一个满足这些条件的 Workflow Job 正在运行。”

真正的资源服务再决定：

> “这个 Job 是否有资格换取我的短期凭据？”

这就是 Federation。

---

## 3. `id-token: write` 到底给了什么权限？

GitHub Actions 中常见配置是：

```yaml
permissions:
  contents: read
  id-token: write
```

很多人看到 `write` 会误以为：

> 这个 Workflow 获得了“写 GitHub Token”的高危权限。

不是。

这里的 `id-token: write` 表示允许 Job 向 GitHub OIDC Provider **请求一个 OIDC ID Token**。

它并不等于：

```text
contents: write
packages: write
pull-requests: write
```

也不会自动赋予 AWS、Vercel 或其他第三方权限。

真正决定第三方是否接受这个 Token 的，是第三方的 Trust Policy。

因此安全边界不是：

```text
能不能拿 OIDC Token
```

而是：

```text
谁的 OIDC Token
在什么条件下
能换到什么权限
```

---

## 4. Claims 才是 OIDC 最重要的部分

一个 OIDC JWT 通常会包含：

```text
iss   issuer
sub   subject
aud   audience
exp   expiration
nbf   not before
iat   issued at
```

GitHub 还可以携带与 Repository、Workflow、Branch、Environment 等相关的身份信息。

真正安全的 Trust Policy 不应该只写：

```text
只要是 GitHub 发的 Token 就行
```

而应该尽量限制到：

```text
特定 organization
特定 repository
特定 branch / tag
特定 environment
必要时特定 workflow
```

可以把它理解为从：

```text
“有钥匙的人都能进”
```

升级成：

```text
“只有满足特定上下文的这一次任务能临时进”
```

这也是 Zero Trust 在 CI 里的一个非常典型实现。

---

## 5. 第一条链路：GitHub Actions → Cloud Provider

这是 OIDC 最经典、最成熟的用法。

例如 GitHub Actions 需要访问 AWS。

传统方式：

```yaml
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

OIDC 方式则更接近：

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - uses: actions/checkout@v4

  - name: Configure cloud credentials
    uses: cloud-provider/oidc-login-action@...
```

这里省掉的不是“认证”，而是：

```text
不再需要长期保存云平台 Access Key
```

云平台通过 GitHub OIDC Token 的 Claims 判断这个 Workflow 是否可以 Assume 某个 Role。

最终 Workflow 获得的云凭据应该是：

- 短期；
- 自动失效；
- Scope 较小；
- 可以绑定 Repository / Branch / Environment。

这才是 OIDC 真正改变 CI 安全模型的地方。

---

## 6. 第二条链路：Vercel → AWS / Azure / GCP / 自建 API

这里方向完全反过来了。

Vercel 官方 OIDC Federation 文档描述的是：

```text
Vercel Build / Function
      ↓
Vercel OIDC Identity Provider
      ↓
外部 Cloud / Backend
```

也就是说，此时 **Vercel 是身份提供方**。

Vercel 会为 Build 或 Function 提供 OIDC Token。

在 Build 环境中可以通过：

```text
VERCEL_OIDC_TOKEN
```

获得相关身份。

Vercel 文档还说明，其 Production / Preview OIDC Token 的 TTL 是一小时；Function 场景会在生命周期内处理 Token 缓存与刷新。

这解决的是：

> “部署在 Vercel 上的应用如何访问 AWS、Azure、GCP 或其他支持 Federation 的后端，而不保存长期云凭据？”

例如：

```text
Vercel Function
   ↓ OIDC
AWS STS
   ↓
短期 Role Credential
   ↓
S3
```

这和 GitHub Actions 去 Vercel 部署，完全不是同一条链。

---

## 7. Vercel 的 `aud` 与 `sub` 为什么值得关注

Vercel OIDC Reference 给出了非常清晰的 Claim 结构。

例如：

```text
aud = https://vercel.com/[TEAM_SLUG]
```

`sub` 类似：

```text
owner:[TEAM_SLUG]:project:[PROJECT_NAME]:environment:[ENVIRONMENT]
```

这个设计很有价值，因为外部云平台可以把权限绑定到：

```text
Team
  └── Project
       └── Environment
```

例如只允许：

```text
my-team
my-api
production
```

访问生产数据库，而 Preview 环境只能访问测试资源。

于是权限模型不再是：

```text
Vercel 上所有东西共享一个 AWS Key
```

而是：

```text
不同 project/environment 拥有不同可验证身份
```

---

## 8. 第三条链路：GitHub Actions → Vercel Protected Deployment

这才是最近几年非常值得关注的一块。

Vercel 的 Deployment Protection 可以让 Preview 或其他 Deployment 处于受保护状态。

以前如果 GitHub Actions 里的 Playwright / Cypress / API Test 想访问这些页面，经常使用：

```text
Protection Bypass for Automation
```

也就是一个长期 Bypass Secret。

请求时发送：

```http
x-vercel-protection-bypass: <secret>
```

这个方案能工作，但仍然存在静态 Secret 的老问题：

```text
需要保存
需要轮换
泄漏后持续有效
权限范围可能过大
```

2026 年 5 月，Vercel 发布 **Trusted Sources for Deployment Protection**。

它允许受保护 Deployment 接受外部 OIDC Provider 的短期身份，包括 GitHub Actions。

于是链路变成：

```text
GitHub Actions
    ↓ 请求 OIDC ID Token
GitHub OIDC Provider
    ↓
Vercel Trusted Sources
    ↓ 验证 issuer + claims
Protected Deployment
```

调用方把 Token 放在：

```http
x-vercel-trusted-oidc-idp-token: <OIDC_TOKEN>
```

Vercel 再验证：

- Token 签名；
- Issuer；
- 配置的 Claims；
- Environment 规则。

这时 E2E 测试就不一定需要保存长期的 Deployment Bypass Secret。

---

## 9. 一个更合理的 GitHub Actions E2E 访问模型

概念上可以写成：

```yaml
name: E2E Preview

on:
  pull_request:

permissions:
  contents: read
  id-token: write

jobs:
  test-preview:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Get GitHub OIDC token
        uses: actions/github-script@v7
        id: oidc
        with:
          script: |
            const token = await core.getIDToken()
            core.setSecret(token)
            core.setOutput('token', token)

      - name: Test protected preview
        env:
          OIDC_TOKEN: ${{ steps.oidc.outputs.token }}
          PREVIEW_URL: ${{ vars.PREVIEW_URL }}
        run: |
          curl -fsS "$PREVIEW_URL/api/health" \
            -H "x-vercel-trusted-oidc-idp-token: $OIDC_TOKEN"
```

这段代码本身不是完整的生产配置。

真正生产化时还必须在 Vercel Trusted Sources 中限制：

```text
Issuer
Repository
Branch / Environment
Audience
其他必要 Claims
```

否则你只是把：

```text
“任何拿到 Secret 的人都能访问”
```

变成：

```text
“任何能拿 GitHub OIDC Token 的 Workflow 都能访问”
```

那仍然太宽。

---

## 10. 最容易踩坑的误区：Trusted Sources ≠ Vercel CLI 无 Token 部署

这是本文最重要的边界。

Vercel Trusted Sources 解决的是：

> **谁可以访问受 Deployment Protection 保护的 Deployment。**

它不是在说：

> **谁可以调用 Vercel API 创建 Deployment。**

截至本文撰写时，Vercel 官方的 GitHub Actions 部署指南仍然使用：

```text
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

典型命令仍然是：

```bash
vercel pull --token=$VERCEL_TOKEN
vercel build --token=$VERCEL_TOKEN
vercel deploy --prebuilt --token=$VERCEL_TOKEN
```

所以今天你可以合理做到：

```text
GitHub Actions
   ├── OIDC → AWS
   ├── OIDC → Protected Vercel Preview
   └── VERCEL_TOKEN → Vercel CLI Deployment
```

这是一种“部分去静态密钥”的状态。

不要因为某个平台支持 OIDC，就自动推导出：

```text
所有 API 都支持 Token Exchange
```

必须逐条确认具体产品的认证入口。

---

## 11. 为什么这个区别很重要？

如果误以为 Deployment Protection 的 OIDC 已经等价于 Deployment API 的 OIDC，你可能会做出两种错误设计。

### 错误一：删掉 VERCEL_TOKEN 后发现 CI 根本不能部署

这是功能层面的失败。

### 错误二：为了“无密钥”自己做一个高权限代理

例如有人可能会想：

```text
GitHub OIDC
   ↓
自建 API
   ↓
服务器保存 VERCEL_TOKEN
   ↓
代替 GitHub 调 Vercel
```

这当然可以实现，但它并没有让长期 Token 消失。

只是把长期 Token 从：

```text
GitHub Secrets
```

搬到了：

```text
你的自建服务
```

如果中间代理设计不好，甚至会制造新的高权限攻击面。

所以“无密钥”不能只看 GitHub Secrets 页面是不是空了。

真正应该问的是：

> **整个系统里是否还存在长期可重放凭据？它存在哪里？谁能调用？权限多大？**

---

## 12. 第四条身份：Deployment、访问 Deployment、访问后端，必须分开

一个完整的现代 Web CI/CD，至少存在三种不同权限：

### A. Create Deployment

```text
把一个新的版本发布到 Vercel
```

### B. Access Deployment

```text
访问被 Vercel Authentication / Password Protection / Trusted IPs 保护的 Preview
```

### C. Deployment Access Backend

```text
部署后的 Function 去访问 AWS / GCP / Azure / Database
```

这三种权限经常被混在一起。

更清晰的身份架构应该是：

```text
GitHub Actions
   │
   ├── A. Deployment Auth
   │      └── 当前仍可能需要 VERCEL_TOKEN
   │
   ├── B. Preview Test Auth
   │      └── GitHub OIDC → Vercel Trusted Sources
   │
   └── CI Cloud Access
          └── GitHub OIDC → Cloud Role

Vercel Runtime
   │
   └── C. Backend Access
          └── Vercel OIDC → Cloud Role
```

把身份链路画清楚以后，很多“这个 Token 到底能不能删”的问题就会自然得到答案。

---

## 13. OIDC 不是“Secret 消失术”，而是 Trust Policy 工程

OIDC 解决了静态 Secret 的一部分问题，但它把复杂度转移到了另一个地方：

```text
Trust Policy
```

如果 Trust Policy 太宽，OIDC 一样会危险。

例如下面这种思路：

```text
所有来自 GitHub 的 OIDC Token 都允许
```

几乎没有实际安全意义。

更合理的是逐层收紧。

### 第一层：限定 Issuer

确认 Token 必须来自预期 IdP。

### 第二层：限定 Audience

避免一个为 A 服务签发的 Token 被拿去 B 服务重放。

### 第三层：限定 Repository

只允许：

```text
katelya77/my-project
```

而不是整个 GitHub。

### 第四层：限定 Ref / Environment

例如生产权限只允许：

```text
main
production
```

### 第五层：资源侧再最小权限

即使身份通过，也只给：

```text
需要的 Bucket
需要的 API
需要的 Deployment
```

而不是 Admin。

---

## 14. GitHub Environment 是生产 OIDC 设计里非常重要的一层

如果生产部署已经使用 GitHub Environment，例如：

```text
production
```

那么可以把：

```text
Environment Protection Rule
OIDC Trust Policy
Cloud IAM Role
```

组合起来。

理想链路是：

```text
Commit
  ↓
Workflow
  ↓
进入 production environment
  ↓
人工审批 / branch rule
  ↓
获得符合 production 条件的 OIDC 身份
  ↓
换取短期生产权限
```

这比单纯判断：

```text
branch == main
```

更完整。

因为“能向 main push”与“能执行生产部署”并不一定应该是同一个权限。

---

## 15. Pull Request Workflow 要特别警惕 Fork

OIDC 在 PR 场景里需要额外小心。

因为你必须考虑：

```text
这个 Workflow 的代码是谁控制的？
```

如果一个来自 Fork 的 PR 可以修改 Workflow，然后又能获得足够宽的 OIDC 身份，那么攻击者可能尝试把这个身份发给外部服务。

所以生产级设计通常需要：

- 不让不可信 PR 获得生产 Environment；
- 不让 Fork Workflow 直接拥有敏感 Role；
- Trust Policy 限制 Repository / Ref / Environment；
- 避免在高权限上下文直接执行 PR 提供的任意脚本；
- 对 `pull_request_target` 保持极高警惕。

OIDC 不会自动解决 Workflow 注入问题。

它只确保：

```text
身份是可验证的
```

至于这个“身份”是否应该被信任，仍然取决于你的 Workflow 与 Policy 设计。

---

## 16. 为什么短期 Token 仍然需要 `setSecret()`？

Vercel Trusted Sources 官方 GitHub Actions 示例里有一个很值得注意的动作：

```js
core.setSecret(token)
```

有些人会问：

> 都已经是短期 Token 了，为什么还需要隐藏？

因为：

**短期 ≠ 可以公开。**

只要 Token 在有效期内，攻击者依然可能利用它。

短期 Token 的优势在于：

```text
泄漏窗口有限
不可长期复用
无需人工轮换
可以绑定 Claims
```

但你仍然必须：

- 不打印到日志；
- 不写入 Artifact；
- 不上传 Cache；
- 不提交回仓库；
- 不通过不可信第三方步骤传播。

---

## 17. 从“Secrets 数量”转向“Credential Exposure Surface”

很多团队评估 CI 安全时会数：

```text
Repository Secrets 有多少个？
```

这不是最好的指标。

更好的指标是：

### Credential Lifetime

凭据可以活多久？

### Credential Scope

能访问多少资源？

### Issuance Scope

什么 Workflow 能获得？

### Replay Window

泄漏以后能重放多久？

### Rotation Dependency

是否依赖人工轮换？

### Human Ownership

是不是绑定某个个人账号？

### Auditability

能否从日志里看出是谁、哪个 Workflow、哪个 Environment 获得了权限？

这几个指标比“Secrets 页面有几个变量”更接近真实风险。

---

## 18. 一个 CI 凭据分级表

可以把 CI 使用的认证方式按风险简单分级：

| 方式 | 生命周期 | 可绑定任务身份 | 人工轮换 | 泄漏后长期重放 |
| --- | --- | --- | --- | --- |
| 写死在 YAML 的 Token | 长 | 弱 | 是 | 高 |
| GitHub Repository Secret 长期 Token | 长 | 弱 | 是 | 高 |
| Environment Secret 长期 Token | 长 | 中 | 是 | 高 |
| 短期服务 Token | 短 | 中 | 部分 | 中低 |
| OIDC Federation | 短 | 强 | 通常否 | 低 |

注意这张表不是说：

```text
OIDC = 绝对安全
```

它只是说明：

**在 Trust Policy 正确的前提下，OIDC 可以显著缩小凭据生命周期和重放窗口。**

---

## 19. 个人项目该不该折腾 OIDC？

如果只是一个个人博客，可能有人觉得：

> 为了一个 Token 搞这么多是不是过度工程？

可以分情况。

### 情况 A：平台原生 Git 集成已经够用

例如 Vercel / Cloudflare Pages 已经直接和 GitHub Repository 绑定，并且 Push 后自动部署。

那最好的 CI Secret 有时就是：

```text
根本不自己维护额外部署 Token
```

不要为了“CI 看起来高级”重新实现平台已经帮你完成的身份链路。

### 情况 B：GitHub Actions 需要访问 AWS / GCP / Azure

非常值得优先上 OIDC。

因为长期 Cloud Key 的爆炸半径通常明显更大。

### 情况 C：GitHub Actions 要跑 Protected Preview E2E

如果平台支持 Trusted Sources，优先考虑 OIDC，而不是再创建一个长期 Bypass Secret。

### 情况 D：GitHub Actions 必须直接调用 Vercel CLI 部署

按照当前官方能力，应继续正确管理 `VERCEL_TOKEN`，同时把它限制在合适的 GitHub Environment、最小暴露 Workflow 和可靠的 Rotation 流程里。

不要为了追求“零 Secret”而搭一个更复杂、更不透明的自建代理。

---

## 20. 推荐的迁移顺序：不要一次删光所有 Secret

如果一个仓库现在有十几个 CI Secret，我更推荐按下面顺序迁移。

### Step 1：做 Credential Inventory

列出：

```text
Secret Name
服务商
用途
Owner
权限
创建时间
过期时间
使用 Workflow
```

你会很快发现一批：

```text
没人知道用途的 Secret
```

### Step 2：优先替换 Cloud Provider Key

AWS / Azure / GCP 等支持 GitHub OIDC Federation 的场景通常收益最大。

### Step 3：替换 Automation Bypass Secret

如果 Preview E2E 可以通过 Trusted Sources + OIDC 完成，就减少长期 Bypass Secret。

### Step 4：把暂时无法 Federation 的 Token 移到 Environment

例如：

```text
production
```

并增加审批与 Branch Rule。

### Step 5：缩小 PAT / API Token 权限

不能消灭的长期 Token，也要做到：

```text
Scope 最小
Environment 隔离
定期 Rotation
Owner 清晰
```

---

## 21. 一个适合个人开发者的最小架构

假设你有：

- GitHub Repository；
- GitHub Actions；
- Vercel Preview；
- AWS S3；
- Playwright E2E。

推荐身份链路可以设计成：

```text
┌────────────────────┐
│ GitHub Actions Job │
└─────────┬──────────┘
          │
          ├──────── OIDC ────────► AWS Role
          │                         │
          │                         └── S3 最小权限
          │
          ├──────── OIDC ────────► Vercel Trusted Sources
          │                         │
          │                         └── Protected Preview
          │
          └──── VERCEL_TOKEN ────► Vercel CLI
                                    │
                                    └── Create Deployment

┌────────────────────┐
│ Vercel Function    │
└─────────┬──────────┘
          │
          └──────── OIDC ────────► Backend / Cloud Role
```

重点不是“完全没有 Token”。

重点是把长期 Token 控制在：

```text
目前没有 Federation 替代方案的最小范围
```

---

## 22. 如何做一次可复现的 OIDC 安全实验

如果你想真正理解 OIDC，而不是只复制 YAML，我建议做四组实验。

### 实验一：观察 Claims

在测试仓库中获取 OIDC Token，只解码 Payload，不把完整 Token 上传到任何地方。

观察：

```text
iss
aud
sub
repository
ref
environment
workflow
exp
```

目标不是“看看 JWT 长什么样”，而是回答：

> 我的资源服务器到底应该验证哪些 Claim？

### 实验二：故意使用错误 Branch

Trust Policy 只允许：

```text
main
```

然后从：

```text
feature/test
```

请求权限。

预期结果：

```text
认证失败
```

如果仍然成功，说明 Policy 太宽。

### 实验三：故意使用错误 Repository

创建第二个 Repository，尝试获得相同权限。

预期结果仍然应该是：

```text
拒绝
```

### 实验四：等待 Token 过期后重放

不要只测试：

```text
正常请求是否成功
```

还要测试：

```text
过期 Token 是否确定失败
```

这才真正验证了短期凭据的安全边界。

---

## 23. OIDC 的 Benchmark 不该测“速度快了多少”

这不是一个性能优化功能。

如果一定要量化，更应该统计：

### Long-lived Secrets Removed

迁移后减少多少长期 Secret。

### Maximum Credential TTL

最高权限凭据最长可以存活多久。

### Blast Radius

一个 Workflow 身份最多能访问哪些资源。

### Manual Rotation Count

一年里还需要人工轮换多少次。

### Cross-environment Isolation

Preview 身份是否可能拿到 Production 权限。

### Unauthorized Replay Test

旧 Token、其他 Repository Token、错误 Branch Token 是否都能被拒绝。

这些才是“OIDC 改造是否成功”的真正指标。

---

## 24. OIDC 与 Coding Agent 的关系其实会越来越大

这件事不只是传统 CI/CD 安全问题。

当 Coding Agent 开始自动：

- 创建 Branch；
- 提交 PR；
- 运行 CI；
- 部署 Preview；
- 执行 E2E；
- 读取 Observability；
- 自动修复；
- 甚至申请 Production 操作；

长期 Token 的问题会被进一步放大。

因为以前是：

```text
人触发自动化
```

未来越来越多是：

```text
Agent 触发自动化
```

这时最危险的设计是：

```text
Agent + 永久管理员 Token
```

更合理的设计应该是：

```text
Agent
  ↓
受控 Workflow
  ↓
可验证身份
  ↓
短期凭据
  ↓
最小权限操作
```

也就是说，OIDC、Workload Identity、Short-lived Credential 很可能会成为 Agentic Infrastructure 的基础设施，而不仅是 DevOps 的一个安全选项。

---

## 25. 最终判断：真正应该追求的不是“Zero Secret”，而是“Zero Standing Privilege”

“无密钥 CI”听起来很酷，但它不是最终目标。

因为系统永远需要某种身份与授权。

更准确的目标应该是：

> **不要让高权限长期静态地存在。**

也就是尽量接近 Zero Standing Privilege：

```text
平时没有持续存在的高权限凭据
需要时按身份签发
权限与任务绑定
时间到自动失效
```

这也是 OIDC Federation 比“把 Token 换个地方存”更有价值的原因。

对于 GitHub Actions + Vercel，当前最重要的工程认知可以压缩成四句话：

1. **GitHub Actions OIDC 可以替代很多 Cloud Provider 长期 Secret。**
2. **Vercel OIDC Federation 解决的是 Vercel Runtime / Build 向外证明身份。**
3. **Vercel Trusted Sources 可以让 GitHub Actions 用 OIDC 访问受保护 Deployment，从而减少长期 Automation Bypass Secret。**
4. **这不等于 Vercel CLI Deployment 已经全面支持 GitHub OIDC 替代 `VERCEL_TOKEN`；具体 API 的认证能力必须逐项核验。**

下一次当你在 CI 里准备新增一个 Secret 时，可以先问自己：

> 这个凭据真的需要存在 90 天，还是只需要活 10 分钟？

很多 CI/CD 安全改造，其实就从这个问题开始。

---

## 参考资料

- GitHub Docs — OpenID Connect: https://docs.github.com/en/actions/concepts/security/openid-connect
- Vercel Docs — OpenID Connect (OIDC) Federation: https://vercel.com/docs/oidc
- Vercel Docs — OIDC Federation Reference: https://vercel.com/docs/oidc/reference
- Vercel Changelog — Trusted Sources for Deployment Protection: https://vercel.com/changelog/trusted-sources-for-deployment-protection
- Vercel Docs — Deployment Protection: https://vercel.com/docs/deployment-protection
- Vercel Docs — Protection Bypass for Automation: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- Vercel Guide — How can I use GitHub Actions with Vercel?: https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
