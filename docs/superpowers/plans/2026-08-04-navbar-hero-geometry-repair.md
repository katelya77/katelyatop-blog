# Navbar and Hero Geometry Repair Plan

**Goal:** Remove the duplicated Hero spacer and make the visible navigation panel and its content share one stable geometry in every wallpaper mode.

## Root causes

1. `katelya-van-gogh-safety.css` creates a pseudo-element spacer while `impasto-geometry.css` also applies route-aware top padding. Both reserve the same banner height.
2. The visible navbar background lives on a nested `#navbar > .katelya-navbar-shell`, while multiple legacy stylesheets also target `#navbar > div`. This gives the panel and navigation content competing layout rules.
3. Wallpaper mode state reactivates legacy `#navbar > div` rules after hydration.

## Implementation

- Add failing source-contract tests for a single Hero spacer and a single navigation shell.
- Remove the pseudo-element spacer and retain route-aware `padding-top` only.
- Make `#navbar` itself the grid/panel element; render floating panels as siblings and portal them to `#overlay-root`.
- Stop loading the two legacy navbar override stylesheets.
- Strengthen desktop and responsive navbar geometry in `impasto-geometry.css`.
- Run tests, Biome, Astro check, production build, create PR, and squash merge after green CI.
