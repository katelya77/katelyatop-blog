# Final Branding, ICP Footer, and Impasto Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the stable site layout while finalizing the public title, adding a polished ICP filing badge, and making the existing WebGL impasto background smoother and more organic.

**Architecture:** Preserve the single global `ImpastoBackdrop` and current Astro/Svelte component boundaries. Change only document-title generation, the footer presentation, the existing shader timing/field blend, and focused regression contracts.

**Tech Stack:** Astro 7, Svelte 5, TypeScript, WebGL2/GLSL ES 3.0, CSS, Node test runner, Playwright.

## Global Constraints

- The public site name is exactly `Katelya · 思囿随笔`.
- The ICP text is exactly `赣ICP备2025074096号`.
- The ICP link is `https://beian.miit.gov.cn/`.
- Do not add Three.js, another canvas, or new runtime dependencies.
- Preserve reduced-motion, coarse-pointer, save-data, visibility pause, and the 3,200,000-pixel render budget.
- Do not modify posts, projects, profile data, music data, or layout geometry.

---

### Task 1: Branding and ICP regression contracts

**Files:**
- Modify: `tests/katelya-branding.test.mjs`

- [ ] Add a test that reads `src/layouts/Layout.astro` and requires the home `pageTitle` fallback to be `siteConfig.title` rather than `siteConfig.title - siteConfig.subtitle`.
- [ ] Add a test that reads `src/components/organisms/footer/Footer.astro` and requires `赣ICP备2025074096号`, `https://beian.miit.gov.cn/`, `target="_blank"`, and `rel="noopener noreferrer"`.
- [ ] Run `pnpm test -- tests/katelya-branding.test.mjs` and confirm the new assertions fail before implementation.

### Task 2: Exact document title and ICP footer badge

**Files:**
- Modify: `src/layouts/Layout.astro`
- Modify: `src/components/organisms/footer/Footer.astro`

- [ ] Change the home document-title branch to `siteConfig.title` while keeping inner page titles in the form `${title} - ${siteConfig.title}`.
- [ ] Add an ICP badge below the existing theme credit with an inline shield/check SVG, exact filing text, official link, accessible label, keyboard focus, responsive layout, and reduced-motion fallback.
- [ ] Run the focused branding test and confirm it passes.

### Task 3: Organic impasto motion contracts

**Files:**
- Modify: `tests/katelya-impasto-engine.test.mjs`

- [ ] Change expected render rates to pointer 48 FPS, theme 36 FPS, and idle 14 FPS.
- [ ] Require three independently animated vortex centers, separate broad/secondary/ridge time offsets, and a reduced normal multiplier below the previous 31.0.
- [ ] Retain assertions for WebGL2, render-pixel budget, static fallbacks, no network fetch, and no Three.js.
- [ ] Run the focused impasto test and confirm it fails before implementation.

### Task 4: Smooth and de-formalize the existing shader

**Files:**
- Modify: `src/scripts/impasto-renderer.ts`
- Modify: `src/styles/impasto-backdrop.css`

- [ ] Increase low-power scheduling to 48/36/14 FPS for pointer/theme/idle states.
- [ ] Animate each vortex center with a different low-amplitude sine/cosine pair and phase.
- [ ] Give broad pigment, secondary pigment, and fine ridges independent flow offsets.
- [ ] Reduce tensor dominance, ridge contribution, and normal derivative strength; retain short-stroke and bristle height for tactile depth.
- [ ] Reduce the static glaze opacity slightly so the WebGL paint field, not the fallback SVG, remains the visual owner.
- [ ] Run the focused impasto test and confirm it passes.

### Task 5: Full verification and delivery

**Files:**
- No production files beyond Tasks 1-4.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm exec biome check .`.
- [ ] Run `pnpm check`.
- [ ] Run `pnpm build`.
- [ ] Run the existing Playwright E2E workflow and inspect day, night, scrolled, and mobile screenshots.
- [ ] Create a PR describing the two closed dependency PRs, exact-title change, ICP badge, shader changes, and verification evidence.
- [ ] Squash merge only after all required checks pass.
