# 前端 - Wiki 模块

## 模块概述
Wiki模块提供知识库文件管理和索引管理功能，集成LightRAG引擎。采用两栏布局：左侧文件列表，右侧信息面板（统计/操作/设置三个tab）。

## 文件位置
```
web/modules/wiki/
├── wiki.html      # HTML模板 + CSS样式（内联）
└── wiki.js        # 页面逻辑
```

## 后端接口
```
backend/modules/wiki_mod.py    # Flask路由，提供REST API
rag/lightrag_wiki/             # LightRAG引擎
├── config.py                  # 配置管理（wiki目录、lightrag目录、索引元数据路径）
├── indexer.py                 # 文件索引器（sync_index、index_single_file）
└── rag_engine.py              # RAG搜索引擎
```

## 界面布局

### 两栏结构
```
┌──────────────────────────────────────────────────┐
│ Wiki 知识库                                       │  ← header
├──────────────────────────┬───────────────────────┤
│                          │  [统计] [操作] [设置]  │  ← 右侧tab导航
│   文件列表表格           ├───────────────────────┤
│   （可排序、点击复制路径）│   面板内容             │
│                          │   统计：文件数/大小/索引状态
│                          │   操作：重建索引        │
│                          │   设置：目录/LLM配置    │
└──────────────────────────┴───────────────────────┘
```

### 右侧面板Tab
| Tab | 内容 |
|-----|------|
| 统计 | 文件数、总大小、索引状态（已索引/未索引/异常） |
| 操作 | 重建索引按钮 + 索引结果反馈 |
| 设置 | Wiki目录、LightRAG目录、语言、分块大小、超时、LLM配置 |

## API接口

### 获取文件列表
```
GET /wiki/list
```
返回：
```json
{
  "files": [{ "filename": "xxx.md", "abs_path": "...", "size_bytes": 1234, "modified": 1714412345, "preview": "前200字符" }],
  "indexed": true
}
```
`indexed` 通过检查 `rag/lightrag_data/.wiki_index_meta.json` 是否存在判断。

### 重建索引
```
POST /wiki/index
```
返回：
```json
{ "added": [], "updated": [], "deleted": [], "unchanged": 5, "errors": [] }
```

### 配置管理
```
GET /wiki/settings    # 获取配置
POST /wiki/settings   # 保存配置
```

### 搜索
```
POST /wiki/search     # { "query": "...", "mode": "naive|hybrid" }
```

## JavaScript核心函数

### 页面生命周期
| 函数 | 说明 |
|------|------|
| `onPageLoad()` | 入口，加载配置后加载文件数据 |
| `cleanup` | 页面卸载清理（空函数） |

### 数据加载
| 函数 | 说明 |
|------|------|
| `loadWikiConfig()` | 加载wiki配置到 `_wikiConfig` |
| `loadWikiData()` | 加载文件列表，更新统计面板和表格 |
| `loadWikiSettingsData()` | 加载设置表单数据 |

### 文件列表
| 函数 | 说明 |
|------|------|
| `renderTable(files)` | 渲染文件表格（文件名/大小/修改时间/预览） |
| `sortFiles(key)` | 排序（filename/size_bytes/modified） |
| `copyPath(path, row)` | 复制文件绝对路径到剪贴板 |
| `formatSize(bytes)` | 格式化文件大小（B/KB/MB） |
| `formatDate(ts)` | 格式化unix时间戳 |

### 索引操作
| 函数 | 说明 |
|------|------|
| `rebuildIndex()` | 调用 `/wiki/index` 重建索引，按钮有loading状态 |

### 右侧面板
| 函数 | 说明 |
|------|------|
| `switchSideTab(tab)` | 切换右侧tab（stats/ops/settings），切到settings自动加载配置 |
| `fillSettingsForm(data)` | 填充设置表单 |
| `saveWikiSettings()` | 提交设置到后端 |

### 全局状态
```javascript
var _wikiFiles = [];    // 文件列表数据
var _sortKey = 'modified';  // 当前排序字段
var _sortAsc = false;   // 排序方向
var _wikiConfig = null; // wiki配置
```

## CSS要点
- 暗色主题，主色调紫色 `#7c3aed`
- 所有样式内联在 `wiki.html` 的 `<style>` 标签中
- 文件名不换行（`white-space: nowrap`）
- 表格支持排序，列头可点击
- 点击行复制路径，显示 toast 提示

## 配置文件
- 路径：`~/.aibrain/config/wiki.json`
- 字段：`wiki_dir`、`lightrag_dir`、`language`、`chunk_token_size`、`search_timeout`、`llm_provider`、`llm_model`、`llm_api_key`、`llm_base_url`

## 相关模块
- **设置模块** (`web/modules/settings/`): 全局设置页也包含wiki配置tab
- **LightRAG引擎** (`rag/lightrag_wiki/`): 后端知识检索核心
- **Wiki MCP** (`brain_mcp/`): 提供wiki_search/wiki_list/wiki_index的MCP工具

---

*最后更新: 2026-04-30*
