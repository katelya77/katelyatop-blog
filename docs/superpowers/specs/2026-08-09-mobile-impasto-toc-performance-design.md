# Mobile Impasto + TOC Performance Design

## Goal

Make the production blog use the same Impasto WebGL art direction on desktop, iPad, and phones while keeping mobile rendering bounded, make the desktop article reading rail feel instant and smooth on hover/focus, and reduce non-critical first-load work without changing article geometry or existing navigation behavior.

## Current problems

1. `src/scripts/impasto-renderer.ts` explicitly returns static mode for coarse pointers below 900px.
2. `src/styles/impasto-backdrop.css` hides the WebGL canvas for every `(pointer: coarse)` device, which also disables the dynamic background on iPad.
3. `DesktopTOCRail.astro` animates `width`, label `max-width`, and marker `margin` while a blurred translucent surface is repainted. This creates repeated layout/reflow work during hover expansion.
4. `Pio.astro` renders an iframe with a real `src` immediately. The controller delays initialization, but the browser can still begin fetching/parsing the iframe before that delay, including on mobile where the widget will be hidden.

## Recommended architecture

### 1. One Impasto renderer, adaptive quality tiers

Keep one WebGL2 shader and the same palette/flow model on all normal clients. Remove coarse-pointer as a reason to force static rendering. Static mode remains only for:

- `prefers-reduced-motion: reduce`
- `navigator.connection.saveData === true`
- WebGL2/context/shader failure
- forced-colors / print CSS fallbacks

Touch devices use the same renderer at a lower internal cost:

- lower minimum DPR on coarse pointers
- lower render-pixel budget on coarse pointers
- lower interactive/idle frame-rate targets on coarse pointers
- same shader, same colors, same time-based flow, so the visual language remains consistent with desktop

The SVG fallback remains the immediate first painted surface while WebGL boots and remains the accessible/low-data fallback.

### 2. Composite-only desktop TOC reveal

For the 1536–1879px adaptive range, stop morphing one surface with layout-affecting properties. Instead:

- keep a narrow compact rail as the stable hover/focus target
- keep a full-width reading panel positioned absolutely and anchored to the rail's right edge
- reveal the full panel with `transform` + `opacity` only
- hide/fade the compact visual layer while the full panel is visible
- keep `SidebarTOC` as the single interactive/observer-driven TOC instance, so heading tracking and click navigation remain unchanged
- use a lightweight compact preview generated from the server-provided headings only for visual affordance; it is `aria-hidden` and does not add another IntersectionObserver

At >=1880px the full panel remains persistently visible as it is today.

### 3. First-load prioritization

Keep the static Impasto fallback in HTML/CSS so there is no blank background. Split WebGL/hero-depth initialization behind dynamic imports scheduled immediately after the first browser paint. This keeps visual continuity while allowing critical document rendering to win the first frame.

For Pio/Live2D:

- render the iframe without a network-bearing `src`
- store the host URL in `data-src`
- assign `src` only from the existing idle scheduler and only when the widget is eligible to be visible
- do not load it at all on mobile when `hiddenOnMobile` applies

No third-party dependency is added.

## Compatibility and safeguards

- Left article CardTOC is untouched.
- Right widget column geometry is untouched.
- Desktop persistent TOC behavior at >=1880px is preserved.
- `prefers-reduced-motion` remains respected.
- save-data users still receive the generated SVG fallback.
- WebGL failures still fall back cleanly.
- touch devices do not need hover to see the page background; the dynamic background starts automatically.
- no secrets or deployment credentials are added to source files.

## Verification

Static regressions will assert that coarse pointers no longer force static Impasto, reduced-motion/save-data still do, mobile quality limits exist, the TOC no longer transitions `width`/`max-width`/marker `margin`, and Pio has no eager iframe `src`.

Playwright will cover:

- iPhone-sized coarse-pointer page reaches `impasto-ready` with visible canvas
- iPad-sized coarse-pointer page reaches `impasto-ready` with visible canvas
- reduced-motion mobile remains static
- 1664px rail expands with stable layout width and no horizontal overflow
- existing 1920px persistent rail remains readable

CI must pass Biome, Node tests, Astro check, build, and Playwright before merge.
