<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAIStore } from '../stores/ai'
import { useAutoRefresh } from '../composables/useAutoRefresh'
import { useRefreshStore } from '../stores/refresh'
import { fetchIndices, type MarketIndex } from '../api/indices'
import { chat } from '../api/ai'
import { fetchHitokoto, type HitokotoSentence } from '../api/hitokoto'
import { computed } from 'vue'

const router = useRouter()
const refreshStore = useRefreshStore()
const aiStore = useAIStore()

// 市场指数
const indices = ref<MarketIndex[]>([])
const indicesLoading = ref(false)

// 日期 & 万年历
const today = new Date()
const dateStr = today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const calendarInfo = ref<string | null>(null)
const calendarLoading = ref(false)

// 一言
const hitokoto = ref<HitokotoSentence>({ hitokoto: '投资最重要的品质是耐心和纪律。', from: '', from_who: null, type: 'e' })

async function refreshHitokoto() {
  hitokoto.value = await fetchHitokoto()
}

// 自动刷新
const enabled = computed(() => refreshStore.enabled)
const interval = computed(() => refreshStore.listInterval)
const { refreshNow } = useAutoRefresh({
  interval, enabled,
  fetcher: async () => {
    // 首页不需要自动刷新股票列表
  }
})

async function loadIndices() {
  indicesLoading.value = true
  try {
    indices.value = await fetchIndices()
  } catch { /* silent */ }
  indicesLoading.value = false
}

async function loadCalendar() {
  if (!aiStore.isConfigured) return
  calendarLoading.value = true
  try {
    const resp = await chat(
      [
        { role: 'system', content: '你是一个日历助手。用一句话输出今天的农历日期、节气或节日（如有）。没有特别信息就输出今日宜忌。简洁，不超过30字。' },
        { role: 'user', content: `今天是 ${dateStr}` },
      ],
      {
        baseUrl: aiStore.baseUrl,
        apiKey: aiStore.apiKey,
        model: aiStore.model,
        temperature: 0.3,
        maxTokens: 100,
      }
    )
    calendarInfo.value = resp.choices?.[0]?.message?.content || null
  } catch { /* silent */ }
  calendarLoading.value = false
}

onMounted(() => {
  loadIndices()
  refreshHitokoto()
  refreshNow()
})

function goToStock(symbol: string) {
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}
</script>

<template>
  <div class="page">
    <!-- 日期 -->
    <section class="top-bar">
      <div class="date-area">
        <div class="date-main">{{ dateStr }}</div>
        <div v-if="calendarInfo" class="date-lunar small muted">{{ calendarInfo }}</div>
        <button v-else-if="aiStore.isConfigured" class="date-action small muted" :disabled="calendarLoading" @click="loadCalendar">
          {{ calendarLoading ? '万年历加载中…' : '生成万年历' }}
        </button>
      </div>
    </section>

    <!-- 一言 -->
    <section class="hitokoto-bar" @click="refreshHitokoto">
      <span class="hk-text">「{{ hitokoto.hitokoto }}」</span>
      <span v-if="hitokoto.from_who || hitokoto.from" class="hk-from small muted">
        —— {{ hitokoto.from_who || hitokoto.from }}
      </span>
    </section>

    <!-- 全球指数 -->
    <section class="indices-section">
      <div class="indices-grid">
        <div v-for="idx in indices" :key="idx.code" class="index-chip"
             :class="idx.changePct >= 0 ? 'pos' : 'neg'">
          <span class="idx-icon">{{ idx.icon }}</span>
          <span class="idx-name">{{ idx.name }}</span>
          <span class="idx-price">{{ idx.price.toFixed(2) }}</span>
          <span class="idx-change">{{ idx.changePct >= 0 ? '+' : '' }}{{ idx.changePct.toFixed(2) }}%</span>
        </div>
        <div v-if="indicesLoading && !indices.length" class="muted small">指数加载中…</div>
      </div>
    </section>

    <!-- 快捷入口 -->
    <section class="quick-links">
      <h2>快捷入口</h2>
      <div class="links-grid">
        <router-link to="/search" class="link-card card">
          <div class="link-icon">🔍</div>
          <div class="link-text">
            <div class="link-title">股票搜索</div>
            <div class="link-desc small muted">按代码或名称搜索股票</div>
          </div>
        </router-link>
        <router-link to="/favorites" class="link-card card">
          <div class="link-icon">⭐</div>
          <div class="link-text">
            <div class="link-title">自选股</div>
            <div class="link-desc small muted">管理您的自选股列表</div>
          </div>
        </router-link>
        <router-link to="/portfolio" class="link-card card">
          <div class="link-icon">💼</div>
          <div class="link-text">
            <div class="link-title">持仓管理</div>
            <div class="link-desc small muted">查看和管理您的持仓</div>
          </div>
        </router-link>
        <router-link to="/ask" class="link-card card">
          <div class="link-icon">🤖</div>
          <div class="link-text">
            <div class="link-title">AI 问答</div>
            <div class="link-desc small muted">智能股票分析助手</div>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 顶部日期 + 一言 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.date-main { font-size: var(--fs-lg); font-weight: 600; }
.date-lunar { margin-top: 2px; }
.date-action {
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.date-action:hover { color: var(--color-link); }

/* 一言 */
.hitokoto-bar {
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
  border-left: 3px solid var(--color-link);
  background: var(--color-bg-elevated);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.hitokoto-bar:hover { background: var(--color-bg-muted); }
.hk-text { font-style: italic; color: var(--color-ink); }
.hk-from { margin-left: var(--space-2); }

/* 全球指数 */
.indices-section {
  margin-bottom: var(--space-5);
}
.indices-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-3);
}
.index-chip {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 6px;
  row-gap: 2px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  font-size: var(--fs-sm);
}
.idx-icon { font-size: 14px; }
.idx-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.idx-price {
  font-variant-numeric: tabular-nums;
  justify-self: end;
}
.idx-change {
  grid-column: 2 / 4;
  justify-self: end;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

/* 快捷入口 */
.quick-links {
  margin-bottom: var(--space-6);
}
.quick-links h2 {
  margin: 0 0 var(--space-4);
  font-size: var(--fs-xl);
}
.links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-3);
}
.link-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  text-decoration: none;
  color: var(--color-ink);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.link-card:hover {
  border-color: var(--color-link);
  box-shadow: var(--shadow-md);
}
.link-icon {
  font-size: 28px;
  flex-shrink: 0;
}
.link-text {
  flex: 1;
  min-width: 0;
}
.link-title {
  font-weight: 600;
  margin-bottom: 2px;
}
.link-desc {
  line-height: 1.4;
}

.pos { color: var(--color-up); }
.neg { color: var(--color-down); }

@media (max-width: 640px) {
  .top-bar { 
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .indices-grid { 
    grid-template-columns: repeat(2, minmax(0, 1fr)); 
  }
  
  .index-chip { 
    padding: var(--space-2) var(--space-3);
  }
  
  .links-grid { 
    grid-template-columns: 1fr; 
  }
  
  .link-card {
    padding: var(--space-3);
  }
  
  .link-icon {
    font-size: 24px;
  }
}

@media (max-width: 420px) {
  .indices-grid { 
    grid-template-columns: 1fr; 
  }
  
  .hitokoto-bar {
    padding: var(--space-2) var(--space-3);
  }
  
  .hk-text {
    font-size: var(--fs-sm);
  }
}
</style>
