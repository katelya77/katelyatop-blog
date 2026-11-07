# 博客图床运行手册：K-Vault × R2 / Telegram

适用 `blog.katelya.top` 的 Astro + Cloudflare Pages + DogeCloud 自动发文流程。

## 一、最终架构与取舍

既有 `https://pan.katelya.eu.org` K-Vault 为统一管理及公开直链入口；使用 K-Vault `/api/v1/upload` 上传，不建第二套图床。

| 模式 | 作用 | 适合 |
| --- | --- | --- |
| `r2` | **博客文章主存储（默认）** | 长期保存、稳定链接、缓存友好、备份方便 |
| `telegram` | 显式选择的备用存储 | 轻量素材、较低访问量或特殊场景；依赖 Telegram Bot/频道与文件接口 |

只允许上述两种后端；不自动故障切换。出现失效或容量/接口异常时先报错，避免文章图片在用户不知情的情况下跨存储。Telegram 并非对象存储的等价替代：存在 API/文件服务约束，不应作为唯一重要资料备份。

## 二、Token 轮换与最小权限（你需要操作）

**聊天中出现过的完整 K-Vault Token 必须视为已经暴露；撤销它，并新建一个，不要再次把新 Token 发到聊天、Issue 或 PR。**

1. 登录 `https://pan.katelya.eu.org/admin.html` → API Token 管理，撤销/删除已暴露的旧 Token。
2. 新建 `blog-publisher`，权限仅勾选 `upload` 与 `read`（读权限只在诊断/人工管理时需要；纯文章上传只需 `upload`）。**不要授予 `delete` / `paste`**。
3. 如果管理界面提供策略，设 `allowedStorages=["r2","telegram"]`、`folderPrefix="blog"`、`maxFileSize=8388608`（8 MiB），以及允许图片 MIME 类型 `image/png`、`image/jpeg`、`image/webp`、`image/avif`、`image/gif`。优先使用界面选项，无须用 Admin API。
4. 在 [GitHub 仓库的 Actions Secrets 设置](https://github.com/katelya77/katelyatop-blog/settings/secrets/actions) 中创建 Repository secret：`KVAULT_API_TOKEN`，**只粘贴到 GitHub 私密输入框**。

使用 GitHub 官方 Secrets，凭证只在 Actions 运行器环境中存在，仓库中不保存明文；请勿将其放入普通 `vars`。

## 三、R2 / Telegram 服务器配置

在 K-Vault 后台确认 R2 和 Telegram 两个存储后端均标记健康。根据你的部署方式，Cloudflare Pages Functions 版 R2 需要有效的 `R2_BUCKET` 绑定；Telegram 需要有效的 Bot Token 与 Chat ID。不要把这些凭证放进博客仓库。本次只修改博客，不会替你改写 K-Vault 的绑定/密钥。

K-Vault 的公开 `GET /api/v1/capabilities` 会返回实际检测到的后端。验证通过以前不要将自动上传开关开启。

## 四、博客 GitHub Actions 配置

打开 [Actions Variables 设置](https://github.com/katelya77/katelyatop-blog/settings/variables/actions)，创建以下 Repository variables：

| 变量名 | 推荐值 | 说明 |
| --- | --- | --- |
| `KVAULT_BASE_URL` | `https://pan.katelya.eu.org` | K-Vault 对外 HTTPS 域名 |
| `BLOG_MEDIA_STORAGE` | `r2` | `r2` 或 `telegram`，切换无需重写代码 |
| `BLOG_MEDIA_FOLDER` | `blog` | 或 `blog/2026`，必须在 blog 目录内 |
| `BLOG_MEDIA_UPLOAD_ENABLED` | `false` | **先保持 false；完成授权与端到端验收后再改 true** |
| `BLOG_MEDIA_APPROVED_HOSTS` | 空 | 只添加你拥有重新托管授权的图片源域名，用逗号分隔，不支持通配符 |
| `BLOG_MEDIA_DEDUPLICATE` | `false` | 因 K-Vault 去重索引可能跨存储复用，显式选择存储时先关闭；幂等请求仍有效 |

注意：在博客现有生成逻辑中，外部文章配图来自官方来源，但**官方网页配图不自动意味着拥有转载/重新托管许可**。保持 `BLOG_MEDIA_APPROVED_HOSTS` 为空时不会执行图片镜像。应优先使用自制封面/原创截图或明确可再托管的许可图片。不能用这些变量批量抓取第三方受限素材，也不能从个人 GPT 对话里把私密附件自动发布出去。

## 五、测试，不需要发布文章

打开 [K-Vault Blog Media Smoke Test](https://github.com/katelya77/katelyatop-blog/actions/workflows/media-smoke.yml)，点击 **Run workflow**，选择：
- `storage=r2`，`upload_probe=false`，先只检查服务器能力（无上传、无 Token 需求）。
- 如能力检查通过且新 Secret 已设置，将 `upload_probe=true`，运行一次 R2 上传 + 公网 PNG 回读。
- 换成 `storage=telegram` 重复测试。

`upload_probe=true` 会创建 **一张 1×1 的公开测试 PNG**，保存在 `blog/health`；日志只输出无私密信息的测试图片链接和结果。该测试不删除文件，之后可在 K-Vault 管理后台手动清理测试图片。

运行结果中必须看到所选后端、上传成功且返回 `https://pan.katelya.eu.org/file/...` 公网 URL，图片回读为 `image/png`。若失败，检查 Token policy、后端存储绑定与公开直链，不要为了绕过失败而开放 `delete` 权限。

可在 Node 22 本地、使用安全环境变量执行只读诊断：

```bash
node scripts/content-automation/media-doctor.mjs
```

## 六、自动发文上线

全部测试通过后，将 `BLOG_MEDIA_STORAGE=r2` 和 `BLOG_MEDIA_UPLOAD_ENABLED=true`，并仅为具有合法转载授权的来源设置 `BLOG_MEDIA_APPROVED_HOSTS`。现有 Automated Content Publisher 在取得合规图片后将其上传 K-Vault，验证 `links.download` 为同源 `/file/` HTTPS URL，再把 URL 写入 Markdown 封面字段。

- 文件 8 MiB 上限，限制 PNG/JPEG/WebP/GIF/AVIF。
- 仅 HTTPS 指定域名来源；不跟随来源 30x 跳转；读取最多 8 MiB。
- `storage` 选项必须是 R2 或 Telegram；由 K-Vault 按授权策略执行。
- 同一存储 + 同一内容的上传有 24h 幂等键，防网络重试重复写入。
- 未授权来源、后端返回错存储、异常直链或上传失败都会停止本次发布，**不会静默回退到第三方图床**。
- 浏览器前端不会携带 Token，跨域 CORS 不需向博客开启。旧文章不做强制迁移。

## 七、部署/CDN 与维护

博客 HTML / 静态资源继续通过 Cloudflare Pages 发布、多吉云刷新；图片 URL 的实际网络路径是独立的 `pan.katelya.eu.org/file/...`，**不会因为博客对多吉云刷新缓存而自动刷新图床域名**。图片更改应生成新 URL，旧链接尽量不删除。K-Vault 和 Telegram/R2 的数据需要独立备份；重要原图离线保存。

若访问量以后增长，再根据真实 CDN 命中率和响应指标决定是否独立图片读取域名、转换缩略图及长期缓存；目前不额外增加服务层。
