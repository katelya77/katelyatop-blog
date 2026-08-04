# Light Hero, Search Overlay, and Theme Performance Plan

## Goal
Improve light-theme hero readability, eliminate desktop search overlap, and make theme switching feel immediate and smooth without reducing the impasto visual quality.

## Tasks
1. Add regression contracts for hero contrast, fixed-size search trigger, overlay search panel, and lightweight theme switching.
2. Replace in-navbar expanding desktop search with a fixed trigger plus an independent overlay panel.
3. Add a localized light-theme hero readability veil and stronger title/subtitle contrast while preserving the surrounding artwork.
4. Replace full-document View Transition and legacy theme optimizer work with a 180ms lightweight theme state transition.
5. Update the WebGL renderer so theme changes render a bounded short burst rather than a 1.5 second high-FPS wake cycle.
6. Run tests, Biome, Astro check, and production build; create PR and squash merge after all checks pass.

## Acceptance criteria
- Light theme hero title, subtitle, eyebrow, quick links, and orbit cards remain readable over the brightest art regions.
- Search never changes navbar grid width or overlaps the “更多” navigation item.
- Search opens below the navbar, focuses automatically, closes on Escape/outside click/page navigation, and remains viewport-bounded.
- Theme switching does not use `document.startViewTransition` and does not load the legacy `theme-optimizer.js`.
- Theme transition duration is approximately 180ms and only transitions key surfaces/colors.
- Impasto renderer performs one bounded theme refresh and returns to idle rendering.
- Existing content and artwork assets remain unchanged.
