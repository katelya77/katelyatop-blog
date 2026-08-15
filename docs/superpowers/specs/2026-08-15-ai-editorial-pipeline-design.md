# AI 前沿原创博客编辑流水线设计

## 目标

把 `Katelya · 思囿随笔` 的 AI 技术内容维护成一条长期运行的编辑流水线：持续发现值得写的前沿动态，优先使用官方与一手资料核验事实，用独立结构和技术判断撰写中文原创文章，通过 PR/CI 后合并到 `master`，沿用 Cloudflare Pages 与现有 CDN 流程发布。

## 核心原则

1. **事实优先于热点**：型号、发布日期、开源状态、上下文长度、许可证、参数量等关键事实必须由官方博客、官方文档、官方 GitHub/Hugging Face、论文或 Release 支撑。
2. **不把传闻写成正式发布**：若只有预览、代码预设、Issue/PR 或第三方消息，文章必须明确标注“预览 / 线索 / 尚未正式发布”。
3. **原创不是同义改写**：文章应重新设计结构，加入开发者视角、技术背景、关键差异、部署/使用提示、风险与判断；不复制原文段落，不把翻译当原创。
4. **来源透明**：每篇文章末尾保留“参考资料”，链接到关键一手来源；引用代码时优先使用官方示例或自行重写的最小示例。
5. **数量服从质量**：没有足够重要的新内容时不凑数；重大模型、Agent/Harness、推理框架、开源权重、基础设施、研究突破可以单独成篇。
6. **发布必须可回滚**：所有文章进入独立 `content/*` 分支，经 PR、现有 GitHub Actions 检查与 diff 复核后再 squash merge。

## 选题范围

- Frontier models：DeepSeek、OpenAI、xAI、Qwen、Anthropic、Google DeepMind、Meta 等。
- Open-weight / open-source：模型权重、推理框架、Agent Harness、MCP、CLI、工具链。
- Agentic coding：Codex、Grok Build、Qwen Code、Claude Code 生态、Harness 设计与可靠性。
- 推理与部署：vLLM、SGLang、量化、KV cache、稀疏注意力、长上下文、MoE。
- 研究与工程：论文、系统卡、基准评测、真实工程经验。

## 内容结构

默认文章应包含：

1. 为什么这件事值得关注；
2. 已确认的事实；
3. 技术上真正变化了什么；
4. 与上一代或同类方案的差异；
5. 对开发者 / 自部署用户 / Agent 使用者的意义；
6. 需要警惕的宣传口径、限制或尚未确认的信息；
7. 参考资料。

对于“型号传闻/预览”类选题，必须增加“事实核验”小节，将已确认与未确认内容分开。

## 图片与视觉

优先级：

1. 自制 / 生成的原创封面；
2. 官方允许转载或明确开放许可的图；
3. 官方页面的必要截图（仅在合理引用范围内，并注明来源）。

禁止批量热链未知版权图片或把第三方文章配图直接搬入仓库。没有合适图片时，宁可先发布纯文字文章。

## 自动化数据流

`Web research → source verification → existing-post dedupe → topic selection → original draft → frontmatter/source check → content branch → PR → GitHub Actions → diff review → squash merge → Cloudflare Pages/CDN`

## 失败处理

- 来源互相冲突：不发布结论性文章，保留为“待确认”。
- CI 失败：停止自动合并，先定位失败是否与文章变更有关。
- PR 出现非预期源码/配置变更：停止合并。
- 内容只有单一二手来源：降级为候选选题，不直接发布。

## 首批选题（2026-08-15）

1. DeepSeek V4 Pro：1M 上下文、1.6T/49B MoE 与开源意义。
2. Grok 4.5：模型侧能力升级与 GitHub Copilot 落地。
3. Harness 时代：从社区 DeepSeek Harness 到 xAI 开源 Grok Build。
4. Qwen3.6-27B 与 `qwen3.8-max-preview`：27B 开源事实与 3.8 预览核验。
5. GPT-5.6：2026 年前沿模型从“聊天”走向长时任务与高效率推理。
