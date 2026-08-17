---
title: Cloudflare Tunnel、FRP、Tailscale 都能“穿透内网”，但它们根本不是同一种东西
author: Katelya
published: 2026-08-17
category: 网络
tags: [Cloudflare Tunnel, FRP, Tailscale, WireGuard, NAT, Zero Trust, 内网穿透]
draft: false
pinned: false
comment: true
description: 不做“谁更强”的简单排行榜，而是从流量方向、控制面、数据路径、NAT、身份边界和故障域拆开 Cloudflare Tunnel、FRP 与 Tailscale：三种看起来都能访问内网服务的方案，其实解决的是三类不同网络问题。
---

“把家里 / 公司 / VPS 后面的服务带到外面访问”，经常会被一句话概括成：

> **内网穿透。**

然后 Cloudflare Tunnel、FRP、Tailscale 会一起出现在推荐列表里。

乍看确实合理：

```text
它们都能让原本不好直接访问的机器变得可达
```

但如果真的开始搭系统，我觉得把它们直接放在同一条“内网穿透排行榜”里反而很容易误导。

因为三者真正解决的问题并不一样：

```text
Cloudflare Tunnel
更像：把一个内部服务接到托管的公网边缘入口

FRP
更像：自己搭一台公网反向代理 / 中继服务器

Tailscale
更像：给多台设备建立一个基于身份的私有 Overlay Network
```

所以这篇不准备回答：

```text
谁最好？
```

我更想回答：

> **一条请求到底从哪里进来、经过谁、谁负责认证、谁控制公网入口、NAT 又是怎么被绕过去的？**

把数据路径画出来以后，很多选型问题会自己消失。

---

## 先别说“穿透”，先问你到底想解决哪一种可达性

我现在会先把需求拆成三类。

### 问题 A：我要让互联网用户访问一个 Web 服务

比如：

```text
Home Assistant Dashboard
内部 Web 面板
开发中的网站
自建 API
博客源站
```

你希望用户访问：

```text
https://app.example.com
```

但源站：

- 没有公网 IPv4；
- 在 NAT 后面；
- 不想开放 80/443；
- 甚至不想让别人知道真实源站 IP。

这是一类**Public Ingress** 问题。

### 问题 B：我有一台公网 VPS，想自己控制转发

例如：

```text
公网 VPS:6000
      ↓
家里电脑:22
```

或者：

```text
example.com
   ↓
公网 frps
   ↓
内网 Web 服务
```

你希望自己掌握：

- 公网服务器；
- 端口；
- 转发规则；
- TCP / UDP；
- TLS 和反向代理结构。

这是一类**Self-hosted Reverse Proxy / Relay** 问题。

### 问题 C：我只想让自己的设备彼此可达

例如：

```text
笔记本 → 家里 NAS
手机   → VPS SSH
开发机 → 树莓派
服务器 A ↔ 服务器 B
```

你根本不需要让这些服务暴露给整个 Internet。

你想要的是：

```text
“只有我的网络成员能访问”
```

这是一类**Private Mesh / Overlay Network** 问题。

而 Cloudflare Tunnel、FRP、Tailscale 恰好分别更接近这三个方向。

---

# 一、Cloudflare Tunnel：不是把端口“打出去”，而是把源站接进 Cloudflare Edge

Cloudflare 官方目前对 Tunnel 的描述非常直接：`cloudflared` 从你的基础设施主动向 Cloudflare 建立 **outbound-only** 的连接，因此源站不需要公网 IP，也不需要为 Tunnel 打开新的入站端口。

核心拓扑可以简化为：

```text
Internet User
     │
     ▼
Cloudflare Edge
     ▲
     │ persistent outbound tunnel
     │
 cloudflared
     │
     ▼
127.0.0.1:3000
Internal Service
```

这里有一个非常重要的方向差异：

```text
不是：
互联网主动连进你的内网

而是：
内网 cloudflared 先主动连出去，建立长期通道
```

对防火墙来说，这两个模型差别很大。

## 公网入口在哪里？

在 Cloudflare。

用户访问你的域名时，公网连接先到 Cloudflare Edge：

```text
Client
  ↓
Cloudflare
  ↓
Tunnel
  ↓
Origin
```

因此 Cloudflare 可以在前面继续叠加：

- DNS；
- TLS；
- WAF；
- CDN；
- DDoS 防护；
- Access / Zero Trust 身份策略；
- Bot / Rate Limit 等边缘能力。

所以 Tunnel 很适合的一种思路是：

> **我不是想拥有一个公网转发端口，而是想把这个内部 Web Origin 接到一个现成的公网边缘平台。**

## 最大优点：源站入口可以收得非常小

传统公网 Web 架构往往是：

```text
Internet
   ↓ 443
Public Origin
```

源站至少需要存在一个 Internet 可达的入站面。

Tunnel 则可以是：

```text
Origin
  │
  └── outbound → Cloudflare
```

如果整个服务只通过 Tunnel 提供，那么源站防火墙可以不为 Internet 开放传统 Web 入站端口。

这不是说安全自动解决了，而是**攻击面的位置发生了变化**：

```text
公网入口安全
更多交给 Cloudflare Edge

源站安全
更多关注本机、Tunnel credential、内部服务和出站连接
```

## 它的代价也来自同一个地方

入口在 Cloudflare，意味着生产链路会依赖 Cloudflare 的控制面和边缘网络。

如果你的要求是：

```text
“公网入口、中继服务器、协议栈必须全部自己控制”
```

那么 Tunnel 就不是最“自主”的方案。

它的优势正来自托管边缘平台，依赖也同样来自托管边缘平台。

---

# 二、FRP：我自己准备一个公网锚点，把内网服务反向接过去

FRP 的官方仓库把它定义为一个 fast reverse proxy，用于把 NAT / firewall 后面的本地服务暴露到 Internet。

最经典的 FRP 架构非常容易理解：

```text
                 Public VPS
              ┌──────────────┐
Internet ────→│     frps     │
              └──────▲───────┘
                     │
                     │ persistent connection
                     │
              ┌──────┴───────┐
              │     frpc     │
              │ Internal LAN │
              └──────┬───────┘
                     │
                     ▼
                  SSH / Web
```

通常：

```text
frps = Server
放在有公网 IP 的 VPS 上

frpc = Client
放在内网机器上
```

frpc 主动去连接 frps，因此它同样能跨过“内网机器无法被 Internet 直接发起连接”这个障碍。

但和 Cloudflare Tunnel 不一样的是：

> **公网锚点是你自己的 frps。**

## FRP 的本质更像“自建可编程转发站”

例如一个最直观的 SSH 映射：

```text
公网 VPS:6000
        ↓
       frps
        ↓
      tunnel
        ↓
       frpc
        ↓
内网机器:22
```

用户访问：

```bash
ssh -p 6000 user@public-vps
```

FRP 再把这条连接送回内网 SSH。

FRP 还支持 TCP、UDP、HTTP、HTTPS 等不同代理类型，因此它比“只能反代 Web”的思路更通用。

## 它和传统 Nginx 反代的关键区别

普通 Nginx 反代通常假设：

```text
Nginx 能主动访问 Backend
```

比如：

```text
Nginx VPS
   ↓
192.168.1.10:3000
```

但公网 VPS 往往根本路由不到你家里的 `192.168.1.10`。

FRP 做的是：

```text
先让 frpc 从 LAN 主动连接 frps
再在这个已建立的通道中反向承载连接
```

所以它解决的是“公网中继与内网之间缺少可路由路径”。

## FRP 的自由度来自“你自己承担基础设施”

这也是它和 Cloudflare Tunnel 最明显的工程取舍。

你拥有：

```text
公网 VPS
frps 配置
开放端口
域名
TLS
访问策略
日志
限速
版本升级
监控
```

因此：

```text
控制权 ↑
运维责任 ↑
```

如果公网 frps 自己挂了，对应转发链自然也会断。

如果端口直接暴露到 Internet，认证和服务本身的安全也需要你自己认真处理。

FRP 并不是“一装就安全的内网穿透神器”，它更像一块可自己设计的网络积木。

---

# 三、Tailscale：它首先想解决的不是“公网入口”，而是“这些设备是不是同一个私有网络里的成员”

Tailscale 和前两个方案最容易被混淆。

因为最终效果看起来也可能是：

```text
我在外面的笔记本
成功访问了家里的 NAS
```

但它的核心架构并不是：

```text
公网入口 → 内部服务
```

而更像：

```text
Device A ─────┐
Device B ─────┼── Tailnet
Device C ─────┤   private overlay network
Server D ─────┘
```

每台加入 tailnet 的设备获得 Overlay Network 中的身份和地址，然后彼此通信。

## 最理想的数据路径是 Peer-to-Peer

Tailscale 官方当前把连接分成：

- Direct connection；
- Peer Relay；
- DERP relay。

在能完成 NAT traversal 的情况下，两台设备会尝试建立直接 UDP 连接：

```text
Laptop
   ╲
    ╲ WireGuard encrypted P2P
     ╲
      NAS
```

也就是说，真实业务数据不一定一直绕某个中央 VPN 服务器。

如果直连失败，才会退回到 Relay 路径。

官方文档也明确指出这些连接都使用 WireGuard 端到端加密；直连与 Relay 的主要差异更多体现在路径、吞吐和延迟，而不是“Relay 就变成明文”。

## 这和 FRP 的思维完全不一样

FRP 经典模型：

```text
客户端
  ↓
固定公网 frps
  ↓
frpc
  ↓
服务
```

Tailscale 理想模型：

```text
Device A
  ↓
NAT traversal
  ↓
Device B
```

中间的控制面负责身份、密钥协调、节点信息等，但能够直连时，数据面尽可能直接走 P2P。

因此如果我要的是：

```text
我自己的电脑 SSH VPS
我自己的手机访问 NAS
实验室几台机器互相通信
```

我根本不需要把 SSH / SMB / Database 暴露成公共 Internet Service。

这才是 Tailscale 特别舒服的场景。

---

# 四、三种方案最根本的差异：谁是“入口”？

把它们压缩到一张图：

## Cloudflare Tunnel

```text
Public User
    ↓
Cloudflare Edge   ← 公网入口
    ↓
cloudflared
    ↓
Internal Service
```

## FRP

```text
Public User
    ↓
Your VPS / frps   ← 公网入口
    ↓
frpc
    ↓
Internal Service
```

## Tailscale

```text
Authorized Device A
       ↕
 Private Overlay / P2P
       ↕
Authorized Device B
```

Tailscale 通常根本没有一个“所有 Internet 用户都来这里”的公网入口。

于是一个非常实用的选型问题出现了：

> **我的用户是整个 Internet，还是一组已授权设备？**

如果答案是“整个 Internet”，你大概率在讨论 Public Ingress。

如果答案是“我自己的几台设备”，你大概率应该先考虑 Private Overlay，而不是急着做公网端口映射。

---

# 五、NAT：三者都绕过去了，但方法并不一样

NAT 是这些工具总被放到一起的原因。

家庭网络里经常是：

```text
192.168.1.20
     ↓
Home Router NAT
     ↓
ISP / Internet
```

Internet 无法直接凭一个私网地址去连接 `192.168.1.20`。

三者采用不同思路。

## Cloudflare Tunnel：不要求外界连接进来

```text
cloudflared
    ↓ outbound
Cloudflare
```

只要内网可以向外建立必要连接，就能维持 Tunnel。

这相当于绕开“如何从 Internet 主动打进 NAT”这个问题。

## FRP：内网主动连接一个稳定公网服务器

```text
frpc
   ↓ outbound
frps(public VPS)
```

Internet 只需要能访问 frps。

真正的内网机器不需要自己拥有公网地址。

## Tailscale：先尝试 NAT Traversal，再决定要不要 Relay

Tailscale 会尝试让双方找到可直接通信的路径。

成功：

```text
Peer A ↔ Peer B
```

失败：

```text
Peer A → Relay → Peer B
```

所以它关心的是：

```text
“两个成员能不能建立最优私网路径”
```

而不是：

```text
“我要在哪个公网服务器暴露 6000 端口”
```

---

# 六、Control Plane 和 Data Plane 不要混在一起看

这是我觉得分析这类工具时非常有用的一组概念。

## Control Plane：谁决定“谁能和谁通信”

它负责：

- 节点发现；
- 配置；
- 身份；
- 策略；
- 路由信息；
- Tunnel / Session 建立。

## Data Plane：真实业务字节最后从哪里走

例如：

```text
HTTP body
SSH packet
SMB data
数据库连接
```

真实数据路径不一定和控制面路径相同。

### Cloudflare Tunnel

```text
Control Plane / Edge：Cloudflare
Data Plane：Client → Cloudflare → Tunnel → Origin
```

### 经典 FRP

```text
Control：frps / frpc
Data：Client → frps → frpc → Service
```

FRP 也存在 xtcp 等 P2P 模式，但经典公开代理模型仍然是 frps 作为公网锚点；官方也明确提醒 xtcp 的 NAT 穿透并非所有 NAT 环境都能成功。

### Tailscale

```text
Control Plane：协调节点身份与连接信息
Data Plane：优先 Direct WireGuard
           不行再 Relay
```

这就是为什么只看“都能远程访问 NAS”完全不足以判断它们的架构。

---

# 七、安全边界也不是同一件事

“使用 Tunnel 就安全”“用了 WireGuard 就安全”这种一句话判断都太粗。

更应该先问：

```text
谁可以发起访问？
公网暴露了什么？
认证在哪里？
密钥在哪里？
源站还开放了什么？
管理面暴露了吗？
```

## Cloudflare Tunnel 的安全边界

如果只发布一个 Web App，可以设计成：

```text
Internet
   ↓
Cloudflare Edge / Access Policy
   ↓
Tunnel
   ↓
Origin
```

源站无需传统公网入站端口，但你仍然要保护：

- `cloudflared` credential；
- Cloudflare 账户；
- Zero Trust 策略；
- Origin 本身；
- 其他旁路入口。

## FRP 的安全边界

如果你把：

```text
VPS:6000 → LAN:22
```

直接发布到 Internet，那么公网 SSH 本身仍然是公网 SSH。

FRP 只是改变了路径，不会把一个本来需要认证和加固的服务自动变成“无风险服务”。

你还需要考虑：

- frpc ↔ frps 认证；
- 公网端口；
- 服务自身认证；
- VPS 防火墙；
- 日志和暴力扫描；
- TLS / Token / ACL 等策略。

## Tailscale 的安全边界

它更容易形成：

```text
Internet 上的人
       ✕
不能直接访问私有服务

Tailnet Authorized Device
       ↓
Policy / Identity
       ↓
Private Service
```

这里的重点从“公网端口保护”转移到：

```text
设备身份
账户安全
ACL / Grants
节点密钥
Tailnet Policy
```

它不是没有安全问题，而是**安全边界换了一个位置**。

---

# 八、性能：不要只看“有没有中转”

最粗略的延迟模型：

```text
Total Latency
≈ Access Path
+ Relay / Edge Path
+ Origin Path
+ Application Processing
```

## Cloudflare Tunnel

数据会经过 Cloudflare Edge，再沿 Tunnel 到源站。

对于公网 Web 来说，这并不一定是坏事，因为 CDN / Edge 本来就是架构的一部分。

你优化的目标通常不是：

```text
“绝对最短 P2P RTT”
```

而是：

```text
全球公网入口
TLS
缓存
WAF
稳定 Origin Connectivity
```

## FRP

如果是经典中继：

```text
User → VPS → LAN
```

那么 VPS 地理位置、带宽、线路、CPU、内核网络栈都会直接进入性能路径。

所以 FRP 服务器的位置非常重要。

## Tailscale

如果 Direct：

```text
A → B
```

通常拥有最短路径。

如果只能 DERP / Peer Relay：

```text
A → Relay → B
```

吞吐和延迟就会受 Relay 路径影响。

Tailscale 官方文档也明确把“直连通常具有更低延迟和更高吞吐”作为重要区别。

所以排查 Tailscale 性能时，一个关键问题不是：

```text
“WireGuard 快不快？”
```

而是：

```text
“当前到底是 Direct 还是 Relayed？”
```

---

# 九、五个真实场景，我会怎么选

## 场景 1：把内部 Web Dashboard 安全地发布给公网用户

需求：

```text
域名访问
HTTPS
不想给源站开放公网端口
希望叠 WAF / Access
```

更自然：

```text
Cloudflare Tunnel
```

因为它本身就在解决“Web Origin → Cloudflare Public Edge”的问题。

## 场景 2：我只想从自己的笔记本 SSH 回家里的机器

需求：

```text
不想公网开放 22
只有自己的设备访问
```

更自然：

```text
Tailscale
```

因为这根本没必要变成公网服务。

## 场景 3：我要转发一个比较特殊的 TCP / UDP 服务，并且必须使用自己的 VPS

需求：

```text
自控公网 IP
自控端口
非标准 Web 协议
愿意运维 VPS
```

更自然：

```text
FRP
```

## 场景 4：临时给别人演示本地 Web 项目

如果对方只是浏览器用户，而且希望快速用域名 / HTTPS 打开：

```text
Cloudflare Tunnel
```

如果演示对象是自己团队里已经加入私网的设备：

```text
Tailscale
```

关键不是工具流行度，而是“访问者是什么身份”。

## 场景 5：五台 VPS + 家庭 NAS + 笔记本形成管理网络

这种场景我最不想做的是：

```text
每台机器都公网开放 SSH
```

更清晰的结构是：

```text
Tailscale Management Plane

Laptop ───── VPS-A
   ├──────── VPS-B
   ├──────── NAS
   └──────── Home Server
```

公网 Web 服务继续走自己的 443 / CDN / Tunnel，而运维面单独走私网。

这叫**分离用户流量和管理流量**。

---

# 十、其实三种工具可以同时存在

选型最容易陷入的一个误区是：

> “既然装了 Tailscale，是不是就不需要 Tunnel / FRP 了？”

实际系统完全可以分层：

```text
                    Public Users
                         │
                         ▼
                 Cloudflare Edge
                         │
                    Tunnel / HTTPS
                         │
                         ▼
                 ┌──────────────┐
                 │ Web Service  │
                 └──────────────┘
                         ▲
                         │ localhost/private
                         │
Admin Laptop ─ Tailscale ─ Server
                         │
                         └─ Special TCP Service
                                   ▲
                                   │
                            FRP（如确有需要）
```

职责可以是：

```text
Cloudflare Tunnel
→ 公网 Web Ingress

Tailscale
→ 私有管理网络

FRP
→ 某些必须自控公网中继的特殊 TCP/UDP 服务
```

这比试图让一个工具承担所有网络角色更容易理解。

---

# 十一、我现在会用这张决策表

| 问题 | Cloudflare Tunnel | FRP | Tailscale |
| --- | --- | --- | --- |
| 核心角色 | 托管边缘公网入口 | 自建反向代理 / 中继 | 私有 Overlay Mesh |
| 典型访问者 | Internet 用户 | Internet / 指定客户端 | Tailnet 成员 |
| 需要自己有公网 VPS | 否 | 经典模式通常是 | 否 |
| 内网侧是否主动连出 | 是 | 是 | 是 / 节点建立协调连接 |
| 公网入口归谁控制 | Cloudflare | 自己 | 通常无公共入口 |
| 典型数据路径 | User → CF → Origin | User → frps → frpc | 优先 Peer ↔ Peer |
| NAT 处理思路 | 出站 Tunnel | 出站连接公网 frps | NAT traversal + Relay fallback |
| Web 边缘能力 | 很强 | 自己组合 | 不是核心定位 |
| TCP/UDP 自定义映射 | 不是传统端口映射思路 | 强 | 私网直接访问服务 |
| 私有设备 Mesh | 不是该产品主要目标 | 可以拼，但不是核心模型 | 核心能力 |
| 运维责任 | 边缘托管较多 | 自己承担较多 | Overlay 控制较轻 |

这张表里没有“总分”。

因为它们参加的其实不是同一个考试。

---

# 十二、一个真正重要的反模式：为了远程访问，把所有东西都公网化

很多自托管服务最初的路径是：

```text
我要从外面访问
   ↓
那我做端口转发
   ↓
那我开放公网端口
   ↓
那我给每个服务做域名
   ↓
结果 NAS、SSH、数据库、面板全暴露了
```

其实第一步应该问：

```text
这个服务真的需要被“所有互联网用户”访问吗？
```

如果答案是否定的，那么：

```text
Public Ingress
```

本身可能就是错误抽象。

例如：

```text
SSH
数据库管理端
Proxmox / 1Panel 管理页
内部 Grafana
NAS 管理端
```

很多时候更适合放进 Private Overlay。

公开博客 / API / 对外网站再走公共入口。

把：

```text
Public Plane
```

和：

```text
Management Plane
```

拆开，是我认为自托管网络架构里非常值钱的一步。

---

# 十三、出问题时怎么排？先判断是哪一个平面坏了

## Cloudflare Tunnel

可以分：

```text
DNS
  ↓
Cloudflare Edge
  ↓
Tunnel status
  ↓
cloudflared
  ↓
local origin
```

如果 `localhost:3000` 自己就打不开，先别怪 Tunnel。

## FRP

可以分：

```text
Public port
  ↓
frps listening
  ↓
frpc connected
  ↓
proxy registered
  ↓
local service
```

如果 frpc 都没有在线，外面改 Nginx 没意义。

## Tailscale

可以分：

```text
Node authenticated?
  ↓
Policy allowed?
  ↓
Route exists?
  ↓
Direct or Relay?
  ↓
Target service listening?
```

把链路分层以后，“内网穿透坏了”这种模糊描述会变成一个具体的状态断点。

---

# 十四、我对“内网穿透”这个词现在的理解

它适合作为一个方便交流的口语词，但不适合作为架构设计的终点。

因为这个词把太多不同问题揉到了一起：

```text
NAT traversal
Reverse Proxy
Relay
Public Ingress
VPN
Overlay Network
Identity-aware networking
Edge Proxy
```

真正做系统时，我更愿意用这些问题替代：

```text
1. 谁需要访问？公网用户还是受信设备？
2. 公网入口在哪里？
3. 内网机器是否需要开放入站？
4. 谁拥有中继服务器？
5. 数据面是不是固定绕中继？
6. 身份认证发生在哪一层？
7. 是发布一个服务，还是连接整个设备网络？
8. 失败时依赖哪个第三方控制面？
9. 我愿意承担多少基础设施运维？
10. 这条链路传的是 Web 请求，还是任意 TCP/UDP？
```

回答完这十个问题，工具选择通常已经很明显。

## 结语

Cloudflare Tunnel、FRP、Tailscale 都能让“原本不好访问的机器”变得可达。

但它们的核心心智模型分别是：

```text
Cloudflare Tunnel
= 把 Origin 接到托管的 Public Edge

FRP
= 把 LAN Service 反向接到自己的 Public Relay

Tailscale
= 把 Devices 组成一个 Private Overlay Network
```

所以与其问：

> “哪一个内网穿透最好？”

不如先问：

> **“我要构建的是公网入口、自建中继，还是私有设备网络？”**

网络工具最怕用错抽象。

因为一开始只是“能不能连通”的问题，到了生产环境就会逐渐变成：

```text
谁拥有入口？
谁看到流量？
哪里认证？
哪里故障？
谁来运维？
数据实际绕了多远？
```

而这些问题，恰恰才决定一个方案最后是“能跑”，还是“长期好维护”。

---

### 参考资料

- Cloudflare Docs — Cloudflare Tunnel: https://developers.cloudflare.com/tunnel/
- Cloudflare Docs — Tunnel connectivity / firewall guidance: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/tunnel-with-firewall/
- frp Official Repository: https://github.com/fatedier/frp
- Tailscale Docs — Connection types: https://tailscale.com/docs/reference/connection-types
- Tailscale Docs — Device connectivity: https://tailscale.com/docs/reference/device-connectivity
- Tailscale Docs — Firewalls: https://tailscale.com/kb/1181/firewalls

> 本文重点讨论默认和典型架构，不试图覆盖每个产品的全部扩展功能。例如 FRP 还有 xtcp / stcp / VirtualNet，Tailscale 还有 Subnet Router、Exit Node、Funnel 等能力；具体落地时应继续以对应版本的官方文档为准。
