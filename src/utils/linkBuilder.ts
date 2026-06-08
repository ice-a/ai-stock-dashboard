import { toYahooSymbol } from '../api/symbolMap'
import { EXTERNAL_ENDPOINTS } from '../config/endpoints'

// 长桥 quote 链接（保留原报告的链接）
export function longportQuoteUrl(symbol: string): string {
  return `${EXTERNAL_ENDPOINTS.externalLinks.longportQuoteBaseUrl}/${encodeURIComponent(symbol)}`
}

export function googleFinanceUrl(symbol: string): string {
  // Google Finance 用相同的后缀
  return `${EXTERNAL_ENDPOINTS.externalLinks.googleFinanceQuoteBaseUrl}/${encodeURIComponent(toYahooSymbol(symbol))}`
}

export function xueqiuUrl(symbol: string): string {
  const yahooSym = toYahooSymbol(symbol)
  // 雪球的代码格式：SZ300308 / SH600176 / HK00700
  let xqSym = ''
  if (symbol.endsWith('.SZ')) xqSym = `SZ${symbol.slice(0, -3)}`
  else if (symbol.endsWith('.SH')) xqSym = `SH${symbol.slice(0, -3)}`
  else if (symbol.endsWith('.HK')) xqSym = `HK${symbol.slice(0, -3).padStart(5, '0')}`
  else xqSym = yahooSym
  return `${EXTERNAL_ENDPOINTS.externalLinks.xueqiuQuoteBaseUrl}/${xqSym}`
}
