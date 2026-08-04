# Homepage Visual Layout Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the Katelya impressionist homepage so the painterly background continues through the full page and the hero, navigation, settings panel, and viewport geometry remain stable across Swup navigation and responsive breakpoints.

**Architecture:** Keep the persistent shell outside `#content-wrapper`, but make its current route state explicit. A shared homepage-height CSS variable and a Swup synchronization method control banner, hero, body class, and content offset. A dedicated fixed page-canvas renders the original oil-brush field behind translucent cards.

**Tech Stack:** Astro 7, Svelte 5, Tailwind CSS 4 utility classes, plain CSS/SVG, Node test runner, Biome, GitHub Actions.

## Global Constraints

- Do not add Three.js, WebGL, or new runtime dependencies.
- Keep `blog.katelya.top` and the existing Katelya content data unchanged.
- Do not copy a specific copyrighted painting; generate original SVG brushwork.
- Preserve mobile and `prefers-reduced-motion` fallbacks.
- All changes must pass Tests, Biome Check, Astro Check, and Production Build with `ENABLE_CONTENT_SYNC=false`.

---

### Task 1: Add regression tests

**Files:**
- Create: `tests/katelya-layout-regressions.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: source files as UTF-8 strings.
- Produces: regression assertions for persistent hero state, overlay absence, shared height, centered navigation, panel closure, painterly canvas, and overflow containment.

- [ ] **Step 1: Write failing tests**

Create tests that require `showTextOverlay &&`, `.katelya-main-shell`, `--katelya-hero-height`, `syncKatelyaHomeState`, named navbar hooks, no `hideLinks`, fixed settings-panel constraints, `visibility: hidden`, `overflow-x: clip`, and `/assets/art/katelya-brush-field.svg`.

- [ ] **Step 2: Add the test file to `pnpm test`**

Append `node --test tests/katelya-layout-regressions.test.mjs` to the existing script.

- [ ] **Step 3: Run the PR workflow and verify RED**

Expected: Tests fail because the repair hooks and new artwork do not exist yet.

### Task 2: Stabilize hero lifecycle and geometry

**Files:**
- Modify: `src/components/layout/Banner.astro`
- Modify: `src/components/layout/KatelyaOrbitHero.astro`
- Modify: `src/layouts/MainGridLayout.astro`
- Modify: `src/layouts/Layout.astro`
- Modify: `src/scripts/core/swup-hooks.ts`
- Modify: `src/styles/katelya-impressionist.css`

**Interfaces:**
- Produces: `syncKatelyaHomeState(isHomePage: boolean)`, body class `katelya-home-page`, hero class `is-home-active`, shell classes `katelya-main-shell is-home-layout`, and CSS variable `--katelya-hero-height`.

- [ ] **Step 1: Remove the inactive Banner overlay from the DOM**

Render the overlay only inside `{showTextOverlay && (...)}`.

- [ ] **Step 2: Make the hero persistent**

Always render `KatelyaOrbitHero` when home text is enabled; pass an `active` prop for the initial route.

- [ ] **Step 3: Synchronize route state**

In `SwupHooksManager`, toggle the body class, hero class, `aria-hidden`, and main-shell class whenever `syncMainContentPosition` receives the current home status.

- [ ] **Step 4: Use one homepage height**

Apply `--katelya-hero-height` to the banner wrapper, hero, top-row reservation, and `.katelya-main-shell.is-home-layout`; disable the legacy extra grid translation on the homepage.

- [ ] **Step 5: Reduce headline collision risk**

Limit title width and maximum font size, and keep subtitle and quick links inside the hero stage.

### Task 3: Rebuild the full-page painterly environment

**Files:**
- Create: `public/assets/art/katelya-brush-field.svg`
- Modify: `src/layouts/Layout.astro`
- Modify: `src/styles/katelya-impressionist.css`

**Interfaces:**
- Produces: `#katelya-page-canvas`, a fixed non-interactive layer using the new SVG.

- [ ] **Step 1: Create original SVG artwork**

Use displaced blue-green pigment bands, short directional strokes, violet undertones, mineral-gold flecks, canvas weave, and restrained grain.

- [ ] **Step 2: Mount the canvas layer**

Insert one `aria-hidden` fixed layer before site content.

- [ ] **Step 3: Style light and dark variants**

Keep enough opacity to read as oil paint below the banner while maintaining card readability.

- [ ] **Step 4: Add overflow containment**

Set root/body horizontal overflow to `clip` with a `hidden` fallback and constrain all decorative layers to the viewport.

### Task 4: Repair navigation structure

**Files:**
- Modify: `src/config/navBarConfig.ts`
- Modify: `src/components/organisms/navigation/Navbar.astro`
- Modify: `src/styles/katelya-impressionist.css`

**Interfaces:**
- Produces: `.katelya-navbar-shell`, `.katelya-navbar-brand`, `.katelya-navbar-links`, and `.katelya-navbar-actions`.

- [ ] **Step 1: Flatten primary information architecture**

Use 主页、归档、项目、时间线、关于 as direct primary links and retain a compact 更多 dropdown for RSS, sitemap, and GitHub.

- [ ] **Step 2: Replace `justify-between` with a three-column grid**

Brand aligns left, links align to the viewport center, controls align right.

- [ ] **Step 3: Remove hover-driven link hiding**

Delete the `hideLinks`/`showLinks` search-hover behavior and its observer.

- [ ] **Step 4: Collapse earlier on constrained screens**

Show centered primary links at `lg` and use the menu button below `lg`.

### Task 5: Repair display settings panel

**Files:**
- Modify: `src/config/siteConfig.ts`
- Modify: `src/components/features/settings/SettingsPanel.svelte`
- Modify: `src/styles/panel-animations.css`
- Modify: `src/styles/katelya-impressionist.css`

**Interfaces:**
- Produces: `.katelya-settings-panel` with fixed viewport placement and non-rendering closed state.

- [ ] **Step 1: Lock the curated hue**

Set `themeColor.fixed` to `true` so the arbitrary hue slider is removed.

- [ ] **Step 2: Constrain the panel**

Use responsive width, fixed top/right placement, maximum viewport height, and internal vertical scrolling.

- [ ] **Step 3: Replace scale-only closure**

Closed state uses `opacity: 0`, `visibility: hidden`, small translation/scale, and `pointer-events: none`; open state restores all properties.

### Task 6: Verify and merge

**Files:**
- Modify: PR description only.

- [ ] **Step 1: Run complete CI**

Expected: Tests, Biome Check, Type Check, and Build all succeed.

- [ ] **Step 2: Review changed files and open review threads**

Ensure no unresolved review thread or accidental content deletion exists.

- [ ] **Step 3: Squash merge to `master`**

Use an expected head SHA to prevent merging stale work.
