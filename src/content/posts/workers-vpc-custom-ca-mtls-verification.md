---
title: "Workers VPC 的 TLS 信任边界：从自定义 CA 到 mTLS 的验收方法"
published: 2026-11-18
category: "网络"
tags: ["Cloudflare","Workers VPC","Hyperdrive","TLS","mTLS","DevOps"]
draft: false
pinned: false
comment: true
description: "Cloudflare 于 2026 年 11 月为 Workers VPC 增加自定义 CA 与客户端证书支持，使使用私有 CA 或要求双向 TLS 的服务可以通过 VPC Service 访问。本文从证书链、身份认证、配置路径和失败边界出发，建立一套不把“连接成功”误认为“安全配置正确”的验收方法。"
image: "https://developers.cloudflare.com/changelog/post/2026-11-18-custom-ca-mtls/og.png?v=ee1116ba4e0acb9d"
---

## 先区分两个问题：信任谁，以及证明自己是谁

很多 TLS 故障被笼统地称为“证书问题”，但 Workers VPC 这次能力更新实际上解决了两个不同方向的约束。

第一类是服务端证书的信任问题。客户端访问服务时，需要判断服务端证书是否由可信 CA 签发。Cloudflare 的更新说明指出，Workers VPC 过去只信任公开可信 CA 和 Cloudflare Origin CA，因此使用企业内部 CA 的服务只能降低校验强度，或关闭验证。现在可以上传自定义 CA，并在 VPC Service 的 TLS 设置中引用它。

第二类是客户端身份认证问题。某些服务不仅要求客户端验证服务端证书，还要求客户端出示证书，以证明自己属于被允许的调用方。这就是 mTLS。更新后，Workers VPC 可以上传客户端证书和私钥，并将其绑定到 VPC Service。两者可以单独使用，也可以同时使用：自定义 CA 解决“我是否信任对端”，客户端证书解决“对端是否信任我”。

这一区分很重要。只上传客户端证书而没有正确配置 CA，服务端证书仍可能无法通过验证；只上传 CA 而服务端要求客户端证书，则握手仍会失败。把两个选项当作一组“高级 TLS 开关”，是排查时最容易犯的错误。

## 更新真正改变的，是连接控制面

这项能力不是让 Worker 代码自行实现 TLS，而是把证书材料纳入 VPC Service 的连接配置。Cloudflare 的示例同时展示了三层对象：证书上传对象、VPC Service 对象，以及服务协议配置。

证书上传可以拆成两步。下面命令来自 Cloudflare 的更新说明，文件名仅代表本地待上传的证书文件：

```bash
npx wrangler cert upload certificate-authority \
  --ca-cert ./ca.pem \
  --name private-ca

npx wrangler cert upload mtls-certificate \
  --cert ./client.pem \
  --key ./client-key.pem \
  --name private-client
```

随后创建 TCP 类型的 VPC Service，并把证书对象绑定到 TLS 设置：

```bash
npx wrangler vpc service create private-service \
  --type tcp \
  --tcp-port 5432 \
  --app-protocol postgresql \
  --hostname service.example.com \
  --tunnel-id <TUNNEL_ID> \
  --certificate-authority <CA_CERTIFICATE_ID> \
  --client-certificate <CLIENT_CERTIFICATE_ID> \
  --cert-verification-mode verify_full
```

这里有几个不能省略的语义。`--certificate-authority` 指向的是用于验证服务端证书的 CA 对象，不是客户端证书；`--client-certificate` 指向的是客户端身份材料；`--cert-verification-mode verify_full` 表达的是完整验证意图，而不是“只要能建立加密连接即可”。示例使用 PostgreSQL，是因为该能力也覆盖通过 Hyperdrive 连接的 PostgreSQL 数据库场景，包括使用 RDS CA bundle 的实例。

Cloudflare 还说明，自定义 CA 和客户端证书可用于 HTTP Service 的 HTTPS 连接，以及 TCP Service 的 TLS 连接。因此，设计时不应只把它理解成数据库专用能力。真正需要抽象的是：服务类型、传输层、应用协议和 TLS 身份材料之间的绑定关系。

## “上传成功”不等于“握手正确”

证书配置至少要经过四层验证，而不是只检查 Wrangler 命令有没有返回成功。

第一层是材料本身。CA 文件应当确实是签发目标服务端证书的信任根或中间链；客户端证书的用途应与服务端的 mTLS 策略匹配；私钥必须与客户端证书对应。上传前可以在本地做一致性检查：

```bash
openssl x509 -in ca.pem -noout -subject -issuer -dates
openssl x509 -in client.pem -noout -subject -issuer -dates
openssl x509 -in client.pem -pubkey -noout > /tmp/client-cert.pub
openssl pkey -in client-key.pem -pubout > /tmp/client-key.pub
cmp /tmp/client-cert.pub /tmp/client-key.pub
```

这组检查只能证明文件结构和公钥匹配，不能证明远端服务信任该 CA，也不能证明客户端证书已被服务端授权。它的价值是尽早排除上传错误、证书过期和证书私钥不匹配，避免把所有问题都留到远端握手阶段。

第二层是配置引用。检查配置中的 CA ID、客户端证书 ID、Tunnel ID 是否属于同一个连接设计。尤其不要把“证书对象存在”当作“服务已引用证书”。证书上传是控制面资源创建，VPC Service 的 TLS 设置是连接行为；两者之间必须有明确绑定。

第三层是服务端策略。服务端至少可能拒绝三种情况：它不信任客户端证书的签发 CA；客户端证书的主体或扩展不满足服务端授权规则；服务端要求客户端证书，但连接配置没有提供可用的客户端私钥。Cloudflare 的 changelog 只证明平台现在支持这些材料，不证明任何一个业务服务会自动信任上传的证书。

第四层是实际协议访问。TCP 端口可达只说明网络路径存在，TLS 握手成功才说明证书协商通过，应用协议能够完成查询或请求则说明 PostgreSQL、HTTPS 等上层配置也正确。验收记录应将这三种结果分开保存，不能用“端口开放”替代“安全连接可用”。

## `verify_full` 是安全边界，不是装饰参数

Cloudflare 的示例明确使用 `verify_full`。在私有 CA 场景中，最危险的临时修复通常是把验证模式调低，先让业务连接起来，再把这个临时值遗忘在生产配置里。

更新说明提到，过去连接私有 CA 服务时可能需要使用 `verify_ca`，甚至关闭验证。这里体现的是一个工程取舍：较弱的模式可能减少证书名称或链路校验带来的兼容性问题，但同时也扩大了错误端点被接受的范围。完整验证更严格，要求服务端证书链和服务端身份都符合预期，因此失败会更早暴露。

推荐把验证模式当成发布门禁，而不是调试开关。开发阶段可以明确记录为了定位问题而改变了什么；进入正式环境前，配置必须回到预期的完整验证模式，并由一次真实连接验证确认。若必须降低校验强度，应把它登记为有期限的风险例外，写清目标服务、原因、责任人和撤销条件，而不是把弱验证作为默认模板。

同时，主机名配置不能随意替换成证书不包含的别名。即使 CA 正确、客户端证书正确，身份名称校验仍可能失败。本文使用 `service.example.com` 作为脱敏占位符，实际配置必须使用服务端证书所覆盖、且由网络设计明确分配的主机名。

## Wrangler、API 与 Terraform 的版本边界

这次更新还给出了一个容易被忽略的交付约束：自定义 CA 和客户端证书可以通过 Wrangler、API 或 Terraform provider 配置，但 Cloudflare 标明 Wrangler 需要 4.164.0 或更高版本，Terraform provider 需要 5.29.0 或更高版本。

因此，升级不能只改配置文件。至少应把执行工具版本纳入变更记录：

```bash
npx wrangler --version
terraform version
```

如果团队通过 CI 执行部署，还要确认 CI 使用的实际版本，而不是只检查开发机版本。一个常见失败路径是：控制面已经支持新字段，但流水线仍使用旧版 provider，结果表现为字段被忽略、计划阶段报未知参数，或者资源更新没有达到预期。不同工具的版本事实应以 Cloudflare 文档和发布记录为准，不应从本地命令的表面成功推断功能已经生效。

Terraform 场景还需要区分“计划成功”和“远端连接成功”。计划只验证配置模型能否被 provider 理解；apply 只证明资源写入控制面；真正的服务可用性仍要通过实际 TLS 和应用协议请求验收。把这些阶段拆开，才能知道失败发生在工具、控制面、网络、证书链还是应用层。

## 一份可复用的上线检查清单

在把私有 CA 或 mTLS 接入 Workers VPC 时，可以按下面顺序执行：

1. 明确连接目标是 HTTPS 还是 TCP，并确认应用协议和端口；
2. 收集服务端证书链、服务端信任的客户端 CA，以及客户端证书要求；
3. 本地检查证书有效期、签发关系和客户端证书私钥匹配；
4. 上传 CA 或客户端证书，记录返回的资源 ID，不把名称当作唯一证据；
5. 创建或更新 VPC Service，确认 Tunnel、主机名、端口、协议和 TLS 引用一致；
6. 将验证模式设为明确的安全目标，优先使用 `verify_full`；
7. 先验证端口连通，再验证 TLS 握手，最后验证应用协议请求；
8. 分别记录服务端认证失败、客户端认证失败、主机名校验失败和应用协议失败；
9. 在 CI 中固定 Wrangler 或 Terraform provider 的最低版本；
10. 为证书轮换提前定义新旧证书的并存窗口、切换顺序和回退条件。

最后一项尤其值得单独设计。证书轮换不是简单替换一个文件，而是控制面资源、服务端信任集合和客户端引用之间的协调变更。若服务端先撤销旧 CA，而 VPC Service 仍引用旧客户端材料，连接会立即中断；若客户端先切换到服务端尚未信任的证书，同样会失败。材料没有规定具体轮换流程，因此不能把某一种流程写成 Cloudflare 的官方保证，但可以把它作为团队自己的发布门禁。

## 结论：TLS 能力的价值在于可验证的身份链

Workers VPC 支持自定义 CA 和 mTLS，解决的是私有服务连接中的身份链缺口，而不是单纯增加两个命令行参数。自定义 CA 让客户端能够在不关闭验证的前提下信任私有签发体系；客户端证书让服务端能够验证调用方身份；VPC Service 则把这些材料放进可管理的连接控制面。

工程上最重要的结论是：安全连接必须被拆成证书材料、资源引用、TLS 握手和应用协议四个验收层。任何一层缺少证据，“配置已完成”都只能说明控制面有记录，不能说明业务真的获得了预期的认证与加密边界。

## 参考资料

- [Hyperdrive, Workers VPC - Custom CA and client certificates (mTLS) for Workers VPC](https://developers.cloudflare.com/changelog/post/2026-11-18-custom-ca-mtls/)
- [github.com](https://github.com/cloudflare/cloudflare-docs)
