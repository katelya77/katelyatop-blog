import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("light hero uses a localized readability veil and explicit contrast tokens", async () => {
	const gallery = await read("src/styles/katelya-van-gogh-gallery.css");
	assert.match(gallery, /--katelya-hero-light-ink:/);
	assert.match(gallery, /--katelya-hero-light-muted:/);
	assert.match(gallery, /\.katelya-hero-copy::before/);
	assert.match(gallery, /radial-gradient\(/);
	assert.match(gallery, /\.katelya-hero-subtitle[\s\S]*var\(--katelya-hero-light-ink\)/);
	assert.match(gallery, /\.katelya-hero-links a[\s\S]*background:/);
});

test("desktop search is a fixed trigger with an independent overlay dialog", async () => {
	const search = await read("src/components/organisms/navigation/Search.svelte");
	const gallery = await read("src/styles/katelya-van-gogh-gallery.css");
	assert.match(search, /data-search-trigger/);
	assert.match(search, /data-search-dialog/);
	assert.match(search, /onkeydown=\{handleDesktopKeydown\}/);
	assert.match(search, /document\.addEventListener\("keydown", onDocumentKeydown\)/);
	assert.doesNotMatch(search, /isDesktopSearchExpanded/);
	assert.doesNotMatch(gallery, /katelya-search-trigger\.is-expanded[\s\S]*width:/);
	assert.match(gallery, /\.katelya-search-desktop-panel/);
	assert.match(gallery, /width:\s*min\(28rem, calc\(100vw - 2rem\)\)/);
});

test("theme switching uses one lightweight 180ms transition path", async () => {
	const settings = await read("src/utils/setting-utils.ts");
	const layout = await read("src/layouts/Layout.astro");
	const gallery = await read("src/styles/katelya-van-gogh-gallery.css");
	const renderer = await read("src/scripts/impasto-renderer.ts");
	assert.doesNotMatch(settings, /startViewTransition/);
	assert.doesNotMatch(settings, /use-view-transition/);
	assert.doesNotMatch(layout, /theme-optimizer\.js/);
	assert.match(settings, /katelya-theme-change/);
	assert.match(gallery, /--katelya-theme-transition:\s*180ms/);
	assert.match(gallery, /\.is-theme-transitioning[\s\S]*transition-duration:\s*var\(--katelya-theme-transition\)/);
	assert.match(renderer, /katelya-theme-change/);
	assert.match(renderer, /THEME_BURST_MS/);
});
