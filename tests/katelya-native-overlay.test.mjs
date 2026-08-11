import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("search uses the browser top layer instead of DOM portal reparenting", async () => {
	const search = await read(
		"src/components/organisms/navigation/Search.svelte",
	);
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const panels = await read("src/styles/panel-animations.css");

	assert.match(search, /popover="auto"/);
	assert.match(search, /showPopover\(\)/);
	assert.match(search, /hidePopover\(\)/);
	assert.match(panels, /\.katelya-search-desktop-panel:not\(:popover-open\)/);
	assert.match(panels, /display:\s*none\s*!important/);
	assert.doesNotMatch(navbar, /getSearchPanel/);
	assert.doesNotMatch(navbar, /append\(panel\)[\s\S]*search-panel/);
});

test("page geometry ships once from the root layout, not from the search island", async () => {
	const search = await read(
		"src/components/organisms/navigation/Search.svelte",
	);
	const grid = await read("src/layouts/MainGridLayout.astro");

	assert.doesNotMatch(search, /katelya-runtime-repair/);
	assert.match(grid, /impasto-geometry\.css/);
	await assert.rejects(read("src/styles/katelya-runtime-repair.css"));
});

test("hero stage holds height in flow and fullscreen hands off without negative geometry", async () => {
	const geometry = await read("src/styles/impasto-geometry.css");

	// The hero stage sits in normal document flow and owns the hero height.
	assert.match(
		geometry,
		/\.katelya-hero-stage\s*\{[\s\S]*?height:\s*var\(--katelya-active-hero-height\)/,
	);
	assert.match(
		geometry,
		/body\.fullscreen-banner \.katelya-hero-stage\s*\{[\s\S]*?--katelya-active-hero-height:\s*100svh/,
	);

	// The painterly edge owns the transition; content remains in normal flow.
	assert.match(geometry, /--katelya-content-handoff-space:/);
	assert.match(
		geometry,
		/body\.enable-banner #main-grid\s*\{[\s\S]*?padding-top:\s*var\(--katelya-content-handoff-space\)/,
	);
	assert.doesNotMatch(geometry, /body\.fullscreen-banner \.katelya-main-shell[\s\S]*margin-top:\s*-/);
	assert.doesNotMatch(geometry, /body\.fullscreen-banner #main-grid::before/);

	// The 100svh padding placeholder is gone for good.
	assert.doesNotMatch(
		geometry,
		/padding-top:\s*var\(--katelya-active-hero-height\)/,
	);
	assert.doesNotMatch(geometry, /padding-top:\s*100svh/);
});

test("desktop tools retain a visible safety gap from the navigation links", async () => {
	const geometry = await read("src/styles/impasto-geometry.css");
	assert.match(geometry, /\.katelya-navbar-links[\s\S]*padding-inline-end:/);
	assert.match(geometry, /\.katelya-navbar-tools[\s\S]*column-gap:/);
});
