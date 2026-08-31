import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { buildResearchBundle, discoverCandidates } from "./sources.mjs";
import {
  chinaDate,
  chooseOfficialImage,
  countPublishedForDate,
  evidenceRootId,
  listExistingPosts,
  renderPost,
  validateArticle,
} from "./quality.mjs";

const POSTS_DIR = "src/content/posts";
const MAX_MODEL_ATTEMPTS = 3;
const DEFAULT_CF_MODEL = "@cf/zai-org/glm-4.7-flash";

function intEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, init = {}, retries = 3) {
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (response.ok) return payload;
      const retryable = response.status === 429 || response.status >= 500;
      const detail = payload?.errors?.[0]?.message || payload?.message || payload?.error?.message || `HTTP ${response.status}`;
      if (!retryable) throw new Error(detail);
      lastError = new Error(detail);
    } catch (error) {
      lastError = error;
    }
    await sleep(1_500 * (attempt + 1));
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

function stripJsonFence(value = "") {
  const text = String(value).trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : text;
}

function parseGeneratedJson(rawOutput, provider) {
  const cleaned = stripJsonFence(rawOutput);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        // Fall through to a provider-specific parse error.
      }
    }
    throw new Error(`${provider} returned invalid JSON: ${error?.message || error}`);
  }
}

function copilotArgs(prompt) {
  const args = ["-p", prompt, "-s", "--no-ask-user"];
  const model = String(process.env.CONTENT_MODEL || "").trim();
  if (model) args.push("--model", model);
  return args;
}

function callCopilot(prompt) {
  if (!process.env.GITHUB_TOKEN && !process.env.COPILOT_GITHUB_TOKEN) {
    throw new Error("Copilot provider unavailable: missing GITHUB_TOKEN/COPILOT_GITHUB_TOKEN");
  }
  const output = execFileSync("copilot", copilotArgs(prompt), {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 12 * 1024 * 1024,
    timeout: 8 * 60 * 1000,
  });
  if (!String(output).trim()) throw new Error("Copilot CLI returned empty output");
  return parseGeneratedJson(output, "GitHub Copilot CLI");
}

function validateCloudflareModel(model) {
  if (!/^@cf\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(model)) {
    throw new Error(`Invalid Cloudflare Workers AI model identifier: ${model}`);
  }
  return model;
}

async function callCloudflare(prompt) {
  const accountId = String(process.env.CF_ACCOUNT_ID || "").trim();
  const apiToken = String(process.env.CF_API_TOKEN || "").trim();
  if (!accountId || !apiToken) {
    throw new Error("Workers AI fallback unavailable: missing CF_ACCOUNT_ID/CF_API_TOKEN");
  }
  const model = validateCloudflareModel(String(process.env.CF_CONTENT_MODEL || DEFAULT_CF_MODEL).trim());
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`;
  const payload = await fetchJson(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: "You are a rigorous Chinese technical editor. Use only supplied research evidence for factual claims. Return valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 7_500,
      temperature: 0.35,
    }),
  });
  const content = payload?.result?.response
    || payload?.result?.choices?.[0]?.message?.content
    || payload?.result?.output_text;
  if (!content) throw new Error(`Cloudflare Workers AI returned no text for ${model}`);
  return { article: parseGeneratedJson(content, `Cloudflare Workers AI ${model}`), model };
}

async function callGenerator(prompt) {
  const errors = [];
  try {
    const article = callCopilot(prompt);
    return { article, provider: "github-copilot", model: String(process.env.CONTENT_MODEL || "default").trim() || "default" };
  } catch (error) {
    errors.push(`Copilot: ${error?.message || error}`);
    console.warn(`Copilot generation failed; trying Workers AI fallback: ${error?.message || error}`);
  }

  try {
    const fallback = await callCloudflare(prompt);
    return { article: fallback.article, provider: "cloudflare-workers-ai", model: fallback.model };
  } catch (error) {
    errors.push(`Workers AI: ${error?.message || error}`);
  }

  throw new Error(`No AI generation provider succeeded. ${errors.join(" | ")}`);
}

function researchText(entries) {
  let total = 0;
  const chunks = [];
  for (const entry of entries.slice(0, 18)) {
    const text = String(entry.text || "").slice(0, 3_200);
    const chunk = [
      `[${entry.id}] kind=${entry.kind} source=${entry.source}`,
      `title=${entry.title}`,
      `url=${entry.url}`,
      `content=${text}`,
    ].join("\n");
    if (total + chunk.length > 30_000) break;
    total += chunk.length;
    chunks.push(chunk);
  }
  return chunks.join("\n\n");
}

function recentTitleList(posts) {
  return posts
    .slice()
    .sort((a, b) => String(b.published).localeCompare(String(a.published)))
    .slice(0, 40)
    .map((post) => `- ${post.title}`)
    .join("\n");
}

function editorialPrompt({ date, entries, existingPosts, previousErrors = [] }) {
  const errorText = previousErrors.length > 0
    ? `\n上一版未通过质量门槛，请修正：\n${previousErrors.map((error) => `- ${error}`).join("\n")}\n`
    : "";
  return `你是 Katelya · 思囿随笔的技术编辑。今天是 ${date}（Asia/Shanghai）。

你的任务：从下面的真实检索材料中选择一个信息密度最高、与近期博客不重复的主题，写成一篇中文原创技术博客。LINUX DO / NodeLoc 只能作为选题雷达与真实问题样本；涉及版本、发布、架构、API、性能、安全等事实时，必须以材料中的官方文档、项目仓库、Release、厂商博客等一手来源为依据。材料不足的事实不要写。

编辑标准：
1. 文章正文 2500-6000 中文字符，至少 4 个二级标题。
2. 不是“新闻摘要 + 参数表 + 泛泛感想”，必须至少覆盖三类价值：原理/架构、可复现命令配置或检查清单、验证方式、失败边界、工程取舍、原创结论。
3. 不得声称“我亲测/我实测/我已经部署”之类未在材料中证明的个人经历。
4. 不逐段改写社区原文，不大段引用；重新建立文章结构和论证。
5. 如果主题属于传闻、预览或社区发现，明确标注证据等级，不得写成官方正式发布。
6. 正文不要写“参考资料”章节，程序会根据 evidenceIds 自动附加已核验链接。
7. slug 使用 3-12 个英文单词的 lowercase-kebab-case。
8. evidenceIds 至少选择 2 个材料 ID，并且至少一个应为 primary 或非社区来源；只能填写下面真实存在的 ID。
9. category 从 AI前沿、技术实践、DevOps、网络、开源、工程札记 中选择最贴切的一项。
10. tags 4-10 个，避免堆砌。

最近已经发布或在本批次生成的文章标题，禁止重复选题：
${recentTitleList(existingPosts) || "（暂无）"}
${errorText}
研究材料：
${researchText(entries)}

只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要额外解释。结构必须严格为：
{
  "title": "文章标题",
  "slug": "lowercase-kebab-case",
  "category": "AI前沿",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "description": "40-220 字摘要",
  "evidenceIds": ["S1", "S2"],
  "body": "完整 Markdown 正文"
}`;
}

async function generateOne({ date, entries, existingPosts, forbiddenEvidenceRootIds = new Set() }) {
  let previousErrors = [];
  let providerMeta = null;
  const availableEntries = entries.filter(
    (entry) => !forbiddenEvidenceRootIds.has(evidenceRootId(entry)),
  );
  if (availableEntries.length < 2 || !availableEntries.some((entry) => entry.kind === "primary")) {
    throw new Error("Not enough distinct research evidence remains for another article in this batch");
  }

  for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt += 1) {
    let article;
    try {
      const generated = await callGenerator(
        editorialPrompt({ date, entries: availableEntries, existingPosts, previousErrors }),
      );
      article = generated.article;
      providerMeta = { provider: generated.provider, model: generated.model };
    } catch (error) {
      previousErrors = [`generation provider failure: ${error?.message || error}`];
      console.warn(`Generation attempt ${attempt} failed: ${previousErrors[0]}`);
      continue;
    }

    const validation = validateArticle(article, {
      researchEntries: entries,
      existingPosts,
      forbiddenEvidenceRootIds,
    });
    const filePath = join(POSTS_DIR, `${article.slug || "invalid-slug"}.md`);
    if (article.slug && existsSync(filePath)) validation.errors.push(`slug already exists: ${article.slug}`);
    if (validation.errors.length === 0) {
      return { article, validation, providerMeta };
    }
    previousErrors = validation.errors;
    console.warn(`Generated article failed quality gate (attempt ${attempt}): ${previousErrors.join("; ")}`);
  }
  throw new Error(`Unable to generate an article that passes quality gates: ${previousErrors.join("; ")}`);
}

function writeResult(resultPath, payload) {
  if (!resultPath) return;
  mkdirSync(dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function main() {
  const targetDailyCount = Math.max(1, Math.min(4, intEnv("TARGET_DAILY_COUNT", 1)));
  const resultPath = process.env.CONTENT_RESULT_PATH || "";
  const date = chinaDate();
  const existingPosts = listExistingPosts();
  const currentCount = countPublishedForDate(existingPosts, date);
  const missingCount = Math.max(0, targetDailyCount - currentCount);

  if (missingCount === 0) {
    const result = { date, targetDailyCount, currentCount, createdCount: 0, files: [], titles: [], skipped: true };
    writeResult(resultPath, result);
    console.log(`Daily target already satisfied: ${currentCount}/${targetDailyCount}`);
    return result;
  }

  const candidates = await discoverCandidates({ maxAgeHours: 96, limit: 28 });
  if (candidates.length < 3) {
    throw new Error(`Not enough live research candidates: ${candidates.length}`);
  }
  const entries = await buildResearchBundle(candidates, { maxCandidates: 10, maxPrimaryLinks: 3 });
  if (entries.length < 4 || !entries.some((entry) => entry.kind === "primary")) {
    throw new Error(`Research bundle is too weak for publication: ${entries.length} entries`);
  }

  const created = [];
  const mutablePosts = [...existingPosts];
  const usedEvidenceRootIds = new Set();

  for (let index = 0; index < missingCount; index += 1) {
    const { article, validation, providerMeta } = await generateOne({
      date,
      entries,
      existingPosts: mutablePosts,
      forbiddenEvidenceRootIds: usedEvidenceRootIds,
    });
    const imageUrl = chooseOfficialImage(validation.evidence);
    const content = renderPost(article, { date, evidence: validation.evidence, imageUrl });
    const filePath = join(POSTS_DIR, `${article.slug}.md`).replaceAll("\\", "/");
    writeFileSync(filePath, content, "utf8");
    for (const evidence of validation.evidence) {
      const rootId = evidenceRootId(evidence);
      if (rootId) usedEvidenceRootIds.add(rootId);
    }
    created.push({
      file: filePath,
      title: article.title,
      slug: article.slug,
      category: article.category,
      imageUrl,
      provider: providerMeta?.provider || "unknown",
      model: providerMeta?.model || "unknown",
      evidence: validation.evidence.map((entry) => ({ id: entry.id, title: entry.title, url: entry.url, kind: entry.kind })),
    });
    mutablePosts.push({ path: filePath, title: article.title, published: date, draft: false });
  }

  const result = {
    date,
    targetDailyCount,
    currentCount,
    createdCount: created.length,
    files: created.map((item) => item.file),
    titles: created.map((item) => item.title),
    articles: created,
    skipped: false,
  };
  writeResult(resultPath, result);
  console.log(`Generated ${created.length} article(s): ${created.map((item) => item.title).join(" | ")}`);
  return result;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
