---
name: skl-wiki-project
description: |
  维护 AiBrain 项目 wiki 文档，确保前端模块的交互、数据流、调用链与代码完全对应。
  当用户想要：
  - 更新某个前端模块的 wiki 文档
  - 写清楚某个交互的调用链和数据流
  - 检查 wiki 是否与代码一致
  请务必使用此技能！
---

# AiBrain 项目 Wiki 写作技能 (skl-wiki-project)

维护 `wiki/project/` 下的文档，每个模块一页，交互流程、数据流必须与代码完全对应。

---

## 文档结构规范

每个模块 wiki 文档必须包含：

1. **模块概览** — 文件位置、作用
2. **API 路由表** — 路由路径、请求方法、请求体、响应格式
3. **交互数据流** — 关键用户操作的完整调用链（前端 → 后端 → 前端）
4. **关键代码位置** — 对应到实际文件路径和行号

> 写作原则：**代码即文档**。所有描述必须能在代码中找到对应位置，不允许写代码中没有的字段或路径。

---

## 前端模块速查

| 模块 | JS 文件 | 作用 |
|------|---------|------|
| router | `web/modules/router.js` | 页面路由、状态栏、轮询 |
| overview | `web/modules/overview/overview.js` | 状态卡片、图表、Flask 重启 |
| memory | `web/modules/memory/memory.js` | 记忆搜索/存储/整理 |
| wiki | `web/modules/wiki/wiki.js` | Wiki 文件列表、索引导出 |
| steam | `web/modules/steam/steam.js` | 记忆流（MCP调用+搜索记录） |
| logs | `web/modules/logs/logs.js` | 日志查看 |
| settings | `web/modules/settings/settings.js` | 配置管理 |

---

## 后端 API 路由速查

| 模块文件 | 路由前缀 | 主要路由 |
|---------|---------|---------|
| `backend/modules/status.py` | — | `/status`, `/system-info`, `/flask/restart`, `/memory-count` |
| `backend/modules/memory.py` | `/` | `/store`, `/search`, `/list`, `/delete`, `/organize/*` |
| `backend/modules/wiki_mod.py` | `/wiki` | `/wiki/list`, `/wiki/search`, `/wiki/index`, `/wiki/settings` |
| `backend/modules/stats.py` | — | `/chart-data` |
| `backend/modules/stream.py` | — | `/stream` |
| `backend/modules/settings_mod.py` | — | `/settings`, `/aibrain-config`, `/save-aibrain-config` |

---

## 查找 API 路由的代码位置

在 `backend/modules/` 下按文件搜索 `@app.route`：

```
backend/modules/status.py:22     → @app.route('/status', methods=['GET'])
backend/modules/memory.py:17     → @app.route('/store', methods=['POST'])
backend/modules/wiki_mod.py:34  → @app.route('/wiki/search', methods=['POST'])
backend/modules/stats.py:7      → @app.route('/chart-data', methods=['GET'])
backend/modules/stream.py:6     → @app.route('/stream', methods=['GET'])
```

---

## 查找前端 API 调用的代码位置

在 `web/modules/` 下搜索 `fetch(API + '/xxx')` 或 `fetchJson(API + '/xxx')`：

```
overview.js:25   → fetch(API + '/status')
overview.js:457  → fetchJson(API + '/chart-data?range=' + range)
memory.js:140    → api('/store', {text})
memory.js:160    → api('/search', {query})
wiki.js:155     → fetchJson(API + '/wiki/list')
wiki.js:295     → fetch(API + '/wiki/index', {method: 'POST'})
settings.js:135  → api('/reload-model', {device: pendingDevice})
router.js:17    → fetch(API + '/log', {method: 'POST'})
```

---

## 写作检查清单

写每个交互流程前，必须确认：

- [ ] API 路由在 `backend/modules/*.py` 中存在（grep `@app.route`）
- [ ] 前端 fetch 调用存在（grep `fetch(API + '...'`）
- [ ] 请求参数字段名完全一致（大小写、命名风格）
- [ ] 响应字段名与代码一致（看 `return jsonify(...)`）
- [ ] 包含关键代码行号引用

---

## 快速参考

- 想知道某个路由在哪个文件：`grep "@app.route" backend/modules/*.py`
- 想知道前端调了哪个 API：`grep "fetch(API" web/modules/**/*.js`
- 想知道某个 API 返回什么：`grep "jsonify" backend/modules/xxx.py`
