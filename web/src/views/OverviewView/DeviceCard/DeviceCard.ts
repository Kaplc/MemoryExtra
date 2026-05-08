/* 设备信息卡片
 *
 * 作用：显示系统设备信息（CPU、内存、GPU、磁盘）
 * 实现：每 1 秒轮询 /overview/system-info，合并更新到 info ref
 */

import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePolling } from '@/composables/usePolling'
import { registerCard } from '../CardRegistry'
import DeviceCardVue from '../DeviceCard/DeviceCard.vue'

export interface SystemInfo {
  cpu_percent?: number
  memory_percent?: number
  gpu_name?: string
  gpu_memory_used?: number
  gpu_memory_total?: number
  disk_used?: number
  disk_total?: number
  uptime?: number
}

export class DeviceCard {
  readonly info = ref<SystemInfo | null>(null)

  private _api = useApi()
  private _polling = usePolling(() => this.poll(), 1000, 500)

  /* updateFromData：合并更新设备信息
   * 流程：保留原值的基础上用新数据覆盖，实现增量更新
   */
  updateFromData(data: SystemInfo): void {
    this.info.value = { ...this.info.value, ...data }
  }

  /* poll：轮询获取设备信息
   * 流程：GET /overview/system-info → updateFromData 合并结果
   */
  async poll(): Promise<void> {
    try {
      const info = await this._api.fetchJson<SystemInfo>('/overview/system-info')
      this.updateFromData(info)
    } catch {
      // ignore
    }
  }

  /* start：启动轮询 */
  start(): void { this._polling.start() }
  /* stop：停止轮询 */
  stop(): void { this._polling.stop() }
}

// 主动注册
const _card = new DeviceCard()
registerCard({
  name: 'device',
  component: DeviceCardVue,
  cardClass: _card,
})
