/* 控制台命令系统 */

export interface ConsoleLine {
  id: number
  text: string
  type: 'info' | 'success' | 'warn' | 'error'
  timestamp: Date
}

export interface Command {
  name: string
  description: string
  execute: (cmd: string, ctx: ConsoleContext) => void
}

export interface ConsoleContext {
  currentPage: string
  router: any
  reload: () => void
}

let _lineId = 0
const _commands = new Map<string, Command>()
let _ctx: ConsoleContext = {} as ConsoleContext

// ── 命令注册 ──────────────────────────────────────────────
export function registerCommand(name: string, fn: Command['execute'], description: string) {
  _commands.set(name, { name, execute: fn, description })
}

// ── 输出到控制台 ──────────────────────────────────────────
export function logToConsole(text: string, type: ConsoleLine['type'] = 'info'): ConsoleLine {
  return {
    id: ++_lineId,
    text,
    type,
    timestamp: new Date(),
  }
}

// ── 初始化上下文 ──────────────────────────────────────────
export function initConsoleContext(ctx: ConsoleContext) {
  _ctx = ctx
}

// ── 执行命令 ──────────────────────────────────────────────
export function executeCommand(input: string, onLog: (line: ConsoleLine) => void) {
  const trimmed = input.trim()
  if (!trimmed) return

  // 显示用户输入
  onLog({ id: ++_lineId, text: '> ' + trimmed, type: 'info', timestamp: new Date() })

  const parts = trimmed.split(/\s+/)
  const cmdName = parts[0].toLowerCase()
  const cmd = _commands.get(cmdName)

  if (!cmd) {
    onLog({ id: ++_lineId, text: `未知命令: ${cmdName}，输入 help 查看可用命令`, type: 'error', timestamp: new Date() })
    return
  }

  try {
    cmd.execute(trimmed, _ctx)
  } catch (e: any) {
    onLog({ id: ++_lineId, text: `命令执行错误: ${e.message || e}`, type: 'error', timestamp: new Date() })
  }
}

// ── 内置命令 ──────────────────────────────────────────────
function registerBuiltinCommands() {
  // help
  registerCommand('help', () => {
    const lines = [
      '═══════════════════════════════',
      '       可用命令',
      '═══════════════════════════════',
    ]
    lines.forEach(l => logToConsole(l, 'info'))

    _commands.forEach((cmd, name) => {
      if (name === 'help') return
      logToConsole(`  ${name.padEnd(12)} - ${cmd.description}`, 'info')
    })
    logToConsole('═══════════════════════════════', 'info')
  }, '显示帮助信息')

  // status
  registerCommand('status', () => {
    logToConsole('═══════════════════════════════', 'info')
    logToConsole('         系统状态', 'info')
    logToConsole('═══════════════════════════════', 'info')
    logToConsole(`当前页面: ${_ctx.currentPage || 'unknown'}`, 'info')
    logToConsole('═══════════════════════════════', 'info')
  }, '显示系统状态')

  // pages
  registerCommand('pages', () => {
    const pages = [
      { name: 'overview', desc: '总览' },
      { name: 'memory', desc: '记忆' },
      { name: 'steam', desc: '流' },
      { name: 'wiki', desc: 'Wiki' },
      { name: 'logs', desc: '日志' },
      { name: 'settings', desc: '设置' },
    ]
    logToConsole('可用页面：', 'info')
    pages.forEach(p => {
      const marker = p.name === _ctx.currentPage ? ' ◄' : ''
      logToConsole(`  ${p.name.padEnd(10)} - ${p.desc}${marker}`, p.name === _ctx.currentPage ? 'success' : 'info')
    })
  }, '列出所有页面')

  // reload
  registerCommand('reload', () => {
    logToConsole('刷新页面...', 'info')
    _ctx.reload()
    logToConsole('刷新完成', 'success')
  }, '刷新当前页面')

  // open <page>
  registerCommand('open', (cmd) => {
    const page = cmd.slice(5).trim().toLowerCase()
    if (!page) {
      logToConsole('请指定页面名，例如: open memory', 'warn')
      logToConsole('使用 pages 命令查看可用页面', 'info')
      return
    }
    const validPages = ['overview', 'memory', 'steam', 'wiki', 'logs', 'settings']
    if (!validPages.includes(page)) {
      logToConsole(`未知页面: ${page}`, 'error')
      logToConsole('使用 pages 命令查看可用页面', 'info')
      return
    }
    logToConsole(`正在打开页面: ${page}...`, 'info')
    _ctx.router.push('/' + page)
    logToConsole(`已切换到: ${page}`, 'success')
  }, '打开指定页面')

  // time
  registerCommand('time', () => {
    const now = new Date()
    const timeStr = now.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'long',
    })
    logToConsole('═══════════════════════════════', 'info')
    logToConsole(`  当前时间: ${timeStr}`, 'success')
    logToConsole('═══════════════════════════════', 'info')
  }, '显示当前日期和时间')
}

// 初始化内置命令
registerBuiltinCommands()
