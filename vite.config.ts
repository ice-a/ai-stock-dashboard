import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import type { Plugin } from 'vite'

// AI API CORS 代理插件
// 请求格式: /api/ai-proxy/{base64_target}/{path}
function aiProxyPlugin(): Plugin {
  return {
    name: 'ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai-proxy', async (req, res) => {
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
      server.middlewares.use('/api/market', async (req, res) => {
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
          if (!['eastmoney', 'sina', 'yahoo'].includes(source)) {
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

        const sendJson = (status: number, payload: unknown, headers: Record<string, string> = {}) => {
          res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
          res.end(JSON.stringify(payload))
        }

        if (url.pathname === '/api/auth/status') {
          const authenticated = await auth.verifySessionToken(auth.getAuthTokenFromCookie(req.headers.cookie))
          sendJson(200, { enabled: auth.isAuthEnabled(), authenticated })
          return
        }

        if (url.pathname === '/api/config') {
          const runtime = await import('./src/server/runtimeConfig.ts')
          sendJson(200, runtime.getRuntimeConfig())
          return
        }

        if (url.pathname === '/api/auth/logout') {
          sendJson(200, { ok: true }, { 'Set-Cookie': auth.buildExpiredSessionCookie(false) })
          return
        }

        if (url.pathname === '/api/auth/login') {
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

        if (!auth.isAuthEnabled()) {
          next()
          return
        }

        const pathname = url.pathname
        const isPublic =
          pathname === '/login' ||
          pathname.startsWith('/api/auth/') ||
          pathname.startsWith('/assets/') ||
          pathname.endsWith('.svg') ||
          pathname.endsWith('.png') ||
          pathname.endsWith('.ico')

        if (isPublic || await auth.verifySessionToken(auth.getAuthTokenFromCookie(req.headers.cookie))) {
          if (url.pathname === '/api/ai/models') {
            try {
              const ai = await import('./src/server/aiService.ts')
              sendJson(200, { data: await ai.listServerModels() })
            } catch (e) {
              sendJson(502, { error: (e as Error).message })
            }
            return
          }

          if (url.pathname === '/api/ai/chat' || url.pathname === '/api/ai/chat-stream') {
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
                if (url.pathname === '/api/ai/chat') {
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
                sendJson(502, { error: (e as Error).message })
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
        '/api/sina': {
          target: 'https://hq.sinajs.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/sina/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Referer', 'https://finance.sina.com.cn')
            })
          },
        },
      }
    }
  }
})
