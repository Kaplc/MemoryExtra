/* 删除操作流
 *
 * 作用：管理 delete 删除操作的记忆流列
 */

import type { StreamItemData } from './types'
import { StreamBase } from './StreamBase'
import { DeleteStreamItem } from './DeleteStreamItem'

export class DeleteStream extends StreamBase<DeleteStreamItem> {
  readonly title = '删除记忆'
  readonly emptyText = '暂无删除记录'
  readonly columnDotClass = 'delete'

  createItem(data: StreamItemData): DeleteStreamItem {
    return new DeleteStreamItem(data)
  }
}
