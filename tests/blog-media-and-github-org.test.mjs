import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mediaPolicy, mirrorApprovedImage } from "../scripts/content-automation/media.mjs";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("unconfigured media uploads leave existing source URLs unchanged", async () => {
  assert.equal(mediaPolicy({}).enabled, false);
  assert.equal(await mirrorApprovedImage("https://docs.example.org/cover.webp", { env: {} }), "https://docs.example.org/cover.webp");
});

test("media mirroring rejects unapproved sources and missing credentials without network requests", async () => {
  const env = { BLOG_MEDIA_UPLOAD_ENABLED: "true", BLOG_MEDIA_APPROVED_HOSTS: "docs.example.org", KVAULT_API_TOKEN: "test-token" };
  let called = false;
  const fetchImpl = async () => { called = true; throw new Error("unexpected"); };
  await assert.rejects(mirrorApprovedImage("https://unapproved.example.org/img.png", { env, fetchImpl }), /not been approved/);
  assert.equal(called, false);
  await assert.rejects(mirrorApprovedImage("https://docs.example.org/img.png", { env: { ...env, KVAULT_API_TOKEN: "" }, fetchImpl }), /KVAULT_API_TOKEN/);
});

test("licensed image uploads use scoped bearer token and return a verified public K-Vault URL", async () => {
  const env = {
    BLOG_MEDIA_UPLOAD_ENABLED: "true",
    BLOG_MEDIA_APPROVED_HOSTS: "docs.example.org",
    KVAULT_API_TOKEN: "test-token",
    KVAULT_BASE_URL: "https://pan.katelya.eu.org/",
  };
  let index = 0;
  const fetchImpl = async (url, options) => {
    index += 1;
    if (index === 1) {
      assert.equal(url, "https://docs.example.org/cover.webp");
      assert.equal(options.redirect, "manual");
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/webp" } });
    }
    assert.equal(String(url), "https://pan.katelya.eu.org/api/v1/upload");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.ok(options.body.get("file"));
    return Response.json({ links: { download: "/file/test-id" } });
  };
  const url = await mirrorApprovedImage("https://docs.example.org/cover.webp", { env, fetchImpl });
  assert.equal(url, "https://pan.katelya.eu.org/file/test-id");
  assert.equal(index, 2);
});

test("upload never trusts public links returned from unexpected origins", async () => {
  const env = { BLOG_MEDIA_UPLOAD_ENABLED: "true", BLOG_MEDIA_APPROVED_HOSTS: "docs.example.org", KVAULT_API_TOKEN: "test-token" };
  let index = 0;
  const fetchImpl = async () => ++index === 1
    ? new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/png" } })
    : Response.json({ links: { download: "https://attacker.example/image" } });
  await assert.rejects(mirrorApprovedImage("https://docs.example.org/image.png", { env, fetchImpl }), /unexpected download origin/);
});

test("artist layer and organization data are integrated into live GitHub showcase", async () => {
  const page = await read("src/pages/github.astro");
  const data = await read("src/data/github-showcase.ts");
  const showcase = await read("src/components/features/github-showcase/GitHubWorldShowcase.svelte");
  const background = await read("src/styles/impasto-backdrop.css");
  assert.match(page, /\/repos\/Decohererk\/DecoTV/);
  assert.match(page, /verifiedOrgRepository/);
  assert.match(data, /owner: "Decohererk"/);
  assert.match(showcase, /组织与协作项目/);
  assert.match(showcase, /查看官方全年 Contributions/);
  assert.match(background, /impasto-glaze-drift 110s/);
  assert.match(background, /--impasto-brush-glaze-opacity: 0\.54/);
});

test("editorial workflow keeps credentials in GitHub Actions Secrets", async () => {
  const workflow = await read(".github/workflows/content-publisher.yml");
  const runner = await read("scripts/content-automation/run.mjs");
  assert.match(workflow, /secrets\.KVAULT_API_TOKEN/);
  assert.match(workflow, /vars\.BLOG_MEDIA_APPROVED_HOSTS/);
  assert.match(runner, /await mirrorApprovedImage\(chooseOfficialImage/);
});
