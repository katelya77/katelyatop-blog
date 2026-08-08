import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("desktop article TOC uses an adaptive reading rail", async () => {
	const grid = await read("src/layouts/MainGridLayout.astro");
	const sidebarToc = await read("src/components/features/toc/SidebarTOC.astro");
	const desktopRail = await read(
		"src/components/features/toc/DesktopTOCRail.astro",
	);

	assert.match(grid, /DesktopTOCRail/);
	assert.match(grid, /<DesktopTOCRail headings=\{headings\}/);

	assert.match(sidebarToc, /sidebar-toc-item/);
	assert.match(sidebarToc, /sidebar-toc-marker/);
	assert.match(sidebarToc, /sidebar-toc-label/);
	assert.match(sidebarToc, /data-depth=/);

	assert.match(desktopRail, /desktop-toc-rail/);
	assert.match(desktopRail, /focus-within/);
	assert.match(desktopRail, /@media \(min-width: 1880px\)/);
	assert.match(desktopRail, /-webkit-line-clamp:\s*2/);
	assert.match(desktopRail, /prefers-reduced-motion:\s*reduce/);
});
