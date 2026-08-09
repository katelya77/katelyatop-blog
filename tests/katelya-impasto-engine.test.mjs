import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("layout mounts exactly one accessible impasto backdrop", async () => {
	const layout = await read("src/layouts/Layout.astro");
	const backdrop = await read("src/components/layout/ImpastoBackdrop.astro");

	assert.equal((layout.match(/<ImpastoBackdrop\s*\/>/g) || []).length, 1);
	assert.match(backdrop, /class="impasto-backdrop"/);
	assert.match(backdrop, /aria-hidden="true"/);
	assert.match(backdrop, /data-impasto-canvas/);
	assert.match(backdrop, /impasto-static-fallback/);
});

test("renderer is lightweight, lifecycle-aware, and WebGL2-first", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");
	const packageJson = await read("package.json");

	assert.match(renderer, /getContext\("webgl2"/);
	assert.match(renderer, /document\.visibilityState/);
	assert.match(renderer, /prefers-reduced-motion/);
	assert.match(renderer, /const MAX_DPR = 1\.4/);
	assert.match(renderer, /const MAX_RENDER_PIXELS = 3_200_000/);
	assert.match(renderer, /connection\?\.saveData/);
	assert.match(renderer, /cancelAnimationFrame/);
	assert.match(renderer, /swup:page:view/);
	assert.match(renderer, /const POINTER_FPS = 48/);
	assert.match(renderer, /const THEME_FPS = 36/);
	assert.match(renderer, /const IDLE_FPS = 14/);
	assert.match(renderer, /katelya-theme-change/);
	assert.doesNotMatch(renderer, /MutationObserver/);
	assert.doesNotMatch(packageJson, /["']three["']/);
});

test("first painted frame owns readiness and static fallback has one owner", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");
	const backdrop = await read("src/styles/impasto-backdrop.css");

	assert.match(renderer, /impasto-booting/);
	assert.match(renderer, /function markFirstFrameReady|const markFirstFrameReady/);
	const firstDraw = renderer.indexOf("gl.drawArrays");
	const readyMutation = renderer.indexOf('classList.add("impasto-ready")');
	assert.ok(firstDraw >= 0, "renderer must draw a first frame");
	assert.ok(
		readyMutation > firstDraw,
		"impasto-ready must only be set after a successful first draw",
	);
	assert.doesNotMatch(
		backdrop,
		/html\.katelya-art-theme body\s*\{[^}]*impasto-day\.svg/s,
		"the component fallback must be the only static painted surface",
	);
	assert.match(backdrop, /transition:\s*opacity 260ms/);
	assert.match(
		backdrop,
		/html\.katelya-art-theme\.dark\.impasto-ready body\s*\{[^}]*background-image:\s*none !important/s,
	);
	assert.match(
		backdrop,
		/html\.katelya-art-theme\.dark #banner-wrapper\s*\{[^}]*background-image:\s*none !important/s,
	);
	assert.match(
		backdrop,
		/html\.katelya-art-theme\.dark body::before,[\s\S]*display:\s*none !important/,
	);
});

test("shader builds irregular tensor-guided impasto instead of formulaic arcs", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");

	assert.match(
		renderer,
		/vec2 tensorDirection = normalize\(tensor\.rg[\s\S]*vec2 direction = normalize\(/,
	);
	assert.match(renderer, /localWarp \* mix\(/);
	assert.match(renderer, /float strokeSegment/);
	assert.match(renderer, /float bristleRidge/);
	assert.match(renderer, /vec3 underpaint/);
	assert.match(renderer, /float canvasWeave/);
	assert.match(renderer, /float pigmentGlaze/);
	assert.match(renderer, /float readingProtection/);
	assert.match(renderer, /float curlNoise/);
	assert.match(renderer, /vec2 vortexWarp/);
	assert.match(renderer, /float brokenStroke/);
	assert.match(renderer, /float paintEdge/);
	assert.match(renderer, /vec2 vortexCenterA/);
	assert.match(renderer, /vec2 vortexCenterB/);
	assert.match(renderer, /vec2 vortexCenterC/);
	assert.match(renderer, /vec2 broadFlow/);
	assert.match(renderer, /vec2 secondaryFlow/);
	assert.match(renderer, /vec2 ridgeFlow/);
	assert.match(renderer, /normal = normalize\(vec3\(-dFdx\(height\) \* 22\.0/);
	assert.doesNotMatch(renderer, /new Image\(/);
	assert.doesNotMatch(renderer, /fetch\(/);
});

test("quantized structure field and generated fallbacks stay compact", async () => {
	const field = JSON.parse(await read("src/data/impasto-field.json"));
	const metadata = JSON.parse(
		await read("public/assets/impasto/impasto-metadata.json"),
	);
	const day = await read("public/assets/impasto/impasto-day.svg");
	const night = await read("public/assets/impasto/impasto-night.svg");

	assert.equal(field.generator, "katelya-structure-tensor-v1");
	assert.equal(field.sourcePathCount, 172000);
	assert.equal(field.width, 32);
	assert.equal(field.height, 18);
	assert.equal(Buffer.from(field.data, "base64").length, 32 * 18 * 4);
	assert.equal(metadata.generator, "katelya-impasto-svg-v1");
	assert.equal(metadata.sourcePathCount, 172000);
	assert.ok(metadata.dayBytes + metadata.nightBytes < 500_000);
	assert.match(day, /feDiffuseLighting/);
	assert.match(day, /feSpecularLighting/);
	assert.match(night, /stroke-linecap="round"/);

	const total =
		(
			await stat(
				new URL("../public/assets/impasto/impasto-day.svg", import.meta.url),
			)
		).size +
		(
			await stat(
				new URL("../public/assets/impasto/impasto-night.svg", import.meta.url),
			)
		).size;
	assert.ok(total < 500_000, `generated fallbacks are ${total} bytes`);
});

test("navigation and page content use independent stable geometry", async () => {
	const grid = await read("src/layouts/MainGridLayout.astro");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const geometry = await read("src/styles/impasto-geometry.css");
	const backdrop = await read("src/styles/impasto-backdrop.css");

	assert.doesNotMatch(grid, /katelya-main-shell absolute/);
	assert.doesNotMatch(grid, /style=\{`top:/);
	assert.doesNotMatch(grid, /id="overlay-root"/);
	assert.match(navbar, /data-katelya-overlay-trigger/);
	assert.doesNotMatch(navbar, /overlayRoot\.append\(panel\)/);
	assert.doesNotMatch(navbar, /MutationObserver/);
	assert.match(navbar, /popovertarget="display-setting"/);
	assert.match(navbar, /popovertarget="nav-menu-panel"/);
	assert.match(geometry, /\.katelya-header-stage[\s\S]*position:\s*fixed/);
	assert.match(geometry, /\.katelya-hero-stage\s*\{[^}]*position:\s*relative/);
	assert.match(geometry, /\.katelya-main-shell\s*\{[^}]*position:\s*relative/);
	assert.doesNotMatch(
		geometry,
		/padding-top:\s*var\(--katelya-active-hero-height\)/,
	);
	assert.doesNotMatch(backdrop, /background-attachment:\s*fixed/);
});

test("touch clients keep dynamic impasto while accessibility fallbacks stay intact", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");
	const backdrop = await read("src/styles/impasto-backdrop.css");
	const geometry = await read("src/styles/impasto-geometry.css");

	assert.match(renderer, /impasto-static/);
	assert.match(renderer, /prefers-reduced-motion/);
	assert.match(renderer, /connection\?\.saveData/);
	assert.doesNotMatch(renderer, /coarsePointer\s*&&\s*window\.innerWidth\s*<\s*900/);
	assert.match(renderer, /TOUCH_MIN_DPR/);
	assert.match(renderer, /TOUCH_MAX_RENDER_PIXELS/);
	assert.match(renderer, /TOUCH_POINTER_FPS/);
	assert.match(renderer, /TOUCH_IDLE_FPS/);
	assert.match(renderer, /\(pointer:\s*coarse\)/);

	assert.match(backdrop, /impasto-day\.svg/);
	assert.match(backdrop, /impasto-night\.svg/);
	assert.match(backdrop, /\.impasto-backdrop::after/);
	assert.match(
		backdrop,
		/html\.katelya-art-theme\.impasto-ready body,[\s\S]*background-image:\s*none !important/,
	);
	assert.match(
		backdrop,
		/html\.impasto-ready \.impasto-static-fallback\s*\{[^}]*visibility:\s*hidden/,
	);
	assert.doesNotMatch(backdrop, /will-change/);
	assert.match(backdrop, /@media \(prefers-reduced-motion:\s*reduce\)/);
	assert.doesNotMatch(
		backdrop,
		/@media \(prefers-reduced-motion:\s*reduce\),\s*\(pointer:\s*coarse\)/,
	);
	assert.match(backdrop, /@media \(forced-colors:\s*active\)/);
	assert.match(geometry, /@media print/);
});
