// AI 模型配置 store
import { defineStore } from 'pinia'
import { EXTERNAL_ENDPOINTS } from '../config/endpoints'

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
  baseUrl: EXTERNAL_ENDPOINTS.openai.baseUrl,
  apiKey: '',
  model: '',
  availableModels: [],
  temperature: 0.7,
  maxTokens: 2000,
  lastSync: null,
  serverManaged: false,
}

export function sanitizeModelId(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback
  const model = value.trim()
  if (!model) return ''
  if (model.startsWith('{') || model.startsWith('[')) {
    try {
      const parsed = JSON.parse(model) as { enabled?: unknown; authenticated?: unknown; user?: unknown }
      if (
        typeof parsed === 'object' &&
        parsed &&
        ('enabled' in parsed || 'authenticated' in parsed || 'user' in parsed)
      ) {
        return fallback
      }
    } catch {
      return fallback
    }
  }
  return model
}

export function sanitizeAvailableModels(value: unknown): AIConfig['availableModels'] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string') return { id: sanitizeModelId(item) }
      if (item && typeof item === 'object') {
        const id = sanitizeModelId((item as { id?: unknown }).id)
        if (!id) return null
        const ownedBy = (item as { owned_by?: unknown }).owned_by
        return typeof ownedBy === 'string' ? { id, owned_by: ownedBy } : { id }
      }
      return null
    })
    .filter((item): item is { id: string; owned_by?: string } => Boolean(item?.id))
}

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AIConfig
      return {
        ...DEFAULT,
        ...parsed,
        model: sanitizeModelId(parsed.model),
        availableModels: sanitizeAvailableModels(parsed.availableModels),
      }
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
      this.model = sanitizeModelId(this.model)
      this.availableModels = sanitizeAvailableModels(this.availableModels)
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
    setModel(v: string) { this.save({ model: sanitizeModelId(v) }) },
    setAvailableModels(v: { id: string; owned_by?: string }[]) {
      this.save({ availableModels: sanitizeAvailableModels(v), lastSync: Date.now() })
    },
    applyRuntimeDefaults(config: { serverManaged: boolean; baseUrl: string; model: string; temperature: number; maxTokens: number }) {
      this.model = sanitizeModelId(this.model)
      if (!this.apiKey && config.serverManaged) {
        this.serverManaged = true
        this.baseUrl = config.baseUrl || this.baseUrl
        this.model = this.model || sanitizeModelId(config.model)
        this.temperature = config.temperature ?? this.temperature
        this.maxTokens = config.maxTokens ?? this.maxTokens
      }
    },
  },
})
