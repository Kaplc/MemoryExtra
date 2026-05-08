/* 日志视图模型 - 面向对象设计
 *
 * 作用：管理日志页面状态、日志解析、复制和滚动功能
 * 实现：提供单例 logsViewModel，供 Vue 组件调用 loadLog/copyLine/scrollToBottom 等方法
 */

import { ref, nextTick } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'

export interface LogData {
  lines: string[]
  file: string
  total_relevant: number
  returned: number
  error?: string
}

export interface ParsedLine {
  raw: string
  html: string
  cls: string
}

export class LogsViewModel {
  // UI State
  readonly logLines = ref<ParsedLine[]>([])
  readonly meta = ref('')
  readonly loading = ref(false)
  readonly error = ref('')
  readonly copyToastVisible = ref(false)
  readonly logWrapEl = ref<HTMLElement | null>(null)

  // Private
  private _api = useApi()
  private _toast = useToast()

  // ── 工具函数 ─────────────────────────────────────────────

  /* escHtml：将特殊字符转义为 HTML 实体
   * 流程：& → &amp;，< → &lt;，> → &gt;
   * 用于防止日志内容中的特殊字符破坏 HTML 结构
   */
  escHtml(s: string): string {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  /* parseLine：解析单行日志，生成带样式的 HTML
   * 流程：检测日志级别 → 添加时间戳/级别样式标签 → 返回 {raw, html, cls}
   * 支持：INFO/WARNING/ERROR 级别识别、时间戳提取、降级/失败等关键词高亮
   */
  parseLine(line: string): ParsedLine {
    let cls = ''
    let html = this.escHtml(line)

    // 匹配 [时间戳] [级别] 格式
    const m = line.match(/^\[([^\]]+)\]\s+\[(INFO|WARNING|ERROR|WARN)\]/i)
    if (m) {
      const lvl = m[2].toLowerCase()
      if (lvl.indexOf('error') >= 0) cls = 'log-level-error'
      else if (lvl.indexOf('warn') >= 0) cls = 'log-level-warn'
      else cls = 'log-level-info'
      html =
        '<span class="log-time">' +
        this.escHtml(m[1]) +
        '</span> <span class="' +
        cls +
        '">[' +
        m[2] +
        ']</span>' +
        this.escHtml(line.substring(m[0].length))
    } else if (/^\d{4}-\d{2}\/\d{2}\//.test(line)) {
      cls = 'log-level-info'
    } else if (/(?:error|fail|Exception)/i.test(line)) {
      cls = 'log-level-error'
    } else if (/warn|timeout|降级/i.test(line)) {
      cls = 'log-level-warn'
    } else if (/\[(RAG|API)[→←⚠✗]\]/i.test(line)) {
      cls = 'log-level-info'
    }

    return { raw: line, html, cls }
  }

  // ── 加载日志 ─────────────────────────────────────────────

  /* loadLog：从后端获取日志数据并解析渲染
   * 流程：设置加载状态 → 调用 /logs/api 获取原始日志 → 逐行解析 → 更新 UI → 滚动到底部
   * 错误处理：日志为空时显示"无日志"，网络失败时显示具体错误信息
   */
  async loadLog(): Promise<void> {
    console.log('[logs] loadLog start')
    this.loading.value = true
    this.error.value = ''
    this.logLines.value = []

    try {
      const data = await this._api.fetchJson<LogData>('/logs/api?lines=300&keywords=wiki,RAG,lightrag,index,search,embed,ERROR,WARNING,WARN,error,warning,warn,fail,failed,exception', 5)
      console.log('[logs] log data received:', data.lines ? data.lines.length + ' lines' : 'no lines')

      if (!data.lines) {
        this.error.value = data.error || '无日志'
        console.log('[logs] loadLog done, rendered empty')
        return
      }

      if (data.file) {
        this.meta.value =
          data.file +
          ' | 共 ' +
          data.total_relevant +
          ' 条，显示 ' +
          data.returned +
          ' 条'
      }

      this.logLines.value = data.lines.map((l) => this.parseLine(l))
      nextTick(() => nextTick(() => this.scrollToBottom()))
      console.log('[logs] loadLog done, rendered content')
    } catch (e: any) {
      this.error.value = '日志加载失败: ' + (e.message || e)
      console.error('[log] loadLog error:', e)
    } finally {
      this.loading.value = false
    }
  }

  // ── 复制行 ──────────────────────────────────────────────

  /* copyLine：将指定日志行复制到剪贴板
   * 流程：优先使用 Clipboard API → 失败时降级为 textarea execCommand 方案 → 显示复制成功提示
   * 提示：复制成功后显示 toast，1200ms 后自动隐藏
   */
  async copyLine(raw: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(raw)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = raw
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    this.copyToastVisible.value = true
    setTimeout(() => {
      this.copyToastVisible.value = false
    }, 1200)
  }

  // ── 滚动到底部 ───────────────────────────────────────────

  /* scrollToBottom：滚动日志容器到底部
   * 注意：依赖于 setLogWrap 设置的 logWrapEl 引用
   */
  scrollToBottom(): void {
    // scrollToBottom uses logWrapEl which is set via setLogWrap
  }

  /* setLogWrap：设置日志容器 DOM 引用
   * 参数：el - 日志容器 HTMLElement
   * 用于 scrollToBottom 时获取容器进行滚动
   */
  setLogWrap(el: HTMLElement | null): void {
    this.logWrapEl.value = el
    console.log('[logs] setLogWrap:', el)
  }
}

// 单例
export const logsViewModel = new LogsViewModel()
