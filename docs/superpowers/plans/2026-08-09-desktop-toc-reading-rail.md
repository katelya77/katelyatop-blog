# Desktop TOC Reading Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped external desktop TOC with an adaptive compact/expandable reading rail while keeping article geometry, left CardTOC, mobile/tablet TOC, and existing navigation behavior unchanged.

**Architecture:** Add a dedicated `DesktopTOCRail.astro` presentation shell around the existing `SidebarTOC` behavior. Give generated SidebarTOC entries stable semantic classes/data attributes, then use scoped rail CSS to collapse labels at 1536–1879px, expand on hover/focus without reflow, and remain persistently readable from 1880px upward.

**Tech Stack:** Astro, TypeScript, CSS, existing TOC Web Component logic, Node `node:test`, Playwright.

## Global Constraints

- Keep `PAGE_WIDTH = 90rem` unchanged.
- Keep the left `CardTOC` unchanged.
- Keep mobile/tablet TOC behavior unchanged.
- Do not move or resize the right widget sidebar.
- Do not add dependencies.
- Do not create horizontal page overflow.
- Preserve existing heading click navigation, active indicator behavior, SWUP regeneration, and password-decrypted refresh behavior.
- 1536–1879px uses compact-at-rest + hover/focus expansion.
- >=1880px shows the readable full rail persistently.
- Expanded heading labels are capped at two lines.
- `prefers-reduced-motion: reduce` removes expansion animation.

---

### Task 1: Lock the desired desktop TOC contract with failing regressions

**Files:**
- Modify: `tests/katelya-layout-regressions.test.mjs`
- Create: `e2e/desktop-toc-reading-rail.spec.ts`

**Interfaces:**
- Consumes: existing `MainGridLayout.astro`, `SidebarTOC.astro`, article route `/fosu/2026-freshman-guide/campus-growth/`.
- Produces: static and browser regressions that define the new rail behavior before production code changes.

- [ ] **Step 1: Add a static regression test**

Append a test that reads:

```js
const grid = await read("src/layouts/MainGridLayout.astro");
const sidebarToc = await read("src/components/features/toc/SidebarTOC.astro");
const desktopRail = await read("src/components/features/toc/DesktopTOCRail.astro");
```

and asserts all of the following:

```js
assert.match(grid, /DesktopTOCRail/);
assert.match(grid, /<DesktopTOCRail headings=\{headings\}/);
assert.match(sidebarToc, /sidebar-toc-item/);
assert.match(sidebarToc, /sidebar-toc-marker/);
assert.match(sidebarToc, /sidebar-toc-label/);
assert.match(sidebarToc, /data-depth=/);
assert.match(desktopRail, /desktop-toc-rail/);
assert.match(desktopRail, /focus-within/);
assert.match(desktopRail, /@media \(min-width: 1880px\)/);
assert.match(desktopRail, /-webkit-line-clamp:\s*2/);
assert.match(desktopRail, /prefers-reduced-motion:\s*reduce/);
```

- [ ] **Step 2: Add the Playwright geometry/visual regression**

Create `e2e/desktop-toc-reading-rail.spec.ts` that:

```ts
import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const ARTIFACT_DIR = "artifacts/ui";
const ARTICLE = "/fosu/2026-freshman-guide/campus-growth/";
```

At `1664x900`, navigate to the article, wait for `#desktop-toc-rail`, then assert:

```ts
const initial = await page.locator("#desktop-toc-rail").boundingBox();
expect(initial).not.toBeNull();
expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1665);
expect(initial!.width).toBeLessThan(120);
```

Hover the rail and assert its width grows to at least `220px`, its left/right bounds stay within the viewport, and `.sidebar-toc-label` has a visible width over `120px`. Scroll to the second major section and assert at least one `.sidebar-toc-item.visible` exists. Save `artifacts/ui/desktop-toc-1664-expanded.png`.

At `1920x1080`, assert the rail starts at width >= `180px` without hover and label width is >= `120px`. Save `artifacts/ui/desktop-toc-1920-persistent.png`.

- [ ] **Step 3: Commit tests before production code**

Commit message:

```text
test: define adaptive desktop TOC rail behavior
```

- [ ] **Step 4: Open a draft PR to run CI and verify RED**

Expected failures:

- Node tests fail because `DesktopTOCRail.astro` does not exist / expected hooks are absent.
- Playwright fails because `#desktop-toc-rail` does not exist.

Do not implement until the failing CI evidence matches those missing-feature failures.

---

### Task 2: Add semantic hooks to SidebarTOC and implement DesktopTOCRail

**Files:**
- Modify: `src/components/features/toc/SidebarTOC.astro`
- Create: `src/components/features/toc/DesktopTOCRail.astro`
- Modify: `src/components/features/toc/index.ts`
- Modify: `src/layouts/MainGridLayout.astro`

**Interfaces:**
- Consumes: existing `SidebarTOC` Web Component and TOC generation helpers.
- Produces: `DesktopTOCRail` Astro component and stable generated item hooks.

- [ ] **Step 1: Add stable generated TOC hooks without changing navigation logic**

In `SidebarTOC.astro`, keep the current anchors and badge generation but emit:

```html
<a class="sidebar-toc-item ..." data-depth="${item.depth}" ...>
  <div class="sidebar-toc-marker ...">...</div>
  <div class="sidebar-toc-label ...">${item.text}</div>
</a>
```

Give the active indicator an additional `sidebar-toc-active-indicator` class. Keep all existing hrefs, click handling, `visible` class updates, observer logic, and auto-scroll behavior intact.

- [ ] **Step 2: Create the dedicated desktop rail shell**

`DesktopTOCRail.astro` imports `SidebarTOC`, `MarkdownHeading`, `Icon`, and the existing i18n TOC label. Render:

```astro
<aside id="desktop-toc-rail" class="desktop-toc-rail" aria-label={...}>
  <div class="desktop-toc-surface">
    <div class="desktop-toc-heading">
      <span class="desktop-toc-heading-mark" aria-hidden="true"></span>
      <span class="desktop-toc-heading-text">...</span>
      <Icon ... />
    </div>
    <div class="desktop-toc-scroll">
      <SidebarTOC headings={headings} class="desktop-toc-content" />
    </div>
  </div>
</aside>
```

- [ ] **Step 3: Implement adaptive styling**

Base 2xl behavior:

```css
.desktop-toc-rail {
  width: min(var(--toc-width), 4.75rem);
  max-width: calc(100vw - 1rem);
}
.desktop-toc-surface {
  width: 100%;
  border: 1px solid color-mix(in oklab, var(--line-color) 82%, transparent);
  border-radius: 1.25rem;
  background: color-mix(in oklab, var(--card-bg-transparent) 90%, transparent);
  backdrop-filter: blur(14px) saturate(1.06);
  box-shadow: 0 14px 36px rgba(20, 31, 29, 0.10);
  overflow: hidden;
}
```

For `1536–1879px`, hide heading text/labels at rest while preserving them in the DOM. On `.desktop-toc-rail:hover` and `.desktop-toc-rail:focus-within`, set the surface width to `15.5rem` and translate it left by the difference so the outer edge remains anchored. Reveal header text and labels. The transition must animate width/transform/opacity only.

For `@media (min-width: 1880px)`, make the rail width `clamp(12rem, var(--toc-width), 16rem)`, remove compact label hiding, and disable the temporary expansion transform.

For labels:

```css
:global(.desktop-toc-rail .sidebar-toc-label) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  line-height: 1.35;
}
```

Add `@media (prefers-reduced-motion: reduce)` that sets rail/surface/item transitions to `none`.

- [ ] **Step 4: Mount the rail from MainGridLayout**

Replace the raw external `<SidebarTOC headings={headings} />` with `<DesktopTOCRail headings={headings} />`. Keep the current outer `2xl:block`, fixed-height scroll region, and `toc-hide` behavior unless a failing browser regression shows a geometry conflict.

- [ ] **Step 5: Export the new component**

Update `src/components/features/toc/index.ts` with:

```ts
export { default as DesktopTOCRail } from "./DesktopTOCRail.astro";
```

- [ ] **Step 6: Commit implementation**

Commit message:

```text
feat: refine desktop TOC into adaptive reading rail
```

---

### Task 3: Verify GREEN, refine only from evidence, and integrate

**Files:**
- Modify only files required by failing verification evidence.

**Interfaces:**
- Consumes: Task 1 regressions and Task 2 implementation.
- Produces: a merge-ready PR with green CI and visual artifacts.

- [ ] **Step 1: Wait for PR CI after implementation**

Require all five jobs to succeed:

- Biome Check
- Tests
- Type Check
- Build
- Playwright E2E

- [ ] **Step 2: Inspect Playwright UI artifacts**

Download `ui-verification` and inspect:

- `desktop-toc-1664-expanded.png`
- `desktop-toc-1920-persistent.png`

Reject the implementation if either screenshot shows character-by-character wrapping, clipping outside the viewport, overlap that permanently obscures right sidebar widgets, or a visual language inconsistent with the existing warm translucent cards.

- [ ] **Step 3: If CI or screenshots expose an issue, make the smallest evidence-driven correction**

Do not broaden scope to the left CardTOC, page width, mobile TOC, or right widget sidebar.

- [ ] **Step 4: Mark PR ready and merge with squash after green verification**

Use the exact PR head SHA as `expected_head_sha` when merging.

- [ ] **Step 5: Verify post-merge production workflows**

Confirm the `master` Lint workflow is `completed/success`. Confirm the DogeCloud CDN workflow either refreshes the affected aggregate/page URLs successfully or exits successfully according to its refresh plan. Report the merge commit and production verification evidence.
