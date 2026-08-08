import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	findDeploymentForCommit,
	waitForPagesDeployment,
} from "../scripts/cdn-refresh/cloudflare-pages.mjs";

const sha = "abc123";
const deployment = (commitHash, status = "success", environment = "production") => ({
	environment,
	deployment_trigger: { metadata: { commit_hash: commitHash } },
	latest_stage: { status },
	id: `${commitHash}-${status}`,
	url: `https://${commitHash}.example.pages.dev`,
});

function response(body, ok = true, status = 200) {
	return {
		ok,
		status,
		async json() {
			return body;
		},
	};
}

describe("Cloudflare Pages deployment waiter", () => {
	it("finds only the production deployment for the exact commit", () => {
		const wrongEnv = deployment(sha, "success", "preview");
		const wrongSha = deployment("other");
		const matching = deployment(sha);
		assert.equal(
			findDeploymentForCommit({ result: [wrongEnv, wrongSha, matching] }, sha),
			matching,
		);
	});

	it("polls until the matching deployment succeeds", async () => {
		const payloads = [
			{ success: true, result: [deployment(sha, "active")] },
			{ success: true, result: [deployment(sha, "success")] },
		];
		let calls = 0;
		const result = await waitForPagesDeployment({
			accountId: "acct",
			projectName: "project",
			commitSha: sha,
			apiToken: "token",
			fetchImpl: async () => response(payloads[calls++]),
			sleep: async () => {},
			timeoutMs: 1000,
			pollMs: 1,
		});
		assert.equal(result.latest_stage.status, "success");
		assert.equal(calls, 2);
	});

	it("fails closed when the matching deployment fails", async () => {
		await assert.rejects(
			waitForPagesDeployment({
				accountId: "acct",
				projectName: "project",
				commitSha: sha,
				apiToken: "token",
				fetchImpl: async () =>
					response({ success: true, result: [deployment(sha, "failure")] }),
				sleep: async () => {},
				timeoutMs: 1000,
				pollMs: 1,
			}),
			/failed with status failure/,
		);
	});

	it("does not accept another commits successful deployment", async () => {
		let now = 0;
		await assert.rejects(
			waitForPagesDeployment({
				accountId: "acct",
				projectName: "project",
				commitSha: sha,
				apiToken: "token",
				fetchImpl: async () =>
					response({ success: true, result: [deployment("other", "success")] }),
				sleep: async () => {
					now += 20;
				},
				timeoutMs: 10,
				pollMs: 20,
				now: () => now,
			}),
			/Timed out waiting for Cloudflare Pages deployment/,
		);
	});

	it("rejects Cloudflare API errors without exposing the token", async () => {
		const token = "super-secret-token";
		await assert.rejects(
			waitForPagesDeployment({
				accountId: "acct",
				projectName: "project",
				commitSha: sha,
				apiToken: token,
				fetchImpl: async () =>
					response(
						{ success: false, errors: [{ message: "denied" }] },
						false,
						403,
					),
				sleep: async () => {},
				timeoutMs: 1000,
				pollMs: 1,
			}),
			(error) =>
				!String(error).includes(token) &&
				/Cloudflare Pages API request failed/.test(String(error)),
		);
	});
});
