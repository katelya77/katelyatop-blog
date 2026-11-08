import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("GitHub heatmap consumes the official GraphQL snapshot, not Public Events", async () => {
	const page = await read("src/pages/github.astro");
	assert.match(page, /import contributionSnapshot from "..\/data\/github-contributions.json"/);
	assert.match(page, /contributionSnapshot\.source === "github-graphql-contributionsCollection"/);
	assert.match(page, /activityPeriods=\{activityPeriods\}/);
	assert.doesNotMatch(page, /const eventCounts = new Map/);
});

test("GitHub annual heatmap exposes years and source-safe contribution numbers", async () => {
	const showcase = await read("src/components/features/github-showcase/GitHubWorldShowcase.svelte");
	assert.match(showcase, /GitHub 贡献日历/);
	assert.match(showcase, /selectedPeriod\.totalContributions/);
	assert.match(showcase, /selectPeriod\(period\.id\)/);
	assert.match(showcase, /data-level=\{day\.level\}/);
	assert.match(showcase, /grid-template-columns: repeat\(var\(--activity-week-count\), minmax\(0, 1fr\)\)/);
	assert.match(showcase, /\.gh-activity-cell \{[\s\S]*?aspect-ratio: 1;/);
	assert.match(showcase, /aria-pressed=\{selectedDay\?\.date === day\.date\}/);
	assert.match(showcase, /data-level="unknown"/);
	assert.match(showcase, /数据口径：GitHub GraphQL/);
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
