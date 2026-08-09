# Katelya Painterly Engine V2

## 1. Current master SHA

`75dfba913152232e16c6ea958d8d1c6292476da4` (`origin/master`, re-fetched before submission)

## 2. Art-direction analysis

This is not a reproduction of a Van Gogh painting. The project translates a way of seeing into Katelya's own digital painting language:

- direction transfers force between neighbouring marks;
- broken colour remains adjacent instead of being pre-mixed into grey;
- paint height belongs to stroke bodies, edges and bristle deposits;
- night uses many distinct blues with sparse warm energy;
- the reading centre is calm while peripheral regions carry more motion;
- light reveals surface relief but never turns the pointer into a background controller.

Research and the full project-specific translation are documented in `docs/superpowers/specs/2026-08-10-van-gogh-painterly-engine-v2-design.md`.

## 3. Root visual problems

1. Structure tensor + FBM ridge continuity dominated the image and read as a contour/topographic map.
2. Hero used a perfect elliptical double aura and looked like a solar-system UI.
3. Legacy `katelya-impressionist.css` still painted banner/body/hero surfaces in production, covering the live Canvas and creating a hard seam.
4. Cards and navbar shared one high-blur glass material instead of a hierarchy from painting to quiet reading surface.
5. Device-width budgets existed, but did not react to real frame cost.
6. Static fallback retained regular bands, round halos, a UI frame and symbolic plant accents.

## 4. Architecture changes

- `impasto-backdrop.css` is the sole owner of body underpaint, live Canvas, glaze and static fallback.
- `katelya-van-gogh-gallery.css` owns functional paper/material tokens only.
- `katelya-van-gogh-safety.css` owns safety/readability only.
- The legacy impressionist entry is inert so stale build graphs cannot restore old wallpaper or Hero geometry.
- One WebGL2 Canvas remains; no Three.js, Pixi, WebGPU framework, shader library or new runtime dependency.
- One Hero depth controller publishes CSS variables; it does not run a continuous animation loop.

## 5. Shader changes

- Tensor influence is weak and combines with local curl flow, asymmetric drifting vortices, smooth region bias and asynchronous phase velocities.
- Three distinct scales: broad underpainting, mid directional strokes and micro bristle ridges.
- Height is derived mainly from discrete stroke body/edge, bristle ridge and pigment deposit rather than broad FBM.
- Palette selection keeps teal/cream/violet/gold and ultramarine/cobalt/petrol/violet/warm gold beside one another.
- Central `readingCalm` reduces coherence, relief and contrast; peripheral energy increases stroke density and height.
- Pointer light movement is deliberately small and only changes surface lighting.

## 6. Hero / UI changes

- Replaced perfect rings with four tapered, discontinuous, asymmetrical paint ribbons.
- Preserved all requested text, four quick links and four orbit cards.
- Added shared depth tokens and bounded transform multipliers.
- Orbit cards use differentiated depth, irregular radii and a highlight shift instead of large scale/translate hover.
- Navbar, posts, sidebars and article surfaces use restrained warm/cool paper materials with less blur and shadow.

## 7. Responsive changes

- Preserved the existing responsive strategy and adjusted only stage/card boundaries.
- Verified all 15 requested viewports under light/dark × banner/fullscreen (60 states).
- Desktop and iPad retain four real orbit-card layout boxes; compact phone layouts intentionally remove their layout boxes.
- No horizontal overflow, title/card/link collisions or Hero/body gaps.
- Touch does not use hover, DeviceOrientation or gyro; reduced motion stops continuous depth/aura motion.
- Desktop TOC continues to use the adaptive reading rail below the shared navbar variables.

## 8. Performance changes

- Added HIGH/MEDIUM/LOW adaptive quality using frame-cost EMA, 36-sample qualification, separate 20ms/11ms thresholds and an 8-second cooldown.
- Quality changes affect DPR scale and micro bristle detail only; the painting and palette remain the same.
- Existing caps remain: desktop DPR 1.4 / 3.2M pixels, touch DPR 1.0 / 1.15M pixels.
- Existing idle/pointer rates remain: desktop 14/48 FPS, touch 10/30 FPS.
- Art subsystem continuous rAF loops remain 1; Hero depth is event-driven.

| Build metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Renderer bundle | 17,138 B | 20,357 B | +3,219 B / +18.8% |
| All JS (72 files) | 2,592,102 B | 2,595,608 B | +3,506 B / +0.14% |
| Day fallback | 87,778 B | 89,992 B | +2.52% |
| Night fallback | 90,742 B | 98,576 B | +8.63% |

Full measurements: `artifacts/ui-v2/performance-comparison.md`.

## 9. Files changed

- Renderer/depth: `src/scripts/impasto-renderer.ts`, `src/scripts/hero-depth.ts`
- Hero/material: `KatelyaOrbitHero.astro` and the directly related Impasto/Katelya stylesheets
- Fallback: generator plus generated day/night SVG and metadata
- Type compatibility: `src/utils/crypto-utils.ts` (Node 24 / TypeScript 6 owned-byte arrays; protocol unchanged)
- Verification: Painterly V2 unit/E2E suites and strengthened existing ownership/cold-boot/layout checks
- Evidence: `artifacts/ui-v2/before`, `artifacts/ui-v2/after`, performance report and design records
- Tooling: Biome is VCS-ignore-aware; lint still covers tracked application files while formatter/assist is restricted to the V2-touched code to avoid unrelated mass formatting.

No content, profile, playlist, filing, deployment, CDN, content sync, navigation structure or TOC source was changed.

## 10. Before screenshots

[Complete BEFORE set](https://github.com/katelya77/katelyatop-blog/tree/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/before)

| Desktop dark | iPad light | Mobile dark |
| --- | --- | --- |
| ![Before desktop dark](https://raw.githubusercontent.com/katelya77/katelyatop-blog/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/before/home-dark-desktop.png) | ![Before iPad light](https://raw.githubusercontent.com/katelya77/katelyatop-blog/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/before/home-light-ipad.png) | ![Before mobile dark](https://raw.githubusercontent.com/katelya77/katelyatop-blog/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/before/home-dark-mobile.png) |

## 11. After screenshots

[Complete AFTER set](https://github.com/katelya77/katelyatop-blog/tree/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/after)

| Desktop dark | iPad light | Mobile dark |
| --- | --- | --- |
| ![After desktop dark](https://raw.githubusercontent.com/katelya77/katelyatop-blog/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/after/home-dark-desktop.png) | ![After iPad light](https://raw.githubusercontent.com/katelya77/katelyatop-blog/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/after/home-light-ipad.png) | ![After mobile dark](https://raw.githubusercontent.com/katelya77/katelyatop-blog/feat/van-gogh-painterly-engine-v2/artifacts/ui-v2/after/home-dark-mobile.png) |

Additional evidence includes light/dark fullscreen and desktop/iPad/mobile article pages in both directories.

## 12. Test results

- `pnpm test` ✅
- `pnpm exec biome check .` ✅ — 426 tracked files, 0 errors (existing non-blocking warnings/info remain)
- `pnpm check` ✅ — 325 files, 0 errors, 2 deprecation hints
- `pnpm build` ✅ — 37 pages, Pagefind indexed 20 pages
- `pnpm test:e2e` ✅ — 56/56 in 4.5 minutes
- Desktop/iPad/mobile screenshots ✅
- Light/dark and banner/fullscreen ✅
- Cold boot delayed-JS takeover ✅
- Desktop TOC below navbar ✅

## 13. Performance comparison

- Canvas internal resolution stayed `1664×920`, `820×1180` and `390×844` in the measured DPR-1 desktop/iPad/mobile contexts.
- Home first-load requests changed from an observed 86–95 range to 71–88; article desktop 100→78, iPad 97→92, mobile 86→69.
- Full-page horizontal overflow measured 0 in every recorded state.
- No Lighthouse/LCP/CLS/INP or long-task value is claimed because local preview could not reproduce stable production CDN conditions.

## 14. Known trade-offs

- The renderer chunk is 18.8% larger, but total JS changes by only 0.14% and adds no request or dependency.
- Fallback SVGs are modestly larger in exchange for a composition consistent with the live renderer.
- Time-varying WebGL makes whole-image pixel thresholds flaky; regression tests prioritize geometry, ownership, readiness and collision, with fixed before/after scenes for human review.
- Local preview request counts are directional observations, not claims about the deployed CDN.
- This remains a **Draft PR** pending the owner's visual acceptance; it must not be merged automatically.
