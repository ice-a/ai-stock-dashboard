// 静态快照：API 失败时回退

interface FallbackEntry {
  d1: number
  d20: number
  d60: number
  d252: number
  name?: string
}

// 静态兜底数据
const FALLBACK_MAP: Record<string, FallbackEntry> = {
  'NVDA.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'NVIDIA' },
  'AAPL.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Apple' },
  'MSFT.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Microsoft' },
  'TSLA.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Tesla' },
  'GOOGL.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Alphabet' },
  'AMZN.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Amazon' },
  'META.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Meta' },
  'AVGO.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Broadcom' },
  'AMD.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'AMD' },
  'TSM.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'TSMC ADR' },
  '00700.HK': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '腾讯控股' },
  '09988.HK': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '阿里巴巴' },
  '03690.HK': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '美团' },
  '01211.HK': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '比亚迪股份' },
  '300750.SZ': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '宁德时代' },
  '600519.SH': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '贵州茅台' },
  '300308.SZ': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '中际旭创' },
  '688256.SH': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: '寒武纪' },
}

export function getFallbackQuote(symbol: string): FallbackEntry | null {
  return FALLBACK_MAP[symbol] || null
}

export function hasFallback(symbol: string): boolean {
  return symbol in FALLBACK_MAP
}
