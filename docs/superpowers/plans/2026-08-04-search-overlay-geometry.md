# Search Overlay Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop search trigger and overlay visually isolated, correctly anchored below the navigation bar, and impossible to overlap the “更多” navigation item in either light or dark mode.

**Architecture:** Keep the search trigger as a fixed 40px toolbar control. After the search panel is portaled into `#overlay-root`, calculate its viewport position from the active trigger’s `getBoundingClientRect()` only when opening, resizing, or scrolling; expose the calculated values through panel-scoped CSS custom properties. Use CSS for presentation and clamping, while Svelte owns geometry and accessibility state.

**Tech Stack:** Astro, Svelte 5, TypeScript, CSS, Node test runner, GitHub Actions.

## Global Constraints

- Preserve the current Van Gogh day/night visual identity.
- Do not modify article, project, profile, or content data.
- Keep the trigger at exactly 2.5rem by 2.5rem on desktop.
- The panel must remain at least 0.75rem below the trigger and at least 1rem from viewport edges.
- Keep Escape, outside-click, page-navigation close behavior, and Pagefind loading.
- Add no new runtime dependency.

---

### Task 1: Add a geometry regression contract

**Files:**
- Modify: `tests/katelya-light-theme-performance.test.mjs`

**Interfaces:**
- Consumes: current `Search.svelte`, `Navbar.astro`, and `katelya-light-performance.css` source contracts.
- Produces: a failing test that requires runtime trigger geometry, a fixed search container, and a viewport-positioned panel.

- [ ] **Step 1: Write the failing test**

Require `getBoundingClientRect`, a `positionSearchPanel` function, resize/scroll reposition listeners, panel-scoped top/left variables, a 2.5rem fixed `#search-container`, and removal of the old static header-height positioning formula.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test`
Expected: FAIL in the new search overlay geometry contract because the current implementation uses static CSS positioning.

### Task 2: Anchor and redesign the search overlay

**Files:**
- Modify: `src/components/organisms/navigation/Search.svelte`
- Modify: `src/styles/katelya-light-performance.css`
- Modify: `src/styles/impasto-geometry.css`

**Interfaces:**
- Consumes: `#search-container`, `[data-search-trigger]`, and `#overlay-root`.
- Produces: `positionSearchPanel(): void`, CSS variables `--katelya-search-panel-top`, `--katelya-search-panel-left`, `--katelya-search-panel-width`, and a compact command-palette visual structure.

- [ ] **Step 1: Implement runtime placement**

Measure the visible trigger, clamp the panel width and left coordinate to the viewport, set the top below the trigger, and compute a safe max height. Recalculate only while open on resize and scroll.

- [ ] **Step 2: Isolate toolbar geometry**

Set `#search-container` and its hydrated child to a non-growing 2.5rem square, add a visual separator between navigation links and tools, and ensure the panel never participates in navbar layout.

- [ ] **Step 3: Refine the panel UI**

Add a compact header, close button, input field, keyboard hint, polished empty state, painterly light/dark surfaces, and viewport-safe radius/shadow without increasing blur cost.

- [ ] **Step 4: Run focused and full verification**

Run: `pnpm test`, `pnpm check`, `pnpm lint`, and `pnpm build`.
Expected: all commands exit successfully.

### Task 3: PR and integration

**Files:**
- Review all files changed against `master`.

**Interfaces:**
- Produces: one reviewable PR targeting `master` and one squash merge after all CI jobs pass.

- [ ] **Step 1: Create the PR and verify CI**

Require Tests, Biome Check, Astro Type Check, and Build to pass.

- [ ] **Step 2: Confirm no unresolved review threads**

Do not merge with unresolved threads or failed checks.

- [ ] **Step 3: Squash merge into `master`**

Use the final verified head SHA as the expected merge head.
