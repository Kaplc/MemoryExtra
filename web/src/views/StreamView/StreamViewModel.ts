/* 记忆流视图模型（协调器）
 *
 * 作用：顶层协调器，管理 3 种流的轮询与 knownIds 动画
 * 依赖：StoreStream / SearchStream / DeleteStream（各自独立文件）
 */

import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePolling } from '@/composables/usePolling'
import type { StreamResponse, StreamItemData } from './types'
import type { StreamItemBase } from './StreamItemBase'
import { StoreStream } from './StoreStream'
import { SearchStream } from './SearchStream'
import { DeleteStream } from './DeleteStream'

export type { StreamItemData, StreamResponse } from './types'
export { StoreStream } from './StoreStream'
export { SearchStream } from './SearchStream'
export { DeleteStream } from './DeleteStream'
export { StoreStreamItem } from './StoreStreamItem'
export { SearchStreamItem } from './SearchStreamItem'
export { DeleteStreamItem } from './DeleteStreamItem'

export class StreamViewModel {
  // 3种流实例
  readonly storeStream = new StoreStream()
  readonly searchStream = new SearchStream()
  readonly deleteStream = new DeleteStream()

  // 供模板 v-for 统一渲染
  readonly streams = [this.storeStream, this.searchStream, this.deleteStream]

  // 新出现项的 ID 集合（用于入场动画）
  readonly knownIds = ref(new Set<string>())

  // 顶部汇总文字
  readonly totalCount = computed(() =>
    `MCP ${this.storeStream.total.value} 条 / 搜索 ${this.searchStream.total.value} 条 / 删除 ${this.deleteStream.total.value} 条`
  )

  // Private
  private _api = useApi()
  private _statusPoll = usePolling(() => this.pollStatus(), 1000)
  private _streamPoll = usePolling(() => this.loadStream(), 2000)

  /* isNew：判断是否为新出现的项（用于触发动画） */
  isNew(id: number): boolean {
    return !this.knownIds.value.has(String(id))
  }

  private markKnown(items: StreamItemBase[]): void {
    items.forEach(item => this.knownIds.value.add(String(item.id)))
  }

  /* loadStream：并行拉取 3 种操作流
   * 流程：Promise.all → 各 stream.load → requestAnimationFrame 标记已知 ID
   */
  async loadStream(): Promise<void> {
    try {
      const [storeRes, searchRes, deleteRes] = await Promise.all([
        this._api.fetchJson<StreamResponse>('/stream/api?action=store&days=3'),
        this._api.fetchJson<StreamResponse>('/stream/api?action=search&days=3'),
        this._api.fetchJson<StreamResponse>('/stream/api?action=delete&days=3'),
      ])
      this.storeStream.load(storeRes)
      this.searchStream.load(searchRes)
      this.deleteStream.load(deleteRes)

      requestAnimationFrame(() => {
        this.markKnown(this.storeStream.items.value)
        this.markKnown(this.searchStream.items.value)
        this.markKnown(this.deleteStream.items.value)
      })
    } catch (e) {
      console.error('[StreamView] load failed:', e)
    }
  }

  /* pollStatus：轮询更新 pending 状态
   * 流程：检查是否有 pending 项 → 并行拉取最新数据 → 构建 statusMap → 各 stream.applyStatusMap
   */
  async pollStatus(): Promise<void> {
    const allItems = [
      ...this.storeStream.items.value,
      ...this.searchStream.items.value,
      ...this.deleteStream.items.value,
    ]
    if (!allItems.some(i => i.status === 'pending')) return

    try {
      const [storeRes, searchRes, deleteRes] = await Promise.all([
        this._api.fetchJson<StreamResponse>('/stream/api?action=store&days=3'),
        this._api.fetchJson<StreamResponse>('/stream/api?action=search&days=3'),
        this._api.fetchJson<StreamResponse>('/stream/api?action=delete&days=3'),
      ])

      const statusMap = new Map<number, StreamItemData['status']>()
      ;[...storeRes.items, ...searchRes.items, ...deleteRes.items]
        .forEach(i => statusMap.set(i.id, i.status))

      this.storeStream.applyStatusMap(statusMap)
      this.searchStream.applyStatusMap(statusMap)
      this.deleteStream.applyStatusMap(statusMap)
    } catch {
      // silent
    }
  }

  /* onMounted：启动轮询 */
  onMounted(): void {
    this.loadStream()
    this._streamPoll.start()
    this._statusPoll.start()
  }

  /* onUnmounted：停止轮询 */
  onUnmounted(): void {
    this._streamPoll.stop()
    this._statusPoll.stop()
  }
}

// 单例
export const streamViewModel = new StreamViewModel()
