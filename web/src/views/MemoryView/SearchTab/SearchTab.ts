/* 搜索记忆 Tab
 *
 * 作用：提供关键词搜索记忆、查看搜索历史、管理搜索结果
 * 实现：POST /memory/search 搜索，GET /memory/search-history 获取历史，DELETE 清除历史
 */

import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { Memory } from '../Memory'
import { memoryViewModel } from '../index'

export class SearchTab {
  readonly input = ref('')
  readonly results = ref<Memory[]>([])
  readonly activeQuery = ref('')
  readonly history = ref<string[]>([])
  readonly showHistory = ref(false)
  readonly loading = ref(false)
  readonly isSearching = ref(false)
  readonly deletingIds = ref<Set<string>>(new Set())
  readonly pendingIds = ref<Set<string>>(new Set())

  private _api = useApi()
  private _toast = useToast()
  private _searchTimer: ReturnType<typeof setTimeout> | null = null

  /* debounceSearch：防抖搜索（500ms 延迟）
   * 流程：清除之前的定时器 → 设置新的延迟定时器 → 到期后执行 search()
   * 用于：避免用户输入时频繁触发搜索
   */
  debounceSearch(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    if (this.isSearching.value) return
    this._searchTimer = setTimeout(() => this.search(), 500)
  }

  /* search：执行记忆搜索
   * 流程：校验输入 → POST /memory/search → 解析结果转换为 Memory 对象 → 更新历史记录
   * 防抖：通过 isSearching 标记防止并发搜索请求
   */
  async search(): Promise<void> {
    const query = this.input.value.trim()
    if (!query) return
    if (this.isSearching.value) return
    this.isSearching.value = true
    this.loading.value = true
    this.activeQuery.value = query
    this.results.value = []
    try {
      const r = await this._api.postJson<{ results: Memory[] }>('/memory/search', { query })
      this.results.value = (r.results || []).map(raw => new Memory(raw))
      this.loadHistory()
    } catch {
      this._toast.show('搜索失败', 'error')
    } finally {
      this.loading.value = false
      this.isSearching.value = false
    }
  }

  /* searchFromHistory：从历史记录中选择关键词搜索
   * 流程：填充输入框 → 关闭历史面板 → 执行搜索
   */
  searchFromHistory(query: string): void {
    this.input.value = query
    this.showHistory.value = false
    this.search()
  }

  /* loadHistory：加载搜索历史记录
   * 流程：GET /memory/search-history → 提取 query 字段列表
   */
  async loadHistory(): Promise<void> {
    try {
      const r = await this._api.fetchJson<{ history: { query: string }[] }>('/memory/search-history')
      this.history.value = (r.history || []).map(h => h.query)
    } catch { /* ignore */ }
  }

  /* clearHistory：清除所有搜索历史
   * 流程：DELETE /memory/search-history → 清空本地历史列表
   */
  async clearHistory(): Promise<void> {
    try {
      await fetch('/memory/search-history', { method: 'DELETE' })
      this.history.value = []
    } catch { /* ignore */ }
  }

  /* onDocumentClick：监听文档点击，关闭历史下拉面板
   * 流程：检测点击目标是否在 .search-history-wrap 外部 → 是则隐藏历史面板
   */
  onDocumentClick(e: MouseEvent): void {
    const wrap = document.querySelector('.search-history-wrap')
    if (wrap && !wrap.contains(e.target as Node)) this.showHistory.value = false
  }

  /* delete：删除单条搜索结果中的记忆
   * 流程：标记 pending（按钮转圈）→ 调 API → 成功后触发滑出动画 → 延迟 300ms 等动画完成 → 移除列表项
   * 支持同时删除多条，互不影响
   */
  async delete(id: string): Promise<void> {
    if (this.pendingIds.value.has(id)) return
    this.pendingIds.value = new Set(this.pendingIds.value).add(id)
    try {
      const r = await this._api.postJson<{ result?: string; error?: string }>('/memory/delete', { memory_id: id })
      if (r.error) { this._toast.show(r.error, 'error'); return }
      this._toast.show(r.result || '删除成功')
      // API 成功后才触发滑出动画
      this.deletingIds.value = new Set(this.deletingIds.value).add(id)
      await new Promise(r => setTimeout(r, 300))
      this.results.value = this.results.value.filter(m => m.id !== id)
      // 同步从 storeTab 本地缓存中移除
      memoryViewModel.storeTab.memories.value = memoryViewModel.storeTab.memories.value.filter(m => m.id !== id)
      memoryViewModel.updateStats()
    } catch {
      this._toast.show('删除失败', 'error')
    } finally {
      const p = new Set(this.pendingIds.value); p.delete(id); this.pendingIds.value = p
      const d = new Set(this.deletingIds.value); d.delete(id); this.deletingIds.value = d
    }
  }

  /* formatTime：将 ISO 时间戳格式化为"月/日 时:分"形式
   * 参数：ts - ISO 格式时间字符串
   * 返回：本地化时间字符串
   */
  formatTime(ts: string): string {
    if (!ts) return ''
    try {
      return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ts.slice(0, 16)
    }
  }
}
