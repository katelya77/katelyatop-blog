import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublicContributionCalendar, parsePublicContributionHtml } from "../scripts/github-public-contributions.mjs";

function calendarFixture() {
  const dates = Array.from({ length: 366 }, (_, i) => {
    const date = new Date(Date.UTC(2025, 10, 7 + i)).toISOString().slice(0, 10);
    const count = i % 5;
    return `<td id="contrib-${i}" data-date="${date}" data-level="${count}"></td><tool-tip for="contrib-${i}">${count} contributions on ${date}</tool-tip>`;
  });
  return `<table><tbody><tr>${dates.join("")}</tr></tbody></table>`;
}

test("parses GitHub official daily counts rather than inferred public events", () => {
  const result = parsePublicContributionHtml(calendarFixture());
  assert.equal(result.length, 366);
  assert.equal(result[1].count, 1);
  assert.equal(result[4].level, "4");
  assert.ok(result.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date)));
});

test("rejects a changed or partial contribution markup instead of inventing zeros", () => {
  assert.equal(parsePublicContributionHtml("<div>rate limited</div>"), null);
  assert.equal(parsePublicContributionHtml('<td data-date="2026-11-07" data-level="4"></td>'), null);
});

test("falls back safely on GitHub non-200 responses", async () => {
  const calendar = await fetchPublicContributionCalendar({
    fetchImpl: async () => ({ ok: false, status: 429 }),
    signal: AbortSignal.timeout(100),
  });
  assert.equal(calendar, null);
});
