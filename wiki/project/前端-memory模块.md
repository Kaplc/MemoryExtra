# 前端 - Memory 模块（记忆管理）

## 模块概述
记忆管理核心页面，三个Tab：搜索记忆（防抖搜索+历史）、保存记忆、合并记忆（流式去重分析+暂停控制+精炼写入）。记忆总数显示在导航栏，支持点击刷新。

## 文件位置
```
web/src/views/MemoryView/
├── MemoryView.vue        # Vue组件，HTML模板 + CSS（内联）
├── index.ts             # MemoryViewModel 类，单例 memoryViewModel
├── SearchTab.ts         # 搜索Tab逻辑（防抖搜索 + 历史 + 点击复制）
├── StoreTab.ts          # 保存Tab逻辑（Ctrl+Enter 保存 + 全部记忆列表）
├── OrganizeTab.ts       # 合并Tab逻辑（流式分析 + 精炼 + 写入）
├── OrganizeGroupCard.vue # 合并组卡片组件
├── SearchPanel.vue      # 搜索面板组件
├── StorePanel.vue       # 保存面板组件
├── OrganizePanel.vue    # 合并面板组件
└── types.ts             # OrganizeGroup, OrganizeGroupItem 类型定义
```

## 界面布局
```
┌──────────────────────────────────────────────────────────┐
│ [搜索记忆]  [保存记忆]  [合并记忆]          123 条记忆 ↻  │  ← Tab导航 + 总数刷新
├──────────────────────────────────────────────────────────┤
│                                                          │
│  搜索标签（SearchPanel）                                  │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 🔍 搜索记忆...                                [🕐历史]││
│  └──────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │ 记忆卡片列表（搜索结果/全部记忆，点击卡片复制）        ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  保存标签（StorePanel）                                   │
│  ┌──────────────────────────────────────────────────────┐│
│  │ [textarea 保存记忆内容 - Ctrl+Enter 保存]             ││
│  └──────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │ 全部记忆列表                                          ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  合并标签（OrganizePanel）                                 │
│  ┌──────────────────────────────────────────────────────┐│
│  │ 相似度阈值: [0.90/0.85/0.80]                         ││
│  │ [开始分析] → 分析中:[暂停][继续][停止]                 ││
│  │ 流式加载分组卡片                                      ││
│  │ 分组卡片 + [精炼此组] → 可编辑精炼结果 + [确认写入]    ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### Tab 结构
| Tab | 条件渲染 | 内容 |
|-----|---------|------|
| 搜索 | `currentTab === 'search'` | SearchPanel：搜索框 + 结果列表 + 历史下拉 |
| 保存 | `currentTab === 'store'` | StorePanel：保存框 + 全部记忆列表 |
| 合并 | `currentTab === 'organize'` | OrganizePanel：流式分析 + 分组卡片 |

### 合并Tab按钮状态
| 状态 | 显示按钮 |
|------|---------|
| 空闲 | `[开始分析]`（主色） |
| 分析中 | `[暂停]`（警告色）+ `[停止]`（红色小按钮） |
| 已暂停 | `[继续]`（主色）+ `[停止]`（红色小按钮） |
| 已完成 | 分组卡片列表 + 各组精炼/写入按钮 |

## 交互逻辑流

### 页面加载（memoryViewModel.onMounted）
```
onMounted()
  ├── searchTab.loadHistory()     ← 加载搜索历史
  ├── updateStats()               ← 获取记忆总数并动画
  └── document.addEventListener('click', searchTab.onDocumentClick)
```

### Tab 切换（memoryViewModel.switchTab）
```
switchTab('search'|'store'|'organize')
  → 切换 currentTab
  → 如 tab='store' → storeTab.loadAll()
```

### 搜索记忆（SearchTab）
```
输入框回车 → searchTab.search()
  → POST /memory/search { query }
  → 渲染搜索结果（带相似度分数）
  → searchTab.loadHistory() 刷新历史

点击历史项 → searchTab.searchFromHistory()
  → 填入搜索框 + 触发搜索

点击记忆卡片 → 复制卡片文本
```

### 保存记忆（StoreTab）
```
输入文本 → Ctrl+Enter 或 点击[保存记忆]
  → POST /memory/store { text }
  → 清空输入框
  → storeTab.loadAll() 刷新列表
```

### 删除记忆
```
点击记忆卡片的删除按钮
  → POST /memory/delete { memory_id: id }
  → 从本地 storeTab.memories 移除
  → updateStats() 更新计数
```

### 合并记忆 - 流式分析完整流程（OrganizeTab）

**1. 选择阈值(0.90/0.85/0.80) → 点击[开始分析]**
```
OrganizeTab.start()
  → 重置 groups=[]
  → fetch SSE /memory/organize/dedup/stream { similarity_threshold: sim }
  → 实时接收 batch/done/stopped/error 消息
  → 流式追加 OrganizeGroupItem 到 groups
```

**SSE 消息格式**：
```javascript
// 定期推送已发现的组
{ "type": "batch", "found": 5, "total": 100, "groups": [{ similarity: 0.92, memories: [...] }] }

// 分析完成
{ "type": "done", "total": 100, "grouped": 30, "ungrouped": 70, "groups": [...] }

// 中途停止
{ "type": "stopped", "found": 12, "groups": [...] }

// 异常
{ "type": "error", "error": "错误信息" }
```

**2. 分析中点击[暂停]**
```
OrganizeTab.pause()
  → POST /memory/organize/dedup/pause
  → busy.value = false（暂停状态）
```

**3. 已暂停点击[继续]**
```
OrganizeTab.resume()
  → POST /memory/organize/dedup/resume
  → 重新启动 SSE 流式分析
```

**4. 分析中点击[停止]**
```
OrganizeTab.stop()
  → _abortController.abort() + POST /memory/organize/dedup/stop
  → busy.value = false
```

**5. 分析完成/停止后，显示分组卡片**

**6. 点击[精炼此组] → refineGroup(groupId)**
```
→ POST /memory/organize/refine { groups: [该组数据] }
→ 返回 { refined: [{ original_ids, refined_text, category, refined: bool }] }
→ 更新卡片内可编辑的精炼结果
```

**7. 点击[确认写入] → applySingle(groupId)**
```
→ 读取可编辑区域的文本
→ POST /memory/organize/apply { items: [{ delete_ids, new_text, category }] }
→ 标记该组为 isApplied=true
→ memoryViewModel.updateStats() 刷新计数
```

### 记忆总数动画（updateStats + animateCount）
```
updateStats()
  → GET /memory/count → animateCount(target)
  → 50ms间隔，分10步递增

animateCount(target)
  → 计算 step = max(1, abs(diff)/10)
  → setInterval 逐步更新 animatingCount
  → 达到目标时 clearInterval
```

## 数据流

### API 接口
| 操作 | 接口 | 请求体 | 响应 |
|------|------|--------|------|
| 搜索 | `POST /memory/search` | `{ query }` | `{ results: [...] }` |
| 保存 | `POST /memory/store` | `{ text }` | `{ result, stored_texts }` |
| 列表 | `POST /memory/list` | `{ offset, limit, source }` | `{ memories: [...] }` |
| 删除 | `POST /memory/delete` | `{ memory_id }` | `{ result }` |
| 计数 | `GET /memory/count` | - | `{ count }` |
| 历史 | `GET /memory/search-history` | - | `{ history: [...] }` |
| 清空历史 | `DELETE /memory/search-history` | - | `{ ok }` |
| 流式去重 | `POST /memory/organize/dedup/stream` | `{ similarity_threshold, batch_size }` | SSE stream |
| 暂停 | `POST /memory/organize/dedup/pause` | - | `{ ok, paused }` |
| 继续 | `POST /memory/organize/dedup/resume` | - | `{ ok, resumed }` |
| 停止 | `POST /memory/organize/dedup/stop` | - | `{ ok, stopped }` |
| 精炼 | `POST /memory/organize/refine` | `{ groups }` | `{ refined: [...] }` |
| 写入 | `POST /memory/organize/apply` | `{ items }` | `{ applied, deleted, added }` |

## 核心类

### MemoryViewModel（index.ts:8）
| 属性 | 类型 | 说明 |
|------|------|------|
| `currentTab` | `Ref<'search'|'store'|'organize'>` | 当前Tab |
| `animatingCount` | `Ref<number>` | 记忆总数（动画值） |
| `searchTab` | `SearchTab` | 搜索Tab实例 |
| `storeTab` | `StoreTab` | 保存Tab实例 |
| `organizeTab` | `OrganizeTab` | 合并Tab实例 |

| 方法 | 说明 |
|------|------|
| `switchTab(tab)` | 切换Tab，store时加载列表 |
| `loadAll()` | 刷新列表 + 更新统计 |
| `updateStats()` | 获取记忆总数 |
| `animateCount(target)` | 数字递增动画 |

### SearchTab（SearchTab.ts）
| 方法 | 说明 |
|------|------|
| `search()` | POST /memory/search，渲染结果 |
| `loadHistory()` | GET /memory/search-history |
| `onDocumentClick(e)` | 点击历史项触发搜索 |

### StoreTab（StoreTab.ts）
| 属性 | 类型 | 说明 |
|------|------|------|
| `memories` | `Ref<MemoryItem[]>` | 记忆列表 |
| `loading` | `Ref<boolean>` | 加载状态 |

| 方法 | 说明 |
|------|------|
| `store()` | POST /memory/store |
| `loadAll()` | POST /memory/list |
| `deleteMemory(id)` | POST /memory/delete |

### OrganizeTab（OrganizeTab.ts）
| 属性 | 类型 | 说明 |
|------|------|------|
| `groups` | `Ref<OrganizeGroupItem[]>` | 分组列表（流式追加） |
| `busy` | `Ref<boolean>` | 分析中状态 |
| `threshold` | `Ref<string>` | 相似度阈值 |

| 方法 | 说明 |
|------|------|
| `start()` | 启动SSE流式去重分析 |
| `pause()` | POST /memory/organize/dedup/pause |
| `resume()` | POST /memory/organize/dedup/resume |
| `stop()` | abort + POST /memory/organize/dedup/stop |
| `refineGroup(id)` | POST /memory/organize/refine |
| `applySingle(id)` | POST /memory/organize/apply |

## 类型定义（types.ts）

```typescript
interface OrganizeGroup {
  similarity: number
  memories: Array<{ id: string; text: string }>
}

interface OrganizeGroupItem {
  groupId: number
  similarity: number
  memories: Array<{ id: string; text: string }>
  isRefined: boolean
  isApplied: boolean
  refinedText: string
  category: string
  refineError: string
  currentText(): string  // 精炼文本或原文
}
```

## 全局状态（memoryViewModel 单例）
```typescript
currentTab: 'search' | 'store' | 'organize'
animatingCount: number  // 记忆总数动画值
searchTab: SearchTab
storeTab: StoreTab
organizeTab: OrganizeTab
```

## 后端相关文件
| 文件 | 作用 |
|------|------|
| `backend/routes/memory_routes.py` | 提供 `/memory/*` REST API |
| `backend/modules/brain/memory.py` | 记忆核心逻辑（store/search/list/delete） |
| `backend/modules/brain/dedup.py` | 去重分组（dedup_memories_iter） |
| `backend/modules/brain/llm.py` | LLM精炼（refine_group） |
| `backend/modules/brain/mem0_adapter.py` | mem0客户端 |

---
*最后更新: 2026-05-05*