const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_EXCERPT_CHARS = 5_000;

const SOURCE_ENDPOINTS = [
  { name: "LINUX DO latest", kind: "discourse", origin: "https://linux.do", url: "https://linux.do/latest.json", weight: 1.2 },
  { name: "LINUX DO top", kind: "discourse", origin: "https://linux.do", url: "https://linux.do/top.json?period=daily", weight: 1.35 },
  { name: "LINUX DO latest RSS", kind: "feed", sourceKind: "community", url: "https://linux.do/latest.rss", weight: 1.15 },
  { name: "LINUX DO top RSS", kind: "feed", sourceKind: "community", url: "https://linux.do/top.rss?period=daily", weight: 1.3 },
  { name: "NodeLoc latest", kind: "discourse", origin: "https://www.nodeloc.com", url: "https://www.nodeloc.com/latest.json", weight: 1.05 },
  { name: "NodeLoc top", kind: "discourse", origin: "https://www.nodeloc.com", url: "https://www.nodeloc.com/top.json?period=daily", weight: 1.2 },
  { name: "NodeLoc latest RSS", kind: "feed", sourceKind: "community", url: "https://www.nodeloc.com/latest.rss", weight: 1 },
  { name: "NodeLoc top RSS", kind: "feed", sourceKind: "community", url: "https://www.nodeloc.com/top.rss?period=daily", weight: 1.15 },
  { name: "Cloudflare Blog", kind: "feed", url: "https://blog.cloudflare.com/rss/", weight: 1.3 },
  { name: "vLLM Releases", kind: "feed", url: "https://github.com/vllm-project/vllm/releases.atom", weight: 1.3 },
  { name: "SGLang Releases", kind: "feed", url: "https://github.com/sgl-project/sglang/releases.atom", weight: 1.3 },
  { name: "Qwen3 Releases", kind: "feed", url: "https://github.com/QwenLM/Qwen3/releases.atom", weight: 1.25 },
];

const COMMUNITY_HOSTS = new Set(["linux.do", "www.nodeloc.com", "nodeloc.com"]);

export function stripHtml(value = "") {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value = "") {
  return stripHtml(value)
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .slice(0, 160);
}

function clampText(value = "", max = MAX_EXCERPT_CHARS) {
  const text = stripHtml(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function parseDate(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function recencyScore(publishedAt, nowMs, maxAgeHours) {
  if (!publishedAt) return 0.2;
  const ageHours = Math.max(0, (nowMs - publishedAt) / 3_600_000);
  if (ageHours > maxAgeHours) return 0;
  return Math.max(0.1, 1 - ageHours / maxAgeHours);
}

async function fetchWithTimeout(url, { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "KatelyaBlogResearchBot/1.0 (+https://blog.katelya.top)",
        Accept: "text/html,application/json,application/atom+xml,application/rss+xml;q=0.9,*/*;q=0.8",
        ...headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function topicUrl(origin, topic) {
  const slug = topic.slug ? `/${topic.slug}` : "";
  return `${origin}/t${slug}/${topic.id}`;
}

function discourseDetailUrl(origin, topic) {
  return `${origin}/t/${topic.id}.json`;
}

function parseDiscourse(payload, source, nowMs, maxAgeHours) {
  const topics = Array.isArray(payload?.topic_list?.topics) ? payload.topic_list.topics : [];
  return topics
    .map((topic) => {
      const publishedAt = parseDate(topic.created_at || topic.last_posted_at);
      const recent = recencyScore(publishedAt, nowMs, maxAgeHours);
      if (recent <= 0) return null;
      const views = Number(topic.views || 0);
      const replies = Math.max(0, Number(topic.posts_count || 1) - 1);
      const likes = Number(topic.like_count || 0);
      const engagement = Math.log10(views + 10) + Math.log10(replies * 12 + likes * 8 + 10);
      return {
        title: stripHtml(topic.title || topic.fancy_title || ""),
        url: topicUrl(source.origin, topic),
        detailUrl: discourseDetailUrl(source.origin, topic),
        detailMode: "discourse-json",
        source: source.name,
        sourceKind: "community",
        publishedAt,
        score: source.weight * (recent * 2 + engagement),
        tags: Array.isArray(topic.tags) ? topic.tags.map(String) : [],
      };
    })
    .filter((item) => item?.title && item.url);
}

function readTag(block, names) {
  for (const name of names) {
    const paired = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
    if (paired?.[1]) return stripHtml(paired[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
    const href = block.match(new RegExp(`<${name}[^>]+href=["']([^"']+)["'][^>]*>`, "i"));
    if (href?.[1]) return href[1];
  }
  return "";
}

function parseFeed(xml, source, nowMs, maxAgeHours) {
  const blocks = [
    ...(String(xml).match(/<item\b[\s\S]*?<\/item>/gi) || []),
    ...(String(xml).match(/<entry\b[\s\S]*?<\/entry>/gi) || []),
  ];
  return blocks
    .map((block, index) => {
      const title = readTag(block, ["title"]);
      const url = readTag(block, ["link"]);
      const dateText = readTag(block, ["pubDate", "published", "updated"]);
      const publishedAt = parseDate(dateText);
      const recent = recencyScore(publishedAt, nowMs, maxAgeHours);
      if (!title || !url || recent <= 0) return null;
      return {
        title,
        url,
        detailUrl: url,
        detailMode: "page",
        source: source.name,
        sourceKind: source.sourceKind || "primary",
        publishedAt,
        score: source.weight * (recent * 3 + Math.max(0, 1 - index * 0.03)),
        tags: [],
      };
    })
    .filter(Boolean);
}

export function dedupeCandidates(candidates = []) {
  const seenTitle = new Set();
  const seenUrl = new Set();
  const output = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    const titleKey = normalizeTitle(candidate.title);
    const urlKey = String(candidate.url || "").replace(/\/$/, "");
    if (!titleKey || seenTitle.has(titleKey) || seenUrl.has(urlKey)) continue;
    seenTitle.add(titleKey);
    seenUrl.add(urlKey);
    output.push(candidate);
  }
  return output;
}

export async function discoverCandidates({
  fetchImpl = fetch,
  now = Date.now(),
  maxAgeHours = 96,
  limit = 24,
} = {}) {
  const discovered = [];
  for (const source of SOURCE_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(source.url, { fetchImpl });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (source.kind === "discourse") {
        const payload = await response.json();
        discovered.push(...parseDiscourse(payload, source, now, maxAgeHours));
      } else {
        const xml = await response.text();
        discovered.push(...parseFeed(xml, source, now, maxAgeHours));
      }
    } catch (error) {
      console.warn(`Source unavailable: ${source.name}: ${error?.message || error}`);
    }
  }
  return dedupeCandidates(discovered).slice(0, limit);
}

function extractLinks(html = "", baseUrl = "") {
  const links = [];
  const seen = new Set();
  for (const match of String(html).matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(match[1], baseUrl);
      if (url.protocol !== "https:") continue;
      url.hash = "";
      const normalized = url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      links.push(normalized);
    } catch {
      // Ignore malformed links from community HTML.
    }
  }
  return links;
}

function extractOgImage(html = "", baseUrl = "") {
  const match = String(html).match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || String(html).match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["'][^>]*>/i);
  if (!match?.[1]) return "";
  try {
    return new URL(match[1], baseUrl).toString();
  } catch {
    return "";
  }
}

function isUsefulExternal(url, communityUrl) {
  try {
    const target = new URL(url);
    const origin = new URL(communityUrl);
    if (target.hostname === origin.hostname) return false;
    if (COMMUNITY_HOSTS.has(target.hostname)) return false;
    if (["t.me", "telegram.me", "x.com", "twitter.com"].includes(target.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function loadPage(url, fetchImpl) {
  const response = await fetchWithTimeout(url, { fetchImpl });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return { text: clampText(JSON.stringify(payload)), html: "", payload };
  }
  const html = await response.text();
  return { text: clampText(html), html, payload: null };
}

export async function buildResearchBundle(candidates, { fetchImpl = fetch, maxCandidates = 8, maxPrimaryLinks = 2 } = {}) {
  const entries = [];
  let sequence = 1;

  for (const candidate of candidates.slice(0, maxCandidates)) {
    let detailText = "";
    let rawHtml = "";
    let links = [];
    let image = "";

    try {
      if (candidate.detailMode === "discourse-json" && candidate.detailUrl) {
        const response = await fetchWithTimeout(candidate.detailUrl, { fetchImpl });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const first = payload?.post_stream?.posts?.[0];
        rawHtml = String(first?.cooked || "");
        detailText = clampText(rawHtml || first?.raw || candidate.title);
        links = extractLinks(rawHtml, candidate.url);
      } else {
        const page = await loadPage(candidate.detailUrl || candidate.url, fetchImpl);
        detailText = page.text || candidate.title;
        rawHtml = page.html;
        links = extractLinks(rawHtml, candidate.url);
        image = extractOgImage(rawHtml, candidate.url);
      }
    } catch (error) {
      console.warn(`Research fetch failed: ${candidate.url}: ${error?.message || error}`);
      detailText = candidate.title;
    }

    const parentId = `S${sequence++}`;
    entries.push({
      id: parentId,
      kind: candidate.sourceKind,
      title: candidate.title,
      url: candidate.url,
      source: candidate.source,
      text: detailText,
      image,
      score: candidate.score,
    });

    const primaryLinks = links.filter((url) => isUsefulExternal(url, candidate.url)).slice(0, maxPrimaryLinks);
    for (const url of primaryLinks) {
      try {
        const page = await loadPage(url, fetchImpl);
        entries.push({
          id: `S${sequence++}`,
          kind: "primary",
          title: new URL(url).hostname,
          url,
          source: new URL(url).hostname,
          text: page.text,
          image: extractOgImage(page.html, url),
          score: candidate.score + 0.5,
          parentId,
        });
      } catch (error) {
        console.warn(`Primary source fetch failed: ${url}: ${error?.message || error}`);
      }
    }
  }

  return entries;
}

export function isCommunityUrl(url) {
  try {
    return COMMUNITY_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
