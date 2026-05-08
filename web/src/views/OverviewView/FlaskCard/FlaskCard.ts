/* Flask 服务状态卡片
 *
 * 作用：显示 Flask 后端服务状态，支持重启操作
 * 实现：每 2 秒轮询 /overview/flask，支持一键重启（15 秒倒计时）
 */

import { ref } from 'vue'
import { useApi } from '@/composables/useApi'
import { usePolling } from '@/composables/usePolling'
import { registerCard } from '../CardRegistry'
import FlaskCardVue from '../FlaskCard/FlaskCard.vue'

export type FlaskBadge = 'ok' | 'err' | 'restarting' | 'yellow'

export interface FlaskCardData {
  pid: number
  port: number
  uptime?: number
}

export class FlaskCard {
  readonly badge = ref<FlaskBadge>('ok')
  readonly restarting = ref(false)
  readonly restartSeconds = ref(0)
  readonly detail = ref('')
  readonly uptime = ref(0)

  private _api = useApi()
  private _polling = usePolling(() => this.poll(), 2000, 1600)
  private _restartTimer: number | null = null

  /* badgeClass：返回徽章对应的 CSS 类名
   * ok → badge-ok，restarting → badge-loading，err/yellow → badge-err
   */
  badgeClass(): string {
    if (this.badge.value === 'ok') return 'badge-ok'
    if (this.badge.value === 'restarting') return 'badge-loading'
    return 'badge-err'
  }

  /* updateFromData：更新 Flask 服务数据
   * 流程：设置 badge 为 ok → 更新详情文本和运行时间
   */
  updateFromData(data: FlaskCardData): void {
    this.badge.value = 'ok'
    this.detail.value = `PID: ${data.pid} · 端口: ${data.port}`
    this.uptime.value = data.uptime || 0
  }

  /* poll：轮询获取 Flask 状态
   * 流程：GET /overview/flask → updateFromData 更新显示
   */
  async poll(): Promise<void> {
    try {
      const st = await this._api.fetchJson<any>('/overview/flask')
      this.updateFromData(st)
    } catch {
      // ignore
    }
  }

  /* restart：重启 Flask 服务
   * 流程：POST /overview/flask/restart → 启动 15 秒倒计时 → 倒计时结束复位 restarting 状态
   * 保护：restarting 为 true 时直接返回，防止重复请求
   */
  async restart(): Promise<void> {
    if (this.restarting.value) return
    this.restarting.value = true
    this.restartSeconds.value = 0
    try {
      await this._api.postJson('/overview/flask/restart', {})
      const countdown = setInterval(() => {
        this.restartSeconds.value++
        if (this.restartSeconds.value >= 15) {
          clearInterval(countdown)
          this.restarting.value = false
        }
      }, 1000)
      this._restartTimer = countdown
    } catch {
      this.restarting.value = false
    }
  }

  /* cleanup：清理定时器（组件卸载时调用） */
  cleanup(): void {
    if (this._restartTimer !== null) {
      clearInterval(this._restartTimer)
      this._restartTimer = null
    }
  }

  /* start：启动轮询 */
  start(): void { this._polling.start() }
  /* stop：停止轮询 */
  stop(): void { this._polling.stop() }
}

// 主动注册
const _card = new FlaskCard()
registerCard({
  name: 'flask',
  component: FlaskCardVue,
  cardClass: _card,
})
