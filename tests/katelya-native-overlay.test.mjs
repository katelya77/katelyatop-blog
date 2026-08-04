import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("search uses the browser top layer instead of DOM portal reparenting", async () => {
	const search = await read("src/components/organisms/navigation/Search.svelte");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const runtime = await read("src/styles/katelya-runtime-repair.css");

	assert.match(search, /popover="auto"/);
	assert.match(search, /showPopover\(\)/);
	assert.match(search, /hidePopover\(\)/);
	assert.match(runtime, /\.katelya-search-desktop-panel:not\(:popover-open\)/);
	assert.match(runtime, /display:\s*none\s*!important/);
	assert.doesNotMatch(navbar, /getSearchPanel/);
	assert.doesNotMatch(navbar, /append\(panel\)[\s\S]*search-panel/);
});

test("fullscreen content overlaps the closing edge of the hero instead of leaving a dead band", async () => {
	const runtime = await read("src/styles/katelya-runtime-repair.css");

	assert.match(runtime, /--katelya-fullscreen-content-overlap:/);
	assert.match(
		runtime,
		/body\.fullscreen-banner \.katelya-main-shell[\s\S]*padding-top:\s*calc\(var\(--katelya-active-hero-height\)\s*-\s*var\(--katelya-fullscreen-content-overlap\)\)/,
	);
	assert.match(runtime, /body\.fullscreen-banner #main-grid[\s\S]*position:\s*relative/);
});

test("desktop tools retain a visible safety gap from the navigation links", async () => {
	const runtime = await read("src/styles/katelya-runtime-repair.css");
	assert.match(runtime, /\.katelya-navbar-links[\s\S]*padding-inline-end:/);
	assert.match(runtime, /\.katelya-navbar-tools[\s\S]*column-gap:/);
});
