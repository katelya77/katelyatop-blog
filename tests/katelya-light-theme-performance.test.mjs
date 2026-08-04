import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("light hero uses a localized readability veil and explicit contrast tokens", async () => {
	const performanceCss = await read("src/styles/katelya-light-performance.css");
	assert.match(performanceCss, /--katelya-hero-light-ink:/);
	assert.match(performanceCss, /--katelya-hero-light-muted:/);
	assert.match(performanceCss, /\.katelya-hero-copy::before/);
	assert.match(performanceCss, /radial-gradient\(/);
	assert.match(
		performanceCss,
		/\.katelya-hero-subtitle[\s\S]*var\(--katelya-hero-light-ink\)/,
	);
	assert.match(performanceCss, /\.katelya-hero-links a[\s\S]*background:/);
});

test("desktop search is a fixed trigger with an independent overlay dialog", async () => {
	const search = await read("src/components/organisms/navigation/Search.svelte");
	const performanceCss = await read("src/styles/katelya-light-performance.css");
	assert.match(search, /<button[\s\S]*data-search-trigger/);
	assert.match(search, /aria-controls="search-panel"/);
	assert.match(search, /aria-expanded=\{isOpen\}/);
	assert.match(search, /data-search-dialog/);
	assert.match(search, /popover="auto"/);
	assert.doesNotMatch(search, /handleDesktopKeydown/);
	assert.doesNotMatch(search, /isDesktopSearchExpanded/);
	assert.match(
		performanceCss,
		/\.katelya-search-trigger[\s\S]*width:\s*2\.5rem\s*!important/,
	);
	assert.match(performanceCss, /\.katelya-search-desktop-panel/);
	assert.match(
		performanceCss,
		/width:\s*min\(28rem, calc\(100vw - 2rem\)\)/,
	);
});

test("search overlay is anchored to the trigger and isolated from navbar links", async () => {
	const search = await read("src/components/organisms/navigation/Search.svelte");
	const performanceCss = await read("src/styles/katelya-light-performance.css");
	const geometryCss = await read("src/styles/impasto-geometry.css");

	assert.match(search, /const positionSearchPanel/);
	assert.match(search, /getBoundingClientRect\(\)/);
	assert.match(search, /--katelya-search-panel-top/);
	assert.match(search, /--katelya-search-panel-left/);
	assert.match(search, /window\.addEventListener\("resize", scheduleSearchPanelPosition/);
	assert.match(search, /window\.addEventListener\("scroll", scheduleSearchPanelPosition/);
	assert.match(search, /data-search-close/);
	assert.match(
		performanceCss,
		/top:\s*var\(--katelya-search-panel-top\)\s*!important/,
	);
	assert.match(
		performanceCss,
		/left:\s*var\(--katelya-search-panel-left\)\s*!important/,
	);
	assert.doesNotMatch(
		performanceCss,
		/top:\s*calc\(var\(--katelya-gallery-header-height\)/,
	);
	assert.match(
		geometryCss,
		/#search-container[\s\S]*inline-size:\s*2\.5rem[\s\S]*flex:\s*0 0 2\.5rem/,
	);
});

test("theme switching uses one lightweight 180ms transition path", async () => {
	const controller = await read("src/utils/lightweight-theme.ts");
	const optimizer = await read("src/scripts/theme-optimizer.js");
	const performanceCss = await read("src/styles/katelya-light-performance.css");
	const renderer = await read("src/scripts/impasto-renderer.ts");
	assert.doesNotMatch(controller, /startViewTransition/);
	assert.doesNotMatch(controller, /use-view-transition/);
	assert.doesNotMatch(optimizer, /MutationObserver|getBoundingClientRect|translateZ/);
	assert.match(controller, /katelya-theme-change/);
	assert.match(performanceCss, /--katelya-theme-transition:\s*180ms/);
	assert.match(
		performanceCss,
		/\.is-theme-transitioning[\s\S]*transition-duration:\s*var\(--katelya-theme-transition\)/,
	);
	assert.match(renderer, /katelya-theme-change/);
	assert.match(renderer, /const THEME_BURST_MS = 220/);
});
