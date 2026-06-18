// 用户数据同步工具
import { useUserStore } from '../stores/user'
import { dbFindOne, dbUpsert } from '../api/db'

// 获取用户数据集合名称
function getUserCollection(baseCollection: string): string {
  return baseCollection
}

// 保存用户数据
export async function saveUserData(collection: string, data: any): Promise<boolean> {
  const userStore = useUserStore()
  if (!userStore.user) return false

  try {
    const userId = userStore.user.userId
    await dbUpsert(
      getUserCollection(collection),
      { userId },
      { userId, ...data, updatedAt: Date.now() }
    )
    return true
  } catch (e) {
    console.error('Failed to save user data:', e)
    return false
  }
}

// 加载用户数据
export async function loadUserData<T>(collection: string): Promise<T | null> {
  const userStore = useUserStore()
  if (!userStore.user) return null

  try {
    const userId = userStore.user.userId
    const result = await dbFindOne<T>(getUserCollection(collection), { userId })
    return result
  } catch (e) {
    console.error('Failed to load user data:', e)
    return null
  }
}

// 同步自选股
export async function syncWatchlist(items: any[]): Promise<boolean> {
  return saveUserData('watchlists', { items })
}

// 加载自选股
export async function loadWatchlist(): Promise<any[] | null> {
  const data = await loadUserData<{ items: any[] }>('watchlists')
  return data?.items || null
}

// 同步持仓
export async function syncPortfolio(holdings: any[], transactions: any[]): Promise<boolean> {
  return saveUserData('portfolios', { holdings, transactions })
}

// 加载持仓
export async function loadPortfolio(): Promise<{ holdings: any[]; transactions: any[] } | null> {
  return loadUserData<{ holdings: any[]; transactions: any[] }>('portfolios')
}

// 同步设置
export async function syncSettings(settings: any): Promise<boolean> {
  return saveUserData('settings', { settings })
}

// 加载设置
export async function loadSettings(): Promise<any | null> {
  const data = await loadUserData<{ settings: any }>('settings')
  return data?.settings || null
}

// 同步环境变量配置
export async function syncEnvConfig(config: any): Promise<boolean> {
  return saveUserData('env_configs', { config })
}

// 加载环境变量配置
export async function loadEnvConfig(): Promise<any | null> {
  const data = await loadUserData<{ config: any }>('env_configs')
  return data?.config || null
}
