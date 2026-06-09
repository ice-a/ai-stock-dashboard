import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { AIResearchReport, AIResearchReportKind } from '../types'

const STORAGE_KEY = 'ai-dashboard:research-reports'

function uid(): string {
  return `rr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeReport(input: AIResearchReport): AIResearchReport | null {
  if (!input?.title || !Array.isArray(input.symbols)) return null
  return {
    id: input.id || uid(),
    kind: input.kind || 'stock-advice',
    title: String(input.title),
    symbols: input.symbols.map(s => String(s).trim().toUpperCase()).filter(Boolean),
    content: String(input.content || ''),
    payload: input.payload ?? null,
    model: String(input.model || ''),
    source: input.source || 'stock-detail',
    createdAt: Number(input.createdAt) || Date.now(),
  }
}

function loadReports(): AIResearchReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AIResearchReport[]
    return Array.isArray(parsed) ? parsed.map(normalizeReport).filter(Boolean) as AIResearchReport[] : []
  } catch {
    return []
  }
}

export const useResearchStore = defineStore('research', () => {
  const reports = ref<AIResearchReport[]>(loadReports())

  const recentReports = computed(() => [...reports.value].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100))
  const comparisonReports = computed(() => recentReports.value.filter(report => report.kind === 'comparison'))

  function bySymbol(symbol: string) {
    const target = symbol.trim().toUpperCase()
    return recentReports.value.filter(report => report.symbols.includes(target))
  }

  function addReport(input: Omit<AIResearchReport, 'id' | 'createdAt'>): AIResearchReport {
    const report: AIResearchReport = {
      ...input,
      id: uid(),
      symbols: input.symbols.map(s => s.trim().toUpperCase()).filter(Boolean),
      createdAt: Date.now(),
    }
    reports.value.unshift(report)
    if (reports.value.length > 200) reports.value = reports.value.slice(0, 200)
    return report
  }

  function addStockAdviceReport(input: {
    symbol: string
    name: string
    advice: unknown
    model: string
  }) {
    const advice = input.advice as {
      rating?: string
      confidence?: string
      summary?: string
      reasons?: string[]
      risks?: string[]
      klineAnalysis?: string
      catalysts?: string[]
    }
    const content = [
      `## 核心结论`,
      `**${advice.rating || '观望'}**，置信度 **${advice.confidence || '中'}**`,
      advice.summary ? `\n${advice.summary}` : '',
      advice.reasons?.length ? `## 看多理由\n${advice.reasons.map(item => `- ${item}`).join('\n')}` : '',
      advice.risks?.length ? `## 风险提示\n${advice.risks.map(item => `- ${item}`).join('\n')}` : '',
      advice.klineAnalysis ? `## 技术面\n${advice.klineAnalysis}` : '',
      advice.catalysts?.length ? `## 催化剂\n${advice.catalysts.map(item => `- ${item}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n')

    return addReport({
      kind: 'stock-advice',
      title: `${input.name} AI 投资建议`,
      symbols: [input.symbol],
      content,
      payload: input.advice,
      model: input.model,
      source: 'stock-detail',
    })
  }

  function removeReport(id: string) {
    reports.value = reports.value.filter(report => report.id !== id)
  }

  function clear(kind?: AIResearchReportKind) {
    reports.value = kind ? reports.value.filter(report => report.kind !== kind) : []
  }

  function exportJson(): string {
    return JSON.stringify({ version: 1, reports: reports.value }, null, 2)
  }

  function importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as { reports?: AIResearchReport[] }
      reports.value = Array.isArray(parsed.reports)
        ? parsed.reports.map(normalizeReport).filter(Boolean) as AIResearchReport[]
        : []
      return true
    } catch {
      return false
    }
  }

  watch(reports, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch { /* quota */ }
  }, { deep: true })

  return {
    reports,
    recentReports,
    comparisonReports,
    bySymbol,
    addReport,
    addStockAdviceReport,
    removeReport,
    clear,
    exportJson,
    importJson,
  }
})
