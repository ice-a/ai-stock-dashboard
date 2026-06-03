import type { WatchlistIdea, LeaderStock } from '../types'
import { useTopicStore } from '../stores/topic'

/**
 * 计算区间涨跌幅（基于 K 线数据）
 */
export function calculateChangePercent(points: Array<{ time: number; close: number }>, days: number, latest: number | null): number | null {
  if (!points.length || latest == null) return null
  const now = Date.now() / 1000
  const targetTime = now - days * 86400
  let basePoint = points[0]
  for (const p of points) {
    if (p.time <= targetTime) {
      basePoint = p
    } else {
      break
    }
  }
  if (!basePoint || basePoint.close === 0) return null
  return (latest - basePoint.close) / basePoint.close
}

/**
 * 从当前主题的 watchlist idea 推断区间基准涨跌幅
 */
export function getStaticBenchmark(idea: WatchlistIdea, period: 'd1' | 'd5' | 'd20' | 'd60' | 'd252'): number | null {
  if (period === 'd1') return idea.d1 / 100
  if (period === 'd5') return idea.d5 != null ? idea.d5 / 100 : null
  if (period === 'd20') return idea.d20 / 100
  if (period === 'd60') return idea.d60 / 100
  if (period === 'd252') return idea.d252 / 100
  return null
}

export function findIdea(symbol: string): WatchlistIdea | null {
  const topicStore = useTopicStore()
  return topicStore.currentData.watchlistIdeas.find(s => s.symbol === symbol) || null
}

export function findLeader(symbol: string): LeaderStock | null {
  const topicStore = useTopicStore()
  return topicStore.currentData.leaderUniverse.find(s => s.symbol === symbol) || null
}
