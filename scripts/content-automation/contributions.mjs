import { execFileSync } from "node:child_process";

// GitHub associates authored commits with the account only when the email is
// associated with that GitHub account. This is the repository owner's existing
// verified noreply identity, not the generic github-actions[bot] identity.
export const CONTENT_AUTHOR_EMAIL = "123220557+katelya77@users.noreply.github.com";

export function utcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function hasAttributedContentCommitOnUtcDate(log = "", date = utcDate(), email = CONTENT_AUTHOR_EMAIL) {
  return String(log).split(/\r?\n/).some((line) => {
    const [authorEmail, authoredAt] = line.trim().split("\t");
    const timestamp = Date.parse(authoredAt || "");
    return authorEmail?.toLowerCase() === email.toLowerCase()
      && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
  });
}

export function hasUtcContentContribution(now = new Date()) {
  // Full git history is available from actions/checkout with fetch-depth: 0.
  // Only substantive content commits on master count; never create an empty
  // commit merely to fill the contribution graph.
  const log = execFileSync("git", [
    "log", "-n", "150", "--format=%ae%x09%aI", "HEAD", "--", "src/content/posts/",
  ], { encoding: "utf8", timeout: 10_000 });
  return hasAttributedContentCommitOnUtcDate(log, utcDate(now));
}

export function requiredArticleTarget({
  targetDailyCount,
  currentCount,
  hasUtcContribution,
  maxDailyCount = 4,
}) {
  const baseline = Math.max(1, Number(targetDailyCount) || 1);
  const extra = hasUtcContribution ? baseline : Math.max(baseline, currentCount + 1);
  return Math.min(maxDailyCount, extra);
}
