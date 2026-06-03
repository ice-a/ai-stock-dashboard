// 主题管理 store
// 主题包含完整的研究数据（公司池、观察名单、逐股研究、产业地图、DSX六层、首页卡片等）
import { defineStore } from 'pinia'
import { AI_SUPPLY_CHAIN_TOPIC } from '../topics/defaultTopic'
import { CPO_TOPIC } from '../topics/cpoTopic'
import type { Topic, TopicSummary, TopicData } from '../topics/types'

const STORAGE_KEY = 'ai-dashboard:topics'
const ACTIVE_KEY = 'ai-dashboard:active-topic'

const BUILTIN_TOPICS = [AI_SUPPLY_CHAIN_TOPIC, CPO_TOPIC]

function loadTopics(): Topic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Topic[]
      // 确保内置主题永远存在
      for (const builtin of BUILTIN_TOPICS) {
        if (!parsed.find(t => t.id === builtin.id)) {
          parsed.unshift(builtin)
        }
      }
      return parsed
    }
  } catch { /* ignore */ }
  return [...BUILTIN_TOPICS]
}

function saveTopics(topics: Topic[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(topics))
}

function loadActiveId(): string {
  return localStorage.getItem(ACTIVE_KEY) || AI_SUPPLY_CHAIN_TOPIC.id
}

export const useTopicStore = defineStore('topic', {
  state: () => {
    const topics = loadTopics()
    const activeId = loadActiveId()
    return {
      topics,
      activeId: topics.find(t => t.id === activeId) ? activeId : topics[0].id,
    }
  },

  getters: {
    current(state): Topic {
      return state.topics.find(t => t.id === state.activeId) || state.topics[0]
    },
    currentData(): TopicData {
      return this.current.data
    },
    summaries(state): TopicSummary[] {
      return state.topics.map(t => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        description: t.description,
        count: {
          universe: t.data.leaderUniverse.length,
          watchlist: t.data.watchlistIdeas.length,
          deepDive: t.data.deepDiveStocks.length,
          chains: t.data.chainLayers.length,
          dsx: t.data.dsxLayers.length,
        },
        createdAt: t.createdAt,
        isBuiltIn: BUILTIN_TOPICS.some(b => b.id === t.id),
      }))
    },
  },

  actions: {
    setActive(id: string) {
      if (!this.topics.find(t => t.id === id)) return
      this.activeId = id
      localStorage.setItem(ACTIVE_KEY, id)
    },

    addTopic(topic: Omit<Topic, 'createdAt' | 'updatedAt'>) {
      const t: Topic = { ...topic, createdAt: Date.now(), updatedAt: Date.now() }
      this.topics.push(t)
      saveTopics(this.topics)
      return t
    },

    updateTopic(id: string, patch: Partial<Topic>) {
      const idx = this.topics.findIndex(t => t.id === id)
      if (idx < 0) return
      this.topics[idx] = { ...this.topics[idx], ...patch, updatedAt: Date.now() }
      saveTopics(this.topics)
    },

    deleteTopic(id: string) {
      if (BUILTIN_TOPICS.find(t => t.id === id)) return  // 内置主题不可删
      this.topics = this.topics.filter(t => t.id !== id)
      saveTopics(this.topics)
      if (this.activeId === id && this.topics.length > 0) {
        this.setActive(this.topics[0].id)
      }
    },

    importJson(json: string): { ok: boolean; error?: string; count?: number } {
      try {
        const parsed = JSON.parse(json) as Topic | Topic[]
        const arr = Array.isArray(parsed) ? parsed : [parsed]
        let count = 0
        for (const t of arr) {
          if (!t.id || !t.name || !t.data) {
            return { ok: false, error: 'JSON 格式不合法，缺少 id/name/data' }
          }
          // 避免 ID 冲突
          let id = t.id
          let n = 1
          while (this.topics.find(x => x.id === id)) {
            id = `${t.id}-${n++}`
          }
          this.addTopic({ ...t, id })
          count++
        }
        return { ok: true, count }
      } catch (e) {
        return { ok: false, error: (e as Error).message }
      }
    },

    exportJson(id?: string): string {
      const list = id ? this.topics.filter(t => t.id === id) : this.topics
      return JSON.stringify(list, null, 2)
    },

    exportCsv(id?: string): string {
      const topic = id ? this.topics.find(t => t.id === id) : this.current
      if (!topic) return ''
      const rows = ['symbol,name,region,layer,status']
      for (const s of topic.data.leaderUniverse) {
        rows.push(`${s.symbol},${s.name},${s.region},${s.layer},${s.status}`)
      }
      return rows.join('\n')
    },
  },
})
