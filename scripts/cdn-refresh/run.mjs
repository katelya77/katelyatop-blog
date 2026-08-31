import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { waitForPagesDeployment } from "./cloudflare-pages.mjs";
import { submitDogeRefresh } from "./doge-client.mjs";
import { buildRefreshPlan } from "./refresh-plan.mjs";

export function parseGitDiff(output) {
	return String(output ?? "")
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const parts = line.split("\t");
			const rawStatus = parts[0] ?? "";
			const status = rawStatus[0] ?? "";
			if (status === "R" || status === "C") {
				return { status, oldPath: parts[1], path: parts[2] };
			}
			return { status, path: parts[1] };
		})
		.filter((change) => change.status && change.path);
}

function runGit(args) {
	return execFileSync("git", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function readAtRef(filePath, ref, baseSha) {
	if (ref === "base") {
		try {
			return runGit(["show", `${baseSha}:${filePath}`]);
		} catch {
			return "";
		}
	}
	if (!existsSync(filePath)) return "";
	return readFileSync(filePath, "utf8");
}

function requireEnv(env, name) {
	const value = env[name];
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function addForcedHomeRefresh(plan, siteUrl, enabled) {
	if (!enabled) return plan;
	const home = `${String(siteUrl).replace(/\/+$/, "")}/`;
	return {
		...plan,
		urls: [...new Set([...plan.urls, home])].sort(),
		reasons: [...new Set([...plan.reasons, "manual:force-home-refresh"])].sort(),
	};
}

export async function main(env = process.env) {
	const baseSha = requireEnv(env, "BASE_SHA");
	const headSha = env.HEAD_SHA || requireEnv(env, "GITHUB_SHA");
	const siteUrl = env.SITE_URL || "https://blog.katelya.top";

	const diff = runGit([
		"-c",
		"core.quotePath=false",
		"diff",
		"--name-status",
		"-M",
		baseSha,
		headSha,
	]);
	const changes = parseGitDiff(diff);
	let plan = await buildRefreshPlan({
		changes,
		siteUrl,
		readFileAtRef: async (filePath, ref) => readAtRef(filePath, ref, baseSha),
	});
	plan = addForcedHomeRefresh(
		plan,
		siteUrl,
		env.FORCE_HOME_REFRESH === "true",
	);

	console.log(
		`CDN refresh plan: ${plan.urls.length} URL target(s), ${plan.paths.length} path target(s).`,
	);
	for (const url of plan.urls) console.log(`  URL  ${url}`);
	for (const url of plan.paths) console.log(`  PATH ${url}`);

	if (plan.urls.length === 0 && plan.paths.length === 0) {
		console.log(
			"No public CDN refresh targets for this change; exiting successfully.",
		);
		return { skipped: true, plan };
	}

	const accountId = requireEnv(env, "CF_ACCOUNT_ID");
	const projectName = env.CF_PAGES_PROJECT || "katelyatop-blog";
	const apiToken = requireEnv(env, "CF_API_TOKEN");
	const dogeAccessKey = requireEnv(env, "DOGE_ACCESS_KEY");
	const dogeSecretKey = requireEnv(env, "DOGE_SECRET_KEY");

	const deployment = await waitForPagesDeployment({
		accountId,
		projectName,
		commitSha: headSha,
		apiToken,
	});
	console.log(
		`Cloudflare Pages deployment confirmed: ${deployment.id ?? deployment.short_id ?? "matched commit"}.`,
	);

	const tasks = [];
	if (plan.urls.length > 0) {
		const result = await submitDogeRefresh({
			rtype: "url",
			urls: plan.urls,
			siteUrl,
			accessKey: dogeAccessKey,
			secretKey: dogeSecretKey,
		});
		tasks.push({ type: "url", taskId: result.taskId });
	}
	if (plan.paths.length > 0) {
		const result = await submitDogeRefresh({
			rtype: "path",
			urls: plan.paths,
				siteUrl,
			accessKey: dogeAccessKey,
			secretKey: dogeSecretKey,
		});
		tasks.push({ type: "path", taskId: result.taskId });
	}

	for (const task of tasks) {
		console.log(`DogeCloud ${task.type} refresh task created: ${task.taskId}`);
	}
	return { skipped: false, plan, tasks, deployment };
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
