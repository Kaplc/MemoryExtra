/* 记忆流列 抽象基类
 *
 * 作用：管理单列流的 items/total 状态，封装 load 和 applyStatusMap 逻辑
 * 子类需实现：title / emptyText / columnDotClass / createItem
 */

import { ref, computed } from 'vue'
import type { StreamItemData, StreamResponse } from './types'
import type { StreamItemBase } from './StreamItemBase'

export abstract class StreamBase<T extends StreamItemBase> {
  readonly items = ref<T[]>([])
  readonly total = ref(0)
  readonly countText = computed(() => `${this.items.value.length} 条`)

  abstract readonly title: string
  abstract readonly emptyText: string
  abstract readonly columnDotClass: string

  /* createItem：工厂方法，由子类创建对应类型的 Item 实例 */
  abstract createItem(data: StreamItemData): T

  /* load：从 API 响应更新列表
   * 流程：map 原始数据 → createItem → 更新 items/total
   */
  load(res: StreamResponse): void {
    this.items.value = (res.items || []).map(d => this.createItem(d))
    this.total.value = res.total || 0
  }

  /* applyStatusMap：按最新状态映射更新 pending 项
   * 流程：遍历 items → pending 且状态有变 → clone 新实例 → 替换数组
   * 优化：仅当存在真实变化时触发响应式更新
   */
  applyStatusMap(statusMap: Map<number, StreamItemData['status']>): void {
    let changed = false
    const next = this.items.value.map(item => {
      if (item.status === 'pending') {
        const ns = statusMap.get(item.id)
        if (ns && ns !== 'pending') {
          changed = true
          return item.clone({ status: ns }) as T
        }
      }
      return item
    })
    if (changed) this.items.value = next
  }
}
