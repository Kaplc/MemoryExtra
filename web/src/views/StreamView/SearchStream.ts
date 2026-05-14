/* 搜索操作流
 *
 * 作用：管理 search 查询操作的记忆流列
 */

import type { StreamItemData } from './types'
import { StreamBase } from './StreamBase'
import { SearchStreamItem } from './SearchStreamItem'

export class SearchStream extends StreamBase<SearchStreamItem> {
  readonly title = '查询记忆'
  readonly emptyText = '暂无查询记录'
  readonly columnDotClass = 'search'

  createItem(data: StreamItemData): SearchStreamItem {
    return new SearchStreamItem(data)
  }
}
