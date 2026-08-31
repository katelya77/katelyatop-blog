import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildResearchBundle, discoverCandidates } from "./sources.mjs";
import {
  chinaDate,
  chooseOfficialImage,
  countPublishedForDate,
  listExistingPosts,
  renderPost,
  validateArticle,
} from "./quality.mjs";

const MODELS_ORIGIN = "https://models.github.ai";
const POSTS_DIR = "src/content/posts";
const MAX_MODEL_ATTEMPTS = 3;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

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
      const detail = payload?.message || payload?.error?.message || `HTTP ${response.status}`;
      if (!retryable) throw new Error(detail);
      lastError = new Error(detail);
    } catch (error) {
      lastError = error;
    }
    await sleep(1_500 * (attempt + 1));
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

async function resolveModel(token) {
  const configured = String(process.env.CONTENT_MODEL || "").trim();
  const preferred = [configured, "openai/gpt-4.1", "openai/gpt-4o"].filter(Boolean);
  try {
    const catalog = await fetchJson(`${MODELS_ORIGIN}/catalog/models`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
    }, 2);
    const ids = (Array.isArray(catalog) ? catalog : catalog?.models || [])
      .map((model) => model?.id || model?.name)
      .filter(Boolean);
    for (const candidate of preferred) if (ids.includes(candidate)) return candidate;
    const openAi = ids.find((id) => /^openai\//.test(id) && /(gpt-5|gpt-4\.1|gpt-4o)/i.test(id));
    if (openAi) return openAi;
    if (ids[0]) return ids[0];
  } catch (error) {
    console.warn(`GitHub Models catalog unavailable: ${error?.message || error}`);
  }
  return preferred[0] || "openai/gpt-4.1";
}

function stripJsonFence(value = "") {
  const text = String(value).trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : text;
}

async function callModel({ token, model, messages }) {
  const payload = await fetchJson(`${MODELS_ORIGIN}/inference/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2026-03-10",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 7_500,
    }),
  });
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`GitHub Models returned no content for ${model}`);
  return JSON.parse(stripJsonFence(content));
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

最近已经发布的文章标题，禁止重复选题：
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

async function generateOne({ token, model, date, entries, existingPosts }) {
  let previousErrors = [];
  for (let attempt = 1; attempt <= MAX_MODEL_ATTEMPTS; attempt += 1) {
    const article = await callModel({
      token,
      model,
      messages: [
        {
          role: "system",
          content: "You are a rigorous Chinese technical editor. Use only supplied research evidence for factual claims. Return valid JSON only.",
        },
        {
          role: "user",
          content: editorialPrompt({ date, entries, existingPosts, previousErrors }),
        },
      ],
    });
    const validation = validateArticle(article, { researchEntries: entries, existingPosts });
    const filePath = join(POSTS_DIR, `${article.slug}.md`);
    if (existsSync(filePath)) validation.errors.push(`slug already exists: ${article.slug}`);
    if (validation.errors.length === 0) {
      return { article, validation };
    }
    previousErrors = validation.errors;
    console.warn(`Generated article failed quality gate (attempt ${attempt}): ${previousErrors.join("; ")}`);
  }
  throw new Error(`Unable to generate an article that passes quality gates: ${previousErrors.join("; ")}`);
}

function writeResult(resultPath, payload) {
  if (!resultPath) return;
  mkdirSync(new URL(".", `file://${resultPath}`).pathname, { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function main() {
  const token = requireEnv("GITHUB_TOKEN");
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

  const model = await resolveModel(token);
  console.log(`Using GitHub Models model: ${model}`);
  const created = [];
  const mutablePosts = [...existingPosts];

  for (let index = 0; index < missingCount; index += 1) {
    const { article, validation } = await generateOne({ token, model, date, entries, existingPosts: mutablePosts });
    const imageUrl = chooseOfficialImage(validation.evidence);
    const content = renderPost(article, { date, evidence: validation.evidence, imageUrl });
    const filePath = join(POSTS_DIR, `${article.slug}.md`).replaceAll("\\", "/");
    writeFileSync(filePath, content, "utf8");
    created.push({
      file: filePath,
      title: article.title,
      slug: article.slug,
      category: article.category,
      imageUrl,
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
    model,
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
