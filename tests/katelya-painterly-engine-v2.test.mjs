import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V2 separates underpainting, directional strokes, and bristle relief", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");

	assert.match(renderer, /float broadUnderpainting\(/);
	assert.match(renderer, /float midStrokeMask\(/);
	assert.match(renderer, /float microBristleRidge\(/);
	assert.match(renderer, /float readingCalm/);
	assert.match(renderer, /float peripheralEnergy/);
	assert.match(renderer, /float broadColour = mix\(0\.5, broad, 0\.22\)/);
	assert.doesNotMatch(
		renderer,
		/tensorDirection \* \(0\.56 \+ coherence \* 0\.24\)/,
	);
	assert.doesNotMatch(renderer, /broad \* 0\.18[\s\S]*secondary \* 0\.13/);
	assert.doesNotMatch(renderer, /vec2 broadFlow = vec2\(flowTime \*/);
});

test("V2 quality governor changes detail slowly with hysteresis", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");

	assert.match(renderer, /type QualityLevel = "high" \| "medium" \| "low"/);
	assert.match(renderer, /const QUALITY_SWITCH_COOLDOWN_MS/);
	assert.match(renderer, /const QUALITY_DOWNGRADE_THRESHOLD_MS/);
	assert.match(renderer, /const QUALITY_UPGRADE_THRESHOLD_MS/);
	assert.match(renderer, /function updateQualityGovernor\(/);
	assert.match(renderer, /data-impasto-quality/);
	assert.match(renderer, /uniform float uMicroDetail/);
});

test("Hero uses broken paint ribbons and one depth controller", async () => {
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");
	const depth = await read("src/scripts/hero-depth.ts");
	const depthCss = await read("src/styles/katelya-hero-depth.css");

	assert.equal(
		(hero.match(/katelya-aura-stroke katelya-aura-stroke--/g) || []).length,
		4,
	);
	assert.doesNotMatch(hero, /katelya-aura-ring/);
	assert.doesNotMatch(hero, /--orbit-rx|--orbit-ry/);
	assert.doesNotMatch(hero, /hero\.addEventListener\("pointermove"/);
	assert.match(hero, /transform:\s*translate\(-50%, -50%\)/);
	assert.match(depth, /--hero-pointer-x/);
	assert.match(depth, /--hero-pointer-y/);
	for (const token of [
		"--depth-background",
		"--depth-aura",
		"--depth-card-far",
		"--depth-title",
		"--depth-card-near",
	]) {
		assert.match(depthCss, new RegExp(token));
	}
});

test("Impasto backdrop owns art surfaces and the V2.1 Hero handoff", async () => {
	const gallery = await read("src/styles/katelya-van-gogh-gallery.css");
	const backdrop = await read("src/styles/impasto-backdrop.css");
	const performance = await read("src/styles/katelya-light-performance.css");
	const legacy = await read("src/styles/katelya-impressionist.css");

	assert.doesNotMatch(
		gallery,
		/html\.katelya-art-theme body\s*\{[^}]*katelya-van-gogh-day\.svg/s,
	);
	assert.doesNotMatch(
		gallery,
		/html\.katelya-art-theme\.dark body\s*\{[^}]*katelya-van-gogh-night\.svg/s,
	);
	assert.match(backdrop, /--impasto-boot-poster/);
	assert.match(backdrop, /\.impasto-static-fallback/);
	assert.match(backdrop, /\[data-impasto-canvas\]/);
	assert.match(backdrop, /\.impasto-backdrop::before/);
	assert.match(backdrop, /#header-waves\s*\{[\s\S]*display:\s*block/);
	assert.match(backdrop, /#banner-wrapper::before,[\s\S]*content:\s*none/);
	assert.doesNotMatch(performance, /\.katelya-hero-copy::before/);
	assert.doesNotMatch(
		legacy,
		/#banner-wrapper|katelya-aura-ring|backdrop-filter/,
	);
});

test("fallback V2 uses broken pigment marks instead of circular stars and a UI frame", async () => {
	const generator = await read("scripts/generate-impasto-fallbacks.mjs");
	const metadata = JSON.parse(
		await read("public/assets/impasto/impasto-metadata.json"),
	);

	assert.equal(metadata.generator, "katelya-impasto-svg-v2");
	assert.match(generator, /buildBrokenHalo/);
	assert.match(generator, /buildUnderpaintingBands/);
	assert.doesNotMatch(generator, /<circle/);
	assert.doesNotMatch(generator, /<rect x="18" y="18"/);
});

test("functional surfaces use quiet differentiated paper materials", async () => {
	const gallery = await read("src/styles/katelya-van-gogh-gallery.css");
	const hero = await read("src/components/layout/KatelyaOrbitHero.astro");

	assert.match(gallery, /--katelya-paper-warm:/);
	assert.match(gallery, /--katelya-paper-cool:/);
	assert.match(gallery, /\.katelya-post-card:nth-of-type\(even\)/);
	assert.match(gallery, /#post-container/);
	assert.match(gallery, /backdrop-filter:\s*blur\(10px\) saturate\(1\.04\)/);
	assert.doesNotMatch(gallery, /backdrop-filter:\s*blur\(14px\)/);
	assert.doesNotMatch(hero, /backdrop-filter:\s*blur\(12px\)/);
});