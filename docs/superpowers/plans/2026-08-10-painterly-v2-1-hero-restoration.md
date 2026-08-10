# Painterly Engine V2.1 Hero Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a distinct banner/fullscreen Hero, remove the rough cold-boot flash, re-enable painterly wave handoff, and reduce first-screen/GPU cost without changing content, navigation, TOC, music, deployment, or CDN semantics.

**Architecture:** Keep the existing single WebGL2 renderer, but make a full-quality SVG painterly poster the complete first paint and let WebGL cross-fade in as an enhancement layer. Restore Hero geometry and waves in CSS, reduce runtime startup quality, defer hero-depth after the renderer is alive, and stop invisible legacy banner imagery from competing for first-screen bandwidth. The page below the Hero uses the poster as the dominant background while Canvas contrast/opacity is reduced after scrolling beyond the Hero.

**Tech Stack:** Astro, TypeScript, CSS, WebGL2, Node test runner, Playwright, GitHub Actions, Cloudflare Pages, DogeCloud CDN.

## Global Constraints

- Preserve the current Painterly Engine V2 palette/shader language; no runtime image or package dependency.
- Preserve `prefers-reduced-motion`, save-data and WebGL-unavailable static fallbacks.
- Preserve adaptive desktop TOC, music, SWUP, content, metadata, Cloudflare Pages and DogeCloud refresh workflow.
- PC, iPad and mobile use the same artistic language; device tiers may use different DPR/FPS/micro-detail budgets.
- Banner mode must be a bounded horizontal art frame; fullscreen mode must be 100dvh/100svh.
- Normal cold boot must never show a plain gradient-only placeholder.
- Hidden legacy banner imagery must not retain eager/high fetch priority under the Katelya art experience.

---

### Task 1: Lock V2.1 contracts with RED tests

**Files:**
- Create: `tests/katelya-painterly-v2-1.test.mjs`
- Create: `e2e/painterly-v2-1-hero.spec.ts`

**Interfaces:**
- Consumes: existing `impasto-backdrop.css`, `ImpastoBackdrop.astro`, `Banner.astro`, `impasto-renderer.ts`.
- Produces: source-level and browser-level contracts for Tasks 2–5.

- [ ] **Step 1: Write source contract tests** asserting: poster SVG is the normal boot background; Canvas/fallback cross-fade is non-zero duration; art-theme waves are not hard-hidden; renderer and hero-depth are not loaded by the same `Promise.all`; desktop starts medium and touch starts low/medium-first; legacy Banner assets are lazy/low priority.
- [ ] **Step 2: Push tests and verify CI fails for the current V2 behavior**, with failures tied to the contracts above rather than syntax/setup.
- [ ] **Step 3: Write Playwright browser contracts** for desktop banner/fullscreen height separation, visible wave handoff, cold boot poster completeness with delayed renderer, and no horizontal overflow at desktop/iPad/mobile.
- [ ] **Step 4: Commit RED tests.**

### Task 2: Instant painterly poster and seamless Canvas handoff

**Files:**
- Modify: `src/styles/impasto-backdrop.css`
- Modify: `src/components/layout/ImpastoBackdrop.astro`

**Interfaces:**
- Consumes: `/assets/impasto/impasto-day.svg`, `/assets/impasto/impasto-night.svg`, `initImpastoRenderer()`.
- Produces: complete poster first paint and non-blocking renderer/depth loading.

- [ ] **Step 1: Replace normal boot underpaint with the existing V2 painterly SVG poster plus a light colour wash**, for both light and dark modes.
- [ ] **Step 2: Keep poster visible during boot and cross-fade Canvas over 160–180ms**; remove `transition:none` ready-state hard cuts.
- [ ] **Step 3: Load `impasto-renderer` first on the next animation frame; initialize `hero-depth` only after renderer scheduling via idle callback/short fallback timeout.**
- [ ] **Step 4: Run source tests and commit.**

### Task 3: Restore real Banner / Fullscreen Hero ownership and painterly waves

**Files:**
- Modify: `src/styles/impasto-backdrop.css`
- Modify: `src/styles/katelya-responsive-hero.css`

**Interfaces:**
- Consumes: current `.katelya-hero-stage`, `body.fullscreen-banner`, `#header-waves` DOM.
- Produces: distinct banner/fullscreen geometry and Hero→content handoff.

- [ ] **Step 1: Make Banner Hero a bounded 35–40vh desktop art frame while retaining tablet/mobile responsive heights.**
- [ ] **Step 2: Keep fullscreen at 100dvh/100svh and restore a deliberate overlap/handoff region before the content shell instead of forcing zero overlap.**
- [ ] **Step 3: Re-enable `#header-waves` under the art theme, tune the four existing SVG layers to restrained painterly opacity/speed, and keep them static under reduced motion.**
- [ ] **Step 4: Add Hero-specific poster/canvas energy masks so the Hero remains more vivid than the reading stage without adding another renderer.**
- [ ] **Step 5: Run tests and commit.**

### Task 4: Reduce renderer startup cost and reading-stage activity

**Files:**
- Modify: `src/scripts/impasto-renderer.ts`

**Interfaces:**
- Consumes: current quality governor and renderer scheduling.
- Produces: startup-first quality profile and scroll-aware low-energy reading mode.

- [ ] **Step 1: Change initial quality to desktop `medium`, touch `low`, with medium DPR scale below 1.0.**
- [ ] **Step 2: Add a short startup governor window that may upgrade after fast initial samples rather than starting HIGH and waiting for downgrade.**
- [ ] **Step 3: Track whether the home Hero is visible with IntersectionObserver; outside Hero reduce idle FPS and micro detail while preserving colour continuity.**
- [ ] **Step 4: Keep pointer bursts limited to Hero-visible state so article reading does not pay high interactive FPS.**
- [ ] **Step 5: Run tests and commit.**

### Task 5: Stop invisible legacy Banner requests from competing with first paint

**Files:**
- Modify: `src/components/layout/Banner.astro`

**Interfaces:**
- Consumes: existing Banner image/carousel implementation.
- Produces: legacy fallback images that remain available but are not first-screen-critical.

- [ ] **Step 1: Change first and template Banner images from eager/high to lazy/low priority.**
- [ ] **Step 2: Change single-image DOM creation to `loading="lazy"` and `fetchPriority="low"`.**
- [ ] **Step 3: Preserve existing carousel/fallback behavior and wave/page-overlay DOM.**
- [ ] **Step 4: Run tests and commit.**

### Task 6: Browser matrix, visual review, PR and production validation

**Files:**
- Update tests only if a failing assumption is proven incorrect; production files change only for demonstrated regressions.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: mergeable production evidence.

- [ ] **Step 1: Run GitHub CI gates:** Node tests, Biome, Astro Type Check, Build, Playwright.
- [ ] **Step 2: Review real browser screenshots for desktop 1664/1920, iPad portrait/landscape, mobile portrait/landscape in light/dark × banner/fullscreen.**
- [ ] **Step 3: Verify cold boot with delayed renderer shows the painterly poster, not a gradient flash.**
- [ ] **Step 4: Mark Draft PR ready and squash merge only when every gate is green and screenshots pass visual review.**
- [ ] **Step 5: Wait for the matching Cloudflare Pages production deployment and DogeCloud URL/PATH refresh workflow; verify both complete successfully.**
- [ ] **Step 6: Re-run/observe `master` CI after merge and record final production evidence on the PR.**
