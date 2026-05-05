# 前端 - Wiki 模块（知识库）

## 模块概述
Wiki模块提供知识库文件管理和索引管理功能，集成LightRAG引擎。采用两栏布局：左侧文件列表表格（可点击复制路径），右侧边栏（统计/操作/设置三个Tab切换）。

## 文件位置
```
web/src/views/WikiView/
├── WikiView.vue           # Vue组件，HTML模板 + CSS（内联）
├── WikiViewModel.ts        # WikiViewModel 类，单例 wikiViewModel
├── WikiFileItem.ts        # WikiFileItem 类 + ApiWikiFile 接口
├── FileList/
│   ├── FileList.vue       # 文件列表表格组件
│   └── FileList.ts        # （暂无独立逻辑）
├── SideStats/
│   ├── SideStats.vue      # 统计面板（文件数/总大小/索引状态）
│   └── SideStats.ts       # （暂无独立逻辑）
├── SideOps/
│   ├── SideOps.vue        # 操作面板（重建索引按钮+进度条）
│   └── SideOps.ts         # （暂无独立逻辑）
└── SideSettings/
    ├── SideSettings.vue    # 设置面板（目录/LLM/分块配置）
    └── SideSettings.ts    # （暂无独立逻辑）
```

## 界面布局

### 两栏结构
```
┌────────────────────────────────────────────────────────┐
│ Wiki 知识库                                             │  ← header
├────────────────────────────────┬───────────────────────┤
│                                │ [统计] [操作] [设置]   │  ← Tab 导航
├────────────────────────────────┤                       │
│ 文件列表表格                    │  统计面板              │
│ （可点击复制路径）              │  文件数/总大小/索引状态 │
│                                │                       │
│ ✓ 已同步 / ⚠ 需重建 / ○ 未索引  │  操作面板              │
│                                │  重建索引按钮          │
│ 文件名 | 大小 | 修改时间 | 预览  │  进度条               │
│                                │                       │
│                                │  设置面板              │
│                                │  目录/LLM/分块配置     │
└────────────────────────────────┴───────────────────────┘
```

### 右侧面板 Tab
| Tab | 内容 | 条件渲染 |
|-----|------|---------|
| 统计 | 文件数、总大小、索引状态（已同步/需重建/未索引） | `activeTab === 'stats'` |
| 操作 | 重建索引按钮 + 进度条 | `activeTab === 'ops'` 时调用 `restoreIndexProgress()` |
| 设置 | Wiki目录、LightRAG目录、语言、分块大小、超时 | `activeTab === 'settings'` 时调用 `loadSettings()` |

### index_status 枚举
| 值 | 图标 | 含义 |
|----|-----|------|
| `synced` | ✓(绿色) | 文件已索引，与索引一致 |
| `out_of_sync` | ⚠(橙色) | 文件已修改，需重建索引 |
| `not_indexed` | ○(灰色) | 未索引 |

## 交互逻辑流

### 页面加载（wikiViewModel.onMounted）
```
onMounted()
  ├── loadSettings()         ← 加载配置到表单
  ├── loadFiles()           ← 加载文件列表
  └── restoreIndexProgress() ← 恢复索引进度UI + 启动轮询
```

### 索引进度恢复（restoreIndexProgress）
```
restoreIndexProgress()
  → GET /wiki/index-progress
  ├── status='running':
  │     → applyProgress() 显示进度UI
  │     → startPoll() 启动轮询
  └── status != 'running':
        → applyDone() 处理完成/错误状态
```

### 索引进度轮询（startPoll，200ms间隔）
```
_pollTimer = setInterval(async () => {
  → GET /wiki/index-progress
  ├── status='running':
  │     → applyProgress() 更新进度条
  │     → 如 done 变化 → _advanceProgress() 标记文件为 synced
  └── status != 'running':
        → stopPoll() 停止轮询
        → applyDone() 显示完成/错误结果
```

### 进度更新（_advanceProgress）
```
_advanceProgress(done, total, currentRelPath)
  → 标准化路径分隔符（Windows \ → /）
  → 遍历所有文件，isCurrent=false
  → 找到 rel_path 匹配的文件（支持灵活匹配）
  → markCurrent()（高亮）
  → markSynced()（状态改为 synced）
```

### 重建索引触发（rebuildIndex）
```
rebuildIndex()
  → 重置 indexResultMsg、showProgress=true、progress归零
  → POST /wiki/index {}
  ├── 返回 error → showProgress=false，显示错误
  └── 返回成功 → startPoll() 启动轮询
```

### 文件排序（doSort）
```
doSort('filename'|'sizeBytes'|'modified')
  → 切换 sortKey
  → 同字段则 toggle sortAsc
  → 不同字段则 sortAsc=true
  → sortedFiles computed 自动重算
```

### 文件点击复制（copyPath）
```
copyPath(absPath)
  → navigator.clipboard.writeText 或 execCommand fallback
  → flashCopyToast() 显示"路径已复制"Toast
```

### 右侧 Tab 切换（switchTab）
```
switchTab('stats'|'ops'|'settings')
  → 切换 activeTab
  → 如 tab='ops' → restoreIndexProgress()
  → 如 tab='settings' → loadSettings()
  → 如 prev='ops' → stopPoll()
```

## 数据流

### API 接口
```
GET  /wiki/list                  → 获取文件列表
GET  /wiki/settings              → 获取wiki配置
POST /wiki/settings              → 保存wiki配置
POST /wiki/index                 → 触发索引重建（空JSON body）
GET  /wiki/index-progress        → 获取索引进度
```

### 文件列表响应（GET /wiki/list）
```json
{
  "files": [
    {
      "filename": "前端-overview模块.md",
      "abs_path": "E:\\Project\\AiBrain\\wiki\\project\\前端-overview模块.md",
      "rel_path": "project/前端-overview模块.md",
      "size_bytes": 5120,
      "modified": 1746012345,
      "preview": "系统首页，展示模型...",
      "index_status": "synced"
    }
  ],
  "indexed": true
}
```

### 索引进度响应（GET /wiki/index-progress）
```json
{ "status": "running", "done": 12, "total": 30, "current_file": "project/笔记.md" }
{ "status": "done", "done": 30, "total": 30, "result": { "added": [], "updated": [], "deleted": [], "unchanged": 30, "errors": [] } }
{ "status": "error", "error": "文件读取失败" }
```

### WikiFileItem 类（WikiFileItem.ts）
```typescript
class WikiFileItem {
  readonly filename: string
  readonly abs_path: string
  readonly rel_path: string  // 用于匹配 current_file（后端返回相对路径）
  readonly size_bytes: number
  readonly modified: number
  readonly preview: string
  index_status: 'synced' | 'out_of_sync' | 'not_indexed'
  isCurrent = false  // 是否正在索引

  markSynced(): void   // index_status='synced', isCurrent=false
  markCurrent(): void  // isCurrent=true（高亮当前索引文件）
}
```

## WikiViewModel 核心方法（WikiViewModel.ts）

### 数据加载
| 方法 | 说明 |
|------|------|
| `loadFiles(skipRender?)` | GET /wiki/list，映射为 WikiFileItem[] |
| `loadSettings()` | GET /wiki/settings，填充表单字段 |

### 索引进度
| 方法 | 说明 |
|------|------|
| `restoreIndexProgress()` | 获取当前进度，决定是否启动轮询 |
| `startPoll()` | 200ms轮询 /wiki/index-progress，共享定时器 |
| `stopPoll()` | 清除轮询定时器 |
| `applyProgress(pdata)` | 更新进度条（百分比、标签文字） |
| `applyDone(pdata)` | 处理完成状态，显示结果消息 |
| `_advanceProgress(done, total, relPath)` | 标记文件为 synced |
| `rebuildIndex()` | POST /wiki/index {}，触发重建 |

### 排序
| 方法 | 说明 |
|------|------|
| `doSort(key)` | 切换排序字段/方向 |
| `sortedFiles` | computed，根据 sortKey/sortAsc 返回排序后数组 |

### 设置
| 方法 | 说明 |
|------|------|
| `saveSettings()` | POST /wiki/settings，保存配置后刷新文件列表 |

## WikiViewModel 全局状态（单例 wikiViewModel）
```typescript
// Loading
loading: Ref<boolean>
loadError: Ref<boolean>

// Tab
activeTab: Ref<'stats' | 'ops' | 'settings'>

// Index result
indexResultMsg: Ref<{ type: 'ok' | 'err'; text: string } | null>
showProgress: Ref<boolean>
progressPct: Ref<string>   // '0%' ~ '100%'
progressPctNum: Ref<number>
progressLabel: Ref<string> // 'filename (done/total)'

// Sorting
sortKey: Ref<'filename' | 'sizeBytes' | 'modified'>
sortAsc: Ref<boolean>

// Settings form
formWikiDir, formLightragDir, formLanguage, formChunkSize, formTimeout
saving: Ref<boolean>

// Files
rawFiles: Ref<WikiFileItem[]>

// Private
private _pollTimer: ReturnType<typeof setInterval> | null
private _lastDone: number   // 上次完成数（判断是否需更新文件列表）
private _pendingRelPath: string | null  // pending时保存current_file
```

## 后端相关文件
| 文件 | 作用 |
|------|------|
| `backend/routes/wiki_routes.py` | 提供 `/wiki/*` REST API |
| `backend/modules/Wiki/wiki_mod.py` | WikiManager 单例，提供业务逻辑 |
| `backend/modules/Wiki/wiki_file.py` | WikiFile 数据类 |
| `rag/lightrag_wiki/config.py` | wiki/lightrag目录配置 |
| `rag/lightrag_wiki/rag_engine.py` | RAG搜索引擎 |

---
*最后更新: 2026-05-05*
