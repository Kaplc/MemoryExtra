/* 记忆流视图模型 - 面向对象设计
 *
 * 作用：显示记忆的实时存入/搜索/删除操作流
 * 实现：双列表分别展示 store 和 search 操作，定时轮询更新状态
 */

import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePolling } from '@/composables/usePolling'

/* ==================== Types ==================== */
export interface StreamItem {
  id: number
  action: 'store' | 'search' | 'delete'
  content: string
  memory_id: string | null
  status: 'pending' | 'done' | 'error' | ''
  created_at: string
}

export interface StreamResponse {
  items: StreamItem[]
  total: number
}

/* ==================== SteamViewModel ==================== */
export class StreamViewModel {
  // State
  readonly storeItems = ref<StreamItem[]>([])
  readonly searchItems = ref<StreamItem[]>([])
  readonly storeTotal = ref(0)
  readonly searchTotal = ref(0)
  readonly knownIds = ref(new Set<string>())

  // Computed
  readonly totalCount = computed(() =>
    `MCP ${this.storeTotal.value} 条 / 搜索 ${this.searchTotal.value} 条`
  )
  readonly storeCountText = computed(() => `${this.storeItems.value.length} 条`)
  readonly searchCountText = computed(() => `${this.searchItems.value.length} 条`)

  // Private
  private _api = useApi()
  private _statusPoll = usePolling(() => this.pollStatus(), 1000)
  private _streamPoll = usePolling(() => this.loadStream(), 2000)

  /* ==================== Helpers ==================== */

  /* getActionLabel：获取操作类型的中文标签
   * store → '存入'，search → '搜索'，其他 → '删除'
   */
  getActionLabel(action: string): string {
    if (action === 'store') return '存入'
    if (action === 'search') return '搜索'
    return '删除'
  }

  /* formatTime：提取时间戳中的时分秒部分
   * 示例：'2024-05-07T14:30:00' → '14:30:00'
   */
  formatTime(createdAt: string): string {
    return (createdAt || '').slice(11, 19)
  }

  /* getItemText：获取记忆项的显示文本
   * 优先 content，fallback 到 memory_id
   */
  getItemText(item: StreamItem): string {
    return item.content || item.memory_id || ''
  }

  /* isNew：判断是否为新出现的项（未在 knownIds 中） */
  isNew(id: number): boolean {
    return !this.knownIds.value.has(String(id))
  }

  /* markKnown：将项 ID 记录到 knownIds 集合 */
  markKnown(items: StreamItem[]): void {
    items.forEach(item => this.knownIds.value.add(String(item.id)))
  }

  /* getStatusIcon：获取状态图标标识
   * pending → 'pending'，done → 'done'，error → 'error'，其他 → ''
   */
  getStatusIcon(status: string): 'pending' | 'done' | 'error' | '' {
    if (status === 'pending') return 'pending'
    if (status === 'done') return 'done'
    if (status === 'error') return 'error'
    return ''
  }

  /* ==================== Load stream ==================== */

  /* loadStream：加载存入和搜索操作流
   * 流程：并行 GET /stream/api?action=store&days=3 和 /stream/api?action=search&days=3
   * → 更新 storeItems/searchItems → 标记已知 ID
   */
  async loadStream(): Promise<void> {
    try {
      const [storeRes, searchRes] = await Promise.all([
        this._api.fetchJson<StreamResponse>('/stream/api?action=store&days=3'),
        this._api.fetchJson<StreamResponse>('/stream/api?action=search&days=3'),
      ])

      this.storeItems.value = storeRes.items || []
      this.searchItems.value = searchRes.items || []
      this.storeTotal.value = storeRes.total || 0
      this.searchTotal.value = searchRes.total || 0

      requestAnimationFrame(() => {
        this.markKnown(this.storeItems.value)
        this.markKnown(this.searchItems.value)
      })
    } catch (e) {
      console.error('[SteamView] load failed:', e)
    }
  }

  /* ==================== Status poll ==================== */

  /* pollStatus：轮询更新操作状态
   * 流程：检查是否有 pending 状态的项 → 并行获取最新数据 → 只更新状态变化的项
   * 优化：仅当状态真正变化时触发响应式更新
   */
  async pollStatus(): Promise<void> {
    const allCurrent = [...this.storeItems.value, ...this.searchItems.value]
    const hasPending = allCurrent.some(i => i.status === 'pending')
    if (!hasPending) return

    try {
      const [storeRes, searchRes] = await Promise.all([
        this._api.fetchJson<StreamResponse>('/stream/api?action=store&days=3'),
        this._api.fetchJson<StreamResponse>('/stream/api?action=search&days=3'),
      ])

      const allFresh = [
        ...(storeRes.items || []),
        ...(searchRes.items || []),
      ]
      const statusMap = new Map<number, string>()
      allFresh.forEach(i => statusMap.set(i.id, i.status))

      const updateStatus = (items: StreamItem[]) => {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.status === 'pending') {
            const newStatus = statusMap.get(item.id)
            if (newStatus && newStatus !== 'pending') {
              items[i] = { ...item, status: newStatus as StreamItem['status'] }
            }
          }
        }
      }

      this.storeItems.value = [...this.storeItems.value]
      this.searchItems.value = [...this.searchItems.value]
      updateStatus(this.storeItems.value)
      updateStatus(this.searchItems.value)
    } catch {
      // silent
    }
  }

  /* ==================== Lifecycle ==================== */

  /* onMounted：组件挂载时启动轮询 */
  onMounted(): void {
    console.log('[SteamView] mounted')
    this.loadStream()
    this._streamPoll.start()
    this._statusPoll.start()
  }

  /* onUnmounted：组件卸载时停止轮询 */
  onUnmounted(): void {
    this._streamPoll.stop()
    this._statusPoll.stop()
  }
}

// 单例
export const streamViewModel = new StreamViewModel()