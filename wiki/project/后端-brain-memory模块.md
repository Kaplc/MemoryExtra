# 后端-brain-memory 模块

## 概述
`memory.py` 是 AiBrain 大脑模块中的记忆核心逻辑层，基于 mem0 实现记忆的完整生命周期管理。该模块封装了 mem0 客户端的 store/search/list/delete/update/organize/dedup/refine/apply 操作，是前端 UI 和 MCP 工具的共同底层。

## 文件位置
```
backend/modules/brain/memory.py
```

## 模块定位
- **上层**：`backend/modules/memory.py`（Flask 路由层）调用本模块函数
- **下层**：`mem0_adapter.py` 提供 mem0 客户端实例
- **同级**：`dedup.py`（去重）、`llm.py`（LLM 精炼）、`organizer.py`（分类整理）、`migrate.py`（旧数据迁移）

## 核心常量

### `DEFAULT_USER_ID = "default"`
mem0 需要至少一个 entity id，所有记忆共享同一个默认用户 ID。

### `_memory_count_cache`
记忆数量缓存，启动时预热，store 时自增，避免每次搜索都调 get_all。

## 主要函数

### 1. `warmup_memory_count()`
**功能**：预热记忆数量缓存（在应用启动的 `_preload` 中调用）
**流程**：
1. 获取 mem0 客户端
2. 调用 `client.get_all()` 获取第一条记忆（仅用于计数）
3. 缓存计数到 `_memory_count_cache`
4. 失败时设置缓存为 0

### 2. `get_client()`
**功能**：兼容接口，返回 mem0 客户端实例
**实现**：直接调用 `mem0_adapter.get_mem0_client()`

### 3. `_get_search_options()`
**功能**：根据数据量自适应返回最优搜索参数

**搜索参数策略**：

| 记忆总数 | top_k | threshold | rerank |
|---------|-------|-----------|--------|
| < 100 | 50 | 0.55 | false |
| ≤ 1000 | 50 | 0.55 | false |
| > 1000 | 50 | 0.55 | true |

- 使用缓存 `_memory_count_cache`，避免每次 get_all
- 缓存未预热时临时查询一次

### 4. `store_memory(text)`
**功能**：存储记忆，LLM 自动从文本中拆分多条事实

**参数**：`text` - 记忆文本
**返回**：`{"result": "已记住: 新增 N 条记忆", "stored_texts": [...]}`

**工作流程**：
1. 获取 mem0 客户端
2. 调用 `client.add(text, user_id="default", infer=True)`
3. infer=True 失败时降级为 infer=False
4. 记录完整原始结果到日志
5. 根据 events 区分 ADD/UPDATE 操作
6. 有新增时自增缓存计数
7. 返回结果消息和实际存储的文本列表

### 5. `search_memory(query)`
**功能**：搜索记忆，直接请求高于阈值的结果，不足 15 条时补足

**参数**：`query` - 搜索关键词
**返回**：`[{id, text, score}, ...]`

**工作流程**：
1. 调用 `_get_search_options()` 获取搜索参数
2. 首次请求：`top_k=75`, `threshold` 过滤
3. 结果按 score 降序排列
4. 不足 15 条时：去掉阈值再次搜索，去重补足
5. 截取前 15 条返回

### 6. `list_memories(offset, limit)`
**功能**：列出所有记忆（前端 UI 用），按最新时间倒序排列

**参数**：
- `offset`：偏移量（默认 0）
- `limit`：条数限制（默认 200）

**返回**：`[{id, text, timestamp}, ...]`

**工作流程**：
1. 调用 `client.get_all(filters, top_k=10000)`
2. 按 created_at 倒序排列
3. 分页截取
4. 返回 id/text/timestamp 三元组

### 7. `delete_memory(memory_id)`
**功能**：删除记忆（前端 UI 用）
**参数**：`memory_id` - 记忆 ID
**返回**：`"已删除记忆: {memory_id}"`

### 8. `update_memory(memory_id, new_text)`
**功能**：更新记忆（前端 UI 用，用户手动编辑时调用）
**参数**：
- `memory_id`：记忆 ID
- `new_text`：新的记忆文本
**返回**：`"已更新记忆: {new_text}"`

### 9. `organize_memories(query)`
**功能**：搜索相关记忆并整理（前端 UI 高级功能，一键流程）

**工作流程**：
1. 调用 `search_memory(query)` 搜索相关记忆
2. 调用 `organizer.organize_memories()` 分类整理
3. 删除所有被整理的旧记忆
4. 逐条存储结构化新记忆
5. 返回整理结果（含新记忆 ID）

### 10. `dedup_memories(threshold)`
**功能**：全量记忆去重分组（两步法第一步）
**实现**：委托 `dedup.dedup_memories()`

### 11. `refine_memories(groups)`
**功能**：LLM 精炼合并相似记忆组（两步法第二步）
**流程**：
1. 遍历每个分组
2. 调用 `llm.refine_group()` 精炼
3. 记录 group_id
4. 返回精炼结果列表

### 12. `apply_organize(items)`
**功能**：用户确认后写入整理结果（删旧存新）

**参数**：`items` - `[{delete_ids: [...], new_text: "..."}]`
**返回**：`{applied, deleted, added, details}`

**工作流程**：
1. 遍历每个 item
2. 先删除旧记忆（`delete_memory`）
3. 再存储新记忆（`store_memory`）
4. 统计操作数
5. 每个 item 记录详情

## 数据流

### 记忆存储
```
前端/MCP → store(text) → mem0 client.add(infer=True)
  ├── 成功 → 解析 events(ADD/UPDATE)
  ├── 失败 → 降级 infer=False → 重试
  └── 返回 {"result", "stored_texts"}
```

### 记忆搜索
```
前端/MCP → search(query) → _get_search_options()
  ├── mem0 client.search(top_k=75, threshold)
  ├── ≥15条 → 直接返回
  └── <15条 → 无阈值补足 → 去重 → 返回前15条
```

## 逻辑链与数据链

### 完整调用链
```
store_memory(text)
  │
  ├─ get_mem0_client()
  │     └─ mem0_adapter.get_mem0_client()
  │
  ├─ client.add(text, user_id="default", infer=True)
  │     ├─ 成功 → 解析 results 识别 ADD/UPDATE
  │     └─ 失败 → client.add(text, user_id="default", infer=False)
  │
  ├─ 更新 _memory_count_cache（有 ADD 时）
  └─ 返回 {"result": "已记住: ...", "stored_texts": [...]}


search_memory(query)
  │
  ├─ _get_search_options() → {top_k, threshold, rerank}
  │
  ├─ client.search(query, filters, top_k=75, threshold)
  │     └─ 结果按 score 降序
  │
  ├─ len < 15 ?
  │     └─ client.search(query, filters, top_k=15) [无阈值]
  │     └─ 去重合并 → 取前15条
  │
  └─ 返回 [{id, text, score}, ...]


organize_memories(query)
  │
  ├─ search_memory(query) → related_memories
  ├─ organizer.organize_memories(query, related_memories)
  │     └─ classify_memories → generate_summary → generate_organized_text
  │     └─ generate_individual_structured_memories
  │
  ├─ 遍历 deleted_ids → delete_memory(mem_id)
  └─ 遍历 individual_memories → store_memory(mem["text"])
```

## 错误处理

### 1. store 失败降级
- infer=True 失败 → 自动降级 infer=False
- 保证极端情况下至少能存入原始文本

### 2. 搜索补足机制
- 阈值搜索不足 15 条 → 无阈值补足
- 自动去重（按 id 排重）

### 3. apply 逐条容错
- 逐条执行 delete + store
- 单条失败记录 error，不影响后续操作

## 性能优化

### 1. 记忆数量缓存
- 启动时预热一次
- store 时自动递增
- 避免每次搜索调 get_all

### 2. 搜索自适应参数
- 少量记忆（<100）：不 rerank
- 大量记忆（>1000）：启用 rerank 提高精度

### 3. 搜索补足机制
- 先带阈值搜索避免低质量结果
- 不足时扩展搜索保证结果数量

## 使用场景

### 1. 前端记忆管理
- 搜索/保存/删除/更新/整理记忆
- 调用对应的路由接口

### 2. MCP 工具
- brain_store → store_memory
- brain_search → search_memory

### 3. 记忆整理三步流程
- dedup_memories → refine_memories → apply_organize
- 分步执行，用户可查看中间结果

## 相关模块
| 模块 | 文件 | 作用 |
|------|------|------|
| Flask 路由 | `backend/modules/memory.py` | 暴露 REST API |
| mem0 适配 | `backend/modules/brain/mem0_adapter.py` | 客户端管理 |
| 去重 | `backend/modules/brain/dedup.py` | 语义去重 |
| LLM | `backend/modules/brain/llm.py` | LLM 精炼 |
| 分类 | `backend/modules/brain/organizer.py` | 记忆分类整理 |

---
*最后更新: 2026-05-02*
