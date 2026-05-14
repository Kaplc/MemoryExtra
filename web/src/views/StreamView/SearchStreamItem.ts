/* 搜索操作记忆项
 *
 * 作用：表示一条 search 查询操作记录
 */

import type { StreamItemData } from './types'
import { StreamItemBase } from './StreamItemBase'

export class SearchStreamItem extends StreamItemBase {
  get actionLabel(): string { return '搜索' }
  get dotClass(): string { return 'search' }
  get labelClass(): string { return '' }

  clone(newData: Partial<StreamItemData>): SearchStreamItem {
    return new SearchStreamItem({ ...this.data, ...newData })
  }
}
