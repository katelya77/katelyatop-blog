# Impasto Flow Garden 实施说明

本说明记录实施阶段对原设计规范的等价优化。

## 最终生产管线

原设计设想提交多张 WebP/PNG 色彩、方向、法线和粗糙度纹理。实际实现进一步收敛为：

1. 上传的 26.7 MB、172,000 路径 SVG 只在离线分析阶段使用；
2. 使用结构张量提取方向、相干性和笔触能量；
3. 将结果量化为 `32×18 RGBA8` 场，提交于 `src/data/impasto-field.json`；
4. WebGL2 直接从该场合成方向性短笔触、颜料高度、法线高光、粗糙度、昼夜色彩和中央阅读保护区；
5. `scripts/generate-impasto-fallbacks.mjs` 在开发、测试和构建前生成两张确定性的静态 SVG 画境，供 WebGL 不可用、低动态、触控小屏和省流量模式使用。

## 优化理由

- 避免浏览器解析原始十几万条路径；
- 避免提交和加载多张高分辨率二进制纹理；
- 结构场体积约 3 KB，静态画境总量受测试限制在 500 KB 内；
- 方向信息仍直接源于上传样本的结构张量，而色彩、构图和交互为 Katelya 原创；
- 生产构建不依赖 Python、OpenCV 或 CairoSVG；这些只保留在 `tools/art/build-impasto-textures.py` 作为离线研究与高分辨率导出工具；
- Cloudflare Pages 只需原有 Node/pnpm 构建环境。

## 不变的验收约束

- 不向浏览器分发原始 SVG；
- 不引入 Three.js；
- WebGL2 不可用时内容完整；
- DPR 上限 1.5；
- 页面隐藏时停止渲染；
- 交互时最多 45 FPS，闲置时最多 18 FPS；
- 主内容处于正常文档流；
- 固定导航不受 Banner、Hero、Swup 或滚动隐藏逻辑改变 Y 坐标；
- 所有测试、Biome、Astro Check 和生产构建必须通过。
