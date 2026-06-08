import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'
import { APP_API_ROUTES, EXTERNAL_ENDPOINTS } from './src/config/endpoints'

// AI API CORS 代理插件
// 请求格式: /api/ai-proxy/{base64_target}/{path}
function aiProxyPlugin(): Plugin {
  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use(APP_API_ROUTES.aiDevProxy, async (req, res) => {
        const url = req.url || ''
        // 解析 base64 target 和路径
        const cleanUrl = url.startsWith('/') ? url.slice(1) : url
        const parts = cleanUrl.split('/')
        const targetB64 = parts[0]
        const restPath = parts.slice(1).join('/')

        let targetBase: string
        try {
          targetBase = Buffer.from(targetB64, 'base64').toString('utf-8')
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid target' }))
          return
        }

        if (!targetBase.startsWith('http')) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid target URL' }))
          return
        }

        const targetUrl = restPath ? `${targetBase}/${restPath}` : targetBase

        // 收集请求体
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', async () => {
          const body = Buffer.concat(chunks)

          try {
            const headers: Record<string, string> = {
              'Content-Type': req.headers['content-type'] || 'application/json',
            }
            if (req.headers['authorization']) {
              headers['Authorization'] = req.headers['authorization'] as string
            }

            const fetchRes = await fetch(targetUrl, {
              method: req.method || 'GET',
              headers,
              body: body.length > 0 ? body : undefined,
            })

            const responseHeaders: Record<string, string> = {
              'Content-Type': fetchRes.headers.get('content-type') || 'application/json',
              'Access-Control-Allow-Origin': '*',
            }

            res.writeHead(fetchRes.status, responseHeaders)

            if (fetchRes.body) {
              const reader = (fetchRes.body as any).getReader?.()
              if (reader) {
                const decoder = new TextDecoder()
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  res.write(typeof value === 'string' ? value : decoder.decode(value, { stream: true }))
                }
                res.end()
              } else {
                const text = await fetchRes.text()
                res.end(text)
              }
            } else {
              res.end('')
            }
          } catch (e) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
        })
      })
    },
  }
}

function longbridgeDevApiPlugin(): Plugin {
  return {
    name: 'longbridge-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/longbridge', async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const pathname = url.pathname.replace(/^\/+/, '')

        try {
          const service = await import('./api/longbridge/_service.js')

          if (pathname === 'status') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(service.getLongbridgeStatus()))
            return
          }

          if (pathname === 'quotes') {
            const rawSymbols = url.searchParams.get('symbols') || url.searchParams.get('symbol') || ''
            const symbols = rawSymbols.split(',').map(s => s.trim()).filter(Boolean)
            if (symbols.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing symbols' }))
              return
            }
            const data = await service.getLongbridgeQuotes(symbols)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ data }))
            return
          }

          if (pathname === 'candlesticks') {
            const symbol = (url.searchParams.get('symbol') || '').trim()
            if (!symbol) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Missing symbol' }))
              return
            }
            const data = await service.getLongbridgeCandlesticks(
              symbol,
              url.searchParams.get('period') || 'day',
              Number(url.searchParams.get('count')) || 200,
            )
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ data }))
            return
          }

          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Not found' }))
        } catch (e) {
          res.writeHead(502, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

function marketDevApiPlugin(): Plugin {
  return {
    name: 'market-dev-api',
    configureServer(server) {
      server.middlewares.use(APP_API_ROUTES.market, async (req, res) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const query: Record<string, string> = {}
        url.searchParams.forEach((value, key) => {
          query[key] = value
        })

        const sendJson = (status: number, payload: unknown) => {
          res.writeHead(status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(payload))
        }

        try {
          const source = query.source || url.pathname.replace(/^\/+/, '')
          if (!['eastmoney', 'sina'].includes(source)) {
            sendJson(404, { error: 'Not found' })
            return
          }

          const mod = await import('./api/market.ts')
          await mod.default(
            { method: req.method, query: { ...query, source } },
            { status: (code: number) => ({ json: (payload: unknown) => sendJson(code, payload) }) },
          )
        } catch (e) {
          sendJson(502, { error: (e as Error).message })
        }
      })
    },
  }
}

function authDevPlugin(): Plugin {
  return {
    name: 'auth-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const auth = await import('./src/server/auth.ts')

        const sendJson = (status: number, payload: unknown, headers: Record<string, string | string[]> = {}) => {
          res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
          res.end(JSON.stringify(payload))
        }

        const runApiRoute = async (loader: () => Promise<{ default: Function }>) => {
          const headers: Record<string, string | string[]> = {}
          const mod = await loader()
          await mod.default(
            { method: req.method, headers: req.headers, on: req.on.bind(req) },
            {
              setHeader: (name: string, value: string | string[]) => { headers[name] = value },
              status: (code: number) => ({
                json: (payload: unknown) => sendJson(code, payload, headers),
              }),
            },
          )
        }

        const isRequestAuthorized = async () => {
          if (!auth.isAuthEnabled()) return true
          if (await auth.verifySessionToken(auth.getAuthTokenFromCookie(req.headers.cookie))) return true
          try {
            const account = await import('./src/server/userAuth.ts')
            return Boolean(await account.getUserFromCookie(req.headers.cookie))
          } catch {
            return false
          }
        }

        if (url.pathname === APP_API_ROUTES.authStatus) {
          const authenticated = await auth.verifySessionToken(auth.getAuthTokenFromCookie(req.headers.cookie))
          sendJson(200, { enabled: auth.isAuthEnabled(), authenticated })
          return
        }

        if (url.pathname === APP_API_ROUTES.config) {
          const runtime = await import('./src/server/runtimeConfig.ts')
          sendJson(200, runtime.getRuntimeConfig())
          return
        }

        if (url.pathname.startsWith('/api/account/')) {
          if (url.pathname === APP_API_ROUTES.accountStatus) {
            await runApiRoute(() => import('./api/account/status.ts'))
            return
          }
          if (url.pathname === APP_API_ROUTES.accountLogin) {
            await runApiRoute(() => import('./api/account/login.ts'))
            return
          }
          if (url.pathname === APP_API_ROUTES.accountRegister) {
            await runApiRoute(() => import('./api/account/register.ts'))
            return
          }
          if (url.pathname === APP_API_ROUTES.accountLogout) {
            await runApiRoute(() => import('./api/account/logout.ts'))
            return
          }
          if (url.pathname === APP_API_ROUTES.accountConfig) {
            await runApiRoute(() => import('./api/account/config.ts'))
            return
          }

          sendJson(404, { error: 'Not found' })
          return
        }

        if (url.pathname === APP_API_ROUTES.authLogout) {
          sendJson(200, { ok: true }, { 'Set-Cookie': auth.buildExpiredSessionCookie(false) })
          return
        }

        if (url.pathname === APP_API_ROUTES.authLogin) {
          if (req.method !== 'POST') {
            sendJson(405, { error: 'Method not allowed' })
            return
          }
          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', async () => {
            const raw = Buffer.concat(chunks).toString('utf8')
            let password = ''
            try {
              password = String((JSON.parse(raw) as { password?: string }).password || '')
            } catch { /* ignore */ }

            if (!(await auth.verifyPassword(password))) {
              await new Promise(resolve => setTimeout(resolve, 350))
              sendJson(401, { error: 'Invalid password' })
              return
            }

            const token = await auth.createSessionToken()
            sendJson(200, { ok: true }, { 'Set-Cookie': auth.buildSessionCookie(token, false) })
          })
          return
        }

        const pathname = url.pathname
        const isPublic = pathname.startsWith('/api/auth/') || isViteDevPublicPath(pathname)

        if (isPublic || await isRequestAuthorized()) {
          if (url.pathname === APP_API_ROUTES.aiModels) {
            try {
              const ai = await import('./src/server/aiService.ts')
              sendJson(200, { data: await ai.listServerModels() })
            } catch (e) {
              const error = e as Error & { statusCode?: number }
              sendJson(error.statusCode || 502, { error: error.message })
            }
            return
          }

          if (url.pathname === APP_API_ROUTES.aiChat || url.pathname === APP_API_ROUTES.aiChatStream) {
            if (req.method !== 'POST') {
              sendJson(405, { error: 'Method not allowed' })
              return
            }
            const chunks: Buffer[] = []
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', async () => {
              let body: any = {}
              try {
                body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
              } catch { /* ignore */ }
              if (!Array.isArray(body.messages)) {
                sendJson(400, { error: 'Missing messages' })
                return
              }
              try {
                const ai = await import('./src/server/aiService.ts')
                if (url.pathname === APP_API_ROUTES.aiChat) {
                  const data = await ai.chatServer(body.messages, body)
                  sendJson(200, data)
                  return
                }

                const upstream = await ai.streamServerChat(body.messages, body)
                res.writeHead(200, {
                  'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
                  'Cache-Control': 'no-cache, no-transform',
                })
                if (!upstream.body) {
                  res.end()
                  return
                }
                const reader = upstream.body.getReader()
                const decoder = new TextDecoder()
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  res.write(decoder.decode(value, { stream: true }))
                }
                res.end()
              } catch (e) {
                const error = e as Error & { statusCode?: number }
                sendJson(error.statusCode || 502, { error: error.message })
              }
            })
            return
          }

          next()
          return
        }

        if (pathname.startsWith('/api/')) {
          sendJson(401, { error: 'Unauthorized' })
          return
        }

        res.writeHead(302, { Location: `/login?next=${encodeURIComponent(pathname + url.search)}` })
        res.end()
      })
    },
  }
}

function isViteDevPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/favicon.svg' ||
    pathname === '/icon-source.svg' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/@vite/client' ||
    pathname.startsWith('/@id/') ||
    pathname.startsWith('/@fs/') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname.startsWith('/node_modules/.vite/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/pwa-') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.map') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico')
  )
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [vue(), marketDevApiPlugin(), authDevPlugin(), aiProxyPlugin(), longbridgeDevApiPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    build: {
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            'echarts-vendor': ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers', 'vue-echarts'],
            'vue-vendor': ['vue', 'vue-router', 'pinia', 'vue-i18n']
          }
        }
      }
    },
    server: {
      port: 5173,
      open: false,
      proxy: {
        // 新浪财经代理（需要 Referer 头，浏览器直连会被拦）
        [APP_API_ROUTES.sinaDevProxy]: {
          target: EXTERNAL_ENDPOINTS.sina.quoteBaseUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${APP_API_ROUTES.sinaDevProxy}`), ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Referer', EXTERNAL_ENDPOINTS.sina.financeReferer)
            })
          },
        },
      }
    }
  }
})
