import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'

export interface WikiFile {
  path: string
  name: string
  sizeBytes: number
  modifiedTime: number
  indexStatus: 'synced' | 'out_of_sync' | 'not_indexed'
  md5?: string
}

export interface IndexProgress {
  status: 'idle' | 'running' | 'done' | 'error'
  done: number
  total: number
  current_file: string
}

export const useWikiStore = defineStore('wiki', () => {
  const { fetchJson, postJson } = useApi()

  const files = ref<WikiFile[]>([])
  const indexed = ref(false)
  const indexProgress = ref<IndexProgress | null>(null)
  const config = ref<any>({})
  const indexLogLines = ref<string[]>([])

  const fileCount = computed(() => files.value.length)
  const totalSize = computed(() => files.value.reduce((sum, f) => sum + (f.sizeBytes || 0), 0))
  const outOfSyncCount = computed(() => files.value.filter(f => f.indexStatus !== 'synced').length)
  const indexPct = computed(() => {
    if (!indexProgress.value || indexProgress.value.total === 0) return 0
    return Math.round((indexProgress.value.done / indexProgress.value.total) * 100)
  })

  async function loadFiles() {
    try {
      const data = await fetchJson<any>('/wiki/list')
      files.value = Array.isArray(data.files) ? data.files : []
      indexed.value = data.indexed ?? false
    } catch (e) {
      console.error('[wikiStore] loadFiles error:', e)
    }
  }

  async function loadConfig() {
    try {
      config.value = await fetchJson<any>('/wiki/settings')
    } catch (e) {
      console.error('[wikiStore] loadConfig error:', e)
      config.value = {}
    }
  }

  async function saveConfig(payload: Record<string, any>) {
    try {
      const r = await postJson<any>('/wiki/settings', payload)
      if (r.ok) {
        config.value = { ...config.value, ...payload }
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function fetchIndexProgress() {
    try {
      indexProgress.value = await fetchJson<IndexProgress>('/wiki/index-progress')
    } catch (e) {
      console.error('[wikiStore] fetchIndexProgress error:', e)
    }
  }

  async function startIndex() {
    try {
      const r = await postJson<any>('/wiki/index', {})
      return !r.error
    } catch {
      return false
    }
  }

  async function fetchIndexLog() {
    try {
      const data = await fetchJson<any>('/wiki/index-log?lines=20')
      if (data.lines) {
        indexLogLines.value = data.lines
      }
    } catch {
      // 日志获取失败不阻塞
    }
  }

  return {
    files, indexed, indexProgress, config, indexLogLines,
    fileCount, totalSize, outOfSyncCount, indexPct,
    loadFiles, loadConfig, saveConfig,
    fetchIndexProgress, startIndex, fetchIndexLog,
  }
})
