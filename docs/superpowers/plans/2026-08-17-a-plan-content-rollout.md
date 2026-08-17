# A-Plan Content Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved A-plan content strategy into a repeatable publishing workflow and immediately diversify the homepage with high-information-density infrastructure, networking, and embedded-systems articles.

**Architecture:** Keep content-only work isolated in one branch and PR per article. Research factual claims from primary sources, combine them with repository evidence or clearly labeled learning experiments, validate every Markdown post through the repository's existing five-job CI, then squash-merge and verify the post exists on `master` before treating it as published.

**Tech Stack:** Astro 7 content collections, Markdown, GitHub Pull Requests, GitHub Actions, Cloudflare Pages Git Integration, DogeCloud CDN refresh workflow, primary technical documentation.

## Global Constraints

- Maintain the long-term mix as approximately 70% real technical practice, 20% frontier/learning experiments, and 10% major technology developments.
- LINUX DO, NodeLoc, and similar communities are discovery inputs only; they must not be the habitual narrative frame of an article.
- A normal technical article must satisfy at least three of: principle explanation, reproducible commands/config/code/experiment, verification evidence, failure/boundary analysis, engineering trade-offs, original conclusion.
- Do not fabricate personal hands-on experience. Embedded/MCU topics that have not been physically completed must be labeled as learning notes, simulation, minimal reproducible experiments, or planned experiments.
- Prefer official documentation, standards/RFCs, source repositories, release notes, and technical papers for factual claims.
- Every production article must use valid `src/content.config.ts` frontmatter, include `published`, `draft: false`, a useful description, tags, and category.
- One article per content PR. Do not bundle unrelated posts.
- Before merging, require successful Biome Check, Tests, Type Check, Build, and Playwright E2E jobs from `.github/workflows/lint.yml`.
- After merge, verify the file is present on `master` and inspect the `master` push workflows, including the Cloudflare Pages → DogeCloud CDN refresh chain.

---

### Task 1: Land the strategy and execution contract

**Files:**
- Existing: `docs/superpowers/specs/2026-08-17-blog-content-strategy-design.md`
- Create: `docs/superpowers/plans/2026-08-17-a-plan-content-rollout.md`

**Interfaces:**
- Consumes: approved A-plan strategy.
- Produces: repository-visible editorial rules and rollout procedure used by later content branches.

- [ ] **Step 1: Commit the implementation plan to PR #41**

Keep the strategy document and this plan together because both are process documentation rather than a public blog post.

- [ ] **Step 2: Run the full PR workflow**

Expected: `Biome Check`, `Tests`, `Type Check`, `Build`, and `Playwright E2E` all conclude `success`.

- [ ] **Step 3: Review PR #41 scope**

Expected changed files: only the strategy spec and implementation plan under `docs/superpowers/`.

- [ ] **Step 4: Squash-merge PR #41 into `master`**

Use the current PR head SHA as `expected_head_sha` so stale work cannot be merged accidentally.

### Task 2: Publish a real CI/CD incident post

**Files:**
- Create on a fresh branch: `src/content/posts/ci-green-but-not-production.md`

**Interfaces:**
- Consumes: repository evidence from PR #40, commit `532cda5c8917e1f9a0a87944ce798659275f74b3`, `.github/workflows/lint.yml`, `.github/workflows/doge-cdn-refresh.yml`, and official GitHub/Cloudflare deployment concepts where needed.
- Produces: one 70%-bucket real-practice article with `draft: false`.

- [ ] **Step 1: Research and evidence-map the incident**

Establish the exact chain: content branch → PR CI → merge gate → `master` → Cloudflare Pages production deployment → DogeCloud refresh. The central failure must remain precise: PR checks were green but PR #40 was still open, so the content had never entered `master`.

- [ ] **Step 2: Write the article around the deployment state machine**

Use this structure: symptom; false assumption that green CI means production; root-cause timeline; distinction between CI and CD; repository-specific release chain; four independent states (`code valid`, `PR merged`, `production deployed`, `CDN refreshed`); verification checklist; design lessons.

Include a compact text diagram such as:

```text
PR checks green
   ↓ (not deployment)
merge to master
   ↓
Cloudflare Pages production success
   ↓
DogeCloud precise refresh
   ↓
public URL verification
```

- [ ] **Step 3: Validate frontmatter and factual boundaries**

Use category `DevOps` and tags including `GitHub Actions`, `CI/CD`, `Cloudflare Pages`, `CDN`, `故障复盘`. Do not claim a production state unless the repository evidence supports it.

- [ ] **Step 4: Open a one-file PR and wait for all five CI jobs**

If any job fails, investigate that failure before merging.

- [ ] **Step 5: Squash-merge and verify on `master`**

After merge, fetch `src/content/posts/ci-green-but-not-production.md` from `master` and verify `draft: false`; then inspect `master` workflow runs for the merge commit.

### Task 3: Publish the first embedded-systems learning-lab post

**Files:**
- Create on a fresh branch: `src/content/posts/esp32-gpio-uart-i2c-spi-learning-lab.md`

**Interfaces:**
- Consumes: Espressif ESP32/ESP-IDF primary documentation and, where simulation is used, official Wokwi documentation.
- Produces: one 20%-bucket learning-experiment article without fabricated hardware experience.

- [ ] **Step 1: Research primary documentation**

Verify the roles and constraints of GPIO, UART, I2C, and SPI from Espressif documentation. Verify only simulation capabilities that are explicitly documented by Wokwi.

- [ ] **Step 2: Write the article as a learning laboratory, not a veteran project diary**

Use this structure: why MCUs communicate with peripherals; GPIO as direct digital state; UART as asynchronous point-to-point serial; I2C as addressed shared bus; SPI as clocked high-throughput bus; how to choose among them; a minimal ESP32 simulation experiment; common beginner errors involving voltage, pins, pull-ups, baud rate, and bus assumptions.

- [ ] **Step 3: Make the reproducible experiment self-contained**

Provide a small ESP32 example whose behavior can be simulated without claiming a physical board was used. Clearly label which part is conceptual and which part is simulator-verifiable.

- [ ] **Step 4: Open a one-file PR and require all five CI jobs**

Use category `嵌入式` and tags including `ESP32`, `单片机`, `GPIO`, `UART`, `I2C`, `SPI`, `IoT`.

- [ ] **Step 5: Squash-merge and verify production chain**

Fetch the post from `master` and inspect the merge commit's push workflows before reporting publication.

### Task 4: Publish a networking architecture deep dive

**Files:**
- Create on a fresh branch: `src/content/posts/cloudflare-tunnel-frp-tailscale-networking.md`

**Interfaces:**
- Consumes: Cloudflare Tunnel documentation, fatedier/frp official repository/docs, Tailscale/WireGuard primary documentation.
- Produces: one 70%/20% crossover article focused on architecture and trade-offs rather than a product ranking.

- [ ] **Step 1: Establish a common comparison model**

Compare the systems by connection direction, control plane, data path, identity/authentication, NAT traversal, public ingress requirements, attack surface, operational dependency, and suitable workloads.

- [ ] **Step 2: Write around network topology**

Explain why all three can feel like “expose an internal service” tools while solving different layers of the problem. Include text topology diagrams for Cloudflare Tunnel, FRP, and Tailscale.

- [ ] **Step 3: Add decision cases instead of a simplistic winner**

Cover public web service, private device mesh, self-controlled reverse proxy, temporary development access, and failure/dependency considerations.

- [ ] **Step 4: Open a one-file PR and require all five CI jobs**

Use category `网络` and tags including `Cloudflare Tunnel`, `FRP`, `Tailscale`, `WireGuard`, `NAT`, `Zero Trust`.

- [ ] **Step 5: Squash-merge and verify on `master`**

Confirm the file, frontmatter, and post-merge deployment workflows.

### Task 5: Enforce editorial rotation after the first batch

**Files:**
- No code file required; this is the recurring publishing gate defined by the spec and plan.

**Interfaces:**
- Consumes: latest published-post set.
- Produces: next topic selection without collapsing back into consecutive AI-model news.

- [ ] **Step 1: Check the last three technical posts before every new article**

If the proposed article repeats the same subdomain and structure, select another A-plan bucket unless the new article is a necessary continuation of a series.

- [ ] **Step 2: Score the candidate against the article quality gate**

Require at least three concrete strengths from the global constraints. Reject “news summary + parameter table + generic opinion”.

- [ ] **Step 3: Prefer a rotation across real-practice domains**

Bias the next several posts toward VPS/Linux, networking/Cloudflare, self-hosting/DevOps, embedded/IoT learning labs, then AI engineering when there is a genuinely strong engineering topic.
