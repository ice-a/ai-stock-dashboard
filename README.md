# AI Stock Dashboard

面向个人研究和持仓跟踪的股票看板。项目以 Vue 3 + Vite 构建，提供多源行情降级、自定义单股查询、热门股票、个人持仓盈亏、AI 研究助手和站点密码保护。

## 功能概览

- **多源行情降级**：按长桥、Sina、东方财富、Yahoo 和静态快照顺序尝试，单个数据源失败不会阻塞页面。
- **服务端密钥**：AI 和访问密码都从服务端环境变量读取，不把敏感配置打进前端包。
- **站点密码保护**：设置 `SITE_PASSWORD` 后，Vercel Middleware 会在访问网站前要求登录；登录态使用 HttpOnly Cookie。
- **单股查询**：左侧菜单「自定义查询」，支持名称/代码搜索、标准代码直达、热门股票报价。
- **个人持仓**：记录股票、买入价、手续费、购买日期和数量，自动计算成本、市值、浮动盈亏和收益率。
- **AI 研究助手**：支持 OpenAI 兼容接口，既可本地配置，也可通过服务端 `AI_*` 环境变量托管 API Key。
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
npm run build
npm run preview
```

## 环境变量

`.env.example` 包含完整模板。生产部署建议在 Vercel Project Settings 中配置，不要提交真实 `.env`。

### 站点访问控制

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `SITE_PASSWORD` | 推荐 | 网站访问密码。为空时关闭密码保护 |
| `SITE_AUTH_SECRET` | 推荐 | Cookie 签名密钥。为空时使用 `SITE_PASSWORD` |
| `SITE_AUTH_MAX_AGE_SECONDS` | 否 | 登录有效期，默认 `604800` |

### 长桥行情

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `LONGPORT_APP_KEY` | 推荐 | 长桥 OpenAPI App Key，用于优先数据源 |
| `LONGPORT_APP_SECRET` | 推荐 | 长桥 OpenAPI App Secret，用于服务端签名 |
| `LONGPORT_ACCESS_TOKEN` | 推荐 | 长桥 OpenAPI Access Token，用于服务端行情接口 |
| `LONGPORT_REGION` | 否 | 中国区凭证填 `cn`；默认全球区/香港区 |
| `LONGPORT_HTTP_URL` | 否 | 默认全球区 `https://openapi.longportapp.com`；`LONGPORT_REGION=cn` 时为 `https://openapi.longportapp.cn` |
| `LONGPORT_QUOTE_WS_URL` | 否 | 默认全球区 `wss://openapi-quote.longportapp.com`；`LONGPORT_REGION=cn` 时为 `wss://openapi-quote.longportapp.cn` |

兼容旧变量名 `LONGBRIDGE_APP_KEY`、`LONGBRIDGE_APP_SECRET`、`LONGBRIDGE_ACCESS_TOKEN`、`LONGBRIDGE_REGION`，但推荐使用官方文档的 `LONGPORT_*`。传统 OpenAPI API Key 模式需要 `APP_KEY`、`APP_SECRET`、`ACCESS_TOKEN` 三项；如果 `ACCESS_TOKEN` 是 `Bearer ...` 格式，会按 OAuth/Bearer 模式请求，不生成 HMAC 签名。当前 Vercel 版本使用纯 JS 长桥 OpenAPI 协议客户端，不安装 Longbridge 官方 Node SDK，因为其 Linux 原生 binding 会超过 Vercel Serverless Function 250 MB 解压体积限制。

### AI 服务端托管

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AI_BASE_URL` | 否 | OpenAI 兼容接口地址，默认 `https://api.openai.com/v1` |
| `AI_API_KEY` | 可选 | 配置后前端不需要保存 API Key |
| `AI_MODEL` | 可选 | 默认模型 |
| `AI_TEMPERATURE` | 否 | 默认 `0.7` |
| `AI_MAX_TOKENS` | 否 | 默认 `2000` |

也兼容 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`。

### 应用默认值

| 变量 | 说明 |
| --- | --- |
| `APP_LIST_REFRESH_SECONDS` | 列表行情刷新间隔 |
| `APP_DETAIL_REFRESH_SECONDS` | 详情页刷新间隔 |

## Vercel 部署

1. Fork 或推送本仓库到 GitHub。
2. 在 Vercel 导入项目。
3. Framework 选择 Vite，Build Command 使用 `npm run build`，Output Directory 使用 `dist`。
4. 在 Environment Variables 中配置上面的 `SITE_PASSWORD` 和 `LONGPORT_*`，以及可选 `AI_*`。
5. 部署后访问站点，会先进入 `/login`。

项目已在 `package.json` 中指定 Node 22，Vercel 使用默认 npm 安装流程。`/api/longbridge/*` 使用纯 JS 协议客户端，不打包 Longbridge 官方 Node SDK；默认行情链路会优先请求长桥，失败后自动降级到 Sina、东方财富、Yahoo 和静态快照。

## API Routes

| 路径 | 说明 |
| --- | --- |
| `/api/auth/status` | 返回密码保护状态和当前 Cookie 登录状态 |
| `/api/auth/login` | 校验 `SITE_PASSWORD`，写入 HttpOnly Cookie |
| `/api/auth/logout` | 清除登录 Cookie |
| `/api/config` | 返回非敏感运行时配置 |
| `/api/longbridge/status` | 返回长桥入口配置状态 |
| `/api/longbridge/quotes` | 长桥实时报价入口 |
| `/api/longbridge/candlesticks` | 长桥 K 线入口 |
| `/api/ai/models` | 服务端托管 AI 模型列表 |
| `/api/ai/chat` | 服务端托管非流式 Chat |
| `/api/ai/chat-stream` | 服务端托管流式 Chat |

## 项目结构

```text
api/
  ai/                 # 服务端 AI 代理
  auth/               # 登录、登出、状态
  longbridge/         # 长桥行情 API
src/
  api/                # 前端 API 客户端和数据源调度
  components/         # 通用组件
  data/               # 热门股票、静态兜底数据
  router/             # 路由
  server/             # 服务端共享逻辑：认证、长桥、AI、运行时配置
  stores/             # Pinia stores
  styles/             # 设计变量和全局样式
  views/              # 页面
middleware.ts         # Vercel 访问控制
vercel.json           # Vercel 构建与缓存配置
```

## 数据说明

- Vercel 版本会优先使用长桥 OpenAPI；若长桥未配置或请求失败，会自动降级到 Sina、东方财富、Yahoo 等数据源。长桥官方 Node SDK 因原生包体积限制暂不打包。
- AI 输出仅作研究辅助，不构成投资建议。
- 个人持仓数据保存在浏览器 `localStorage`，不会上传到服务端。

## License

仅作个人研究工具使用，不构成投资建议。
