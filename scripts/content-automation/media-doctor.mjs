// Explicit, harmless-by-default deployment verification.
// node scripts/content-automation/media-doctor.mjs [--smoke]
// --smoke uploads ONE tiny test image to the selected r2/telegram backend.
import { mediaPolicy, fetchKVaultCapabilities, uploadKVaultImage } from "./media.mjs";

const smoke = process.argv.includes("--smoke");
const policy = mediaPolicy();
const capabilities = await fetchKVaultCapabilities();
console.log("K-Vault reachable; available blog backends: " + (capabilities.configuredStorages.join(", ") || "none"));
console.log("Requested storage: " + capabilities.selected);
if (!capabilities.configuredStorages.includes(capabilities.selected)) {
  throw new Error("Requested storage not configured in K-Vault; check the K-Vault dashboard/Pages bindings");
}
if (!smoke) {
  console.log("Read-only media preflight passed; no files uploaded");
  process.exit(0);
}
if (!policy.token) throw new Error("KVAULT_API_TOKEN Actions Secret is missing");

// A minimal 1x1 PNG stored only for explicit integration testing.
const png = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/K5kAAAAASUVORK5CYII=",
  "base64",
));
const downloadUrl = await uploadKVaultImage(png, "image/png");
const download = await fetch(downloadUrl, {
  redirect: "follow",
  signal: AbortSignal.timeout(15000),
  headers: { Range: "bytes=0-1023" },
});
const mime = String(download.headers.get("content-type") || "").split(";")[0].toLowerCase();
if (!download.ok || mime !== "image/png") {
  await download.body?.cancel();
  throw new Error("Public image readback failed: K-Vault did not serve a PNG");
}
await download.body?.cancel();
console.log("K-Vault " + capabilities.selected + " upload and public image readback passed");
console.log("Sample URL: " + downloadUrl);
