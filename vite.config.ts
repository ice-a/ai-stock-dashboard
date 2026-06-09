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

function unifiedDevApiPlugin(): Plugin {
  return {
    name: 'unified-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) {
          next()
          return
        }

        try {
          const mod = await import('./api/[...path].ts')
          const query: Record<string, string | string[]> = {}
          url.searchParams.forEach((value, key) => {
            if (query[key]) query[key] = Array.isArray(query[key]) ? [...query[key] as string[], value] : [query[key] as string, value]
            else query[key] = value
          })
          query.path = url.pathname.replace(/^\/api\/?/, '')
          const headers: Record<string, string | string[]> = {}
          await mod.default(
            { method: req.method, headers: req.headers, query, url: req.url, on: req.on.bind(req) },
            {
              setHeader: (name: string, value: string | string[]) => { headers[name] = value },
              status: (code: number) => ({
                json: (payload: unknown) => {
                  res.writeHead(code, { 'Content-Type': 'application/json', ...headers })
                  res.end(JSON.stringify(payload))
                },
              }),
              writeHead: (code: number, nextHeaders: Record<string, string> = {}) => {
                res.writeHead(code, { ...headers, ...nextHeaders })
              },
              write: (chunk: unknown) => res.write(chunk as any),
              end: (chunk?: unknown) => res.end(chunk as any),
            },
          )
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: (e as Error).message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [vue(), unifiedDevApiPlugin(), aiProxyPlugin()],
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
