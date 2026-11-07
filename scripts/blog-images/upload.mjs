import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { markdownImage, prepareBlogImage, uploadBlogImage, validateFolder } from "./kvault.mjs";

function argumentsFrom(argv) {
  const args = argv.slice(2);
  const filePath = args.find((v) => !v.startsWith("--") && !args[args.indexOf(v) - 1]?.startsWith("--"));
  const option = (name) => {
    const pos = args.indexOf(name);
    return pos >= 0 ? args[pos + 1] : undefined;
  };
  return { filePath: filePath || args[0], folder: option("--folder"), alt: option("--alt"), dryRun: args.includes("--dry-run") };
}

export async function main(argv = process.argv) {
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
