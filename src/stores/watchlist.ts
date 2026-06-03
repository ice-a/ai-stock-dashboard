import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { FavoriteItem } from '../types'

const STORAGE_KEY = 'ai-dashboard:favorites'

function loadFromStorage(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as FavoriteItem[]
  } catch {
    return []
  }
}

export const useWatchlistStore = defineStore('watchlist', () => {
  const items = ref<FavoriteItem[]>(loadFromStorage())

  const allSymbols = computed(() => items.value.map(i => i.symbol))

  const bySymbol = computed(() => {
    const map = new Map<string, FavoriteItem>()
    for (const i of items.value) map.set(i.symbol, i)
    return map
  })

  const groups = computed(() => {
    const set = new Set<string>()
    for (const i of items.value) set.add(i.group)
    return ['default', ...[...set].filter(g => g !== 'default').sort()]
  })

  function has(symbol: string): boolean {
    return bySymbol.value.has(symbol)
  }

  function add(symbol: string, group = 'default', note = '', targetPrice: number | null = null) {
    if (bySymbol.value.has(symbol)) return
    items.value.push({ symbol, group, note, targetPrice, addedAt: Date.now() })
  }

  function remove(symbol: string) {
    items.value = items.value.filter(i => i.symbol !== symbol)
  }

  function toggle(symbol: string, group = 'default') {
    if (has(symbol)) remove(symbol)
    else add(symbol, group)
  }

  function update(symbol: string, patch: Partial<FavoriteItem>) {
    const idx = items.value.findIndex(i => i.symbol === symbol)
    if (idx < 0) return
    items.value[idx] = { ...items.value[idx], ...patch }
  }

  function clear() {
    items.value = []
  }

  function exportJson(): string {
    return JSON.stringify({ version: 1, items: items.value }, null, 2)
  }

  function importJson(json: string): { added: number; merged: number } {
    try {
      const parsed = JSON.parse(json)
      if (!parsed || !Array.isArray(parsed.items)) return { added: 0, merged: 0 }
      let added = 0, merged = 0
      const exist = new Set(items.value.map(i => i.symbol))
      for (const i of parsed.items as FavoriteItem[]) {
        if (exist.has(i.symbol)) {
          merged++
          continue
        }
        items.value.push(i)
        added++
        exist.add(i.symbol)
      }
      return { added, merged }
    } catch {
      return { added: 0, merged: 0 }
    }
  }

  watch(items, (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch { /* quota */ }
  }, { deep: true })

  return { items, allSymbols, bySymbol, groups, has, add, remove, toggle, update, clear, exportJson, importJson }
})
