import { parse } from "node-html-parser";

const CONTRIBUTION_ENDPOINT = "https://github.com/users/katelya77/contributions";
const GITHUB_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CALENDAR_DAYS = 400;

function extractCount(text) {
  const match = String(text || "").replaceAll(",", "").match(/(?:^|\s)(\d+)\s+contributions?\b/i);
  return match ? Number(match[1]) : null;
}

export function parsePublicContributionHtml(html) {
  const root = parse(String(html || ""));
  const tips = new Map();
  for (const tip of root.querySelectorAll("tool-tip, tooltip, [role=tooltip]")) {
    const id = tip.getAttribute("for") || tip.getAttribute("id");
    if (id) tips.set(id, tip.textContent.trim());
  }
  const days = new Map();
  for (const cell of root.querySelectorAll("[data-date]")) {
    const date = cell.getAttribute("data-date") || "";
    const rawLevel = cell.getAttribute("data-level");
    if (!GITHUB_DAY.test(date) || !/^[0-4]$/.test(rawLevel || "")) continue;
    const id = cell.getAttribute("id") || "";
    const label = [
      cell.getAttribute("aria-label"),
      cell.getAttribute("title"),
      tips.get(id),
      cell.textContent,
    ].filter(Boolean).join(" ");
    const count = extractCount(label);
    if (count === null || !Number.isSafeInteger(count)) continue;
    days.set(date, { date, count, level: String(rawLevel) });
  }
  const calendar = [...days.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_CALENDAR_DAYS);
  // A changed GitHub response or a partially scraped graph cannot be used
  // to assert zero contribution on days that did not actually parse.
  return calendar.length >= 300 ? calendar : null;
}

export async function fetchPublicContributionCalendar({
  fetchImpl = fetch,
  signal = AbortSignal.timeout(5000),
} = {}) {
  try {
    const response = await fetchImpl(CONTRIBUTION_ENDPOINT, {
      headers: {
        Accept: "text/html",
        "User-Agent": "Katelya-Blog/1.0 (public profile contribution calendar)",
      },
      signal,
    });
    if (!response.ok) return null;
    return parsePublicContributionHtml(await response.text());
  } catch {
    return null;
  }
}
