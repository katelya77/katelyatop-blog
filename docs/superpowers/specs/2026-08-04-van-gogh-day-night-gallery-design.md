# Katelya Van Gogh Day/Night Gallery Design

## Goal

Transform the current impressionist redesign into one coherent day/night art system while fixing the reported navbar, overlay wallpaper, article-card affordance, and component-overlap defects.

## Visual Direction

The design is original and does not reproduce a specific painting. It translates recurring visual language from Van Gogh's work into web primitives:

- Day mode: iris violet, blue-green foliage, pale almond-blossom whites, warm daylight, short directional brush marks.
- Night mode: cobalt and lapis blues, mineral-gold stars, rolling cyan strokes, dark cypress-like vertical anchors.
- Shared: thick-paint texture, visible rhythm, complementary-color accents, hand-drawn edges, controlled asymmetry.

## Architecture

1. `public/assets/art/katelya-van-gogh-day.svg` and `katelya-van-gogh-night.svg` provide original programmatic artwork with safe text zones.
2. A single art-surface CSS layer chooses the correct asset from the document theme and applies it consistently to banner, page background, and overlay wallpaper.
3. Navbar becomes a fixed gallery header independent from banner geometry. It uses a three-zone layout and never expands into a full-width empty sheet.
4. Search opens on click/focus instead of hover and uses a viewport-constrained panel.
5. Post cards use one whole-card affordance plus one contained brush-arrow cue. The detached full-height entry button is removed.

## Component Rules

### Gallery Header

- Fixed below the viewport top safe area, centered with `width: min(calc(100vw - 2rem), var(--page-width))`.
- Brand left, primary navigation centered, tools right.
- Compact translucent paint-glass surface with visible border and textured inner highlight.
- On article pages and after scrolling, surface becomes more opaque without changing height.
- Hero orbit cards must not occupy the navbar row.

### Banner and Hero

- Homepage hero has one title system only.
- Article banner remains separate from homepage hero and receives a smaller height.
- Main content starts after the real banner height; no overlapping negative transforms.
- Text safe zone is centered and background strokes move around it rather than through it.

### Overlay Wallpaper

- Overlay mode uses the same day/night art assets as banner mode.
- Old `desktop-banner/*.webp` and `mobile-banner/*.webp` are not referenced by runtime configuration.
- Wallpaper opacity, blur, and card opacity remain adjustable, but the image identity is fixed to the Katelya art system.

### Cards and Widgets

- All cards use warm canvas surfaces, not pure white.
- Day borders use muted iris/cyan; night borders use cobalt/gold.
- Sidebar, statistics, calendar, player, announcement, tags, and article cards share radius and shadow tokens.
- No component may extend beyond the viewport or create horizontal scrolling.

### Post Cards

- Entire card title and body area remain valid links through existing semantic anchors.
- The no-cover card removes the absolute right-side full-height entry button.
- One compact decorative arrow remains inside the card boundary.
- Mobile and desktop use the same affordance hierarchy.

## Responsive Behavior

- Desktop: full three-zone header and orbit scene.
- Tablet: compact brand, selected primary links, tools; overflow links move to the menu.
- Mobile: brand plus search/theme/menu controls; no orbit card intersects navigation.
- Reduced-motion: disable pointer tilt, animated paint drift, and rotating highlights.

## Accessibility

- Maintain readable foreground contrast in both themes.
- Preserve keyboard focus rings.
- Decorative SVG elements are hidden from assistive technology.
- Search, settings, and menu controls retain explicit labels.

## Testing

Add regression coverage for:

- day/night assets referenced by banner and overlay wallpaper;
- no legacy wallpaper paths in active configuration;
- navbar fixed gallery structure and no hover-to-expand search;
- no detached post-card entry button;
- shared component tokens and horizontal overflow containment;
- production build, Biome, Astro check, and existing tests.
