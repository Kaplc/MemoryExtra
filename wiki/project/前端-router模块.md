# 前端 - Router 模块（路由 + 状态栏）

## 模块概述
Router 模块是前端核心，负责页面路由（无刷新切换）、页面版本控制（防旧回调）、console 日志捕获上报、以及顶部状态栏的 3 秒轮询。

## 文件位置
```
web/modules/router.js   # 路由 + 状态栏逻辑（所有页面共享）
```

## 界面布局
```
┌──────────────────────────────────────────────────┐
│ [●] 模型状态点   模型就绪   GPU   内存 X%   ↺     │  ← 顶部状态栏（所有页面共享）
├──────────────────────────────────────────────────┤
│ [总览] [记忆] [Wiki] [记忆流] [日志] [设置]        │  ← 顶部导航栏
├──────────────────────────────────────────────────┤
│                                                  │
│              <div id="page-content">             │  ← 页面内容区（router 动态加载）
│                                                  │
└──────────────────────────────────────────────────┘
```

### 状态栏元素
| ID | 说明 |
|----|------|
| `statusDot` | 模型就绪状态点（绿色=OK，灰色=loading） |
| `sbModelDot` | 状态栏模型状态点 |
| `sbModelText` | 状态栏模型状态文字（模型就绪/模型加载中/未连接） |
| `sbDeviceText` | 状态栏设备文字（GPU/CPU） |

### 页面 HTML 元素
| ID | 说明 |
|----|------|
| `page-content` | 动态加载页面 HTML 的容器 |
| `.nav-item[data-page="xxx"]` | 导航按钮，data-page 属性指定页面名 |

## 交互逻辑流

### 页面加载（loadPage）
```
loadPage('overview')   ← 初始化时默认加载 overview
  ├── 调用 cleanup() 清理旧页面
  ├── 如当前页相同且无 force → 跳过
  ├── 检查 pageCache 中是否已有 HTML
  │     ├── 无 → fetch modules/{page}/{page}.html，缓存到 pageCache
  │     └── 有 → 直接使用
  ├── 移除旧 script（_currentScript.remove()）
  ├── 递增 _loadVersion（版本号，用于防旧回调）
  ├── 创建新 script，src = modules/{page}/{page}.js?_t=时间戳
  ├── script.onload:
  │     → 检查 thisVersion !== _loadVersion → 跳过（页面已切换）
  │     → setTimeout 0 后调用 onPageLoad()
  └── 更新 nav 激活状态，currentPage = page
```

### 页面版本控制（防旧回调）
```
_loadVersion 全局递增器（let _loadVersion = 0）
onload 时比对版本号：
  const thisVersion = ++_loadVersion;
  script.onload = () => {
    if (thisVersion !== _loadVersion) return;  // 页面已切换，跳过
    setTimeout(() => onPageLoad(), 0);
  };
```
**作用**：快速切换页面时，旧页面的 onPageLoad 不会在已切换后的新页面上执行。

### 状态检查轮询（checkStatus，3秒间隔）
```
checkStatus() (每3秒)
  → GET /status
  → updateStatusUI(d) 更新状态栏UI
  → _lastModelLoaded = d.model_loaded
  → 失败重试3次，每次间隔1秒
  → 重试耗尽 → 状态栏显示"未连接"（红色err状态）
```

### 前端日志捕获（console 重写）
```
console.log/info/warn/error → 原函数调用 + fetch POST /log
window.onerror → 捕获未处理异常，POST /log
window.onunhandledrejection → 捕获 Promise 拒绝，POST /log
```
发送格式：`{ level, message, source: 'frontend' }`

### 共享状态UI更新（updateStatusUI）
```
updateStatusUI(d)
  → statusDot.className = 'status-dot' + (model_loaded ? ' ready' : '')
  → sbModelDot/sbModelText = '模型就绪'(绿色) 或 '模型加载中'(loading) 或 '未连接'(红色err)
  → sbDeviceText = map[d.device] → cuda='GPU', cpu='CPU'
```

## 全局状态
```javascript
let currentPage = null;     // 当前页面名
const pageCache = {};       // 页面HTML缓存（键=页面名）
let _currentScript = null;  // 当前加载的 script 元素
let _loadVersion = 0;        // 页面版本号（防旧回调）
let _lastModelLoaded = false; // 上次模型就绪状态
```

## 页面切换流程
```
用户点击[记忆]
  → loadPage('memory')
  → currentPage !== 'memory' → 继续
  → fetch modules/memory/memory.html（首次）或从 pageCache 读取
  → 移除旧 overview.js script
  → 创建 memory/memory.js script
  → script.onload → checkVersion → onPageLoad()
  → nav-item.memory 添加 active
  → currentPage = 'memory'
```

## 前端日志上报
```
POST /log
Body: { level: "info"|"warn"|"error", message: "...", source: "frontend" }
```
由 backend/modules/status.py 的 `@app.route('/log', methods=['POST'])` 处理。

## 相关模块
- **所有业务模块**：每个模块的 JS 入口都是 `onPageLoad()`，由 router 在 script.onload 时调用
- **Status 模块**：提供 `/status` 端点（model_loaded, device 等字段）
- **Overview 模块**：页面加载时默认展示页

---
*最后更新: 2026-04-30*
