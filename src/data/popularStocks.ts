import { DEFAULT_SECTORS } from '../sectors/defaults'
import type { SectorStock } from '../sectors/types'

const PINNED_POPULAR: SectorStock[] = [
  { symbol: 'NVDA.US', name: 'NVIDIA', market: '美股', layer: 'AI 芯片' },
  { symbol: 'AAPL.US', name: 'Apple', market: '美股', layer: '消费电子' },
  { symbol: 'MSFT.US', name: 'Microsoft', market: '美股', layer: '云与 AI' },
  { symbol: 'TSLA.US', name: 'Tesla', market: '美股', layer: '新能源车' },
  { symbol: 'GOOGL.US', name: 'Alphabet', market: '美股', layer: '搜索与 AI' },
  { symbol: 'AMZN.US', name: 'Amazon', market: '美股', layer: '云与电商' },
  { symbol: '00700.HK', name: '腾讯控股', market: '港股', layer: '互联网' },
  { symbol: '09988.HK', name: '阿里巴巴', market: '港股', layer: '云与电商' },
  { symbol: '03690.HK', name: '美团', market: '港股', layer: '本地生活' },
  { symbol: '01211.HK', name: '比亚迪股份', market: '港股', layer: '新能源车' },
  { symbol: '300750.SZ', name: '宁德时代', market: 'A股', layer: '电池' },
  { symbol: '600519.SH', name: '贵州茅台', market: 'A股', layer: '消费' },
  { symbol: '300308.SZ', name: '中际旭创', market: 'A股', layer: '光通信' },
  { symbol: '688256.SH', name: '寒武纪', market: 'A股', layer: 'AI 芯片' },
]

export function getPopularStocks(limit = 24): SectorStock[] {
  const map = new Map<string, SectorStock>()
  for (const stock of PINNED_POPULAR) map.set(stock.symbol, stock)
  for (const sector of DEFAULT_SECTORS) {
    for (const stock of sector.stocks) {
      if (!map.has(stock.symbol)) map.set(stock.symbol, stock)
      if (map.size >= limit) return [...map.values()]
    }
  }
  return [...map.values()].slice(0, limit)
}
