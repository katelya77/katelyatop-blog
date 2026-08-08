const TERMINAL_FAILURES = new Set(["failure", "canceled"]);

export function findDeploymentForCommit(payload, commitSha) {
	const deployments = Array.isArray(payload?.result) ? payload.result : [];
	return (
		deployments.find(
			(deployment) =>
				deployment?.environment === "production" &&
				deployment?.deployment_trigger?.metadata?.commit_hash === commitSha,
		) ?? null
	);
}

export async function waitForPagesDeployment({
	accountId,
	projectName,
	commitSha,
	apiToken,
	fetchImpl = fetch,
	sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	now = () => Date.now(),
	timeoutMs = 10 * 60 * 1000,
	pollMs = 15 * 1000,
}) {
	if (!accountId || !projectName || !commitSha || !apiToken) {
		throw new Error("Missing Cloudflare Pages deployment configuration");
	}

	const startedAt = now();
	const endpoint = new URL(
		`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments`,
	);
	endpoint.searchParams.set("env", "production");
	endpoint.searchParams.set("per_page", "25");

	while (now() - startedAt <= timeoutMs) {
		const response = await fetchImpl(endpoint, {
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
		});

		let payload;
		try {
			payload = await response.json();
		} catch {
			payload = null;
		}

		if (!response.ok || payload?.success !== true) {
			const detail = payload?.errors?.[0]?.message || `HTTP ${response.status}`;
			throw new Error(`Cloudflare Pages API request failed: ${detail}`);
		}

		const deployment = findDeploymentForCommit(payload, commitSha);
		if (deployment) {
			const status = deployment?.latest_stage?.status;
			if (status === "success") return deployment;
			if (TERMINAL_FAILURES.has(status)) {
				throw new Error(
					`Cloudflare Pages deployment ${commitSha} failed with status ${status}`,
				);
			}
		}

		await sleep(pollMs);
	}

	throw new Error(
		`Timed out waiting for Cloudflare Pages deployment for commit ${commitSha}`,
	);
}
