---
title: "Bot Fight Mode 不是 API 鉴权：Cloudflare Pages 图床如何兼容自动化上传"
published: 2026-11-08
category: "工程札记"
tags: ["Cloudflare Pages", "R2", "Telegram", "API Token", "图床", "安全架构"]
draft: false
pinned: false
comment: true
description: "以 Cloudflare Pages 上的开源图床 K-Vault 为案例，拆解浏览器界面与 GitHub Actions 自动上传的冲突：为什么 Bot Fight Mode 会拦截合法 API，如何设计双入口、最小权限 Token、R2/Telegram 双后端回读，以及让修复真正惠及 Fork 部署者。"
image: "https://media.katelya.top/file/r2:r2_1794115780208_7pgn22.png"
---

把图床接进博客自动发布流程，第一反应往往是创建一个 API Token，然后在 GitHub Actions 中调用上传接口。浏览器里能上传、Token 也有权限，看上去已经足够。但工程链路里还隔着 CDN、Bot 防护、路由、对象存储和公网文件代理。任何一层没有对上，都会出现“页面正常、机器人却无法使用”的情况。

这篇文章以一个部署在 **Cloudflare Pages** 的开源文件托管项目 [K-Vault](https://github.com/katelya77/K-Vault) 为案例，讨论一套**可供 Fork 用户重复部署**的双入口设计。文章只描述公开代码、产品文档与去标识化的测试结果；不包含真实 Token、Cloudflare 账户 ID、机器人会话、内部日志、项目管理员资料或个人私有配置。

## 先明确：机器人检测、上传鉴权和文件可读性是三件事

一次自动上传通常经过这样的链路：

```text
GitHub Actions / MCP Agent
  └─ HTTPS → Cloudflare Edge
                ├─ Bot / WAF / DDoS 检测
                └─ Pages Functions
                      ├─ API Token / scope / policy 校验
                      ├─ R2 或 Telegram 上传
                      └─ 返回公网文件 URL
                           └─ GET / Range 回读验证
```

三个检查点分别回答不同问题：

- **边缘安全检测**：这类 HTTP 请求是否需要挑战、限制或阻断？它不理解业务 Token 是否具有上传权限。
- **应用层认证**：请求是否有合法的 Bearer Token，是否具备 `upload` scope，是否满足目录、后端和文件大小策略？
- **内容交付验证**：成功返回的 URL 能否在不携带上传 Token 的情况下，按预期公开读取图片？响应状态、MIME 类型和文件内容是否正确？

只拿到上传接口的 HTTP 200，还不能称为“图床接入成功”。

## 真实故障：浏览器正常，自动化客户端被挑战

Cloudflare 的 **Bot Fight Mode** 面向整个域名区域（Zone）。当它把 GitHub Actions 等非浏览器客户端判定为自动化流量时，可能返回 `403`，响应头含 `cf-mitigated: challenge`，正文则是一页要求执行浏览器挑战的 HTML。

这种失败发生在 API Token 校验之前。因此，增加 Token 权限、换 Telegram Bot、重建 R2 桶，甚至重写上传客户端，都不能解决问题。更可靠的诊断顺序是：

1. 检查返回的是 K-Vault 结构化 JSON 错误，还是 Cloudflare 挑战页面。
2. 根据请求时间、Host、Path 和 Ray ID 在 Cloudflare Security Events 中确认 `Service` 与 `Action`。
3. 若确认为 Bot Fight Mode，先核对产品对例外规则的支持，再选择部署方案。

Cloudflare 官方说明：**Free 计划的 Bot Fight Mode 不能通过普通 WAF Skip 规则设置例外**。它运行在不同于 Ruleset Engine 的流程中；自定义 Skip 规则可以用于 Super Bot Fight Mode，却不能绕过 Free Bot Fight Mode。这是产品机制，不是“加一个 User-Agent 就能解决”的小故障。

因此，不建议伪装 Chrome、重放浏览器 Cookie、模拟验证码或直接把一个云服务商的全部 IP 加进白名单。这些办法要么不稳定，要么改变了原本的安全边界。

## 双入口：让浏览器和机器访问同一个 Pages 项目

对于有多个子站点的开发者，直接关闭主域名区域的 Bot Fight Mode，可能削弱该 Zone 内其他应用的机器人防护；只为一个图床 API 升级套餐也未必划算。

更容易维护的方案，是将**同一个 Pages 项目**绑定到两个不同安全策略的域名区域：

```text
网页入口（Zone A）                   机器 API 入口（Zone B）
https://files.example.org           https://api-files.example.net
Bot Fight Mode 按需保留              按 API 客户端需求配置边缘检测
           \                         /
            \                       /
             同一个 Pages 项目 / Functions
                        |
                 同一个 KV / R2 绑定
                        |
                 Telegram（可选）
```

两个域名只是不同的 HTTPS 入口，不代表复制了一份文件、创建第二个 KV 数据库或迁移对象存储。机器客户端仍须走正式的 Token 鉴权，上传请求仍受目录与后端白名单约束。*前提*是两个域名确实指向同一部署，且各自 Zone 的安全设置与 Pages 自定义域名已经正确生效。

这并不是“完全不需要安全防护”：机器 API 域名仍应保留适用的 DDoS、WAF、速率限制及应用鉴权。安全策略应该基于实际路由与用户权限，而不是寄望于浏览器挑战替代授权。

## API Token 应该遵循最小权限

在 K-Vault 中，程序化上传使用 `POST /api/v1/upload`。Token 作用域应从需求出发：只负责写入的机器人优先只授予 `upload`，确实需要读取私有元数据时再增加 `read`；不需要 `delete`、`paste` 就不要授予。

同时在服务端设置策略，例如：

```json
{
  "scopes": ["upload"],
  "policies": {
    "allowedStorages": ["r2", "telegram"],
    "folderPrefix": "blog",
    "maxFileSize": 5242880
  }
}
```

上面是**通用配置示例**，不是任何生产环境的实际 Token 设置。图片大小上限也应按业务自行确定。

客户端凭据通过部署平台 Secret 注入，绝不写入文章、`.env.example`、前端 JS、Issue、Actions 日志或截图。调用示例如下，域名及 Token 都从部署环境读取：

```bash
curl --fail-with-body --show-error \
  -H "Authorization: Bearer ${KVAULT_API_TOKEN}" \
  -F "file=@./cover.png;type=image/png" \
  -F "storage=r2" \
  -F "folderPath=blog" \
  "${KVAULT_BASE_URL}/api/v1/upload"
```

不要把完整 Bearer Token 放在公开的 `curl -v` 日志、CI 调试回显或命令行截图里。曾经暴露过的 Token，即使从 README 中删掉，也必须在服务端撤销、轮换；删除 GitHub 当前文件并不等于清除了 Git 历史或第三方缓存。

## 一次完整的 R2 / Telegram 双存储验证

正式上线之前，建议用**自制的极小 PNG**，对两个存储后端分别运行同样的流程：

| 阶段 | R2 | Telegram |
| --- | --- | --- |
| `GET /api/v1/capabilities` | 应列出 `r2` | 应列出 `telegram` |
| Bearer Token 上传 | 返回成功及文件标识 | 返回成功及文件标识 |
| 公网 URL 回读 | 返回 200/206 | 返回 200/206 |
| `Content-Type` | `image/png` | `image/png` |
| 最终判断 | 上传与回读同时通过 | 上传与回读同时通过 |

一次去标识化的实际检查中，Telegram 上传与回读首先通过，R2 上传虽然成功，但含编码冒号的下载地址返回 404。把同一文件标识里的 `%3A` 表达改成路径中的字面 `:` 后，读取返回 `206 image/png`。因此，失败点不在 R2 对象或上传 Token，而在公开文件 ID 的 URL 编码与路由参数处理。

这一类缺陷应优先修复**服务端的统一文件标识解析**，兼容 URL 编码和原始路径；客户端可保留严格限定前缀的兼容措施作为过渡。修复必须覆盖 Cloudflare Pages 和 Docker 的实际代码路径，并加入回归测试，而不能只在某个用户的脚本中替换域名。

还要注意：`capabilities` 返回某个后端，只能证明它被检测为“已配置”，**不能证明它已能上传和回读**。真实 smoke test 不能省略。

## 开源项目如何把“一次修好”变成 Fork 用户的改进

公开仓库最容易积累的技术债，不是少一个功能，而是把作者个人环境误写成默认规范：硬编码生产域名、把弱管理员密码放进开发启动命令、在文档中粘贴真实 Token，或将安全配置解释成只有一个人的部署方式。

比较稳妥的交付标准包括：

1. **示例使用中性域名和占位符**，而不是作者生产服务器的真实地址。
2. **开发与生产凭据分离**，本地测试账号由安全方式生成或显式设置，不把固定的默认密码带进 Fork。
3. **环境配置按部署平台说明**：Pages 使用绑定与环境变量，Docker 使用本地 `.env` 或可信秘密管理；示例文件不包含可用密钥。
4. **兼容性改变必须有回归测试**，并覆盖两个后端、已编码链接和普通链接；不能为了修复一个场景破坏另一个部署方式。
5. **公开前审查日志与构建产物**，避免把 Token、完整请求头、管理 Cookie、私有主机名或含凭据的 URL 写入仓库。
6. **把 CI 成功与公网成功分开**：只有完成合并、部署和真实 URL 回读，才能称为端到端交付。

如果维护者发现真实凭据已进入公共 Git 历史，应先撤销和轮换凭据，再评估历史清理、Fork/缓存传播与使用通知。只添加 `.gitignore` 不会让已经提交的文件自动消失。

## 最后：机器 API 的可靠性来自清晰的信任边界

为程序接入图床时，真正需要分开的不是“人类请求”和“机器人请求”，而是**是否经过可信鉴权、是否满足上传策略、是否能交付预期文件**。浏览器挑战适合一部分网页流量，但不应成为 API Token 的替代品。

双入口让不同类型的客户端采用不同的边缘策略；最小权限 Token 让上传行为可控；R2 与 Telegram 独立回读让结果可证实；服务端兼容和通用文档则让修复能够惠及 Fork 和后续部署。

这比把一次 `HTTP 200` 当成上线证明，更接近一套可维护的开源产品。

## 参考资料

- [Cloudflare：Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
- [Cloudflare：WAF Skip 规则与适用限制](https://developers.cloudflare.com/waf/custom-rules/skip/)
- [Cloudflare：安全功能的执行顺序](https://developers.cloudflare.com/waf/feature-interoperability/)
- [K-Vault 开源仓库](https://github.com/katelya77/K-Vault)
- [K-Vault Agent API 接入指南](https://github.com/katelya77/K-Vault/blob/main/docs/agent-integration.md)
