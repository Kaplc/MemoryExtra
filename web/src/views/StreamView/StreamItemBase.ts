/* 记忆流 Item 抽象基类
 *
 * 作用：封装单条记忆项的通用显示逻辑（时间、文本、状态图标）
 * 子类需实现：actionLabel / dotClass / labelClass / clone
 */

import type { StreamItemData } from './types'

export abstract class StreamItemBase {
  constructor(public readonly data: StreamItemData) {}

  get id(): number { return this.data.id }
  get action(): StreamItemData['action'] { return this.data.action }
  get status(): StreamItemData['status'] { return this.data.status }

  /* displayTime：提取时分秒部分
   * '2024-05-07T14:30:00' → '14:30:00'
   */
  get displayTime(): string { return (this.data.created_at || '').slice(11, 19) }

  /* displayText：优先 content，fallback 到 memory_id */
  get displayText(): string { return this.data.content || this.data.memory_id || '' }

  /* statusIcon：返回状态图标类型 */
  get statusIcon(): 'pending' | 'done' | 'error' | '' {
    const s = this.data.status
    if (s === 'pending' || s === 'done' || s === 'error') return s
    return ''
  }

  abstract get actionLabel(): string
  abstract get dotClass(): string
  abstract get labelClass(): string

  /* clone：创建带有新字段的同类实例（用于 status 变更时的不可变更新） */
  abstract clone(newData: Partial<StreamItemData>): StreamItemBase
}
