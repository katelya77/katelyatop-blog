# 多吉云 CDN 精确自动刷新设计

## 目标

在保留现有 Cloudflare Pages Git Integration 生产部署方式的前提下，为 `blog.katelya.top` 增加一条独立、可审计、失败安全的 CDN 自动刷新链路。

目标是让 `master` 分支的新提交在 Cloudflare Pages 对应生产部署真正成功后，再调用多吉云 CDN API，仅刷新本次发布实际会变更的 URL；避免整站目录刷新破坏 `/_astro`、图片、字体等长缓存资源的命中率。

## 现状与约束

- 生产站点：`https://blog.katelya.top/`
- Cloudflare Pages 项目：`katelyatop-blog`
- 生产分支：`master`
- Cloudflare Pages 仍由其 Git Integration 自动构建与发布，不迁移部署链路。
- 现有 `.github/workflows/deploy.yml` 仅作为手动 GitHub Pages 备用流程，不承载生产部署。
- 多吉云 CDN 已接入 `blog.katelya.top`，源站为 `katelyatop-blog.pages.dev`。
- 当前 CDN 缓存策略：默认 30 分钟；`/assets` 7 天；`/pagefind` 1 天；`/_astro` 365 天。
- 当前浏览器缓存策略：`/_astro` 365 天。
- `/_astro` 为内容哈希型构建资源，不应在每次发布时主动刷新。

## 推荐架构

新增一个与现有生产部署解耦的 GitHub Actions 工作流，例如 `.github/workflows/doge-cdn-refresh.yml`。

流程：

`push master → Cloudflare Pages 自动部署 → GitHub Action 轮询 Pages API → 确认该 commit 的 production 部署成功 → 计算需要刷新的 URL → 调用多吉云 API → 输出刷新摘要`

该工作流不负责构建、不负责部署 Cloudflare Pages，也不修改现有 `deploy.yml` 的手动备用语义。

## Cloudflare Pages 部署确认

工作流触发于 `master` 的 `push`。

它必须使用当前 GitHub SHA 作为唯一部署确认依据：

1. 读取当前 `github.sha`；
2. 轮询 Cloudflare Pages 项目部署列表；
3. 只接受 `environment = production` 且部署的 `commit_hash` 与当前 SHA 完全一致的部署；
4. 只有该部署的最终状态为成功时才继续刷新 CDN；
5. 若部署明确失败，工作流失败并停止；
6. 若在最长等待时间内仍找不到该 SHA 的成功生产部署，工作流失败并停止。

不得仅通过固定 `sleep` 或“最新一次部署成功”来判断，以避免前一个 commit 的部署状态被误认为本次发布成功。

建议轮询间隔约 15 秒，最长等待约 10 分钟。

## 精确刷新策略

刷新器根据 `HEAD^..HEAD` 的 Git 变更文件生成 URL 集合，并进行去重。

### 始终刷新的聚合入口

当本次提交存在任何会改变公开站点内容、导航、布局或元数据的文件时，刷新：

- `/`
- `/archive/`
- `/rss.xml`
- `/atom.xml`

如果站点最终生成的 sitemap 文件名固定可确认，再加入对应 sitemap URL；在实现前必须从现有构建产物或配置中确认真实文件名，不凭猜测写入。

### 文章内容变化

当 `src/content/posts/**` 发生新增、修改或删除时：

- 根据文章的实际 permalink/slug 规则解析出公开 URL；
- 刷新该文章 URL；
- 同时刷新首页、归档页、RSS、Atom；
- 若删除文章，仍刷新原文章 URL，以清理 CDN 中可能存在的旧 HTML。

URL 解析必须复用项目现有 permalink 工具或同等规则，不另写一套可能漂移的 slug 算法。

### 页面与布局代码变化

当以下类型发生变化时：

- `src/pages/**`
- `src/layouts/**`
- 影响公开页面结构的 `src/components/**`
- 导航、站点配置、SEO、内容集合配置、permalink 工具等相关文件

采用保守的聚合页面刷新，并根据可静态确定的页面路径追加对应 URL。

若无法可靠从源码文件映射到单一 URL，优先刷新受影响的公开入口，而不是退化为整站目录刷新。

### Pagefind

当文章、页面、搜索相关配置或构建逻辑变化时，对 `/pagefind/` 使用目录刷新。

这是本方案中允许的少数目录刷新之一，因为 Pagefind 索引是一组构建时整体更新的关联文件，逐文件计算刷新没有明显收益。

### public 静态文件

当 `public/**` 中存在稳定 URL 的文件发生修改或删除时，刷新其对应公开 URL。

如果资源文件位于内容哈希路径，或最终构建 URL 无法从源文件稳定推导，则不做错误的“猜测刷新”。

### 明确不刷新

- `/_astro/**`：不刷新，继续使用 365 天 CDN 与浏览器缓存；新构建生成新的内容哈希 URL，自然绕开旧缓存。
- 未发生变化的 `/assets/**`：不做目录刷新。
- 测试、文档、CI 配置等不会改变公开站点输出的文件：不刷新站点内容。

## 多吉云 API 调用

使用多吉云官方 API，并在服务端工作流中完成 AccessKey/SecretKey 签名。

刷新请求分为两类：

- URL 精确刷新：用于首页、文章页、归档、RSS、Atom、稳定静态文件等；
- 目录刷新：仅用于 `/pagefind/` 等构建后整体更新且难以逐文件枚举的目录。

一次工作流内必须：

- 去重 URL；
- 过滤非 `https://blog.katelya.top/` 范围的 URL；
- 不向日志输出 SecretKey；
- 在 API 返回非成功状态时令工作流失败；
- 输出可读的刷新数量与路径摘要。

## 密钥与权限

GitHub Secrets：

- `CF_API_TOKEN`：Cloudflare API Token，仅授予读取 Pages 项目/部署所需的最小权限。
- `DOGE_ACCESS_KEY`：多吉云 AccessKey。
- `DOGE_SECRET_KEY`：多吉云 SecretKey。

GitHub Variables：

- `CF_ACCOUNT_ID`
- `CF_PAGES_PROJECT = katelyatop-blog`
- `SITE_URL = https://blog.katelya.top`

密钥不得写入仓库、前端构建变量、提交历史、Action 输出或调试日志。

## 失败安全

- Cloudflare Pages 未成功：不刷新多吉云。
- Cloudflare API 请求失败：重试有限次数，最终失败则不刷新多吉云。
- 多吉云 API 调用失败：工作流标红，但不得修改现有 DNS、CDN 配置或 Cloudflare Pages 部署。
- URL 映射无法确认：跳过该不确定 URL，并对已知受影响的聚合入口进行刷新；日志中给出警告。
- 首次启用时提供 `workflow_dispatch` 手动触发能力，便于在不提交新文章的情况下验证整条链路。

## 实现边界

本次不做：

- 不迁移 Cloudflare Pages 到 GitHub Actions 部署；
- 不修改多吉云现有缓存 TTL；
- 不自动刷新整个 `https://blog.katelya.top/` 目录；
- 不刷新 `/_astro`；
- 不把多吉云密钥暴露给浏览器或 Cloudflare Pages 前端环境；
- 不引入第三方收费 Action 作为核心依赖。

## 测试与验收

实现后至少验证：

1. 工作流能识别当前 GitHub SHA 对应的 Cloudflare Pages production 部署；
2. Pages 尚未完成时不会提前刷新；
3. Pages 失败时多吉云刷新步骤不会执行；
4. 修改单篇文章时仅刷新文章 URL + 聚合入口 + `/pagefind/`；
5. 纯文档/测试变更不会触发无意义的站点刷新；
6. `/_astro` 永远不进入刷新列表；
7. 多吉云 API 请求成功后，Action 日志显示刷新摘要但不泄露任何密钥；
8. 刷新后的目标页面首次请求可出现 MISS，随后请求恢复 HIT；
9. 生产站仍保持现有 Cloudflare Pages 自动部署与多吉云 CNAME 架构不变。
