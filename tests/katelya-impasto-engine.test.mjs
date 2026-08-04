import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("layout mounts exactly one accessible impasto backdrop", async () => {
	const layout = await read("src/layouts/Layout.astro");
	const backdrop = await read("src/components/layout/ImpastoBackdrop.astro");

	assert.equal((layout.match(/<ImpastoBackdrop\s*\/>/g) || []).length, 1);
	assert.match(backdrop, /class="impasto-backdrop"/);
	assert.match(backdrop, /aria-hidden="true"/);
	assert.match(backdrop, /data-impasto-canvas/);
	assert.match(backdrop, /impasto-static-fallback/);
});

test("renderer is lightweight, lifecycle-aware, and WebGL2-first", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");
	const packageJson = await read("package.json");

	assert.match(renderer, /getContext\("webgl2"/);
	assert.match(renderer, /document\.visibilityState/);
	assert.match(renderer, /prefers-reduced-motion/);
	assert.match(renderer, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
	assert.match(renderer, /connection\?\.saveData/);
	assert.match(renderer, /cancelAnimationFrame/);
	assert.match(renderer, /swup:page:view/);
	assert.match(renderer, /1000 \/ 45/);
	assert.match(renderer, /1000 \/ 18/);
	assert.doesNotMatch(packageJson, /["']three["']/);
});

test("quantized structure field and generated fallbacks stay compact", async () => {
	const field = JSON.parse(await read("src/data/impasto-field.json"));
	const metadata = JSON.parse(
		await read("public/assets/impasto/impasto-metadata.json"),
	);
	const day = await read("public/assets/impasto/impasto-day.svg");
	const night = await read("public/assets/impasto/impasto-night.svg");

	assert.equal(field.generator, "katelya-structure-tensor-v1");
	assert.equal(field.sourcePathCount, 172000);
	assert.equal(field.width, 32);
	assert.equal(field.height, 18);
	assert.equal(Buffer.from(field.data, "base64").length, 32 * 18 * 4);
	assert.equal(metadata.generator, "katelya-impasto-svg-v1");
	assert.equal(metadata.sourcePathCount, 172000);
	assert.ok(metadata.dayBytes + metadata.nightBytes < 500_000);
	assert.match(day, /feDiffuseLighting/);
	assert.match(day, /feSpecularLighting/);
	assert.match(night, /stroke-linecap="round"/);

	const total =
		(await stat(new URL("../public/assets/impasto/impasto-day.svg", import.meta.url))).size +
		(await stat(new URL("../public/assets/impasto/impasto-night.svg", import.meta.url))).size;
	assert.ok(total < 500_000, `generated fallbacks are ${total} bytes`);
});

test("navigation and page content use independent stable geometry", async () => {
	const grid = await read("src/layouts/MainGridLayout.astro");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const geometry = await read("src/styles/impasto-geometry.css");
	const backdrop = await read("src/styles/impasto-backdrop.css");

	assert.doesNotMatch(grid, /katelya-main-shell absolute/);
	assert.doesNotMatch(grid, /style=\{`top:/);
	assert.match(grid, /id="overlay-root"/);
	assert.match(navbar, /data-katelya-overlay-trigger/);
	assert.match(navbar, /overlayRoot\.append\(panel\)/);
	assert.match(geometry, /\.katelya-header-stage[\s\S]*position:\s*fixed/);
	assert.match(geometry, /\.katelya-main-shell[\s\S]*position:\s*relative\s*!important/);
	assert.doesNotMatch(backdrop, /background-attachment:\s*fixed/);
});

test("renderer and CSS expose static mobile and accessible fallbacks", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");
	const backdrop = await read("src/styles/impasto-backdrop.css");
	const geometry = await read("src/styles/impasto-geometry.css");

	assert.match(renderer, /impasto-static/);
	assert.match(renderer, /pointer: coarse/);
	assert.match(backdrop, /impasto-day\.svg/);
	assert.match(backdrop, /impasto-night\.svg/);
	assert.match(backdrop, /@media \(prefers-reduced-motion:\s*reduce\)/);
	assert.match(backdrop, /@media \(forced-colors:\s*active\)/);
	assert.match(geometry, /@media print/);
});
