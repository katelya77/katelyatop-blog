import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { parseGitDiff } from "../scripts/cdn-refresh/run.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
	readFileSync(path.join(root, relativePath), "utf8");

describe("CDN refresh workflow contract", () => {
	it("parses modified, deleted, and renamed git diff records", () => {
		assert.deepEqual(
			parseGitDiff(
				"M\tsrc/content/posts/a.md\nD\tpublic/old.txt\nR100\tsrc/content/posts/old.md\tsrc/content/posts/new.md\n",
			),
			[
				{ status: "M", path: "src/content/posts/a.md" },
				{ status: "D", path: "public/old.txt" },
				{
					status: "R",
					oldPath: "src/content/posts/old.md",
					path: "src/content/posts/new.md",
				},
			],
		);
	});

	it("triggers only for master pushes or manual dispatch and injects secrets by name", () => {
		const workflow = read(".github/workflows/doge-cdn-refresh.yml");
		assert.match(workflow, /push:\s*\n\s*branches:\s*\[\s*master\s*\]/);
		assert.match(workflow, /workflow_dispatch:/);
		assert.match(workflow, /force_home_refresh:/);
		assert.match(workflow, /fetch-depth:\s*2/);
		assert.match(
			workflow,
			/CF_API_TOKEN:\s*\$\{\{\s*secrets\.CF_API_TOKEN\s*\}\}/,
		);
		assert.match(
			workflow,
			/DOGE_ACCESS_KEY:\s*\$\{\{\s*secrets\.DOGE_ACCESS_KEY\s*\}\}/,
		);
		assert.match(
			workflow,
			/DOGE_SECRET_KEY:\s*\$\{\{\s*secrets\.DOGE_SECRET_KEY\s*\}\}/,
		);
		assert.match(
			workflow,
			/CF_ACCOUNT_ID:\s*\$\{\{\s*vars\.CF_ACCOUNT_ID\s*\}\}/,
		);
		assert.match(workflow, /node scripts\/cdn-refresh\/run\.mjs/);
		assert.doesNotMatch(workflow, /cfut_[A-Za-z0-9_-]+/);
	});

	it("orchestrates through the planner, Pages waiter, and Doge client without _astro refresh logic", () => {
		const source = read("scripts/cdn-refresh/run.mjs");
		assert.match(source, /buildRefreshPlan/);
		assert.match(source, /waitForPagesDeployment/);
		assert.match(source, /submitDogeRefresh/);
		assert.doesNotMatch(source, /submitDogeRefresh\([^)]*_astro/s);
	});
});
