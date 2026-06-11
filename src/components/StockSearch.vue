<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { searchStocks, type SearchResult } from '../api/search'

const router = useRouter()
const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const showDropdown = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

watch(query, (val) => {
  if (timer) clearTimeout(timer)
  if (abortController) abortController.abort()
  if (!val.trim()) {
    results.value = []
    showDropdown.value = false
    return
  }
  timer = setTimeout(async () => {
    abortController = new AbortController()
    loading.value = true
    try {
      results.value = await searchStocks(val)
      showDropdown.value = true
    } finally {
      loading.value = false
    }
  }, 300)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  if (abortController) abortController.abort()
})

function select(item: SearchResult) {
  query.value = ''
  results.value = []
  showDropdown.value = false
  router.push(`/stock/${encodeURIComponent(item.symbol)}`)
}

function onBlur() {
  setTimeout(() => { showDropdown.value = false }, 200)
}
</script>

<template>
  <div class="stock-search">
    <div class="search-input-wrap">
      <span class="search-icon">🔍</span>
      <input
        v-model="query"
        type="text"
        placeholder="搜索股票代码或名称…"
        class="search-input"
        @focus="showDropdown = results.length > 0"
        @blur="onBlur"
      />
      <span v-if="loading" class="search-spinner"></span>
    </div>
    <div v-if="showDropdown && results.length" class="search-dropdown">
      <div v-for="item in results" :key="item.symbol" class="search-item" @mousedown.prevent="select(item)">
        <div class="si-left">
          <span class="si-code">{{ item.code }}</span>
          <span class="si-name">{{ item.name }}</span>
        </div>
        <div class="si-right">
          <span class="si-market tag-light">{{ item.market }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="showDropdown && query.trim() && !loading" class="search-dropdown">
      <div class="search-empty muted small">无匹配结果</div>
    </div>
  </div>
</template>

<style scoped>
.stock-search {
  position: relative;
}
.search-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  padding: 0 var(--space-2);
  transition: border-color var(--transition-fast);
}
.search-input-wrap:focus-within {
  border-color: var(--color-link);
}
.search-icon { font-size: 14px; flex-shrink: 0; }
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 8px 4px;
  font: inherit;
  font-size: var(--fs-sm);
  color: var(--color-ink);
  outline: none;
  min-width: 0;
}
.search-input::placeholder { color: var(--color-muted); }
.search-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-link);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
}
.search-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px var(--space-3);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.search-item:hover { background: var(--color-bg-muted); }
.si-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.si-code {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: var(--fs-sm);
  flex-shrink: 0;
}
.si-name {
  font-size: var(--fs-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.si-right { flex-shrink: 0; }
.tag-light {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--color-bg-muted);
  color: var(--color-muted);
  font-size: 10px;
}
.search-empty {
  padding: var(--space-3);
  text-align: center;
}
</style>
