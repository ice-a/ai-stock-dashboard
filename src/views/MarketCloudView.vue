<script setup lang="ts">
import { ref } from 'vue'

const cloudUrl = 'https://dapanyuntu.com/'
const frameKey = ref(0)
const loading = ref(true)

function refreshFrame() {
  loading.value = true
  frameKey.value += 1
}
</script>

<template>
  <div class="market-cloud-page">
    <header class="cloud-toolbar">
      <div>
        <h1>大盘云图</h1>
        <p class="small muted">数据源：dapanyuntu.com</p>
      </div>
      <div class="toolbar-actions">
        <button class="btn" type="button" @click="refreshFrame">刷新</button>
        <a class="btn primary" :href="cloudUrl" target="_blank" rel="noopener noreferrer">外部打开</a>
      </div>
    </header>

    <section class="cloud-frame-wrap" :class="{ loading }">
      <div v-if="loading" class="frame-loading">
        <span class="spinner"></span>
        <span class="small muted">加载中...</span>
      </div>
      <iframe
        :key="frameKey"
        class="cloud-frame"
        :src="cloudUrl"
        title="大盘云图"
        loading="eager"
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        @load="loading = false"
      ></iframe>
    </section>
  </div>
</template>

<style scoped>
.market-cloud-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--header-height));
  background: var(--color-bg);
}

.cloud-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
}

.cloud-toolbar h1 {
  font-size: var(--fs-xl);
  margin-bottom: 4px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.cloud-frame-wrap {
  position: relative;
  flex: 1;
  min-height: 640px;
  background: var(--color-bg-elevated);
}

.cloud-frame {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 640px;
  border: 0;
  background: var(--color-bg-elevated);
}

.frame-loading {
  position: absolute;
  top: var(--space-4);
  left: var(--space-5);
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 32px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-bg-elevated) 92%, transparent);
  box-shadow: var(--shadow-sm);
}

.cloud-frame-wrap:not(.loading) .frame-loading {
  display: none;
}

@media (max-width: 700px) {
  .cloud-toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: var(--space-3);
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions .btn {
    flex: 1;
  }

  .cloud-frame-wrap,
  .cloud-frame {
    min-height: calc(100vh - var(--header-height) - 140px);
  }
}
</style>
