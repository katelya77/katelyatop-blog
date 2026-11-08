import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mediaPolicy, mirrorApprovedImage, uploadKVaultImage, fetchKVaultCapabilities } from "../scripts/content-automation/media.mjs";

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
  await assert.rejects(mirrorApprovedImage("https://docs.example.org/image.png", { env, fetchImpl }), /unexpected public file URL/);
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

test("K-Vault upload honors explicit r2 or telegram, blog folder, and idempotency", async () => {
  for (const storage of ["r2", "telegram"]) {
    const env = {
      BLOG_MEDIA_STORAGE: storage,
      BLOG_MEDIA_FOLDER: "blog/2026",
      KVAULT_API_TOKEN: "test-token",
    };
    const response = await uploadKVaultImage(Uint8Array.from([1, 2, 3, 4]), "image/webp", {
      env,
      fetchImpl: async (url, request) => {
        assert.equal(String(url), "https://pan.katelya.eu.org/api/v1/upload");
        assert.equal(request.method, "POST");
        assert.equal(request.body.get("storage"), storage);
        assert.equal(request.body.get("folderPath"), "blog/2026");
        assert.equal(request.body.get("deduplicate"), "false");
        assert.match(request.headers["Idempotency-Key"], new RegExp("^blog-" + storage + "-[a-f0-9]{64}$"));
        return Response.json({
          success: true,
          file: { storage },
          links: { download: "https://pan.katelya.eu.org/file/test-" + storage + ".webp" },
        });
      },
    });
    assert.equal(response, "https://pan.katelya.eu.org/file/test-" + storage + ".webp");
  }
});

test("backend mismatch is a failure rather than silently storing elsewhere", async () => {
  const env = { BLOG_MEDIA_STORAGE: "telegram", KVAULT_API_TOKEN: "test-token" };
  await assert.rejects(
    uploadKVaultImage(Uint8Array.from([1, 2]), "image/png", {
      env,
      fetchImpl: async () => Response.json({
        success: true, file: { storage: "r2" }, links: { download: "/file/cross-backend.png" },
      }),
    }),
    /unexpected storage backend/,
  );
});

test("media configuration validates storage, path, and download origin", async () => {
  for (const invalid of ["s3", "github", "auto", ""]) {
    if (!invalid) continue;
    await assert.rejects(uploadKVaultImage(Uint8Array.from([1]), "image/png", {
      env: { KVAULT_API_TOKEN: "test-token", BLOG_MEDIA_STORAGE: invalid },
      fetchImpl: async () => { throw new Error("unexpected network"); },
    }), /r2 or telegram/);
  }
  await assert.rejects(uploadKVaultImage(Uint8Array.from([1]), "image/png", {
    env: { KVAULT_API_TOKEN: "test-token", BLOG_MEDIA_FOLDER: "../private" },
  }), /BLOG_MEDIA_FOLDER/);
  await assert.rejects(uploadKVaultImage(Uint8Array.from([1]), "image/png", {
    env: { KVAULT_API_TOKEN: "test-token" },
    fetchImpl: async () => Response.json({ links: { download: "/s/password-share" } }),
  }), /unexpected public file URL/);
});

test("public capability probe lists available Telegram and R2 without exposing an API token", async () => {
  const probe = await fetchKVaultCapabilities({
    env: { BLOG_MEDIA_STORAGE: "telegram" },
    fetchImpl: async (url, options) => {
      assert.equal(String(url), "https://pan.katelya.eu.org/api/v1/capabilities");
      assert.equal(options.redirect, "manual");
      assert.equal(options.headers?.Authorization, undefined);
      return Response.json({ success: true, data: { storages: ["telegram", "r2", "github"] } });
    },
  });
  assert.deepEqual(probe, { configuredStorages: ["telegram", "r2"], selected: "telegram" });
});

test("capability preflight distinguishes Cloudflare challenges from API outages", async () => {
  await assert.rejects(fetchKVaultCapabilities({
    env: { BLOG_MEDIA_STORAGE: "r2" },
    fetchImpl: async () => new Response("<html>challenge</html>", {
      status: 403,
      headers: { "cf-mitigated": "challenge" },
    }),
  }), /Cloudflare challenge blocked K-Vault API access/);

  await assert.rejects(fetchKVaultCapabilities({
    env: { BLOG_MEDIA_STORAGE: "telegram" },
    fetchImpl: async () => new Response("Service Unavailable", { status: 503 }),
  }), /K-Vault capabilities endpoint returned HTTP 503/);
});

test("lightweight impressionist overlays have no SVG turbulence/blur filters", async () => {
  const background = await read("src/styles/impasto-backdrop.css");
  assert.match(background, /van-gogh-lite-day\.svg/);
  assert.match(background, /van-gogh-lite-night\.svg/);
  for (const theme of ["day", "night"]) {
    const svg = await read("public/assets/impasto/van-gogh-lite-" + theme + ".svg");
    assert.match(svg, /<path/);
    assert.doesNotMatch(svg, /<filter|feTurbulence|feGaussianBlur|filter="url/);
  }
  assert.match(background, /pointer: coarse/);
});
