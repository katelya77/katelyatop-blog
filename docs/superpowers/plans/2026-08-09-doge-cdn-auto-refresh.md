# DogeCloud CDN Auto Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Cloudflare Pages Git Integration 生产部署完成后，按当前 GitHub commit 精确确认部署成功，并仅刷新本次变更实际影响的多吉云 CDN URL，避免破坏 `/_astro` 的 365 天长缓存。

**Architecture:** 新增一个独立 GitHub Actions 工作流和三个职责清晰的 Node.js 模块：刷新计划生成器负责把 Git diff 映射为 URL；Cloudflare Pages 等待器负责用 commit SHA 确认生产部署；多吉云客户端负责签名并提交 URL/目录刷新任务。编排脚本串联三者，只在 Pages 成功后执行 CDN 刷新，任何上游失败都 fail closed。

**Tech Stack:** Node.js 22、原生 `node:test`、Git、GitHub Actions、Cloudflare Pages REST API、多吉云 CDN REST API、`gray-matter`（仓库已有依赖）。

## Global Constraints

- 生产部署继续由 Cloudflare Pages Git Integration 负责，不迁移部署链路。
- 现有 `.github/workflows/deploy.yml` 保持“手动 GitHub Pages 备用流程”语义不变。
- Cloudflare Pages 项目名固定为 `katelyatop-blog`，生产分支固定为 `master`。
- 生产站点固定为 `https://blog.katelya.top`。
- `/_astro/**` 永不主动刷新；继续使用 CDN 365 天 + 浏览器 365 天缓存。
- `/pagefind/` 允许使用目录刷新；其他内容优先 URL 精确刷新。
- Cloudflare Token、多吉云 AccessKey/SecretKey 只能通过 GitHub Secrets 注入，不得写入仓库、PR、日志或前端变量。
- Cloudflare Pages 未成功、部署 SHA 不匹配或 API 超时，均不得调用多吉云刷新 API。
- 不新增第三方收费 Action；核心逻辑使用仓库内 Node.js 脚本。

---

### Task 1: Refresh plan generator

**Files:**
- Create: `scripts/cdn-refresh/refresh-plan.mjs`
- Create: `tests/cdn-refresh-plan.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildRefreshPlan({ changes, siteUrl, readFileAtRef }) -> Promise<{ urls: string[], paths: string[], reasons: string[] }>`
- Produces: `postPathFromSource({ filePath, content }) -> string | null`
- Consumes: Git diff change records shaped as `{ status, oldPath?, path }`.

- [ ] **Step 1: Write failing planner tests**

Cover these contracts with `node:test`:

```js
it("refreshes a changed custom-permalink post plus aggregate surfaces", async () => {
  const plan = await buildRefreshPlan({
    changes: [{ status: "M", path: "src/content/posts/demo.md" }],
    siteUrl: "https://blog.katelya.top",
    readFileAtRef: async () => "---\npermalink: demo/path\n---\nbody",
  });
  assert.deepEqual(plan.urls, [
    "https://blog.katelya.top/",
    "https://blog.katelya.top/archive/",
    "https://blog.katelya.top/atom.xml",
    "https://blog.katelya.top/demo/path/",
    "https://blog.katelya.top/rss.xml",
  ]);
  assert.deepEqual(plan.paths, ["https://blog.katelya.top/pagefind/"]);
});
```

Also test default `/posts/<content-id>/` mapping, deleted post mapping via base content, `public/**` stable URL mapping, code/layout changes refreshing aggregate entries + Pagefind, docs/tests-only changes yielding an empty plan, URL deduplication, and `/_astro` never being emitted.

- [ ] **Step 2: Run planner tests and verify failure**

Run:

```bash
node --test tests/cdn-refresh-plan.test.mjs
```

Expected: FAIL because `scripts/cdn-refresh/refresh-plan.mjs` does not exist.

- [ ] **Step 3: Implement minimal planner**

Use `gray-matter` to parse `permalink` and `alias`. For posts without custom permalink, map `src/content/posts/<id>.md` to `/posts/<id>/`, matching the current disabled global permalink configuration. For deleted/renamed posts, allow `readFileAtRef` to supply base-ref content. Public files map `public/foo/bar.ext` to `/foo/bar.ext`. Any public-output-affecting content/page/layout/component/config change adds `/`, `/archive/`, `/rss.xml`, `/atom.xml` and `/pagefind/`; docs/tests/CI-only changes produce no site refresh.

Never emit any URL beginning with `/_astro/`.

- [ ] **Step 4: Run planner tests and verify pass**

Run:

```bash
node --test tests/cdn-refresh-plan.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Add planner test to package scripts and commit**

Add `test:cdn-refresh` and include the CDN tests in the main `test` chain without changing existing test order semantics.

Commit:

```bash
git add scripts/cdn-refresh/refresh-plan.mjs tests/cdn-refresh-plan.test.mjs package.json
git commit -m "feat: plan precise CDN refresh targets"
```

### Task 2: Cloudflare Pages deployment waiter

**Files:**
- Create: `scripts/cdn-refresh/cloudflare-pages.mjs`
- Create: `tests/cdn-refresh-cloudflare.test.mjs`

**Interfaces:**
- Produces: `findDeploymentForCommit(payload, commitSha) -> object | null`
- Produces: `waitForPagesDeployment({ accountId, projectName, commitSha, apiToken, fetchImpl, sleep, timeoutMs, pollMs }) -> Promise<object>`

- [ ] **Step 1: Write failing deployment-state tests**

Test that the waiter:

```js
assert.equal(findDeploymentForCommit({ result: [matching] }, sha), matching);
```

and rejects on `failure`/`canceled`, keeps polling on `active`/not-found, accepts only `environment === "production"` and exact `deployment_trigger.metadata.commit_hash === commitSha`, and times out without returning another commit's successful deployment.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test tests/cdn-refresh-cloudflare.test.mjs
```

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement Pages API polling**

Call:

```text
GET https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/{project_name}/deployments?env=production&per_page=25
Authorization: Bearer <CF_API_TOKEN>
```

Validate HTTP status and Cloudflare `success`. Match the current SHA exactly. Return only when `latest_stage.status === "success"`; throw immediately on `failure` or `canceled`; otherwise poll every 15 seconds until 10 minutes by default.

- [ ] **Step 4: Run Cloudflare tests and verify pass**

```bash
node --test tests/cdn-refresh-cloudflare.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/cdn-refresh/cloudflare-pages.mjs tests/cdn-refresh-cloudflare.test.mjs
git commit -m "feat: wait for matching Pages deployment"
```

### Task 3: DogeCloud signed refresh client

**Files:**
- Create: `scripts/cdn-refresh/doge-client.mjs`
- Create: `tests/cdn-refresh-doge.test.mjs`

**Interfaces:**
- Produces: `createAuthorization({ apiPath, body, accessKey, secretKey }) -> string`
- Produces: `submitDogeRefresh({ rtype, urls, accessKey, secretKey, fetchImpl }) -> Promise<{ taskId: string }>`

- [ ] **Step 1: Write failing signing/client tests**

Use a fixed key/body vector to verify the HMAC-SHA1 hex signature and ensure the Authorization header has the form `TOKEN <AccessKey>:<hex-signature>` without exposing the secret in errors. Mock `fetchImpl` to verify `POST /cdn/refresh/add.json`, form-urlencoded body, `rtype=url|path`, and JSON-stringified `urls`.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test tests/cdn-refresh-doge.test.mjs
```

Expected: FAIL because client module is missing.

- [ ] **Step 3: Implement signer and refresh request**

Sign exactly `apiPath + "\n" + body` with HMAC-SHA1 using the SecretKey, hex-encode the digest, and send:

```text
POST https://api.dogecloud.com/cdn/refresh/add.json
Content-Type: application/x-www-form-urlencoded
Authorization: TOKEN <AccessKey>:<signature>
```

Treat non-2xx HTTP or API `code !== 200` as a hard failure. Return the API `task_id`. Never log the Authorization header, AccessKey or SecretKey.

- [ ] **Step 4: Run DogeCloud tests and verify pass**

```bash
node --test tests/cdn-refresh-doge.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/cdn-refresh/doge-client.mjs tests/cdn-refresh-doge.test.mjs
git commit -m "feat: add signed DogeCloud refresh client"
```

### Task 4: Orchestrator and GitHub Actions workflow

**Files:**
- Create: `scripts/cdn-refresh/run.mjs`
- Create: `.github/workflows/doge-cdn-refresh.yml`
- Create: `tests/cdn-refresh-workflow.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes env: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_PAGES_PROJECT`, `DOGE_ACCESS_KEY`, `DOGE_SECRET_KEY`, `SITE_URL`, `GITHUB_SHA`, `BASE_SHA`.
- Produces: workflow summary with public URL/path counts and task IDs only.

- [ ] **Step 1: Write failing workflow contract test**

Assert the workflow triggers on `push` to `master` and `workflow_dispatch`, checks out full enough history to diff, sets `BASE_SHA`, injects secrets by `${{ secrets.* }}`, never contains literal credential values, and invokes `node scripts/cdn-refresh/run.mjs`.

Also assert the orchestrator source imports the planner, Pages waiter and Doge client and does not contain `/_astro` directory refresh logic.

- [ ] **Step 2: Run contract test and verify failure**

```bash
node --test tests/cdn-refresh-workflow.test.mjs
```

Expected: FAIL because workflow/orchestrator do not exist.

- [ ] **Step 3: Implement orchestrator**

Use `git diff --name-status -M <BASE_SHA> <GITHUB_SHA>` to collect changes. For deleted or renamed posts, read old content with `git show <BASE_SHA>:<path>`; for current files read from disk. Build the plan before contacting external APIs, print a sanitized plan summary, then call `waitForPagesDeployment`. If the plan is empty, exit successfully without calling either external API. After Pages succeeds, submit URL refresh when `urls.length > 0` and path refresh when `paths.length > 0`.

- [ ] **Step 4: Implement workflow**

Use `actions/checkout@v6` with `fetch-depth: 2` for push events and enough history fallback for manual runs. Use Node 22 via `actions/setup-node@v6`. Set public constants as env (`CF_PAGES_PROJECT=katelyatop-blog`, `SITE_URL=https://blog.katelya.top`) and read `CF_ACCOUNT_ID` from repository variable. Inject the three credentials strictly from GitHub Secrets.

Add concurrency keyed to production CDN refresh so older in-progress refresh jobs are canceled when a newer `master` push arrives.

- [ ] **Step 5: Run all CDN refresh tests**

```bash
node --test tests/cdn-refresh-plan.test.mjs tests/cdn-refresh-cloudflare.test.mjs tests/cdn-refresh-doge.test.mjs tests/cdn-refresh-workflow.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run repository verification**

```bash
pnpm test
pnpm type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/cdn-refresh/run.mjs .github/workflows/doge-cdn-refresh.yml tests/cdn-refresh-workflow.test.mjs package.json
git commit -m "ci: refresh DogeCloud after Pages deploy"
```

### Task 5: Secret safety, PR verification, and activation checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-doge-cdn-auto-refresh-design.md` only if implementation reveals a spec correction.
- Modify: PR #23 description/status.

**Interfaces:**
- Repository Secrets required: `CF_API_TOKEN`, `DOGE_ACCESS_KEY`, `DOGE_SECRET_KEY`.
- Repository Variable required: `CF_ACCOUNT_ID`.

- [ ] **Step 1: Scan branch for secret leakage**

Run searches for credential prefixes/names and verify only environment-variable references exist. The user-provided Cloudflare token value must not appear anywhere in tracked files, git diff, PR body, comments, or logs.

- [ ] **Step 2: Verify workflow syntax and branch diff**

Inspect `.github/workflows/doge-cdn-refresh.yml`, run the contract tests, and review PR changed files. Confirm no modification to DNS, existing Cloudflare Pages deployment workflow, or `/_astro` caching logic.

- [ ] **Step 3: Update PR #23**

Change the PR body from design-only to implementation summary, include test results, required repository secret/variable names (names only, never values), and keep it draft until secret configuration is completed and the workflow can be smoke-tested.

- [ ] **Step 4: Activation handoff**

Because the available GitHub connector does not expose repository Actions Secret/Variable write APIs, provide the user the shortest UI path to create the three Secrets and one Variable. Do not ask the user to paste secret values back into chat. After they confirm configuration, trigger/observe the workflow and only then mark PR ready/merge if verification succeeds.
