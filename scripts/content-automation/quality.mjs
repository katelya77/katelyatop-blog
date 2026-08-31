import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

import { isCommunityUrl, normalizeTitle } from "./sources.mjs";

const POSTS_DIR = "src/content/posts";
const FORBIDDEN_CLAIMS = [
  /我(?:亲测|实测|已经测试|跑了几天|部署后发现)/,
  /本文转载自/,
  /原文如下/,
  /作为(?:一个|一名)\s*AI/i,
  /根据我的真实测试/,
];

export function chinaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function readFrontmatter(content = "") {
  const match = String(content).match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/);
    if (!field) continue;
    data[field[1]] = field[2].replace(/^["']|["']$/g, "");
  }
  return data;
}

export function listExistingPosts(postsDir = POSTS_DIR) {
  const output = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (![".md", ".mdx"].includes(extname(entry.name).toLowerCase())) continue;
      const content = readFileSync(full, "utf8");
      const frontmatter = readFrontmatter(content);
      output.push({
        path: full.replaceAll("\\", "/"),
        title: frontmatter.title || basename(entry.name, extname(entry.name)),
        published: frontmatter.published || "",
        draft: frontmatter.draft === "true",
      });
    }
  };
  walk(postsDir);
  return output;
}

export function countPublishedForDate(posts, date) {
  return posts.filter((post) => post.published === date && !post.draft).length;
}

function charBigrams(value = "") {
  const normalized = normalizeTitle(value);
  if (normalized.length < 2) return new Set([normalized]);
  const grams = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    grams.add(normalized.slice(index, index + 2));
  }
  return grams;
}

export function titleSimilarity(left, right) {
  const a = charBigrams(left);
  const b = charBigrams(right);
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const item of a) if (b.has(item)) common += 1;
  return common / Math.max(a.size, b.size);
}

function countHeadings(body = "") {
  return (String(body).match(/^##\s+\S.+$/gm) || []).length;
}

function countCodeBlocks(body = "") {
  return Math.floor((String(body).match(/^```/gm) || []).length / 2);
}

function countBlockquotes(body = "") {
  return (String(body).match(/^>\s+/gm) || []).length;
}

function normalizeEvidenceIds(ids = []) {
  return [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
}

export function validateArticle(article, { researchEntries = [], existingPosts = [] } = {}) {
  const errors = [];
  const title = String(article?.title || "").trim();
  const slug = String(article?.slug || "").trim();
  const category = String(article?.category || "").trim();
  const description = String(article?.description || "").trim();
  const body = String(article?.body || "").trim();
  const tags = Array.isArray(article?.tags) ? article.tags.map(String).map((tag) => tag.trim()).filter(Boolean) : [];
  const evidenceIds = normalizeEvidenceIds(article?.evidenceIds);

  if (title.length < 10 || title.length > 72) errors.push("title must be 10-72 characters");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+){2,15}$/.test(slug) || slug.length > 96) {
    errors.push("slug must be a descriptive lowercase kebab-case identifier");
  }
  if (!category || category.length > 24) errors.push("category is required and must be concise");
  if (description.length < 40 || description.length > 220) errors.push("description must be 40-220 characters");
  if (tags.length < 4 || tags.length > 10) errors.push("tags must contain 4-10 useful tags");
  if (body.length < 2200) errors.push("body must contain at least 2200 characters");
  if (countHeadings(body) < 4) errors.push("body must contain at least four level-2 sections");
  if (countBlockquotes(body) > 6) errors.push("body contains too many blockquotes; summarize instead of quoting");

  const engineeringSignals = [
    /原理|机制|架构|工作流|数据流|调用链/,
    /```|命令|配置|示例|步骤|复现/,
    /验证|检查|观测|指标|日志|证据/,
    /边界|限制|失败|风险|坑|异常/,
    /取舍|权衡|适合|不适合|成本|选择/,
    /结论|判断|建议|我更倾向|值得关注/,
  ];
  const signalCount = engineeringSignals.filter((pattern) => pattern.test(body)).length;
  if (signalCount < 3) errors.push("article must include at least three engineering-value signals");

  if (countCodeBlocks(body) === 0 && !/表格|对比|检查清单|步骤/.test(body)) {
    errors.push("article needs reproducible code/config or an explicit structured checklist/comparison");
  }

  for (const pattern of FORBIDDEN_CLAIMS) {
    if (pattern.test(body)) errors.push(`forbidden unsupported first-person claim: ${pattern}`);
  }

  for (const post of existingPosts) {
    if (titleSimilarity(title, post.title) >= 0.72) {
      errors.push(`title is too similar to existing post: ${post.title}`);
      break;
    }
  }

  const evidenceById = new Map(researchEntries.map((entry) => [String(entry.id), entry]));
  const validEvidence = evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean);
  if (validEvidence.length < 2) errors.push("article must cite at least two retrieved research entries");
  if (!validEvidence.some((entry) => entry.kind === "primary" || !isCommunityUrl(entry.url))) {
    errors.push("article needs at least one non-community primary/reference source");
  }

  const primaryFacts = validEvidence.filter((entry) => entry.kind === "primary").length;
  const communityFacts = validEvidence.filter((entry) => entry.kind === "community").length;
  if (communityFacts > 0 && primaryFacts === 0) {
    errors.push("community-only evidence is not sufficient for publication");
  }

  return { ok: errors.length === 0, errors, evidence: validEvidence };
}

function yamlString(value = "") {
  return JSON.stringify(String(value));
}

export function renderPost(article, { date, evidence = [], imageUrl = "" } = {}) {
  const tags = [...new Set(article.tags.map(String).map((tag) => tag.trim()).filter(Boolean))];
  const references = evidence
    .map((entry) => `- [${entry.title || entry.source || entry.url}](${entry.url})`)
    .join("\n");
  const imageLine = imageUrl ? `image: ${yamlString(imageUrl)}\n` : "";

  return `---\ntitle: ${yamlString(article.title)}\npublished: ${date}\ncategory: ${yamlString(article.category)}\ntags: ${JSON.stringify(tags)}\ndraft: false\npinned: false\ncomment: true\ndescription: ${yamlString(article.description)}\n${imageLine}---\n\n${article.body.trim()}\n\n## 参考资料\n\n${references}\n`;
}

export function chooseOfficialImage(evidence = []) {
  for (const entry of evidence) {
    if (!entry.image || isCommunityUrl(entry.url)) continue;
    try {
      const image = new URL(entry.image);
      if (image.protocol === "https:") return image.toString();
    } catch {
      // Skip malformed or non-HTTPS images.
    }
  }
  return "";
}
