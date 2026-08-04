import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readTheme = async () => {
	const [gallery, safety, geometry] = await Promise.all([
		read("src/styles/katelya-van-gogh-gallery.css"),
		read("src/styles/katelya-van-gogh-safety.css"),
		read("src/styles/impasto-geometry.css"),
	]);
	return `${gallery}\n${safety}\n${geometry}`;
};

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
	const theme = await readTheme();

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
	const theme = await readTheme();
	const dayArtwork = await read("public/assets/art/katelya-van-gogh-day.svg");
	const nightArtwork = await read("public/assets/art/katelya-van-gogh-night.svg");

	assert.match(theme, /katelya-van-gogh-day\.svg/);
	assert.match(theme, /katelya-van-gogh-night\.svg/);
	assert.match(theme, /overflow-x:\s*clip/);
	assert.match(theme, /background-attachment:\s*scroll\s*!important/);
	assert.match(dayArtwork, /stroke-linecap="round"/);
	assert.match(nightArtwork, /stroke-linecap="round"/);
});

test("desktop navigation is centered and keeps a stable primary order", async () => {
	const navConfig = await read("src/config/navBarConfig.ts");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const theme = await readTheme();

	assert.match(navConfig, /LinkPreset\.Home[\s\S]*LinkPreset\.Archive/);
	assert.match(navConfig, /name:\s*"项目"/);
	assert.match(navConfig, /name:\s*"时间线"/);
	assert.match(navConfig, /name:\s*"关于"/);
	assert.match(navbar, /katelya-gallery-header/);
	assert.match(navbar, /katelya-navbar-links/);
	assert.doesNotMatch(navbar, /hideLinks/);
	assert.match(theme, /grid-template-columns:\s*minmax\(11\.5rem,\s*1fr\)\s+auto\s+minmax\(11\.5rem,\s*1fr\)/);
	assert.match(theme, /\.katelya-navbar-links[\s\S]*?opacity:\s*1\s*!important/);
});

test("display settings close invisibly and stay inside the viewport", async () => {
	const config = await read("src/config/siteConfig.ts");
	const theme = await readTheme();
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

test("gallery reserves banner height exactly once", async () => {
	const safety = await read("src/styles/katelya-van-gogh-safety.css");
	const geometry = await read("src/styles/impasto-geometry.css");

	assert.doesNotMatch(safety, /\.katelya-main-shell::before/);
	assert.doesNotMatch(safety, /\.katelya-main-shell\.is-home-layout::before/);
	assert.match(geometry, /\.katelya-main-shell\s*\{[\s\S]*?padding-top:\s*var\(--impasto-article-space\)\s*!important/);
	assert.match(geometry, /\.katelya-main-shell\.is-home-layout\s*\{[\s\S]*?padding-top:\s*var\(--impasto-home-space\)\s*!important/);
	assert.match(geometry, /body\.fullscreen-banner \.katelya-main-shell[\s\S]*?padding-top:\s*100dvh\s*!important/);
});

test("navbar panel and content use one DOM grid", async () => {
	const layout = await read("src/layouts/Layout.astro");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const geometry = await read("src/styles/impasto-geometry.css");

	assert.doesNotMatch(layout, /mobile-navbar\.css/);
	assert.doesNotMatch(layout, /wallpaper-navbar-transparent\.css/);
	assert.match(navbar, /id="navbar"[\s\S]*class="katelya-gallery-header katelya-navbar-shell z-50"/);
	assert.doesNotMatch(navbar, /<div class:list=\{\[className, "katelya-navbar-shell"\]\}>/);
	assert.match(geometry, /#navbar\.katelya-navbar-shell\s*\{[\s\S]*?display:\s*grid\s*!important/);
	assert.match(geometry, /#navbar\.katelya-navbar-shell\s*>\s*\.katelya-navbar-brand/);
	assert.match(geometry, /#navbar\.katelya-navbar-shell\s*>\s*\.katelya-navbar-links/);
	assert.match(geometry, /#navbar\.katelya-navbar-shell\s*>\s*\.katelya-navbar-tools/);
});

test("fixed gallery header does not animate vertically on page load", async () => {
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	assert.doesNotMatch(navbar, /katelya-gallery-header z-50 onload-animation/);
});

test("settings button resolves the hydrated panel when clicked", async () => {
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");

	assert.match(navbar, /const getSettingsPanel = \(\) => document\.getElementById\("display-setting"\)/);
	assert.match(navbar, /const onSettingsClick = \(\) => togglePanel\(getSettingsPanel\(\)\)/);
	assert.doesNotMatch(navbar, /const settingsPanel = document\.getElementById\("display-setting"\)/);
});

test("hero route sync avoids observing every DOM mutation", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	assert.doesNotMatch(hero, /new MutationObserver/);
	assert.match(hero, /document\.addEventListener\("swup:page:view", queueHomeStateSync\)/);
});

test("only the current gallery theme stylesheet is loaded", async () => {
	const layout = await read("src/layouts/Layout.astro");
	const grid = await read("src/layouts/MainGridLayout.astro");

	assert.doesNotMatch(layout, /katelya-impressionist\.css/);
	assert.match(grid, /katelya-van-gogh-gallery\.css/);
});
