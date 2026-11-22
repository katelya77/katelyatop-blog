---
title: "本地 Runtime 的状态治理：从 Qwen Code v0.28.4 看目录、迁移与验收边界"
published: 2026-11-23
category: "AI前沿"
tags: ["Qwen Code","runtime-state","security","migration","verification"]
draft: false
pinned: false
comment: true
description: "以 Qwen Code v0.28.4 的本地 Runtime 和命令迁移为例，讨论进程状态、私有目录、文件冲突、Web Shell 会话与升级验收如何形成可验证的工程边界。"
image: "https://opengraph.githubassets.com/741f1cd0c7c502e107ccb399044131a4517bc08cc13849cbdd754f53e45c200e/QwenLM/qwen-code/releases/tag/v0.28.4"
---

## 为什么这次 Release 值得拆解，而不是只看功能清单

Qwen Code v0.28.4 的 Release 注记覆盖了会话界面、本地 Runtime、命令迁移和模型默认值。其中最容易被忽略的，不是“增加了什么按钮”，而是进程初始化时开始管理什么状态，以及这些状态如何避免被其他用户、旧配置或文件冲突破坏。

这类变化不能只用“聊天界面变好了”来验证。用户真正关心的是：Runtime 是否正确创建隔离目录；目录权限是否足以阻止其他账户读取；会话是否能够继续；Markdown 命令迁移是否覆盖了原始 TOML 配置；界面出现成功标记时，底层文件是否也已经完成。

本文以该 Release 的公开说明为证据，围绕本地 Runtime 和配置迁移建立一套可以复现的验收思路。同时区分官方 Release 说明和推测：Release 明确说明了状态目录创建、私有权限、Markdown 迁移和冲突保留行为，但没有提供一份通用环境下的完整性能基准。因此，本文不把功能存在等同于所有平台都已完成验证，也不把本次改动解释成整个生态的全局升级。

llama.cpp b12633 的公开 Release 则提供了一个相邻的边界例子：它声明修复 WebGPU 和非统一内存设备上的非零清零问题，但该结论只对应其列出的后端和设备范围。Runtime 状态治理同样如此，发布说明的适用范围不能自动扩大到未列出的操作系统、设备或部署方式。

## 本地 daemon 与工作区状态：先确认生命周期边界

Release 中的“Web Shell local daemon mode”表示，工作区产物和会话界面由本地守护进程承载，而不是简单地把浏览器页面和远程进程混为一谈。它的关键价值在于：本地进程具有明确的启动、状态写入和会话恢复生命周期。

从架构角度看，可以将链路拆成四层：

1. 浏览器承担交互、展示与继续会话操作。
2. Web Shell 维护共享 ChatSurface、建议芯片、状态提示和移动布局。
3. Local daemon 负责进程启动、工作区产物和本地状态。
4. 工作区存储保存产物、迁移结果与运行时元数据。

Release 还说明，Local Runtime 在进程 spawn 时创建状态目录，并设置 owner-private 权限。这里的关键不是目录是否存在，而是目录何时创建、由谁拥有，以及创建失败时进程是否继续运行。

如果目录只在读取配置时才被创建，首次启动、并发启动和异常退出都可能留下不一致状态。反之，如果目录在进程生成时就建立，就能把状态目录生命周期绑定到 Runtime 生命周期：启动阶段先准备存储，成功后再进入会话；一旦准备失败，就不应该继续展示为正常运行。

为避免把具体路径猜成事实，下面的检查使用占位变量 `$RUNTIME_STATE_DIR` 表示由 Qwen Code 实际配置或文档约定的目录。

```bash
# 检查目录是否存在，以及属主和权限
stat -c 'mode=%a uid=%u gid=%g path=%n' "$RUNTIME_STATE_DIR"

# 森严地检查目录及其子项是否意外对组或其他用户开放
find "$RUNTIME_STATE_DIR" -xdev -printf '%m %u:%g %p\n' 

# 快速筛查是否存在非 700/600 的目录或文件权限
find "$RUNTIME_STATE_DIR" -xdev \( -type d ! -perm 700 -o -type f ! -perm 600 \) -print
```

上面的筛查基于“owner-private”的工程解释，而不是把每一种实现都硬编码成 0700 和 0600。更稳妥的方式是先以官方文档确认目录所有权语义，再设置准确阈值。命令至少能回答：目录是属于启动进程的用户吗？普通用户之外是否还能读取或列出状态文件？权限是每次启动都恢复，还是只在首次创建时偶然正确？

## Artifact library 为什么不能只看页面状态

Release 说明 Web Shell 在 local daemon 模式下提供工作区 Artifact library 页面，并通过 progressive scanning 与 streaming updates 更新产物。这个能力至少包含两个状态源：磁盘中的工作区产物，以及浏览器尚未完全完成的展示状态。

Progressive scanning 的含义应理解为增量发现，而不是一次性把全部产物载入内存。Streaming updates 则意味着前端可能先收到一部分结果，后续再收到新的增量。二者叠加时，会出现三类边界：

- 扫描尚未完成时，页面是否清晰标出未完成状态。
- 同一产物被追加、覆盖或删除时，界面是否产生重复展示。
- 连接中断后，已完成和未完成的扫描状态能否恢复一致。

因此，验收不能只核对页面是否出现文件列表。应分别保存三个快照：扫描开始前的产物列表、扫描过程中的增量结果，以及扫描结束后的完整列表。然后检查最终结果是否等于磁盘状态，而不是只等于最新一次界面更新。

可复现的通用检查如下：

```bash
# 在隔离的工作区中生成三个文件并确认最终磁盘状态
mkdir -p /tmp/qwen-artifact-check
printf 'first\n'  > /tmp/qwen-artifact-check/a.txt
printf 'second\n' > /tmp/qwen-artifact-check/b.txt
printf 'third\n'  > /tmp/qwen-artifact-check/c.txt

find /tmp/qwen-artifact-check -maxdepth 1 -type f -printf '%f %s bytes\n' | sort
```

随后在 Runtime 或 Web Shell 中触发工作区扫描，记录以下字段：页面首次出现第一个产物的时间、扫描完成提示出现的时间、最终文件集合，以及刷新页面后的集合。对于失败边界，还应断开连接、修改产物后重新连接，并验证界面不会把旧快照永久展示成最终状态。

原始 Release 没有承诺完整的离线重扫语义，也没有说明断线后的重放策略。因此，“扫描一度成功”只能证明当次事件链，不能证明断线恢复一定可靠。

## 命令迁移不能只看目标文件是否生成

Release 对命令迁移的说明比许多功能条目更精确：Markdown 目的地应该被独占使用；目标冲突时保留原始 TOML。这个规则本质上是在防止新格式迁移自动覆盖已有配置。

原始 TOML 和目标 Markdown 的关系，应被视为一对可验证的数据转换，而不是一次简单的重命名：

- 源配置是否仍然存在。
- 目标 Markdown 是否只由迁移生成。
- 目标冲突时是否停止覆盖。
- 未冲突时是否完整保留语义。
- 迁移失败后能否回到原始配置继续运行。

下面的脚本可以构造隔离冲突测试。请不要直接在真实配置目录运行；迁移入口由本地安装提供的文档决定，Release 只明确了目标行为，不提供了可直接粘贴到任意系统的完整命令。

```bash
mkdir -p /tmp/qwen-migration-check
printf 'name = "before-migration"\n' > /tmp/qwen-migration-check/command.toml
cp /tmp/qwen-migration-check/command.toml /tmp/qwen-migration-check/command.toml.before
sha256sum /tmp/qwen-migration-check/command.toml \
  > /tmp/qwen-migration-check/source.sha256

# 在隔离目录中制造目标冲突；目标文件内容不应被迁移覆盖
printf 'existing destination\n' > /tmp/qwen-migration-check/command.md

# 执行迁移入口后，检查下面两项
sha256sum --check /tmp/qwen-migration-check/source.sha256
cmp -s /tmp/qwen-migration-check/command.toml \
        /tmp/qwen-migration-check/command.toml.before
printf 'toml_hash=%s markdown=' "$(sha256sum /tmp/qwen-migration-check/command.toml | cut -d' ' -f1)"
cat /tmp/qwen-migration-check/command.md
```

通过标准应是：原始 TOML 的哈希和冲突前副本一致，现有 Markdown 仍为“existing destination”，迁移工具没有替换或删除源文件。若目标文件被替换、源文件被静默删掉，或者迁移成功仍返回成功状态，那么不能把它判定为一次安全迁移。

未冲突场景同样不能只检查目标文件存在。应该比较迁移前后实际解释出的命令参数、默认值和条件分支。若发布前的 TOML 支持多个字段，而迁移后 Markdown 无法表达相同语义，就说明格式转换完成，但语义迁移可能尚未完成。

## 验收时把“成功”和“可回滚”分开

一次完整验证至少包含五个阶段：

1. 启动前检查：确认目标系统、版本和工作区是否属于隔离环境。
2. 启动后检查：确认状态目录在进程生成时存在，并具备 owner-private 权限。
3. 功能后检查：确认 artifact library 的磁盘集合与最终界面一致。
4. 冲突检查：确认目标已存在时原始 TOML 保持不变。
5. 回滚检查：确认迁移失败、进程退出或前端断线后仍能恢复原始工作方式。

这不是四个互相独立的通过项，而是一条证据链。目录权限测试通过，只能说明存储隔离；迁移测试通过，只能说明文件冲突规则有效；页面刷新成功，只能说明一次前端状态一致。只有每个阶段都建立证据，才能说“升级后的本地 Runtime 可以投入使用”。

回滚条件应提前写成可判断的规则。例如：只要状态目录权限检查失败，或原始 TOML 在冲突场景中发生变化，就停止升级。若 artifact 扫描最终集合与磁盘集合不一致，则先恢复旧版本或禁用该界面入口，而不是继续等待另一次刷新自动修复。

对于网络或图形后端，还应避免把不同平台的结果混在一起。llama.cpp b12633 的公开说明明确限定于修复 WebGPU 与非统一内存设备上的非零 clear 问题；并不意味着所有 llama.cpp 后端都已修复，也不意味着该结论适用于所有浏览器和显卡实现。工程上应建立平台矩阵，至少记录操作系统、架构、后端、设备、版本和一次可重复场景，不能把某一台设备的成功外推到整个平台。

## 原创结论：本次 Release 最重要的不是新功能，而是状态边界

v0.28.4 的信息密度集中在三个工程边界：进程启动时创建私有状态、产物通过增量扫描和流式更新呈现、配置迁移遇到目标冲突时保留原始 TOML。

其中，目录私有权限解决的是“能否安全落盘”；Artifact library 解决的是“能否让可变工作区状态稳定收敛”；命令迁移解决的是“升级能否保留旧配置”。三个问题看似相互独立，实际上共享同一个原则：每一种状态都必须有明确所有者、明确生命周期和明确失败行为。

对于团队来说，最值得采用的不是直接升级后看页面，而是把四类证据保留下来：启动日志、目录权限快照、产物扫描前后集合，以及 TOML 和 Markdown 冲突前后的哈希。这样每一次升级结论都可以由具体证据复现，也不会把“一次界面成功”误写成“完整 Runtime 安全可用”。

证据等级方面，llama.cpp 和 Qwen Code 的 Release 页面都属于项目发布方公开证据。前者是预发布构建说明，后者的准确标签是普通 Release；两者都只证明发布方声明的事实，不自动证明所有用户环境已经验证。下一次升级应继续以官方 Release、仓库构建产物、回滚记录和独立运行时检查作为分层证据，而不是把社区截图或个人体验直接等同于验收结论。

## 参考资料

- [Release v0.28.4](https://github.com/QwenLM/qwen-code/releases/tag/v0.28.4)
- [b12633](https://github.com/ggml-org/llama.cpp/releases/tag/b12633)
