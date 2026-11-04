---
title: "BYOK 进入账本之后：AI 编程用量治理的三层边界与验证闭环"
published: 2026-11-04
category: "AI前沿"
tags: ["BYOK","GitHub Copilot","用量治理","AI编程代理","审计","数据验证"]
draft: false
pinned: false
comment: true
description: "BYOK 让模型调用路径从平台托管延伸到个人密钥、本地模型和企业自定义模型，传统的 Copilot 用量统计因此出现新的归属边界。本文基于 GitHub Copilot usage API 的最新字段，拆解三类请求的账本模型，并给出 JSON 检查、策略核对和异常识别方法，说明为什么“没有平台账单”不等于“没有治理对象”。"
image: "https://github.blog/wp-content/uploads/2026/11/692697342-1fcb18df-03bf-4266-a109-f6f85f5e2427.jpeg"
---

## BYOK 改变的不是模型，而是账本边界

在统一托管模型的时代，统计 AI 编程工具的使用量相对直接：客户端发起请求，平台记录会话、请求、提示词和 token，再按用户、组织或企业聚合。BYOK 出现以后，同一个 Copilot 入口可能把请求送往完全不同的地方：开发者自己的供应商密钥、本机模型服务，或者管理员配置的企业自定义模型。

这三种路径在体验上可能都叫“使用 Copilot”，但在成本、数据流向和责任归属上并不相同。GitHub 在 2026 年 11 月 3 日的变更说明中，明确把 Local BYOK 与 Enterprise custom models 纳入 Copilot usage metrics API，并增加了区分这些请求的字段。这个变化的核心价值，不是多了几个统计字段，而是把原本混在 Copilot-hosted totals 里的调用重新拆成可解释的账本。

因此，治理问题应该从“本月用了多少 Copilot”改写成三个问题：请求由谁发起，模型由谁提供，费用和数据责任由谁承担。如果只看模型名称或总 token，三者很容易被重新混在一起。

## 三类调用，三种责任模型

### 1. Local BYOK：平台入口，本地或个人供应商负责执行

Local BYOK 是开发者在客户端配置的路径。材料明确指出，请求可以从 Copilot CLI 或 GitHub Copilot app 直接发往开发者自己的 provider key，或者发往本地模型。官方列举的本地服务包括 Ollama、Foundry Local、LM Studio 和 llama-server。

这类请求的关键特征不是“模型名字像不像 Copilot 模型”，而是请求是否由本地 BYOK 路径完成。用户级报告可以通过 `used_local_byok` 判断某个用户当天是否至少发起过一次 Local BYOK 请求；聚合统计则可以查看 `totals_by_local_byok`。后者按 `byok_kind` 和 `surface` 拆分，前者包含 `local_managed`、`local_user`、`local_auto`、`remote_user`，后者区分 `copilot_cli` 与 `copilot_app`。

这里至少有两个工程含义。第一，个人供应商账单不能再被误认为 GitHub 托管模型成本。第二，本地模型虽然可能没有供应商费用，但仍然是组织里的 AI 使用活动，仍可能涉及代码、提示词、模型文件和设备合规问题。成本为零不代表治理对象为零。

### 2. Enterprise custom models：平台观测，企业配置

企业自定义模型由管理员在 GitHub 设置中配置，请求仍然经过 GitHub，再路由到企业自己的 provider。官方为 `totals_by_client[].totals_by_model[]` 增加了 `is_custom_enterprise_model` 布尔字段：当请求使用企业或组织配置的自定义模型时，该值为 `true`。

这个字段解决了一个很容易被忽略的歧义：同一个模型可能同时以 Copilot-hosted model 和 custom model 的身份出现。它们不能仅凭模型名合并，否则会把平台托管调用和企业自有模型调用算成同一类。正确的聚合键至少应包含客户端、模型标识以及 `is_custom_enterprise_model`。

更重要的是，企业自定义模型与 Local BYOK 的观测边界不同。GitHub 说明其能够在服务端观察企业自定义模型请求，因此该字段覆盖所有客户端，包括 IDE；而 Local BYOK 的说明集中在 Copilot CLI 和 Copilot app。治理报表不能把“企业自定义模型”与“开发者本地模型”当作同一条管道。

### 3. Copilot-hosted model：默认路径也需要显式区分

当模型没有被标记为企业自定义模型，也没有落入 Local BYOK 统计时，才适合归入 Copilot-hosted usage。这里不能直接使用“模型名不在自定义列表中”作为唯一判据，因为官方已经指出同一个模型名可能同时出现在托管和自定义条目中。

工程上更稳妥的做法，是保留原始条目和分类依据，不要先把同名模型压平。报表应该能够回答：某个模型名称下有几条记录、每条记录的自定义标记是什么、请求和 token 分别是多少。任何无法解释来源的合计数，都不应直接用于成本分摊或合规结论。

## 用 JSON 检查代替“看总数猜原因”

材料没有给出完整 API 请求示例，因此不应虚构 endpoint、认证头或分页参数。下面的检查假设管理员已经通过组织现有流程导出了用户级或聚合级 usage API JSON，文件名为 `usage.json`。命令只依赖材料中已经确认的字段，适合放在报表生成前作为结构检查。

先检查 Local BYOK 字段是否存在，并查看有活动的用户：

```bash
jq '
  .[]
  | select(.used_local_byok == true)
  | {user: (.user_login // .user // "unknown"), used_local_byok}
' usage.json
```

如果导出结果是一个带 `users` 数组的对象，则把 `.[]` 替换为 `.users[]`。这个差异必须以实际响应结构为准，不能把示例路径当作官方固定响应格式。

再检查本地 BYOK 的明细分类，避免只看一个总量：

```bash
jq '
  [ .[]
    | .totals_by_local_byok
    | to_entries[]
    | {byok_kind: .key, value: .value}
  ]
' usage.json
```

不同版本或报告层级可能把统计放在用户对象或聚合对象中，因此第一步应先执行结构探测：

```bash
jq 'paths(scalars) | map(tostring) | join(".")' usage.json \
  | grep -E 'used_local_byok|totals_by_local_byok|daily_active_local_byok_users|is_custom_enterprise_model'
```

这条命令的用途是确认字段实际出现的位置，而不是证明所有报告都包含全部字段。若字段不存在，应标记为“报告层级不支持或导出不完整”，不能用零替代。

对企业自定义模型，可保留模型条目中的标记再聚合：

```bash
jq '
  [ .. | objects
    | select(has("is_custom_enterprise_model"))
    | {
        is_custom_enterprise_model,
        requests: (.requests // 0),
        tokens: (.tokens // 0),
        model: (.model // "unknown")
      }
  ]
  | group_by(.is_custom_enterprise_model)
  | map({is_custom_enterprise_model: .[0].is_custom_enterprise_model,
         entries: length,
         requests: (map(.requests) | add),
         tokens: (map(.tokens) | add)})
' usage.json
```

命令中的 `requests` 和 `tokens` 使用了缺省为零的处理，但这只适用于字段确实缺失且业务允许按零展示的报表。若要做审计，应先把缺失字段单独列为异常，而不是静默补零。展示报表和审计报表应当采用不同的容错策略。

## 验证闭环：从字段存在到结论可信

第一层是结构验证。每天保存一份响应的 schema 快照或至少保存关键路径清单，检查 `used_local_byok`、`totals_by_local_byok`、活跃用户统计字段和 `is_custom_enterprise_model` 是否仍存在。字段缺失、类型从布尔变成字符串、数组变成对象，都应触发人工复核。

第二层是守恒验证。对同一报告层级，分别计算 Local BYOK、企业自定义模型和托管模型的请求量与 token 量，确认原始条目可以追溯到合计数。不能把用户级报告的数字与企业级报告直接相加，也不能把 1 天报告和 28 天报告当成可加总的时间片。官方说明这些报告同时提供用户级和聚合级数据，但报告周期和维度不同，不能靠字段名称猜测可加性。

第三层是路径验证。为每个团队定义允许的 `byok_kind` 和自定义模型范围，并将统计结果与策略表比较。例如团队允许本地模型，但不允许 `remote_user`；或者企业只批准一组自定义模型。结果不应直接被标记为“违规”，更准确的状态是“出现了需要核验的调用路径”，因为 usage API 证明的是使用事实，不一定包含完整的审批上下文。

第四层是成本验证。Local BYOK 的费用可能在外部供应商或本地设备侧产生，Enterprise custom models 的费用可能由企业 provider 承担。usage API 能帮助拆分请求和 token，但材料没有证明它会替代供应商账单，也没有证明它能计算硬件折旧、网络费用或本地电力成本。因此成本中心只能把这些统计作为分摊输入，不能把 token 数直接当作最终金额。

## 客户端隐私设置不等于平台用量不可见

近期 AI 编程工具的更新也说明了客户端状态与服务端观测之间的边界。Qwen Code v0.26.7 的发布说明提到，`privacy.usageStatisticsEnabled: false` 可以停止后台 catalog refresh，同时保留本地元数据；这说明关闭某类使用统计并不等于客户端不再需要本地模型元数据，更不能推导出所有请求都不会被任何平台观察。

Claude Code v2.1.318 则增加了登录凭据到期时间在 `claude auth status` 和 `claude -p` JSON 结果中的显示，并在到期前十天开始向文本输出写入一行 stderr 警告。这个例子提醒我们：认证状态、模型调用统计和费用归属是三种不同的信号。一个客户端能报告凭据有效期，不代表它能替代组织级用量账本；一个本地隐私开关能停止后台刷新，也不代表企业可以据此推断请求路径。

因此，治理系统应避免把客户端配置项当作服务端事实。客户端配置适合做“意图”或“本地状态”记录，usage API 适合做“平台观测”，供应商账单和设备资产记录才分别对应外部成本与本地资源成本。三者必须并列保存，不能互相覆盖。

## 失败边界与工程取舍

最常见的失败是按模型名聚合。修复方式是保留 `is_custom_enterprise_model`，并把它纳入维度。第二个失败是把没有 `used_local_byok` 的用户当作从未使用本地模型；更谨慎的解释是“该报告没有记录该活动”，除非报告契约明确保证字段完整。

第三个失败是把 Local BYOK 当成安全放行。个人 provider key、本地模型和远程个人供应商仍可能形成不同的数据外流路径。usage API 能告诉组织谁在使用、使用了哪类路径，却不自动证明提示词内容符合数据分类政策。数据防护、密钥管理和客户端配置检查仍然需要独立控制。

第四个失败是只做月度汇总。官方提供日、周、月活跃 Local BYOK 用户统计，日级数据适合发现突然出现的路径变化，28 天报告适合趋势分析。只保留月度总数会掩盖短时间的异常峰值，也无法区分一次性迁移和持续使用。

我的结论是：BYOK 治理的最小可行单元不是“模型”，而是“调用路径 + 责任主体 + 可验证证据”。路径决定数据去了哪里，主体决定谁承担费用与审批责任，证据决定结论能否复查。只要报表保留这三项，个人密钥、本地模型和企业自定义模型就不会再次被一个看似漂亮的总数掩盖；如果缺少其中任何一项，所谓 AI 使用率都只能算作未经解释的计数。

## 参考资料

- [BYOK and enterprise custom models in the Copilot usage API](https://github.blog/changelog/2026-11-03-byok-and-enterprise-custom-models-in-the-copilot-usage-api)
- [v2.1.318](https://github.com/anthropics/claude-code/releases/tag/v2.1.318)
- [Release v0.26.7](https://github.com/QwenLM/qwen-code/releases/tag/v0.26.7)
