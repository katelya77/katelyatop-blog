# Katelya Painterly Engine V2.1 — Continuous Canvas Hero Handoff

日期：2026-08-10
基线：`0c0df12c960fed16db0a5f427e689a0320c73c39`
工作分支：`feat/painterly-v2-1-hero-restoration`

## 最终结论

采用经预览反馈修正后的方案 A：**恢复 `master` 的整页连续梵高动态背景，只优化首页 Hero 横图尺寸、Fullscreen 几何、波浪边界，以及手机/iPad 的 Hero 安全边距。**

这次不再引入“滚出 Hero 后切换成另一套正文背景”的 reading stage，也不再让静态 poster 在正文阶段成为主背景。页面从顶部一直滚动到页脚，都必须由同一个固定 Impasto WebGL 画布持续提供背景，因此视觉上不能出现颜色、纹理或绘画语言的突变。

## 用户确认的问题

Cloudflare Preview 暴露出一个不可接受的回归：Hero 滚出视口后，`impasto-reading` 会降低 Canvas 透明度并提高静态 fallback 透明度，导致背景从顶部的梵高油画突然变成偏绿、类似水面纹理的另一套背景。

原 `master` 没有这个问题：固定全屏 Canvas 在 `impasto-ready` 后始终保持完整可见，因此顶部、正文和页脚属于同一幅连续动态画面。

## 设计原则

1. **整页背景连续性优先。** Hero、正文、页脚必须共享同一个固定动态 Impasto Canvas。
2. **只修 Hero，不重做正文背景。** 正文不新增 poster ownership、reading mode 或独立低能耗背景层。
3. **Banner 与 Fullscreen 要有清晰几何差异。** Banner 是有限高度横图；Fullscreen 是 100dvh/100svh 沉浸画布。
4. **波浪只负责边界交接。** 波浪不能造成背景切换，只在 Hero 底部形成轻量 painterly handoff。
5. **移动/iPad 保持当前有效的安全适配。** 防止标题贴边、orbit card 越界和 Hero 高度不足。
6. **不改变内容、TOC、音乐、SWUP、部署/CDN 语义。**

## 保留的改动

### 1. Banner / Fullscreen Hero 几何

- Desktop Banner：使用有上限的约 `63svh` 横向 Hero，高度足以容纳 4 张 orbit card，但明显短于 fullscreen。
- Fullscreen：继续使用 `100dvh` / `100svh`。
- Fullscreen 允许小范围 painterly overlap，正文只能进入预定义 handoff 区，不能撞进 Hero 主体。
- 手机竖屏 Banner 保持完整 Hero 高度，并保留标题左右安全边距。
- iPad/compact desktop 继续使用当前已通过浏览器矩阵的 orbit 缩放与边界规则。

### 2. Painterly Wave Handoff

恢复 `#header-waves`，继续复用现有 SVG path，不新增昂贵 filter 或大图。

要求：
- 4 层波浪透明度克制；
- 颜色来自当前 light/dark painterly palette；
- 动画速度慢于旧模板水波；
- 波浪只覆盖 Hero 底部小区域；
- 下方仍然是同一个固定 WebGL 背景，绝不切换成另一张 poster；
- `prefers-reduced-motion` 下保留静态波形。

### 3. Mobile / iPad Hero Safety

保留已经验证有效的：
- 手机 portrait Hero 高度；
- 标题 `92vw` 安全宽度；
- 标题字号约 `10vw`、上限 `2.65rem`；
- iPad/compact desktop 的 orbit card 缩放与安全边界。

## 必须撤销的改动

以下 V2.1 Preview 行为全部退出最终实现：

- `impasto-reading` 类；
- Hero `IntersectionObserver` 驱动的 Canvas/静态 fallback 切换；
- 正文 `Canvas opacity 0.26` / fallback `opacity 0.78`；
- reading stage 专用 6 FPS / micro-detail cap；
- 任何“正文由静态 painterly poster 主导”的逻辑；
- 为这套 reading stage 新增的 page-color / poster ownership；
- 与本次 Hero 修复无关的 renderer 质量调度重写、加载顺序重构和 Banner 网络所有权改造。

Renderer 和固定背景生命周期应尽量恢复到 `master` 已验证的 Painterly V2 行为。

## 目标视觉

```text
固定梵高动态背景（同一个 Canvas）
        ↓
Hero Banner / Fullscreen
        ↓
轻量半透明 painterly waves
        ↓
正文卡片继续浮在同一个动态梵高背景上
        ↓
页脚仍然是同一个动态梵高背景
```

滚动过程中不允许出现明显的背景颜色跳变、纹理语言切换或“上半页油画 / 下半页水面”的断层。

## 测试与验收

### 静态/契约测试

- `impasto-backdrop.css` 不得包含 `impasto-reading` 的 Canvas/fallback 透明度切换规则；
- `impasto-renderer.ts` 不得创建/切换 `impasto-reading`；
- `#header-waves` 在 Katelya art theme 下可见；
- Banner 与 Fullscreen 使用不同 Hero 高度；
- 手机 portrait 标题安全宽度继续存在。

### Playwright

必须覆盖：
- Desktop 1440 / 1664 Banner：orbit cards 完整位于 Hero 内；
- Desktop Fullscreen：100dvh，handoff overlap 仅发生在允许区域；
- iPhone / Android portrait：标题左右有真实安全边距；
- iPad portrait / landscape：Hero 无裁切；
- 从 Hero 滚动到中段正文和页脚：Canvas 仍是同一个动态层，背景不得切换为静态 fallback；
- light / dark 均验证；
- reduced-motion fallback 继续正常。

### 合并门槛

- Node tests、Biome、Astro Type Check、Build 全绿；
- Playwright 全绿；
- Cloudflare Pages Preview 人工检查 Hero 顶部、正文中段和页脚无背景突变；
- PR squash merge 后，`master` CI 全绿；
- Cloudflare Pages production deployment 匹配最终 merge SHA；
- DogeCloud URL / PATH 刷新工作流成功。

## 非目标

- 不重新设计 Painterly Engine shader；
- 不重新设计正文卡片；
- 不重做 Navbar / TOC / Music；
- 不新增图片或运行时依赖；
- 不改变 Cloudflare Pages / DogeCloud 配置；
- 不为了性能再次牺牲整页背景连续性。
