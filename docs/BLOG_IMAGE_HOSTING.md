# Blog image hosting: K-Vault + Cloudflare R2

## Decision

Reuse the existing **K-Vault** deployment at `https://pan.katelya.eu.org/` as the upload and management control plane, with a **Cloudflare R2** bucket as the binary backend. No new PHP image-hosting instance, database, or public upload endpoint is required. Markdown posts remain in Git, while their uploaded images live outside the static deployment.

K-Vault API: `POST /api/v1/upload` with multipart fields `file`, `storage=r2`, `folderPath` and `deduplicate=true`. The script uses a scoped Bearer token and returns the canonical `links.download` public file link. No private `/api/v1/file` or time-limited `/share` URL is embedded.

## One-time setup

1. Confirm the existing K-Vault installation has `img_url` KV and R2 bucket bound as `R2_BUCKET` with `USE_R2=true`. Verify that R2 is listed in `GET /api/v1/capabilities`; do not assume it is enabled.
2. In K-Vault Admin → API Token 管理, create a **new token** scoped only to `upload`, ideally constrained to `r2` and a `blog` folder prefix, with expiration and rotation planned. Do **not** reuse a broad admin token or paste it in code.
3. On the authoring machine, set `KVAULT_API_TOKEN` as an environment variable (and optionally `KVAULT_BASE_URL` for an alternative HTTPS K-Vault host). Use a secure secret store; do not commit token, `.env`, or shell history.
4. Upload an image you own or have explicit permission to redistribute:

   ```sh
   pnpm images:upload -- ./cover.png --folder blog/2026/11 --alt "文章封面"
   ```

5. Paste the emitted `![alt](https://pan.katelya.eu.org/file/...)` into your Markdown article or set the returned URL as the `image:` frontmatter value.
6. Check image HTTP 200, Content-Type, render in the built article and mobile, then publish via the existing GitHub → Cloudflare Pages → DogeCloud workflow.

`pnpm images:upload -- ./cover.jpg --dry-run` checks and optimizes the file locally without secrets or API writes. Supported input: JPEG, PNG, WebP, AVIF, GIF; normal still images become ≤1600px WebP at quality 82 with EXIF stripped. Animated GIFs preserve their frames. Uploads have a 20MB input and 10MB output limit; unsupported or malformed images are rejected.

## Automation and rights

The scheduled content generator currently chooses an **official-source external URL** when reliable evidence is available. Do not mirror remote editorial images into R2 without a documented license or permission. For **owned or properly licensed** images created for future posts, use this upload command before committing the article; a CI job can adopt the same helper with a restricted `KVAULT_API_TOKEN` repository secret, but there is no secret-enabled auto-upload workflow until the deployment is configured and end-to-end upload is verified.

## Durability

- Use R2 as primary rather than Telegram/Discord attachment CDN links for permanent blog articles.
- Keep a copy of original authored images and the R2 objects (separate backup). Back up K-Vault's KV file-ID → storage-key metadata too: `/file/{id}` links depend on it.
- Do not set `expires_in`, passwords, or download count limits on public blog media.
- For more isolation later, configure a dedicated R2 image bucket with a Cloudflare custom domain such as `img.katelya.top`; DNS and bucket bindings require access to Cloudflare and are **not** configured by this repository change. Cloudflare advises production public buckets use custom domains for caching/WAF instead of `r2.dev`.
- Do not proxy every image request through the GitHub action or store image binaries in the blog Git history.
- Never commit uploaded third-party photographs without verified reuse rights.
