/* 存入操作流
 *
 * 作用：管理 MCP store 操作的记忆流列
 */

import type { StreamItemData } from './types'
import { StreamBase } from './StreamBase'
import { StoreStreamItem } from './StoreStreamItem'

export class StoreStream extends StreamBase<StoreStreamItem> {
  readonly title = 'MCP调用'
  readonly emptyText = '暂无写入记录'
  readonly columnDotClass = 'store'

  createItem(data: StreamItemData): StoreStreamItem {
    return new StoreStreamItem(data)
  }
}
