/* 存入操作记忆项
 *
 * 作用：表示一条 MCP store 操作记录
 */

import type { StreamItemData } from './types'
import { StreamItemBase } from './StreamItemBase'

export class StoreStreamItem extends StreamItemBase {
  get actionLabel(): string { return '存入' }
  get dotClass(): string { return 'store' }
  get labelClass(): string { return '' }

  clone(newData: Partial<StreamItemData>): StoreStreamItem {
    return new StoreStreamItem({ ...this.data, ...newData })
  }
}
