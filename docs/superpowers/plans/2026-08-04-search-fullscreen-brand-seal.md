# Search Overlay, Fullscreen Geometry, and Brand Seal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate closed-search render artifacts and navbar collisions, make fullscreen content begin immediately after the visible hero, and replace the plain K logo with an original Van Gogh-inspired abstract seal.

**Architecture:** Keep the search panel portaled to `#overlay-root`, but make the closed state use the native `hidden` attribute plus a hard CSS `display:none` contract so it exits the render tree. Centralize banner, fullscreen, overlay, and no-wallpaper geometry in `--katelya-active-hero-height`, and let Banner, Hero, and the main shell consume the same value. Reorder and isolate navbar tools, and use one static layered SVG seal that stays legible in both themes without expensive runtime filters.

**Tech Stack:** Astro, Svelte 5, TypeScript, CSS, SVG, Node test runner, GitHub Actions.

## Global Constraints

- Preserve all article, project, profile, and content data.
- Do not add runtime dependencies.
- Search, settings, and navigation menu must be mutually exclusive.
- A closed search panel must not paint, receive pointer events, or retain inline geometry variables.
- Fullscreen and overlay modes must use one shared active hero-height variable.
- The new SVG must remain readable at 24–32px and avoid expensive animated filters.
- Tests, Biome Check, Astro Type Check, and production Build must pass before merge.

---

### Task 1: Add regression contracts

**Files:**
- Modify: `tests/katelya-layout-regressions.test.mjs`

- [ ] Require the search panel to bind `hidden={!isOpen}` and CSS to force `[hidden] { display:none !important; }`.
- [ ] Require closed search to clear panel geometry custom properties.
- [ ] Require overlay-open events so search, settings, and menu are mutually exclusive.
- [ ] Require the search trigger to be the last desktop tool and a fixed safety gap between links and tools.
- [ ] Require `--katelya-active-hero-height` to drive Banner, Hero, and main-shell spacing.
- [ ] Require the new starry-cypress seal asset and updated site configuration.

### Task 2: Fix overlay lifecycle and navbar geometry

**Files:**
- Modify: `src/components/organisms/navigation/Search.svelte`
- Modify: `src/components/organisms/navigation/Navbar.astro`
- Modify: `src/styles/katelya-light-performance.css`
- Modify: `src/styles/impasto-geometry.css`

- [ ] Hide the panel with the native `hidden` attribute when closed.
- [ ] Clear panel position variables and cancel queued positioning when closing.
- [ ] Dispatch and consume a single `katelya:overlay-open` event for mutual exclusion.
- [ ] Reorder desktop tools to settings, theme, search; keep mobile-only controls responsive.
- [ ] Add a stable inter-column safety gap and prevent the middle links from painting into the tool zone.

### Task 3: Unify fullscreen geometry

**Files:**
- Modify: `src/styles/impasto-geometry.css`
- Modify: `src/styles/katelya-van-gogh-safety.css`
- Modify: `src/layouts/partials/GridScripts.astro`

- [ ] Define mode-specific values for `--katelya-active-hero-height`.
- [ ] Make Banner, Hero, and main-shell spacing consume that variable.
- [ ] Stop legacy runtime code from adding `no-banner-layout` or inline top/margin offsets in fullscreen mode.
- [ ] Preserve mobile non-home behavior and existing wallpaper switching.

### Task 4: Create and integrate the abstract Van Gogh seal

**Files:**
- Create: `public/assets/brand/katelya-starry-cypress-seal.svg`
- Modify: `src/config/siteConfig.ts`
- Modify: `src/styles/impasto-geometry.css`

- [ ] Draw a hand-offset seal with a cypress-like vertical stroke, hidden K negative space, two star-track spirals, cobalt/iris layers, and mineral-gold highlights.
- [ ] Keep the SVG self-contained and static, with no animated filter.
- [ ] Add subtle navbar logo hover depth without moving the header geometry.

### Task 5: Verify and integrate

- [ ] Run Tests, Biome Check, Astro Type Check, and production Build in GitHub Actions.
- [ ] Review changed files and confirm no content data changes.
- [ ] Create a PR to `master`, confirm no unresolved review threads, and Squash Merge using the verified head SHA.
