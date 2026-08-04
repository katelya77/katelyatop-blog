# Homepage Visual Layout Repair Design

## Goal

Repair the first impressionist redesign so the whole blog reads as one coherent blue-green oil-painting environment, while eliminating duplicate hero text, unstable navigation alignment, the broken display-settings panel, and horizontal page overflow.

## Approved direction

Use a structural repair rather than isolated CSS patches. Keep the original Katelya visual language—blue-green impasto, mist white, mineral-gold highlights, and restrained violet accents—but separate the persistent site shell from Swup-replaced page content.

## Visual system

- Add a dedicated fixed page-canvas layer behind every page. It uses an original SVG brush field with short curved strokes, displaced pigment bands, canvas grain, and gold flecks.
- Keep the existing large spiral artwork for the homepage banner, but allow the fixed brush field to remain visible below the banner and between translucent cards.
- Do not copy any specific Van Gogh or Monet painting. Reuse only high-level painterly language: directional brushwork, thick pigment, luminous contrast, atmospheric depth, and rhythmic movement.
- Preserve text readability by placing cards on mist-white translucent paper rather than rendering text directly on a high-contrast painting.

## Homepage lifecycle and geometry

- Render `KatelyaOrbitHero` once as part of the persistent shell, regardless of the initial route.
- Mark it active only when the current Swup page metadata reports `data-is-home="true"`.
- Remove the old Banner text overlay from the DOM whenever `showTextOverlay` is false; hiding it with a class is insufficient because the Swup hook can remove that class.
- Introduce one CSS variable, `--katelya-hero-height`, as the source of truth for the homepage banner, hero, top-row reserve, and main-content start position.
- Add a persistent `.katelya-main-shell` and toggle `.is-home-layout` during Swup navigation. Homepage content starts at `--katelya-hero-height`; non-home routes retain the original compact banner behavior.

## Navigation

- Use a true three-column desktop grid: brand on the left, navigation centered independently, controls on the right.
- Use direct primary links in this order: 主页、归档、项目、时间线、关于、更多.
- Remove the script that hides the entire navigation whenever the search control is hovered.
- Collapse primary navigation into the existing menu below the large-tablet breakpoint rather than squeezing labels.

## Display settings panel

- Fix the artistic hue in configuration so users cannot destroy the curated palette.
- Keep useful wallpaper, effects, and layout controls.
- Constrain the panel to the viewport with a fixed position, responsive width, maximum height, and internal scrolling.
- Closed panels use opacity, visibility, translation, and pointer-event control. They must not remain as scaled slivers at the right edge.

## Overflow safeguards

- Fix the known sources first: transformed panels, persistent hero geometry, navbar sizing, and full-width decorative layers.
- Add `overflow-x: clip` to the themed root and body as a final containment boundary.
- Decorative layers must use `inset: 0`, `max-width: 100vw`, and `pointer-events: none`.

## Responsive behavior

- Desktop retains the orbit cards and subtle pointer parallax.
- Tablet hides the centered primary navigation and uses the menu panel.
- Mobile hides the orbit-stage cards, reduces headline size, keeps one readable title, disables fixed-background attachment, and preserves the painterly page canvas.
- `prefers-reduced-motion: reduce` disables orbit movement and decorative animation.

## Verification

Automated checks must verify:

1. Banner overlay is conditionally absent rather than class-hidden.
2. The persistent hero and Swup synchronization hooks exist.
3. The shared hero-height variable drives the homepage shell.
4. Navbar uses named three-column layout hooks and no hover-to-hide script.
5. Settings panels close with opacity/visibility and are viewport constrained.
6. The fixed brush-field artwork and horizontal overflow containment exist.
7. Tests, Biome, Astro type checking, and production build all pass before merge.
