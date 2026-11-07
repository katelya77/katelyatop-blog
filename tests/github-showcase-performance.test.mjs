import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("public event coverage does not treat days beyond GitHub's 30-day limit as zero", async () => {
	const page = await read("src/pages/github.astro");
	assert.match(page, /ageLimit\.setUTCDate\(today\.getUTCDate\(\) - 29\)/);
	assert.match(page, /sampleCutoff = Math\.max\(ageLimit\.getTime\(\), oldestEventTime \?\? 0\)/);
	assert.match(page, /date\.getTime\(\) >= sampleCutoff/);
	assert.match(page, /count = known \? \(eventCounts\.get\(key\) \?\? 0\) : null/);
});

test("GitHub activity heatmap uses proportional cells with explicit unknown dates", async () => {
	const showcase = await read("src/components/features/github-showcase/GitHubWorldShowcase.svelte");
	assert.match(showcase, /grid-template-columns: repeat\(var\(--activity-week-count\), minmax\(0, 1fr\)\)/);
	assert.match(showcase, /\.gh-activity-cell \{[\s\S]*?aspect-ratio: 1;/);
	assert.match(showcase, /aria-pressed=\{selectedDay\?\.date === day\.date\}/);
	assert.match(showcase, /data-level="unknown"/);
	assert.match(showcase, /样本未覆盖/);
	assert.match(showcase, /仓库热度速览/);
	assert.match(showcase, /技术拼图/);
});

test("decorative WebGL runs at a low idle cadence and initializes after first layout paint", async () => {
	const renderer = await read("src/scripts/impasto-renderer.ts");
	const backdrop = await read("src/components/layout/ImpastoBackdrop.astro");
	assert.match(renderer, /const IDLE_FPS = 2/);
	assert.match(renderer, /const TOUCH_IDLE_FPS = 1/);
	assert.match(renderer, /const MAX_RENDER_PIXELS = 1_500_000/);
	assert.match(renderer, /const TOUCH_MAX_RENDER_PIXELS = 750_000/);
	assert.match(renderer, /return Math\.min\(pixelBudgetDpr, qualityDpr\)/);
	assert.match(renderer, /const POINTER_FPS = 10/);
	assert.match(backdrop, /requestIdleCallback\(startArtLayers/);
	assert.match(backdrop, /timeout: 1200/);
	assert.match(renderer, /document\.visibilityState/);
	assert.match(renderer, /prefers-reduced-motion/);
});
