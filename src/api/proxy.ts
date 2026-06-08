// 代理 URL 工具
// 开发环境使用 Vite 代理绕过 CORS，生产环境使用 CORS 代理或直连
import { EXTERNAL_ENDPOINTS } from '../config/endpoints'

const IS_DEV = import.meta.env.DEV

// CORS 代理列表（生产环境使用，按优先级排序）
const CORS_PROXIES = [
  (url: string) => `${EXTERNAL_ENDPOINTS.corsProxy.allOriginsRawUrl}?url=${encodeURIComponent(url)}`,
  (url: string) => `${EXTERNAL_ENDPOINTS.corsProxy.corsProxyIoUrl}?${encodeURIComponent(url)}`,
]

/**
 * 获取代理后的 URL
 * 开发环境：走 Vite proxy（/api/xxx）
 * 生产环境：走 CORS 代理
 */
export function proxyUrl(directUrl: string, devProxyPath: string): string {
  if (IS_DEV) {
    return devProxyPath
  }
  // 生产环境使用第一个可用的 CORS 代理
  return CORS_PROXIES[0](directUrl)
}

/**
 * 带 CORS 代理回退的 fetch
 * 先尝试直连，失败后依次尝试 CORS 代理
 */
export async function fetchWithCorsFallback(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  // 开发环境直接返回（Vite proxy 已处理）
  if (IS_DEV) {
    return fetch(url, options)
  }

  // 生产环境：先尝试直连
  try {
    const r = await fetch(url, { ...options, mode: 'cors' })
    if (r.ok) return r
  } catch { /* fall through */ }

  // 尝试 CORS 代理
  for (const makeProxy of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxy(url)
      const r = await fetch(proxyUrl, {
        ...options,
        // CORS 代理不支持自定义 headers
        headers: undefined,
      })
      if (r.ok) return r
    } catch { /* try next */ }
  }

  throw new Error('All fetch attempts failed')
}
