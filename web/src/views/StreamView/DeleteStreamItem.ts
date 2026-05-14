/* 删除操作记忆项
 *
 * 作用：表示一条 delete 删除操作记录
 */

import type { StreamItemData } from './types'
import { StreamItemBase } from './StreamItemBase'

export class DeleteStreamItem extends StreamItemBase {
  get actionLabel(): string { return '删除' }
  get dotClass(): string { return 'delete' }
  get labelClass(): string { return 'delete-label' }

  clone(newData: Partial<StreamItemData>): DeleteStreamItem {
    return new DeleteStreamItem({ ...this.data, ...newData })
  }
}
