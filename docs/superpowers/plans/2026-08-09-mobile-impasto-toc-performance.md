# Mobile Impasto + TOC Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the same dynamic Impasto background across normal desktop/tablet/mobile clients with bounded mobile cost, make the adaptive desktop TOC reveal compositor-friendly, and defer non-critical Pio loading.

**Architecture:** Keep one WebGL2 renderer and move touch devices into a lower-cost quality tier instead of static fallback. Replace layout-driven TOC expansion with a stable compact rail plus an absolutely positioned full panel revealed through transform/opacity. Defer renderer module loading until after first paint and defer the Live2D iframe URL until idle/visible eligibility.

**Tech Stack:** Astro 7, TypeScript, CSS, WebGL2, Node test runner, Playwright, GitHub Actions, Cloudflare Pages Git integration.

## Global Constraints

- Keep the existing Impasto shader/palette and generated SVG fallbacks.
- Keep `prefers-reduced-motion`, save-data, WebGL failure, forced-colors, and print fallbacks.
- Keep left CardTOC, right widget column geometry, heading navigation, and TOC IntersectionObserver behavior unchanged.
- Do not add dependencies.
- Do not add secrets or deployment tokens to the repository.
- Avoid layout-affecting TOC animation properties in the adaptive desktop range.
- CI must pass before merge.

---

### Task 1: Lock mobile dynamic Impasto and TOC/Pio performance contracts

**Files:**
- Modify: `tests/katelya-impasto-engine.test.mjs`
- Modify: `tests/desktop-toc-reading-rail.test.mjs`
- Modify: `e2e/impasto-first-frame-music.spec.ts`
- Modify: `e2e/desktop-toc-reading-rail.spec.ts`

**Interfaces:**
- Consumes: current renderer/CSS/TOC/Pio behavior.
- Produces: failing regressions that describe the new behavior.

- [ ] **Step 1: Add static renderer assertions**

Update the Impasto engine regression so it requires `shouldUseStaticMode()` to use reduced-motion/save-data only, forbids the coarse-pointer width gate, and requires coarse-pointer quality helpers/constants.

- [ ] **Step 2: Add static TOC assertions**

Require the adaptive rail implementation to contain compact/full presentation layers and transform/opacity transitions, and forbid transitions of `width`, `max-width`, and marker `margin` in the adaptive path.

- [ ] **Step 3: Add static Pio assertions**

Require the iframe to use `data-src` instead of an eager `src`, and require the idle scheduler to assign the source only after mobile visibility eligibility is checked.

- [ ] **Step 4: Add browser regressions**

Add Playwright coverage for iPhone and iPad coarse-pointer contexts reaching `impasto-ready`, reduced-motion staying static, and adaptive TOC geometry remaining stable while the full surface appears.

- [ ] **Step 5: Commit and run PR CI**

Commit the failing tests and open a draft PR. Verify failures are caused by the old coarse-pointer fallback/eager iframe/layout-driven TOC behavior.

---

### Task 2: Enable adaptive mobile/tablet Impasto

**Files:**
- Modify: `src/scripts/impasto-renderer.ts`
- Modify: `src/styles/impasto-backdrop.css`

**Interfaces:**
- Consumes: existing `initImpastoRenderer()` and generated field texture.
- Produces: same renderer on normal touch clients with bounded DPR/pixel/FPS budgets.

- [ ] **Step 1: Remove coarse pointer from static-mode eligibility**

`shouldUseStaticMode()` returns true only for reduced-motion or save-data before WebGL capability checks.

- [ ] **Step 2: Add coarse-pointer quality budget**

Introduce a helper that detects coarse pointers and returns lower DPR/render-pixel/frame-rate targets while preserving the same shader and state lifecycle.

- [ ] **Step 3: Remove `(pointer: coarse)` from the CSS static fallback media query**

Keep the reduced-motion media query intact.

- [ ] **Step 4: Run static tests**

Confirm the renderer regressions pass.

---

### Task 3: Make adaptive desktop TOC reveal compositor-friendly

**Files:**
- Modify: `src/components/features/toc/DesktopTOCRail.astro`

**Interfaces:**
- Consumes: `headings` prop and one existing `SidebarTOC` instance.
- Produces: compact visual rail + full interactive panel with transform/opacity reveal.

- [ ] **Step 1: Render a lightweight compact presentation layer**

Generate a non-interactive (`aria-hidden`) list of major/minor heading markers from `headings`, capped to a sensible visible count.

- [ ] **Step 2: Keep one full SidebarTOC panel**

Position it absolutely against the rail's right edge. Do not duplicate the Web Component.

- [ ] **Step 3: Animate only transform and opacity**

Use a small translate/scale/opacity reveal for the full surface and fade the compact layer. Do not animate surface width, label max-width, or marker margin.

- [ ] **Step 4: Preserve >=1880px persistent mode**

At wide desktop widths show the full surface with no reveal transform and hide the compact presentation.

- [ ] **Step 5: Run static and Playwright TOC tests**

Confirm no horizontal overflow and stable article/widget geometry.

---

### Task 4: Defer non-critical client work

**Files:**
- Modify: `src/components/layout/ImpastoBackdrop.astro`
- Modify: `src/components/features/pio/Pio.astro`
- Modify: `tests/katelya-light-theme-performance.test.mjs` or add focused static coverage as needed

**Interfaces:**
- Produces: static fallback first paint, dynamic renderer initialization after first paint, and no eager Live2D iframe request on hidden mobile.

- [ ] **Step 1: Replace static renderer imports with scheduled dynamic imports**

Keep initialization idempotent and keep `astro:page-load` behavior. Schedule module loading after the browser has had a first paint opportunity.

- [ ] **Step 2: Remove eager iframe src**

Render `data-src="/pio/live2d-host.html"` and no `src` attribute.

- [ ] **Step 3: Assign iframe src only when eligible**

In the existing idle scheduling path, return early for hidden mobile; otherwise assign the source once and initialize after load.

- [ ] **Step 4: Run static tests and build/typecheck**

Confirm no runtime/type regressions.

---

### Task 5: Full verification, merge, deployment observation

**Files:**
- No production file changes unless verification exposes a defect.

- [ ] **Step 1: Run all GitHub Actions checks**

Require Biome Check, Tests, Type Check, Build, and Playwright E2E to pass on the PR head.

- [ ] **Step 2: Review changed files/diff**

Confirm scope is limited to background/TOC/Pio performance plus tests/docs and no secret material is present.

- [ ] **Step 3: Merge to `master`**

Use squash merge after successful CI.

- [ ] **Step 4: Verify post-merge Actions/production chain**

Observe the `master` checks and the existing Cloudflare Pages → DogeCloud refresh automation. Confirm the production URL serves the new commit once deployment finishes.
