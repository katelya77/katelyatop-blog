# Impasto Flow Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight Van Gogh-inspired impasto background system with offline brush-field textures, WebGL2 lighting, stable navigation geometry, and complete static fallbacks.

**Architecture:** The original 26.7 MB SVG remains an offline source only. A Python generator converts its 172,000 cubic-bezier strokes into compact albedo, flow, height/normal, roughness, and fallback textures. Astro mounts one fixed non-interactive canvas through `ImpastoBackdrop.astro`; `impasto-renderer.ts` renders the texture set with restrained lighting and pauses aggressively. Navigation, Hero, article banner, overlays, and main content use separate stable layers and normal document flow.

**Tech Stack:** Astro 7.1.3, TypeScript 6, WebGL2, Python 3, NumPy, Pillow, OpenCV, static WebP/PNG assets, Node test runner, Biome, GitHub Actions.

## Global Constraints

- Do not ship or parse the 26.7 MB source SVG in the browser.
- Do not add Three.js or another large rendering framework.
- Total generated art assets target less than 2 MB.
- Canvas DPR is capped at 1.5.
- Hidden tabs render at 0 FPS; idle mode renders no faster than 20 FPS.
- Mobile and `prefers-reduced-motion` use reduced or static rendering.
- Content, navigation, settings, search, and menus remain usable without WebGL.
- Navigation must use one fixed Y coordinate on home and article routes.
- Main content must remain in normal document flow and must not use runtime `top` writes.
- Existing posts, projects, profile data, and content build behavior must remain unchanged.

---

### Task 1: Add regression tests for rendering and geometry contracts

**Files:**
- Create: `tests/katelya-impasto-engine.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: repository source files as UTF-8 text and generated asset metadata.
- Produces: static regression checks used by every later task.

- [ ] **Step 1: Write failing tests**

Create tests that assert:

```js
assert.match(layout, /<ImpastoBackdrop\s*\/>/);
assert.match(backdrop, /aria-hidden="true"/);
assert.match(renderer, /getContext\("webgl2"/);
assert.match(renderer, /document\.visibilityState/);
assert.match(renderer, /prefers-reduced-motion/);
assert.match(renderer, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
assert.doesNotMatch(packageJson, /three/);
assert.doesNotMatch(themeCss, /background-attachment:\s*fixed/);
assert.doesNotMatch(mainGrid, /katelya-main-shell absolute/);
assert.match(mainGrid, /id="overlay-root"/);
assert.match(navbar, /data-katelya-overlay-trigger/);
```

Also verify metadata names and maximum dimensions for the generated texture set.

- [ ] **Step 2: Run tests and confirm failure**

Run through the repository CI after pushing the failing test commit.

Expected: the new impasto tests fail because the component, renderer, textures, overlay root, and normal-flow shell do not exist yet.

- [ ] **Step 3: Commit**

Commit message:

```text
test: define impasto engine and layout contracts
```

### Task 2: Build the offline stroke-field generator and compact assets

**Files:**
- Create: `tools/art/build-impasto-textures.py`
- Create: `public/assets/impasto/impasto-day-albedo.webp`
- Create: `public/assets/impasto/impasto-night-albedo.webp`
- Create: `public/assets/impasto/impasto-flow.png`
- Create: `public/assets/impasto/impasto-normal.png`
- Create: `public/assets/impasto/impasto-roughness.webp`
- Create: `public/assets/impasto/impasto-day-fallback.webp`
- Create: `public/assets/impasto/impasto-night-fallback.webp`
- Create: `public/assets/impasto/impasto-metadata.json`

**Interfaces:**
- Consumes: an SVG whose paths use `M x y C x1 y1 x2 y2 x3 y3`, `stroke`, `stroke-width`, and optional opacity.
- Produces: texture files and metadata consumed by `impasto-renderer.ts`.

- [ ] **Step 1: Implement deterministic SVG parsing**

Use `xml.etree.ElementTree.iterparse` and a numeric regex. Reject unsupported path commands with a clear message. For each cubic path, sample 8 points and calculate tangent angle, curvature proxy, width, colour, and opacity.

- [ ] **Step 2: Accumulate structural maps**

At 1536×864, rasterize sampled segments into:

```python
albedo_acc: float32[h, w, 3]
weight_acc: float32[h, w]
flow_x, flow_y: float32[h, w]
height_acc: float32[h, w]
roughness_acc: float32[h, w]
```

Use anti-aliased OpenCV line masks. Blend colour by accumulated weight, encode direction as normalized XY in RG, derive height from width and overlap, and derive roughness from curvature and local density.

- [ ] **Step 3: Create original day/night palettes**

Do not reproduce the source painting literally. Map luminance and hue into two Katelya palettes:

- Day: blue-green, mint, cream, iris purple, restrained mineral gold.
- Night: ultramarine, cobalt, deep teal, warm gold, soft cream.

Protect the center reading zone by reducing contrast and normal strength within an elliptical mask.

- [ ] **Step 4: Generate normal and fallback images**

Use Gaussian-smoothed height and Sobel derivatives to encode tangent-space normals. Compose fallbacks from albedo, canvas fibre noise, directional detail, and a restrained highlight.

- [ ] **Step 5: Compress and validate**

Write WebP at quality 78–84 and PNG maps with optimized compression. Write metadata including source SHA-256, path count, dimensions, palette version, generator version, and byte sizes. Fail generation if total output exceeds 2.5 MB.

- [ ] **Step 6: Commit**

Commit message:

```text
feat: generate compact impasto brush-field textures
```

### Task 3: Add the WebGL2 renderer and static fallback component

**Files:**
- Create: `src/components/layout/ImpastoBackdrop.astro`
- Create: `src/scripts/impasto-renderer.ts`
- Modify: `src/layouts/Layout.astro`
- Modify: `src/styles/katelya-van-gogh-gallery.css`

**Interfaces:**
- Consumes: `/assets/impasto/impasto-metadata.json` and texture URLs.
- Produces: one fixed canvas with `data-impasto-canvas`, `html.impasto-ready`, and `html.impasto-static` states.

- [ ] **Step 1: Implement the Astro component**

Render:

```astro
<div class="impasto-backdrop" aria-hidden="true">
  <canvas data-impasto-canvas></canvas>
  <div class="impasto-static-fallback"></div>
</div>
```

Load the renderer with a normal Astro module script. The component must be mounted exactly once in `Layout.astro`, before the page slot.

- [ ] **Step 2: Implement texture loading and WebGL2 initialization**

Create a full-screen triangle shader. Load albedo, flow, normal, and roughness with `ImageBitmap` when available and regular images otherwise. Use `CLAMP_TO_EDGE`, linear filtering, and no mipmaps.

- [ ] **Step 3: Implement restrained fragment lighting**

The shader must combine:

```glsl
base = texture(uAlbedo, uv + flowOffset).rgb;
normal = decode(texture(uNormal, uv).rgb);
roughness = texture(uRoughness, uv).r;
diffuse = max(dot(normal, lightDir), 0.0);
specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), mix(42.0, 10.0, roughness));
```

Apply an elliptical center protection mask, subtle canvas grain, edge vignette, and theme-specific light colour. Flow displacement must remain below 0.003 UV units.

- [ ] **Step 4: Implement lifecycle and performance controls**

- Cap DPR with `Math.min(window.devicePixelRatio || 1, 1.5)`.
- Stop scheduling frames while `document.visibilityState !== "visible"`.
- Detect `prefers-reduced-motion` and coarse pointers.
- Use static mode for reduced motion, failed WebGL, save-data, or small mobile devices.
- Render at most 45 FPS during pointer interaction and at most 18 FPS while idle.
- Dispose WebGL textures, listeners, observers, and animation frames on Swup replacement.

- [ ] **Step 5: Replace fixed SVG body painting**

Use the fallback WebPs for CSS backgrounds. Remove fixed background attachment and expensive whole-page SVG filters. Preserve print and high-contrast fallbacks.

- [ ] **Step 6: Run checks and commit**

Expected: impasto component and renderer tests pass; navigation/geometry tests may still fail until Task 4.

Commit message:

```text
feat: add lightweight WebGL impasto backdrop
```

### Task 4: Rebuild navigation, overlays, and normal-flow page geometry

**Files:**
- Modify: `src/layouts/MainGridLayout.astro`
- Modify: `src/components/organisms/navigation/Navbar.astro`
- Modify: `src/components/layout/KatelyaOrbitHero.astro`
- Modify: `src/styles/katelya-van-gogh-gallery.css`
- Modify: `src/styles/katelya-van-gogh-safety.css`

**Interfaces:**
- Consumes: existing Navbar links, settings/search/menu components, route metadata, and Hero content.
- Produces: stable fixed header, independent overlay root, and normal-flow page shell.

- [ ] **Step 1: Remove absolute shell geometry**

Change the main shell to normal flow. Remove inline `style="top: ..."`, the `absolute` utility class, and obsolete `finalMainPanelTop` calculation. Let Hero/Article Banner reserve space explicitly.

- [ ] **Step 2: Make the Header a true fixed overlay**

Keep only one fixed stage with a stable top inset. Use a three-column grid at wide widths, but switch to compact rules before links collide. The header must never inherit Banner or content transforms.

- [ ] **Step 3: Add the independent Overlay Root**

Render `<div id="overlay-root"></div>` after the header. Port settings, search, and menu panels to fixed positioning anchored through CSS custom properties and trigger metadata. Clicking a tool must not resize or reflow navigation.

- [ ] **Step 4: Simplify route synchronization**

Hero route state listens only to Swup view events, popstate, and initial location. Navigation scroll state is derived from `window.scrollY` without changing top or height. Remove route-time transforms and duplicated layout writes.

- [ ] **Step 5: Set responsive collision rules**

At widths below 1180 px, shorten the brand text and tighten link gaps. Below 980 px, hide desktop links and show the menu button. Prevent the search field from expanding inside the grid; its panel opens below the header.

- [ ] **Step 6: Run checks and commit**

Expected: all geometry, overlay, navbar, and impasto tests pass.

Commit message:

```text
fix: decouple gallery navigation from page geometry
```

### Task 5: Refine card material, Hero interaction, and accessibility

**Files:**
- Modify: `src/components/layout/KatelyaOrbitHero.astro`
- Modify: `src/styles/katelya-van-gogh-gallery.css`
- Modify: `src/styles/katelya-van-gogh-safety.css`

**Interfaces:**
- Consumes: impasto-ready/static HTML states and existing card classes.
- Produces: readable low-cost card materials and restrained pointer response.

- [ ] **Step 1: Reduce expensive blur usage**

Keep `backdrop-filter` only for navigation and floating panels. Replace card blur with opaque or nearly opaque canvas surfaces, canvas-fibre pseudo-elements, small inset highlights, and conventional shadows.

- [ ] **Step 2: Refine Hero movement**

Limit orbit tilt to 2.5° horizontally and 1.5° vertically. Use one RAF during active pointer movement; settle to zero after pointer leave. Disable orbit cards on touch and reduced motion.

- [ ] **Step 3: Add accessibility modes**

For `forced-colors`, printing, reduced motion, and low-data mode, remove canvas and decorative layers while preserving text contrast and focus outlines.

- [ ] **Step 4: Commit**

Commit message:

```text
style: refine impasto surfaces and accessible motion
```

### Task 6: Final verification, PR, and merge

**Files:**
- Modify: PR body only unless verification reveals a defect.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a merged `master` commit.

- [ ] **Step 1: Run the complete CI suite**

Required green jobs:

```text
Tests
Biome Check
Astro Type Check
Production Build
```

- [ ] **Step 2: Review changed files and asset sizes**

Verify no original content files are removed, no source SVG is committed, no Three.js dependency exists, and generated art assets remain within the documented budget.

- [ ] **Step 3: Review unresolved PR threads**

There must be zero unresolved review threads.

- [ ] **Step 4: Update the PR body**

Record root causes, generated asset statistics, renderer lifecycle rules, responsive behavior, and exact CI results.

- [ ] **Step 5: Squash merge**

Merge only with the latest expected head SHA after all checks are green.
