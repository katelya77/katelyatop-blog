import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("inactive legacy banner title is not rendered into the DOM", async () => {
	const banner = await read("src/components/layout/Banner.astro");
	assert.match(banner, /\{showTextOverlay\s*&&\s*\(/);
	assert.doesNotMatch(banner, /!showTextOverlay\s*\?\s*"hidden"/);
});

test("persistent hero follows Swup home state and shared geometry", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const grid = await read("src/layouts/MainGridLayout.astro");
	const hooks = await read("src/scripts/core/swup-hooks.ts");
	const theme = await read("src/styles/katelya-impressionist.css");

	assert.match(hero, /active\??:\s*boolean/);
	assert.match(hero, /is-home-active/);
	assert.match(grid, /katelya-main-shell/);
	assert.doesNotMatch(grid, /isHomePage\s*&&\s*siteConfig\.banner\.homeText/);
	assert.match(hooks, /syncKatelyaHomeState\(isHomePage:\s*boolean\)/);
	assert.match(hooks, /katelya-home-page/);
	assert.match(hooks, /is-home-active/);
	assert.match(theme, /--katelya-hero-height:/);
	assert.match(theme, /\.katelya-main-shell\.is-home-layout/);
});

test("full page uses painterly canvas and contains horizontal overflow", async () => {
	const layout = await read("src/layouts/Layout.astro");
	const theme = await read("src/styles/katelya-impressionist.css");
	const artwork = await read("public/assets/art/katelya-brush-field.svg");

	assert.match(layout, /id="katelya-page-canvas"/);
	assert.match(theme, /katelya-brush-field\.svg/);
	assert.match(theme, /overflow-x:\s*clip/);
	assert.match(artwork, /feTurbulence/);
	assert.match(artwork, /stroke-linecap="round"/);
});

test("desktop navigation is centered without hover-driven disappearance", async () => {
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const navConfig = await read("src/config/navBarConfig.ts");
	const theme = await read("src/styles/katelya-impressionist.css");

	assert.match(navbar, /katelya-navbar-shell/);
	assert.match(navbar, /katelya-navbar-brand/);
	assert.match(navbar, /katelya-navbar-links/);
	assert.match(navbar, /katelya-navbar-actions/);
	assert.doesNotMatch(navbar, /const hideLinks/);
	assert.match(navConfig, /name:\s*"项目"/);
	assert.match(navConfig, /name:\s*"时间线"/);
	assert.match(theme, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
});

test("display settings panel closes invisibly inside the viewport", async () => {
	const config = await read("src/config/siteConfig.ts");
	const panel = await read("src/components/features/settings/SettingsPanel.svelte");
	const animation = await read("src/styles/panel-animations.css");

	assert.match(config, /themeColor:\s*\{[\s\S]*?fixed:\s*true/);
	assert.match(panel, /katelya-settings-panel/);
	assert.match(panel, /max-h-\[calc\(100dvh-6\.5rem\)\]/);
	assert.match(panel, /max-w-\[calc\(100vw-2rem\)\]/);
	assert.match(animation, /\.float-panel-closed[\s\S]*opacity:\s*0/);
	assert.match(animation, /\.float-panel-closed[\s\S]*visibility:\s*hidden/);
	assert.doesNotMatch(animation, /scaleX\(0\.6\)/);
});
