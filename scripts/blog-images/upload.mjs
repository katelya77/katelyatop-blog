import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkKVaultReadiness, markdownImage, prepareBlogImage, uploadBlogImage, validateFolder } from "./kvault.mjs";

export function argumentsFrom(argv) {
  // Accept both "pnpm images:upload -- ./file.png" and direct node invocation.
  const args = argv.slice(2).filter((value, index) => !(index === 0 && value === "--"));
  let filePath;
  let folder;
  let alt;
  let dryRun = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--folder" || value === "--alt") {
      if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(value + " requires a value");
      if (value === "--folder") folder = args[++index];
      else alt = args[++index];
    } else if (value === "--dry-run") dryRun = true;
    else if (!value.startsWith("--") && !filePath) filePath = value;
  }
  return { filePath, folder, alt, dryRun };
}

export async function main(argv = process.argv) {
  if (argv.includes("--check")) {
    const status = await checkKVaultReadiness({ baseUrl: process.env.KVAULT_BASE_URL || "https://pan.katelya.eu.org" });
    console.log("K-Vault R2 ready: " + status.origin);
    return;
  }
  const options = argumentsFrom(argv);
  if (!options.filePath || options.filePath.startsWith("--")) {
    throw new Error("Usage: pnpm images:upload -- ./cover.png [--folder blog/2026/11] [--alt caption] [--dry-run]");
  }
  const date = new Date();
  const folder = validateFolder(options.folder || `blog/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  const image = await prepareBlogImage(resolve(options.filePath));
  if (options.dryRun) {
    console.log(JSON.stringify({ folder, name: image.filename, bytes: image.bytes.length, optimized: true }, null, 2));
    return;
  }
  const result = await uploadBlogImage({
    image,
    token: process.env.KVAULT_API_TOKEN,
    baseUrl: process.env.KVAULT_BASE_URL || "https://pan.katelya.eu.org",
    folder,
  });
  // Print no token, admin links or delete URLs; stdout is safe to paste into a post.
  console.log(markdownImage(result.url, options.alt || image.filename));
  console.log("Image URL: " + result.url);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
