import { readFileSync } from "node:fs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function htmlText(value = "") {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "KatelyaProductionVerifier/1.0",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });
  return { response, body: await response.text() };
}

async function waitForPage({ url, title, attempts = 15, delayMs = 12_000 }) {
  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { response, body } = await fetchPage(url);
      lastStatus = response.status;
      if (response.ok && (!title || htmlText(body).includes(title))) {
        console.log(`Public page verified: ${url}`);
        return;
      }
    } catch (error) {
      lastError = error?.message || String(error);
      console.warn(`Public verification attempt ${attempt} failed for ${url}: ${lastError}`);
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  const detail = lastStatus ? `last HTTP ${lastStatus}` : `network error${lastError ? `: ${lastError}` : ""}`;
  throw new Error(`Public page did not become visible: ${url} (${detail})`);
}

async function waitForArticle({ url, title, attempts = 15, delayMs = 12_000 }) {
  return waitForPage({ url, title, attempts, delayMs });
}

export async function main() {
  const resultPath = process.env.CONTENT_RESULT_PATH;
  const siteUrl = String(process.env.SITE_URL || "https://blog.katelya.top").replace(/\/+$/, "");
  if (!resultPath) throw new Error("CONTENT_RESULT_PATH is required");
  const result = JSON.parse(readFileSync(resultPath, "utf8"));

  await waitForPage({ url: `${siteUrl}/`, attempts: 5, delayMs: 5_000 });

  for (const article of result.articles || []) {
    const url = `${siteUrl}/posts/${article.slug}/`;
    await waitForArticle({ url, title: article.title });
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
