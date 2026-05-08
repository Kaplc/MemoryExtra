/* Qdrant 向量库状态卡片
 *
 * 作用：显示 Qdrant 向量数据库连接状态和存储信息
 * 实现：每 2 秒轮询 /overview/qdrant，ready=true 表示连接正常
 */

import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePolling } from '@/composables/usePolling'
import { registerCard } from '../CardRegistry'
import QdrantCardVue from '../QdrantCard/QdrantCard.vue'

export type QdrantBadge = 'loading' | 'ok' | 'err'

export interface QdrantCardData {
  ready: boolean
  host: string
  port: number
  disk_size?: number
}

export class QdrantCard {
  readonly badge = ref<QdrantBadge>('loading')
  readonly detail = ref('')

  private _api = useApi()
  private _polling = usePolling(() => this.poll(), 2000, 800)

  /* badgeClass：返回徽章对应的 CSS 类名
   * loading → badge-loading，ok → badge-ok，err → badge-err
   */
  badgeClass(): string {
    if (this.badge.value === 'loading') return 'badge-loading'
    if (this.badge.value === 'ok') return 'badge-ok'
    return 'badge-err'
  }

  /* updateFromData：更新 Qdrant 状态
   * 流程：ready=true → badge=ok，显示 host:port 和存储大小；否则 → badge=err
   */
  updateFromData(data: QdrantCardData): void {
    this.badge.value = data.ready ? 'ok' : 'err'
    if (data.ready) {
      const sizeGB = (data.disk_size / (1024**3)).toFixed(1)
      this.detail.value = `${data.host}:${data.port} · ${sizeGB}GB`
    } else {
      this.detail.value = ''
    }
  }

  /* poll：轮询获取 Qdrant 状态
   * 流程：GET /overview/qdrant → updateFromData 更新显示
   * 错误处理：失败时 badge=err
   */
  async poll(): Promise<void> {
    try {
      const st = await this._api.fetchJson<any>('/overview/qdrant')
      this.updateFromData(st)
    } catch {
      this.badge.value = 'err'
    }
  }

  /* start：启动轮询 */
  start(): void { this._polling.start() }
  /* stop：停止轮询 */
  stop(): void { this._polling.stop() }
}

// 主动注册
const _card = new QdrantCard()
registerCard({
  name: 'qdrant',
  component: QdrantCardVue,
  cardClass: _card,
})
