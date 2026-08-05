# Impasto First Frame, Expressive 3D, and Music Refresh Design

## Goal

Make the first painted frame visually continuous with the WebGL result, replace the overly regular dark composition with an asymmetric, brush-led Van Gogh-inspired field, strengthen the homepage depth without harming reading or performance, and replace the local four-song playlist with the user-provided 21-track playlist and one original shared cover.

## Scope

- Fix the refresh-time fallback flash.
- Refine day and night impasto rendering.
- Strengthen Hero depth and pointer response.
- Add one original shared playlist cover.
- Replace `LOCAL_PLAYLIST` with the supplied 21 tracks in the supplied order.
- Preserve all article, project, profile, navigation, wallpaper-mode, theme, sidebar, and Cloudflare deployment behavior.

## First-frame lifecycle

The renderer owns an explicit state sequence:

1. `impasto-booting`: the canvas is present but transparent; the fallback is fully visible.
2. The shader, texture, uniforms, viewport, and first frame are prepared.
3. Only after the first successful `gl.drawArrays` and `gl.finish`/frame completion signal does the root enter `impasto-ready`.
4. The fallback and canvas crossfade for 260ms using the same palette and visual density.
5. Static mode keeps the fallback permanently visible.
6. Renderer failure restores `impasto-static` and never shows an empty canvas.

The body must not independently paint a different full-screen SVG while the component fallback is visible. There is one fallback surface and one transition owner.

## Paint language

The background must be inspired by painterly motion rather than literal copies of paintings.

### Day

- Turquoise, celadon, pale cobalt, cream, muted iris, and restrained mineral gold.
- Broad atmospheric underpainting plus broken directional short strokes.
- Central reading protection remains calm and lighter.
- No repetitive horizontal mathematical bands.

### Night

- Ultramarine, deep cobalt, petrol blue, muted cyan, violet-black, and sparse warm gold.
- Asymmetric local vortices instead of large mirrored arcs.
- Stroke length, angle, spacing, width, and pigment concentration vary spatially.
- Cypress-like vertical masses may anchor edges but cannot be symmetric.
- Stars appear as irregular pigment blooms and broken halos, not geometric icons.

### Shader structure

- Multi-scale underpainting.
- Tensor-guided local direction with low-frequency curl perturbation.
- Broken short-stroke masks with randomized segment lengths and gaps.
- Bristle ridges and paint-height normals.
- Local vortex centers placed asymmetrically by deterministic constants.
- Sparse mineral-gold pigment deposits.
- Central reading-protection mask.
- Canvas grain that stays subtle at the center.

## 3D interaction

The Hero uses one pointer state and exposes normalized variables for all layers:

- Background light direction reacts subtly.
- Aura/paint layers move at shallow depth.
- Title moves less than orbit cards and receives a moving edge highlight.
- Orbit cards use distinct depth values and slight independent translation, not only whole-stage rotation.
- Motion is bounded and eased; no spring overshoot.
- `prefers-reduced-motion`, coarse pointers, and hidden pages disable or reduce the effect.
- No continuous high-frame animation is added solely for 3D.

## Performance

- Keep WebGL2 and the existing tensor field.
- No Three.js or other 3D framework.
- Maximum DPR remains 1.4 and render pixels remain bounded.
- Idle rendering remains low-frequency.
- Resize work is outside the draw loop.
- The fallback is not repeatedly painted after WebGL is ready.
- The first-frame fix must not add an extra full-page image request beyond the one shared fallback asset.

## Playlist

The local playlist is replaced with 21 tracks, retaining the user-provided order and exact URLs. Each item has a stable numeric ID, title, artist, shared cover path, URL, and duration `0` so the browser reads metadata.

The existing player error handler already skips failed tracks after `SKIP_ERROR_DELAY`; this behavior is preserved. The FLAC URL remains FLAC. The UI must not eagerly fetch all 21 audio files.

## Shared cover

Create `public/assets/music/cover/katelya-starry-playlist.svg`:

- Square composition.
- Ultramarine/cobalt underpainting.
- Asymmetric turquoise and iris brush currents.
- Small mineral-gold star bloom.
- Subtle hidden K/cypress silhouette.
- No copyrighted album art or direct reproduction of a painting.
- Static SVG without expensive filters or animation.

## Tests and acceptance

- Unit contract: playlist has exactly 21 tracks in the supplied order and every track uses the shared cover.
- Unit contract: first-ready state is set only after a successful first draw.
- Unit contract: shader includes curl/vortex irregularity and no old formulaic symmetric arc assets are introduced.
- Browser: on hard refresh, fallback remains visible until canvas has non-transparent rendered pixels; no mismatched flash.
- Browser: day and night screenshots for banner and fullscreen.
- Browser: pointer movement changes layer transforms while remaining within bounds.
- Browser: reduced motion disables the stronger 3D response.
- Browser: playlist UI exposes the new first track and all 21 entries.
- Existing Tests, Biome, Astro Type Check, Production Build, and Playwright regressions must stay green.
