---
title: "Azure DevOps 迁移到 GitHub 不能只看仓库：Enterprise Live Migrations 的双写、切换与验收边界"
published: 2026-11-20
category: "DevOps"
tags: ["GitHub","Azure DevOps","迁移","DevOps","数据一致性","发布治理"]
draft: false
pinned: false
comment: true
description: "GitHub 宣布 Enterprise Live Migrations from Azure DevOps 正式可用。真正困难的不是把 Git 仓库复制过去，而是在持续同步、历史对象迁移、分支规则重建和切换窗口之间建立可验证的交付链。本文从迁移架构、验收命令、失败边界与回退取舍出发，给出一套不依赖“迁移成功”提示的工程检查方法。"
image: "https://github.blog/wp-content/uploads/2026/11/709597788-56442ed7-1e51-467b-85b7-14473da23784.png"
---

## 先把“迁移完成”拆成三个不同问题

Git 仓库迁移经常被描述成一个动作：选择源项目，启动任务，等待目标仓库出现，然后通知团队切换地址。但 Enterprise Live Migrations（ELM）从 Azure DevOps Services 迁移到 GitHub Enterprise Cloud 的官方说明，实际上揭示了三个不同层次的问题：数据是否已经复制、源端的新变化是否还会同步、团队是否已经能够安全地把工作切到目标端。

GitHub 在 2026 年 11 月 19 日的 Changelog 中将该能力标记为 generally available，也就是正式可用，而不是预览功能。官方描述包括迁移前验证、生命周期跟踪、持续同步、按计划切换，以及 Git 历史、分支、标签和拉取请求等对象的迁移。它还提到，Azure DevOps 的分支策略可以迁移为 GitHub 的 branch rulesets，并可继续使用 Azure Boards 和 Azure Pipelines。

这组能力不等于“源端和目标端天然完全相同”。它更接近一个有持续同步阶段的迁移编排器：先建立目标状态，再处理迁移期间的变化，最后在一个可控窗口执行切换。工程验收的对象因此不应只是迁移任务状态，而应是以下三个结论是否分别成立：

1. 目标端拥有足够完整的代码与协作历史。
2. 切换前产生的变更不会因为迁移窗口而丢失。
3. 切换后，权限、规则、流水线和团队工作方式仍然符合预期。

这也是本文的证据边界：关于 ELM 的能力与发布状态，以 GitHub 官方 Changelog 为准；材料没有给出具体 CLI 子命令、API 字段、配额或耗时，因此不把这些内容写成确定事实。

## ELM 的核心不是复制，而是“同步后切换”

传统离线迁移的模型是“冻结源端—导出—导入—验证—开放目标端”。它的优点是状态简单，缺点是冻结时间会随仓库数量、历史规模和团队协作复杂度增长。ELM 官方描述的连续同步，则把迁移窗口拆开：团队可以继续在 Azure DevOps 中工作，系统把变化同步到 GitHub，管理员在准备好之后再完成短暂切换。

这个架构至少带来四个值得单独验收的状态。

### 1. 基线状态

迁移任务启动后，目标端需要形成源端的基线。基线不只是默认分支的最新提交，还包括 Git 历史、其他分支和标签。若只检查首页显示的默认分支，无法证明历史对象已经到位。

### 2. 增量同步状态

基线建立后，源端仍可能继续产生提交、分支、标签和拉取请求。持续同步的价值就在这里：迁移不是一次性快照，而是一个不断追赶源端变化的过程。验收时应关注同步是否仍在运行、是否存在待处理对象，以及最近一次同步对应的时间或版本，而不能只看任务曾经“成功启动”。

### 3. 切换候选状态

目标端已经足够接近源端，但还没有成为唯一写入点。此时要冻结变更范围，确认未完成的拉取请求、正在运行的流水线、分支保护和团队通知策略。切换不是技术按钮，而是组织协作状态的改变。

### 4. 切换完成状态

切换完成后，源端不应继续被当成正常开发入口。即使 Git 数据已经存在，远端 URL、CI 触发器、机器人权限、文档链接和本地凭据也可能仍然指向 Azure DevOps。迁移的结束条件应包括“新的提交和合并都进入 GitHub”，而不只是目标仓库可访问。

## 一套不依赖迁移提示的验证流程

官方材料没有提供可直接复制的 ELM CLI 命令，因此下面的命令只用于验证 Git 层面的结果，不假装它们是 ELM 控制命令。命令应在迁移窗口内对源仓库和目标仓库分别执行，并把输出保存为迁移记录的一部分。

首先确认两端的引用集合。将地址替换为实际的只读 URL：

```bash
export SOURCE_URL='https://dev.azure.com/ORG/PROJECT/_git/REPO'
export TARGET_URL='https://github.com/ORG/REPO.git'

git ls-remote --heads "$SOURCE_URL" | sort > source-heads.txt
git ls-remote --heads "$TARGET_URL" | sort > target-heads.txt
diff -u source-heads.txt target-heads.txt
```

这一步能发现目标端缺少分支，不能证明分支内容已经完全一致。对重要分支继续比较提交对象：

```bash
git ls-remote "$SOURCE_URL" refs/heads/main refs/heads/release
 git ls-remote "$TARGET_URL" refs/heads/main refs/heads/release
```

真实环境中应删除第二行开头多余的空格，并按实际分支名称扩展列表。关键原则是：比较同名引用指向的提交 ID，而不是比较网页上的“最近更新”文字。

标签也必须单独检查，因为标签可能代表发布边界，而分支检查不会覆盖它们：

```bash
git ls-remote --tags "$SOURCE_URL" | sort > source-tags.txt
git ls-remote --tags "$TARGET_URL" | sort > target-tags.txt
diff -u source-tags.txt target-tags.txt
```

若项目使用轻量标签和带注释标签，还应在一个临时克隆中检查标签对象类型和指向关系。仅仅看到标签名称相同，不足以证明发布对象相同。

```bash
rm -rf /tmp/migration-source /tmp/migration-target
git clone --quiet --mirror "$SOURCE_URL" /tmp/migration-source
git clone --quiet --mirror "$TARGET_URL" /tmp/migration-target
git show-ref --head /tmp/migration-source | sort > source-refs.txt
git show-ref --head /tmp/migration-target | sort > target-refs.txt
diff -u source-refs.txt target-refs.txt
```

这里的 `rm -rf` 只针对明确命名的临时目录，不应在生产工作区执行。若仓库很大，镜像克隆本身可能耗时较长，不能把命令超时直接解释为迁移失败，也不能在没有完整输出的情况下宣布通过。

Git 层验证之后，再建立对象清单。官方说明明确提到 Git 历史、分支、标签和拉取请求都会进入迁移范围，因此至少应记录：默认分支最近提交、长期维护分支、发布标签、仍开放的拉取请求数量，以及抽样拉取请求中的标题、描述、评论和用户历史是否存在。材料没有提供查询这些对象的固定 API，因此这里应使用迁移门户、GitHub 页面或官方支持的 CLI，并保存对象数量和抽样结果，而不是自行假定某个未核实的接口参数。

## 分支策略迁移，不能用“仓库能合并”代替

ELM 官方描述将 Azure DevOps branch policies 映射为 GitHub branch rulesets。这是一个重要的结构变化：源端和目标端都可能有“保护主分支”的能力，但规则模型、匹配范围和执行时机并不一定相同。迁移验收不能只尝试一次合并，然后得出策略已迁移的结论。

应先制作一张规则矩阵，至少列出以下列：源分支或模式、必须通过的检查、是否要求审查、是否限制直接推送、管理员是否可绕过、目标规则集名称、目标匹配范围、验证结果。然后为每条关键规则设计一个反向测试：

- 缺少必需检查时，拉取请求是否仍会被允许合并。
- 没有足够审查者时，是否会被阻止。
- 直接推送到受保护分支时，是否被拒绝。
- 规则是否只作用于预期分支，而没有误伤发布分支或临时分支。
- 管理员绕过能力是否符合组织的新治理要求。

这些测试应在低风险的候选分支或专用仓库进行。不要为了证明规则存在而在生产主分支制造失败合并。若某条 Azure DevOps 策略没有一一对应的 GitHub ruleset 表达方式，正确做法是标记为“需人工重建”，而不是把近似规则当成等价迁移。

## Azure Boards 与 Pipelines：保留并不等于已经接通

官方说明提到，ELM 可以创建 Azure Boards 连接，并重新连接 Azure Pipelines 到迁移后的 GitHub 仓库；工作项和流水线定义仍然保留在 Azure DevOps。这意味着迁移后可能形成一个跨产品边界的工作流：代码和拉取请求在 GitHub，工作项与流水线的一部分仍在 Azure DevOps。

这种设计减少了迁移当天一次性重建所有工具的压力，却增加了连接验证的必要性。应分别检查四条链路：

1. GitHub 提交或拉取请求是否能被 Azure Pipelines 正确触发。
2. 流水线使用的仓库 URL、默认分支和凭据是否已更新。
3. Azure Boards 与 GitHub 工作项或拉取请求的关联是否仍可追踪。
4. 迁移后的权限主体是否仍有读取代码、触发构建和回写状态的能力。

“流水线定义还在”只说明配置对象保留，“流水线能运行”才说明触发和授权链路成立；“流水线通过”也不能替代 GitHub 分支规则对检查结果的正确消费。三者必须分别记录。

## 失败边界：哪些情况不能贸然切换

第一种边界是同步滞后。目标端可能拥有完整历史，但尚未追上源端最后一批提交或拉取请求。此时仓库看起来可用，却不具备切换条件。切换前应定义一个明确的同步截止点，并在源端停止写入后再次比较关键引用。

第二种边界是对象语义不一致。提交、分支和标签属于 Git 对象；拉取请求评论、用户历史、分支策略和流水线连接属于协作或控制面对象。Git 引用一致，不代表这些对象都一致。必须把两类结果分开验收。

第三种边界是跨系统连接失败。保留 Azure Boards 和 Azure Pipelines 可以缩短迁移范围，但也意味着 GitHub 成为新的代码事实来源。任何仍指向 Azure DevOps 的 webhook、机器人或流水线，都可能造成重复构建、状态回写失败或开发者继续向旧端提交。

第四种边界是回退复杂度。连续同步让切换前的停机窗口更短，却不会自动解决切换后的双写问题。一旦团队已经在 GitHub 创建了新的提交、拉取请求或规则变更，再把工作退回 Azure DevOps，就会出现新的分叉。回退条件必须在切换前写清楚，例如目标端关键验证失败、流水线无法触发、权限主体缺失，或关键分支规则无法重建。没有明确条件的“必要时回退”，实际上等于没有回退方案。

## 结论：迁移的最小成功条件是“可证明地停止旧入口”

ELM 的价值不在于把一次复杂复制任务包装成更漂亮的进度条，而在于把迁移变成一个可持续同步、可安排切换的生命周期。它降低了团队冻结开发的成本，也把风险从“导入是否完成”转移到了“同步、控制面和切换后的单一事实来源是否成立”。

因此，最小成功条件不应写成“GitHub 仓库已创建”或“迁移任务显示成功”，而应写成一组可审计的结论：关键引用和标签已核对，历史与协作对象已抽样，分支规则已逐条验证，Azure Boards 与 Pipelines 的连接已完成实际触发检查，团队入口和文档已切换，并且旧端已经不再承担正常写入职责。

如果做不到最后一点，迁移只是新增了一个副本；只有当 GitHub 成为经过验证的唯一代码入口，Azure DevOps 的保留能力才真正从迁移负担变成过渡期资产。

## 参考资料

- [Enterprise Live Migrations from Azure DevOps generally available](https://github.blog/changelog/2026-11-19-enterprise-live-migrations-from-azure-devops-generally-available)
- [github.com](https://github.com/cloudflare/cloudflare-docs)
