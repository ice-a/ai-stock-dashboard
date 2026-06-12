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

app.mount('#app')

// Non-blocking bootstrap
const runtimeConfig = useRuntimeConfigStore(pinia)
runtimeConfig.load().then(() => {
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
}).catch(console.warn)
