import { EXTERNAL_ENDPOINTS } from '../config/endpoints'
import { hasServerAiConfig, readAiConfig, readOptionalNumberEnv, readSitePassword } from './env'

export interface RuntimeConfig {
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

export function getRuntimeConfig(): RuntimeConfig {
  const ai = readAiConfig()
  return {
    auth: {
      enabled: Boolean(readSitePassword()),
    },
    ai: {
      serverManaged: hasServerAiConfig(),
      baseUrl: ai.baseUrl || EXTERNAL_ENDPOINTS.openai.baseUrl,
      model: ai.model,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
    },
    refresh: {
      listInterval: readOptionalNumberEnv('APP_LIST_REFRESH_SECONDS'),
      detailInterval: readOptionalNumberEnv('APP_DETAIL_REFRESH_SECONDS'),
    },
  }
}
