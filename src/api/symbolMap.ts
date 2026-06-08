// 长桥符号 → 各家厂商转换
// 长桥格式: NVDA.US · 0700.HK · 600176.SH · 300308.SZ · 2802.T · 005930.KS · 6669.TW · SU.PA · TCS.NS

const MARKER_REGIONS: Array<{ suffix: string; market: 'us' | 'hk' | 'sh' | 'sz' | 'jp' | 'kr' | 'tw' | 'eu' | 'in' | 'au' | 'my' | 'uk' }> = [
  { suffix: '.US', market: 'us' },
  { suffix: '.HK', market: 'hk' },
  { suffix: '.SH', market: 'sh' },
  { suffix: '.SZ', market: 'sz' },
  { suffix: '.T',  market: 'jp' },
  { suffix: '.KS', market: 'kr' },
  { suffix: '.KQ', market: 'kr' },
  { suffix: '.TW', market: 'tw' },
  { suffix: '.PA', market: 'eu' },
  { suffix: '.DE', market: 'eu' },
  { suffix: '.AS', market: 'eu' },
  { suffix: '.SW', market: 'eu' },
  { suffix: '.MI', market: 'eu' },
  { suffix: '.HE', market: 'eu' },
  { suffix: '.ST', market: 'eu' },
  { suffix: '.L',  market: 'uk' },
  { suffix: '.NS', market: 'in' },
  { suffix: '.BO', market: 'in' },
  { suffix: '.AX', market: 'au' },
  { suffix: '.KL', market: 'my' },
]

export interface ParsedSymbol {
  code: string         // 纯代码: NVDA, 0700, 600176
  market: 'us' | 'hk' | 'sh' | 'sz' | 'jp' | 'kr' | 'tw' | 'eu' | 'in' | 'au' | 'my' | 'uk'
  longport: string     // 原始: NVDA.US
  eastmoneySecid: string  // 1.600176 / 105.AAPL
  sinaCode: string     // sh600176 / hk00700 / gb_aapl
  qqCode: string       // sh600176 / hk00700 / usNVDA.NVDA
  region: string       // 中文: 美股 / A股 / 港股 ...
  regionEn: string     // 英文: US / CN / HK
}

const YAHOO_SUFFIX: Partial<Record<ParsedSymbol['market'], string>> = {
  hk: '.HK',
  sh: '.SS',
  sz: '.SZ',
  jp: '.T',
  kr: '.KS',
  tw: '.TW',
  uk: '.L',
  in: '.NS',
  au: '.AX',
  my: '.KL',
}

const REGION_LABEL: Record<ParsedSymbol['market'], { zh: string; en: string }> = {
  us: { zh: '美股', en: 'US' },
  hk: { zh: '港股', en: 'HK' },
  sh: { zh: 'A股', en: 'CN' },
  sz: { zh: 'A股', en: 'CN' },
  jp: { zh: '日本', en: 'JP' },
  kr: { zh: '韩国', en: 'KR' },
  tw: { zh: '台湾', en: 'TW' },
  eu: { zh: '欧洲', en: 'EU' },
  uk: { zh: '英国', en: 'UK' },
  in: { zh: '印度', en: 'IN' },
  au: { zh: '澳洲', en: 'AU' },
  my: { zh: '马来西亚', en: 'MY' },
}

const EASTMONEY_SECID_PREFIX: Record<ParsedSymbol['market'], string> = {
  us: '105.',
  hk: '116.',
  sh: '1.',
  sz: '0.',
  jp: '105.',  // 部分日股用 105
  kr: '105.',
  tw: '105.',
  eu: '105.',
  uk: '105.',
  in: '105.',
  au: '105.',
  my: '105.',
}

export function parseLongportSymbol(symbol: string): ParsedSymbol | null {
  const upper = symbol.toUpperCase().trim()
  for (const { suffix, market } of MARKER_REGIONS) {
    if (upper.endsWith(suffix)) {
      const code = upper.slice(0, -suffix.length)
      const paddedHKKr = (market === 'hk') ? code.padStart(5, '0') : code
      return {
        code,
        market,
        longport: symbol,
        eastmoneySecid: EASTMONEY_SECID_PREFIX[market] + (market === 'hk' ? paddedHKKr : code),
        sinaCode: market === 'us' ? 'gb_' + code.toLowerCase()
                : (market === 'sh' || market === 'sz') ? market + code
                : (market === 'hk') ? 'hk' + paddedHKKr
                : '',
        qqCode: market === 'us' ? 'us' + code + '.' + code
              : (market === 'sh' || market === 'sz') ? market + code
              : (market === 'hk') ? 'hk' + paddedHKKr
              : '',
        region: REGION_LABEL[market].zh,
        regionEn: REGION_LABEL[market].en,
      }
    }
  }
  return null
}

// 兼容旧 API
export function toYahooSymbol(symbol: string): string {
  const p = parseLongportSymbol(symbol)
  if (!p) return symbol.toUpperCase()
  if (p.market === 'us') return p.code
  const suffix = YAHOO_SUFFIX[p.market]
  if (suffix == null) return symbol.toUpperCase()
  return `${p.code}${suffix}`
}

export function isYahooQuoteSupported(symbol: string): boolean {
  const p = parseLongportSymbol(symbol)
  if (!p) return false
  return p.market === 'us' || YAHOO_SUFFIX[p.market] != null
}

export function isLikelySupported(symbol: string): boolean {
  return parseLongportSymbol(symbol) !== null
}

// LongPort Quote API 调用时需要 canonical 符号
export function toLongportSymbol(symbol: string): string {
  const upper = symbol.toUpperCase().trim()
  // LongPort docs use ticker.region, e.g. 700.HK instead of 00700.HK.
  if (upper.endsWith('.HK')) {
    return (upper.slice(0, -3).replace(/^0+/, '') || '0') + '.HK'
  }
  return upper
}
