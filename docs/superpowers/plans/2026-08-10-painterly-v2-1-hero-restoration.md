# Painterly Engine V2.1 Continuous Canvas Hero Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the original full-page continuous Impasto WebGL background while fixing only Hero banner/fullscreen geometry, painterly wave handoff, and mobile/iPad Hero safety.

**Architecture:** Restore the background lifecycle and renderer behavior to the current `master` Painterly V2 baseline, removing the preview-only `impasto-reading`/poster-dominant content stage. Keep a single fixed Canvas from Hero through footer. Layer only a bounded Hero geometry and lightweight SVG wave handoff above that continuous background, while preserving the already-validated phone/iPad Hero safety rules.

**Tech Stack:** Astro, TypeScript, CSS, WebGL2, Node test runner, Playwright, GitHub Actions, Cloudflare Pages, DogeCloud CDN.

## Global Constraints

- One fixed Impasto Canvas must remain visually continuous from the top Hero through the footer.
- No `impasto-reading` mode, no poster-dominant content stage, and no scroll-triggered background ownership switch.
- Preserve the Painterly Engine V2 shader/palette from `master` unless a change is strictly required for Hero geometry.
- Preserve `prefers-reduced-motion`, save-data and WebGL-unavailable static fallbacks.
- Banner and fullscreen must have distinct geometry; fullscreen remains 100dvh/100svh.
- Keep the validated phone portrait title gutter and iPad/compact-desktop Hero safety rules.
- Restore waves only as a lightweight visual boundary; waves must not replace or recolor the page background.
- Do not change content, TOC, music, SWUP, Cloudflare Pages or DogeCloud workflow semantics.

---

### Task 1: Lock the continuous-background regression contract

**Files:**
- Modify: `tests/katelya-painterly-v2-1.test.mjs`
- Modify: `e2e/painterly-v2-1-hero.spec.ts`
- Modify: `e2e/painterly-responsive-matrix.spec.ts`

**Interfaces:**
- Consumes: current DOM classes `impasto-ready`, `impasto-static`, `[data-impasto-canvas]`, `.impasto-static-fallback`, `#header-waves`.
- Produces: regression coverage that prevents any scroll-triggered background switch from returning.

- [ ] **Step 1: Write failing static assertions**

Require that `src/styles/impasto-backdrop.css` and `src/scripts/impasto-renderer.ts` do not contain `impasto-reading`, and that waves remain visible in the art theme.

- [ ] **Step 2: Write failing browser continuity assertion**

In the homepage Playwright test, capture computed `opacity` / `visibility` of the Canvas and fallback at the Hero, mid-list, and footer. For normal WebGL mode, require the same Canvas to remain visible and require fallback not to become the dominant background after scrolling.

- [ ] **Step 3: Run CI and verify RED**

Expected: the current preview branch fails because `impasto-reading` still exists and scrolling changes Canvas/fallback ownership.

- [ ] **Step 4: Commit the RED test contract**

Commit only the tests before production rollback.

---

### Task 2: Restore the master continuous Impasto lifecycle

**Files:**
- Modify: `src/scripts/impasto-renderer.ts`
- Modify: `src/components/layout/ImpastoBackdrop.astro`
- Modify: `src/styles/impasto-backdrop.css`

**Interfaces:**
- Consumes: `master` Painterly V2 renderer/background lifecycle.
- Produces: one fixed Canvas that remains active from Hero through footer.

- [ ] **Step 1: Restore renderer lifecycle from `master`**

Remove Hero IntersectionObserver, `impasto-reading`, reading-only FPS/micro-detail caps, and preview-only quality-governor changes. Keep the existing V2 shader untouched.

- [ ] **Step 2: Restore backdrop ownership from `master`**

Return normal ready-state behavior to `Canvas opacity: 1` and hidden static fallback. Remove poster-dominant reading-stage selectors and page-level poster ownership.

- [ ] **Step 3: Restore normal art-layer initialization from `master`**

Undo preview-only renderer/depth scheduling changes unless they are required by an independent existing regression. The objective is to minimize diff and recover the known-good baseline.

- [ ] **Step 4: Run the continuity tests**

Expected: static and browser continuity checks pass, and scrolling does not change background ownership.

- [ ] **Step 5: Commit**

Commit the continuous-background rollback separately.

---

### Task 3: Keep only the Hero geometry and wave handoff

**Files:**
- Modify: `src/styles/katelya-responsive-hero.css`
- Modify: `src/styles/impasto-backdrop.css`
- Restore unrelated preview changes in: `src/layouts/MainGridLayout.astro`, `src/components/misc/FullscreenWallpaper.astro`, `src/components/organisms/navigation/DropdownMenu.astro` unless still required by pre-existing tests.

**Interfaces:**
- Produces: bounded Banner, 100dvh Fullscreen, lightweight waves, mobile/iPad safety.

- [ ] **Step 1: Preserve Banner / Fullscreen geometry**

Keep desktop Banner at the validated bounded height (`clamp(32rem, 63svh, 38rem)`), fullscreen at `100dvh/100svh`, and the deliberate fullscreen handoff overlap.

- [ ] **Step 2: Preserve phone/iPad Hero safety**

Keep phone portrait Hero minimum height, `92vw` copy width, `10vw` title size with `2.65rem` max, and existing compact/iPad orbit safety rules.

- [ ] **Step 3: Restore waves without changing page background**

Keep `#header-waves` visible with four restrained parallax layers and reduced-motion static behavior. Ensure the wave region is narrow enough to read as the Hero edge rather than a broad opaque horizontal band.

- [ ] **Step 4: Revert unrelated preview changes**

Reset legacy Banner network ownership, dropdown behavior, overlay loading, and any other files that are not necessary to the Hero/wave scope back to `master`, so PR #28 becomes focused and reviewable.

- [ ] **Step 5: Run targeted Hero tests**

Expected: 1440/1664 orbit cards fit; mobile title keeps a real gutter; fullscreen handoff remains within the allowed overlap region.

- [ ] **Step 6: Commit**

Commit the minimal Hero/wave implementation.

---

### Task 4: Migrate tests back to the narrowed design

**Files:**
- Modify only tests whose assertions were introduced for the abandoned poster/reading-stage design.
- Delete no longstanding unrelated regression coverage.

**Interfaces:**
- Produces: tests that verify continuous Canvas + Hero geometry instead of the abandoned content-stage split.

- [ ] **Step 1: Remove obsolete reading-stage expectations**

Delete assertions that require poster dominance, reading-mode FPS, reading micro-detail caps, or delayed background ownership.

- [ ] **Step 2: Keep cold-boot and responsive coverage only where compatible with the master background lifecycle**

Do not force a new poster architecture. Cold boot may keep the existing V2 fallback contract from `master`.

- [ ] **Step 3: Run `pnpm test`**

Expected: PASS.

- [ ] **Step 4: Run Biome / Astro Check / Build**

Expected: all PASS.

- [ ] **Step 5: Commit**

Commit only test migrations needed for the narrowed scope.

---

### Task 5: Real-browser visual verification

**Files:**
- Use existing Playwright specs and `artifacts/ui/*.png` output.

**Interfaces:**
- Produces: evidence that the background stays continuous and Hero boundaries are visually correct.

- [ ] **Step 1: Run full Playwright matrix**

Require all tests green across desktop, iPad and phone configurations.

- [ ] **Step 2: Inspect desktop Banner screenshots**

Confirm 1440/1664 Banner contains all orbit cards, waves form a subtle lower boundary, and the first article starts below the Hero without a hard color cut.

- [ ] **Step 3: Inspect mid-page and footer screenshots**

Confirm the same Van-Gogh/Impasto visual language remains behind cards and footer; no green-water or static-poster transition is allowed.

- [ ] **Step 4: Inspect Fullscreen and dark mode**

Confirm 100dvh composition, handoff overlap, and continuous dark Impasto background.

- [ ] **Step 5: Inspect phone/iPad screenshots**

Confirm title gutters and Hero safety without horizontal clipping.

---

### Task 6: PR, merge and production deployment

**Files:**
- PR #28 metadata only; no deployment workflow changes.

**Interfaces:**
- Consumes: green feature HEAD.
- Produces: merged `master`, Cloudflare Pages production deployment, DogeCloud refresh.

- [ ] **Step 1: Audit final PR diff**

Ensure the production diff is focused on Hero/wave/responsive behavior plus directly related tests/docs. No unrelated dependency or runtime behavior drift.

- [ ] **Step 2: Confirm all five feature-branch gates are green**

Tests, Biome, Type Check, Build, Playwright must all be successful on the same HEAD.

- [ ] **Step 3: Confirm latest Cloudflare Pages Preview**

Preview must correspond to the final feature HEAD and deploy successfully.

- [ ] **Step 4: Mark PR #28 Ready and squash merge into `master`**

Use expected head SHA to prevent merging stale code.

- [ ] **Step 5: Verify merged `master` CI**

Wait for Tests, Biome, Type Check, Build and Playwright to finish successfully on the squash commit.

- [ ] **Step 6: Verify production deployment**

Confirm Cloudflare Pages production deployment matches the squash commit.

- [ ] **Step 7: Verify DogeCloud refresh**

Confirm the `Refresh DogeCloud CDN` workflow completes successfully and creates URL/path refresh tasks without exposing secrets.

- [ ] **Step 8: Report final production SHA and validation evidence**
