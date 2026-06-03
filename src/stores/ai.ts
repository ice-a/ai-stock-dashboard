// AI 模型配置 store
import { defineStore } from 'pinia'

const STORAGE_KEY = 'ai-dashboard:ai'

export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
  availableModels: { id: string; owned_by?: string }[]
  temperature: number
  maxTokens: number
  lastSync: number | null
  serverManaged: boolean
}

const DEFAULT: AIConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
  availableModels: [],
  temperature: 0.7,
  maxTokens: 2000,
  lastSync: null,
  serverManaged: false,
}

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AIConfig
      return { ...DEFAULT, ...parsed }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT }
}

export const useAIStore = defineStore('ai', {
  state: () => loadConfig(),

  getters: {
    isConfigured(state): boolean {
      return !!(state.baseUrl && (state.apiKey || state.serverManaged) && state.model)
    },
    hasCredentials(state): boolean {
      return !!(state.baseUrl && (state.apiKey || state.serverManaged))
    },
  },

  actions: {
    save(partial?: Partial<AIConfig>) {
      if (partial) Object.assign(this, partial)
      const json = JSON.stringify({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        model: this.model,
        availableModels: this.availableModels,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        lastSync: this.lastSync,
        serverManaged: this.serverManaged,
      })
      localStorage.setItem(STORAGE_KEY, json)
    },

    setBaseUrl(v: string) { this.save({ baseUrl: v }) },
    setApiKey(v: string) { this.save({ apiKey: v }) },
    setModel(v: string) { this.save({ model: v }) },
    setAvailableModels(v: { id: string; owned_by?: string }[]) {
      this.save({ availableModels: v, lastSync: Date.now() })
    },
    applyRuntimeDefaults(config: { serverManaged: boolean; baseUrl: string; model: string; temperature: number; maxTokens: number }) {
      if (!this.apiKey && config.serverManaged) {
        this.serverManaged = true
        this.baseUrl = config.baseUrl || this.baseUrl
        this.model = this.model || config.model
        this.temperature = config.temperature ?? this.temperature
        this.maxTokens = config.maxTokens ?? this.maxTokens
      }
    },
  },
})
