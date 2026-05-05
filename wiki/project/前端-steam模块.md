# 前端 - Steam 模块（记忆流）

## 模块概述
记忆流页面，双栏布局展示 MCP 调用记录（store）和查询记录（search）。2 秒轮询全量列表 + 1 秒轮询 pending 状态，状态变化时更新 DOM 避免闪烁。新条目有 slideIn 动画。

## 文件位置
```
web/src/views/StreamView/
├── StreamView.vue        # Vue组件，HTML模板 + CSS（内联）
└── StreamViewModel.ts    # StreamViewModel 类，单例 streamViewModel
```

## 界面布局
```
┌─────────────────────────────────────────────────────┐
│ 记忆流                        MCP 12 条 / 搜索 8 条  │  ← 总计数（computed）
├─────────────────────┬───────────────────────────────┤
│ ● MCP调用            │ ● 查询记忆                   │
│  存入 文本...  ✓      │  搜索 关键词    ✓              │
│  存入 文本...  ⟳      │  搜索 关键词    ⟳              │  ← ⟳=pending
│  存入 文本...  ✗      │  搜索 关键词    ✓              │  ← ✗=error
└─────────────────────┴───────────────────────────────┘
```

### 状态图标
| 状态 | 图标 |
|------|------|
| pending | 旋转 spinner |
| done | ✓（绿色） |
| error | ✗（红色） |

## 交互逻辑流

### 页面加载（streamViewModel.onMounted）
```
onMounted()
  ├── loadStream()         ← 立即加载一次全量
  ├── _streamPoll.start() ← 2秒轮询全量列表
  └── _statusPoll.start() ← 1秒轮询 pending 状态
```

### 主轮询（loadStream，2秒间隔）
```
loadStream() (每2秒)
  ├── 并行请求:
  │     ├── GET /stream/api?action=store&days=3   ← MCP写入记录
  │     └── GET /stream/api?action=search&days=3  ← 查询记录
  ├── 更新 storeItems/searchItems
  ├── 更新 storeTotal/searchTotal
  └── requestAnimationFrame → markKnown() 标记已知ID
```

### 状态轮询（pollStatus，1秒间隔，仅 pending 时触发）
```
pollStatus()
  → 检查是否有 pending 状态的记录
  → 无 pending → 跳过
  → 并行请求 store/search 全量数据
  → 构建 id→status 映射
  → 遍历当前列表，只更新 status='pending' 且新状态不是 pending 的项
```

### 新条目动画
```
isNew(id) → knownIds.has(String(id)) === false
markKnown(items) → 遍历添加 id 到 knownIds
首次渲染时 .new 类触发 slideIn 动画（300ms）
```

## 数据流

### API 接口
```
GET /stream/api?action=store&days=3    ← 获取近3天MCP写入记录
GET /stream/api?action=search&days=3   ← 获取近3天查询记录
```

### 返回数据格式
```json
{
  "items": [
    {
      "id": 1,
      "action": "store",
      "content": "记忆文本...",
      "memory_id": "xyz789",
      "status": "done",
      "created_at": "2026-04-30T14:30:25"
    }
  ],
  "total": 12
}
```

### status 字段枚举
| 值 | 含义 |
|----|------|
| `pending` | 异步执行中（旋转图标） |
| `done` | 执行成功（绿色✓） |
| `error` | 执行失败（红色✗） |

## StreamViewModel 核心方法

### 轮询方法
| 方法 | 说明 |
|------|------|
| `loadStream()` | 2秒轮询，获取 store/search 全量数据 |
| `pollStatus()` | 1秒轮询，只更新 pending 记录的状态图标 |

### 辅助方法
| 方法 | 说明 |
|------|------|
| `getActionLabel(action)` | 'store'→'存入'，'search'→'搜索'，其他→'删除' |
| `formatTime(createdAt)` | 提取 HH:mm:ss（slice 11,19） |
| `getItemText(item)` | 返回 content 或 memory_id |
| `isNew(id)` | 检查是否首次出现（触发动画） |
| `markKnown(items)` | 将 item.id 添加到 knownIds |
| `getStatusIcon(status)` | 返回 'pending'/'done'/'error'/'' |

## 全局状态（streamViewModel 单例）
```typescript
// Data
storeItems: Ref<StreamItem[]>
searchItems: Ref<StreamItem[]>
storeTotal: number
searchTotal: number

// Computed
totalCount: string  // "MCP N 条 / 搜索 M 条"
storeCountText: string  // "N 条"
searchCountText: string  // "M 条"

// Private
private _statusPoll: usePolling  // 1秒
private _streamPoll: usePolling  // 2秒
```

## StreamItem 接口
```typescript
interface StreamItem {
  id: number
  action: 'store' | 'search' | 'delete'
  content: string
  memory_id: string | null
  status: 'pending' | 'done' | 'error' | ''
  created_at: string
}
```

## 后端相关文件
| 文件 | 作用 |
|------|------|
| `backend/routes/stream_routes.py` | 提供 `/stream/api` 端点 |
| `backend/routes/stats_routes.py` | 统计数据库，记录 stream 数据 |
| `backend/modules/brain/memory.py` | MCP store 时写入 stream |

---
*最后更新: 2026-05-05*