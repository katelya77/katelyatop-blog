import crypto from "node:crypto";

const API_ORIGIN = "https://api.dogecloud.com";
const REFRESH_PATH = "/cdn/refresh/add.json";
const QUERY_PATH = "/cdn/refresh/query.json";
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_QUERY_ATTEMPTS = 60;
const DEFAULT_QUERY_INTERVAL_MS = 10_000;

export function createAuthorization({ apiPath, body, accessKey, secretKey }) {
	if (!apiPath || !accessKey || !secretKey) {
		throw new Error("Missing DogeCloud signing configuration");
	}
	const signStr = apiPath + "\n" + (body ?? "");
	const signature = crypto
		.createHmac("sha1", secretKey)
		.update(Buffer.from(signStr, "utf8"))
		.digest("hex");
	return "TOKEN " + accessKey + ":" + signature;
}

function assertSiteScope(urls, siteUrl) {
	if (!siteUrl) return;
	const expected = new URL(siteUrl);
	for (const rawUrl of urls) {
		const target = new URL(rawUrl);
		if (target.protocol !== "https:" || target.origin !== expected.origin) {
			throw new Error("Refresh target outside SITE_URL scope: " + target.origin);
		}
	}
}

function isRetryable(response, payload) {
	if (!response) return true;
	if (response.status === 429 || response.status >= 500) return true;
	const code = Number(payload?.code || 0);
	return code === 429 || code >= 500;
}

function delayForAttempt(attempt) {
	return Math.min(8_000, 750 * 2 ** Math.max(0, attempt - 1));
}

async function readPayload(response) {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

export async function submitDogeRefresh({
	rtype,
	urls,
	siteUrl,
	accessKey,
	secretKey,
	fetchImpl = fetch,
	sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
	if (!["url", "path"].includes(rtype)) {
		throw new Error("Unsupported DogeCloud refresh type: " + rtype);
	}
	if (!Array.isArray(urls) || urls.length === 0) {
		throw new Error("DogeCloud refresh requires at least one URL");
	}
	if (!accessKey || !secretKey) throw new Error("Missing DogeCloud credentials");

	assertSiteScope(urls, siteUrl);

	const body = new URLSearchParams({
		rtype,
		urls: JSON.stringify(urls),
	}).toString();
	const authorization = createAuthorization({
		apiPath: REFRESH_PATH,
		body,
		accessKey,
		secretKey,
	});

	let lastDetail = "unknown error";
	for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
		let response = null;
		let payload = null;
		try {
			response = await fetchImpl(API_ORIGIN + REFRESH_PATH, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
					Authorization: authorization,
				},
				body,
			});
			payload = await readPayload(response);

			if (response.ok && payload?.code === 200) {
				const taskId = payload?.data?.task_id;
				if (!taskId) throw new Error("DogeCloud API request failed: missing task_id");
				return { taskId, attempts: attempt };
			}

			lastDetail = payload?.msg || "HTTP " + response.status;
			if (!isRetryable(response, payload) || attempt === maxAttempts) break;
		} catch (error) {
			lastDetail = error?.message || String(error);
			if (attempt === maxAttempts) break;
		}

		await sleep(delayForAttempt(attempt));
	}

	throw new Error("DogeCloud API request failed after retries: " + lastDetail);
}

export async function queryDogeRefresh({
	taskId,
	accessKey,
	secretKey,
	fetchImpl = fetch,
}) {
	if (!taskId || !accessKey || !secretKey) {
		throw new Error("Missing DogeCloud refresh query configuration");
	}

	const apiPath = QUERY_PATH + "?id=" + encodeURIComponent(taskId);
	const authorization = createAuthorization({
		apiPath,
		body: "",
		accessKey,
		secretKey,
	});

	let response;
	try {
		response = await fetchImpl(API_ORIGIN + apiPath, {
			method: "GET",
			headers: { Authorization: authorization },
		});
	} catch (error) {
		const failure = new Error(
			"DogeCloud refresh query network failure: " + (error?.message || String(error)),
		);
		failure.retryable = true;
		throw failure;
	}

	const payload = await readPayload(response);
	if (!response.ok || payload?.code !== 200) {
		const detail = payload?.msg || "HTTP " + response.status;
		const failure = new Error("DogeCloud refresh query failed: " + detail);
		failure.retryable = isRetryable(response, payload);
		throw failure;
	}

	return Array.isArray(payload?.data?.tasks) ? payload.data.tasks : [];
}

export async function waitForDogeRefresh({
	taskId,
	accessKey,
	secretKey,
	fetchImpl = fetch,
	sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	maxAttempts = DEFAULT_QUERY_ATTEMPTS,
	pollMs = DEFAULT_QUERY_INTERVAL_MS,
}) {
	if (!taskId || !accessKey || !secretKey) {
		throw new Error("Missing DogeCloud refresh wait configuration");
	}

	let lastDetail = "DogeCloud returned no task records";
	for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
		try {
			const tasks = await queryDogeRefresh({
				taskId,
				accessKey,
				secretKey,
				fetchImpl,
			});

			if (tasks.length > 0) {
				const failed = tasks.filter((task) =>
					["fail", "invalid"].includes(String(task?.status || "").toLowerCase()),
				);
				if (failed.length > 0) {
					const failure = new Error(
						"DogeCloud refresh task " + taskId + " failed for " + failed.length + " target(s)",
					);
					failure.retryable = false;
					throw failure;
				}

				if (tasks.every((task) => String(task?.status || "").toLowerCase() === "done")) {
					return { taskId, count: tasks.length, attempts: attempt, tasks };
				}

				const completed = tasks.filter(
					(task) => String(task?.status || "").toLowerCase() === "done",
				).length;
				lastDetail = completed + "/" + tasks.length + " targets completed";
			}
		} catch (error) {
			if (error?.retryable === false) throw error;
			lastDetail = error?.message || String(error);
		}

		if (attempt < maxAttempts) await sleep(pollMs);
	}

	throw new Error(
		"Timed out waiting for DogeCloud refresh task " + taskId + ": " + lastDetail,
	);
}
