---
title: "Cloudflare cf 1.0 RC 的真正变化：从构建产物到脚本契约的迁移验收"
published: 2026-11-18
category: "DevOps"
tags: ["Cloudflare","cf","Workers","CLI","持续交付","可观测性"]
draft: false
pinned: false
comment: true
description: "Cloudflare 官方发布的 cf 1.0.0-rc.1 不只是一次命令行改名：Build Output 进入 v1、标准输出与错误输出重新分工、账户选择不再跨运行保存，都会影响 CI/CD 和自动化脚本。本文基于官方 Changelog 与仓库变更，给出升级前后的契约检查、可复现验证方法、失败边界与工程取舍。"
image: "https://developers.cloudflare.com/changelog/post/2026-11-17-release-candidate/og.png?v=311ef22495f459c1"
---

## 先把它当作契约迁移，而不是版本升级

Cloudflare 在 2026 年 11 月 17 日发布了 `cf` 1.0.0-rc.1。这是 1.0 的 release candidate，不是最终稳定版；官方说法是欢迎在自己的项目中尝试并反馈。这个证据等级很重要：它足以支持升级评估和兼容性测试，但不应被写成“1.0 已正式发布”。

这次变化的密度，来自它同时改动了三个层面：项目构建产物的位置与格式、命令行输出的流向、脚本调用和账户上下文的默认行为。单看安装命令，像是把全局包更新到最新版本；放进流水线后，它更接近一次工具链契约迁移。旧脚本即使仍能启动，也可能在读取输出、寻找构建目录或选择账户时得到不同结果。

因此，升级目标不应是“命令返回 0”，而应是确认四个契约：构建结果在哪里、部署读取什么、机器如何选择账户、脚本从哪个文件描述符消费数据。只有这四项都通过，才有理由把 RC 放进候选环境。

## 构建产物 v1：部署链路的边界发生了变化

官方说明，RC 将 Build Output 移到 `.cloudflare/output/v1/`，并且 `cf deploy` 首次运行时会自动在这个位置创建新的构建结果。稳定范围包括 `cf build` 写入的 Build Output 格式，以及 `cf deploy` 读取的格式；这意味着构建和部署不再只是两个松散命令，而是共享一个明确版本化的中间产物契约。

这个设计解决的是一个常见问题：构建工具和部署工具各自升级时，双方对产物目录、元数据或入口文件的理解可能漂移。将输出放入 `v1`，至少让目录名承担了协议版本的作用。工程上可以据此把“能生成文件”和“部署读取了正确版本”拆成两个检查点。

升级前可以在一个临时副本中执行：

```bash
npm install --global cf@latest
cf --version
cf build
find .cloudflare/output/v1 -maxdepth 2 -type f -print
cf deploy --help
```

这里的重点不是 `find` 的具体文件名，而是确认构建确实产生了 `v1` 目录，并核对后续部署命令是否仍指向同一项目。不要把旧的 `.cloudflare/output` 目录是否存在当成成功标准：旧目录残留可能只是工作区历史文件，不能证明当前部署使用了它。

对 Vite 项目还要检查依赖边界。官方要求 `@cloudflare/vite-plugin` 使用 `2.0.0-rc.0` 或更高版本；旧的 Vite 插件可能仍能完成部分构建，却不一定能生成 RC 期待的 Build Output。对遗留 Wrangler 构建项目，要求是 Wrangler `4.163.0` 或更高版本。这里的取舍很明确：先升级与构建格式直接耦合的插件，再升级全局 CLI，比只替换全局二进制更容易定位问题。

## stdout 与 stderr：自动化脚本最容易漏掉的破坏性变化

RC 还重新定义了输出流：提示、进度和状态消息写入 stderr，stdout 只保留命令输出。对交互式终端来说，这让机器可读结果更干净；对旧脚本来说，却可能造成“命令成功但日志消失”或“解析器读不到原来的内容”。官方特别指出，原先从 stdout 读取提示信息的脚本需要改为读取 stderr。

可以用一个最小检查确认脚本的假设，而不是凭肉眼看终端：

```bash
set -o pipefail
cf --help > /tmp/cf.stdout 2> /tmp/cf.stderr
printf 'stdout bytes: '
printf '%s' "$(wc -c < /tmp/cf.stdout)"
printf 'stderr bytes: '
printf '%s' "$(wc -c < /tmp/cf.stderr)"
```

验证时应回答三个问题：脚本要消费的是数据还是提示；数据是否仍然只出现在 stdout；错误是否能够单独收集并触发失败。不要简单地把 `2>&1` 永久加入所有流水线。合并两个流虽然能保留日志，却会破坏“stdout 是机器输出、stderr 是诊断信息”的新边界，也可能把进度文字混入 JSON、表格或后续命令的输入。

更稳妥的模式是分别保存两个流：

```bash
if ! cf build >build.out 2>build.log; then
  cat build.log >&2
  exit 1
fi
cat build.log >&2
```

这段模式只表达一个工程原则：数据流和诊断流分开保存，失败时再把诊断流显式输出。若某个命令的 stdout 本来就不是稳定机器接口，则不要擅自编写解析器；应先查该命令的官方输出契约，或把它降级为人工观察步骤。

## 账户选择不再跨运行保存：隐式状态必须显式化

RC 不再保存每次运行选择的账户。官方给出的替代方式是，在 `cloudflare.config.ts` 中设置 `accountId`，或者通过 `CLOUDFLARE_ACCOUNT_ID` 提供账户 ID，以跳过账户选择提示。

这不是单纯的登录体验变化，而是把本地隐式状态移出了部署流程。过去某台机器“默认选中了哪个账户”可能依赖此前的交互；现在如果项目没有配置账户，非交互环境可能停在提示处，或者无法按预期完成命令。对于共享 runner、容器和临时工作区，这种变化反而更安全：部署目标不再依赖机器上一次留下的选择。

推荐把账户检查放在部署前：

```bash
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
cf build
cf deploy
```

如果项目采用配置文件，也应把账户选择写成项目级配置，而不是依靠操作者记忆。这里的边界是：账户 ID 可以作为配置值，但认证凭据不能因此写进仓库。材料只证明了账户选择的配置入口，并没有证明任何具体认证方式或凭据生命周期，所以不能把 RC 的账户配置误写成完整的身份治理方案。

## 命令重命名与生成式 API：不要把命令路径当成永久 API

`cf` 的大量命令由 Cloudflare API schema 生成。官方说明，大多数 beta 阶段生成命令预计保持稳定，但少量不常用的 API 命令在 1.0 前仍可能变化。RC 已经包含没有别名的命令重命名，例如 `cf workers secrets bulk` 改为 `cf workers secrets bulk-edit`。

这揭示了一个重要边界：CLI 的版本稳定，不等于每条生成命令的路径都已经永久冻结。部署脚本如果直接散落几十个命令字符串，升级时很难区分是项目逻辑错误、命令重命名还是 API schema 变化。

可以先做一份调用面清单：

```bash
grep -RhoE 'cf ([a-z0-9-]+[[:space:]]*)+' .github scripts 2>/dev/null \
  | sort -u
```

然后逐条执行对应的 `--help` 检查，并特别搜索 secrets、deploy、versions、preview 等高影响路径。不要只检查主部署命令；发布前后的密钥操作、版本创建和预览部署同样属于升级面。对不常用的生成式命令，最合理的取舍是把调用集中在少量脚本中，并在脚本开头固定 CLI 版本，而不是让每次运行都隐式跟随 `latest`。

## 可观测性 tail：新能力也要先定义消费边界

RC 带来了 `cf observability tail`，官方仓库变更说明它可以流式输出可观测事件，并支持 `--all`、`--worker`、`--zone` 与过滤条件。输出形式是 newline-delimited JSON，这比面向人的多行日志更适合管道处理，但“能输出 JSON”不代表下游可以无条件依赖所有字段。

一个安全的验证顺序是先限制范围，再确认格式：

```bash
cf observability tail --worker <worker-name> \
  | while IFS= read -r line; do
      printf '%s\n' "$line" | jq -e . >/dev/null || exit 1
    done
```

材料证明了该命令和 NDJSON 方向，但没有给出每类事件的完整字段保证。因此，解析器应围绕项目真正需要的字段编写，并对未知字段保持容忍；不要把当前事件结构复制成严格的永久 schema。若需要把 tail 接入告警系统，应额外验证断线、空流、权限不足和事件类型变化，而不能仅凭一次成功启动就宣称监控链路可靠。

## 破坏性命令的非终端保护：安全默认值不等于审批流程

官方还说明，破坏性命令在没有终端的情况下会直接报错，除非显式传入 `--force`。这是一项针对自动化环境的保护：CI 没有交互式确认，工具不会因为脚本无人值守就默认执行高风险动作。

但 `--force` 只是绕过交互保护，不是变更审批、备份、回滚或权限控制。流水线不应把它当成“让命令稳定通过”的通用参数。正确做法是先识别命令是否会删除、覆盖或改变远端资源，再把 `--force` 放在经过审核的专用步骤中，并让执行前检查明确记录目标账户、项目和版本。

## 一份适合 RC 的升级验收清单

最后可以把升级拆成四轮，而不是一次性替换生产环境：

1. **安装轮**：确认 `cf` 版本、项目所需的 Vite 插件或 Wrangler 版本，以及 Node.js 运行时是否落在官方支持范围内。材料只说明支持最新的 Node.js LTS 和最新 active release，不应据此推导更老版本也一定兼容。
2. **构建轮**：确认 `.cloudflare/output/v1/` 生成，构建日志与机器输出分离，且部署步骤没有继续依赖旧目录或旧 stdout 行为。
3. **脚本轮**：扫描仓库中的 `cf` 调用，验证 secrets、preview、versions 和部署命令；为账户 ID 设置显式来源，避免依赖本机历史状态。
4. **回退轮**：保留旧版本 CLI 与构建环境的可复现入口，在 RC 的命令重命名、输出格式或生成式 API 变化导致失败时，能够回到上一套工具链，而不是现场修改生产脚本。

Cloudflare `cf` 1.0.0-rc.1 最值得关注的，不是命令数量增加了多少，而是它把若干过去隐含的假设变成了显式契约：产物有版本目录，stdout 有机器边界，账户有配置入口，破坏性动作有非终端保护。我的结论是，RC 的升级验收应优先围绕“脚本依赖了哪些隐式状态”展开；只要这些依赖没有被列出来，绿色的构建和一次成功部署都不足以证明迁移完成。

## 参考资料

- [Workers, Cloudflare CLI - Cloudflare CLI (cf) 1.0 release candidate](https://developers.cloudflare.com/changelog/post/2026-11-17-release-candidate/)
- [github.com](https://github.com/cloudflare/cf/blob/main/packages/cli/CHANGELOG.md)
