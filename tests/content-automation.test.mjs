import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dedupeCandidates, discoverCandidates } from "../scripts/content-automation/sources.mjs";
import {
  countPublishedForDate,
  renderPost,
  titleSimilarity,
  validateArticle,
} from "../scripts/content-automation/quality.mjs";

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
  { id: "S2", kind: "primary", title: "Official docs", url: "https://docs.example.com/agent" },
];

describe("content automation source discovery", () => {
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
});
