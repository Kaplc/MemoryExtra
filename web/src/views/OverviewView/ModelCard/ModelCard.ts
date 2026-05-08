/* 模型状态卡片
 *
 * 作用：显示嵌入模型加载状态
 * 实现：每 2 秒轮询 /overview/model，loaded=true 表示模型就绪
 */

import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePolling } from '@/composables/usePolling'
import { registerCard } from '../CardRegistry'
import ModelCardVue from '../ModelCard/ModelCard.vue'

export type ModelBadge = 'loading' | 'ok' | 'err'

export interface ModelCardData {
  loaded: boolean
  embedding_model?: string
  embedding_dim?: number
}

export class ModelCard {
  readonly badge = ref<ModelBadge>('loading')
  readonly subText = ref('加载中...')
  readonly detail = ref('')

  private _api = useApi()
  private _polling = usePolling(() => this.poll(), 2000, 0)

  /* badgeClass：返回徽章对应的 CSS 类名
   * loading → badge-loading，ok → badge-ok，err → badge-err
   */
  badgeClass(): string {
    if (this.badge.value === 'loading') return 'badge-loading'
    if (this.badge.value === 'ok') return 'badge-ok'
    return 'badge-err'
  }

  /* updateFromData：更新模型状态
   * 流程：loaded=true → badge=ok，显示模型名称和维度；否则 → badge=loading
   */
  updateFromData(data: ModelCardData): void {
    if (data.loaded) {
      this.badge.value = 'ok'
      this.subText.value = '模型就绪'
      this.detail.value = data.embedding_model ? `${data.embedding_model} · ${data.embedding_dim}d` : ''
    } else {
      this.badge.value = 'loading'
      this.subText.value = '加载中...'
      this.detail.value = ''
    }
  }

  /* poll：轮询获取模型状态
   * 流程：GET /overview/model → updateFromData 更新显示
   * 错误处理：失败时 badge=err，subText='模型加载失败'
   */
  async poll(): Promise<void> {
    try {
      const st = await this._api.fetchJson<any>('/overview/model')
      this.updateFromData(st)
    } catch {
      this.badge.value = 'err'
      this.subText.value = '模型加载失败'
      this.detail.value = ''
    }
  }

  /* start：启动轮询 */
  start(): void { this._polling.start() }
  /* stop：停止轮询 */
  stop(): void { this._polling.stop() }
}

// 主动注册
const _card = new ModelCard()
registerCard({
  name: 'model',
  component: ModelCardVue,
  cardClass: _card,
})
