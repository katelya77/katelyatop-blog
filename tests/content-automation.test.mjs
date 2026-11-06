import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  dedupeCandidates, discoverCandidates, diversifyCandidates, isPrimaryPublisherUrl,
} from "../scripts/content-automation/sources.mjs";
import {
  hasAttributedContentCommitOnUtcDate, requiredArticleTarget,
} from "../scripts/content-automation/contributions.mjs";
import {
  countPublishedForDate,
  renderPost,
  titleSimilarity,
  validateArticle,
} from "../scripts/content-automation/quality.mjs";
import { scanPublicContent } from "../scripts/content-automation/privacy.mjs";
import {
  formatApprovedEditorialContext,
  loadApprovedEditorialContext,
} from "../scripts/content-automation/public-context.mjs";

function response({ json, text = "", status = 200, contentType = "application/json" }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    async json() { return json; },
    async text() { return text; },
  };
}

function validArticle() {
  const longSection = "这部分解释架构原理、调用链和工程边界，并给出验证方式与取舍。".repeat(35);
  return {
    title: "从 Agent Harness 到恢复机制：长任务自动化为什么需要状态边界",
    slug: "agent-harness-recovery-state-boundaries",
    category: "AI前沿",
    tags: ["Agent", "Harness", "自动化", "状态管理", "工程实践"],
    description: "从任务拆分、状态管理、失败恢复与验证机制四个层面，分析长时间运行的 Agent 自动化为什么不能只依赖一次模型调用。",
    evidenceIds: ["S1", "S2"],
    body: `## 为什么长任务会失败\n\n${longSection}\n\n## 架构与状态流\n\n${longSection}\n\n\`\`\`text\nplan -> execute -> verify -> recover\n\`\`\`\n\n## 如何验证\n\n${longSection}\n\n## 失败边界与取舍\n\n${longSection}\n\n## 结论\n\n${longSection}`,
  };
}

const researchEntries = [
  { id: "S1", kind: "community", title: "讨论", url: "https://linux.do/t/1" },
  { id: "S2", kind: "primary", title: "Official docs", url: "https://docs.example.com/agent", parentId: "S1" },
];

describe("content automation source discovery", () => {
  it("recognizes known official publishers without trusting arbitrary community links", () => {
    assert.equal(isPrimaryPublisherUrl("https://github.com/openai/codex/releases"), true);
    assert.equal(isPrimaryPublisherUrl("https://developers.cloudflare.com/changelog/"), true);
    assert.equal(isPrimaryPublisherUrl("https://random-coupon.example/blog/ai"), false);
    assert.equal(isPrimaryPublisherUrl("http://github.com/openai/codex"), false);
    assert.equal(isPrimaryPublisherUrl("https://github.com.evil.example/repo"), false);
  });

  it("diversifies community and official release sources in the first research bundle", () => {
    const candidates = [
      { source: "LINUX DO latest", score: 100 },
      { source: "LINUX DO top", score: 99 },
      { source: "LINUX DO latest RSS", score: 98 },
      { source: "LINUX DO top RSS", score: 97 },
      { source: "Codex Releases", score: 60 },
      { source: "NodeLoc latest", score: 55 },
      { source: "Cloudflare Changelog", score: 50 },
    ];
    const top = diversifyCandidates(candidates, 4);
    assert.equal(top.length, 4);
    assert.deepEqual(top.map((item) => item.source), [
      "LINUX DO latest", "Codex Releases", "NodeLoc latest", "Cloudflare Changelog",
    ]);
  });
  it("deduplicates repeated community topics while keeping the strongest candidate", () => {
    const result = dedupeCandidates([
      { title: "Agent Harness 实践", url: "https://linux.do/t/1", score: 1 },
      { title: "Agent Harness 实践", url: "https://linux.do/t/2", score: 3 },
      { title: "Cloudflare 新能力", url: "https://blog.cloudflare.com/x", score: 2 },
    ]);
    assert.equal(result.length, 2);
    assert.equal(result[0].url, "https://linux.do/t/2");
  });

  it("continues when some discovery endpoints are unavailable", async () => {
    const now = Date.parse("2026-08-31T12:00:00Z");
    const fetchImpl = async (url) => {
      const value = String(url);
      if (value.includes("linux.do/latest.json")) {
        return response({
          json: {
            topic_list: {
              topics: [{
                id: 123,
                slug: "agent-topic",
                title: "Agent 新实践",
                created_at: "2026-08-31T10:00:00Z",
                views: 800,
                posts_count: 30,
                like_count: 20,
                tags: ["ai"],
              }],
            },
          },
        });
      }
      if (value.endsWith(".atom") || value.includes("rss")) {
        return response({
          text: "<rss><channel><item><title>Official release</title><link>https://example.com/release</link><pubDate>Mon, 31 Aug 2026 09:00:00 GMT</pubDate></item></channel></rss>",
          contentType: "application/rss+xml",
        });
      }
      return response({ json: {}, status: 503 });
    };
    const candidates = await discoverCandidates({ fetchImpl, now, limit: 10 });
    assert.ok(candidates.some((candidate) => candidate.title === "Agent 新实践"));
    assert.ok(candidates.some((candidate) => candidate.title === "Official release"));
  });

  it("falls back to LINUX DO RSS when Discourse JSON is blocked", async () => {
    const now = Date.parse("2026-08-31T12:00:00Z");
    const fetchImpl = async (url) => {
      const value = String(url);
      if (value.includes("linux.do") && value.endsWith(".json")) {
        return response({ json: {}, status: 403 });
      }
      if (value.includes("linux.do") && value.includes(".rss")) {
        return response({
          text: "<rss><channel><item><title>LINUX DO Coding Agent 精华</title><link>https://linux.do/t/topic/123</link><pubDate>Mon, 31 Aug 2026 10:00:00 GMT</pubDate></item></channel></rss>",
          contentType: "application/rss+xml",
        });
      }
      return response({ json: {}, status: 503 });
    };
    const candidates = await discoverCandidates({ fetchImpl, now, limit: 10 });
    const linux = candidates.find((candidate) => candidate.title === "LINUX DO Coding Agent 精华");
    assert.ok(linux, "LINUX DO RSS should keep the source alive when JSON gets 403");
    assert.equal(linux.sourceKind, "community");
  });
});

describe("content automation quality gates", () => {
  it("counts only non-draft posts for the target China date", () => {
    const posts = [
      { published: "2026-08-31", draft: false },
      { published: "2026-08-31", draft: true },
      { published: "2026-08-30", draft: false },
    ];
    assert.equal(countPublishedForDate(posts, "2026-08-31"), 1);
  });

  it("detects highly similar titles", () => {
    assert.ok(titleSimilarity("Codex 子代理编排实践", "Codex 子代理编排：工程实践") > 0.6);
    assert.ok(titleSimilarity("Cloudflare Tunnel 网络架构", "Qwen 多模态模型发布") < 0.4);
  });

  it("accepts a structured evidence-backed article and renders valid frontmatter", () => {
    const article = validArticle();
    const validation = validateArticle(article, { researchEntries, existingPosts: [] });
    assert.deepEqual(validation.errors, []);
    const rendered = renderPost(article, {
      date: "2026-08-31",
      evidence: validation.evidence,
      imageUrl: "https://docs.example.com/cover.webp",
    });
    assert.match(rendered, /published: 2026-08-31/);
    assert.match(rendered, /draft: false/);
    assert.match(rendered, /## 参考资料/);
    assert.match(rendered, /https:\/\/docs\.example\.com\/agent/);
  });

  it("rejects active HTML emitted through untrusted research prompt injection", () => {
    const article = validArticle();
    article.body += "\n\n<script>fetch('https://evil.example')</script>";
    const validation = validateArticle(article, { researchEntries, existingPosts: [] });
    assert.ok(validation.errors.some((error) => error.includes("active HTML")));
  });

  it("rejects a secondary advertisement as the only non-community evidence", () => {
    const article = validArticle();
    const evidence = [
      { id: "S1", kind: "community", title: "community", url: "https://linux.do/t/1" },
      { id: "S2", kind: "reference", title: "marketing", url: "https://coupon.example/promo" },
    ];
    const check = validateArticle(article, { researchEntries: evidence, existingPosts: [] });
    assert.ok(check.errors.some((item) => item.includes("first-party primary")));
  });

  it("rejects new titles built entirely from the same existing evidence pair", () => {
    const article = validArticle();
    const check = validateArticle(article, {
      researchEntries,
      existingPosts: [{
        title: "Another unrelated headline",
        referenceUrls: ["https://linux.do/t/1", "https://docs.example.com/agent"],
      }],
    });
    assert.ok(check.errors.some((item) => item.includes("same evidence")));
  });

  it("rejects another article from the same evidence root in one publishing batch", () => {
    const article = validArticle();
    const validation = validateArticle(article, {
      researchEntries,
      existingPosts: [],
      forbiddenEvidenceRootIds: new Set(["S1"]),
    });
    assert.ok(
      validation.errors.some((error) => error.includes("evidence topic already used")),
      "the second article must select a different root topic",
    );
  });
});

describe("public content privacy gates", () => {
  it("blocks token-like credentials, private network addresses, local paths, and personal identifiers", () => {
    const result = scanPublicContent([
      "GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
      "Internal host: 192.168.1.20",
      "Local path: C:\\Users\\Example\\Desktop\\project",
      "Phone: 13800138000",
    ].join("\n"));
    const codes = result.blocking.map((finding) => finding.code);
    assert.ok(codes.includes("secret-token"));
    assert.ok(codes.includes("private-network-address"));
    assert.ok(codes.includes("local-filesystem-path"));
    assert.ok(codes.includes("phone-number"));
    assert.equal(result.ok, false);
  });

  it("requires review for email addresses and blocks raw conversation role lines", () => {
    const email = scanPublicContent("Contact: writer@private.example");
    assert.ok(email.review.some((finding) => finding.code === "email-address"));

    const transcript = scanPublicContent("User: Here is a private conversation\nAssistant: ...");
    assert.ok(transcript.blocking.some((finding) => finding.code === "raw-chat-transcript"));
  });

  it("allows clearly redacted credential placeholders", () => {
    const result = scanPublicContent("API_KEY=YOUR_API_KEY\nPASSWORD=REDACTED");
    assert.equal(result.ok, true);
    assert.deepEqual(result.blocking, []);
    assert.deepEqual(result.review, []);
  });

  it("loads only approved public topic-inspiration summaries", () => {
    const entries = loadApprovedEditorialContext();
    assert.ok(entries.length >= 5);
    assert.ok(entries.every((entry) => entry.id && entry.title && entry.summary));
    const promptContext = formatApprovedEditorialContext(entries);
    assert.match(promptContext, /engineering-evidence-chain/);
    assert.match(promptContext, /agent-grounded-data/);
    assert.doesNotMatch(promptContext, /private|credential|password/i);
  });

  it("rejects generated articles containing credentials before they can be published", () => {
    const article = validArticle();
    article.body += "\n\nGITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    const validation = validateArticle(article, { researchEntries, existingPosts: [] });
    assert.ok(validation.errors.some((error) => error.includes("privacy gate")));
  });
});

describe("GitHub showcase page", () => {
  it("uses build-time public GitHub data and avoids client-side hydration", async () => {
    const page = await readFile(
      new URL("../src/pages/github.astro", import.meta.url),
      "utf8",
    );
    assert.match(page, /fetchGitHubJson/);
    assert.match(page, /repo\.private === false/);
    assert.match(page, /!repo\.fork && !repo\.archived/);
    assert.match(page, /AbortSignal\.timeout/);
    assert.doesNotMatch(page, /client:(?:load|idle|visible|only)/);
    assert.match(page, /loading="eager"/);
  });

  it("keeps the featured repository list curated and public-facing", async () => {
    const data = await readFile(
      new URL("../src/data/github-showcase.ts", import.meta.url),
      "utf8",
    );
    for (const name of ["katelyatop-blog", "K-Vault", "KatelyaTV", "DecoTV"]) {
      assert.ok(data.includes(name), `missing featured public repository: ${name}`);
    }
    assert.match(data, /github\.com\/katelya77/);
  });
});

describe("UTC contribution accounting", () => {
  it("credits only the owner's linked noreply identity and actual UTC author date", () => {
    const log = [
      "123220557+katelya77@users.noreply.github.com\t2026-10-26T23:59:59+00:00",
      "41898282+github-actions[bot]@users.noreply.github.com\t2026-10-27T06:00:00+00:00",
    ].join("\n");
    assert.equal(hasAttributedContentCommitOnUtcDate(log, "2026-10-27"), false);
    assert.equal(hasAttributedContentCommitOnUtcDate(log, "2026-10-26"), true);
    assert.equal(hasAttributedContentCommitOnUtcDate("123220557+katelya77@users.noreply.github.com\t2026-10-27T01:30:00+00:00", "2026-10-27"), true);
  });

  it("requests a real extra article when China-time quota is met but UTC contribution is absent", () => {
    assert.equal(requiredArticleTarget({ targetDailyCount: 2, currentCount: 2, hasUtcContribution: false }), 3);
    assert.equal(requiredArticleTarget({ targetDailyCount: 2, currentCount: 2, hasUtcContribution: true }), 2);
    assert.equal(requiredArticleTarget({ targetDailyCount: 2, currentCount: 4, hasUtcContribution: false }), 4);
  });
});

describe("content publisher workflow contract", () => {
  it("publishes validated content without requiring Actions to create its own PR", async () => {
    const workflow = await readFile(
      new URL("../.github/workflows/content-publisher.yml", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(workflow, /gh pr create/);
    assert.doesNotMatch(workflow, /gh pr merge/);
    assert.match(workflow, /git rev-parse origin\/master/);
    assert.match(workflow, /git push origin HEAD:master/);
    assert.match(workflow, /Wait for Cloudflare Pages and refresh DogeCloud CDN/);
    assert.match(workflow, /Verify generated articles are publicly visible/);
    assert.ok(workflow.includes("editorial/public-context.json"));
    assert.match(workflow, /cron: "17 1 \* \* \*"/);
    assert.match(workflow, /cron: "37 15 \* \* \*"/);
  });
});
