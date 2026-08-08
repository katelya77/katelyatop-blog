# Desktop TOC Reading Rail Design

## Goal

Replace the cramped ultra-wide desktop table-of-contents gutter with a polished adaptive reading rail that preserves the existing article layout, keeps the left CardTOC unchanged, and remains usable at the 1536–1879px desktop widths where the current gutter is too narrow for full Chinese headings.

## Problem

The site fixes the main page width at `90rem`. The desktop TOC gutter is currently calculated as:

```css
--toc-width: calc((100vw - var(--page-width)) / 2 - 1rem);
```

At a 1664px viewport this leaves only about 96px. `SidebarTOC` still renders full heading text in that space, so Chinese headings wrap vertically and the right edge looks unfinished even though the left CardTOC is visually strong.

## Recommended Direction: Adaptive Reading Rail

Keep the current right-side TOC location and scroll/highlight behavior, but change its presentation by viewport capacity.

### 1536–1879px: compact rail by default

- Render a narrow glass/paper rail that fits the real gutter without reflowing the article grid.
- Keep first-level numbered markers and nested dot markers visible.
- Visually hide heading labels at rest so text never breaks character-by-character.
- On `:hover` or `:focus-within`, expand the rail leftward into a complete TOC panel of approximately `15.5rem` without changing document layout.
- Expansion is temporary and overlays only while the user is interacting with the TOC.
- Keyboard focus must trigger the same expanded state.

### >= 1880px: persistent full TOC

- Use the available right gutter as a full card.
- Show labels continuously.
- Cap the visual width so the rail remains compact and editorial rather than becoming an oversized sidebar.

## Visual Language

The rail should match the existing Katelya article surface rather than introduce a new design system:

- warm translucent card surface using existing `--card-bg-transparent`/`--card-bg` tokens;
- subtle backdrop blur, 1px border, soft shadow, and large rounded corners;
- a small header reading `本页目录` / existing i18n equivalent;
- a thin vertical accent/progress spine;
- first-level sections use the existing numbered badge language;
- deeper levels use progressively smaller dots;
- active section uses a soft primary-tinted fill and stronger marker color;
- full labels use at most two lines with clean line clamping;
- no gradients, oversized icons, or decorative effects that compete with the painterly wallpaper.

## Component Boundary

Create `src/components/features/toc/DesktopTOCRail.astro` as the visual shell used only by the external desktop TOC in `MainGridLayout.astro`.

`SidebarTOC.astro` remains the source of TOC generation, scrolling, and active-section tracking. It gains stable semantic hooks (`sidebar-toc-item`, `sidebar-toc-marker`, `sidebar-toc-label`, `data-depth`) so the desktop rail can style generated items without relying on child position selectors. Existing behavior and other SidebarTOC consumers must continue to work.

`MainGridLayout.astro` replaces the raw external `SidebarTOC` mount with `DesktopTOCRail`. The left CardTOC, right widget sidebar, mobile TOC, floating controls, and article grid geometry remain unchanged.

## Responsive and Interaction Rules

- External desktop rail remains hidden below Tailwind `2xl`, matching the current visibility boundary.
- Compact mode must not increase `documentElement.scrollWidth` beyond the viewport.
- Expanded mode is anchored to the gutter's outer edge and grows inward; it must not cause layout shift.
- `focus-within` mirrors hover for keyboard access.
- `prefers-reduced-motion: reduce` disables width/transform animation while preserving state changes.
- Scrollbars stay visually minimal and do not widen the rail.
- Existing heading click navigation, active indicator updates, SWUP regeneration, and password-decrypted refresh behavior remain unchanged.

## Testing

### Static regression

Extend `tests/katelya-layout-regressions.test.mjs` to require:

- `MainGridLayout.astro` mounts `DesktopTOCRail` instead of a raw external `SidebarTOC`;
- `SidebarTOC.astro` emits semantic item/marker/label hooks and `data-depth`;
- the desktop rail contains compact-mode, hover/focus expansion, persistent-wide-mode, two-line clamping, and reduced-motion rules.

### Real-browser regression

Add `e2e/desktop-toc-reading-rail.spec.ts` using a real article with headings and screenshots under `artifacts/ui/`.

Verify at 1664×900:

- the rail is visible;
- the compact rail stays within the viewport and does not create horizontal overflow;
- heading labels are visually collapsed at rest;
- hover expands the panel to a readable width;
- the expanded panel remains inside the viewport;
- at least one active TOC item is present after scrolling.

Verify at 1920×1080:

- the full rail is persistently readable without requiring hover;
- labels have practical width and do not collapse into vertical character wrapping.

## Non-goals

- Do not redesign the left CardTOC.
- Do not move category/music widgets or change the main `90rem` page width.
- Do not change mobile/tablet TOC behavior.
- Do not rewrite TOC navigation logic unless required by a failing regression test.
- Do not add a new UI dependency.
