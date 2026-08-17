---
title: CI 全绿，文章为什么还是没上线？一次 GitHub Actions → Cloudflare Pages → CDN 发布事故复盘
author: Katelya
published: 2026-08-17
category: DevOps
tags: [GitHub Actions, CI/CD, Cloudflare Pages, CDN, DevOps, 故障复盘]
draft: false
pinned: false
comment: true
description: 一次真实的博客发布事故：PR 的五项 CI 全绿，但文章仍没有出现在生产站。本文从 Git 分支、合并、Cloudflare Pages 生产部署到 CDN 刷新逐层追踪，解释为什么“CI 通过”从来不等于“已经上线”。
---

8 月 17 日，我遇到了一次很典型、也很容易误判的发布问题：

**新文章已经写完，Pull Request 的测试也全部通过，但生产博客首页就是看不到它。**

第一反应很容易落到缓存上：

- 是不是浏览器缓存？
- 是不是 Cloudflare Pages 还没更新？
- 是不是 CDN 没刷新？
- 要不要先 `Ctrl + F5`？
- 要不要直接清缓存？

但最后的根因比这些都简单：

> **PR #40 的 CI 的确全绿了，但 PR 当时仍然是 Open，没有 merge 进 `master`。**

也就是说，代码只是被证明“可以合并”，却还没有真正进入生产分支。

这次事故让我重新把博客发布流程拆成了一条状态机。它看起来只是一个小疏忽，但背后其实对应着 CI/CD 中一个很重要的原则：

**Validated ≠ Integrated ≠ Deployed ≠ Served。**

## 先把事故时间线还原出来

这次出问题的是 8 月 17 日的 Gemini 3.7 Flash 文章，对应 GitHub PR #40。

GitHub 记录里的关键时间如下（北京时间）：

| 事件 | 时间 |
| --- | --- |
| PR #40 创建 | 09:01:37 |
| 最后一项 Playwright E2E 完成，整套 CI 全绿 | 09:14:32 |
| PR 真正 merge 到 `master` | 13:43:40 |

中间有大约 **4 小时 29 分钟**。

这 4 个多小时里发生了一件很有迷惑性的事情：

```text
文章文件存在        ✅
PR 存在             ✅
Biome               ✅
Tests               ✅
Type Check          ✅
Build               ✅
Playwright E2E      ✅
生产 master 有文章   ❌
```

如果只看 GitHub Actions 页面，很容易产生“已经通过了，应该上线了”的错觉。

但 GitHub Actions 的绿色勾，只能证明工作流定义的那些检查成功执行。

它并不会自动替你完成一个没有配置自动合并的 Pull Request。

## CI 到底证明了什么？

我的博客 PR 工作流目前有五个 Job：

```text
Biome Check
Tests
Type Check
Build
Playwright E2E
```

其中包括：

- Biome 做代码与格式检查；
- Node 测试跑已有回归；
- Astro Check 检查内容与类型；
- Production Build 验证站点能完整构建；
- Playwright 用真实浏览器跑 UI 回归。

这套检查很有价值。

如果它们全部通过，我们可以得到一个相当强的结论：

> **“这一个 PR 对应的提交，在当前 CI 环境中满足了仓库定义的合并前质量门槛。”**

但这句话里有一个非常关键的词：

**合并前。**

GitHub 官方对 Status Checks 的描述也是类似的：状态检查用于判断提交是否满足仓库条件、帮助维护者判断 PR 是否已经 ready to merge；如果分支规则要求某些检查，它们需要通过之后 PR 才能合并。

所以：

```text
CI = 验证器
```

而不是：

```text
CI = 自动发布按钮
```

除非你另外配置了 Auto-merge、Merge Queue、部署 Action，或者其他自动化机制。

## Pull Request 也是一个独立状态

Git 的分支模型决定了：

```text
content/gemini-37-flash-2026-08-17
```

和：

```text
master
```

是两条不同的引用。

文章即使已经存在于 content branch，只要没有发生 merge，`master` 指向的提交树就不会凭空发生变化。

这就是这次问题的真正断点：

```text
content branch
      ↓
Pull Request
      ↓
五项 CI 全绿
      ↓
  [停在这里]
      ✕
merge → master
```

当时不是构建失败，也不是部署失败。

**部署链根本还没有获得新的生产提交。**

所以从系统视角看，后面的 Cloudflare、DogeCloud、浏览器缓存全都没有做错任何事。

它们只是在忠实地继续提供旧的 `master`。

## 为什么 Cloudflare Pages 也救不了这个问题？

这个博客使用 Cloudflare Pages Git Integration。

Cloudflare Pages 会区分 **Production branch** 和其他 Preview branch。官方文档也明确说明：生产分支用于生产版本，其余分支通常用于 Preview Deployment。

我的仓库生产源是 `master`。

因此逻辑可以简化成：

```text
push 到普通内容分支
    ↓
可以产生 Preview
    ↓
不会替换生产 master

merge / push 到 master
    ↓
Cloudflare Pages Production Build
    ↓
生产站更新
```

于是，当 PR #40 没有 merge 时，即使内容分支上的文件完全正确，生产域名也没有理由切换到那一个 commit。

这也是为什么“Preview 能打开”与“生产已经上线”是两个完全不同的事实。

## 我的真实发布链其实比想象中还多一层

现在这个博客真正的生产链不是简单的：

```text
GitHub → Cloudflare
```

而更接近：

```text
Content Branch
      ↓
Pull Request
      ↓
GitHub Actions
      ↓
Squash Merge
      ↓
master
      ↓
Cloudflare Pages Production Deployment
      ↓
确认 production deployment 的 commit SHA
      ↓
DogeCloud CDN 精确刷新
      ↓
用户访问 blog.katelya.top
```

仓库里还有一条 `Refresh DogeCloud CDN` 工作流。

它只监听：

```yaml
on:
  push:
    branches: [master]
```

也就是说，如果 PR 还没 merge：

**连 CDN 刷新工作流本身都不会因为这个 PR 而进入生产刷新阶段。**

这比“刷新失败”更靠前——根本没有生产 `push` 事件。

## 我为什么没有简单地“merge 后直接清 CDN”

这里还有一个容易踩的坑。

假设一 merge 就立刻提交 CDN purge，但 Cloudflare Pages 还在构建新版本，会发生什么？

可能出现这种竞态：

```text
master 更新
   ↓
CDN 立刻刷新
   ↓
CDN 回源
   ↓
Cloudflare Pages 生产版本仍然是旧提交
   ↓
旧内容重新进入边缘缓存
   ↓
几秒后 Pages 才完成新部署
```

这会产生非常难排查的“我明明 purge 过了，为什么还是旧页面”。

所以我现在的刷新脚本没有简单 sleep 几秒，而是会查询 Cloudflare Pages Deployment API。

只有找到同时满足下面两个条件的部署：

```text
environment == production
commit_hash == 当前 GITHUB_SHA
```

并且：

```text
latest_stage.status == success
```

才继续提交 DogeCloud 刷新任务。

换句话说，CDN 刷新前有一道 commit-level barrier：

```text
GitHub merge SHA
       ==
Cloudflare Production SHA
```

这个设计比“等 30 秒然后 purge”稳很多，因为等待时间不是事实，**提交一致性才是事实**。

## 一次发布至少有六种不同的“成功”

这次之后，我更愿意把静态站发布拆成下面六个状态。

### 1. Content Ready

文章已经存在于功能分支。

```text
CONTENT_READY
```

它只能说明内容已经写出来。

### 2. Validated

CI 全绿。

```text
CONTENT_READY
    ↓
VALIDATED
```

它说明仓库定义的质量检查通过。

### 3. Integrated

PR 已经进入生产分支。

```text
VALIDATED
    ↓
INTEGRATED
```

对这个博客来说，就是：

```text
master
```

已经包含目标文章。

### 4. Origin Deployed

Cloudflare Pages 已完成与这个 merge commit 对应的 production deployment。

```text
INTEGRATED
    ↓
ORIGIN_DEPLOYED
```

这一步才说明源站版本真的发生了切换。

### 5. Edge Refreshed

DogeCloud CDN 已针对本次变化完成必要刷新。

```text
ORIGIN_DEPLOYED
    ↓
EDGE_REFRESHED
```

### 6. User Visible

最后还要真正通过公开 URL 验证。

```text
EDGE_REFRESHED
    ↓
USER_VISIBLE
```

所以一个更完整的生产状态机是：

```text
CONTENT_READY
      ↓
VALIDATED
      ↓
INTEGRATED
      ↓
ORIGIN_DEPLOYED
      ↓
EDGE_REFRESHED
      ↓
USER_VISIBLE
```

这六个状态不能互相替代。

尤其是：

```text
VALIDATED != USER_VISIBLE
```

正是本次事故最核心的结论。

## 为什么 `Ctrl + F5` 当时注定无效？

浏览器强制刷新能解决的是最末端的问题。

比如：

```text
生产源站已经是新版本
CDN 也已经是新版本
只有本地浏览器仍然缓存旧资源
```

此时强刷有意义。

但这次实际情况是：

```text
master 仍然没有新文章
```

那么从源头开始就是旧状态：

```text
浏览器
  ↓
CDN
  ↓
Cloudflare Pages Production
  ↓
master
  ↓
旧提交
```

你无论刷新多少次，都只是在更加努力地请求一个本来就没有新文章的生产版本。

这也是排障时非常值得坚持的一点：

> **从 source of truth 往外查，而不是从浏览器往里猜。**

## 我现在会怎样确认一篇文章真的上线了？

以后再遇到类似发布，我不会只看一个绿色勾。

第一层先看 PR：

```bash
gh pr view 40 \
  --json state,mergedAt,mergeCommit,statusCheckRollup
```

需要同时确认：

```text
checks = success
state = MERGED
mergedAt != null
mergeCommit != null
```

第二层确认生产分支真的包含文件：

```bash
git fetch origin master

git show \
  origin/master:src/content/posts/gemini-37-flash-agent-coding.md \
  | head -n 20
```

这里能直接回答最重要的问题：

> “生产 Git 源头到底有没有这篇文章？”

第三层再检查部署：

```text
Cloudflare Pages production deployment
commit == merge commit
status == success
```

第四层才检查 CDN 刷新任务。

最后，再访问公开站点确认文章进入列表和正文路由。

## 一个更实用的发布核对表

我现在会把上线判断写成下面这种布尔条件：

```text
Published =
    CI_Green
 && PR_Merged
 && Master_Contains_Content
 && Pages_Production_SHA_Matches
 && Pages_Production_Success
 && CDN_Refresh_OK
 && Public_URL_Visible
```

少任何一项，都不应该轻易说“已经发布”。

如果想让它更像机器可执行的状态：

```js
const published =
  checksPassed &&
  prMerged &&
  masterContainsPost &&
  pagesCommit === mergeCommit &&
  pagesStatus === "success" &&
  cdnReady &&
  publicSmokeTestPassed;
```

这里最重要的不是 JavaScript。

而是把模糊的“应该上线了”变成一组可观测条件。

## CI/CD 里的 C 和 D，真的不是同一件事

CI，Continuous Integration，关注的是：

- 新改动能不能与代码库安全整合；
- 测试是否通过；
- 构建是否成功；
- 是否满足合并门槛。

CD 则更接近：

- 什么提交进入哪个环境；
- 什么时候部署；
- 发布目标是否成功；
- 流量现在到底服务哪个版本；
- 失败如何回滚。

实际工程里，这两部分可以由同一个平台实现，也可以完全分开。

我的博客就是一个很直观的例子：

```text
GitHub Actions
负责主要的验证

GitHub Merge
负责集成到 master

Cloudflare Pages
负责生产构建和部署

DogeCloud Workflow
负责边缘缓存刷新
```

一个界面上的绿色状态，很难代表整个跨平台链路。

## 这次事故之后，我反而更喜欢“分层”

看起来发布环节多了，好像复杂。

但层与层之间只要有明确的不变量，系统反而更容易排查。

比如：

```text
PR 层的不变量：
五项检查必须全绿

Git 层的不变量：
生产文章必须存在于 master

Pages 层的不变量：
production commit 必须等于 merge SHA

CDN 层的不变量：
只有 origin ready 后才能刷新

用户层的不变量：
最终 URL 必须可见
```

以后如果文章没出现，只需要问：

```text
第一个不满足的不变量在哪里？
```

而不是一上来同时怀疑 GitHub、Cloudflare、CDN、浏览器、DNS。

这其实就是我越来越喜欢的一种工程排障方式：

**不要从症状随机试修复，而要沿状态转移逐层寻找第一个断点。**

## 还可以进一步自动化什么？

这次最直接的改进方向其实不是“让缓存刷新得更猛”，而是让发布状态更机器化。

例如后续可以考虑：

1. CI 全绿后，如果满足策略，启用 Auto-merge；
2. merge 后记录唯一 production SHA；
3. Pages Deployment API 必须确认同 SHA 成功；
4. CDN 刷新完成后执行站点 smoke test；
5. smoke test 检查目标文章 URL 是否返回 200；
6. 再检查首页 / RSS / Sitemap 是否包含目标文章；
7. 最后才把发布任务标记为完成。

最终发布流水线更像：

```text
VALIDATE
   ↓
MERGE
   ↓
DEPLOY
   ↓
REFRESH
   ↓
VERIFY
```

而不是：

```text
跑完 CI
   ↓
感觉应该好了
```

## 结语

这次没有什么复杂的框架 Bug。

没有 Cloudflare 神秘缓存。

也没有 Astro 排序失效。

真正的问题只是：

**我把“代码已经通过检查”误认为了“代码已经进入生产”。**

但也正因为问题简单，它特别值得记录。

随着部署链从一个 Git 仓库扩展到 GitHub Actions、Cloudflare Pages、CDN、DNS 和客户端缓存，“上线”已经不再是一个动作，而是一系列状态迁移。

所以以后当我再看到：

```text
✅ Build
✅ Tests
✅ Type Check
✅ Biome
✅ Playwright
```

我不会直接说：

> “发布成功。”

我会继续问：

```text
Merge 了吗？
Production SHA 对吗？
源站部署完成了吗？
CDN 刷了吗？
公开 URL 真能看到吗？
```

**CI 全绿是一张合格证，不是一张生产环境的到货签收单。**

---

### 参考资料

- [GitHub Docs — Status checks](https://docs.github.com/en/pull-requests/reference/status-checks)
- [GitHub Docs — Merging a pull request](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-a-pull-request)
- [Cloudflare Pages — Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages — Branch deployment controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)
- [Cloudflare Pages — Preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [katelyatop-blog PR #40](https://github.com/katelya77/katelyatop-blog/pull/40)
- [katelyatop-blog GitHub Actions workflow](https://github.com/katelya77/katelyatop-blog/blob/master/.github/workflows/lint.yml)
- [katelyatop-blog DogeCloud CDN refresh workflow](https://github.com/katelya77/katelyatop-blog/blob/master/.github/workflows/doge-cdn-refresh.yml)
- [katelyatop-blog Cloudflare deployment barrier](https://github.com/katelya77/katelyatop-blog/blob/master/scripts/cdn-refresh/cloudflare-pages.mjs)
