# Katelya Impressionist Digital Garden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Mizuki template into Katelya's blue-green impressionist digital garden with lightweight 3D orbital motion, migrated identity, projects, and primary content.

**Architecture:** Keep the Astro 7 static architecture and add an isolated visual theme layer instead of rewriting core components. A new hero component owns orbital markup and interaction; a dedicated CSS file owns art direction and global overrides; local SVG assets provide deterministic brush texture. Existing config and content files are updated using `katelya77/MyBlog` as the sole migration source.

**Tech Stack:** Astro 7, TypeScript, Tailwind CSS 4, CSS 3D transforms, SVG filters, existing Svelte/Astro component system, pnpm 11, Cloudflare Pages static output.

## Global Constraints

- Keep `output: "static"` and Cloudflare Pages compatibility.
- Do not add Three.js, WebGL, external image APIs, or new runtime dependencies.
- Site URL must be `https://blog.katelya.top/`.
- Use `katelya77/MyBlog` only as legacy content source.
- Preserve dark mode, keyboard navigation, mobile responsiveness, and `prefers-reduced-motion` behavior.
- Keep all heavy visual motion on the homepage hero only.

---

### Task 1: Add regression checks for Katelya identity and visual hooks

**Files:**
- Create: `tests/katelya-branding.test.mjs`

**Interfaces:**
- Consumes: repository source files as UTF-8 text.
- Produces: a Node test that validates required branding, domain, hero hook, local artwork, and removal of legacy user-facing identity.

- [ ] **Step 1: Write the failing test**

Create a Node test using `node:test`, `node:assert/strict`, and `fs/promises`. Assert that:

- `src/config/siteConfig.ts` contains `Katelya · 思囿随笔` and `https://blog.katelya.top/`.
- `src/config/profileConfig.ts` contains Katelya's GitHub, Telegram, X, and email links.
- `src/components/layout/Banner.astro` imports and renders `KatelyaOrbitHero`.
- `src/styles/katelya-impressionist.css` contains reduced-motion and mobile fallbacks.
- `public/assets/art/katelya-impression.svg` exists and contains an SVG filter.
- Edited user-facing files do not contain `matsuzaka-yuki`, `まつざか`, or the old Mizuki demo URL.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/katelya-branding.test.mjs`

Expected: FAIL because the new hero, theme CSS, and art asset do not exist.

- [ ] **Step 3: Commit**

Commit message: `test: define Katelya redesign acceptance checks`

### Task 2: Migrate brand, navigation, profile, and content

**Files:**
- Modify: `src/config/siteConfig.ts`
- Modify: `src/config/profileConfig.ts`
- Modify: `src/config/navBarConfig.ts`
- Modify: `src/config/announcementConfig.ts`
- Modify: `src/data/projects.ts`
- Modify: `src/content/spec/about.md`
- Create: `src/content/posts/katelya-space-online.md`

**Interfaces:**
- Consumes: existing config interfaces and content schemas.
- Produces: canonical Katelya identity and initial real content used by all pages.

- [ ] **Step 1: Update site configuration**

Set Chinese locale, `Katelya · 思囿随笔`, canonical domain, 2026-05-23 start date, teal-purple theme, local impressionist SVG banner, three subtitle lines, and disable unfinished anime/devices/AI tools pages.

- [ ] **Step 2: Update profile and social links**

Use `Katelya`, the migrated Chinese biography, GitHub, Telegram, X, and email.

- [ ] **Step 3: Simplify navigation**

Use 首页、归档、友链、探索、关于、更多. Keep unfinished destinations under 探索 and rely on feature-page switches where supported.

- [ ] **Step 4: Replace announcement copy**

Use Chinese copy and a `关于本站` link.

- [ ] **Step 5: Replace project data**

Use Katelya Space, DecoTV, KatelyaTV, and K-Vault with accurate links and concise Chinese descriptions.

- [ ] **Step 6: Migrate about page and primary article**

Write a personal Chinese about page and migrate `Katelya Space 正式上线` with updated brand punctuation and canonical context.

- [ ] **Step 7: Run branding test**

Run: `node --test tests/katelya-branding.test.mjs`

Expected: still FAIL only for missing hero/theme/art files.

- [ ] **Step 8: Commit**

Commit message: `feat: migrate Katelya identity and core content`

### Task 3: Create the procedural impressionist artwork

**Files:**
- Create: `public/assets/art/katelya-impression.svg`

**Interfaces:**
- Consumes: no runtime data.
- Produces: a responsive local SVG used as desktop and mobile banner source.

- [ ] **Step 1: Create deterministic SVG artwork**

Build a 2400×1400 SVG with:

- blue-green gradient foundation;
- turbulence and displacement filters;
- soft mist layers;
- curved orbital brush paths;
- sparse mineral-gold flecks;
- restrained purple glow;
- no embedded raster image or external URL.

- [ ] **Step 2: Validate SVG structure**

Run the branding test and confirm the asset check passes.

- [ ] **Step 3: Commit**

Commit message: `feat: add procedural impressionist hero artwork`

### Task 4: Build the lightweight 3D orbit hero

**Files:**
- Create: `src/components/layout/KatelyaOrbitHero.astro`
- Modify: `src/components/layout/Banner.astro`

**Interfaces:**
- Consumes: `title`, `subtitle`, and typewriter configuration from `Banner.astro`.
- Produces: semantic hero heading, four category links, pointer parallax, and reduced-motion-safe 3D orbit markup.

- [ ] **Step 1: Create hero component markup**

Add title, subtitle, eyebrow text, four orbit links, decorative paint rings, and accessible labels.

- [ ] **Step 2: Add isolated interaction script**

Use pointer position to set CSS custom properties `--orbit-rx`, `--orbit-ry`, and `--orbit-depth`. Clean up listeners during Swup navigation and avoid work when reduced motion is enabled.

- [ ] **Step 3: Integrate hero into Banner**

Import `KatelyaOrbitHero` and render it inside the existing `banner-text-overlay`. Keep non-home page overlays and wave rendering unchanged.

- [ ] **Step 4: Run branding test**

Run: `node --test tests/katelya-branding.test.mjs`

Expected: hero hook assertions pass; CSS assertions still fail.

- [ ] **Step 5: Commit**

Commit message: `feat: add impressionist orbit hero`

### Task 5: Apply the impressionist design system

**Files:**
- Create: `src/styles/katelya-impressionist.css`
- Modify: `src/layouts/Layout.astro`

**Interfaces:**
- Consumes: existing global classes, CSS variables, and hero markup.
- Produces: scoped visual redesign for hero, navbar, cards, body texture, dark mode, mobile, and reduced motion.

- [ ] **Step 1: Import and scope the theme**

Import the new stylesheet after base styles and add `katelya-art-theme` to the root HTML class.

- [ ] **Step 2: Define visual tokens**

Override primary, page, card, button, line, title, and selection variables for light and dark modes.

- [ ] **Step 3: Style the homepage hero**

Implement layered mist, brush texture, title embossing, orbit perspective, glass-paint cards, gold flecks, and restrained animation.

- [ ] **Step 4: Style global surfaces**

Restyle navbar, cards, widgets, post cards, buttons, scrollbars, headings, and page background using translucent painted-canvas surfaces.

- [ ] **Step 5: Add accessibility fallbacks**

Provide `@media (prefers-reduced-motion: reduce)` and mobile rules that disable orbit animation, pointer tilt, and costly filters.

- [ ] **Step 6: Run branding test**

Run: `node --test tests/katelya-branding.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: apply impressionist digital garden theme`

### Task 6: Build verification and review

**Files:**
- Modify only if verification reveals a concrete defect.

**Interfaces:**
- Consumes: complete branch.
- Produces: verified PR ready to merge.

- [ ] **Step 1: Run tests**

Run: `pnpm test` and `node --test tests/katelya-branding.test.mjs`.

Expected: all tests pass.

- [ ] **Step 2: Run static checks**

Run: `pnpm check` and `pnpm type-check`.

Expected: no new errors.

- [ ] **Step 3: Run production build**

Run: `ENABLE_CONTENT_SYNC=false pnpm build`.

Expected: Astro and Pagefind complete and `dist/index.html` exists.

- [ ] **Step 4: Review branch diff**

Confirm only intended branding, content, hero, CSS, SVG, test, and documentation files changed.

- [ ] **Step 5: Open pull request**

Create a PR from `feat/impressionist-digital-garden` to `master` with implementation summary and verification evidence.

- [ ] **Step 6: Review and merge**

Verify PR status, inspect changed filenames and patch, then squash merge using the expected head SHA.
