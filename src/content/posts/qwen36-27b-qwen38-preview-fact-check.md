---
title: Qwen3.8 27B 已开源？先别急：真正开源的是 Qwen3.6-27B，3.8 目前更像 Max Preview 线索
author: Katelya
published: 2026-08-15
category: AI前沿
tags: [Qwen, 开源模型, Qwen Code, AI编程, 事实核验]
draft: false
pinned: false
comment: true
description: 网络上“Qwen3.8 27B 开源”的说法容易混淆两个事实：Qwen3.6-27B 已正式开放权重，而 qwen3.8-max-preview 已进入 Qwen Code 官方预设。本文把两者拆开核验。
---

# Qwen3.8 27B 已开源？先别急：真正开源的是 Qwen3.6-27B，3.8 目前更像 Max Preview 线索

这几天整理 AI 前沿选题时，我看到一个很容易被混在一起的说法：

> “Qwen3.8 27B 模型开源了。”

问题是，截止 2026 年 8 月 15 日，我能确认到的官方信息并不是这样。

目前至少有两个不同事实被很多人合并成了一句话：

1. **Qwen3.6-27B 已经正式开放权重；**
2. **`qwen3.8-max-preview` 已经进入 Qwen Code 官方仓库的模型预设。**

但我没有找到足够的一手证据证明存在一个已经正式开放权重、名为 **Qwen3.8-27B** 的模型。

所以这篇文章不急着追热点，先把型号理清楚。

## 已确认事实一：Qwen3.6-27B 正式开源

Qwen 团队在 2026 年 4 月 21 日发布 Qwen3.6-27B。

这是一个 **27B dense model**，并且是原生多模态模型，支持文本、图像与视频相关能力，同时支持 thinking / non-thinking 工作方式。

Qwen 官方把它定位为一个更适合开发者实际部署的规模：

- 27B dense architecture；
- 不需要处理 MoE routing 的额外复杂度；
- 面向 agentic coding；
- 开放权重；
- Hugging Face 模型仓库采用 Apache-2.0 License。

这才是目前“Qwen + 27B + 开源”最准确的组合。

## 为什么 27B 这个尺寸很有吸引力

在开源模型里，27B 左右一直是一个很有意思的区间。

它比 7B / 14B 有明显更高的能力上限，但又不像数百 B、万亿参数模型那样几乎只能依赖服务器集群。

对于有多卡工作站、量化部署、云 GPU 或实验室服务器的开发者来说，27B 依然属于“认真优化以后可以实际玩起来”的规模。

而且 dense model 的好处是部署路径相对直观：

- 不需要 MoE expert routing；
- 推理框架适配通常更直接；
- 性能分析更容易；
- 量化方案更成熟。

所以 Qwen3.6-27B 的真正意义并不是“参数不大但 benchmark 很高”这么简单，而是试图把更强的 coding / multimodal / reasoning 能力放进一个社区更容易使用的尺寸里。

## 官方 benchmark 很漂亮，但要保持正确阅读方式

Qwen 官方称 Qwen3.6-27B 在多个 agentic coding benchmark 上超过上一代 Qwen3.5-397B-A17B，例如：

- SWE-bench Verified；
- SWE-bench Pro；
- Terminal-Bench 2.0；
- SkillsBench。

其中官方给出的 SWE-bench Verified 为 77.2，Terminal-Bench 2.0 为 59.3。

这说明一个趋势：**参数总量正在越来越不能直接预测 Agent 实际表现。**

训练数据、post-training、工具使用、reasoning preservation、harness 适配都会显著影响最终体验。

但这些仍然属于厂商公布评测。真正选择模型时，我更建议结合自己的仓库和任务做 eval，而不是只按 leaderboard 排序。

## `preserve_thinking` 是一个值得注意的小细节

Qwen3.6-27B 官方介绍中特别提到 `preserve_thinking`。

它允许 Agent 在多轮会话中保留前序 thinking 内容。

这件事听起来不起眼，但对于长时间 coding agent 很关键。

一个 Agent 可能经历：

```text
理解需求
→ 读取代码
→ 推理
→ 调工具
→ 收到结果
→ 再推理
→ 修改代码
→ 测试
→ 修复失败
```

如果每一轮都把前面的 reasoning 状态粗暴丢掉，模型就更容易出现重复探索、前后决策不一致或突然忘记约束的问题。

所以我越来越认为，2026 年模型接口的竞争也会开始进入“状态如何保存”这一层。

## 已确认事实二：`qwen3.8-max-preview` 确实出现了

那么 Qwen3.8 是空穴来风吗？

也不是。

2026 年 7 月 19 日，Qwen Code 官方仓库合并了 PR #7199，把：

```text
qwen3.8-max-preview
```

加入 Alibaba Cloud Model Studio / Token Plan 的内置模型列表。

该 PR 中写入的模型预设包括：

- `contextWindowSize: 1000000`；
- `enableThinking: true`；
- image input；
- video input。

因此可以比较有把握地说：

> **Qwen3.8-Max-Preview 作为托管模型标识，已经进入 Qwen 官方开发工具链。**

这比普通论坛传闻可信得多，因为它已经被合并进 QwenLM 官方仓库。

## 但这不等于“Qwen3.8-27B 开源”

这里就是最容易混淆的地方。

`qwen3.8-max-preview` 这个名字至少告诉我们三件事：

- 它属于 3.8 命名；
- 它是 Max；
- 它还是 Preview。

但它没有告诉我们：

- 参数量是不是 27B；
- 是否开放权重；
- 是否 Apache-2.0；
- 是否已经发布官方 model card；
- 是否已经存在 Hugging Face 权重仓库。

截止本文撰写时，我没有找到一手来源把这些信息补全。

因此“Qwen3.8 27B 已开源”至少目前不能作为确定事实发布。

## 我更怀疑这是两条新闻被拼到了一起

目前最合理的解释是：

```text
Qwen3.6-27B（正式开放权重）
+
qwen3.8-max-preview（官方工具链已出现）
↓
被二手传播压缩成
“Qwen3.8 27B 开源”
```

这在 AI 新闻里非常常见。

模型迭代速度太快，Preview、API model、open weights、base model、instruct model、thinking mode 又经常同时出现，最后标题党很容易把几个概念拼成一个不存在的产品。

## 如果你现在想用 Qwen，怎么选？

如果目标是 **开放权重 + 27B + 自部署**：

优先看 **Qwen3.6-27B**。

如果目标是体验最新托管 Max 模型：

可以关注 `qwen3.8-max-preview` 在 Alibaba Cloud Model Studio / Qwen Code 中的实际可用状态，但要接受 Preview 型号可能变化。

如果目标是 Coding Agent：

除了看模型，还要重点看 Qwen Code、Claude Code 兼容协议、上下文管理和 thinking preservation。

## 我的判断

这次事实核验反而比直接写一篇“Qwen3.8 多强”更有价值。

AI 进入高频发布时代以后，技术博客最容易失去的不是更新速度，而是 **信息层级感**。

我以后会尽量把来源分成：

- 官方正式发布；
- 官方代码 / PR 线索；
- Preview；
- 社区测试；
- 普通传闻。

只有把这些层次区分开，博客才不会几个月以后变成一堆失效的“震惊体新闻”。

截至 2026 年 8 月 15 日，更准确的结论是：

> **Qwen3.6-27B 已开放权重；Qwen3.8-Max-Preview 已进入 Qwen Code 官方预设；“Qwen3.8-27B 已开源”尚缺乏官方证据。**

## 参考资料

- Qwen 官方：Qwen3.6-27B: Flagship-Level Coding in a 27B Dense Model  
  https://qwen.ai/blog?id=qwen3.6-27b
- Qwen 官方 Hugging Face：Qwen3.6-27B  
  https://huggingface.co/Qwen/Qwen3.6-27B
- Qwen Code PR #7199：add qwen3.8-max-preview to Token Plan model list  
  https://github.com/QwenLM/qwen-code/pull/7199
