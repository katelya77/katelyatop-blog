# Katelya 技术博客自动编辑与贡献归属

本仓库的自动发布目标是**每天持续写出有来源、有工程价值的原创文章**，而不是制造无内容的 Git Commit 或替第三方文章做机械洗稿。

## 来源与核验

- 社区选题雷达：LINUX DO、NodeLoc。论坛帖子只能说明社区讨论、实际疑问与工程场景；不能把社区传闻直接描述为厂商发布。
- 第一手工程资讯：GitHub Changelog、Cloudflare Changelog/Blog，以及 Codex、Claude Code、Qwen Code、Qwen3、Ollama、llama.cpp、vLLM、SGLang、Astro、Bun、Cloudflare Workers SDK 等官方 Release。
- GitHub 上原项目的 Release/README，以及厂商官方文档，是核验版本与行为的重要材料。社区帖子里的任意第三方推广页或转载站不自动升级为一手证据。
- 来源提取使用**分组轮询**，让同次研究尽可能覆盖多个上游项目；对文章进行标题去重、证据组复用检测、工程可验证性检查。
- 抓取某个站点遇到 403/429 或缺少 RSS 时，隔离失败源；不得规避访问限制或因为单个站点失败而整套停更。
- 只提取与研究有关的事实和短摘录，文章应重新建立结构并注明参考链接。不虚构实测、发布日期、模型规格或开源状态。

## 发布、补偿和贡献统计

本仓库在 Asia/Shanghai 的 09:17、14:33、18:27、23:37 四个窗口运行。09:17/14:33 目标至少 1 篇，18:27/23:37 目标至少 2 篇（同日已发布的非草稿文章会先统计，避免重复发文）。

GitHub Actions 的定时计划可能延迟或丢失，因此这不是对第三方平台 SLA 的保证。失败会触发仓库的故障 Issue；应根据失败记录排查并重新运行相应 Workflow。

**文章发布时间（北京时间）**和**GitHub 贡献日（UTC）**可能不同。例如北京时间 10 月 27 日 00:40 的 Commit，其 UTC 作者日期还是 10 月 26 日。发布器因此还会检查：当前 UTC 日期是否已经有一条真实的、归属于仓库所有者的内容 Commit。如果没有且当天文章数尚未达到安全上限，则基于新的合格资料写出一篇真实文章；资料质量不够时宁可留下失败证据，也不制造空 Commit、重复文章或伪造历史日期。

目前 Actions 仅在生成并通过 Biome、Tests、Astro Check、Build 之后，才会做防并发 SHA 校验并发布到 `master`。生产端仍须核实 Cloudflare Pages 对应提交部署成功、DogeCloud 缓存刷新成功且公网文章实际可见。

GitHub Contributions 的基本条件包括：

- Git 作者邮箱确实关联到 `katelya77` 账号（仓库已使用 GitHub 提供的 `123220557+katelya77@users.noreply.github.com`）；
- Commit 最终进入本仓库的默认分支 `master`；
- GitHub 会以作者日期和自身贡献计数规则显示结果，可能延迟更新。自动 Bot 写出的文章仍应明确保留机器生成来源，不应将其描述为用户本人亲手写出的工作。

官方规则：https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference

## 人工核验入口

- [内容自动发布 Workflow](../.github/workflows/content-publisher.yml)
- [来源发现代码](../scripts/content-automation/sources.mjs)
- [文章质量门槛](../scripts/content-automation/quality.mjs)
- [UTC 贡献判断](../scripts/content-automation/contributions.mjs)
- [Actions 历史记录](https://github.com/katelya77/katelyatop-blog/actions/workflows/content-publisher.yml)
- [提交历史](https://github.com/katelya77/katelyatop-blog/commits/master/)
