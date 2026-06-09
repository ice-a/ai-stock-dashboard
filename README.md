# AI Stock Dashboard

面向个人研究和持仓跟踪的股票看板。项目以 Vue 3 + Vite 构建，提供多源行情降级、自定义单股查询、热门股票、个人持仓盈亏、预警中心、AI 研究助手和站点密码保护。

## 功能概览

- **多源行情降级**：按东方财富、Sina、长桥和静态快照顺序尝试，单个数据源失败不会阻塞页面。
- **服务端密钥**：AI 和访问密码都从服务端环境变量读取，不把敏感配置打进前端包。
- **站点密码保护**：设置 `SITE_PASSWORD` 后，Vercel Middleware 会在访问网站前要求登录；登录态使用 HttpOnly Cookie。
- **MongoDB 账户配置**：配置 `MONGODB_URI` 后启用 user/sign 登录或自动注册，个人设置、自选股、持仓、板块和 AI 模型配置可保存到 MongoDB。
- **单股查询**：左侧菜单「自定义查询」，支持名称/代码搜索、标准代码直达、热门股票报价。
- **个人持仓**：记录买入/卖出交易流水，按 FIFO 扣减仓位，自动计算成本、市值、浮动盈亏、已实现盈亏和累计收益率。
- **预警中心**：支持价格突破/跌破、单日涨跌幅、持仓盈亏、行情过期和静态快照源预警。
- **AI 研究助手**：支持 OpenAI 兼容接口，既可本地配置，也可通过服务端 `AI_*` 环境变量托管 API Key。
- **研究报告库**：个股 AI 建议自动归档，支持 2-6 只股票横向对比分析。
- **研究板块与自选股**：内置 AI、半导体、新能源、生物科技等板块，支持自选备注、目标价和详情页 K 线。
- **适配 Vercel**：包含 API Routes、Middleware、Vite 构建配置，并移除了超出 Vercel 函数体积限制的 Longbridge 原生依赖。

## 技术栈

- Vue 3.5, Vite 6, TypeScript 5.7
- Vue Router, Pinia, vue-i18n
- ECharts, vue-echarts
- Vercel API Routes + Middleware

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

默认开发地址：

```text
http://localhost:5173
```

常用命令：

```bash
npm run typecheck
npm run test
npm run build
npm run verify
npm run preview
```

## 环境变量

`.env.example` 只保留最小模板。生产部署建议在 Vercel Project Settings 中配置，不要提交真实 `.env`。

配置读取入口已经收口到 `src/server/env.ts`，非敏感运行时配置由 `src/server/runtimeConfig.ts` 输出给前端 `/api/config`。前端不会读取未加 `VITE_` 前缀的密钥，AI Key、长桥凭证和站点密码都只在服务端使用。

### 最小配置

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SITE_PASSWORD` | 可选 | 网站访问密码。为空时关闭密码保护 |
| `AI_API_KEY` | 可选 | 服务端托管 OpenAI 兼容 API Key；为空时可在浏览器设置页配置 |
| `AI_MODEL` | 可选 | 服务端默认模型 |
| `MONGODB_URI` | 可选 | MongoDB 连接串。配置后启用 user/sign 账户和个人配置云端存储 |

### 进阶配置

站点访问控制：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SITE_AUTH_COOKIE_NAME` | 否 | 登录 Cookie 名称，默认 `ai_dashboard_auth` |
| `SITE_AUTH_MAX_AGE_SECONDS` | 否 | 登录有效期，默认 `604800` |
| `SITE_AUTH_MAX_ATTEMPTS` | 否 | 5 分钟内登录失败次数限制，默认 `10` |

AI 服务端托管：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AI_BASE_URL` | 否 | OpenAI 兼容接口地址，默认 `https://api.openai.com/v1` |
| `AI_TEMPERATURE` | 否 | 默认 `0.7` |
| `AI_MAX_TOKENS` | 否 | 默认 `2000` |

也兼容 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。

MongoDB 账户：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `MONGODB_URI` | 否 | MongoDB 连接串；为空时账户系统关闭，配置只保存在浏览器 |
| `MONGODB_DB_NAME` | 否 | 数据库名，默认 `ai_stock_dashboard` |
| `USER_AUTH_COOKIE_NAME` | 否 | 账户登录 Cookie 名称，默认 `ai_dashboard_user` |
| `USER_AUTH_SECRET` | 否 | 账户 Cookie 签名密钥；建议生产环境显式配置 |
| `USER_AUTH_MAX_AGE_SECONDS` | 否 | 账户登录有效期，默认 `2592000` |

长桥备用行情：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `LONGPORT_APP_KEY` | 可选 | 长桥 OpenAPI App Key，用于备用认证数据源 |
| `LONGPORT_APP_SECRET` | 可选 | 长桥 OpenAPI App Secret，用于服务端签名 |
| `LONGPORT_ACCESS_TOKEN` | 可选 | 长桥 OpenAPI Access Token，用于服务端行情接口 |
| `LONGPORT_REGION` | 否 | 中国区凭证填 `cn`；默认全球区/香港区 |
| `LONGPORT_HTTP_URL` | 否 | 默认全球区 `https://openapi.longportapp.com`；`LONGPORT_REGION=cn` 时为 `https://openapi.longportapp.cn` |
| `LONGPORT_QUOTE_WS_URL` | 否 | 默认全球区 `wss://openapi-quote.longportapp.com`；`LONGPORT_REGION=cn` 时为 `wss://openapi-quote.longportapp.cn` |

兼容旧变量名 `LONGBRIDGE_APP_KEY`、`LONGBRIDGE_APP_SECRET`、`LONGBRIDGE_ACCESS_TOKEN`、`LONGBRIDGE_REGION`，但推荐使用官方文档的 `LONGPORT_*`。传统 OpenAPI API Key 模式需要 `APP_KEY`、`APP_SECRET`、`ACCESS_TOKEN` 三项；如果 `ACCESS_TOKEN` 是 `Bearer ...` 格式，会按 OAuth/Bearer 模式请求，不生成 HMAC 签名。当前 Vercel 版本使用纯 JS 长桥 OpenAPI 协议客户端，不安装 Longbridge 官方 Node SDK，因为其 Linux 原生 binding 会超过 Vercel Serverless Function 250 MB 解压体积限制。

应用默认值：

| 变量 | 说明 |
| --- | --- |
| `APP_LIST_REFRESH_SECONDS` | 列表行情刷新间隔 |
| `APP_DETAIL_REFRESH_SECONDS` | 详情页刷新间隔 |

## 请求地址

项目内部 API 路径和外部服务地址统一维护在 `src/config/endpoints.ts`。新增请求时优先复用这里的常量，不要在组件或 store 中散落硬编码 URL。

### 内部 API

| 路径 | 调用方 | 说明 |
| --- | --- | --- |
| `/api/config` | 前端启动 | 返回非敏感运行时配置 |
| `/api/auth/status` | 登录页 | 返回密码保护状态和 Cookie 登录状态 |
| `/api/auth/login` | 登录页 | 校验密码并写入 HttpOnly Cookie |
| `/api/auth/logout` | 设置页/用户操作 | 清除登录 Cookie |
| `/api/account/status` | 登录页/设置页 | 返回 MongoDB 账户系统状态和当前用户 |
| `/api/account/register` | 登录页 | 使用 user/sign 登录或自动创建账户并写入 HttpOnly Cookie |
| `/api/account/login` | 登录页 | 使用 user/sign 登录或自动创建账户并写入 HttpOnly Cookie |
| `/api/account/logout` | 设置页 | 清除账户 Cookie |
| `/api/account/config` | 设置页/启动同步 | 读取或保存当前用户个人配置 |
| `/api/ai/models` | 设置页 | 服务端托管 AI 模型列表 |
| `/api/ai/chat` | AI 分析 | 服务端托管非流式 Chat Completions |
| `/api/ai/chat-stream` | AI 问答 | 服务端托管流式 Chat Completions |
| `/api/longbridge/status` | 数据源设置 | 返回长桥配置状态 |
| `/api/longbridge/quotes` | 行情源 | 长桥实时报价 |
| `/api/longbridge/candlesticks` | K 线 | 长桥 K 线 |
| `/api/market?source=eastmoney` | 行情/公告/新闻 | 东方财富服务端代理 |
| `/api/market?source=sina` | 行情源 | 新浪财经服务端代理 |
| `/api/ai-proxy/{base64_origin}/{path}` | 仅本地开发 | Vite dev server 下给用户自填 AI Key 绕过 CORS |

### 外部服务

| 服务 | 默认地址 | 用途 |
| --- | --- | --- |
| OpenAI 兼容接口 | `https://api.openai.com/v1` | `/models`、`/chat/completions` |
| LongPort HTTP | `https://openapi.longportapp.com` / `https://openapi.longportapp.cn` | Socket OTP |
| LongPort Quote WS | `wss://openapi-quote.longportapp.com` / `wss://openapi-quote.longportapp.cn` | 实时报价与 K 线 WebSocket |
| 东方财富 | `push2*.eastmoney.com`、`searchapi.eastmoney.com` 等 | 行情、搜索、公告、新闻 |
| 新浪财经 | `https://hq.sinajs.cn` | A/H/美股行情兜底 |
| Hitokoto | `https://v1.hitokoto.cn/` | 顶部一句话 |

## 官方文档

本项目按以下官方文档约束实现：

| 模块 | 官方文档 | 项目对应 |
| --- | --- | --- |
| Vite 环境变量 | [Env Variables and Modes](https://vite.dev/guide/env-and-mode) | 服务端密钥不使用 `VITE_` 前缀，避免打包进浏览器 |
| Vercel 环境变量 | [Environment Variables](https://vercel.com/docs/environment-variables) | 生产环境在 Project Settings 配置 `SITE_PASSWORD`，以及可选 `MONGODB_URI` / `AI_*` / `LONGPORT_*` |
| Vercel Node.js Functions | [Node.js Runtime](https://vercel.com/docs/functions/runtimes/node-js) | `api/index.ts` 单一函数分发服务端 API，避免 Hobby 计划函数数量限制 |
| Vercel 项目配置 | [Project Configuration](https://vercel.com/docs/project-configuration) | `vercel.json` 负责 SPA rewrite 和静态资源缓存 |
| OpenAI Chat Completions | [Create chat completion](https://platform.openai.com/docs/api-reference/chat/create) | `src/server/aiService.ts` 请求 `/chat/completions` |
| OpenAI Models | [List models](https://platform.openai.com/docs/api-reference/models/list) | 设置页模型列表请求 `/models` |
| LongPort OpenAPI | [LongPort OpenAPI Docs](https://open.longportapp.com/docs) | 长桥 HTTP + WebSocket 协议客户端 |

## Vercel 部署

1. Fork 或推送本仓库到 GitHub。
2. 在 Vercel 导入项目。
3. Framework 选择 Vite，Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
4. 在 Environment Variables 中配置 `SITE_PASSWORD`，以及可选 `MONGODB_URI` / `USER_AUTH_SECRET` / `AI_API_KEY` / `AI_MODEL`。长桥变量只在需要备用长桥行情时配置。
5. 部署后访问站点，会先进入 `/login`。

项目已在 `package.json` 中指定 Node 22，Vercel 使用默认 npm 安装流程。默认行情链路会优先请求东方财富，失败后自动降级到 Sina、长桥和静态快照。所有 `/api/*` 路由由 `api/index.ts` 统一分发，`/api/longbridge/*` 使用纯 JS 协议客户端，不打包 Longbridge 官方 Node SDK。

## 项目结构

```text
api/
  account/            # MongoDB 账户、登录和个人配置同步
  ai/                 # 服务端 AI 代理
  auth/               # 登录、登出、状态
  longbridge/         # 长桥行情 API
src/
  api/                # 前端 API 客户端和数据源调度
  components/         # 通用组件
  config/             # 内部 API 路径和外部服务地址
  data/               # 热门股票、静态兜底数据
  router/             # 路由
  server/             # 服务端共享逻辑：环境变量、认证、长桥、AI、运行时配置
  stores/             # Pinia stores
  styles/             # 设计变量和全局样式
  views/              # 页面
middleware.ts         # Vercel 访问控制
vercel.json           # Vercel 构建与缓存配置
```

## 数据说明

- Vercel 版本会优先使用东方财富公开接口；若请求失败，会自动降级到 Sina、长桥等数据源。Yahoo 行情源已移除；雪球公开接口通常依赖登录 Cookie，暂不作为默认数据源。长桥官方 Node SDK 因原生包体积限制暂不打包。
- AI 输出仅作研究辅助，不构成投资建议。
- 未配置 `MONGODB_URI` 时，个人持仓和配置保存在浏览器 `localStorage`。配置 `MONGODB_URI` 并登录账户后，可在设置页手动保存/载入个人配置；AI API Key 若保存在个人配置中会写入你的 MongoDB，请使用私有数据库并设置强 `USER_AUTH_SECRET`。

## License

仅作个人研究工具使用，不构成投资建议。
