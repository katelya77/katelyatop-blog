import assert from "node:assert/strict";
import test from "node:test";
import { normalizeContributionPeriod, fetchContributionPeriod } from "../scripts/github-contributions/update.mjs";

function makeCalendar(from, count, value = 2) {
	const start = Date.parse(from + "T00:00:00Z");
	const weeks = [];
	for (let index = 0; index < count; index += 7) {
		const contributionDays = [];
		for (let offset = 0; offset < Math.min(7, count - index); offset++) {
			const date = new Date(start + (index + offset) * 86_400_000).toISOString().slice(0, 10);
			contributionDays.push({ date, contributionCount: value, contributionLevel: "THIRD_QUARTILE" });
		}
		weeks.push({ contributionDays });
	}
	return { contributionCalendar: { totalContributions: count * value, weeks },
		totalCommitContributions: count, totalPullRequestContributions: 12,
		totalIssueContributions: 4, totalPullRequestReviewContributions: 5, totalRepositoryContributions: 3 };
}

test("official GraphQL period preserves exact counts and pads only outside requested dates", () => {
	const period = normalizeContributionPeriod("2026", "2026年", makeCalendar("2026-11-01", 8), "2026-11-01", "2026-11-08");
	assert.equal(period.totalContributions, 16);
	assert.equal(period.totals.pullRequests, 12);
	assert.equal(period.activeDays, 8);
	assert.equal(period.weeks.length, 2);
	assert.equal(period.weeks[1][0].date, "2026-11-08");
	assert.equal(period.weeks[1][1].count, null);
	assert.equal(period.weeks[0][0].level, "3");
	assert.deepEqual(Object.keys(period.weeks[0][0]).sort(), ["count", "date", "level"]);
});

test("incomplete or duplicated contribution data fails rather than showing false zeros", () => {
	const collection = makeCalendar("2026-11-01", 8);
	collection.contributionCalendar.weeks[1].contributionDays[0].date = "2026-11-01";
	assert.throws(() => normalizeContributionPeriod("2026", "2026年", collection, "2026-11-01", "2026-11-08"), /duplicate/);
	assert.throws(() => normalizeContributionPeriod("2026", "2026年", makeCalendar("2026-11-01", 3), "2026-11-01", "2026-11-08"), /Incomplete calendar/);
});

test("GraphQL request sends credentials in Authorization and never stores them in output", async () => {
	let request;
	const period = await fetchContributionPeriod({
		token: "ci-secret-not-real", login: "example", id: "2026", label: "2026年",
		from: "2026-11-01", to: "2026-11-08",
		fetchImpl: async (_url, init) => {
			request = init;
			return Response.json({ data: { user: { contributionsCollection: makeCalendar("2026-11-01", 8) } } });
		},
	});
	assert.equal(request.headers.Authorization, "Bearer ci-secret-not-real");
	assert.equal(JSON.parse(request.body).variables.login, "example");
	assert.doesNotMatch(JSON.stringify(period), /ci-secret-not-real/);
});
