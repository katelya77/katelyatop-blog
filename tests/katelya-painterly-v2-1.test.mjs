import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const backdrop = read("src/styles/impasto-backdrop.css");
const loader = read("src/components/layout/ImpastoBackdrop.astro");
const mainLayout = read("src/layouts/MainGridLayout.astro");
const fullscreenWallpaper = read("src/components/misc/FullscreenWallpaper.astro");
const renderer = read("src/scripts/impasto-renderer.ts");
const responsiveHero = read("src/styles/katelya-responsive-hero.css");

test("cold boot uses the painterly SVG poster instead of a gradient-only placeholder", () => {
	assert.match(backdrop, /--impasto-boot-poster:\s*url\("\/assets\/impasto\/impasto-day\.svg"\)/);
	assert.match(backdrop, /--impasto-boot-poster:\s*url\("\/assets\/impasto\/impasto-night\.svg"\)/);
	assert.match(backdrop, /\.impasto-static-fallback[\s\S]*background-image:[\s\S]*var\(--impasto-boot-poster\)/);
});

test("canvas readiness cross-fades instead of hard-cutting the poster", () => {
	assert.doesNotMatch(backdrop, /html\.impasto-ready \[data-impasto-canvas\][\s\S]{0,120}transition:\s*none/);
	assert.doesNotMatch(backdrop, /html\.impasto-ready \.impasto-static-fallback[\s\S]{0,160}transition:\s*none/);
	assert.match(backdrop, /opacity 1[4-9]0ms|opacity 2[0-2]0ms/);
});

test("art theme restores painterly waves rather than hard-hiding header waves", () => {
	assert.doesNotMatch(backdrop, /html\.katelya-art-theme #header-waves\s*\{\s*display:\s*none/);
	assert.match(backdrop, /html\.katelya-art-theme #header-waves[\s\S]*display:\s*block/);
});

test("renderer is prioritized before hero-depth", () => {
	assert.doesNotMatch(loader, /Promise\.all\(\[/);
	assert.match(loader, /import\([\s\S]*"\.\.\/\.\.\/scripts\/impasto-renderer"[\s\S]*\)/);
	assert.match(loader, /requestIdleCallback|setTimeout/);
});

test("startup quality favours first-frame speed", () => {
	assert.match(renderer, /level:\s*touch \? "low" : "medium"/);
	assert.match(renderer, /if \(level === "medium"\) return 0\.[0-9]+;/);
	assert.match(renderer, /const READING_IDLE_FPS = [4-8];/);
	assert.match(renderer, /IntersectionObserver/);
});

test("legacy banner imagery cannot compete with Painterly first paint", () => {
	assert.match(mainLayout, /const bannerImages = \{ desktop: \[\] as string\[\], mobile: \[\] as string\[\] \}/);
	assert.doesNotMatch(mainLayout, /await getBannerImages/);
	assert.doesNotMatch(fullscreenWallpaper, /loading="eager"/);
	assert.doesNotMatch(fullscreenWallpaper, /fetchpriority="high"/);
	assert.match(fullscreenWallpaper, /loading="lazy"/);
	assert.match(fullscreenWallpaper, /fetchpriority="low"/);
});

test("banner and fullscreen keep distinct Hero geometry", () => {
	assert.match(responsiveHero, /--katelya-banner-hero-height:/);
	assert.match(responsiveHero, /body\.enable-banner:not\(\.fullscreen-banner\)[\s\S]*--katelya-active-hero-height:\s*var\(--katelya-banner-hero-height\)/);
	assert.match(responsiveHero, /body\.fullscreen-banner \.katelya-hero-stage[\s\S]*--katelya-active-hero-height:\s*var\(--katelya-fullscreen-hero-height\)/);
});
