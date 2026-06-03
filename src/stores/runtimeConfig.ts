import { defineStore } from 'pinia'

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
    baseUrl: 'https://api.openai.com/v1',
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
        const r = await fetch('/api/config')
        if (r.ok) {
          this.config = { ...DEFAULT_CONFIG, ...(await r.json()) }
        }
      } finally {
        this.loaded = true
      }
    },
  },
})
