# Katelya · 思囿随笔

> 一座持续生长的个人数字花园。记录技术折腾、项目实践、大学生活，以及那些值得被长期保存的思考与经验。

<p align="center">
  <a href="https://blog.katelya.top/"><strong>访问博客</strong></a>
  ·
  <a href="https://github.com/katelya77/katelyatop-blog/actions"><strong>构建状态</strong></a>
  ·
  <a href="https://github.com/katelya77/katelyatop-blog/issues"><strong>Issue</strong></a>
</p>

<p align="center">
  <img alt="Astro" src="https://img.shields.io/badge/Astro-7.x-BC52EE?logo=astro&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11.x-F69220?logo=pnpm&logoColor=white">
  <img alt="Cloudflare Pages" src="https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?logo=cloudflare&logoColor=white">
  <a href="https://github.com/katelya77/katelyatop-blog/actions/workflows/lint.yml"><img alt="CI" src="https://github.com/katelya77/katelyatop-blog/actions/workflows/lint.yml/badge.svg"></a>
</p>

![Katelya Blog Preview](./README.webp)

## 关于这个仓库

`katelyatop-blog` 是我长期维护的个人博客源码，而不是单纯的主题镜像。

它以 Astro 为核心，在 Mizuki / Fuwari 的开源基础上持续重构，并逐步加入属于自己的视觉语言、响应式布局、文章体验、内容组织方式和部署链路。现在的目标不是“堆功能”，而是把它做成一个稳定、耐看、可以陪我很多年的个人主页与数字档案。

站点目前使用：

- **站点名称：** Katelya · 思囿随笔
- **线上地址：** https://blog.katelya.top/
- **内容定位：** 技术笔记、项目记录、经验复盘、生活随笔
- **默认语言：** 简体中文
- **生产部署：** Cloudflare Pages Git Integration

## 设计方向

我希望这个博客保留技术站点应有的清晰与效率，但不做成千篇一律的“开发者模板”。

当前视觉体系围绕 **梵高式昼夜画境 + 数字花园** 展开：白天与夜间拥有对应的绘画氛围，Hero、横幅、背景、波浪、导航和正文区域尽量形成连续的空间关系，而不是简单地在网页背后铺一张壁纸。

已经长期维护的方向包括：

- 自定义 Katelya 品牌标识与站点视觉
- 昼 / 夜两套梵高风格画境
- Banner / Fullscreen 两种壁纸浏览模式
- Hero、波浪、文章标题与导航栏的几何关系优化
- Desktop / iPad / Mobile 响应式适配
- 文章目录、阅读进度、代码块、数学公式与图片浏览体验
- 项目页、时间线等个人内容页面
- Pagefind 本地搜索、RSS 与 Sitemap
- Twikoo / Giscus 等评论能力的可配置接入
- 面向真实浏览器的 Playwright UI 回归测试

## 技术栈

| 层级 | 主要技术 |
| --- | --- |
| Framework | Astro 7 |
| Language | TypeScript 6 |
| UI | Astro Components + Svelte 5 |
| Styling | Tailwind CSS 4 + Stylus |
| Navigation | Swup |
| Search | Pagefind |
| Markdown | Astro Markdown / MDX + Expressive Code |
| Math | KaTeX |
| Image | Sharp + PhotoSwipe / Fancyapps UI |
| Test | Node Test Runner + Playwright |
| Format / Lint | Biome |
| Deployment | Cloudflare Pages |

完整依赖与版本以 [`package.json`](./package.json) 为准。

## 本地运行

### 1. 克隆仓库

```bash
git clone https://github.com/katelya77/katelyatop-blog.git
cd katelyatop-blog
```

### 2. 安装依赖

项目使用 pnpm：

```bash
pnpm install
```

### 3. 启动开发环境

```bash
pnpm dev
```

默认开发地址：

```text
http://localhost:4321
```

## 常用命令

```bash
# 开发
pnpm dev

# 创建新文章
pnpm new-post <filename>

# Astro 类型与项目检查
pnpm astro check

# 单元 / 回归测试
pnpm test

# 浏览器端 E2E 测试
pnpm test:e2e

# Biome 检查
pnpm lint

# 生产构建
pnpm build

# 本地预览构建结果
pnpm preview
```

## 内容结构

主要文章位于：

```text
src/content/posts/
```

站点配置已经拆分到：

```text
src/config/
```

其中包括站点信息、导航栏、个人资料、壁纸、评论、侧边栏、音乐、文章协议等配置。相比把所有内容堆在单个配置文件中，这种方式更适合长期维护和功能扩展。

项目中比较常用的目录：

```text
.
├── .github/workflows/   # CI、部署回退、CDN 相关工作流
├── public/              # 静态资源
├── scripts/             # 构建、文章创建、同步等脚本
├── src/
│   ├── assets/          # 站点资源
│   ├── components/      # UI 组件
│   ├── config/          # 模块化配置
│   ├── content/         # 文章与内容
│   ├── layouts/         # 页面布局
│   ├── pages/           # Astro 页面
│   └── styles/          # 样式系统
└── tests/               # 单元与 UI 回归测试
```

## 文章 Frontmatter

常用格式如下：

```yaml
---
title: 文章标题
published: 2026-08-15
description: 文章摘要
image: ./cover.webp
tags: [Astro, Blog]
category: 技术
draft: false
pinned: false
comment: true
---
```

字段会随着站点功能继续演进，实际定义请参考 `src/content.config.ts`。

## CI 与部署

仓库对 `master` 和面向 `master` 的 Pull Request 执行 GitHub Actions 检查，包括：

- Biome Check
- Tests
- Astro Type Check
- Production Build
- Playwright E2E

生产站点由 **Cloudflare Pages Git Integration** 监听仓库并部署。

仓库中的 `.github/workflows/deploy.yml` 仅保留为手动的旧版 GitHub Pages / `pages` 分支回退方案，不作为当前生产发布链路。

因此日常发布流程是：

```text
feature / content branch
        ↓
Pull Request
        ↓
GitHub Actions
        ↓
merge → master
        ↓
Cloudflare Pages 自动构建与发布
```

## 内容原则

这个博客更关注“自己真正理解并实践过的内容”，而不是追求高频转载。

对于来自官方文档、开源项目、论文、技术博客或其他公开资料的信息，我会尽量遵循以下原则：

1. 优先阅读原始 / 官方来源；
2. 用自己的结构、案例、测试与结论重新组织文章；
3. 不把机械同义改写当作原创；
4. 对关键参考资料保留来源链接与必要署名；
5. 尊重原作者的许可证、版权声明、robots.txt 与站点使用条款；
6. 代码片段优先使用允许引用的官方示例、开源代码或自己的实现。

如果未来加入自动化内容工作流，也会以“**采集公开事实与参考资料 → 研究归纳 → 原创撰写 → 自动检查 → PR 审核 → 发布**”为边界，而不是自动搬运完整文章。

## Public Repository 安全说明

本仓库已公开。所有密钥、Token、API Key 和生产环境凭据都不应直接提交到 Git。

本地开发可以参考 `.env.example`，生产环境敏感变量应通过 GitHub / Cloudflare 等平台的 Secret 或 Environment Variables 管理。

如果发现仓库中出现意外暴露的凭据，请立即通过 Issue 或其他联系方式提醒我；真正的密钥泄露还应同时执行吊销与轮换，而不是只删除 Git 历史中的文件。

## 开源来源与致谢

这个项目并非从零开始。

当前代码长期演进自以下优秀的开源项目与社区创意：

- [Mizuki](https://github.com/LyraVoid/Mizuki) — 本项目重要的上游基础
- [Fuwari](https://github.com/saicaca/fuwari) — 更早期的主题基础
- [Yukina](https://github.com/WhitePaper233/yukina) — 视觉与交互设计参考
- [Firefly](https://github.com/CuteLeaf/Firefly) — 部分布局设计思路参考
- [Twilight](https://github.com/spr-aachen/Twilight) — 动态壁纸与交互设计参考
- [Astro](https://astro.build/) 及整个开源生态

感谢所有原作者和贡献者。仓库的个性化改造、品牌视觉、配置、布局与内容会继续独立演进，但不会抹去上游项目应有的署名与许可信息。

## License

代码许可请以仓库中的 [`LICENSE`](./LICENSE) 与 [`LICENSE.MIT`](./LICENSE.MIT) 为准。

如果你想复用这个仓库中的内容，请注意区分：

- **开源代码**：遵循对应源码许可证；
- **第三方素材 / 依赖**：遵循各自原始许可证；
- **个人文章、原创图片与品牌素材**：除非文件中另有说明，不因为源码仓库公开就自动等同于可任意转载或重新授权。

---

<p align="center">
  <strong>Katelya · 思囿随笔</strong><br>
  把折腾写成经验，把经历留作答案。
</p>
