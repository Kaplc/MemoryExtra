/* 单条记忆 - 数据模型
 *
 * 作用：封装 API 返回的记忆数据，提供各字段的格式化访问
 * 构造：解析 API 原始数据，提取 id/text/timestamp/score/category 字段
 * 参数：data - { id, text, timestamp, score?, category? }
 */
export class Memory {
  readonly id: string
  readonly text: string
  readonly timestamp: string
  readonly score?: number
  readonly category?: string

  constructor(data: { id: string; text: string; timestamp: string; score?: number; category?: string }) {
    this.id = data.id
    this.text = data.text
    this.timestamp = data.timestamp
    this.score = data.score
    this.category = data.category
  }

  /* categoryLabel：格式化的分类标签
   * 返回：life → 'life'，fact → '事实'，exp → '经验'，其他 → 原值
   */
  get categoryLabel(): string {
    const map: Record<string, string> = { life: 'life', fact: '事实', exp: '经验' }
    return this.category ? (map[this.category] || this.category) : ''
  }

  /* scorePercent：格式化的相似度（百分比）
   * 返回：0.85 → '85.0%'，无 score 时返回空字符串
   */
  get scorePercent(): string {
    return this.score !== undefined ? `${(this.score * 100).toFixed(1)}%` : ''
  }

  /* formattedTime：格式化的日期时间
   * 返回：ISO 时间 → '05/07 14:30' 形式
   */
  get formattedTime(): string {
    if (!this.timestamp) return ''
    try {
      return new Date(this.timestamp).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      })
    } catch {
      return this.timestamp.slice(0, 16)
    }
  }

  /* shortId：短 ID（用于显示）
   * 返回：id 前 8 位，如 'a1b2c3d4...'
   */
  get shortId(): string {
    return this.id.slice(0, 8)
  }
}