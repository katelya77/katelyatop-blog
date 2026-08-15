# AI 前沿原创博客编辑流水线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可持续运行的 AI 前沿选题、核验、原创撰写、PR、CI、合并与发布流程，并完成 2026-08-15 首批文章。

**Architecture:** 外部信息只负责提供事实与一手证据；文章本身由独立编辑逻辑重组。GitHub 仓库是内容事实源，所有新文章进入 `src/content/posts/` 的独立分支，并通过现有 `lint.yml` 的 Biome、Tests、Astro Check、Build、Playwright 门禁后进入 `master`。

**Tech Stack:** Astro Content Collections、Markdown、GitHub Actions、Cloudflare Pages、GitHub PR workflow、Web research。

## Global Constraints

- 关键发布事实优先使用官方博客、官方文档、官方 GitHub/Hugging Face、论文或 Release。
- 未正式发布的型号必须明确写成预览、代码线索或待确认状态。
- 禁止机械同义改写、整篇翻译或批量搬运第三方文章。
- 每篇文章必须包含参考资料。
- 不提交未知版权图片；没有合适图片时先使用纯文字文章。
- PR diff 不得包含非预期源码、密钥或部署配置变更。

---

### Task 1: 建立首批内容分支与编辑规范

**Files:**
- Create: `docs/superpowers/specs/2026-08-15-ai-editorial-pipeline-design.md`
- Create: `docs/superpowers/plans/2026-08-15-ai-editorial-pipeline.md`

**Interfaces:**
- Consumes: 当前 `master` 文章结构和 GitHub Actions 配置。
- Produces: 后续自动编辑任务共同遵循的事实核验与发布边界。

- [x] **Step 1:** 从 `master` 创建 `content/ai-frontier-2026-08-15`。
- [x] **Step 2:** 写入设计规范。
- [x] **Step 3:** 写入本实施计划。

### Task 2: 发布 DeepSeek V4 Pro 深度解读

**Files:**
- Create: `src/content/posts/deepseek-v4-pro-million-context.md`

**Interfaces:**
- Consumes: DeepSeek 官方 API News、官方 Hugging Face 模型卡与技术报告。
- Produces: 一篇独立的模型架构与开源意义解读。

- [ ] **Step 1:** 核验 1.6T 总参数、49B 激活、1M context、CSA+HCA、mHC、Muon、MIT 权重许可。
- [ ] **Step 2:** 以中文原创结构解释“长上下文成本下降”而非复制模型卡。
- [ ] **Step 3:** 添加一手参考资料。
- [ ] **Step 4:** 提交文章。

### Task 3: 发布 Grok 4.5 与 Grok Build/Harness 两篇文章

**Files:**
- Create: `src/content/posts/grok-4-5-coding-agent.md`
- Create: `src/content/posts/agent-harness-deepseek-grok-build.md`

**Interfaces:**
- Consumes: xAI 官方 Grok 4.5、GitHub Copilot、Grok Build 开源公告与官方代码仓库；社区 DeepSeek Harness 仅作为案例并明确非官方。
- Produces: 模型能力文章 + Harness 工程层文章。

- [ ] **Step 1:** 核验 Grok 4.5 为当前官方发布版本，避免写成不存在的 Grok 4.6。
- [ ] **Step 2:** 核验 Grok Build 已开源其 agent loop、tools、TUI 与扩展系统。
- [ ] **Step 3:** 清楚区分“DeepSeek 官方模型”和“社区 DeepSeek Harness 项目”。
- [ ] **Step 4:** 分别提交两篇文章。

### Task 4: 发布 Qwen 事实核验文章

**Files:**
- Create: `src/content/posts/qwen36-27b-qwen38-preview-fact-check.md`

**Interfaces:**
- Consumes: Qwen 官方 Qwen3.6-27B 博客、Hugging Face 模型卡、Qwen Code 已合并 PR #7199。
- Produces: 将“Qwen3.6-27B 已开源”和“qwen3.8-max-preview 已进入官方工具预设但并非 27B 开源发布”明确拆分。

- [ ] **Step 1:** 核验 Qwen3.6-27B 为 Apache-2.0 开放权重的 27B dense multimodal model。
- [ ] **Step 2:** 核验 Qwen Code PR #7199 已加入 `qwen3.8-max-preview`、1M context、thinking、image/video 输入。
- [ ] **Step 3:** 明确不存在足够官方证据支持“Qwen3.8-27B 已开源”。
- [ ] **Step 4:** 提交文章。

### Task 5: 发布 GPT-5.6 趋势解读

**Files:**
- Create: `src/content/posts/gpt-5-6-frontier-intelligence.md`

**Interfaces:**
- Consumes: OpenAI 官方 GPT-5.6 发布页及相关产品资料。
- Produces: 以“每 token 效率、按需推理、长任务”作为核心的趋势解读。

- [ ] **Step 1:** 核验发布时间、定位与后续价格更新。
- [ ] **Step 2:** 避免复述营销语，重点解释产品/工程含义。
- [ ] **Step 3:** 添加官方参考资料并提交。

### Task 6: PR、CI 与发布

**Files:**
- Review: 本分支全部新增 Markdown 文件。

**Interfaces:**
- Consumes: Tasks 1-5 的提交。
- Produces: 合并到 `master` 的首批 AI 前沿原创内容。

- [ ] **Step 1:** 创建 PR，正文列出选题与事实来源边界。
- [ ] **Step 2:** 复核 PR diff 仅包含规范文档与文章。
- [ ] **Step 3:** 等待 Biome、Tests、Type Check、Build；Playwright 若失败需判断是否为既有 UI 回归且与纯内容变更无关。
- [ ] **Step 4:** 必要检查通过且 diff 安全后 squash merge。
- [ ] **Step 5:** 确认 `master` push 已触发现有 GitHub Actions / CDN 流程。
