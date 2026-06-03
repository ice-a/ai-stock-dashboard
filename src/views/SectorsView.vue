<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSectorStore } from '../stores/sector'
import { generateSectorStocks } from '../api/sectorAI'
import type { Sector, SectorStock } from '../sectors/types'

const { t } = useI18n()
const router = useRouter()
const sectorStore = useSectorStore()

const search = ref('')
const showNewForm = ref(false)
const generating = ref(false)
const genError = ref<string | null>(null)

// 新板块表单
const newName = ref('')
const newDesc = ref('')
const newMax = ref(30)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return sectorStore.sectors
  return sectorStore.sectors.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description.toLowerCase().includes(q)
  )
})

function enterSector(id: string) {
  sectorStore.setActive(id)
  router.push(`/sector/${id}`)
}

async function createAISector() {
  if (!newName.value.trim()) return
  generating.value = true
  genError.value = null
  try {
    const result = await generateSectorStocks(
      newName.value.trim(),
      newDesc.value.trim() || newName.value.trim(),
      newMax.value,
    )
    const id = newName.value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9一-鿿-]/g, '')
    const sector: Sector = {
      id: `ai-${id}-${Date.now()}`,
      name: newName.value.trim(),
      description: result.summary || newDesc.value.trim(),
      stocks: result.stocks,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sectorStore.addSector(sector)
    showNewForm.value = false
    newName.value = ''
    newDesc.value = ''
    // 自动进入新板块
    enterSector(sector.id)
  } catch (e) {
    genError.value = (e as Error).message
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>板块选择</h1>
      <div class="actions">
        <button class="btn primary" @click="showNewForm = !showNewForm">
          {{ showNewForm ? '取消' : 'AI 生成新板块' }}
        </button>
      </div>
    </header>

    <!-- AI 生成新板块 -->
    <div v-if="showNewForm" class="card new-form">
      <h3>AI 生成板块</h3>
      <p class="small muted">输入板块名称和描述，AI 会自动搜索相关股票</p>
      <div class="form-row">
        <label class="lbl">板块名称</label>
        <input v-model="newName" type="text" placeholder="如：人形机器人、量子计算、固态电池" class="grow" />
      </div>
      <div class="form-row">
        <label class="lbl">描述（可选）</label>
        <input v-model="newDesc" type="text" placeholder="补充说明板块范围" class="grow" />
      </div>
      <div class="form-row">
        <label class="lbl">最大股票数</label>
        <input v-model.number="newMax" type="number" min="5" max="50" />
      </div>
      <div class="form-row">
        <button class="btn primary" :disabled="generating || !newName.trim()" @click="createAISector">
          <span v-if="generating" class="spinner"></span>
          {{ generating ? 'AI 生成中...' : '生成板块' }}
        </button>
        <span v-if="genError" class="neg small">{{ genError }}</span>
      </div>
    </div>

    <!-- 搜索 -->
    <div class="search-bar">
      <input v-model="search" type="search" placeholder="搜索板块名称..." class="search-input" />
    </div>

    <!-- 内置板块 -->
    <section v-if="!search">
      <h2 class="section-title">内置板块</h2>
      <div class="sector-grid">
        <div v-for="s in sectorStore.builtInSectors" :key="s.id"
             class="sector-card card" :class="{ active: s.id === sectorStore.activeId }"
             @click="enterSector(s.id)">
          <div class="sector-icon">{{ s.icon || '📊' }}</div>
          <div class="sector-info">
            <h3>{{ s.name }}</h3>
            <p class="small muted">{{ s.description }}</p>
            <div class="sector-stats small">
              <span>{{ s.stocks.length }} 只股票</span>
              <span>{{ [...new Set(s.stocks.map(st => st.market))].join(' / ') }}</span>
            </div>
          </div>
          <div v-if="s.id === sectorStore.activeId" class="active-badge">当前</div>
        </div>
      </div>
    </section>

    <!-- 自定义板块 -->
    <section v-if="sectorStore.customSectors.length > 0 || search">
      <h2 class="section-title">{{ search ? '搜索结果' : '自定义板块' }}</h2>
      <div class="sector-grid">
        <div v-for="s in filtered.filter(x => !x.isBuiltIn)" :key="s.id"
             class="sector-card card" :class="{ active: s.id === sectorStore.activeId }"
             @click="enterSector(s.id)">
          <div class="sector-icon">{{ s.icon || '📊' }}</div>
          <div class="sector-info">
            <h3>{{ s.name }}</h3>
            <p class="small muted">{{ s.description }}</p>
            <div class="sector-stats small">
              <span>{{ s.stocks.length }} 只股票</span>
            </div>
          </div>
          <button class="btn sm ghost" @click.stop="sectorStore.removeSector(s.id)" title="删除">×</button>
        </div>
      </div>
      <div v-if="filtered.filter(x => !x.isBuiltIn).length === 0" class="empty muted">
        {{ search ? '无匹配板块' : '暂无自定义板块，点击上方"AI 生成新板块"创建' }}
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}
.actions { display: flex; gap: var(--space-2); }
.new-form {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.new-form h3 { margin: 0; }
.form-row { display: flex; align-items: center; gap: var(--space-2); }
.lbl { min-width: 100px; font-size: var(--fs-sm); color: var(--color-muted); }
.grow { flex: 1; }
.search-bar { margin-bottom: var(--space-4); }
.search-input { width: 100%; max-width: 400px; }
.section-title {
  font-size: var(--fs-lg);
  margin: var(--space-4) 0 var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.sector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.sector-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}
.sector-card:hover { border-color: var(--color-link); }
.sector-card.active { border-color: var(--color-link); background: var(--color-info-bg); }
.sector-icon { font-size: 32px; flex-shrink: 0; }
.sector-info { flex: 1; min-width: 0; }
.sector-info h3 { margin: 0 0 4px; font-size: var(--fs-md); }
.sector-info p { margin: 0; line-height: 1.4; }
.sector-stats { display: flex; gap: var(--space-3); margin-top: var(--space-2); }
.active-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: var(--fs-xs);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-link);
  color: white;
}
.empty { text-align: center; padding: var(--space-8); }
.neg { color: var(--color-down); }
.spinner {
  display: inline-block; width: 10px; height: 10px;
  border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: spin 0.8s linear infinite;
  margin-right: 4px;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .sector-grid { grid-template-columns: 1fr; }
}
</style>
