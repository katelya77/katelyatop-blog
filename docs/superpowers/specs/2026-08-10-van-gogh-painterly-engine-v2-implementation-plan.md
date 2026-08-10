# Katelya Painterly Engine V2 实施计划

基线：`75dfba913152232e16c6ea958d8d1c6292476da4`

1. **Phase 0 — 审计**：同步 `origin/master`，阅读 commits、项目规范、渲染器、fallback、Hero、布局、导航、测试和既有设计文档；先解释所有权与根因。
2. **Phase 1 — BEFORE**：从 production build/preview 采集桌面、iPad、手机、fullscreen 和文章页 light/dark 基线。
3. **Phase 2 — RED**：为背景所有权、三尺度笔触、非圆 aura、质量 governor、cold boot 与真实几何建立失败测试。
4. **Phase 3 — 所有权**：让 `impasto-backdrop.css` 成为 underpaint/Canvas/glaze/fallback 的唯一所有者，退役冲突 legacy theme。
5. **Phase 4 — Shader V2**：弱 tensor + local flow + region bias；建立 broad/mid/micro 三尺度、stroke-derived height 和稀少矿物金事件。
6. **Phase 5 — Fallback V2**：升级离线 SVG 的笔触分布、断裂光带、阅读 calm zone 和配色一致性。
7. **Phase 6 — Hero**：保留原内容与入口，用不连续光带、不对称卡片和统一 depth tokens 取代规则轨道。
8. **Phase 7 — 全站材质**：在不改变功能结构的前提下，调整 navbar、cards、sidebar、article 的纸/底漆材质和安静层次。
9. **Phase 8 — Responsive**：覆盖任务指定的 15 个视口以及 light/dark × banner/fullscreen，保持既有 iPad/landscape 策略。
10. **Phase 9 — Performance**：增加带 hysteresis/cooldown 的 HIGH/MEDIUM/LOW governor，保留原 DPR、像素、FPS budget。
11. **Phase 10 — Regression**：运行 `pnpm test`、Biome、Astro check、build 和完整 Playwright；保留 TOC、cold boot、navbar、overlay 回归。
12. **Phase 11 — Review/PR**：统一重拍 AFTER，记录性能、做 diff 自审，提交、推送并创建 Draft PR；不自动合并。

每个阶段以“Problem → Visual principle → Technical solution → Performance cost → Verification”记录理由；发现回归时先判断根因，不删除既有测试。
