# 前端 - Steam 模块（记忆流）

## 模块概述
记忆流页面，双栏布局展示MCP调用记录和查询记录。2秒轮询更新，新记录有滑入动画，每条记录显示状态图标（loading/成功/失败）。

## 文件位置
```
web/modules/steam/
├── steam.html   # HTML模板 + CSS（内联）
└── steam.js     # 页面逻辑
```

## 界面布局
```
┌──────────────────────────────────────────┐
│ 记忆流               MCP 12 条 / 搜索 8 条 │  ← 标题 + 总计数
├───────────────────┬──────────────────────┤
│ ● MCP调用  12条   │ ● 查询记忆  8条       │  ← 列头（绿点/蓝点）
│ ┌───────────────┐ │ ┌───────────────┐    │
│ │● 存入 文本... ✓│ │ │● 搜索 关键词 ✓│    │  ← 记录卡片
│ │  14:30:25     │ │ │  14:28:10     │    │  ← 时间
│ │● 存入 文本... ⟳│ │ │● 搜索 关键词 ✓│    │  ← ⟳=pending
│ │  14:29:55     │ │ │  14:25:30     │    │
│ └───────────────┘ │ └───────────────┘    │
└───────────────────┴──────────────────────┘
```

## 交互逻辑流

### 页面加载
```
onPageLoad()
  ├── loadStream()          ← 立即加载一次
  └── setInterval(loadStream, 2000)  ← 2秒轮询
```

### 数据轮询
```
loadStream() (每2秒)
  ├── 并行请求:
  │   ├── GET /stream?action=store&days=3    ← MCP调用记录
  │   └── GET /stream?action=search&days=3   ← 查询记录
  ├── 更新总计数: "MCP X 条 / 搜索 Y 条"
  ├── 更新各栏计数
  ├── renderList('storeList', storeItems)    ← 渲染左侧
  └── renderList('searchList', searchItems)  ← 渲染右侧
```

### 记录渲染逻辑
```
renderList(listId, items)
  → 遍历items，每条生成卡片:
    ├── 圆点颜色: store=绿色, search=蓝色, delete=红色
    ├── 动作标签: store→"存入", search→"搜索", delete→"删除"
    ├── 内容文本: content 或 memory_id
    ├── 状态图标: pending→转圈, done→✓, error→✗
    └── 时间: created_at 的 HH:MM:SS 部分
```

### 页面卸载
```
cleanup()
  → clearInterval(_streamTimer)
```

## 数据流

### API接口
```
GET /stream?action=store&days=3     ← 获取近3天MCP写入记录
GET /stream?action=search&days=3    ← 获取近3天查询记录
```

### 返回数据格式
```json
{
  "items": [
    {
      "id": "abc123",
      "action": "store",
      "content": "记忆文本...",
      "status": "done",
      "memory_id": "xyz789",
      "created_at": "2026-04-30T14:30:25"
    }
  ],
  "total": 12
}
```

## 核心函数
| 函数 | 说明 |
|------|------|
| `onPageLoad()` | 入口：加载一次 + 启动2秒轮询 |
| `cleanup()` | 清除轮询定时器 |
| `loadStream()` | 并行获取store/search数据，渲染双栏 |
| `renderList(listId, items, showDelete)` | 渲染记录列表 |
| `escapeHtml(str)` | HTML转义 |

## 全局状态
```javascript
var _streamTimer = null;  // 轮询定时器
```

## 视觉特效
- 新记录有 `slideIn` 动画（0.3s 从上方滑入）
- pending状态显示旋转loading图标
- done状态显示绿色✓
- error状态显示红色✗
- 绿点=MCP调用，蓝点=查询，红点=删除

## 相关模块
- **Memory模块**: 搜索/保存/整理记忆
- **MCP服务**: brain_mcp产生store/search调用记录

---

*最后更新: 2026-04-30*
