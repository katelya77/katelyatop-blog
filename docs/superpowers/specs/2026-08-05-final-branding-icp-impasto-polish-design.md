# Final Branding, ICP Footer, and Impasto Motion Polish

## Scope

This final polish keeps the current stable layout and content while making four focused changes:

1. Close the two Dependabot pull requests without merging them.
2. Keep the public site name exactly `Katelya · 思囿随笔`; the home page browser title must not append the configured subtitle.
3. Add a compact, accessible ICP filing badge linking to `https://beian.miit.gov.cn/` with the exact text `赣ICP备2025074096号`.
4. Make the impasto background feel smoother and less like contour-map geometry without adding Three.js, a second canvas, or heavy dependencies.

## Branding

`siteConfig.title`, the navbar title, and the Hero title remain `Katelya · 思囿随笔`. The home document title is exactly that string. Inner pages continue to prefix their page title, followed by the site name.

## ICP footer

The ICP record appears below the existing Astro/Mizuki credit as a small rounded badge. It uses an inline shield/check icon, subtle mineral-gold accent, translucent background, keyboard focus ring, hover lift, and reduced-motion fallback. The badge opens the official Ministry of Industry and Information Technology filing portal in a new tab.

## Impasto motion

The existing single WebGL2 canvas remains the only dynamic renderer. The polish changes the motion rather than replacing the engine:

- idle rendering increases from visibly stepped 8 FPS to a still-low-power 14 FPS;
- pointer interaction uses 48 FPS and theme transitions use 36 FPS;
- the three local vortices drift independently by small, non-periodic offsets;
- broad pigment, secondary colour, and short-stroke fields travel at different rates to avoid one rigid surface sliding as a whole;
- tensor direction remains an influence but no longer dominates every region;
- contour-like ridge contrast and normal strength are reduced;
- local stroke highlights and roughness variation are retained for depth;
- reduced-motion, coarse-pointer, save-data, hidden-page pause, and the 3.2M render-pixel budget remain intact.

## Verification

Regression tests must verify the exact home title, ICP text/link/accessibility attributes, the updated frame-rate budget, independent time offsets, lower contour weighting, and the absence of new rendering libraries. Existing unit, Biome, Astro type, build, and Playwright suites must pass before merge.
