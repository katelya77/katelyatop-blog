import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("day and night artwork drive banner and overlay wallpaper", async () => {
	const site = await read("src/config/siteConfig.ts");
	const wallpaper = await read("src/config/backgroundWallpaper.ts");
	const component = await read("src/components/misc/FullscreenWallpaper.astro");
	const day = await read("public/assets/art/katelya-van-gogh-day.svg");
	const night = await read("public/assets/art/katelya-van-gogh-night.svg");

	assert.match(site, /katelya-van-gogh-day\.svg/);
	assert.match(site, /katelya-van-gogh-night\.svg/);
	assert.match(wallpaper, /katelya-van-gogh-day\.svg/);
	assert.match(wallpaper, /katelya-van-gogh-night\.svg/);
	assert.doesNotMatch(wallpaper, /desktop-banner|mobile-banner/);
	assert.match(component, /data-katelya-wallpaper/);
	assert.match(component, /katelya-wallpaper--day/);
	assert.match(component, /katelya-wallpaper--night/);
	assert.match(day, /feTurbulence/);
	assert.match(day, /#6f55a8/i);
	assert.match(night, /#f2c85b/i);
	assert.match(night, /stroke-linecap="round"/);
});

test("gallery header is independent and desktop search is click driven", async () => {
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const search = await read("src/components/organisms/navigation/Search.svelte");
	const layout = await read("src/layouts/MainGridLayout.astro");

	assert.match(navbar, /katelya-gallery-header/);
	assert.match(navbar, /katelya-navbar-brand/);
	assert.match(navbar, /katelya-navbar-links/);
	assert.match(navbar, /katelya-navbar-tools/);
	assert.doesNotMatch(navbar, /hideLinks/);
	assert.doesNotMatch(search, /onmouseenter=/);
	assert.match(search, /onclick=\{toggleDesktopSearch\}/);
	assert.match(layout, /katelya-header-stage/);
	assert.doesNotMatch(layout, /id="top-row"/);
});

test("post cards use one contained entry affordance", async () => {
	const card = await read("src/components/features/posts/PostCard.astro");
	assert.match(card, /katelya-post-card/);
	assert.match(card, /katelya-post-card-arrow/);
	assert.doesNotMatch(card, /absolute right-3 top-3 bottom-3/);
});

test("day night design tokens style shared components without overflow", async () => {
	const theme = await read("src/styles/katelya-van-gogh-gallery.css");
	assert.match(theme, /--katelya-day-canvas:/);
	assert.match(theme, /--katelya-night-canvas:/);
	assert.match(theme, /--katelya-gallery-header-height:/);
	assert.match(theme, /\.dark[\s\S]*--katelya-surface:/);
	assert.match(theme, /\.card-base/);
	assert.match(theme, /#left-sidebar/);
	assert.match(theme, /#right-sidebar/);
	assert.match(theme, /overflow-x:\s*clip/);
	assert.match(theme, /prefers-reduced-motion/);
});
