# Katelya Van Gogh Day/Night Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coherent Van Gogh-inspired day/night visual system and fix navbar, overlay wallpaper, card affordance, and component overlap defects.

**Architecture:** Add two original SVG art assets and one shared theme layer that drives banner, page canvas, and overlay wallpaper. Refactor the navbar into a fixed three-zone gallery header, simplify search behavior, and remove the detached post-card entry control. Preserve the existing Astro/Svelte architecture and Cloudflare Pages static build.

**Tech Stack:** Astro 7, Svelte 5, TypeScript, CSS, SVG, Node test runner, Biome, GitHub Actions.

## Global Constraints

- Do not copy or embed a specific Van Gogh painting.
- Keep `https://blog.katelya.top/` as the canonical site URL.
- Do not add runtime image APIs, external fonts, WebGL, or new npm dependencies.
- Respect `prefers-reduced-motion`.
- No horizontal viewport overflow at desktop, tablet, or mobile widths.
- Preserve existing article, project, profile, timeline, music, and sidebar data.

---

### Task 1: Add regression tests

**Files:**
- Create: `tests/katelya-van-gogh-gallery.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository source files as text fixtures.
- Produces: structural regression checks included in `pnpm test`.

- [ ] Write tests asserting dual art assets, unified wallpaper config, gallery navbar markers, click-based desktop search, contained post-card arrow, shared art tokens, and overflow containment.
- [ ] Run `pnpm test` and verify the new tests fail before implementation.
- [ ] Commit the failing tests.

### Task 2: Build original day/night artwork and wallpaper configuration

**Files:**
- Create: `public/assets/art/katelya-van-gogh-day.svg`
- Create: `public/assets/art/katelya-van-gogh-night.svg`
- Modify: `src/config/siteConfig.ts`
- Modify: `src/config/backgroundWallpaper.ts`
- Modify: `src/components/misc/FullscreenWallpaper.astro`

**Interfaces:**
- Consumes: `siteConfig`, `fullscreenWallpaperConfig`, document `.dark` class.
- Produces: theme-aware banner and overlay artwork with `data-katelya-wallpaper`.

- [ ] Create day SVG with cyan-green field, violet iris strokes, warm blossom highlights, and a quiet central text zone.
- [ ] Create night SVG with cobalt field, cyan swirls, mineral-gold stars, and dark cypress anchors.
- [ ] Point both banner and fullscreen wallpaper config to the new assets and disable the legacy carousel.
- [ ] Render both theme layers in `FullscreenWallpaper.astro` and choose visibility through CSS rather than stale local image selection.
- [ ] Run the artwork and wallpaper regression tests.
- [ ] Commit.

### Task 3: Refactor gallery navigation and search

**Files:**
- Modify: `src/components/organisms/navigation/Navbar.astro`
- Modify: `src/components/organisms/navigation/Search.svelte`
- Modify: `src/layouts/MainGridLayout.astro`
- Modify: `src/styles/katelya-impressionist.css`

**Interfaces:**
- Consumes: existing nav config, search panel, settings panel, theme switch.
- Produces: `katelya-gallery-header`, `katelya-navbar-brand`, `katelya-navbar-links`, `katelya-navbar-tools`.

- [ ] Replace the flex navbar shell with explicit three-zone classes and a fixed viewport-safe wrapper.
- [ ] Decouple header placement from `#top-row` banner height and remove the large empty sheet state.
- [ ] Remove hover expansion from desktop search; expand only on click/focus and collapse on outside interaction or blur.
- [ ] Constrain search and settings panels to the viewport.
- [ ] Add responsive rules for desktop, tablet, and mobile.
- [ ] Run navbar/search regression tests.
- [ ] Commit.

### Task 4: Repair hero geometry and component art tokens

**Files:**
- Modify: `src/components/layout/KatelyaOrbitHero.astro`
- Modify: `src/styles/katelya-impressionist.css`
- Modify: `src/styles/panel-animations.css`

**Interfaces:**
- Consumes: body home/post state and document theme.
- Produces: shared `--katelya-*` color, radius, surface, border, shadow, and banner-height tokens.

- [ ] Separate home and article banner heights with explicit CSS variables.
- [ ] Keep orbit cards below the gallery header safe zone.
- [ ] Apply day/night tokens to cards, sidebars, calendar, player, announcement, tags, and floating controls.
- [ ] Add reduced-motion and overflow protections.
- [ ] Run layout regression tests.
- [ ] Commit.

### Task 5: Repair post-card entry affordance

**Files:**
- Modify: `src/components/features/posts/PostCard.astro`
- Modify: `src/styles/katelya-impressionist.css`

**Interfaces:**
- Consumes: current post-card semantic links and cover state.
- Produces: one contained `.katelya-post-card-arrow` cue.

- [ ] Remove the no-cover absolute full-height right-side button.
- [ ] Add one compact brush-arrow cue inside the card content boundary.
- [ ] Ensure hover/focus behavior is consistent for cover and no-cover cards.
- [ ] Run post-card regression tests.
- [ ] Commit.

### Task 6: Full verification and integration

**Files:**
- Update PR description only if implementation matches the plan.

**Interfaces:**
- Produces: a merge-ready PR into `master`.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm exec biome check .`.
- [ ] Run `pnpm exec astro check`.
- [ ] Run `ENABLE_CONTENT_SYNC=false pnpm build`.
- [ ] Create a PR, wait for GitHub Actions, inspect changed files and review threads.
- [ ] Squash merge only after all checks pass.
