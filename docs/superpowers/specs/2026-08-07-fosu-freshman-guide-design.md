# 2026级佛山大学新生指南专题设计

## 目标

把 `katelya77/Obsidian_vault` 中 `2026助班经验分享` 作为内容源，整理并发布到 `katelya77/katelyatop-blog`，形成适合长期维护、搜索、连续阅读和移动端浏览的专题系列。

## 内容架构

采用已确认的 B+ 方案：1 篇专题总览 + 8 篇主题文章。

1. 总览：2026级佛山大学新生指南
2. 报到与开学准备
3. 军训
4. 学习：课程、绩点、四六级与考试周
5. 成长：综测、第二课堂、志愿服务与学生组织
6. 校园数字生活：校园网、VPN、100网、企业微信
7. 校园生活：宿舍、快递、热水、交通与校区
8. 饮食：食堂、外卖、南门与大学城
9. 安全与健康：反诈、消防、就医、心理与运动

Obsidian 保留为事实与经验的源笔记；博客版本允许为对外阅读进行拆分、合并、去重、标题优化、SEO 描述与时效提示，但不反向篡改原始经历。

## URL

使用文章级 `permalink` 保持稳定、可读的专题路径：

- `/fosu/2026-freshman-guide/`
- `/fosu/2026-freshman-guide/registration/`
- `/fosu/2026-freshman-guide/military-training/`
- `/fosu/2026-freshman-guide/study/`
- `/fosu/2026-freshman-guide/campus-growth/`
- `/fosu/2026-freshman-guide/digital-campus/`
- `/fosu/2026-freshman-guide/campus-life/`
- `/fosu/2026-freshman-guide/food/`
- `/fosu/2026-freshman-guide/safety-health/`

## 系列 UI

仅对带有系列元数据的文章启用：

- `series`: 系列名称；
- `seriesOrder`: 当前文章在系列中的顺序，从 0 开始；
- `seriesHome`: 系列首页 permalink。

文章标题元数据下方展示轻量系列条：系列名称、当前进度、返回总览、上一篇和下一篇。底部使用同一组系列上一篇/下一篇替代全站时间序导航，避免专题文章跳到无关博客。

视觉必须复用现有 Mizuki/Katelya 变量、圆角、卡片透明度、文本层级和 `--primary`，不新增独立设计体系；手机端垂直堆叠，iPad 与桌面端横向布局。

## Markdown 与 Obsidian 兼容

- 继续使用现有 GitHub/Obsidian Callout 转换；
- 使用现有 Wiki Link 解析实现总览中的文章卡片；
- 表格继续走现有 `rehypeWrapTable`；
- 不复制 Obsidian 的 `cssclasses` 到博客 Frontmatter；
- 博客文章使用当前 Astro Content schema 认可的字段；
- 文章正文中删除 Obsidian 原始“上一页/下一页”文本链接，交给系列导航组件。

## 分类与 SEO

统一分类：`佛大新生指南`。

公共标签：`佛山大学`、`2026新生`、`新生指南`，再按篇追加军训、校园网、综测、饮食等标签。

总览置顶，其他篇不置顶。所有文章开启评论。每篇提供独立 description，并保持稳定 permalink。

## 导航入口

不新增顶级导航项，避免破坏已有 Navbar 几何。在“更多”下加入“新生指南”，指向专题总览。

## 响应式与风险边界

不修改 Hero、全屏壁纸、WebGL 厚涂背景、音乐、Navbar 尺寸或主布局几何。专题 UI 只作用于文章内容区。

验收覆盖：390px 手机、iPad 竖屏/横屏、桌面文章页；不得出现横向溢出、系列导航断裂、表格撑破内容卡、Wiki Link 失效或 permalink 构建失败。

## 两仓库同步

博客发布完成后，在 `Obsidian_vault` 的总览与资料更新页记录公开博客总览 URL 和本次发布映射，后续工作流固定为：

`口语输入 → Obsidian 源笔记整理 → 判断影响文章 → Blog 派生更新 → PR/验证/合并`。
