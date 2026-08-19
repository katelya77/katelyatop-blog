---
title: RX 6000 终于能在 Windows 原生跑 vLLM 了？从 ROCm Runtime、TheRock 到 gfx1031 的真实支持边界
author: Katelya
published: 2026-08-19
category: 技术分享
tags: [vLLM, ROCm, AMD, Windows, RDNA2, TheRock, 本地大模型, GPU推理]
draft: false
pinned: false
comment: true
description: 从近期 RX 6750 XT 原生 Windows 跑通 vLLM 的社区实验出发，拆开 AMD ROCm Runtime、HIP SDK、TheRock、rocBLAS 与 vLLM 平台支持的层级差异，并给出一套不把“能跑”误判成“官方支持”的验证方法。
---

最近本地推理社区出现了一个很有意思的进展：有人在 **Windows 11 + RX 6750 XT（gfx1031）** 上，把 ROCm、PyTorch 和 vLLM 串了起来，而且不是走 WSL2。

作者给出的最新社区测试里，rocBLAS FP16 GEMM 约为 **25.97 TFLOPS**，某个模型工作负载的 decode 报到了约 **62 tok/s**，并进一步做成了一键安装形式。

这类消息很容易被压缩成一句：

> “RX 6000 现在已经官方支持 Windows 原生 vLLM 了。”

但这句话目前并不准确。

真正值得研究的是：**为什么一张在 AMD Windows 支持表里只有 Runtime、没有完整 HIP SDK 支持的 gfx1031 显卡，仍然可能被社区补齐到足以运行 PyTorch + vLLM？**

这背后其实是一个很典型的软件栈分层问题。本文不把社区 benchmark 当官方性能结论，也不建议直接在生产环境照抄未知二进制包；我更想把这条链路拆开，看清楚“驱动能识别”“HIP 能运行”“数学库齐全”“PyTorch 可用”“vLLM 可启动”和“上游正式支持”到底差多少层。

## 1. 先说结论：这不是一个开关，而是六层依赖

很多人理解 GPU 软件支持时，会想象成：

```text
显卡支持 ROCm = 所有 ROCm 应用都能运行
```

实际上更接近：

```text
Windows Driver
      ↓
HIP / OpenCL Runtime
      ↓
rocBLAS / hipBLAS / MIOpen / 其他数学库
      ↓
PyTorch ROCm wheel
      ↓
vLLM custom kernels + platform glue
      ↓
模型 / attention backend / quantization / serving
```

任何一层缺失，都可能出现非常迷惑的状态：

```text
torch.cuda.is_available() == True
```

但一跑模型就因为某个 BLAS kernel、attention kernel 或扩展编译失败而退出。

所以以后看到“某张 AMD 卡已经支持 ROCm”，我第一件事不是问“能不能跑模型”，而是问：**支持到了哪一层？**

## 2. AMD 官方的 Runtime 和 HIP SDK 是两件事

AMD 当前面向 Radeon / Ryzen 的 Windows 系统要求页面，会分别列出：

```text
Runtime
HIP SDK
```

这两个勾不是装饰。

以 RX 6750 XT / 6700 XT 的 `gfx1031` 为例，当前表格中可以看到 **Runtime 支持，但 HIP SDK 并非完整官方支持**。

AMD 对两者的定义也很清楚：Runtime 主要让 HIP/OpenCL runtime 工作；HIP SDK 则在 runtime 之外，还包含更多开发与数学库组件。

这解释了一个常见现象：

```text
GPU 可以被 HIP 发现
≠
开发者需要的所有 ROCm 库都已经有官方预编译包
```

对于普通图形应用，这个差异可能不明显；但对 LLM inference，它非常关键，因为矩阵乘法、attention、量化 kernel、collective communication 都会不断碰到底层库。

## 3. 为什么 TheRock 改变了这件事？

这里要引出 ROCm 的一个非常值得关注的项目：**TheRock**。

TheRock 是 AMD ROCm 组织下的开源构建系统，用 CMake 把 HIP / ROCm 的多个组件组织起来。它的目标之一就是让开发者能够更灵活地构建 ROCm，而不是完全依赖传统发行版里已经打包好的组合。

更关键的是，它明确在推进 **native Windows**。

TheRock 当前的 GPU 支持表已经把大量 RDNA2 target 纳入构建矩阵，其中包括：

```text
gfx1030  RX 6800 / 6900 系列
gfx1031  RX 6700 / 6750 系列
gfx1032  RX 6600 系列
```

其 release 文档也已经提供 `device-gfx1031` 这类 device-specific package 选择方式。

这意味着一个很重要的变化：

> “AMD 官方产品支持矩阵里没有完整 HIP SDK”与“这些开源组件无法为该 target 构建”并不是同一件事。

社区可以从 TheRock 的构建链获得针对 gfx1031 的 PyTorch / ROCm 组件，再补齐应用真正需要的库。

## 4. 这次社区实验真正补的是什么？

近期 RX 6750 XT 的实验并不是凭空让 vLLM 学会了 AMD。

vLLM 本来就有 ROCm backend；问题主要是它的官方 GPU 安装路径仍以 **Linux** 为主，而且当前文档明确写着 vLLM **不原生支持 Windows**，Windows 用户通常需要 WSL 或社区维护方案。

另一方面，RX 6750 XT 的 Windows ROCm 状态又不是完整 HIP SDK。

于是社区方案做的事情更像：

```text
TheRock / ROCm Windows runtime
        +
针对 gfx1031 的数学库
        +
PyTorch ROCm Windows build
        +
vLLM Windows ROCm platform plugin / build glue
        =
能够真正执行 inference 的实验栈
```

最新社区帖子中特别提到为 gfx1031 补了 rocBLAS binary，这一点很合理：LLM 的大量线性层最终都要落到高性能 GEMM，只有 HIP runtime 而没有适合目标架构的 BLAS 库，距离高性能推理还差很远。

## 5. 为什么 `torch.cuda.is_available()` 在 AMD 上也是 True？

第一次接触 ROCm 的人经常会被这个现象迷惑：

```python
import torch
print(torch.cuda.is_available())
```

AMD GPU 也可能返回 `True`。

这不是机器偷偷装了 NVIDIA CUDA。

PyTorch 为了 API 兼容，ROCm backend 继续复用了大量 `torch.cuda` namespace。对上层代码来说，这可以减少 CUDA / HIP 双平台分支；底层真正执行的是 ROCm/HIP。

因此判断环境时不要只截图：

```text
cuda_available = True
```

更应该一起记录：

```python
import torch

print(torch.__version__)
print(torch.version.hip)
print(torch.cuda.get_device_name(0))
print(torch.cuda.get_device_properties(0))
```

如果要做可复现报告，我还会记录 driver、ROCm build、GPU target、Python、vLLM commit/version。

## 6. rocBLAS 26 TFLOPS 能说明什么，又不能说明什么？

社区最新结果给出了一个 4096×4096×4096 FP16 GEMM，约 **25.97 TFLOPS**。

这个数字有价值，因为它至少证明：

```text
不是只识别到了 GPU
不是纯 CPU fallback
rocBLAS 的 gfx1031 kernel 确实在工作
```

但它不能推出：

```text
所有 LLM 都能达到同样利用率
所有 attention backend 都正常
长上下文性能很好
vLLM 比 llama.cpp / WSL2 更快
```

LLM decode 并不是一个孤立的巨大 GEMM benchmark。

实际生成还包括：

```text
QKV projection
attention
KV cache read/write
RMSNorm
RoPE
sampling
scheduler
quant/dequant kernel
Python / runtime orchestration
```

尤其在 batch=1 的本地聊天场景，decode 经常更接近 **memory-bandwidth-bound**，而不是纯 FP16 算力比赛。

所以“26 TFLOPS”应该被当成底层计算链已经通了的证据，而不是最终 LLM 性能结论。

## 7. 62 tok/s 同样不能脱离模型与参数

社区帖子中的约 62 tok/s 是更接近用户体验的数字，但我仍然不会直接拿它和另一张 GPU 的 Reddit 截图横比。

至少需要同时知道：

```text
model
parameter count
quantization / dtype
prompt length
output length
batch size
attention backend
KV cache dtype
enforce eager / compile
sampling settings
```

同一张卡上：

```text
7B Q4 的 62 tok/s
```

和：

```text
14B FP16 的 62 tok/s
```

完全不是一个概念。

因此这次进展最值得关注的不是“62”，而是 **Windows native 的 vLLM execution path 已经被社区证明可以打通到真实 token generation**。

## 8. 为什么我觉得这对旧 RDNA2 用户很重要？

过去本地 LLM 对 AMD 用户最大的痛点之一，并不只是理论性能，而是软件路径碎片化。

典型选择大概是：

```text
Windows + llama.cpp / Vulkan
Windows + WSL2 + ROCm
Linux + ROCm
Windows native + DirectML
```

而 vLLM / SGLang 这类现代 serving engine 的很多能力——continuous batching、paged KV、prefix caching、speculative decoding、OpenAI-compatible serving——往往首先围绕 Linux + CUDA/ROCm 成熟。

如果 TheRock 的 Windows 构建继续成熟，真正有意义的变化不是“多一个 benchmark”，而是：

> Windows AMD 用户开始有机会进入和服务器推理更接近的 runtime 生态。

对于一张已经用了几年的 RX 6700 XT / 6750 XT，这相当于延长了硬件的 AI 生命周期。

## 9. 但当前仍然不应该叫“官方 Windows vLLM 支持”

这里必须把边界说清楚。

截至本文整理时，vLLM 官方安装文档仍然要求主流 GPU 路径使用 Linux，并明确说明 **Windows 不属于原生官方支持平台**。

TheRock 的 Windows 文档也提醒：Windows source build 虽然已经能工作，但整体仍然较新，存在已知问题和持续开发区域。

所以更准确的描述是：

```text
AMD / TheRock：
Windows ROCm 开源构建能力正在快速成熟

社区：
已经把 gfx1031 + PyTorch + rocBLAS + vLLM 路径打通

vLLM upstream：
仍未把 native Windows 列为正式支持 OS
```

三句话同时成立。

这也是我认为技术博客必须区分“项目能做到”和“厂商承诺支持”的原因。

## 10. 真正容易踩坑的是 kernel coverage

一个 inference engine 能启动，并不意味着所有 feature 都可用。

例如不同 workload 可能走：

```text
Triton attention
FlashAttention
custom C++/HIP ops
rocBLAS
hipBLASLt
quantization kernels
collective communication
```

Windows ROCm 某个组件缺失时，最常见的结果不是整个 ROCm 完全不可用，而是：

```text
模型 A 能跑
模型 B 在 attention backend 崩
量化格式 C 不支持
compile 模式失败但 eager 能跑
单卡能跑，多卡 RCCL 路径不可用
```

这就是为什么我更愿意把当前阶段称为 **feature matrix 验证期**。

## 11. 如果我有 RX 6700 XT / 6750 XT，我会这样验证

第一阶段只验证底层，不急着下载几十 GB 模型：

```text
1. HIP 能看到 gfx1031
2. PyTorch 能分配 GPU tensor
3. FP16 matmul 正确
4. rocBLAS benchmark 正常
5. 显存申请 / 释放没有异常
```

第二阶段验证 vLLM 基础链：

```text
6. 启动一个小模型
7. greedy decoding 固定输出
8. 连续跑 50~100 次请求
9. 观察 VRAM 是否持续增长
10. 检查是否存在 CPU fallback
```

第三阶段才测试性能：

```text
prompt: 512 / 4K / 16K
output: 128 / 512 / 2K
concurrency: 1 / 4 / 16
```

记录：

```text
TTFT
TPOT
output tok/s
aggregate tok/s
peak VRAM
GPU utilization
功耗
```

最后再和 WSL2 / Linux / llama.cpp 做 A/B。

如果 native Windows 只是在短 prompt 单流里快一点，但长上下文不稳定，那我不会为了“原生”二字迁移生产服务。

## 12. 安装社区一键包之前，我会先做供应链检查

“一键安装”很方便，但 GPU runtime 是一个权限很高、二进制很多的环境。

尤其当安装包包含：

```text
DLL
Python wheel
自定义 kernel
驱动相关组件
PowerShell / batch installer
```

我会至少做这些检查：

```text
确认仓库源码和 release 对应
查看 release hash / checksum
扫描安装脚本实际下载了什么
不要在已有生产 Python 环境覆盖安装
优先 Windows Sandbox / 测试机 / 独立 venv
记录安装前后的 PATH 与 DLL 搜索路径
```

如果项目只给一个网盘 exe，没有源码、没有构建说明、没有 hash，我宁愿自己按 TheRock 文档构建，也不会为了省半小时把主力机交给未知二进制。

## 13. 这件事真正说明了 ROCm Windows 的什么趋势？

我认为最值得观察的是 **TheRock 正在把“官方发行版支持范围”和“开源可构建范围”拆开**。

以前某张 Radeon 不在完整 SDK matrix 里，普通用户几乎只能等。

现在更像：

```text
上游源码已经支持 target
        ↓
CI / nightly 能产出组件
        ↓
社区验证特定 GPU
        ↓
应用项目补 platform glue
        ↓
真实 workload 反向暴露缺失 kernel
        ↓
推动上游完善
```

这是一条很健康的硬件 enablement 路径。

但它也要求用户具备更强的判断能力：**nightly 可构建、社区可运行和 production supported 永远不是同一个状态。**

## 14. 对本地 Coding Agent 来说，下一步最值得测什么？

如果这套 Windows native vLLM 在 RDNA2 上继续成熟，我最想看的并不是再跑一个 7B chat benchmark，而是 Coding Agent 的真实 workload：

```text
32K repository context
prefix cache 命中
连续 tool-call 回合
JSON / structured output
长时间 KV cache 稳定性
多个 Agent 并发
```

因为 Coding Agent 的价值不在一次 128-token demo，而在几十分钟的连续交互。

尤其值得比较：

```text
native Windows vLLM
vs
WSL2 vLLM ROCm
vs
Linux vLLM ROCm
vs
llama.cpp Vulkan/HIP
```

如果 native 路径最终能做到接近 Linux 的 feature coverage，同时保留 Windows 桌面环境的便利，那才是 RX 6000 用户真正值得兴奋的节点。

## 结语

这次 RX 6750 XT 原生 Windows 跑通 vLLM，我更愿意把它理解成一个 **软件栈边界被社区往前推了一格** 的事件，而不是“AMD 已经全面支持 Windows vLLM”。

它证明了三件事：

1. `gfx1031` 并不是硬件上无法做现代 ROCm 推理；
2. TheRock 正在让 Windows 上的 ROCm 组件构建变得越来越现实；
3. vLLM 的 Windows 障碍越来越像工程集成与 kernel coverage 问题，而不是一个绝对不可跨越的平台墙。

对旧 Radeon 用户来说，这是好消息。但在真正迁移之前，我仍然会坚持同一个原则：

> **先看 support matrix，再看 component coverage，最后才看 tok/s。**

因为在 GPU 推理世界里，“跑起来”通常只是第一层测试。

---

### 参考资料

- AMD ROCm Radeon/Ryzen Windows System Requirements：<https://rocm.docs.amd.com/projects/radeon-ryzen/en/latest/docs/shared/hipsdk/reference/system-requirements.html>
- ROCm TheRock：<https://github.com/ROCm/TheRock>
- TheRock Windows Support：<https://github.com/ROCm/TheRock/blob/main/docs/development/windows_support.md>
- TheRock Supported GPUs：<https://github.com/ROCm/TheRock/blob/main/SUPPORTED_GPUS.md>
- vLLM GPU Installation / ROCm Requirements：<https://docs.vllm.ai/en/latest/getting_started/installation/gpu/>
- 社区 RX 6750 XT Windows native vLLM 实验（性能数字仅代表作者环境）：<https://www.reddit.com/r/ROCm/comments/1vrkh4l/native_vllm_rocm_715_runtime_for_rx_6000_rdna2_on/>
