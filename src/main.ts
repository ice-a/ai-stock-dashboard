import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { useRuntimeConfigStore } from './stores/runtimeConfig'
import { useAIStore } from './stores/ai'
import { useSettingsStore } from './stores/settings'
import { useRefreshStore } from './stores/refresh'
import './styles/main.css'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.use(i18n)

async function bootstrap() {
  const runtimeConfig = useRuntimeConfigStore(pinia)
  await runtimeConfig.load()

  const ai = useAIStore(pinia)
  ai.applyRuntimeDefaults(runtimeConfig.config.ai)

  const settings = useSettingsStore(pinia)
  const refresh = useRefreshStore(pinia)
  if (runtimeConfig.config.refresh.listInterval) {
    settings.listInterval = runtimeConfig.config.refresh.listInterval
    refresh.setListInterval(runtimeConfig.config.refresh.listInterval)
  }
  if (runtimeConfig.config.refresh.detailInterval) {
    settings.detailInterval = runtimeConfig.config.refresh.detailInterval
    refresh.setDetailInterval(runtimeConfig.config.refresh.detailInterval)
  }

  app.mount('#app')
}

bootstrap()
