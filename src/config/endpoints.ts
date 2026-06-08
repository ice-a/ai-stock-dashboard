export const APP_API_ROUTES = {
  config: '/api/config',
  aiModels: '/api/ai/models',
  aiChat: '/api/ai/chat',
  aiChatStream: '/api/ai/chat-stream',
  aiDevProxy: '/api/ai-proxy',
  authStatus: '/api/auth/status',
  authLogin: '/api/auth/login',
  authLogout: '/api/auth/logout',
  accountStatus: '/api/account/status',
  accountLogin: '/api/account/login',
  accountRegister: '/api/account/register',
  accountLogout: '/api/account/logout',
  accountConfig: '/api/account/config',
  longbridgeStatus: '/api/longbridge/status',
  longbridgeQuotes: '/api/longbridge/quotes',
  longbridgeCandlesticks: '/api/longbridge/candlesticks',
  market: '/api/market',
  sinaDevProxy: '/api/sina',
} as const

export const EXTERNAL_ENDPOINTS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
  },
  longport: {
    httpUrl: 'https://openapi.longportapp.com',
    httpUrlCn: 'https://openapi.longportapp.cn',
    quoteWsUrl: 'wss://openapi-quote.longportapp.com',
    quoteWsUrlCn: 'wss://openapi-quote.longportapp.cn',
    legacyHttpUrl: 'https://openapi.longbridge.com',
    legacyHttpUrlCn: 'https://openapi.longbridge.cn',
    legacyQuoteWsUrl: 'wss://openapi-quote.longbridge.com',
    legacyQuoteWsUrlCn: 'wss://openapi-quote.longbridge.cn',
  },
  eastmoney: {
    quoteBases: [
      'https://push2delay.eastmoney.com/api/qt/stock/get',
      'https://push2.eastmoney.com/api/qt/stock/get',
    ],
    klineBases: [
      'https://push2his.eastmoney.com/api/qt/stock/kline/get',
    ],
    searchUrl: 'https://searchapi.eastmoney.com/api/suggest/get',
    noticeUrl: 'https://np-anotice-stock.eastmoney.com/api/security/ann',
    newsUrl: 'https://search-api-web.eastmoney.com/search/jsonp',
    quoteReferer: 'https://quote.eastmoney.com/',
    dataReferer: 'https://data.eastmoney.com/',
    searchReferer: 'https://so.eastmoney.com/',
  },
  sina: {
    quoteBaseUrl: 'https://hq.sinajs.cn',
    financeReferer: 'https://finance.sina.com.cn',
  },
  hitokoto: {
    sentenceUrl: 'https://v1.hitokoto.cn/',
  },
  externalLinks: {
    longportQuoteBaseUrl: 'https://longportapp.cn/zh-CN/quote',
    googleFinanceQuoteBaseUrl: 'https://www.google.com/finance/quote',
    xueqiuQuoteBaseUrl: 'https://xueqiu.com/S',
  },
  corsProxy: {
    allOriginsRawUrl: 'https://api.allorigins.win/raw',
    corsProxyIoUrl: 'https://corsproxy.io/',
  },
} as const

export function normalizeOpenAIBaseUrl(baseUrl: string): string {
  const url = baseUrl.trim().replace(/\/+$/, '')
  if (url.includes('/chat/completions')) return url.replace(/\/chat\/completions.*$/i, '')
  if (/\/v\d+\/?$/.test(url)) return url
  if (/\/api\//.test(url)) return url
  return `${url}/v1`
}
