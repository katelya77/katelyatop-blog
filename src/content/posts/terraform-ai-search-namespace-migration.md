---
title: "Terraform 管理 AI Search 不只是加个 namespace：多租户资源迁移与验收边界"
published: 2026-11-14
category: "DevOps"
tags: ["Terraform","Cloudflare","AI Search","基础设施即代码","多租户","迁移"]
draft: false
pinned: false
comment: true
description: "Cloudflare Terraform provider 5.29.0 为 AI Search 实例引入 namespace，使非 default 命名空间也能纳入基础设施即代码。本文从资源身份、导入格式、数据源读取和替换语义出发，拆解升级时最容易被忽略的状态迁移风险，并给出可复现的配置、检查命令与分阶段验收清单。"
image: "https://developers.cloudflare.com/changelog/post/2026-11-13-terraform-namespaces/og.png?v=840d0ed262c6d14f"
---

## 先把变化说清楚：namespace 改变的是资源身份

Cloudflare 在 2026 年 11 月 13 日发布的 Changelog 明确说明：从 Terraform provider v5.29.0 开始，`cloudflare_ai_search_instance` 可以管理任意 namespace 中的 AI Search 实例，而不再局限于 `default`。资源新增 `namespace` 参数，默认值仍然是 `default`，因此没有改写配置的旧项目会继续指向原来的默认命名空间。

这看起来像是给资源增加一个字符串字段，实际却改变了 Terraform 对资源的寻址方式。过去，一个实例可以近似写成“账号 + 实例 ID”；现在，它更接近“账号 + namespace + 实例 ID”。同一个账号下，即使两个 namespace 使用相同的实例 ID，也不应被当成同一个 Terraform 对象。

因此，升级的核心问题不是“能不能写出新的 HCL”，而是状态文件中的旧地址、远端对象的真实位置、导入 ID 格式和数据源查询条件是否保持一致。只修改一处，往往会让计划结果看起来像删除并重建，或者让数据源因为缺少 namespace 而无法读取。

本文依据 Cloudflare 官方 Changelog 及其官方文档仓库中的公开材料整理。版本变化属于官方发布信息；下面的迁移策略、命令和验收清单是基于这些接口语义提出的工程实践，不等同于 Cloudflare 对具体项目的部署保证。

## 配置层：默认命名空间不是“无需管理”

最稳妥的做法，是在升级后也显式写出 namespace，而不是依赖默认值。这样做不是为了改变行为，而是为了把资源边界写进代码，避免未来有人把实例移动到其他命名空间后，审查者仍然误以为它属于默认空间。

```hcl
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.29"
    }
  }
}

resource "cloudflare_ai_search_namespace" "support" {
  account_id = var.account_id
  name       = "support"
}

resource "cloudflare_ai_search_instance" "docs" {
  account_id = var.account_id
  id         = "docs"
  namespace  = cloudflare_ai_search_namespace.support.name
}
```

这里有两个值得保留的设计选择。第一，namespace 本身作为资源管理，而不是把字符串散落在多个实例中；这使 namespace 的创建、命名和依赖关系都进入 Terraform 图。第二，实例引用 namespace 资源的名称，而不是重复写一个字面量。这样，如果实例属于哪个空间发生变更，代码审查中会出现明确的差异。

如果项目暂时只使用 `default`，也可以显式写成：

```hcl
resource "cloudflare_ai_search_instance" "docs" {
  account_id = var.account_id
  id         = "docs"
  namespace  = "default"
}
```

显式声明的价值在于减少隐式状态。它不会把 default 变成新的功能，也不会自动迁移任何实例；它只是把当前资源身份固定地表达出来。

## 数据源层：读取范围从全局变成命名空间内

官方变更说明指出，`cloudflare_ai_search_instance` 和 `cloudflare_ai_search_instances` 数据源需要 `namespace` 参数。实例数据源应当同时给出账号、namespace 和实例 ID：

```hcl
data "cloudflare_ai_search_instance" "docs" {
  account_id = var.account_id
  namespace  = "support"
  id         = "docs"
}

data "cloudflare_ai_search_instances" "support" {
  account_id = var.account_id
  namespace  = "support"
}
```

这带来一个重要的架构边界：列出实例不再意味着读取账号下的全部实例，而是读取指定 namespace 中的实例集合。一个“同步所有实例”的模块，如果原先把返回结果当成账号级全集，就需要重新检查它的命名空间循环、输出结构和差异计算方式。

同时，变更说明还指出，`cloudflare_ai_search_instance` 数据源原有的 `filter.namespace` 参数被移除。升级时不能简单地把旧参数原样保留，再期待 provider 自动兼容；应该把 namespace 提升到数据源的直接参数位置。配置审查可以使用下面的搜索作为第一道静态检查：

```bash
grep -RIn --include='*.tf' --include='*.tfvars' \
  -e 'filter[.]namespace' \
  -e 'cloudflare_ai_search_instance' \
  -e 'cloudflare_ai_search_instances' .
```

搜索结果不能证明迁移正确，但可以快速发现旧参数是否仍在代码中、哪些数据源需要补 namespace，以及是否存在只改资源而漏改数据源的情况。

## 导入层：ID 格式变化会直接影响状态迁移

v5.29.0 改变了 `cloudflare_ai_search_instance` 的导入 ID：新的格式是 `<account_id>/<namespace>/<id>`。默认命名空间也必须显式写成 `<account_id>/default/<id>`。官方 Changelog 给出的导入形式包括：

```bash
terraform import \
  cloudflare_ai_search_instance.docs \
  <account_id>/support/docs

terraform import \
  cloudflare_ai_search_namespace.support \
  <account_id>/support
```

这里的尖括号是占位符，不应原样复制。正式执行前，应从受控变量或密钥管理系统取得账号标识，避免把真实凭据写入脚本、Shell 历史或仓库。导入命令本身不会替代代码定义：导入完成后仍要让 HCL 描述与远端对象一致，再用计划结果确认 Terraform 是否还想修改它。

一个安全的迁移顺序是：先升级 provider，补齐配置中的 namespace；再执行 `terraform init -upgrade`；随后对既有对象执行新的导入或状态校准；最后运行计划并检查是否出现意外的 destroy/create。示例命令如下：

```bash
terraform fmt -check
terraform init -upgrade
terraform validate
terraform plan -out=ai-search.tfplan
terraform show -no-color ai-search.tfplan
```

`terraform validate` 主要检查配置结构和类型，不能证明远端 namespace 存在，也不能证明当前状态绑定了正确对象。真正需要关注的是计划中资源地址、namespace 字段和动作类型。对于原本位于 default 的实例，如果只是补充等价的 `namespace = "default"`，计划不应因为身份格式变化而无理由重建；如果实例确实要从一个 namespace 改到另一个 namespace，则必须把它当成迁移决策，而不是普通字段更新。

## 替换语义：移动 namespace 不是普通编辑

官方变更说明明确指出，改变实例的 namespace 会替换该实例。这个事实决定了上线流程：不能把 namespace 修改和其他字段调整混在一次自动 apply 中，然后只看命令是否成功。

可以把迁移拆成三个阶段。第一阶段是盘点：记录当前实例 ID、当前 namespace、Terraform 地址和依赖它的数据源。第二阶段是预演：在隔离状态或候选工作区中修改 namespace，观察计划是否显示替换，并确认替换对象、依赖资源和输出值。第三阶段才是执行：在约定维护窗口内应用，并把旧对象清理、相关索引或数据重建、调用方切换纳入同一份运行手册。

需要特别区分两种情况：

* 只是从未声明 namespace，补上 `default`。这属于配置显式化，目标是保持现有资源身份。
* 把实例从 `default` 改到 `support`。这属于资源替换，不能假设远端数据、实例 ID 或依赖关系会自动平移。

如果计划显示替换，但团队原本只想补齐默认值，应停止 apply，先核对 provider 版本、状态文件和远端对象位置。不要用 `-auto-approve` 绕过审查，也不要通过删除状态记录来“让计划变绿”；那会把状态不一致掩盖成新的资源创建。

## 一个可复现的验收清单

升级完成后，至少要验证以下五类结果。

### 1. Provider 与配置

确认锁文件实际解析到预期的 provider 版本，HCL 中所有 AI Search 实例和相关数据源都有明确 namespace。对旧模块尤其要检查变量默认值：变量存在不代表资源真的引用了它。

### 2. 资源身份

对每个实例建立一行清单：账号、namespace、实例 ID、Terraform 地址。账号和实例 ID 相同但 namespace 不同的对象必须分开记录。导入后执行计划，确认 Terraform 地址没有意外指向另一个空间。

### 3. 数据源范围

分别读取一个指定实例和一个指定 namespace 的实例列表，确认模块输出只代表该 namespace 的范围。不要用“列表非空”作为成功标准；应检查返回对象的 namespace 与期望值一致，并确认没有把多个空间的结果拼成一个无边界集合。

### 4. 计划动作

将计划中的 `no-op`、`update`、`replace` 分类保存。补齐 `default` 时出现替换，需要回到状态和导入格式排查；主动移动 namespace 时出现替换则是预期风险，但必须有批准记录和回退方案。

### 5. 失败路径

分别准备 namespace 不存在、实例 ID 不存在、缺少 namespace 参数以及旧 `filter.namespace` 仍存在的配置检查。目标不是让所有错误消失，而是确认错误在计划或读取阶段尽早暴露，不会被模块转换成空列表、默认空间或成功形状的输出。

## 工程取舍：显式边界比少写一行更重要

多 namespace 支持的直接收益是资源可以按团队、产品或数据域隔离管理；代价是每个实例查询都必须携带更完整的身份信息，导入和状态迁移也更严格。对于小型项目，所有实例继续放在 default 可能更简单；对于需要独立生命周期的多个数据域，显式 namespace 能降低误读和误操作的概率。

更值得避免的是把 namespace 变成一个任意字符串参数，然后在模块内部悄悄拼接资源地址。模块应该把 namespace 当作资源身份的一部分：在输入校验、命名约定、输出值和变更审查中都保持一致。这样，Terraform 的计划才不仅是“某个实例发生变化”，而是能回答“哪个空间中的哪个实例发生了什么变化”。

## 结论：IaC 的升级难点在身份连续性

AI Search 的 namespace 支持并不只是扩大了可配置范围。它把一个原本容易被默认值隐藏的维度，正式纳入资源模型：资源、数据源、导入 ID 和替换行为都必须围绕这个维度重新对齐。

因此，升级验收不应以“provider 能初始化”或“Terraform plan 没有语法错误”为终点。更可靠的判断是：代码明确表达 namespace，状态能唯一定位远端对象，数据源读取范围可解释，计划中的替换都有工程决策，失败输入会在 apply 前暴露。对基础设施即代码而言，这种身份连续性比新增一个配置字段本身更重要。

## 参考资料

- [AI Search - Manage AI Search instances in any namespace with Terraform](https://developers.cloudflare.com/changelog/post/2026-11-13-terraform-namespaces/)
- [github.com](https://github.com/cloudflare/cloudflare-docs)
