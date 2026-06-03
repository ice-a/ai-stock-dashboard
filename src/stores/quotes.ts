import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { sourceManager } from '../api/sourceManager'
import { useRefreshStore } from './refresh'
import type { Quote } from '../types'

const STORAGE_KEY = 'ai-dashboard:quotes-cache'

function loadFromStorage(): Map<string, Quote> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const obj = JSON.parse(raw) as Record<string, Quote>
    return new Map(Object.entries(obj))
  } catch {
    return new Map()
  }
}

export const useQuotesStore = defineStore('quotes', () => {
  const quotes = ref<Map<string, Quote>>(loadFromStorage())
  const refreshStore = useRefreshStore()

  const allQuotes = computed(() => Array.from(quotes.value.values()))

  function get(symbol: string): Quote | undefined {
    return quotes.value.get(symbol)
  }

  function set(q: Quote) {
    quotes.value.set(q.symbol, q)
  }

  function setMany(qs: Quote[]) {
    for (const q of qs) {
      quotes.value.set(q.symbol, q)
    }
  }

  async function fetchAndStore(symbols: string[], options: { force?: boolean; signal?: AbortSignal } = {}) {
    refreshStore.setStatus('loading')
    try {
      const result = await sourceManager.fetchQuotes(symbols, { signal: options.signal })
      for (const q of result) {
        quotes.value.set(q.symbol, q)
      }
      const anyData = result.some(q => q.price != null)
      if (anyData) refreshStore.recordSuccess()
      else refreshStore.recordFailure('no data from any source')
      return result
    } catch (e) {
      refreshStore.recordFailure((e as Error).message)
      throw e
    }
  }

  async function fetchOne(symbol: string, options: { force?: boolean; signal?: AbortSignal } = {}) {
    refreshStore.setStatus('loading')
    try {
      const q = await sourceManager.fetchQuote(symbol, { signal: options.signal })
      quotes.value.set(q.symbol, q)
      if (q.price != null) refreshStore.recordSuccess()
      else refreshStore.recordFailure('no data')
      return q
    } catch (e) {
      refreshStore.recordFailure((e as Error).message)
      throw e
    }
  }

  watch(quotes, (val) => {
    try {
      const obj: Record<string, Quote> = {}
      for (const [k, v] of val.entries()) obj[k] = v
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
    } catch { /* quota */ }
  }, { deep: true })

  function clear() {
    quotes.value.clear()
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  return {
    quotes,
    allQuotes,
    get,
    set,
    setMany,
    fetchAndStore,
    fetchOne,
    clear,
  }
})
