import assert from "node:assert/strict";
import test from "node:test";
import { markdownImage, uploadBlogImage, validateFolder, validateKVaultOrigin } from "../scripts/blog-images/kvault.mjs";

const image = {
  bytes: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
  mime: "image/webp",
  filename: "cover.webp",
  sha256: "a".repeat(64),
};

test("accepts only clean HTTPS upload origin and a safe R2 folder prefix", () => {
  assert.equal(validateKVaultOrigin("https://pan.katelya.eu.org/"), "https://pan.katelya.eu.org");
  assert.equal(validateFolder("blog/2026/11"), "blog/2026/11");
  assert.throws(() => validateKVaultOrigin("http://pan.katelya.eu.org"));
  assert.throws(() => validateFolder("../private"));
});

test("uploads to K-Vault API with R2 backend without exposing the bearer token in the result", async () => {
  let invoked = false;
  const fetchImpl = async (url, init) => {
    invoked = true;
    assert.equal(url, "https://pan.katelya.eu.org/api/v1/upload");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer private-token");
    assert.equal(init.body.get("storage"), "r2");
    assert.equal(init.body.get("folderPath"), "blog/2026/11");
    assert.equal(init.body.get("deduplicate"), "true");
    return {
      ok: true,
      json: async () => ({ success: true, file: { id: "r2:test" }, links: { download: "https://pan.katelya.eu.org/file/r2%3Atest" } }),
    };
  };
  const result = await uploadBlogImage({ image, token: "private-token", folder: "blog/2026/11", fetchImpl });
  assert.equal(invoked, true);
  assert.equal(result.url, "https://pan.katelya.eu.org/file/r2%3Atest");
  assert.equal(markdownImage(result.url, "原创封面").startsWith("![原创封面]("), true);
  assert.equal(JSON.stringify(result).includes("private-token"), false);
});

test("rejects a successful-looking response pointing at a non-owner host", async () => {
  await assert.rejects(
    uploadBlogImage({
      image, token: "private-token",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ success: true, links: { download: "https://evil.example/file/x" } }),
      }),
    }),
    /unexpected public link/,
  );
});
