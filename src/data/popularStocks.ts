import type { Market } from '../types'

interface StockItem {
  symbol: string
  name: string
  market: Market
  layer?: string
}

const PINNED_POPULAR: StockItem[] = [
  { symbol: 'NVDA.US', name: 'NVIDIA', market: '美股', layer: 'AI 芯片' },
  { symbol: 'AAPL.US', name: 'Apple', market: '美股', layer: '消费电子' },
  { symbol: 'MSFT.US', name: 'Microsoft', market: '美股', layer: '云与 AI' },
  { symbol: 'TSLA.US', name: 'Tesla', market: '美股', layer: '新能源车' },
  { symbol: 'GOOGL.US', name: 'Alphabet', market: '美股', layer: '搜索与 AI' },
  { symbol: 'AMZN.US', name: 'Amazon', market: '美股', layer: '云与电商' },
  { symbol: 'META.US', name: 'Meta', market: '美股', layer: '社交与 AI' },
  { symbol: 'AVGO.US', name: 'Broadcom', market: '美股', layer: 'AI 芯片' },
  { symbol: 'AMD.US', name: 'AMD', market: '美股', layer: 'AI 芯片' },
  { symbol: 'TSM.US', name: '台积电', market: '美股', layer: '半导体制造' },
  { symbol: '00700.HK', name: '腾讯控股', market: '港股', layer: '互联网' },
  { symbol: '09988.HK', name: '阿里巴巴', market: '港股', layer: '云与电商' },
  { symbol: '03690.HK', name: '美团', market: '港股', layer: '本地生活' },
  { symbol: '01211.HK', name: '比亚迪股份', market: '港股', layer: '新能源车' },
  { symbol: '09618.HK', name: '京东集团', market: '港股', layer: '电商' },
  { symbol: '09888.HK', name: '百度集团', market: '港股', layer: '搜索与 AI' },
  { symbol: '300750.SZ', name: '宁德时代', market: 'A股', layer: '电池' },
  { symbol: '600519.SH', name: '贵州茅台', market: 'A股', layer: '消费' },
  { symbol: '300308.SZ', name: '中际旭创', market: 'A股', layer: '光通信' },
  { symbol: '688256.SH', name: '寒武纪', market: 'A股', layer: 'AI 芯片' },
  { symbol: '002475.SZ', name: '立讯精密', market: 'A股', layer: '消费电子' },
  { symbol: '601012.SH', name: '隆基绿能', market: 'A股', layer: '光伏' },
  { symbol: '002594.SZ', name: '比亚迪', market: 'A股', layer: '新能源车' },
  { symbol: '603259.SH', name: '药明康德', market: 'A股', layer: '医药' },
]

export function getPopularStocks(limit = 24): StockItem[] {
  return PINNED_POPULAR.slice(0, limit)
}

export type { StockItem }
