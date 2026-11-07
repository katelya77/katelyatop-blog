# 博客图床：K-Vault + R2（2026-11）

## 结论

继续使用已部署的 [K-Vault](https://github.com/katelya77/K-Vault) 作为上传 API 和图片管理界面，**存储选 Cloudflare R2**（或现有可靠的 S3 兼容存储），外链统一采用 `https://pan.katelya.eu.org/file/...`。不再部署 PicGo Server / Lsky Pro / Chevereto 等第二套图床。文章 Markdown 只写返回的可公开访问图片 URL，所有密钥只放 CI Secret。

> 这是长期运营方案及代码接入，不代表远程 R2/K-Vault 管理员配置已经被更改。生产配置仍需凭证和相应后台权限。以前在聊天中暴露的 Token 应先轮换，不能复用。

## 推荐拓扑

`GitHub Actions 技术选题/文章生成 → 审核过版权的配图 URL → scripts/content-automation/media.mjs → K-Vault API Token /api/v1/upload → K-Vault R2 存储 → 返回 https://pan.katelya.eu.org/file/... → Markdown frontmatter image → Cloudflare Pages 静态站 + DogeCloud CDN`

* R2 负责存放稳定的原图文件，K-Vault 负责上传鉴权、文件管理、上传返回链接。
* 自有域名作为唯一外链，可在未来换存储后端而不大面积修改文章。若未来需要大量图片请求，可考虑将独立静态读域名指向 R2 自定义域名，与 K-Vault 管理端解耦；当前不引入新层。
* 官方截图、项目文档图片可能受版权和引用限制。仅对用户自行制作、拥有授权或明确允许重新托管的图片启用镜像；未经授权的远程图片不要复制。

## 上线配置

1. 在 K-Vault 管理后台为自动发文单独创建仅含 `upload` 权限的 Token，限制可写目录为 `blog/`（若当前版本支持），并启用 R2 默认存储。请对以前泄露过的 Token 进行轮换。不要写进 Markdown、仓库、Issue、日志。
2. 在 GitHub 仓库 Actions Secrets 新增 `KVAULT_API_TOKEN`（Token 内容不会存入代码）。
3. 在 GitHub Actions Variables 配置：
   * `KVAULT_BASE_URL` = `https://pan.katelya.eu.org`
   * `BLOG_MEDIA_APPROVED_HOSTS` = 你已经确认拥有再托管权的 HTTPS 图片源域名，多个以半角逗号分隔；**不能填 `*`**。
   * `BLOG_MEDIA_UPLOAD_ENABLED` = `true`（仅在 R2、Token、许可均通过审核时启用，默认为关闭）。
4. 手动运行一次 Automated Content Publisher 的少量样本，确认返回的是 K-Vault 的公开永久图片路径、HTTP 200、图像 MIME 正确且移动端打开正常，然后检查生成 Markdown 的 `image:`。
5. 对重要原创图片保留 R2 导出/定期备份。K-Vault 和 R2 均不是离线备份的替代品。

## 已实施的程序防护

* 未开启开关时，不会调用图床，保留现有文章原图链接，旧文章不迁移。
* 开启后只接收白名单内 HTTPS 主机名，远程下载禁用重定向；仅允许 JPEG/PNG/WebP/AVIF/GIF，不接受 SVG/HTML，单图最多 8MiB。
* 流式限制实际下载体积，防止来源伪报 Content-Length；上传使用 Bearer Token，不向客户端暴露。
* 仅接受 K-Vault 所在 HTTPS 同域的直链，拒绝跳转及返回的其他域名。
* 授权或上传失败，整次自动发文失败，不会默默替换为易失的第三方图片，也不写下假成功 URL。
* 每篇文章仅在发现符合条件的官方来源配图时尝试镜像；没有配图时不阻塞纯文本发文。

## 接下来可选的独立增强

* 本地写作端可用 PicList 的自定义 HTTP 上传器对接 K-Vault 的 `/api/v1/upload`，获得粘贴截图后自动复制 Markdown 链接的体验。但这不是自动发文链路的必需依赖。
* 仅当访问量和 CDN 统计证明值得时，添加衍生缩略图生成、尺寸压缩、图片格式协商和按内容哈希去重。现在先保证稳定 URL 和清晰授权。
