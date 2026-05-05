# 前端 - Logs 模块（日志查看）

## 模块概述
日志查看页面，从后端读取日志文件内容，支持点击复制单行，按级别高亮显示。无过滤、无自动刷新、无设置面板。

## 文件位置
```
web/src/views/LogsView/
├── LogsView.vue        # Vue组件，HTML模板 + CSS（内联）
└── LogsViewModel.ts    # LogsViewModel 类，单例 logsViewModel
```

## 界面布局
```
┌─────────────────────────────────────────────────────┐
│ 日志                                             │
├─────────────────────────────────────────────────────┤
│ 系统日志         app.log | 共 1500 条，显示 300 条  │  ← 元信息行
├─────────────────────────────────────────────────────┤
│ [2026-04-30 10:30:25] [INFO]    系统启动成功      │
│ [2026-04-30 10:30:26] [WARNING] 内存使用率较高      │  ← 级别高亮
│ [2026-04-30 10:30:27] [ERROR]   数据库连接失败      │  ← 可点击复制
└─────────────────────────────────────────────────────┘
```

### 级别高亮规则
| 匹配条件 | CSS 类 |
|---------|--------|
| `[ERROR]` 或 `error/fail/Exception` | `log-level-error`（红色） |
| `[WARNING]` 或 `warn/timeout/降级` | `log-level-warn`（黄色） |
| `[INFO]` 或日期路径格式 | `log-level-info`（绿色） |

## 交互逻辑流

### 页面加载（onMounted）
```
onMounted()
  → logsViewModel.loadLog()  ← 立即加载一次
```

### 刷新按钮（click）
```
logsViewModel.loadLog()
  → 重置 logLines, meta, error
  → GET /wiki/log?lines=300
  → 解析每行，按级别高亮
  → 渲染到 logWrap，scrollToBottom()
```

### 复制日志行（copyLine）
```
点击日志行
  → navigator.clipboard.writeText(raw)（降级: execCommand）
  → 显示 copyToast（1200ms 后自动隐藏）
```

## 数据流

### API 接口
```
GET /wiki/log?lines=300
```

### 返回数据格式
```json
{
  "lines": [
    "[2026-04-30 10:30:25] [INFO] [flask] Application started",
    "[2026-04-30 10:30:26] [WARNING] Memory usage high"
  ],
  "file": "flask.log",
  "total_relevant": 1500,
  "returned": 300
}
```

### ParsedLine 结构
```typescript
interface ParsedLine {
  raw: string    // 原始行文本（用于复制）
  html: string   // HTML 格式（含时间戳span和级别span）
  cls: string    // CSS 类名（log-level-error/warn/info）
}
```

## LogsViewModel 核心方法

| 方法 | 说明 |
|------|------|
| `loadLog()` | GET /wiki/log，解析每行，渲染日志列表 |
| `copyLine(raw)` | 复制原始文本，显示 Toast |
| `parseLine(line)` | 解析日志行，返回 ParsedLine（含高亮类） |
| `scrollToBottom()` | 滚动日志到最底部 |

## 全局状态（logsViewModel 单例）
```typescript
logLines: Ref<ParsedLine[]>   // 解析后的日志行
meta: Ref<string>              // "app.log | 共 N 条，显示 M 条"
loading: Ref<boolean>          // 加载中状态
error: Ref<string>             // 错误信息
copyToastVisible: Ref<boolean> // 复制提示显隐
logWrapEl: Ref<HTMLElement | null>  // 日志容器 DOM 引用
```

## 日志解析逻辑（parseLine）
```
1. 匹配正则: /^\[([^\]]+)\]\s+\[(INFO|WARNING|ERROR|WARN)\]/i
   → 提取时间戳 [1] 和级别 [2]
   → 时间戳用 log-time span 包裹
   → 级别用 log-level-* span 包裹
   → 剩余文本用 escHtml 包裹

2. 匹配日期路径: /^\d{4}-\d{2}\/\d{2}\//
   → cls = 'log-level-info'

3. 匹配关键词:
   → error/fail/Exception → log-level-error
   → warn/timeout/降级 → log-level-warn
   → [RAG|API][→←⚠✗] → log-level-info
```

## 后端相关文件
| 文件 | 作用 |
|------|------|
| `backend/routes/wiki_routes.py` | 提供 `/wiki/log` 端点，读取 `backend/logs/` 下的日志文件 |

---
*最后更新: 2026-05-05*