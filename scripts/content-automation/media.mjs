// Optional, permission-gated mirror for editorial images into the existing K-Vault.
// Never publish an unverified upload URL or expose upload credentials to the client.
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

export function mediaPolicy(env = process.env) {
  const base = String(env.KVAULT_BASE_URL || "https://pan.katelya.eu.org").replace(/\/$/, "");
  const hosts = String(env.BLOG_MEDIA_APPROVED_HOSTS || "")
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return {
    enabled: env.BLOG_MEDIA_UPLOAD_ENABLED === "true",
    base,
    hosts: new Set(hosts),
    token: String(env.KVAULT_API_TOKEN || "").trim(),
  };
}

export async function mirrorApprovedImage(sourceUrl, { env = process.env, fetchImpl = fetch } = {}) {
  const policy = mediaPolicy(env);
  if (!policy.enabled || !sourceUrl) return sourceUrl || "";
  if (!policy.token) throw new Error("K-Vault upload is enabled but KVAULT_API_TOKEN is unavailable");
  if (!policy.hosts.size) throw new Error("K-Vault upload requires BLOG_MEDIA_APPROVED_HOSTS (licensed sources)");
  const source = new URL(sourceUrl);
  if (source.protocol !== "https:" || !policy.hosts.has(source.hostname.toLowerCase())) {
    throw new Error("Image source has not been approved for rehosting");
  }
  const endpoint = new URL(policy.base);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) {
    throw new Error("K-Vault endpoint must be an HTTPS domain without embedded credentials");
  }
  const downloaded = await fetchImpl(source.toString(), {
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
  if (!downloaded.ok || (downloaded.status >= 300 && downloaded.status < 400)) {
    throw new Error("Licensed source image could not be fetched safely");
  }
  const mime = (downloaded.headers.get("content-type") || "").split(";")[0].toLowerCase().trim();
  const declaredSize = Number(downloaded.headers.get("content-length") || 0);
  if (!ALLOWED_MIME.has(mime) || declaredSize > DEFAULT_MAX_BYTES) {
    throw new Error("Image has an unsupported MIME type or exceeds 8 MiB");
  }
  // Bounded streaming protects the publisher against misreported Content-Length.
  const stream = downloaded.body;
  if (!stream) throw new Error("Image response is empty");
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > DEFAULT_MAX_BYTES) throw new Error("Image exceeds the configured size budget");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!length) throw new Error("Image response is empty");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const extension = new Map([
    ["image/png", ".png"], ["image/jpeg", ".jpg"],
    ["image/webp", ".webp"], ["image/gif", ".gif"], ["image/avif", ".avif"],
  ]).get(mime);
  const file = new File([bytes], "blog-editorial" + extension, { type: mime });
  const form = new FormData();
  form.set("file", file);
  const uploadUrl = new URL("/api/v1/upload", endpoint);
  const uploaded = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: { Authorization: "Bearer " + policy.token },
    body: form,
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  if (!uploaded.ok || (uploaded.status >= 300 && uploaded.status < 400)) {
    throw new Error("K-Vault rejected the approved image upload (HTTP " + uploaded.status + ")");
  }
  const response = await uploaded.json();
  const download = response?.links?.download || response?.data?.links?.download || response?.result?.links?.download;
  if (typeof download !== "string" || !download) throw new Error("K-Vault response has no file download link");
  const publicUrl = new URL(download, endpoint);
  if (publicUrl.protocol !== "https:" || publicUrl.origin !== endpoint.origin) {
    throw new Error("K-Vault returned an unexpected download origin");
  }
  return publicUrl.toString();
}
