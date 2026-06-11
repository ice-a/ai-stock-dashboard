import { defineStore } from 'pinia'
import { APP_API_ROUTES, EXTERNAL_ENDPOINTS } from '../config/endpoints'

export interface ClientRuntimeConfig {
  auth: {
    enabled: boolean
  }
  ai: {
    serverManaged: boolean
    baseUrl: string
    model: string
    temperature: number
    maxTokens: number
  }
  refresh: {
    listInterval: number | null
    detailInterval: number | null
  }
}

const DEFAULT_CONFIG: ClientRuntimeConfig = {
  auth: { enabled: false },
  ai: {
    serverManaged: false,
    baseUrl: EXTERNAL_ENDPOINTS.openai.baseUrl,
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
  },
  refresh: {
    listInterval: null,
    detailInterval: null,
  },
}

export const useRuntimeConfigStore = defineStore('runtimeConfig', {
  state: () => ({
    loaded: false,
    config: DEFAULT_CONFIG,
  }),

  actions: {
    async load() {
      try {
        const r = await fetch(APP_API_ROUTES.config)
        if (r.ok) {
          const remote = await r.json()
          this.config = {
            auth: { ...DEFAULT_CONFIG.auth, ...(remote.auth || {}) },
            ai: { ...DEFAULT_CONFIG.ai, ...(remote.ai || {}) },
            refresh: { ...DEFAULT_CONFIG.refresh, ...(remote.refresh || {}) },
          }
        }
      } finally {
        this.loaded = true
      }
    },
  },
})
