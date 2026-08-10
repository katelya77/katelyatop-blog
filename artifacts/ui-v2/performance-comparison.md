# Painterly Engine V2 性能与几何对照

基线 SHA：`75dfba913152232e16c6ea958d8d1c6292476da4`
测试环境：Windows / production `astro build` + `astro preview` / Chromium / deviceScaleFactor 1
日期：2026-08-10

## 构建产物

| 指标 | Before | After | 变化 |
| --- | ---: | ---: | ---: |
| Impasto renderer bundle | 17,138 B | 20,357 B | +3,219 B / +18.8% |
| 全站 JS（72 个文件） | 2,592,102 B | 2,595,608 B | +3,506 B / +0.14% |
| Day fallback SVG | 87,778 B | 89,992 B | +2,214 B / +2.52% |
| Night fallback SVG | 90,742 B | 98,576 B | +7,834 B / +8.63% |
| Fallback metadata | 380 B | 380 B | 0 |

Before 使用 detached worktree 在同一机器、同一 pnpm lockfile 下独立安装和构建；After 使用当前分支 production build。没有新增运行时依赖、位图背景或额外 Canvas。

## 画布与帧率策略

| 指标 | Before | After |
| --- | --- | --- |
| Desktop DPR cap | 1.4 | 1.4（保留） |
| Touch DPR cap | 1.0 | 1.0（保留） |
| Desktop render pixel budget | 3.2 M | 3.2 M（保留） |
| Touch render pixel budget | 1.15 M | 1.15 M（保留） |
| Desktop idle / pointer FPS | 14 / 48 | 14 / 48（保留） |
| Touch idle / pointer FPS | 10 / 30 | 10 / 30（保留） |
| 艺术系统持续 rAF loop | 1 | 1；Hero depth 改为事件驱动 |
| 质量策略 | 设备预算 | HIGH/MEDIUM/LOW + EMA + hysteresis + 8s cooldown |

实测内部 Canvas 尺寸在 deviceScaleFactor 1 下保持不变：desktop `1664×920`、iPad `820×1180`、mobile `390×844`。After 中 desktop 初始 HIGH，touch 初始 MEDIUM；LOW 仅降低 DPR/micro bristle，不替换画面。

## production preview 观察

| 场景 | Before requests | After requests | After 几何 |
| --- | ---: | ---: | --- |
| Home light/dark desktop/iPad/mobile | 86–95 | 71–88 | 横向溢出 0；Hero 与正文相接 |
| Article desktop | 100 | 78 | Hero bottom / shell top `358.8px` |
| Article iPad | 97 | 92 | Hero bottom / shell top `102.1px` |
| Article mobile | 86 | 69 | Hero bottom / shell top `81.2px` |
| Fullscreen desktop | — | 75–83 | Hero bottom / shell top `920px` |

请求数为每个新浏览器上下文的一次本地 preview 观察，可能受字体/图标缓存和异步内容影响，因此只作为方向性记录，不声称为 CDN 线上值。

## 首帧、响应式与交互

- Cold boot：阻断 application JavaScript 时显示与 live palette 一致的 static underpaint/fallback；释放 JS 后 Canvas 接管，不出现白屏、旧黄色 SVG、旧 wallpaper 或 theme mismatch。
- 15 个指定视口 × light/dark × banner/fullscreen 共 60 种状态：标题、orbit card、快捷入口、navbar 和正文无碰撞；所有页面横向溢出为 0。
- 指针：持续输入只更新 transform、opacity 和 CSS variables；不修改 width/height/top/left/margin/padding，不在 pointermove 调用 `getBoundingClientRect()`。
- Touch/reduced motion：不使用 hover、DeviceOrientation 或陀螺仪；reduced motion 停止持续 3D。

## 未记录指标

本地 preview 未能稳定复现实网缓存/CDN 条件，因此没有填写 Lighthouse、LCP、CLS、INP 或 long task 数；这些数值不做推测或伪造。
