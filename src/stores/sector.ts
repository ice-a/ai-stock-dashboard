// 板块 store
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Sector, SectorStock, Market } from '../sectors/types'
import { DEFAULT_SECTORS } from '../sectors/defaults'

const STORAGE_KEY = 'ai-dashboard:sectors'
const ACTIVE_KEY = 'ai-dashboard:active-sector'

function loadFromStorage(): Sector[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Sector[]
      // 合并内置板块（确保新增的内置板块不丢失）
      const builtInIds = new Set(DEFAULT_SECTORS.map(s => s.id))
      const userSectors = parsed.filter(s => !builtInIds.has(s.id))
      return [...DEFAULT_SECTORS, ...userSectors]
    }
  } catch { /* ignore */ }
  return [...DEFAULT_SECTORS]
}

function loadActiveId(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (raw) return raw
  } catch { /* ignore */ }
  return 'ai-chain'
}

export const useSectorStore = defineStore('sector', () => {
  const sectors = ref<Sector[]>(loadFromStorage())
  const activeId = ref<string>(loadActiveId())

  const activeSector = computed(() =>
    sectors.value.find(s => s.id === activeId.value) || sectors.value[0]
  )

  const builtInSectors = computed(() => sectors.value.filter(s => s.isBuiltIn))
  const customSectors = computed(() => sectors.value.filter(s => !s.isBuiltIn))

  // 按市场分组的股票
  const stocksByMarket = computed(() => {
    const sector = activeSector.value
    if (!sector) return { '美股': [], '港股': [], 'A股': [] } as Record<Market, SectorStock[]>
    const grouped: Record<Market, SectorStock[]> = { '美股': [], '港股': [], 'A股': [] }
    for (const stock of sector.stocks) {
      const market = stock.market as Market
      if (grouped[market]) grouped[market].push(stock)
    }
    return grouped
  })

  // 按层级分组
  const stocksByLayer = computed(() => {
    const sector = activeSector.value
    if (!sector) return {}
    const grouped: Record<string, SectorStock[]> = {}
    for (const stock of sector.stocks) {
      const layer = stock.layer || '其他'
      if (!grouped[layer]) grouped[layer] = []
      grouped[layer].push(stock)
    }
    return grouped
  })

  function setActive(id: string) {
    activeId.value = id
    localStorage.setItem(ACTIVE_KEY, id)
  }

  function addSector(sector: Sector) {
    // 防重复
    if (sectors.value.some(s => s.id === sector.id)) {
      // 更新已有板块
      const idx = sectors.value.findIndex(s => s.id === sector.id)
      sectors.value[idx] = { ...sectors.value[idx], ...sector, updatedAt: Date.now() }
    } else {
      sectors.value.push(sector)
    }
  }

  function removeSector(id: string) {
    const target = sectors.value.find(s => s.id === id)
    if (target?.isBuiltIn) return // 不可删除内置板块
    sectors.value = sectors.value.filter(s => s.id !== id)
    if (activeId.value === id) {
      activeId.value = sectors.value[0]?.id || 'ai-chain'
    }
  }

  function addStockToSector(sectorId: string, stock: SectorStock) {
    const sector = sectors.value.find(s => s.id === sectorId)
    if (!sector) return
    if (sector.stocks.some(s => s.symbol === stock.symbol)) return
    sector.stocks.push(stock)
    sector.updatedAt = Date.now()
  }

  function removeStockFromSector(sectorId: string, symbol: string) {
    const sector = sectors.value.find(s => s.id === sectorId)
    if (!sector) return
    sector.stocks = sector.stocks.filter(s => s.symbol !== symbol)
    sector.updatedAt = Date.now()
  }

  function updateSectorStocks(sectorId: string, stocks: SectorStock[]) {
    const sector = sectors.value.find(s => s.id === sectorId)
    if (!sector) return
    sector.stocks = stocks
    sector.updatedAt = Date.now()
  }

  // 获取所有板块中的所有 symbol（去重）
  const allSymbols = computed(() => {
    const set = new Set<string>()
    for (const s of sectors.value) {
      for (const stock of s.stocks) set.add(stock.symbol)
    }
    return [...set]
  })

  // 持久化
  watch(sectors, (val) => {
    try {
      // 只保存用户自定义板块（内置板块从 defaults 加载）
      const builtInIds = new Set(DEFAULT_SECTORS.map(s => s.id))
      const userSectors = val.filter(s => !builtInIds.has(s.id))
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...DEFAULT_SECTORS, ...userSectors]))
    } catch { /* quota */ }
  }, { deep: true })

  return {
    sectors, activeId, activeSector,
    builtInSectors, customSectors,
    stocksByMarket, stocksByLayer, allSymbols,
    setActive, addSector, removeSector,
    addStockToSector, removeStockFromSector, updateSectorStocks,
  }
})
