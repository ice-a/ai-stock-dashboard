import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useQuotesStore } from './quotes'
import type { PortfolioHolding, PortfolioHoldingComputed } from '../types'

const STORAGE_KEY = 'ai-dashboard:portfolio'

function loadHoldings(): PortfolioHolding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as PortfolioHolding[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function uid(): string {
  return `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function daysBetween(date: string): number {
  const start = new Date(`${date}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000))
}

export const usePortfolioStore = defineStore('portfolio', () => {
  const holdings = ref<PortfolioHolding[]>(loadHoldings())
  const quotesStore = useQuotesStore()

  const symbols = computed(() => [...new Set(holdings.value.map(h => h.symbol))])

  const computedHoldings = computed<PortfolioHoldingComputed[]>(() => {
    return holdings.value.map((holding) => {
      const quote = quotesStore.get(holding.symbol)
      const currentPrice = quote?.price ?? null
      const costAmount = holding.buyPrice * holding.quantity + holding.fee
      const marketValue = currentPrice == null ? null : currentPrice * holding.quantity
      const profit = marketValue == null ? null : marketValue - costAmount
      const profitRate = profit == null || costAmount <= 0 ? null : profit / costAmount
      return {
        ...holding,
        currentPrice,
        costAmount,
        marketValue,
        profit,
        profitRate,
        daysHeld: daysBetween(holding.buyDate),
        source: quote?.source,
      }
    })
  })

  const summary = computed(() => {
    const rows = computedHoldings.value
    const totalCost = rows.reduce((sum, item) => sum + item.costAmount, 0)
    const totalMarketValue = rows.reduce((sum, item) => sum + (item.marketValue ?? 0), 0)
    const pricedRows = rows.filter(item => item.profit != null)
    const pricedCost = pricedRows.reduce((sum, item) => sum + item.costAmount, 0)
    const missingQuotes = rows.filter(item => item.marketValue == null).length
    const profit = pricedRows.reduce((sum, item) => sum + (item.profit ?? 0), 0)
    return {
      count: rows.length,
      totalCost,
      totalMarketValue,
      profit,
      profitRate: pricedCost > 0 ? profit / pricedCost : null,
      missingQuotes,
    }
  })

  function addHolding(input: Omit<PortfolioHolding, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    holdings.value.unshift({
      ...input,
      id: uid(),
      fee: Number(input.fee) || 0,
      buyPrice: Number(input.buyPrice) || 0,
      quantity: Number(input.quantity) || 0,
      createdAt: now,
      updatedAt: now,
    })
  }

  function updateHolding(id: string, patch: Partial<Omit<PortfolioHolding, 'id' | 'createdAt'>>) {
    const index = holdings.value.findIndex(item => item.id === id)
    if (index < 0) return
    holdings.value[index] = {
      ...holdings.value[index],
      ...patch,
      fee: Number(patch.fee ?? holdings.value[index].fee) || 0,
      buyPrice: Number(patch.buyPrice ?? holdings.value[index].buyPrice) || 0,
      quantity: Number(patch.quantity ?? holdings.value[index].quantity) || 0,
      updatedAt: Date.now(),
    }
  }

  function removeHolding(id: string) {
    holdings.value = holdings.value.filter(item => item.id !== id)
  }

  function clear() {
    holdings.value = []
  }

  watch(holdings, (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }, { deep: true })

  return {
    holdings,
    symbols,
    computedHoldings,
    summary,
    addHolding,
    updateHolding,
    removeHolding,
    clear,
  }
})
