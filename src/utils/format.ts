// 数字 / 日期 / 涨跌幅格式化
import type { Quote } from '../types'

const PCT_DIGITS = 2

export function formatPercent(value: number | null | undefined, digits = PCT_DIGITS): string {
  if (value == null || isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${(value * 100).toFixed(digits)}%`
}

export function formatPrice(value: number | null | undefined, currency?: string): string {
  if (value == null || isNaN(value)) return '—'
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${formatted} ${currency}` : formatted
}

export function formatLargeNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—'
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(0)
}

export function formatVolume(value: number | null | undefined): string {
  return formatLargeNumber(value)
}

export function formatDate(d: Date | number | null, format: 'date' | 'time' | 'datetime' | 'relative' = 'datetime'): string {
  if (d == null) return '—'
  const date = typeof d === 'number' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'

  if (format === 'relative') {
    const now = Date.now()
    const diff = now - date.getTime()
    if (diff < 0) return formatDate(date, 'datetime')
    if (diff < 60_000) return '刚刚'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
    return date.toLocaleDateString('zh-CN')
  }

  if (format === 'date') return date.toLocaleDateString('zh-CN')
  if (format === 'time') return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return date.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function formatKLineTime(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function quoteTone(value: number | null | undefined): 'pos' | 'neg' | 'flat' {
  if (value == null) return 'flat'
  if (Math.abs(value) < 0.0005) return 'flat'
  return value > 0 ? 'pos' : 'neg'
}

export function timeAgoShort(d: Date | number | null): string {
  if (d == null) return '—'
  const date = typeof d === 'number' ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  if (diff < 0) return '—'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function statusTone(status: string): string {
  if (status.includes('交易拥挤')) return 'hot'
  if (status.includes('等待')) return 'wait'
  if (status.includes('滞后')) return 'lag'
  if (status.includes('核心')) return 'core'
  return 'watch'
}

export function deriveStatus(quote: Quote, fallbackChange?: number): number | null {
  if (quote.change != null) return quote.change
  if (fallbackChange != null) return fallbackChange / 100
  return null
}
