---
title: DeepSeek V4 Pro 开源了：1M 上下文背后，真正值得关注的不是参数量
author: Katelya
published: 2026-08-15
category: AI前沿
tags: [DeepSeek, 大模型, 开源模型, Agent, 长上下文]
draft: false
pinned: false
comment: true
description: DeepSeek V4 Pro 已正式开放权重。本文从 1.6T/49B MoE、1M 上下文、CSA+HCA、mHC 与 FP4/FP8 混合精度出发，分析它对长上下文和 Agent 工程意味着什么。
---

# DeepSeek V4 Pro 开源了：1M 上下文背后，真正值得关注的不是参数量

如果只看标题，DeepSeek V4 Pro 最容易被记住的数字大概是 **1.6T 参数**。

但我觉得真正值得关注的并不是“又一个万亿参数模型”，而是 DeepSeek 正在把竞争重点从单纯堆规模，继续往 **长上下文成本、Agent 执行效率和真实部署可行性** 推。

2026 年 4 月，DeepSeek 官方发布 V4 Preview，并同步开放 DeepSeek-V4-Pro 与 V4-Flash。V4-Pro 的总参数量为 **1.6T**，单 token 推理时激活约 **49B** 参数，支持 **1,048,576 tokens，也就是约 1M 上下文**。

这不是一个只存在于 API 里的闭源型号。官方 Hugging Face 仓库已经提供模型权重，并采用 MIT License。

## 先看几个已经确认的关键参数

DeepSeek 官方模型卡给出的 V4-Pro 核心信息包括：

- 1.6T 总参数，49B 激活参数；
- Mixture-of-Experts（MoE）架构；
- 1M token context；
- 专家权重主要使用 FP4，其余关键部分以 FP8 为主；
- 预训练数据超过 32T tokens；
- 支持更高推理预算的 Think Max 模式；
- 官方建议本地部署时使用 `temperature=1.0`、`top_p=1.0`。

单看这些规格，V4-Pro 已经不是普通消费级显卡可以轻松完整托管的模型。它的价值更多体现在“开放一个前沿级模型及其技术路线”，而不是让每个人都在桌面电脑上直接跑满血版本。

## 1M 上下文最难的其实不是“能不能塞进去”

上下文窗口从 128K、256K 继续扩到 1M，最直观的用途是把大型代码仓库、长时间 Agent 轨迹、论文与文档集合一次性放入上下文。

但真正的工程问题是：**KV Cache 会不会先把显存吃光？每生成一个 token 的注意力计算会不会越来越贵？**

DeepSeek V4 引入了混合注意力结构，将 **Compressed Sparse Attention（CSA）** 与 **Heavily Compressed Attention（HCA）** 结合。

按照官方技术报告的对比口径，在 1M 上下文场景下，V4-Pro 的单 token 推理 FLOPs 可以下降到 V3.2 的约 **27%**，KV Cache 需求约为 V3.2 的 **10%**。

这组数字当然仍然需要结合真实硬件、batch、推理框架和工作负载来看，但方向很重要：

> 长上下文的下一阶段竞争，不只是“支持多少 token”，而是谁能让这些 token 真正用得起。

如果一个模型号称 1M context，但实际每轮 Agent 都因为 KV Cache、延迟和成本无法持续运行，那么这个上下文窗口很大程度上只是规格表里的数字。

## mHC：一个不那么吸睛，但很重要的改动

DeepSeek V4 还引入了 **Manifold-Constrained Hyper-Connections（mHC）**。

可以简单把它理解为：在超深网络里，模型并不是只需要“更多层”，还要保证信息在层与层之间传递时足够稳定。传统 residual connection 很重要，但随着模型继续扩张，信号传播、训练稳定性和表达能力之间的平衡会越来越难。

mHC 的目标就是进一步改造这条“信息高速公路”。

这类结构创新通常不像参数量和 benchmark 那么适合营销，但往往决定了一代模型是否能稳定训练、是否能继续扩大规模。

## Muon 进入万亿参数训练

另一个值得注意的细节是 **Muon optimizer**。

DeepSeek 在 V4 训练中明确使用 Muon，以提高收敛速度和训练稳定性。过去一年，Muon 在大模型训练领域的关注度持续提高，而 V4 把它推到了更大的训练规模。

这意味着未来开源模型竞争的差距不再只是“数据多少”和“GPU 多少”，优化器、数值精度、通信、注意力结构和训练基础设施会越来越共同决定最终结果。

## FP4 + FP8：前沿模型也开始更认真地算“推理账”

V4-Pro 的 MoE expert parameters 使用 FP4，其他部分主要使用 FP8。

这和传统“训练完再随便量化一下”不太一样。混合精度已经开始变成模型发布规格的一部分，意味着模型架构和推理硬件正在被一起设计。

对于 1.6T 这种级别的模型，如果仍然坚持高精度权重，部署成本会非常夸张。

所以我更愿意把 V4 看作一个信号：

**未来 Frontier Model 的性能指标里，模型质量、每 token 计算量、显存占用和推理吞吐会越来越同等重要。**

## 它对 Agent 真正意味着什么？

长上下文并不自动等于更好的 Agent。

一个真正能长期工作的 Agent 还需要：

1. 稳定的 tool calling；
2. 正确保存 reasoning / tool history；
3. 对长上下文进行压缩和缓存；
4. 在任务失败时重试；
5. 控制 shell、文件、网络等工具权限；
6. 让模型知道什么时候继续、什么时候验证、什么时候结束。

也正因为这样，2026 年我越来越关注的不是“模型排行榜谁高 2 分”，而是 **模型 + Harness + Tools + Context Management** 这整套系统。

DeepSeek V4-Pro 给了模型层更大的上下文和更强的 Agent 能力，但最终用户体验，很可能取决于外面的 Harness 写得有多好。

## 本地部署并不等于“家用显卡部署”

虽然 V4-Pro 是开放权重，但 1.6T 总参数意味着满血部署依旧是数据中心级任务。

vLLM 社区已经提供 V4-Pro 的部署 recipe，并针对 H200、B200、GB200、GB300、MI355X 等硬件给出配置建议。对于真正想自托管的人来说，这些推理框架的支持速度，和模型开放本身一样重要。

个人开发者更现实的选择可能是：

- 使用官方 API；
- 使用 V4-Flash 等较小版本；
- 等待社区量化与更成熟的推理支持；
- 把 V4-Pro 当作研究架构、Agent protocol 与长上下文设计的重要参考。

## 我的判断

DeepSeek V4-Pro 最值得关注的不是“1.6T”这个数字。

真正重要的是三个趋势同时出现：

- **1M 上下文正在进入前沿模型常态；**
- **稀疏/压缩注意力开始直接解决长上下文成本；**
- **模型发布越来越围绕 Agent 与真实推理系统设计。**

当大模型从“回答一个问题”走向“连续工作几十分钟甚至几小时”，真正决定体验的，很可能不再是单次 benchmark，而是它能不能在巨量上下文、工具调用和长任务里保持稳定。

DeepSeek V4 正好站在这个转折点上。

## 参考资料

- DeepSeek API Docs：DeepSeek V4 Preview Release  
  https://api-docs.deepseek.com/news/news260424
- DeepSeek 官方 Hugging Face：DeepSeek-V4-Pro  
  https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro
- vLLM Recipes：DeepSeek-V4-Pro  
  https://github.com/vllm-project/recipes/blob/main/models/deepseek-ai/DeepSeek-V4-Pro.yaml
