import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	createAuthorization,
	submitDogeRefresh,
} from "../scripts/cdn-refresh/doge-client.mjs";

function response(body, ok = true, status = 200) {
	return {
		ok,
		status,
		async json() {
			return body;
		},
	};
}

describe("DogeCloud refresh client", () => {
	it("matches the documented HMAC-SHA1 signing vector", () => {
		const auth = createAuthorization({
			apiPath: "/auth/upload.json?filename=a.mp4",
			body: "",
			accessKey: "MY_ACCESS_KEY",
			secretKey: "MY_SECRET_KEY",
		});
		assert.equal(
			auth,
			"TOKEN MY_ACCESS_KEY:bf5ec167c882d6ffa8afa4a1d2c2ed8d622beadf",
		);
	});

	it("submits URL refreshes as form-urlencoded data", async () => {
		const calls = [];
		const result = await submitDogeRefresh({
			rtype: "url",
			urls: [
				"https://blog.katelya.top/",
				"https://blog.katelya.top/rss.xml",
			],
			accessKey: "AK",
			secretKey: "SK",
			fetchImpl: async (url, init) => {
				calls.push({ url: String(url), init });
				return response({ code: 200, data: { task_id: "TASK.URL.1" } });
			},
		});
		assert.equal(result.taskId, "TASK.URL.1");
		assert.equal(calls.length, 1);
		assert.equal(
			calls[0].url,
			"https://api.dogecloud.com/cdn/refresh/add.json",
		);
		assert.equal(calls[0].init.method, "POST");
		assert.equal(
			calls[0].init.headers["Content-Type"],
			"application/x-www-form-urlencoded",
		);
		assert.match(calls[0].init.headers.Authorization, /^TOKEN AK:[0-9a-f]{40}$/);
		const params = new URLSearchParams(calls[0].init.body);
		assert.equal(params.get("rtype"), "url");
		assert.deepEqual(JSON.parse(params.get("urls")), [
			"https://blog.katelya.top/",
			"https://blog.katelya.top/rss.xml",
		]);
	});

	it("supports path refreshes", async () => {
		const result = await submitDogeRefresh({
			rtype: "path",
			urls: ["https://blog.katelya.top/pagefind/"],
			accessKey: "AK",
			secretKey: "SK",
			fetchImpl: async () =>
				response({ code: 200, data: { task_id: "TASK.PATH.1" } }),
		});
		assert.equal(result.taskId, "TASK.PATH.1");
	});

	it("retries transient rate-limit and server failures before succeeding", async () => {
		let calls = 0;
		const waits = [];
		const result = await submitDogeRefresh({
			rtype: "url",
			urls: ["https://blog.katelya.top/"],
			siteUrl: "https://blog.katelya.top",
			accessKey: "AK",
			secretKey: "SK",
			maxAttempts: 4,
			sleep: async (ms) => waits.push(ms),
			fetchImpl: async () => {
				calls += 1;
				if (calls === 1) return response({ code: 429, msg: "rate limited" }, false, 429);
				if (calls === 2) return response({ code: 503, msg: "temporary" }, false, 503);
				return response({ code: 200, data: { task_id: "TASK.RETRY.1" } });
			},
		});
		assert.equal(result.taskId, "TASK.RETRY.1");
		assert.equal(result.attempts, 3);
		assert.equal(calls, 3);
		assert.equal(waits.length, 2);
	});

	it("fails without leaking secrets when the API rejects the request", async () => {
		const secret = "very-secret-value";
		await assert.rejects(
			submitDogeRefresh({
				rtype: "url",
				urls: ["https://blog.katelya.top/"],
				accessKey: "AK",
				secretKey: secret,
				fetchImpl: async () => response({ code: 403, msg: "denied" }),
			}),
			(error) =>
				!String(error).includes(secret) &&
				/DogeCloud API request failed/.test(String(error)),
		);
	});

	it("rejects refresh targets outside the configured site scope before network access", async () => {
		let called = false;
		await assert.rejects(
			submitDogeRefresh({
				rtype: "url",
				urls: ["https://evil.example/"],
				siteUrl: "https://blog.katelya.top",
				accessKey: "AK",
				secretKey: "SK",
				fetchImpl: async () => {
					called = true;
					return response({ code: 200, data: { task_id: "x" } });
				},
			}),
			/outside SITE_URL scope/,
		);
		assert.equal(called, false);
	});
});
