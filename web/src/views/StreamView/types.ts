/* 记忆流 - 共享类型
 *
 * 作用：定义 API 原始数据结构，供所有 Item 类和 Stream 类引用
 */

export interface StreamItemData {
  id: number
  action: 'store' | 'search' | 'delete'
  content: string
  memory_id: string | null
  status: 'pending' | 'done' | 'error' | ''
  created_at: string
}

export interface StreamResponse {
  items: StreamItemData[]
  total: number
}
