/* Wiki视图模型 - 面向对象设计
 *
 * 作用：管理 Wiki 页面的文件列表、索引重建、设置保存等功能
 * 实现：提供单例 wikiViewModel，支持文件排序、进度跟踪、设置管理等
 */

import { ref, nextTick } from 'vue'
import { useWikiStore } from '@/stores/wiki'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import { WikiFileItem } from './WikiFileItem'
import type { ApiWikiFile } from './WikiFileItem'

type SortKey = 'filename' | 'sizeBytes' | 'modified'
type TabType = 'stats' | 'ops' | 'settings'

/* ==================== WikiViewModel ==================== */
export class WikiViewModel {
  // Loading state
  readonly loading = ref(true)
  readonly loadError = ref(false)

  // Tab state
  readonly activeTab = ref<TabType>('stats')

  // Index result
  readonly indexResultMsg = ref<{ type: 'ok' | 'err'; text: string } | null>(null)
  readonly showProgress = ref(false)
  readonly progressLabel = ref('准备中...')
  readonly progressPct = ref('0%')
  readonly progressPctNum = ref(0)

  // Sorting
  readonly sortKey = ref<SortKey>('modified')
  readonly sortAsc = ref(false)

  // Settings form
  readonly formWikiDir = ref('')
  readonly formLightragDir = ref('')
  readonly formLanguage = ref('Chinese')
  readonly formChunkSize = ref(1200)
  readonly formTimeout = ref(30)
  readonly saving = ref(false)

  // Copy toast
  readonly copyToastVisible = ref(false)

  // File data
  readonly rawFiles = ref<WikiFileItem[]>([])

  // Private
  private _store = useWikiStore()
  private _api = useApi()
  private _toast = useToast()
  private _pollTimer: ReturnType<typeof setInterval> | null = null
  private _lastDone = -1
  private _pendingRelPath: string | null = null
  private _lastCurrentFile = ''

  /* ==================== Computed ==================== */

  /* sortedFiles：排序后的文件列表
   * 流程：复制数组 → 根据 sortKey/sortAsc 排序 → 返回排序结果
   * sortKey：filename（忽略大小写）/ sizeBytes / modified
   */
  get sortedFiles(): WikiFileItem[] {
    const arr = this.rawFiles.value.slice()
    const key = this.sortKey.value
    const asc = this.sortAsc.value
    arr.sort((a, b) => {
      let va: string | number, vb: string | number
      if (key === 'filename') {
        va = a.filename.toLowerCase()
        vb = b.filename.toLowerCase()
      } else if (key === 'sizeBytes') {
        va = a.size_bytes
        vb = b.size_bytes
      } else {
        va = a.modified
        vb = b.modified
      }
      if (va < vb) return asc ? -1 : 1
      if (va > vb) return asc ? 1 : -1
      return 0
    })
    return arr
  }

  /* totalSize：所有文件的总大小（字节） */
  get totalSize(): number {
    return this.rawFiles.value.reduce((s, f) => s + (f.size_bytes || 0), 0)
  }

  /* indexStatusText：索引状态文本和颜色
   * 未索引 → '未索引'（黄色），有文件out_of_sync → '需重建 X 个文件'（橙色），已同步 → '已同步'（绿色）
   */
  get indexStatusText(): { text: string; color: string } {
    if (!this._store.indexed) return { text: '未索引', color: '#fde047' }
    const out = this.rawFiles.value.filter(f => f.index_status !== 'synced').length
    if (out > 0) return { text: '需重建 ' + out + ' 个文件', color: '#f97316' }
    return { text: '已同步', color: '#86efac' }
  }

  /* sortArrow：获取排序方向箭头
   * 当前列 → 返回 ▲(升序) 或 ▼(降序)，非当前列 → 返回空
   */
  sortArrow(key: SortKey): string {
    if (this.sortKey.value !== key) return ''
    return this.sortAsc.value ? ' ▲' : ' ▼'
  }

  /* ==================== Formatting ==================== */

  /* escHtml：HTML 特殊字符转义
   * & → &amp;，< → &lt;，> → &gt;，" → &quot;
   */
  escHtml(s: string): string {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  /* formatSize：字节大小格式化
   * <1KB → B，<1MB → KB，否则 → MB
   */
  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  /* formatDate：时间戳格式化
   * 输入：Unix 时间戳（秒）
   * 输出：'YYYY-MM-DD HH:mm'
   */
  formatDate(ts: number): string {
    if (!ts) return '-'
    const d = new Date(ts * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  /* ==================== Data loading ==================== */

  /* loadFiles：加载文件列表
   * 流程：GET /wiki/list → 转换为 WikiFileItem 数组 → 更新 rawFiles 和 indexed 状态
   */
  async loadFiles(skipRender = false): Promise<void> {
    this.loading.value = true
    this.loadError.value = false
    try {
      const data = await this._api.fetchJson<{ files: ApiWikiFile[]; indexed: boolean }>('/wiki/list')
      const files: ApiWikiFile[] = Array.isArray(data.files) ? data.files : []
      this.rawFiles.value = files.map(f => new WikiFileItem(f))
      this._store.indexed = data.indexed ?? false
    } catch (e) {
      console.error('[WikiView] loadFiles error:', e)
      this.loadError.value = true
    } finally {
      this.loading.value = false
    }
  }

  /* _markFileSynced：根据 rel_path 找到对应文件项，标记为已同步
   * 用于：索引完成后批量更新文件状态
   */
  private _markFileSynced(relPath: string): void {
    const item = this.rawFiles.value.find(f => f.rel_path === relPath)
    if (item) {
      console.log(`[WikiView] _markFileSynced: ${relPath} → synced`)
      item.markSynced()
    } else {
      console.warn(`[WikiView] _markFileSynced: 未找到文件项 rel_path=${relPath}（共 ${this.rawFiles.value.length} 个）`)
    }
  }

  /* _advanceProgress：推进度时把当前文件从 out_of_sync/not_indexed 改成 synced
   * 流程：标准化路径分隔符（Windows \ → /）→ 清除所有 isCurrent → 找到匹配文件 → 标记 synced
   */
  private _advanceProgress(done: number, total: number, currentRelPath: string): void {
    // 标准化路径分隔符（Windows \ → /）
    const normalizedPath = currentRelPath.replace(/\\/g, '/')
    this.rawFiles.value.forEach(f => f.isCurrent = false)
    this._pendingRelPath = normalizedPath
    const item = this.rawFiles.value.find(f => f.rel_path.replace(/\\/g, '/') === normalizedPath)
    if (item) {
      item.markCurrent()
      item.markSynced()
      this.rawFiles.value = [...this.rawFiles.value]
    } else if (currentRelPath) {
      console.warn(`[WikiView] _advanceProgress: 未找到 ${currentRelPath}`)
    }
  }

  /* loadSettings：加载 Wiki 设置
   * 流程：GET /wiki/settings → 更新表单各字段
   */
  async loadSettings(): Promise<void> {
    try {
      const data = await this._api.fetchJson<any>('/wiki/settings')
      if (data.error) return
      this.formWikiDir.value = data.wiki_dir || 'wiki'
      this.formLightragDir.value = data.lightrag_dir || 'rag/lightrag_data'
      this.formLanguage.value = data.language || 'Chinese'
      this.formChunkSize.value = data.chunk_token_size || 1200
      this.formTimeout.value = data.search_timeout || 30
    } catch (e) {
      console.error('[WikiView] loadSettings error:', e)
    }
  }

  /* ==================== Sorting ==================== */

  /* doSort：切换排序
   * 流程：点击当前列 → 翻转升/降序；点击新列 → 切换到该列并升序
   */
  doSort(key: SortKey): void {
    if (this.sortKey.value === key) {
      this.sortAsc.value = !this.sortAsc.value
    } else {
      this.sortKey.value = key
      this.sortAsc.value = true
    }
  }

  /* ==================== Tab switching ==================== */

  /* switchTab：切换侧边栏 Tab
   * 流程：切换到 settings → 加载设置；切换到 ops → 恢复索引进度；离开 ops → 停止轮询
   */
  switchTab(tab: TabType): void {
    const prev = this.activeTab.value
    this.activeTab.value = tab
    if (tab === 'settings') this.loadSettings()
    if (tab === 'ops') this.restoreIndexProgress()
    if (prev === 'ops') this.stopPoll()
  }

  /* ==================== Copy path ==================== */

  /* copyPath：复制文件路径到剪贴板
   * 流程：优先 Clipboard API → 降级为 textarea execCommand → 显示复制成功提示
   */
  copyPath(path: string): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(path).then(() => {
        this.flashCopyToast()
      })
    } else {
      const ta = document.createElement('textarea')
      ta.value = path
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      this.flashCopyToast()
    }
  }

  /* flashCopyToast：显示复制成功提示（1200ms 后自动隐藏） */
  flashCopyToast(): void {
    this.copyToastVisible.value = true
    setTimeout(() => { this.copyToastVisible.value = false }, 1200)
  }

  /* ==================== Index progress ==================== */

  /* restoreIndexProgress：恢复索引进度（页面重新加载时调用）
   * 流程：GET /wiki/index-progress → running → 应用进度并开始轮询；否则 → 应用完成状态
   */
  async restoreIndexProgress(): Promise<void> {
    try {
      const pdata = await this._api.fetchJson<{ status: string; done: number; total: number; current_file: string }>('/wiki/index-progress')
      if (pdata.status === 'running') {
        this.applyProgress(pdata)
        this.startPoll()
      } else {
        this.applyDone(pdata)
      }
    } catch (e) {
      console.error('[WikiView] restoreIndexProgress error:', e)
    }
  }

  /* applyProgress：应用进度数据，更新进度条和当前文件显示 */
  applyProgress(pdata: { done: number; total: number; current_file: string }): void {
    this.showProgress.value = true
    const pct = pdata.total > 0 ? Math.round((pdata.done / pdata.total) * 100) : 0
    this.progressPctNum.value = pct
    this.progressPct.value = pct + '%'
    this.progressLabel.value = (pdata.current_file || '进行中...') + ' (' + pdata.done + '/' + pdata.total + ')'
    this._lastDone = pdata.done  // 同步 lastDone，确保轮询时 done 从 0 变化能触发 _advanceProgress
  }

  /* applyDone：应用索引完成状态
   * 流程：更新进度为 100% → 隐藏进度条 → 根据 status 显示结果消息
   */
  applyDone(pdata: { status: string; done: number; total: number; result?: { added: string[]; updated: string[]; deleted: string[]; unchanged: number; errors: string[] } }): void {
    if (pdata.total > 0) {
      const pct = Math.round((pdata.done / pdata.total) * 100)
      this.progressPctNum.value = pct
      this.progressPct.value = pct + '%'
    } else {
      this.progressPctNum.value = 100
      this.progressPct.value = '100%'
    }
    this.showProgress.value = false
    if (pdata.status === 'done' && pdata.result) {
      const r = pdata.result
      const parts: string[] = []
      if (r.added?.length) parts.push(`+${r.added.length}`)
      if (r.updated?.length) parts.push(`≈${r.updated.length}`)
      if (r.deleted?.length) parts.push(`-${r.deleted.length}`)
      if (r.errors?.length) parts.push(`!${r.errors.length}`)
      if (r.unchanged !== undefined) parts.push(`○${r.unchanged}`)
      const detail = parts.length > 0 ? ` (${parts.join(', ')})` : ''
      this.indexResultMsg.value = { type: 'ok', text: '索引完成' + detail }
    } else if (pdata.status === 'done') {
      this.indexResultMsg.value = { type: 'ok', text: '索引完成' }
    } else if (pdata.status === 'error') {
      this.indexResultMsg.value = { type: 'err', text: '索引出错' }
    } else {
      this.indexResultMsg.value = null
    }
  }

  /* startPoll：开始轮询索引进度
   * 流程：每 200ms 查询 /wiki/index-progress → running → 更新进度；done/error → 停止轮询
   */
  startPoll(): void {
    if (this._pollTimer !== null) return
    console.log('[WikiView] startPoll: 开始轮询进度')
    this._pollTimer = setInterval(async () => {
      try {
        const pdata = await this._api.fetchJson<{ status: string; done: number; total: number; current_file: string }>('/wiki/index-progress')
        if (pdata.status === 'running') {
          this.applyProgress(pdata)
          this._lastDone = pdata.done
          if (pdata.current_file) this._lastCurrentFile = pdata.current_file
          const relPath = pdata.current_file || this._pendingRelPath || ''
          this._advanceProgress(pdata.done, pdata.total, relPath)
        } else {
          // 索引完成时，用 running 阶段记录的 _lastCurrentFile 标记最后一个文件
          if (this._lastCurrentFile) {
            this._advanceProgress(pdata.done, pdata.total, this._lastCurrentFile)
          }
          this._lastCurrentFile = ''
          this._lastDone = -1
          this.stopPoll()
          this.applyDone(pdata)
          // 索引完成后重新加载文件列表，确保所有文件状态（包括轮询跳过的快速文件）与后端一致
          this.loadFiles()
        }
      } catch (e) {
        console.error('[WikiView] poll error:', e)
      }
    }, 200)
  }

  /* stopPoll：停止轮询 */
  stopPoll(): void {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  }

  /* ==================== Rebuild index ==================== */

  /* rebuildIndex：触发全文索引重建
   * 流程：重置进度状态 → POST /wiki/index → 启动轮询跟踪进度
   */
  async rebuildIndex(): Promise<void> {
    await this._doRebuild('/wiki/index', '增量索引')
  }

  /* rebuildIndexFull：全量重建（清空缓存后重新索引） */
  async rebuildIndexFull(): Promise<void> {
    await this._doRebuild('/wiki/index-full', '全量重建')
  }

  private async _doRebuild(url: string, label: string): Promise<void> {
    console.log(`[WikiView] ${label}: 开始`)
    this.indexResultMsg.value = null
    this.showProgress.value = true
    this.progressPctNum.value = 0
    this.progressPct.value = '0%'
    this.progressLabel.value = '准备中...'
    this._lastDone = -1

    try {
      const resp = await this._api.postJson<any>(url, {})
      if (resp.error) {
        console.error(`[WikiView] ${label}: 后端返回错误`, resp.error)
        this.showProgress.value = false
        this.indexResultMsg.value = { type: 'err', text: label + '失败: ' + resp.error }
        return
      }
      console.log(`[WikiView] ${label}: 后端已启动，开始轮询`)
      this.startPoll()
    } catch (e: any) {
      console.error(`[WikiView] ${label}: 请求异常`, e)
      this.showProgress.value = false
      this.indexResultMsg.value = { type: 'err', text: '请求失败: ' + (e.message || String(e)) }
    }
  }

  /* ==================== Save settings ==================== */

  /* saveSettings：保存 Wiki 设置
   * 流程：构建 payload → POST /wiki/settings → 成功则重新加载文件列表
   */
  async saveSettings(): Promise<void> {
    this.saving.value = true
    const payload = {
      wiki_dir: this.formWikiDir.value.trim(),
      lightrag_dir: this.formLightragDir.value.trim(),
      language: this.formLanguage.value,
      chunk_token_size: parseInt(String(this.formChunkSize.value)) || 1200,
      search_timeout: parseInt(String(this.formTimeout.value)) || 30,
    }
    try {
      const data = await this._api.postJson<any>('/wiki/settings', payload)
      if (data.ok) {
        this._toast.show('设置已保存')
        await this.loadFiles()
      } else {
        this._toast.show('保存失败: ' + (data.error || '未知错误'), 'error')
      }
    } catch (e: any) {
      this._toast.show('请求失败: ' + (e.message || String(e)), 'error')
    } finally {
      this.saving.value = false
    }
  }

  /* ==================== Lifecycle ==================== */

  /* onMounted：组件挂载时初始化
   * 流程：加载设置 → 加载文件列表 → 恢复索引进度
   */
  async onMounted(): Promise<void> {
    console.log('[WikiView] mounted')
    await this.loadSettings()
    await this.loadFiles()
    this.restoreIndexProgress()
  }

  /* onUnmounted：组件卸载时清理
   * 流程：停止轮询，防止内存泄漏
   */
  onUnmounted(): void {
    this.stopPoll()
  }
}

// 单例
export const wikiViewModel = new WikiViewModel()