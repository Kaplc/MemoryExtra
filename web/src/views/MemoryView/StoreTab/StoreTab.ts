/* 保存记忆 Tab
 *
 * 作用：用户提供文本输入，存入记忆库
 * 实现：调用 /memory/store 接口保存，/memory/list 列出已保存记忆，/memory/delete 删除记忆
 */

import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { Memory } from '../Memory'
import { memoryViewModel } from '../index'

export class StoreTab {
  readonly input = ref('')
  readonly memories = ref<Memory[]>([])

  private _api = useApi()
  private _toast = useToast()

  /* formatTime：将 ISO 时间戳格式化为"月/日 时:分"形式
   * 参数：ts - ISO 格式时间字符串
   * 返回：本地化时间字符串，如 "05/07 14:30"
   */
  formatTime(ts: string): string {
    if (!ts) return ''
    try {
      return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ts.slice(0, 16)
    }
  }

  /* loadAll：从后端获取当前用户的所有记忆
   * 流程：POST /memory/list → 解析 memories 数组 → 更新 memories ref
   */
  async loadAll(): Promise<void> {
    try {
      const r = await this._api.postJson<{ memories: Memory[] }>('/memory/list', { source: 'user' })
      this.memories.value = r.memories || []
    } catch (e) {
      console.error('[memory] loadAll error:', e)
    }
  }

  /* save：将用户输入的文本存入记忆库
   * 流程：获取 input 内容 → POST /memory/store → 显示保存结果 → 清空输入框 → 刷新列表
   * 标记：保存时标记 source: user，用于区分用户记忆和系统记忆
   */
  async save(): Promise<void> {
    const text = this.input.value.trim()
    if (!text) return
    try {
      // 用户保存的记忆，标记 source: user
      const r = await this._api.postJson<{ result?: string; error?: string }>('/memory/store', { text, memory_meta: { source: 'user' } })
      if (r.error) { this._toast.show(r.error, 'error'); return }
      this._toast.show(r.result || '保存成功')
      this.input.value = ''
      this.loadAll()
    } catch {
      this._toast.show('连接失败', 'error')
    }
  }

  /* delete：删除指定记忆
   * 流程：POST /memory/delete → 从本地列表移除 → 更新统计
   * 参数：id - 记忆的唯一标识
   */
  async delete(id: string): Promise<void> {
    try {
      const r = await this._api.postJson<{ result?: string; error?: string }>('/memory/delete', { memory_id: id })
      if (r.error) { this._toast.show(r.error, 'error'); return }
      this._toast.show(r.result || '删除成功')
      this.memories.value = this.memories.value.filter(m => m.id !== id)
      memoryViewModel.updateStats()
    } catch {
      this._toast.show('删除失败', 'error')
    }
  }
}
