import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import sharp from "sharp";

const DEFAULT_BASE_URL = "https://pan.katelya.eu.org";
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

function imageMime(extension) {
  return { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif" }[extension] || null;
}

export function validateKVaultOrigin(value = DEFAULT_BASE_URL) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("K-Vault origin must be a clean HTTPS URL");
  }
  return url.origin;
}

export function validateFolder(folder) {
  const value = String(folder || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  if (!value || value.length > 140 || value.split("/").some((part) => !/^[a-zA-Z0-9_-]{1,48}$/.test(part))) {
    throw new Error("Invalid image folder: use slash-separated ASCII names only");
  }
  return value;
}

export async function prepareBlogImage(filePath, { optimize = true } = {}) {
  const extension = extname(filePath).toLowerCase();
  const mime = imageMime(extension);
  if (!mime) throw new Error("Only JPEG, PNG, WebP, AVIF and GIF images may be uploaded");
  const original = await readFile(filePath);
  if (original.length === 0 || original.length > MAX_INPUT_BYTES) throw new Error("Image exceeds 20 MB input limit");
  const image = sharp(original, { failOn: "error", limitInputPixels: 60_000_000 });
  const meta = await image.metadata();
  if (!meta.width || !meta.height || !meta.format) throw new Error("Not a valid image");
  if (meta.format === "svg" || !["jpeg", "png", "webp", "avif", "gif"].includes(meta.format)) {
    throw new Error("Unsupported image encoding");
  }
  // Preserve GIF motion; converting multi-frame images to one WebP would silently
  // lose animation. All ordinary covers are resized to ≤1600px and stripped of EXIF.
  const preserveAnimation = meta.format === "gif";
  const bytes = optimize && !preserveAnimation
    ? await sharp(original, { failOn: "error", limitInputPixels: 60_000_000 })
        .rotate().resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 }).toBuffer()
    : original;
  if (bytes.length > MAX_OUTPUT_BYTES) throw new Error("Optimized image exceeds 10 MB upload limit");
  const outputMime = optimize && !preserveAnimation ? "image/webp" : mime;
  const originalName = basename(filePath, extension).replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) || "image";
  const filename = originalName + (outputMime === "image/webp" ? ".webp" : extension);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes, mime: outputMime, filename, sha256, width: meta.width, height: meta.height };
}

export async function uploadBlogImage({
  image, token, baseUrl = DEFAULT_BASE_URL, folder = "blog", fetchImpl = fetch,
}) {
  if (!token || !/^\S+$/.test(token)) throw new Error("KVAULT_API_TOKEN is required");
  const origin = validateKVaultOrigin(baseUrl);
  const folderPath = validateFolder(folder);
  const form = new FormData();
  form.append("file", new Blob([image.bytes], { type: image.mime }), image.filename);
  form.append("storage", "r2");
  form.append("folderPath", folderPath);
  form.append("deduplicate", "true");
  const response = await fetchImpl(origin + "/api/v1/upload", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Idempotency-Key": "blog-" + image.sha256.slice(0, 48),
    },
    body: form,
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error("K-Vault upload failed: HTTP " + response.status);
  const result = await response.json();
  const download = result?.links?.download;
  if (result?.success !== true || typeof download !== "string") {
    throw new Error("K-Vault upload response lacks a public download link");
  }
  const link = new URL(download);
  if (link.origin !== origin || !link.pathname.startsWith("/file/") || link.username || link.password || link.hash) {
    throw new Error("K-Vault returned an unexpected public link");
  }
  return { url: link.toString(), fileId: result.file?.id || "", deduplicated: Boolean(result.deduplicated) };
}

export function markdownImage(url, alt) {
  const safeAlt = String(alt || "博客配图").replace(/[\]\[]/g, "").trim();
  return `![${safeAlt}](${url})`;
}
