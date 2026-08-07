# FOSU 2026 Freshman Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Obsidian `2026助班经验分享` as a polished 1+8 article series on the Astro/Mizuki blog, with dedicated series navigation, stable permalinks, responsive UI, search/SEO metadata, and an explicit Obsidian→Blog publishing mapping.

**Architecture:** Keep Obsidian as source-of-truth content and maintain a reader-facing derived copy under `src/content/posts/fosu-2026-freshman-guide/`. Extend the existing Astro content schema with optional series metadata, render a scoped `SeriesNavigation` component inside both post routes, and use the existing Wiki Link/Callout/Markdown pipeline rather than introducing a parallel design system.

**Tech Stack:** Astro 7, TypeScript, Astro Content Collections, Mizuki, Tailwind CSS classes, Node test runner, Playwright, GitHub Actions.

## Global Constraints

- Do not change Hero, fullscreen wallpaper, impasto WebGL, music, navbar geometry, or global layout geometry.
- Reuse current card variables, `--primary`, rounded shapes, light/dark theme semantics, and current responsive breakpoints.
- Keep `Obsidian_vault` as content source; blog text may be split, deduplicated, and rewritten for public reading without inventing new school rules.
- All changing prices, schedules, requirements, and personal evaluations must remain clearly marked as past experience or subject to current notices.
- Final URLs must be under `/fosu/2026-freshman-guide/`.
- Total structure: one guide overview plus eight topic articles.
- Mobile must not horizontally overflow; iPad portrait/landscape must retain the existing blog geometry.

---

### Task 1: Add red regression coverage for the series contract

**Files:**
- Create: `tests/fosu-freshman-guide.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository source files as plain text.
- Produces: automated assertions for schema fields, component integration, navigation entry, content count, stable permalinks, and Wiki Link series cards.

- [ ] **Step 1: Write the failing test**

Create a Node test that asserts:

```js
const expectedPosts = [
  ["index.md", "fosu/2026-freshman-guide", 0],
  ["registration.md", "fosu/2026-freshman-guide/registration", 1],
  ["military-training.md", "fosu/2026-freshman-guide/military-training", 2],
  ["study.md", "fosu/2026-freshman-guide/study", 3],
  ["campus-growth.md", "fosu/2026-freshman-guide/campus-growth", 4],
  ["digital-campus.md", "fosu/2026-freshman-guide/digital-campus", 5],
  ["campus-life.md", "fosu/2026-freshman-guide/campus-life", 6],
  ["food.md", "fosu/2026-freshman-guide/food", 7],
  ["safety-health.md", "fosu/2026-freshman-guide/safety-health", 8],
];
```

The test must verify `series`, `seriesOrder`, `seriesHome` exist in `src/content.config.ts`; `SeriesNavigation.astro` exists and exposes a `data-series-navigation` root; both post routes reference `SeriesNavigation`; `navBarConfig.ts` includes `新生指南`; every expected post has `category: 佛大新生指南`, `comment: true`, the expected permalink and order; the overview contains standalone Wiki Links to every topic article.

- [ ] **Step 2: Add the new test to `pnpm test`**

Append `node --test tests/fosu-freshman-guide.test.mjs` to the existing test script without removing current tests.

- [ ] **Step 3: Open a draft PR and verify RED in GitHub Actions**

Expected: the Tests job fails because the series schema/component/content does not yet exist. Confirm the failure is caused by the new guide assertions rather than syntax or dependency errors.

---

### Task 2: Implement reusable series metadata and navigation

**Files:**
- Modify: `src/content.config.ts`
- Create: `src/components/features/posts/SeriesNavigation.astro`
- Modify: `src/components/features/posts/index.ts`
- Modify: `src/pages/posts/[...slug].astro`
- Modify: `src/pages/[...permalink].astro`

**Interfaces:**
- Consumes: `entry.data.series`, `entry.data.seriesOrder`, `entry.data.seriesHome`, all post collection entries.
- Produces: a responsive article-series navigation UI and topic-only previous/next links.

- [ ] **Step 1: Extend the schema minimally**

Add optional fields:

```ts
series: z.string().optional(),
seriesOrder: z.number().int().nonnegative().optional(),
seriesHome: z.string().optional(),
```

- [ ] **Step 2: Add `SeriesNavigation.astro`**

Props:

```ts
interface SeriesItem {
  title: string;
  url: string;
  order: number;
}
interface Props {
  series: string;
  homeUrl: string;
  currentOrder: number;
  items: SeriesItem[];
  position?: "top" | "bottom";
}
```

Render a scoped `data-series-navigation` card using existing `card-base`/button semantics, `--primary`, rounded corners, muted text colors, and responsive `flex-col md:flex-row` classes. Show series title, `current/total`, return-to-overview link, and previous/next topic links when available.

- [ ] **Step 3: Export the component**

Add it to `src/components/features/posts/index.ts` following the existing export style.

- [ ] **Step 4: Integrate in both article routes**

For entries with all series fields defined, derive all posts in the same series from `getSortedPosts()`, sort by `seriesOrder`, map them to stable URLs using the existing URL utility, render the series card after `PostMeta`, and render it again after the article/last-modified area. Hide the global chronological `PostNavigation` for series posts; keep it unchanged for all ordinary posts.

- [ ] **Step 5: Keep routes behavior-identical for non-series posts**

No changes to cover rendering, comments, licensing, related posts, encryption, Hero geometry, or metadata for non-series content.

---

### Task 3: Publish the 1+8 FOSU content series

**Files:**
- Create directory: `src/content/posts/fosu-2026-freshman-guide/`
- Create: `index.md`
- Create: `registration.md`
- Create: `military-training.md`
- Create: `study.md`
- Create: `campus-growth.md`
- Create: `digital-campus.md`
- Create: `campus-life.md`
- Create: `food.md`
- Create: `safety-health.md`

**Interfaces:**
- Consumes: current `Obsidian_vault/2026助班经验分享/*.md` content.
- Produces: nine public blog entries recognized by Astro Content Collections and Pagefind.

- [ ] **Step 1: Convert Obsidian frontmatter to blog frontmatter**

Each post must include:

```yaml
title: ...
published: 2026-08-07
updated: 2026-08-07
description: ...
category: 佛大新生指南
tags: [...]
draft: false
comment: true
series: 2026级佛山大学新生指南
seriesOrder: N
seriesHome: fosu/2026-freshman-guide
permalink: fosu/2026-freshman-guide[/topic]
```

Only overview is `pinned: true` with a low priority value.

- [ ] **Step 2: Build the overview as a start-here article**

Preserve the disclaimer and five key reminders, then group the eight topic posts by `开学之前 / 刚进学校 / 正式大学生活` and use standalone Wiki Links so the existing Markdown plugin renders article cards.

- [ ] **Step 3: Create the eight topic articles**

Use source content from the Obsidian notes. Split the current learning note into `study` and `campus-growth`; move campus-network/system material to `digital-campus`; move phone-card/bank-card content into `registration`; keep campus living focused on dormitory, express delivery, hot water, transportation and practical errands. Remove source-note textual previous/next footers because the series component owns navigation.

- [ ] **Step 4: Preserve time-sensitive labeling**

Every price, plan, military-training schedule, campus-network limit, mobile-plan detail, bank arrangement, shuttle price, credit/volunteer-hour rule and personal operator recommendation must remain explicitly described as past experience or subject to current official notice.

---

### Task 4: Add the low-risk navigation entry and responsive regression

**Files:**
- Modify: `src/config/navBarConfig.ts`
- Create: `e2e/fosu-freshman-guide.spec.ts` if the repository Playwright layout uses `e2e/`; otherwise place it beside the existing Playwright specs using the existing convention.

**Interfaces:**
- Consumes: topic permalink and `data-series-navigation` marker.
- Produces: discoverable guide entry and browser-level geometry regression.

- [ ] **Step 1: Add `新生指南` under `更多`**

Use `/fosu/2026-freshman-guide/`, a Material Symbols school/menu-book style icon already covered by the Iconify include mechanism, and do not add a new top-level nav item.

- [ ] **Step 2: Add Playwright coverage**

Test the overview and one long topic page at phone and iPad viewports. Assert:

```ts
expect(await page.locator("[data-series-navigation]").count()).toBeGreaterThan(0);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
```

Also assert the guide route returns the expected heading and a topic navigation link.

---

### Task 5: Green verification, PR review, merge, and source mapping

**Files:**
- Blog branch and PR
- Then modify `Obsidian_vault/2026助班经验分享/00-新生经验手册总览.md`
- Then modify `Obsidian_vault/2026助班经验分享/08-资料来源与更新记录.md`

**Interfaces:**
- Consumes: merged blog URL structure.
- Produces: verified production-ready series plus a source-note publication mapping.

- [ ] **Step 1: Verify GREEN through GitHub Actions**

Required successful jobs: Biome Check, Tests, Type Check, Build, Playwright E2E.

- [ ] **Step 2: Review PR diff**

Confirm only guide content, series component/schema/routes, nav entry, tests, and design/plan docs changed. Confirm no Hero/fullscreen/impasto/music geometry files changed.

- [ ] **Step 3: Merge the blog PR**

Merge only if the PR is mergeable, current head SHA matches verification, no unresolved review thread exists, and required GitHub Actions jobs are successful.

- [ ] **Step 4: Update Obsidian source mapping in a separate branch/PR**

Add the public overview URL to the source overview and record the nine public article mappings plus the fixed workflow `口语输入 → Obsidian → Blog → PR/验证/合并` in the update/source note. Do not rewrite the source note bodies merely to mirror blog phrasing.

- [ ] **Step 5: Verify and merge the Obsidian PR**

Check that only the source overview and update record changed, links use the final production permalinks, and the guide content itself remains source-of-truth.
