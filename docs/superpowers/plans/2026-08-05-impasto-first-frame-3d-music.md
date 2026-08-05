# Impasto First Frame, Expressive 3D, and Music Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a seamless first painted frame, a less formulaic and more tactile Van Gogh-inspired day/night WebGL field, stronger bounded Hero depth, and the exact 21-track local playlist with one original shared cover.

**Architecture:** Keep the existing Astro/Svelte/WebGL2 system. Add a first-frame readiness state to the renderer, refine the fragment shader with asymmetric curl/vortex fields and broken tensor-guided strokes, expose one bounded pointer transform to Hero layers, and keep playlist data in the existing local constants module. Add focused unit and Playwright contracts before production changes.

**Tech Stack:** Astro, Svelte, TypeScript, WebGL2 GLSL ES 3.0, CSS, Node test runner, Playwright, Biome.

## Global Constraints

- Do not add Three.js or another 3D framework.
- Preserve maximum DPR 1.4 and bounded render-pixel budget.
- Preserve reduced-motion, coarse-pointer, save-data, and page-hidden degradation.
- Do not modify articles, projects, profile content, navigation semantics, or Cloudflare deployment configuration.
- Use the exact 21 URLs, titles, artists, and order supplied by the user.
- Use one original static SVG cover for every track.
- Merge only after unit, Biome, Astro type, production build, Playwright, and visual review pass.

---

### Task 1: Add failing first-frame and playlist contracts

**Files:**
- Modify: `tests/katelya-impasto-engine.test.mjs`
- Create: `tests/katelya-music-playlist.test.mjs`
- Modify: `e2e/katelya-ui-regression.spec.ts` or create `e2e/impasto-first-frame-music.spec.ts`

**Interfaces:**
- Consumes: `initImpastoRenderer()` and `LOCAL_PLAYLIST`.
- Produces: regression contracts for later tasks.

- [ ] **Step 1: Add a renderer-source contract**

Assert that `impasto-ready` is added only after the first `drawArrays` path, that boot/static states exist, and that the shader contains asymmetric curl/vortex helpers plus broken-stroke masks.

- [ ] **Step 2: Add a playlist data contract**

Read `constants.ts`, assert 21 entries, exact first/last titles, all exact URLs, unique IDs, duration `0`, and shared cover `assets/music/cover/katelya-starry-playlist.svg`.

- [ ] **Step 3: Add Playwright first-frame and 3D contracts**

Hard-refresh at 1664×920 in day/night; verify fallback visible before ready, canvas visible after ready, no empty or mismatched body layer, pointer movement changes bounded Hero CSS variables, reduced motion keeps them neutral, and the playlist contains 21 rows after opening.

- [ ] **Step 4: Run the focused tests and confirm failure**

Run:

```bash
pnpm test
pnpm test:e2e --grep "impasto first frame|music playlist|hero depth"
```

Expected: the new contracts fail because the current renderer marks readiness too early, the old playlist has four tracks, and the deeper layer variables do not exist.

- [ ] **Step 5: Commit the red tests**

```bash
git add tests e2e
git commit -m "test: lock first-frame paint depth and playlist refresh"
```

### Task 2: Implement a single-owner first-frame transition

**Files:**
- Modify: `src/scripts/impasto-renderer.ts`
- Modify: `src/components/layout/ImpastoBackdrop.astro`
- Modify: `src/styles/impasto-backdrop.css`

**Interfaces:**
- Produces: root states `impasto-booting`, `impasto-ready`, and `impasto-static`.

- [ ] **Step 1: Initialize boot state before renderer startup**

Ensure `ImpastoBackdrop.astro` renders the fallback as the only visible painted surface and applies boot state before asynchronous WebGL setup.

- [ ] **Step 2: Move ready transition after the first successful draw**

Create a `markFirstFrameReady()` helper called after the first successful viewport setup, uniform upload, `gl.drawArrays`, and frame completion. It removes boot/static and adds ready exactly once.

- [ ] **Step 3: Remove the duplicate body SVG paint during boot**

Use a compatible flat undercolour on `body`; let `.impasto-static-fallback` own the SVG fallback. Static mode retains the fallback.

- [ ] **Step 4: Align fallback transition timing**

Crossfade canvas/fallback over 260ms, never hide the fallback before ready, and restore it on context loss or setup failure.

- [ ] **Step 5: Run focused and full tests**

```bash
pnpm test
pnpm exec biome check src/scripts/impasto-renderer.ts src/components/layout/ImpastoBackdrop.astro src/styles/impasto-backdrop.css tests
pnpm check
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add src/scripts/impasto-renderer.ts src/components/layout/ImpastoBackdrop.astro src/styles/impasto-backdrop.css
git commit -m "fix: make impasto first frame visually continuous"
```

### Task 3: Refine paint irregularity and strengthen bounded Hero depth

**Files:**
- Modify: `src/scripts/impasto-renderer.ts`
- Modify: `src/components/layout/KatelyaOrbitHero.astro`
- Modify: `src/styles/impasto-backdrop.css` only if global paint-layer tokens are required.

**Interfaces:**
- Consumes: existing tensor texture and pointer uniforms.
- Produces: shader curl/vortex helpers and CSS variables `--orbit-x`, `--orbit-y`, `--orbit-light-x`, `--orbit-light-y`.

- [ ] **Step 1: Replace regular stroke structure with asymmetric local fields**

Add deterministic off-centre vortex centres, low-frequency curl perturbation, randomized stroke cells, variable stroke length/gaps, broken pigment edges, and non-symmetric night gold blooms. Preserve reading protection.

- [ ] **Step 2: Increase material depth without increasing continuous FPS**

Refine height normals with layered bristle/edge height, non-uniform roughness, off-axis light, and restrained parallax tied to the existing pointer burst.

- [ ] **Step 3: Expose normalized Hero pointer variables**

Update the inline Hero controller to interpolate bounded pointer values and write one set of CSS variables per animation frame. Reset on leave and reduced motion.

- [ ] **Step 4: Apply layered transforms**

Give aura, title/copy, and each orbit card different translation/depth multipliers; add a moving edge highlight to the title and card surface. Keep readable text sharp and motion subtle.

- [ ] **Step 5: Run tests and browser screenshots**

```bash
pnpm test
pnpm check
pnpm build
pnpm test:e2e --grep "impasto first frame|hero depth|fullscreen|navbar"
```

Capture day/night banner/fullscreen and reduced-motion screenshots.

- [ ] **Step 6: Commit**

```bash
git add src/scripts/impasto-renderer.ts src/components/layout/KatelyaOrbitHero.astro src/styles/impasto-backdrop.css
git commit -m "feat: deepen asymmetric impasto and hero parallax"
```

### Task 4: Replace the playlist and add the original shared cover

**Files:**
- Create: `public/assets/music/cover/katelya-starry-playlist.svg`
- Modify: `src/components/widgets/music-player/constants.ts`
- Modify: `src/stores/musicPlayerStore.ts` only if a missing error/format behavior is revealed by tests.

**Interfaces:**
- Produces: 21 `Song` objects using the existing `Song` shape.

- [ ] **Step 1: Create the static shared SVG cover**

Use a square ultramarine/cobalt composition with irregular turquoise/iris strokes, a mineral-gold bloom, subtle cypress/K silhouette, no animation, no external images, and no expensive filters.

- [ ] **Step 2: Replace `LOCAL_PLAYLIST` exactly**

Add the 21 supplied tracks in order, IDs 1–21, exact title/artist/URL, shared cover path, and duration `0`.

- [ ] **Step 3: Preserve lazy audio behavior and failure skipping**

Confirm only the selected audio source is assigned and the existing `handleAudioError()` moves to the next track. Do not preload all sources.

- [ ] **Step 4: Run playlist and player tests**

```bash
pnpm test
pnpm check
pnpm build
pnpm test:e2e --grep "music playlist"
```

- [ ] **Step 5: Commit**

```bash
git add public/assets/music/cover/katelya-starry-playlist.svg src/components/widgets/music-player/constants.ts src/stores/musicPlayerStore.ts
git commit -m "feat: add Katelya starry playlist and 21 tracks"
```

### Task 5: Full verification, visual review, PR, and merge

**Files:**
- Modify: PR description only unless verification finds an issue.

- [ ] **Step 1: Run all local/CI-equivalent checks**

```bash
pnpm test
pnpm exec biome check .
pnpm check
pnpm build
pnpm test:e2e
```

- [ ] **Step 2: Review generated screenshots**

Inspect first boot, day/night banner, day/night fullscreen, pointer depth, reduced motion, mobile, player collapsed, and playlist open. Reject formulaic symmetry, flashes, unreadable text, or large layout shifts.

- [ ] **Step 3: Create PR**

Describe root cause, first-frame state machine, shader and 3D changes, playlist metadata, performance limits, screenshot evidence, and unchanged content scope.

- [ ] **Step 4: Wait for GitHub checks and inspect artifacts**

Require Tests, Biome, Astro Type Check, Production Build, and Playwright success. Resolve any review threads.

- [ ] **Step 5: Squash merge with expected head SHA**

Merge only the verified PR head.

- [ ] **Step 6: Verify final master and Cloudflare deployment**

Confirm the merge commit checks and production deployment succeed, then hard-refresh the production site and repeat the first-frame/day/night/player smoke tests.
