# Impasto Performance and Texture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Phase 5 by improving wide-screen rendering performance and Van Gogh-inspired impasto texture without regressing the verified navbar and overlay fixes.

**Architecture:** Keep the existing compact 32×18 structure-tensor field and WebGL2 full-screen renderer. Add a viewport-pixel budget to derive an adaptive DPR, enrich the fragment shader with segmented directional strokes, bristle ridges, pigment glazing, and subtle canvas weave, and stop hidden fallback layers from remaining painted after WebGL is ready.

**Tech Stack:** Astro, TypeScript, WebGL2 GLSL ES 3.0, CSS, Node test runner, Playwright/GitHub Actions.

## Global Constraints

- Do not modify content, user profile, project data, or navigation behavior.
- Do not introduce Three.js or another large rendering dependency.
- Keep static day/night fallbacks below 500 KB total.
- Preserve reduced-motion, Save-Data, coarse-pointer fallback, visibility pause, and theme synchronization.
- Keep DPR at or below 1.4 and cap wide-screen framebuffer pixels.
- Existing 2560px navbar/ghost-card E2E regressions must remain green.

---

### Task 1: Add performance and texture contracts

**Files:**
- Modify: `tests/katelya-impasto-engine.test.mjs`

- [ ] Assert adaptive DPR uses a fixed maximum framebuffer-pixel budget.
- [ ] Assert idle rendering is no more than 8 FPS while pointer and theme bursts stay bounded.
- [ ] Assert shader retains structure-tensor directions and adds segmented strokes, bristle ridges, pigment glazing, and canvas weave.
- [ ] Assert the ready state removes hidden fallback/background painting.

### Task 2: Implement adaptive WebGL impasto renderer

**Files:**
- Modify: `src/scripts/impasto-renderer.ts`

- [ ] Add an adaptive DPR helper using `MAX_RENDER_PIXELS` and `MIN_DPR`.
- [ ] Keep resize work outside the draw loop.
- [ ] Enrich the fragment shader using the existing field; do not add network textures.
- [ ] Preserve visibility pause, cleanup, static fallback, and low-power context settings.

### Task 3: Optimize fallback compositing

**Files:**
- Modify: `src/styles/impasto-backdrop.css`

- [ ] Shorten opacity-only transitions.
- [ ] Hide the static fallback after WebGL becomes ready.
- [ ] Remove duplicate body background painting while WebGL is active.
- [ ] Add a low-opacity CSS canvas-fiber layer without blur or long-lived `will-change`.

### Task 4: Verify and finish branch

- [ ] Run focused impasto tests.
- [ ] Run full unit tests and the existing 13-test Playwright suite.
- [ ] Run Biome, Astro check, and production build; compare pre-existing baseline diagnostics rather than claiming they are newly fixed.
- [ ] Create a PR from `fix/nav-overlap-and-scroll-artifact`, wait for required GitHub checks, Squash Merge, and verify the production build marker and assets on Cloudflare Pages.
