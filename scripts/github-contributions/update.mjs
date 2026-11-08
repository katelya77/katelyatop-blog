import { writeFile } from "node:fs/promises";

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const QUERY = `query ContributionCalendar($login:String!,$from:DateTime!,$to:DateTime!) {
  user(login:$login) {
    contributionsCollection(from:$from,to:$to) {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoryContributions
    }
  }
}`;
const LEVELS = {
  NONE: "0", FIRST_QUARTILE: "1", SECOND_QUARTILE: "2",
  THIRD_QUARTILE: "3", FOURTH_QUARTILE: "4",
};
const DAY_MS = 86_400_000;

function utcDay(value) {
  return new Date(value + "T00:00:00Z");
}

function isoDay(value) {
  return value.toISOString().slice(0, 10);
}

export function normalizeContributionPeriod(id, label, collection, from, to) {
  const calendar = collection?.contributionCalendar;
  if (!calendar || !Array.isArray(calendar.weeks)) throw new Error("GitHub contribution calendar is missing");
  const validDays = new Map();
  for (const week of calendar.weeks) {
    for (const day of week.contributionDays ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
        !Number.isInteger(day.contributionCount) || day.contributionCount < 0 ||
        !Object.hasOwn(LEVELS, day.contributionLevel) ||
        validDays.has(day.date)) {
        throw new Error("Invalid or duplicate contribution day from GitHub");
      }
      validDays.set(day.date, {
        date: day.date,
        count: day.contributionCount,
        level: LEVELS[day.contributionLevel],
      });
    }
  }
  const start = utcDay(from);
  const end = utcDay(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    throw new Error("Invalid calendar date range");
  }
  const expected = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const inRange = [...validDays.keys()].filter((date) => date >= from && date <= to).length;
  if (expected < 1 || expected > 367 || inRange < expected - 2) {
    throw new Error(`Incomplete calendar from GitHub: ${inRange}/${expected} days`);
  }
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const weeks = [];
  for (let time = start.getTime(); time <= end.getTime(); time += 7 * DAY_MS) {
    const week = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = isoDay(new Date(time + weekday * DAY_MS));
      // Padding days are unknown, never zero. GitHub official days retain exact counts.
      week.push(validDays.get(date) ?? { date, count: null, level: "unknown" });
    }
    weeks.push(week);
  }
  function tally(field) {
    const n = collection[field];
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }
  if (!Number.isInteger(calendar.totalContributions) || calendar.totalContributions < 0) {
    throw new Error("Invalid GitHub totalContributions");
  }
  return {
    id, label, from, to,
    totalContributions: calendar.totalContributions,
    activeDays: [...validDays.values()].filter((day) => day.date >= from && day.date <= to && day.count > 0).length,
    totals: {
      commits: tally("totalCommitContributions"),
      pullRequests: tally("totalPullRequestContributions"),
      issues: tally("totalIssueContributions"),
      reviews: tally("totalPullRequestReviewContributions"),
      repositories: tally("totalRepositoryContributions"),
    },
    weeks,
  };
}

export async function fetchContributionPeriod({ token, login, id, label, from, to, fetchImpl = fetch }) {
  if (!token) throw new Error("GITHUB_TOKEN must be configured on the CI runner");
  const response = await fetchImpl(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "katelya-contribution-snapshot",
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { login, from: from + "T00:00:00Z", to: to + "T23:59:59Z" },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("GitHub GraphQL returned HTTP " + response.status);
  const payload = await response.json();
  if (payload.errors?.length || !payload.data?.user?.contributionsCollection) {
    throw new Error("GitHub contribution query failed (no incomplete snapshot will be published)");
  }
  return normalizeContributionPeriod(id, label, payload.data.user.contributionsCollection, from, to);
}

export async function buildContributionSnapshot({
  now = new Date(),
  login = "katelya77",
  token = process.env.GITHUB_TOKEN,
  fetchImpl = fetch,
} = {}) {
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) throw new Error("Invalid GitHub login");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const rollingStart = new Date(today.getTime() - 364 * DAY_MS);
  const currentYear = today.getUTCFullYear();
  const specs = [
    { id: "rolling", label: "过去一年", from: isoDay(rollingStart), to: isoDay(today) },
    ...Array.from({ length: 4 }, (_, index) => {
      const year = currentYear - index;
      return {
        id: String(year),
        label: year + "年",
        from: year + "-01-01",
        to: year === currentYear ? isoDay(today) : year + "-12-31",
      };
    }),
  ];
  const periods = [];
  for (const period of specs) periods.push(await fetchContributionPeriod({
    token, login, fetchImpl, ...period,
  }));
  return {
    schemaVersion: 1,
    login,
    source: "github-graphql-contributionsCollection",
    fetchedAt: now.toISOString(),
    periods,
  };
}

async function main() {
  const snapshot = await buildContributionSnapshot({
    login: process.env.GITHUB_CONTRIBUTIONS_LOGIN || "katelya77",
  });
  const target = new URL("../../src/data/github-contributions.json", import.meta.url);
  await writeFile(target, JSON.stringify(snapshot, null, 2) + "\n");
  console.log("[github-contributions] Official data updated:", JSON.stringify({
    periods: snapshot.periods.map(({ id, totalContributions, activeDays, weeks }) => ({
      id, totalContributions, activeDays, days: weeks.flat().filter((day) => day.count !== null).length,
    })),
  }));
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  main().catch((error) => {
    // Never log API response bodies or the authentication token.
    console.error("[github-contributions] Update failed:", error.message);
    process.exitCode = 1;
  });
}
