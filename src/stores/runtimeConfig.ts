import { defineStore } from 'pinia'
import { APP_API_ROUTES, EXTERNAL_ENDPOINTS } from '../config/endpoints'

export interface ClientRuntimeConfig {
  auth: {
    enabled: boolean
  }
  ai: {
    serverManaged: boolean
    configured: boolean
    baseUrl: string
    model: string
    temperature: number
    maxTokens: number
  }
  mongo: {
    configured: boolean
  }
  site: {
    hasPassword: boolean
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
    configured: false,
    baseUrl: EXTERNAL_ENDPOINTS.openai.baseUrl,
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
  },
  mongo: {
    configured: false,
  },
  site: {
    hasPassword: false,
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
            ai: { 
              ...DEFAULT_CONFIG.ai, 
              ...(remote.ai || {}),
              configured: !!(remote.ai?.apiKey || remote.ai?.serverManaged),
            },
            mongo: { 
              ...DEFAULT_CONFIG.mongo, 
              ...(remote.mongo || {}),
            },
            site: { 
              ...DEFAULT_CONFIG.site, 
              ...(remote.site || {}),
            },
            refresh: { ...DEFAULT_CONFIG.refresh, ...(remote.refresh || {}) },
          }
        }
      } finally {
        this.loaded = true
      }
    },
  },
})
