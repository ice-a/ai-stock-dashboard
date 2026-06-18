import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dbFind, dbFindOne, dbUpsert } from '../api/db'

export interface UserProfile {
  userId: string
  key: string
  nickname: string
  avatarUrl?: string
  createdAt: number
  apiCallsRemaining?: number
  longbridgeConfig?: {
    appKey: string
    appSecret: string
    accessToken: string
  }
  dataSource?: 'auto' | 'eastmoney' | 'sina' | 'longport' | 'longport-cn'
}

export const useUserStore = defineStore('user', () => {
  const user = ref<UserProfile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isLoggedIn = computed(() => !!user.value)
  const apiCallsRemaining = computed(() => user.value?.apiCallsRemaining ?? 100)

  // 从 localStorage 恢复登录状态
  function restoreSession() {
    try {
      const saved = localStorage.getItem('ai-dashboard:user')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.userId && parsed.key) {
          user.value = parsed
        }
      }
    } catch { /* ignore */ }
  }

  // 登录
  async function login(userId: string, key: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      // 验证用户
      const profile = await dbFindOne<UserProfile>('users', { userId, key })
      
      if (profile) {
        // 确保有 API 调用次数
        if (profile.apiCallsRemaining === undefined) {
          profile.apiCallsRemaining = 100
        }
        user.value = profile
        localStorage.setItem('ai-dashboard:user', JSON.stringify(profile))
        return true
      } else {
        error.value = '用户ID或密钥错误'
        return false
      }
    } catch (e) {
      error.value = (e as Error).message || '登录失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 注册
  async function register(userId: string, key: string, nickname?: string): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      // 检查用户是否已存在
      const existing = await dbFindOne<UserProfile>('users', { userId })
      if (existing) {
        error.value = '该用户ID已存在'
        return false
      }

      // 创建用户
      const profile: UserProfile = {
        userId,
        key,
        nickname: nickname || userId,
        createdAt: Date.now(),
        apiCallsRemaining: 100,
        dataSource: 'auto',
      }

      await dbUpsert('users', { userId }, profile)
      user.value = profile
      localStorage.setItem('ai-dashboard:user', JSON.stringify(profile))
      return true
    } catch (e) {
      error.value = (e as Error).message || '注册失败'
      return false
    } finally {
      loading.value = false
    }
  }

  // 登出
  function logout() {
    user.value = null
    localStorage.removeItem('ai-dashboard:user')
  }

  // 消耗 API 调用次数
  async function consumeApiCall(): Promise<boolean> {
    if (!user.value) return false
    
    if ((user.value.apiCallsRemaining ?? 0) <= 0) {
      error.value = 'API 调用次数已用完'
      return false
    }

    user.value.apiCallsRemaining = (user.value.apiCallsRemaining ?? 100) - 1
    localStorage.setItem('ai-dashboard:user', JSON.stringify(user.value))
    
    // 同步到云端
    try {
      await dbUpsert('users', 
        { userId: user.value.userId },
        { apiCallsRemaining: user.value.apiCallsRemaining }
      )
    } catch (e) {
      console.error('Failed to sync API calls:', e)
    }
    
    return true
  }

  // 更新用户配置
  async function updateProfile(updates: Partial<UserProfile>): Promise<boolean> {
    if (!user.value) return false
    
    try {
      Object.assign(user.value, updates)
      localStorage.setItem('ai-dashboard:user', JSON.stringify(user.value))
      
      await dbUpsert('users', 
        { userId: user.value.userId },
        updates
      )
      return true
    } catch (e) {
      error.value = (e as Error).message || '更新失败'
      return false
    }
  }

  // 更新长桥配置
  async function updateLongbridgeConfig(config: UserProfile['longbridgeConfig']): Promise<boolean> {
    return updateProfile({ longbridgeConfig: config })
  }

  // 更新数据源
  async function updateDataSource(source: UserProfile['dataSource']): Promise<boolean> {
    return updateProfile({ dataSource: source })
  }

  // 生成随机密钥
  function generateKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const arr = new Uint8Array(16)
    crypto.getRandomValues(arr)
    for (let i = 0; i < 16; i++) {
      result += chars[arr[i] % chars.length]
    }
    return result
  }

  // 初始化时恢复会话
  restoreSession()

  return {
    user,
    loading,
    error,
    isLoggedIn,
    apiCallsRemaining,
    login,
    register,
    logout,
    consumeApiCall,
    updateProfile,
    updateLongbridgeConfig,
    updateDataSource,
    generateKey,
    restoreSession,
  }
})
