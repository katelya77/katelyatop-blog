---
title: "AI 代码审查不应只看采纳数：从 addressed rate 拆解治理闭环"
published: 2026-11-06
category: "AI前沿"
tags: ["GitHub Copilot","代码审查","工程度量","研发效能","AI治理"]
draft: false
pinned: false
comment: true
description: "GitHub Usage Metrics API 新增 Copilot 代码审查明细后，团队终于可以区分建议被点击、反馈被处理与合并后仍需人工变更这几种完全不同的结果。本文从 addressed rate 的定义出发，拆解数据归属、统计时点、机器人 PR 边界和自定义上下文影响，并给出一套可复现的数据检查与治理方法。"
image: "https://github.blog/wp-content/uploads/2026/11/696871374-0c1024be-79ea-4fd2-a050-2b8f2df34847.jpeg"
---

## 代码审查的旧指标，为什么不够用了

过去衡量 AI 代码审查，最容易看到的是运行次数、评论数量，以及开发者是否点击了可直接应用的建议。这些数字适合回答一个问题：功能有没有被使用。但它们无法回答更重要的问题：评论是否被认真处理，处理结果是否进入了变更链路，以及 AI 审查是否改变了人工审查的工作量。

GitHub 在 2026 年 11 月 5 日公布的 Usage Metrics API 更新，新增了企业级、组织级仓库日报中的 `copilot_code_review` 对象。它不再把所有评论都压缩成一个应用次数，而是把反馈处理拆成可分析的事件：被评估的评论数、被处理的评论数、按严重级别和评论类型的分布，以及审查后合并且没有出现人工 change request 的 Pull Request 数量。

这不是简单增加几个字段，而是把度量对象从“按钮行为”切换成“审查结果”。开发者处理评论的方式可能是应用建议、让 Copilot 修改、手工编辑代码，或者回复说明将在后续 Pull Request 中修复。只统计 ready-to-apply 建议的应用次数，会漏掉这些真实的工程行为。

## addressed rate 的正确含义

新增指标中，`total_comments_evaluated` 表示在合并时被检查、用来判断开发者是否采取行动的 Copilot 代码审查评论总数；`total_comments_addressed` 表示其中被开发者采取行动的数量。两者相除，才得到仓库维度的 addressed rate：

```text
addressed_rate = total_comments_addressed / total_comments_evaluated
```

这个比例不是“AI 建议准确率”，也不是“建议最终进入生产代码的比例”。它只说明：在已经被纳入评估的评论中，有多少评论触发了开发者认可的处理动作。被处理不等于建议正确，未被处理也不必然意味着建议错误；团队可能因为风险太低、重复评论、计划后续重构或缺少上下文而暂时不改。

因此，指标名称本身就是边界。把 addressed rate 直接作为个人绩效分数，会制造错误激励：开发者可能为了提高比例而机械回复评论，审查者可能倾向于关闭低价值反馈，团队也可能回避复杂仓库。更合理的用法是把它当作审查系统的诊断信号，再结合严重级别、评论类型、人工 change request 和缺陷回流进行解释。

仓库没有 Copilot 代码审查活动时，相关计数为 0，数组为空。这里必须区分“没有活动”和“没有价值”：空数据不能证明审查质量为零，只能证明当天没有可统计样本。小仓库尤其要避免按日对低样本比例做结论，应采用周或迭代周期聚合，并同时展示分母。

## 先处理统计时点，再谈趋势

这组数据最容易被误读的地方，是评论的归属时间。官方说明明确指出，评论是在 Pull Request 合并时进行评估，因此它们计入合并日，而不是 Copilot 发布评论的日期。

这意味着日报不是实时事件流。一个 Pull Request 可能在周一获得评论，周三才合并，那么评论数量和 addressed rate 会在周三出现。若团队把日报直接画成时间序列，周一会看起来反馈很少，周三则可能突然出现峰值。这个峰值不一定代表模型行为变化，可能只是合并节奏变化。

工程上应至少保存三个时间概念：评论生成时间、Pull Request 合并时间和指标报表日期。当前材料只明确了报表按合并日计数，因此在分析中不要臆造评论发布日字段，也不要用日报反推出模型实时延迟。可以把报表日期命名为 `merge_date` 或在数据仓库中明确写入说明，避免下游使用者把它误认为 review_created_date。

一个最小的离线检查可以在下载后的单仓库日报 JSON 上完成。下面的命令不调用未在材料中声明的接口，只检查导出的字段和分母边界：

```bash
jq '
  .[]
  | .copilot_code_review as $r
  | {
      date: .date,
      evaluated: $r.total_comments_evaluated,
      addressed: $r.total_comments_addressed,
      addressed_rate: (
        if ($r.total_comments_evaluated // 0) > 0
        then ($r.total_comments_addressed / $r.total_comments_evaluated)
        else null
        end
      ),
      merged_without_human_change_request:
        $r.total_merged_no_human_change_request_after_review
    }
' repos-1-day.json
```

检查结果应满足三条基本规则：`addressed` 不得大于 `evaluated`；分母为零时比例应为空而不是零；比例应以原始计数重新计算，而不是盲信上游预先生成的百分比。第三条规则尤其重要，因为它让数据管道能够识别字段错位、整数除法或重复聚合造成的问题。

## 机器人 Pull Request 是一个特殊边界

官方说明还区分了两类统计行为。Copilot 通常不会评估由机器人打开的 Pull Request，例如 Copilot cloud agent 创建的 Pull Request。因此，这类 Pull Request 通常不会贡献到评论评估数量或 addressed rate 的分子分母。

但 `total_merged_no_human_change_request_after_review` 仍然包含这些 Pull Request。于是，同一份日报可能出现这样的组合：评论评估数为零，但“审查后没有人工 change request 的合并请求”大于零。这不是数据矛盾，而是两个字段的纳入范围不同。

因此，不能把后一个字段除以评论评估数，拼成未经定义的“自动合并成功率”。它更适合作为一个独立的流程信号：在 Copilot 审查覆盖到的合并请求中，有多少没有在首次审查之后出现人工变更请求；但由于机器人 PR 也可能进入这个计数，组织必须先确认自己是否把人类 PR 和机器人 PR 混在同一分析口径中。

验收时可以建立一张字段契约表：

| 字段 | 可回答的问题 | 不应推导的问题 |
| --- | --- | --- |
| `total_comments_evaluated` | 有多少评论进入了处理判断 | 评论总量、模型准确率 |
| `total_comments_addressed` | 有多少评论触发了开发者行动 | 建议被采纳并上线的数量 |
| `review_comments_by_severity` | 不同严重级别反馈如何分布 | 严重级别本身是否判断正确 |
| `review_comments_by_comment_type` | bug、安全或自定义规则反馈如何分布 | 某类评论的修复成功率 |
| `total_merged_no_human_change_request_after_review` | 合并后是否出现人工 change request | 自动审查替代人工审查的比例 |

## 自定义上下文要按分组看，而不是按宣传语看

新数据还允许按审查层级、评论类型、严重级别和 customization 分组。customization 可以区分 custom instructions、skills、MCP servers 或 none。这给了团队一个比“启用了 AI”更细的比较维度：同一仓库、相近时间窗口内，不同上下文配置下产生了什么类型的反馈，开发者如何处理这些反馈。

但分组数据不等于因果实验。启用自定义指令的仓库，往往也可能拥有更严格的代码规范、更成熟的维护者或更高的审查频率。若直接看到某一组 addressed rate 较高，就声称某个 skill 或 MCP server 提升了质量，是超出材料证据的结论。

更稳妥的检查顺序是：先看样本数，再看严重级别构成，再看评论类型构成，最后才比较 addressed rate。两个分组即使比例相同，若一个主要处理低严重度风格问题，另一个主要处理安全问题，工程含义也完全不同。报告应同时展示 `evaluated`、`addressed` 和各类评论数量，避免百分比掩盖样本结构。

## 把指标接入治理闭环

一套可落地的治理流程可以分为四步。

第一步是数据完整性检查。每天验证日报是否存在 `copilot_code_review` 对象，确认无活动仓库的零值和空数组没有被 ETL 转换成缺失值；对所有非零分母重新计算 addressed rate，并记录异常行。

第二步是按仓库和周期建立基线。不要只看全组织平均数，因为平均数会让大仓库淹没小仓库。至少保留仓库、日期、审查层级、评论类型和严重级别这几个维度，并为每个比例附上分母。

第三步是把行动结果送回人工流程。高严重度评论应进入普通安全或缺陷处理流程；低严重度评论可以用于观察噪声和重复反馈。addressed rate 连续下降时，先检查评论类型和合并节奏，再检查自定义指令是否变更，最后才考虑模型或审查层级调整。

第四步是做反向验证。若 addressed rate 上升，但人工 change request、回滚或缺陷回流同步上升，说明团队可能是在机械处理评论，而不是获得更高质量的审查。若 addressed rate 下降，但高严重度问题的人工发现率下降，也不能立即判断系统变差。指标必须与真实交付结果共同解释。

## 结论：把 AI 审查从计数器变成可审计系统

Usage Metrics API 的这次变化最有价值的地方，不是多了一个百分比，而是明确了 AI 代码审查至少存在三层结果：评论是否被评估，开发者是否采取行动，合并后是否仍需要人工提出变更请求。三者不能互相替代。

addressed rate 适合作为反馈处理闭环的入口，不适合作为模型准确率或个人绩效的代理。按合并日计数提醒我们尊重数据生成时点；机器人 Pull Request 的特殊纳入范围提醒我们先写清统计契约；按 severity、comment type 和 customization 分组，则让“配置是否有效”从宣传问题变成可验证的比较问题。

真正成熟的 AI 审查治理，不是追求最高采纳率，而是让每个数字都能回答三个问题：它统计了什么，什么时候统计，遗漏了什么。只有在这三个问题都被写进数据管道和验收清单后，代码审查指标才可能从仪表盘上的漂亮数字，变成可以支持工程决策的证据。

## 参考资料

- [Usage metrics API adds code review details and addressed rate](https://github.blog/changelog/2026-11-05-usage-metrics-api-adds-code-review-details-and-addressed-rate)
- [Release v0.26.8-nightly.20261105.7bd78683e6](https://github.com/QwenLM/qwen-code/releases/tag/v0.26.8-nightly.20261105.7bd78683e6)
