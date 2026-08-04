import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy banner title cannot reappear over the gallery hero", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const grid = await read("src/layouts/MainGridLayout.astro");

	assert.match(grid, /showTextOverlay=\{false\}/);
	assert.match(hero, /legacyTitle\.classList\.add\("hidden"\)/);
	assert.match(hero, /aria-hidden=\{active \? "false" : "true"\}/);
});

test("hero follows route state and uses shared gallery geometry", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const grid = await read("src/layouts/MainGridLayout.astro");
	const theme = await read("src/styles/katelya-van-gogh-gallery.css");

	assert.match(hero, /active\??:\s*boolean/);
	assert.match(hero, /is-home-active/);
	assert.match(hero, /function syncKatelyaHomeState\(isHomePage\)/);
	assert.match(hero, /katelya-home-page/);
	assert.match(grid, /katelya-main-shell/);
	assert.match(grid, /is-home-layout/);
	assert.match(theme, /--katelya-home-hero-height:/);
	assert.match(theme, /--katelya-article-banner-height:/);
	assert.match(theme, /\.katelya-main-shell\.is-home-layout/);
	assert.match(theme, /#main-grid\s*\{[\s\S]*?transform:\s*none\s*!important/);
});

test("full page uses day-night painterly artwork and clips overflow", async () => {
	const theme = await read("src/styles/katelya-van-gogh-gallery.css");
	const dayArtwork = await read("public/assets/art/katelya-van-gogh-day.svg");
	const nightArtwork = await read("public/assets/art/katelya-van-gogh-night.svg");

	assert.match(theme, /katelya-van-gogh-day\.svg/);
	assert.match(theme, /katelya-van-gogh-night\.svg/);
	assert.match(theme, /overflow-x:\s*clip/);
	assert.match(theme, /background-attachment:\s*fixed/);
	assert.match(dayArtwork, /feTurbulence/);
	assert.match(dayArtwork, /stroke-linecap="round"/);
	assert.match(nightArtwork, /feTurbulence/);
	assert.match(nightArtwork, /stroke-linecap="round"/);
});

test("desktop navigation is centered and keeps a stable primary order", async () => {
	const navConfig = await read("src/config/navBarConfig.ts");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const theme = await read("src/styles/katelya-van-gogh-gallery.css");

	assert.match(navConfig, /LinkPreset\.Home[\s\S]*LinkPreset\.Archive/);
	assert.match(navConfig, /name:\s*"项目"/);
	assert.match(navConfig, /name:\s*"时间线"/);
	assert.match(navConfig, /name:\s*"关于"/);
	assert.match(navbar, /katelya-gallery-header/);
	assert.match(navbar, /katelya-navbar-links/);
	assert.doesNotMatch(navbar, /hideLinks/);
	assert.match(theme, /grid-template-columns:\s*minmax\(12rem,\s*1fr\)\s+auto\s+minmax\(12rem,\s*1fr\)/);
	assert.match(theme, /\.katelya-navbar-links[\s\S]*?opacity:\s*1\s*!important/);
});

test("display settings close invisibly and stay inside the viewport", async () => {
	const config = await read("src/config/siteConfig.ts");
	const theme = await read("src/styles/katelya-van-gogh-gallery.css");
	const animation = await read("src/styles/panel-animations.css");

	assert.match(config, /themeColor:\s*\{[\s\S]*?fixed:\s*true/);
	assert.match(config, /pageScaling:\s*\{[\s\S]*?enable:\s*false/);
	assert.match(theme, /#display-setting[\s\S]*?position:\s*fixed\s*!important/);
	assert.match(theme, /max-width:\s*calc\(100vw\s*-\s*2rem\)\s*!important/);
	assert.match(theme, /max-height:\s*calc\(100dvh\s*-\s*7rem\)\s*!important/);
	assert.match(animation, /\.float-panel-closed[\s\S]*opacity:\s*0/);
	assert.match(animation, /\.float-panel-closed[\s\S]*visibility:\s*hidden/);
	assert.doesNotMatch(animation, /scaleX\(0\.6\)/);
});
