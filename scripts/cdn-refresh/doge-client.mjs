import crypto from "node:crypto";

const API_ORIGIN = "https://api.dogecloud.com";
const REFRESH_PATH = "/cdn/refresh/add.json";

export function createAuthorization({ apiPath, body, accessKey, secretKey }) {
	if (!apiPath || !accessKey || !secretKey) {
		throw new Error("Missing DogeCloud signing configuration");
	}
	const signStr = `${apiPath}\n${body ?? ""}`;
	const signature = crypto
		.createHmac("sha1", secretKey)
		.update(Buffer.from(signStr, "utf8"))
		.digest("hex");
	return `TOKEN ${accessKey}:${signature}`;
}

function assertSiteScope(urls, siteUrl) {
	if (!siteUrl) return;
	const expected = new URL(siteUrl);
	for (const rawUrl of urls) {
		const target = new URL(rawUrl);
		if (target.protocol !== "https:" || target.origin !== expected.origin) {
			throw new Error(`Refresh target outside SITE_URL scope: ${target.origin}`);
		}
	}
}

export async function submitDogeRefresh({
	rtype,
	urls,
	siteUrl,
	accessKey,
	secretKey,
	fetchImpl = fetch,
}) {
	if (!["url", "path"].includes(rtype)) {
		throw new Error(`Unsupported DogeCloud refresh type: ${rtype}`);
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

	const response = await fetchImpl(`${API_ORIGIN}${REFRESH_PATH}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: authorization,
		},
		body,
	});

	let payload;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok || payload?.code !== 200) {
		const detail = payload?.msg || `HTTP ${response.status}`;
		throw new Error(`DogeCloud API request failed: ${detail}`);
	}

	const taskId = payload?.data?.task_id;
	if (!taskId) throw new Error("DogeCloud API request failed: missing task_id");
	return { taskId };
}
