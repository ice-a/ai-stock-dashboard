import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useQuotesStore } from './quotes'
import { executeFifoSale } from '../utils/portfolioMath'
import type { PortfolioHolding, PortfolioHoldingComputed, PortfolioTransaction } from '../types'

const STORAGE_KEY = 'ai-dashboard:portfolio'
const TRANSACTIONS_STORAGE_KEY = 'ai-dashboard:portfolio-transactions'

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

function loadTransactions(): PortfolioTransaction[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as PortfolioTransaction[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function uid(): string {
  return `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function txid(): string {
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function daysBetween(date: string): number {
  const start = new Date(`${date}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000))
}

export const usePortfolioStore = defineStore('portfolio', () => {
  const holdings = ref<PortfolioHolding[]>(loadHoldings())
  const transactions = ref<PortfolioTransaction[]>(loadTransactions())
  const quotesStore = useQuotesStore()

  const symbols = computed(() => [...new Set(holdings.value.map(h => h.symbol))])
  const recentTransactions = computed(() => [...transactions.value].sort((a, b) => {
    const dateDiff = new Date(b.tradeDate).getTime() - new Date(a.tradeDate).getTime()
    return dateDiff || b.createdAt - a.createdAt
  }))

  const realizedProfit = computed(() => transactions.value.reduce((sum, tx) => sum + (tx.realizedProfit ?? 0), 0))

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
    const totalProfit = profit + realizedProfit.value
    return {
      count: rows.length,
      totalCost,
      totalMarketValue,
      profit,
      profitRate: pricedCost > 0 ? profit / pricedCost : null,
      realizedProfit: realizedProfit.value,
      totalProfit,
      totalProfitRate: totalCost > 0 ? totalProfit / totalCost : null,
      missingQuotes,
    }
  })

  function addBuyTransaction(input: Omit<PortfolioTransaction, 'id' | 'type' | 'realizedProfit' | 'realizedProfitRate' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    transactions.value.unshift({
      ...input,
      id: txid(),
      type: 'buy',
      fee: Number(input.fee) || 0,
      price: Number(input.price) || 0,
      quantity: Number(input.quantity) || 0,
      realizedProfit: null,
      realizedProfitRate: null,
      createdAt: now,
      updatedAt: now,
    })
  }

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
    addBuyTransaction({
      symbol: input.symbol,
      name: input.name,
      price: Number(input.buyPrice) || 0,
      quantity: Number(input.quantity) || 0,
      fee: Number(input.fee) || 0,
      tradeDate: input.buyDate,
      note: '',
    })
  }

  function availableQuantity(symbol: string): number {
    return holdings.value
      .filter(item => item.symbol === symbol)
      .reduce((sum, item) => sum + item.quantity, 0)
  }

  function sellHolding(input: {
    symbol: string
    name: string
    price: number
    quantity: number
    fee: number
    tradeDate: string
    note?: string
  }): { realizedProfit: number; realizedProfitRate: number | null } {
    const symbol = input.symbol.trim().toUpperCase()
    const sale = executeFifoSale(holdings.value, {
      symbol,
      price: input.price,
      quantity: input.quantity,
      fee: input.fee,
    })
    holdings.value = sale.nextHoldings
    const now = Date.now()
    transactions.value.unshift({
      id: txid(),
      symbol,
      name: input.name.trim() || symbol,
      type: 'sell',
      price: Number(input.price) || 0,
      quantity: Number(input.quantity) || 0,
      fee: Number(input.fee) || 0,
      tradeDate: input.tradeDate,
      note: input.note || '',
      realizedProfit: sale.realizedProfit,
      realizedProfitRate: sale.realizedProfitRate,
      createdAt: now,
      updatedAt: now,
    })
    return { realizedProfit: sale.realizedProfit, realizedProfitRate: sale.realizedProfitRate }
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
    transactions.value = []
  }

  function exportJson(): string {
    return JSON.stringify({ version: 2, holdings: holdings.value, transactions: transactions.value }, null, 2)
  }

  function importJson(json: string): { added: number; merged: number } {
    try {
      const parsed = JSON.parse(json)
      if (!parsed || !Array.isArray(parsed.holdings)) return { added: 0, merged: 0 }
      let added = 0
      let merged = 0
      const existingIds = new Set(holdings.value.map(item => item.id))
      for (const item of parsed.holdings as PortfolioHolding[]) {
        if (!item?.id || !item.symbol) continue
        if (existingIds.has(item.id)) {
          merged++
          continue
        }
        holdings.value.push({
          ...item,
          fee: Number(item.fee) || 0,
          buyPrice: Number(item.buyPrice) || 0,
          quantity: Number(item.quantity) || 0,
          createdAt: Number(item.createdAt) || Date.now(),
          updatedAt: Number(item.updatedAt) || Date.now(),
        })
        existingIds.add(item.id)
        added++
      }
      if (Array.isArray(parsed.transactions)) {
        const existingTxIds = new Set(transactions.value.map(item => item.id))
        for (const tx of parsed.transactions as PortfolioTransaction[]) {
          if (!tx?.id || existingTxIds.has(tx.id)) continue
          transactions.value.push({
            ...tx,
            fee: Number(tx.fee) || 0,
            price: Number(tx.price) || 0,
            quantity: Number(tx.quantity) || 0,
            realizedProfit: typeof tx.realizedProfit === 'number' ? tx.realizedProfit : null,
            realizedProfitRate: typeof tx.realizedProfitRate === 'number' ? tx.realizedProfitRate : null,
            createdAt: Number(tx.createdAt) || Date.now(),
            updatedAt: Number(tx.updatedAt) || Date.now(),
          })
        }
      }
      return { added, merged }
    } catch {
      return { added: 0, merged: 0 }
    }
  }

  watch(holdings, (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  }, { deep: true })

  watch(transactions, (value) => {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(value))
  }, { deep: true })

  return {
    holdings,
    transactions,
    symbols,
    recentTransactions,
    computedHoldings,
    summary,
    addHolding,
    sellHolding,
    availableQuantity,
    updateHolding,
    removeHolding,
    clear,
    exportJson,
    importJson,
  }
})
