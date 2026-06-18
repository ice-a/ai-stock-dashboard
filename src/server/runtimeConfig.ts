import { EXTERNAL_ENDPOINTS } from '../config/endpoints'
import { hasServerAiConfig, readAiConfig, readOptionalNumberEnv, readSitePassword, readMongoUri } from './env'

export interface RuntimeConfig {
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

export function getRuntimeConfig(): RuntimeConfig {
  const ai = readAiConfig()
  const mongoUri = readMongoUri()
  
  return {
    auth: {
      enabled: Boolean(readSitePassword()),
    },
    ai: {
      serverManaged: hasServerAiConfig(),
      configured: hasServerAiConfig(),
      baseUrl: ai.baseUrl || EXTERNAL_ENDPOINTS.openai.baseUrl,
      model: ai.model,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
    },
    mongo: {
      configured: Boolean(mongoUri),
    },
    site: {
      hasPassword: Boolean(readSitePassword()),
    },
    refresh: {
      listInterval: readOptionalNumberEnv('APP_LIST_REFRESH_SECONDS'),
      detailInterval: readOptionalNumberEnv('APP_DETAIL_REFRESH_SECONDS'),
    },
  }
}
