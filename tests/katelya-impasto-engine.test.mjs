import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const assetPaths = [
	"public/assets/impasto/impasto-day-albedo.webp",
	"public/assets/impasto/impasto-night-albedo.webp",
	"public/assets/impasto/impasto-flow.png",
	"public/assets/impasto/impasto-normal.png",
	"public/assets/impasto/impasto-roughness.webp",
	"public/assets/impasto/impasto-day-fallback.webp",
	"public/assets/impasto/impasto-night-fallback.webp",
];

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
	assert.match(renderer, /navigator\.connection/);
	assert.match(renderer, /cancelAnimationFrame/);
	assert.match(renderer, /swup:page:view/);
	assert.doesNotMatch(packageJson, /["']three["']/);
});

test("generated impasto textures stay within the documented budget", async () => {
	const metadata = JSON.parse(
		await read("public/assets/impasto/impasto-metadata.json"),
	);
	assert.equal(metadata.generator, "katelya-impasto-v1");
	assert.equal(metadata.sourcePathCount, 172000);
	assert.ok(metadata.width <= 1536);
	assert.ok(metadata.height <= 864);

	let total = 0;
	for (const path of assetPaths) {
		total += (await stat(new URL(`../${path}`, import.meta.url))).size;
	}
	assert.ok(total <= 2_500_000, `impasto assets are ${total} bytes`);
});

test("navigation and page content use independent stable geometry", async () => {
	const grid = await read("src/layouts/MainGridLayout.astro");
	const navbar = await read("src/components/organisms/navigation/Navbar.astro");
	const theme = await read("src/styles/katelya-van-gogh-gallery.css");

	assert.doesNotMatch(grid, /katelya-main-shell absolute/);
	assert.doesNotMatch(grid, /style=\{`top:/);
	assert.match(grid, /id="overlay-root"/);
	assert.match(navbar, /data-katelya-overlay-trigger/);
	assert.match(theme, /\.katelya-header-stage[\s\S]*position:\s*fixed/);
	assert.doesNotMatch(theme, /background-attachment:\s*fixed/);
});

test("renderer and CSS expose static, mobile, and reduced-motion fallbacks", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");
	const theme = await read("src/styles/katelya-van-gogh-gallery.css");

	assert.match(renderer, /impasto-static/);
	assert.match(renderer, /pointer:\s*coarse/);
	assert.match(theme, /impasto-day-fallback\.webp/);
	assert.match(theme, /impasto-night-fallback\.webp/);
	assert.match(theme, /@media \(prefers-reduced-motion:\s*reduce\)/);
	assert.match(theme, /@media \(forced-colors:\s*active\)/);
}
);
