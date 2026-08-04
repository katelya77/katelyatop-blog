import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy banner title cannot reappear over the artistic hero", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	assert.match(hero, /\.banner-text-overlay\s*\{[\s\S]*?display:\s*none\s*!important/);
	assert.match(hero, /legacyTitle\.classList\.add\("hidden"\)/);
});

test("hero follows route state and uses one shared homepage geometry", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");

	assert.match(hero, /active\??:\s*boolean/);
	assert.match(hero, /is-home-active/);
	assert.match(hero, /function syncKatelyaHomeState\(isHomePage\)/);
	assert.match(hero, /katelya-home-page/);
	assert.match(hero, /katelya-main-shell/);
	assert.match(hero, /--katelya-hero-height:/);
	assert.match(hero, /\.katelya-main-shell\.is-home-layout/);
	assert.match(hero, /#main-grid\s*\{[\s\S]*?transform:\s*none\s*!important/);
});

test("full page uses painterly brushwork and clips horizontal overflow", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const artwork = await read("public/assets/art/katelya-brush-field.svg");

	assert.match(hero, /katelya-brush-field\.svg/);
	assert.match(hero, /overflow-x:\s*clip/);
	assert.match(hero, /background-attachment:\s*fixed/);
	assert.match(artwork, /feTurbulence/);
	assert.match(artwork, /stroke-linecap="round"/);
});

test("desktop navigation is centered and keeps a stable primary order", async () => {
	const navConfig = await read("src/config/navBarConfig.ts");
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");

	assert.match(navConfig, /LinkPreset\.Home[\s\S]*LinkPreset\.Archive/);
	assert.match(navConfig, /name:\s*"项目"/);
	assert.match(navConfig, /name:\s*"时间线"/);
	assert.match(navConfig, /name:\s*"关于"/);
	assert.match(hero, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
	assert.match(hero, /#navbar-links-container[\s\S]*?opacity:\s*1\s*!important/);
	assert.match(hero, /#nav-menu-switch[\s\S]*?display:\s*inline-flex\s*!important/);
});

test("display settings close invisibly and stay inside the viewport", async () => {
	const config = await read("src/config/siteConfig.ts");
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const animation = await read("src/styles/panel-animations.css");

	assert.match(config, /themeColor:\s*\{[\s\S]*?fixed:\s*true/);
	assert.match(config, /pageScaling:\s*\{[\s\S]*?enable:\s*false/);
	assert.match(hero, /#display-setting[\s\S]*?position:\s*fixed\s*!important/);
	assert.match(hero, /max-width:\s*calc\(100vw\s*-\s*2rem\)\s*!important/);
	assert.match(hero, /max-height:\s*calc\(100dvh\s*-\s*6\.5rem\)\s*!important/);
	assert.match(animation, /\.float-panel-closed[\s\S]*opacity:\s*0/);
	assert.match(animation, /\.float-panel-closed[\s\S]*visibility:\s*hidden/);
	assert.doesNotMatch(animation, /scaleX\(0\.6\)/);
});
