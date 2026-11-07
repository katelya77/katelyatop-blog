// Blog image mirroring through K-Vault, with opt-in rehosting permission.
// GitHub Actions secret KVAULT_API_TOKEN must never appear in logs or content.
import { createHash } from "node:crypto";

const MAX_BYTES = 8 * 1024 * 1024;
const MIMES = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
]);
const STORAGES = new Set(["r2", "telegram"]);

function kvaultOrigin(base) {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("K-Vault base URL must be a clean HTTPS origin");
  }
  return url;
}

export function mediaPolicy(env = process.env) {
  const base = String(env.KVAULT_BASE_URL || "https://pan.katelya.eu.org").trim().replace(/\/$/, "");
  const storage = String(env.BLOG_MEDIA_STORAGE || "r2").trim().toLowerCase();
  const folder = String(env.BLOG_MEDIA_FOLDER || "blog").trim();
  const hosts = String(env.BLOG_MEDIA_APPROVED_HOSTS || "")
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return {
    enabled: env.BLOG_MEDIA_UPLOAD_ENABLED === "true",
    base,
    storage,
    folder,
    hosts: new Set(hosts),
    deduplicate: env.BLOG_MEDIA_DEDUPLICATE === "true",
    token: String(env.KVAULT_API_TOKEN || "").trim(),
  };
}

function requireUploadPolicy(policy) {
  if (!policy.token) throw new Error("KVAULT_API_TOKEN is missing; configure an Actions secret");
  if (!STORAGES.has(policy.storage)) throw new Error("BLOG_MEDIA_STORAGE must be r2 or telegram");
  if (!/^blog(?:\/[a-z0-9][a-z0-9_-]*)*$/.test(policy.folder)) {
    throw new Error("BLOG_MEDIA_FOLDER must be blog or a safe subfolder of blog");
  }
  return kvaultOrigin(policy.base);
}

function publicFileUrl(download, endpoint) {
  if (typeof download !== "string" || !download) throw new Error("K-Vault returned no download link");
  const url = new URL(download, endpoint);
  if (url.protocol !== "https:" || url.origin !== endpoint.origin || url.username || url.password ||
      !url.pathname.startsWith("/file/") || url.search || url.hash) {
    throw new Error("K-Vault returned an unexpected public file URL");
  }
  return url.toString();
}

export async function fetchKVaultCapabilities({ env = process.env, fetchImpl = fetch } = {}) {
  const policy = mediaPolicy(env);
  const endpoint = kvaultOrigin(policy.base);
  if (!STORAGES.has(policy.storage)) throw new Error("BLOG_MEDIA_STORAGE must be r2 or telegram");
  const response = await fetchImpl(new URL("/api/v1/capabilities", endpoint), {
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok || response.status >= 300) throw new Error("K-Vault capabilities endpoint is unavailable");
  const payload = await response.json();
  const configured = payload?.data?.storages;
  if (payload?.success !== true || !Array.isArray(configured)) {
    throw new Error("K-Vault capabilities endpoint returned an invalid response");
  }
  return { configuredStorages: configured.filter((value) => STORAGES.has(value)), selected: policy.storage };
}

export async function uploadKVaultImage(bytes, mime, { env = process.env, fetchImpl = fetch } = {}) {
  const policy = mediaPolicy(env);
  const endpoint = requireUploadPolicy(policy);
  if (!MIMES.has(mime) || !(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    throw new Error("Image is empty, oversized or an unsupported MIME type");
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  const file = new File([bytes], "blog-" + digest.slice(0, 16) + MIMES.get(mime), { type: mime });
  const form = new FormData();
  form.set("file", file);
  form.set("storage", policy.storage);
  form.set("folderPath", policy.folder);
  // Cross-storage K-Vault deduplication may return an object from another
  // backend; opt in only after validating that behavior for the deployment.
  form.set("deduplicate", String(policy.deduplicate));
  const uploaded = await fetchImpl(new URL("/api/v1/upload", endpoint), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + policy.token,
      "Idempotency-Key": "blog-" + policy.storage + "-" + digest,
    },
    body: form,
    redirect: "manual",
    signal: AbortSignal.timeout(25000),
  });
  if (!uploaded.ok || uploaded.status >= 300) {
    throw new Error("K-Vault upload failed with HTTP " + uploaded.status);
  }
  let result;
  try { result = await uploaded.json(); } catch { throw new Error("K-Vault did not return JSON"); }
  if (result?.success === false) throw new Error("K-Vault reported an upload failure");
  if (result?.file?.storage && result.file.storage !== policy.storage) {
    throw new Error("K-Vault returned a file on an unexpected storage backend");
  }
  return publicFileUrl(result?.links?.download || result?.data?.links?.download, endpoint);
}

export async function mirrorApprovedImage(sourceUrl, { env = process.env, fetchImpl = fetch } = {}) {
  const policy = mediaPolicy(env);
  if (!policy.enabled || !sourceUrl) return sourceUrl || "";
  requireUploadPolicy(policy);
  if (!policy.hosts.size) throw new Error("K-Vault mirroring requires a licensed-source BLOG_MEDIA_APPROVED_HOSTS allowlist");
  const source = new URL(sourceUrl);
  if (source.protocol !== "https:" || source.username || source.password ||
      !policy.hosts.has(source.hostname.toLowerCase())) {
    throw new Error("Image source has not been approved for rehosting");
  }
  const downloaded = await fetchImpl(source.toString(), {
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
  if (!downloaded.ok || downloaded.status >= 300) throw new Error("Approved image source is unavailable");
  const mime = (downloaded.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const size = Number(downloaded.headers.get("content-length") || 0);
  if (!MIMES.has(mime) || !Number.isFinite(size) || size > MAX_BYTES) {
    throw new Error("Image has an unsupported MIME type or exceeds 8 MiB");
  }
  const reader = downloaded.body?.getReader();
  if (!reader) throw new Error("Approved image source has no body");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); throw new Error("Image exceeded 8 MiB while downloading"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!length) throw new Error("Approved image source is empty");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return uploadKVaultImage(bytes, mime, { env, fetchImpl });
}
