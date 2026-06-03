// 自选股多维度分析工具函数
import type { KLinePoint } from '../types'

export interface PerformanceMetrics {
  return1w: number | null
  return1m: number | null
  return3m: number | null
  return6m: number | null
  return1y: number | null
  volatility: number | null    // 年化波动率
  maxDrawdown: number | null   // 最大回撤
  sharpe: number | null        // 简化夏普比率（假设无风险利率 3%）
}

export interface TechnicalIndicators {
  ma5: number | null
  ma10: number | null
  ma20: number | null
  ma60: number | null
  rsi14: number | null
  macdSignal: 'bullish' | 'bearish' | 'neutral'
  trend: 'up' | 'down' | 'sideways'
  support: number | null
  resistance: number | null
}

export interface VolumeAnalysis {
  avgVolume20d: number | null
  volumeRatio: number | null    // 今日成交量 / 20日均量
  volumeTrend: 'increasing' | 'decreasing' | 'stable'
}

export interface StockAnalysis {
  performance: PerformanceMetrics
  technical: TechnicalIndicators
  volume: VolumeAnalysis
  score: number                  // 综合评分 0-100
  signals: string[]              // 关键信号列表
}

// ---------- 工具函数 ----------

function sma(data: number[], period: number): number | null {
  if (data.length < period) return null
  const slice = data.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function rsi(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null
  const changes = []
  for (let i = closes.length - period; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1])
  }
  const gains = changes.filter(c => c > 0)
  const losses = changes.filter(c => c < 0).map(c => -c)
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / period : 0
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / period : 0
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = [data[0]]
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k))
  }
  return result
}

// ---------- 核心分析 ----------

export function analyzePerformance(points: KLinePoint[]): PerformanceMetrics {
  if (points.length < 5) {
    return { return1w: null, return1m: null, return3m: null, return6m: null, return1y: null, volatility: null, maxDrawdown: null, sharpe: null }
  }

  const closes = points.map(p => p.close)
  const latest = closes[closes.length - 1]

  function returnFromDaysAgo(days: number): number | null {
    const target = points.length - 1 - days
    if (target < 0) return null
    const base = closes[target]
    return base !== 0 ? (latest - base) / base : null
  }

  // 日收益率序列
  const dailyReturns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] !== 0) dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }

  // 年化波动率
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / dailyReturns.length
  const volatility = dailyReturns.length > 1 ? Math.sqrt(variance) * Math.sqrt(252) : null

  // 最大回撤
  let peak = closes[0]
  let maxDD = 0
  for (const c of closes) {
    if (c > peak) peak = c
    const dd = peak > 0 ? (peak - c) / peak : 0
    if (dd > maxDD) maxDD = dd
  }

  // 夏普比率（简化，假设无风险利率 3%）
  const annualizedReturn = avgReturn * 252
  const sharpe = volatility && volatility > 0 ? (annualizedReturn - 0.03) / volatility : null

  return {
    return1w: returnFromDaysAgo(5),
    return1m: returnFromDaysAgo(20),
    return3m: returnFromDaysAgo(60),
    return6m: returnFromDaysAgo(120),
    return1y: returnFromDaysAgo(252),
    volatility,
    maxDrawdown: maxDD > 0 ? maxDD : null,
    sharpe,
  }
}

export function analyzeTechnicals(points: KLinePoint[]): TechnicalIndicators {
  if (points.length < 5) {
    return { ma5: null, ma10: null, ma20: null, ma60: null, rsi14: null, macdSignal: 'neutral', trend: 'sideways', support: null, resistance: null }
  }

  const closes = points.map(p => p.close)
  const latest = closes[closes.length - 1]

  const ma5 = sma(closes, 5)
  const ma10 = sma(closes, 10)
  const ma20 = sma(closes, 20)
  const ma60 = sma(closes, 60)
  const rsi14 = rsi(closes, 14)

  // MACD 信号（简化：12/26 EMA 交叉）
  let macdSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral'
  if (closes.length >= 26) {
    const ema12 = ema(closes, 12)
    const ema26 = ema(closes, 26)
    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1]
    const macdPrev = ema12[ema12.length - 2] - ema26[ema26.length - 2]
    if (macdLine > 0 && macdPrev <= 0) macdSignal = 'bullish'
    else if (macdLine < 0 && macdPrev >= 0) macdSignal = 'bearish'
    else if (macdLine > 0) macdSignal = 'bullish'
    else if (macdLine < 0) macdSignal = 'bearish'
  }

  // 趋势判断（MA 排列）
  let trend: 'up' | 'down' | 'sideways' = 'sideways'
  if (ma5 && ma20) {
    if (latest > ma5 && ma5 > ma20) trend = 'up'
    else if (latest < ma5 && ma5 < ma20) trend = 'down'
  }

  // 支撑位和阻力位（近 20 日高低点）
  const recent = points.slice(-20)
  const support = Math.min(...recent.map(p => p.low))
  const resistance = Math.max(...recent.map(p => p.high))

  return { ma5, ma10, ma20, ma60, rsi14, macdSignal, trend, support, resistance }
}

export function analyzeVolume(points: KLinePoint[]): VolumeAnalysis {
  if (points.length < 20) {
    return { avgVolume20d: null, volumeRatio: null, volumeTrend: 'stable' }
  }

  const volumes = points.map(p => p.volume)
  const avgVolume20d = sma(volumes, 20)
  const latestVolume = volumes[volumes.length - 1]
  const volumeRatio = avgVolume20d && avgVolume20d > 0 ? latestVolume / avgVolume20d : null

  // 成交量趋势（近 5 日 vs 前 15 日）
  const recent5 = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
  const prev15 = volumes.slice(-20, -5).reduce((a, b) => a + b, 0) / 15
  let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
  if (prev15 > 0) {
    const ratio = recent5 / prev15
    if (ratio > 1.3) volumeTrend = 'increasing'
    else if (ratio < 0.7) volumeTrend = 'decreasing'
  }

  return { avgVolume20d, volumeRatio, volumeTrend }
}

export function computeScore(perf: PerformanceMetrics, tech: TechnicalIndicators, vol: VolumeAnalysis): number {
  let score = 50

  // 趋势加分
  if (tech.trend === 'up') score += 15
  else if (tech.trend === 'down') score -= 15

  // RSI
  if (tech.rsi14 !== null) {
    if (tech.rsi14 > 70) score -= 10    // 超买
    else if (tech.rsi14 < 30) score += 10  // 超卖
    else if (tech.rsi14 > 50) score += 5
  }

  // MACD
  if (tech.macdSignal === 'bullish') score += 10
  else if (tech.macdSignal === 'bearish') score -= 10

  // 近期收益
  if (perf.return1m !== null) {
    if (perf.return1m > 0.1) score += 8
    else if (perf.return1m < -0.1) score -= 8
  }

  // 波动率（高波动扣分）
  if (perf.volatility !== null && perf.volatility > 0.5) score -= 5

  // 成交量配合
  if (vol.volumeRatio !== null) {
    if (vol.volumeRatio > 1.5 && tech.trend === 'up') score += 5  // 放量上涨
    if (vol.volumeRatio > 1.5 && tech.trend === 'down') score -= 5  // 放量下跌
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function generateSignals(perf: PerformanceMetrics, tech: TechnicalIndicators, vol: VolumeAnalysis): string[] {
  const signals: string[] = []

  if (tech.trend === 'up') signals.push('均线多头排列')
  if (tech.trend === 'down') signals.push('均线空头排列')

  if (tech.rsi14 !== null) {
    if (tech.rsi14 > 70) signals.push('RSI 超买')
    else if (tech.rsi14 < 30) signals.push('RSI 超卖')
  }

  if (tech.macdSignal === 'bullish') signals.push('MACD 金叉')
  if (tech.macdSignal === 'bearish') signals.push('MACD 死叉')

  if (vol.volumeRatio !== null && vol.volumeRatio > 2) signals.push('成交量放大')
  if (vol.volumeTrend === 'increasing') signals.push('量能递增')
  if (vol.volumeTrend === 'decreasing') signals.push('量能萎缩')

  if (perf.maxDrawdown !== null && perf.maxDrawdown > 0.2) signals.push('近期大幅回撤')
  if (perf.return1m !== null && perf.return1m > 0.15) signals.push('近 1 月强势')
  if (perf.return1m !== null && perf.return1m < -0.15) signals.push('近 1 月弱势')

  if (perf.volatility !== null && perf.volatility > 0.6) signals.push('高波动')

  return signals
}

export function analyzeStock(points: KLinePoint[]): StockAnalysis {
  const performance = analyzePerformance(points)
  const technical = analyzeTechnicals(points)
  const volume = analyzeVolume(points)
  const score = computeScore(performance, technical, volume)
  const signals = generateSignals(performance, technical, volume)

  return { performance, technical, volume, score, signals }
}
