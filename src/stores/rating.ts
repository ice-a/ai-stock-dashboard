import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAIStore } from './ai'
import { useWatchlistStore } from './watchlist'
import { useQuotesStore } from './quotes'
import { useUserStore } from './user'
import { chat } from '../api/ai'
import { buildBatchRatingPrompt } from '../prompts/stockAnalysis'

export interface StockRating {
  symbol: string
  rating: string
  score: number
  reason: string
  risk: string
  targetPrice?: number
  updatedAt: number
}

export const useRatingStore = defineStore('rating', () => {
  const ratings = ref<Map<string, StockRating>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdate = ref<number>(0)

  // 自动刷新定时器
  let refreshTimer: ReturnType<typeof setInterval> | null = null

  // 获取单个股票的评级
  function getRating(symbol: string): StockRating | null {
    return ratings.value.get(symbol) || null
  }

  // 获取所有评级
  const allRatings = computed(() => {
    return Array.from(ratings.value.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  })

  // 刷新自选股评级
  async function refreshRatings() {
    const aiStore = useAIStore()
    const watchlistStore = useWatchlistStore()
    const quotesStore = useQuotesStore()
    const userStore = useUserStore()

    if (!aiStore.isConfigured) {
      error.value = '请先配置 AI 模型'
      return
    }

    if (watchlistStore.items.length === 0) {
      return
    }

    // 检查 API 调用次数
    if (userStore.isLoggedIn && userStore.apiCallsRemaining <= 0) {
      error.value = 'AI 调用次数已用完'
      return
    }

    loading.value = true
    error.value = null

    try {
      // 消耗 API 调用次数
      if (userStore.isLoggedIn) {
        const canCall = await userStore.consumeApiCall()
        if (!canCall) {
          error.value = 'AI 调用次数已用完'
          return
        }
      }

      // 获取自选股的行情数据
      const symbols = watchlistStore.items.map(item => item.symbol)
      await quotesStore.fetchAndStore(symbols, { force: false })

      // 构建股票列表
      const stocks = watchlistStore.items.map(item => {
        const quote = quotesStore.get(item.symbol)
        return {
          symbol: item.symbol,
          name: item.symbol, // 使用 symbol 作为名称
          price: quote?.price ?? null,
          change: quote?.change ?? null,
        }
      })

      // 调用 AI 进行批量评级
      const prompt = buildBatchRatingPrompt(stocks)
      const response = await chat(
        [
          { role: 'system', content: '你是量化交易分析师，只输出JSON，不要有任何其他文字。' },
          { role: 'user', content: prompt },
        ],
        {
          baseUrl: aiStore.baseUrl,
          apiKey: aiStore.apiKey,
          model: aiStore.model,
          temperature: 0.3,
          maxTokens: 2000,
        }
      )

      const text = response.choices?.[0]?.message?.content || ''

      // 解析 JSON
      let parsed = null

      try {
        parsed = JSON.parse(text)
      } catch {}

      if (!parsed) {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0])
          } catch {}
        }
      }

      if (!parsed) {
        const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        if (codeBlockMatch) {
          try {
            parsed = JSON.parse(codeBlockMatch[1])
          } catch {}
        }
      }

      if (parsed?.ratings && Array.isArray(parsed.ratings)) {
        const now = Date.now()
        for (const rating of parsed.ratings) {
          if (rating.symbol) {
            ratings.value.set(rating.symbol, {
              ...rating,
              updatedAt: now,
            })
          }
        }
        lastUpdate.value = now
      } else {
        throw new Error('AI 返回格式错误')
      }
    } catch (e) {
      error.value = (e as Error).message || '评级失败'
      console.error('Rating error:', e)
    } finally {
      loading.value = false
    }
  }

  // 启动自动刷新（每10分钟）
  function startAutoRefresh() {
    stopAutoRefresh()
    // 立即执行一次
    refreshRatings()
    // 设置定时器
    refreshTimer = setInterval(() => {
      refreshRatings()
    }, 10 * 60 * 1000) // 10分钟
  }

  // 停止自动刷新
  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  // 清除所有评级
  function clear() {
    ratings.value.clear()
    lastUpdate.value = 0
  }

  return {
    ratings,
    loading,
    error,
    lastUpdate,
    allRatings,
    getRating,
    refreshRatings,
    startAutoRefresh,
    stopAutoRefresh,
    clear,
  }
})
