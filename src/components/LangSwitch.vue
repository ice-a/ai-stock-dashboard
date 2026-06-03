<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { setLocale } from '../i18n'
import type { Locale } from '../i18n'

const { locale, t } = useI18n()
const settings = useSettingsStore()

function toggle() {
  const next: Locale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
  setLocale(next)
  settings.setLocale(next)
}
</script>

<template>
  <button class="lang btn ghost" @click="toggle" :title="t('settings.language')">
    {{ locale === 'zh-CN' ? '中' : 'EN' }}
  </button>
</template>

<style scoped>
.lang {
  min-width: 36px;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.5px;
}
</style>
