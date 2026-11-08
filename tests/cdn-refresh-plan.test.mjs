import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	buildRefreshPlan,
	postPathFromSource,
} from "../scripts/cdn-refresh/refresh-plan.mjs";

describe("CDN refresh plan", () => {
	it("maps a custom permalink post and refreshes aggregate surfaces", async () => {
		const plan = await buildRefreshPlan({
			changes: [{ status: "M", path: "src/content/posts/demo.md" }],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "---\npermalink: demo/path\n---\nbody",
		});
		assert.deepEqual(plan.urls, [
			"https://blog.katelya.top/",
			"https://blog.katelya.top/archive/",
			"https://blog.katelya.top/atom.xml",
			"https://blog.katelya.top/demo/path/",
			"https://blog.katelya.top/rss.xml",
		]);
		assert.deepEqual(plan.paths, ["https://blog.katelya.top/pagefind/"]);
	});

	it("maps a default post path from its content id", () => {
		assert.equal(
			postPathFromSource({
				filePath: "src/content/posts/nested/example.md",
				content: "---\ntitle: Example\n---",
			}),
			"/posts/nested/example/",
		);
	});

	it("uses base content for deleted posts", async () => {
		const calls = [];
		const plan = await buildRefreshPlan({
			changes: [{ status: "D", path: "src/content/posts/old.md" }],
			siteUrl: "https://blog.katelya.top/",
			readFileAtRef: async (filePath, ref) => {
				calls.push([filePath, ref]);
				return "---\npermalink: retired/post\n---\n";
			},
		});
		assert.ok(plan.urls.includes("https://blog.katelya.top/retired/post/"));
		assert.deepEqual(calls, [["src/content/posts/old.md", "base"]]);
	});

	it("maps changed public files to stable public URLs", async () => {
		const plan = await buildRefreshPlan({
			changes: [{ status: "M", path: "public/robots.txt" }],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "",
		});
		assert.deepEqual(plan.urls, ["https://blog.katelya.top/robots.txt"]);
		assert.deepEqual(plan.paths, []);
	});

	it("refreshes aggregate surfaces and Pagefind for public site code changes", async () => {
		const plan = await buildRefreshPlan({
			changes: [{ status: "M", path: "src/components/Header.astro" }],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "",
		});
		assert.deepEqual(plan.urls, [
			"https://blog.katelya.top/",
			"https://blog.katelya.top/archive/",
			"https://blog.katelya.top/atom.xml",
			"https://blog.katelya.top/rss.xml",
		]);
		assert.deepEqual(plan.paths, ["https://blog.katelya.top/pagefind/"]);
	});

	it("refreshes the exact route for a new static Astro page", async () => {
		const plan = await buildRefreshPlan({
			changes: [{ status: "A", path: "src/pages/github.astro" }],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "",
		});
		assert.ok(plan.urls.includes("https://blog.katelya.top/github/"));
		assert.ok(plan.urls.includes("https://blog.katelya.top/"));
		assert.ok(plan.paths.includes("https://blog.katelya.top/pagefind/"));
		assert.ok(plan.reasons.includes("page:src/pages/github.astro"));
	});

	it("does not invent a concrete URL for dynamic Astro routes", async () => {
		const plan = await buildRefreshPlan({
			changes: [{ status: "M", path: "src/pages/posts/[slug].astro" }],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "",
		});
		assert.equal(plan.urls.includes("https://blog.katelya.top/posts/slug/"), false);
		assert.ok(plan.urls.includes("https://blog.katelya.top/"));
	});

	it("refreshes GitHub showcase only when official contribution snapshot changes", async () => {
		const plan = await buildRefreshPlan({
			changes: [{ status: "M", path: "src/data/github-contributions.json" }],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "",
		});
		assert.deepEqual(plan.urls, ["https://blog.katelya.top/github/"]);
		assert.deepEqual(plan.paths, []);
	});

	it("does nothing for docs and tests only changes", async () => {
		const plan = await buildRefreshPlan({
			changes: [
				{ status: "M", path: "docs/readme.md" },
				{ status: "M", path: "tests/example.test.mjs" },
			],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "",
		});
		assert.deepEqual(plan, { urls: [], paths: [], reasons: [] });
	});

	it("never emits _astro refresh targets", async () => {
		const plan = await buildRefreshPlan({
			changes: [{ status: "M", path: "public/_astro/forbidden.js" }],
			siteUrl: "https://blog.katelya.top",
			readFileAtRef: async () => "",
		});
		assert.equal(plan.urls.some((url) => url.includes("/_astro/")), false);
		assert.equal(plan.paths.some((url) => url.includes("/_astro/")), false);
	});
});
