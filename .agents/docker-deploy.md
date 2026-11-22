# Docker 本地部署（Agent 操作手册）

面向在本仓库根目录执行 Docker Compose 一键部署的 agent。人工权威文档见：https://docs.aitoearn.ai/zh/use/installer

## 目标

在仓库根目录拉起完整栈，入口为 `http://localhost:8080`。首次启动会自动创建管理员并自动登录。Relay / 模型 API Key 不是启动硬门槛，可部署后再在 UI「配置管理」填写。

## 前置检查

| 项 | 要求 |
| --- | --- |
| Docker | 20.10+（`docker --version`） |
| Docker Compose | v2+（`docker compose version`） |
| openssl | 用于生成密钥 |
| 内存 / 磁盘 | 建议 ≥4GB / ≥20GB |
| 端口 | 空闲：8080、9000；另会占用 27017、6379、9001 |

工作目录必须是仓库根（含 `docker-compose.yml`）。不要在 `project/aitoearn-backend` 或 `project/aitoearn-web` 内执行根 compose。

## 密钥一致性规则（硬门槛）

`docker-compose.yml` 与两个 `config.yaml` **没有**内置认证密钥默认值。启动前必须满足：

| 配置项 | 位置 | 规则 |
| --- | --- | --- |
| `JWT_SECRET` | 当前 shell 环境变量 | ≥32 非空白字符；compose 用 `${JWT_SECRET:?...}` 注入 `aitoearn-init` |
| `auth.secret` | AI + server 两个 `config.yaml` | **必须等于** `JWT_SECRET` |
| `auth.internalToken` | AI + server 两个 `config.yaml` | ≥32；两边建议同一值 |
| `aiClient.token` | server `config.yaml` | **必须等于** AI 的 `auth.internalToken` |

文件路径：

- `project/aitoearn-backend/apps/aitoearn-ai/config/config.yaml`
- `project/aitoearn-backend/apps/aitoearn-server/config/config.yaml`

生成示例：

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
export INTERNAL_TOKEN="$(openssl rand -hex 32)"
```

写入两个 yaml 的 `auth` 段，并把 server 的 `aiClient.token` 设为 `INTERNAL_TOKEN`。只改认证相关字段，不要改动无关业务配置。

安全约束：

- **不要**把含真实密钥的 `config.yaml` 提交到公开仓库。
- 新开终端或重启机器后需重新 `export JWT_SECRET`（值必须与已有 `auth.secret` 一致），否则 `docker compose` 会拒绝启动。
- 更换 `auth.secret` 会使已签发登录 token 全部失效，需 recreate init + web。

## 启动命令

```bash
cd <repo-root>
export JWT_SECRET="<与 auth.secret 相同的值>"
docker compose config --quiet
docker compose up -d
docker compose ps
```

应用镜像使用 `pull_policy: always`，每次 `up` 会拉取最新 `aitoearn/{ai,server,web}:latest`。

验收：

1. `docker compose ps` 中 `mongodb`、`redis`、`rustfs`、`aitoearn-ai`、`aitoearn-server`、`aitoearn-web`、`nginx` 为 `healthy` 或 `running`。
2. `aitoearn-init` 日志含 `Token written to /data/init/token.txt` 与默认用户 `admin@aitoearn.local`。
3. `curl -sI -L http://localhost:8080/` 最终得到 HTTP 200。

## 架构速查

统一入口：Nginx `8080` → Web `/`、Server `/api/`、AI `/api/ai/` 与 `/api/agent/`、对象存储 `/oss/`；S3 API 另暴露宿主 `9000`。

关键文件（可写挂载，UI 配置管理可改，改后需重启对应服务）：

- AI：`project/aitoearn-backend/apps/aitoearn-ai/config/config.yaml` → 容器 `/app/config.yaml`
- Server：`project/aitoearn-backend/apps/aitoearn-server/config/config.yaml` → 容器 `/app/config.yaml`

本地自建镜像（非默认路径）：根目录 `scripts/build.sh`，然后 `docker compose up -d --pull never`。

## Relay / 环境规则（部署后）

| 环境 | Relay URL | API Key 来源 | 适用平台举例 |
| --- | --- | --- | --- |
| 中国版 | `https://aitoearn.cn/api` | `aitoearn.cn` 创建的 Key | 抖音、小红书、快手、B 站、视频号 |
| 国际版 | `https://aitoearn.ai/api` | `aitoearn.ai` 创建的 Key | TikTok、YouTube、X、Instagram、Threads |

Key 与 URL 不匹配会 401。TikTok 必须用国际版。在 UI「配置管理」→ Server → Relay 中转 填写后，点「保存并重启」；若只改了磁盘上的 `config.yaml`，执行：`docker compose restart aitoearn-server`。

默认 `relay.callbackUrl`：`http://localhost:8080/api/v2/channels/relay/callback`（本机 Docker）。其它机器/域名部署时改成可访问的公网或该环境入口 + `/api/v2/channels/relay/callback`。

## 完整部署清单（跨环境复用）

1. 安装 Docker 20.10+ / Compose v2+，确认端口 8080、9000 空闲。
2. 克隆仓库，进入根目录（含 `docker-compose.yml`）。
3. 生成并写入密钥：`JWT_SECRET`、两边 `auth.secret`/`auth.internalToken`、server `aiClient.token`（规则见上文）。
4. `export JWT_SECRET=...` → `docker compose up -d` → `docker compose ps` 全 healthy → 打开 `http://localhost:8080`（或该环境入口）。
5. 按目标平台选站创建 API Key；配置 Server Relay（URL+Key），保存并重启 server。
6. 频道管理 → 添加频道 → 选平台 → 完成 OAuth → 再去发布页发内容。
7. 密钥与 `config.yaml` 中的 `apiKey` **勿提交公开仓库**；新终端部署前重新 `export JWT_SECRET`。

## 下一步：以 TikTok 为例

前置：Server Relay 为国际版（`https://aitoearn.ai/api` + `.ai` Key），且 server 已重启加载配置。

1. 打开部署入口（本机 `http://localhost:8080`），确认已登录。
2. 打开「频道管理」→「添加频道」→ 选择 **TikTok**。
3. 浏览器弹出 TikTok OAuth；用目标 TikTok 账号登录并授权。
4. 回到 AiToEarn，等待授权成功，频道列表出现该账号。
5. 进入发布流程：新建作品 → 选 TikTok 账号 → 上传符合平台限制的视频/文案 → 发布（或定时）。
6. 在「我的发布 / 发布历史」查看结果；失败则查 `docker compose logs aitoearn-server`。

若点击 TikTok 时被提示切站/不可用：当前前端区域与国际平台不匹配，或 Relay 未生效（未重启 / Key 与 URL 错配）。

### 授权成功但发布报「无效URL」

日志特征：`POST /v2/channels/publish/flows` → `ZodValidationException` / `无效URL` / `Invalid hostname`。

原因：本地默认 `assets.cdnEndpoint` 为 `http://localhost:8080/oss`，Zod `z.url()` 不接受无公网 TLD 的 hostname；即便放宽校验，Relay（`aitoearn.ai`）也**拉不到**你本机的 localhost 素材。

处理（任选其一）：

1. **推荐**：走官方云端「资源上传」拿公网 URL（见下一节），再调发布 API / 填入发布参数。
2. 用 ngrok / Cloudflare Tunnel 等把本机 `8080` 暴露为公网 HTTPS，把两个 `config.yaml` 的 `assets.cdnEndpoint`（及必要时 `publicEndpoint`）改成该公网地址，`docker compose restart aitoearn-server aitoearn-ai`，**重新上传**素材后再发。
3. 纯本机自测、不经 Relay 的场景才考虑改校验；经 Relay 发 TikTok 必须公网可达 URL。

授权成功信号：`POST /v2/channels/relay/callback` → `createRelayAccountRecord`；随后 status 轮询 `status: completed` 且账号出现在 `/v2/channels/accounts`。

### 官方资源上传拿公网 URL（本地 Docker 发布素材）

权威文档：https://docs.aitoearn.ai/zh/use/asset-upload

要点：

- 上传目标是 **官方云**（`aitoearn.ai` / `aitoearn.cn`），不是本地 `localhost:8080` 的 RustFS。
- TikTok 等国际平台用 **国际站**：`https://aitoearn.ai` + 在 aitoearn.ai 创建的同一把 `X-Api-Key`（可与 Server Relay Key 同源）。
- 中国平台用 `https://aitoearn.cn` + 中国站 Key。
- 最终只用确认接口返回的 `data.url`（通常 `assets.aitoearn.ai/...` 或 `assets.aitoearn.cn/...`），不要用 `uploadUrl`。

三步（把 `<API_KEY>`、`./demo.jpg` 换成实际值）：

```bash
# 1) 签名（国际站示例）
SIZE=$(wc -c < ./demo.jpg | tr -d ' ')
SIGN=$(curl -sS -X POST 'https://aitoearn.ai/api/assets/uploadSign' \
  -H 'Content-Type: application/json' \
  -H "X-Api-Key: <API_KEY>" \
  -d "{\"filename\":\"demo.jpg\",\"type\":\"publishMedia\",\"size\":$SIZE}")
echo "$SIGN" | python3 -m json.tool
ID=$(echo "$SIGN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["id"])')
UPLOAD_URL=$(echo "$SIGN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["uploadUrl"])')

# 2) 直传到对象存储（不要带 X-Api-Key）
curl -sS -X PUT "$UPLOAD_URL" \
  -H 'Content-Type: image/jpeg' \
  --data-binary @./demo.jpg

# 3) 确认，取公网 URL
CONFIRM=$(curl -sS -X POST "https://aitoearn.ai/api/assets/${ID}/confirm" \
  -H "X-Api-Key: <API_KEY>")
echo "$CONFIRM" | python3 -m json.tool
PUBLIC_URL=$(echo "$CONFIRM" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["url"])')
echo "PUBLIC_URL=$PUBLIC_URL"
```

拿到 `PUBLIC_URL` 后：写入发布流程的 `content.media[n].url` / `content.cover.url`（见 https://docs.aitoearn.ai/zh/use/publish-flow）。

本地 Web「新建作品 → 选择文件」在已配置 `relay.serverUrl` / `relay.apiKey` 时，会经本机 `POST /assets/publishMedia/uploadSign` 与 `.../confirm` 代理官方云上传，发布 payload 直接使用返回的公网 URL；未配置 Relay 时仍会落到本机 localhost OSS 并触发「无效URL」。

## 常见失败与修复

| 现象 | 处理 |
| --- | --- |
| `required variable JWT_SECRET is missing` | `export JWT_SECRET` 为与 `auth.secret` 相同的值 |
| init 报密钥长度 / 空白 | 重新生成 ≥32 hex，同步写入两个 `auth.secret` |
| server / ai 反复重启 | 检查 `auth.*` 与 `aiClient.token` 是否为空或互不一致；`docker compose logs aitoearn-server` / `aitoearn-ai` |
| 页面能开但不自动登录 | 对齐密钥后：`docker compose up -d --force-recreate aitoearn-init aitoearn-web` |
| 调用 AI 401 | server `aiClient.token` 必须等于 AI `auth.internalToken`，然后 `docker compose restart aitoearn-server` |
| 发布 `无效URL` / `Invalid hostname` | 素材 URL 是 `localhost` 等非公网域名；换公网 URL 或 tunnel 后重传（见上文） |

有用日志：

```bash
docker compose logs aitoearn-init
docker compose logs aitoearn-server
docker compose logs aitoearn-ai
```

## Agent 行为边界

- 根目录维护 compose / nginx / scripts；不要到子项目目录找另一套生产 compose。
- 默认口令（Mongo `admin`/`password`、Redis `password`、RustFS `rustfsadmin`）仅适合本机/演示；生产应另行加固。
- 用户可见 README 三语与官方 docs 站是对外文档；本文件是 agent 操作手册。改 Docker 部署流程时优先更新本文件，并核对官方 docs 是否需同步说明。
- 纯文档改动至少运行 `git diff --check`。
