# GitHub 主页贡献日历：官方 GraphQL 数据管线

页面 `/github/` 的贡献热力图使用 GitHub GraphQL `user.contributionsCollection.contributionCalendar`，不再从 `/users/:login/events/public` 推算贡献。

## 数据边界

- 数据来自官方 `contributionCalendar.weeks.contributionDays`，包含每一天的 `contributionCount` 和 `contributionLevel`，并包含 GitHub 返回的总贡献、Commits、PRs、Issues、Reviews、Repositories 汇总。
- 最近公开事件仍使用 REST Public Events API，但只出现在底部“开发动态”中；不与 GitHub 贡献日历相加。
- 保存的快照只包含日期、贡献级别、汇总计数与刷新时间；不保存 Token、私有仓库名、提交内容或账户邮件。
- 日历第一周/最后一周的区间外日期显示“未知”，不计为 0。API 缺失或数据异常时不发布错误快照。
- **公开 GitHub 数据与登录用户看到的私有贡献可能有差异**，视凭据权限和 GitHub 个人资料可见性而定；不能用事件接口“补齐”缺失的贡献。

## 刷新流程

`.github/workflows/github-contributions.yml` 每天执行一次，也可通过 GitHub Actions → **Refresh official GitHub contribution calendar** → Run workflow 手动触发。工作流使用 GitHub Actions 自动提供的 `github.token` 向官方 GraphQL API 发请求，验证返回的日期覆盖，再写入 `src/data/github-contributions.json` 并正常提交到 `master`。Cloudflare Pages Git 集成会重新构建部署。

前端仅导入已经发布的数据 JSON，不向浏览器发送 Token，也不让所有访问者实时请求 GitHub。页面可切换“过去一年”和最近四个自然年，显示年份内的真实每日贡献数。第一次部署且快照尚未同步时，会显示明确的“尚未同步”，而不是把随机活动样本伪装成贡献。

如仓库管理员更改 GitHub 用户名，可更新工作流中的 `GITHUB_CONTRIBUTIONS_LOGIN`，并在页面公开资料配置中同步修改用户名。

失败时查看 Actions 日志。不要为使页面变绿而手工编造贡献统计，或在仓库、前端和日志中放入个人访问令牌。

官方字段：[GitHub GraphQL ContributionsCollection](https://docs.github.com/en/graphql/reference/users#contributionscollection)。
