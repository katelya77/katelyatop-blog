import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();
const read = (relativePath) =>
	readFileSync(path.join(root, relativePath), "utf8");

const expectedPosts = [
	["index.md", "fosu/2026-freshman-guide", 0],
	["registration.md", "fosu/2026-freshman-guide/registration", 1],
	["military-training.md", "fosu/2026-freshman-guide/military-training", 2],
	["study.md", "fosu/2026-freshman-guide/study", 3],
	["campus-growth.md", "fosu/2026-freshman-guide/campus-growth", 4],
	["digital-campus.md", "fosu/2026-freshman-guide/digital-campus", 5],
	["campus-life.md", "fosu/2026-freshman-guide/campus-life", 6],
	["food.md", "fosu/2026-freshman-guide/food", 7],
	["safety-health.md", "fosu/2026-freshman-guide/safety-health", 8],
];

const guideDir = "src/content/posts/fosu-2026-freshman-guide";
const seriesName = "2026级佛山大学新生指南";

describe("FOSU freshman guide series contract", () => {
	it("defines optional series metadata in the Astro content schema", () => {
		const schema = read("src/content.config.ts");
		assert.match(schema, /series:\s*z\.string\(\)\.optional\(\)/);
		assert.match(
			schema,
			/seriesOrder:\s*z\.number\(\)\.int\(\)\.nonnegative\(\)\.optional\(\)/,
		);
		assert.match(schema, /seriesHome:\s*z\.string\(\)\.optional\(\)/);
	});

	it("provides one reusable series navigation component in both post routes", () => {
		const componentPath = path.join(
			root,
			"src/components/features/posts/SeriesNavigation.astro",
		);
		assert.equal(
			existsSync(componentPath),
			true,
			"SeriesNavigation.astro should exist",
		);
		const component = read("src/components/features/posts/SeriesNavigation.astro");
		assert.match(component, /data-series-navigation/);
		assert.match(component, /--primary|bg-\(--primary\)|text-\(--primary\)/);
		assert.match(component, /md:flex-row/);

		const defaultRoute = read("src/pages/posts/[...slug].astro");
		const permalinkRoute = read("src/pages/[...permalink].astro");
		for (const source of [defaultRoute, permalinkRoute]) {
			assert.match(source, /SeriesNavigation/);
			assert.match(source, /seriesOrder/);
		}
	});

	it("adds the guide under the existing More navigation instead of a new top-level link", () => {
		const nav = read("src/config/navBarConfig.ts");
		assert.match(nav, /name:\s*"更多"/);
		assert.match(nav, /name:\s*"新生指南"/);
		assert.match(nav, /url:\s*"\/fosu\/2026-freshman-guide\/"/);
	});

	it("publishes exactly the approved 1+8 article set with stable permalinks", () => {
		for (const [fileName, permalink, order] of expectedPosts) {
			const relativePath = `${guideDir}/${fileName}`;
			assert.equal(existsSync(path.join(root, relativePath)), true, `${fileName} missing`);
			const post = read(relativePath);
			assert.match(post, new RegExp(`series:\\s*${seriesName}`));
			assert.match(post, new RegExp(`seriesOrder:\\s*${order}(?:\\n|$)`));
			assert.match(post, /seriesHome:\s*fosu\/2026-freshman-guide/);
			assert.match(post, new RegExp(`permalink:\\s*${permalink.replaceAll("/", "\\/")}`));
			assert.match(post, /category:\s*佛大新生指南/);
			assert.match(post, /comment:\s*true/);
		}
	});

	it("uses standalone wiki links on the overview so Mizuki renders topic cards", () => {
		const overview = read(`${guideDir}/index.md`);
		for (const [fileName] of expectedPosts.slice(1)) {
			const slug = fileName.replace(/\.md$/, "");
			assert.match(
				overview,
				new RegExp(`^\\[\\[fosu-2026-freshman-guide/${slug}\\]\\]$`, "m"),
			);
		}
	});
});
