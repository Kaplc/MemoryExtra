# 前端 - Overview 模块（总览）

## 模块概述
系统首页，展示模型/Qdrant/设备状态卡片和记忆趋势图表。使用ECharts渲染折线图，1秒轮询状态直到就绪。

## 文件位置
```
web/modules/overview/
├── overview.html   # HTML模板 + CSS（内联）
└── overview.js     # 页面逻辑
```

## 界面布局
```
┌────────────┬────────────┬────────────┐
│ 模型状态   │ Qdrant状态  │ 设备信息    │  ← 三张状态卡片
│ badge OK   │ badge OK   │ CPU/RAM/GPU │
└────────────┴────────────┴────────────┘
┌──────────────────────────────────────┐
│ 记忆趋势   [累计● 新增●] [24h][7d][30d][全部] │
│ ┌──────────────────────────────────┐ │  ← ECharts折线图
│ │  折线图（紫色=累计，绿色=新增）  │ │
│ └──────────────────────────────────┘ │
│  记忆总数: 1234          24h新增: 56  │  ← 统计数字
└──────────────────────────────────────┘
```

## 交互逻辑流

### 页面加载（onPageLoad）
```
onPageLoad()
  ├── fetchAndDrawChart('today')    ← 立即加载图表
  ├── fetchMemoryCount()            ← 立即加载记忆总数（带递增动画）
  ├── loadOverviewPage()            ← 并行请求 settings/status/system-info
  │     ├── 更新模型卡片（名称、badge）
  │     ├── 更新Qdrant卡片（host:port、collection、存储路径、磁盘大小、Top-K、维度）
  │     └── 更新设备卡片（CPU%、温度、内存、GPU名称/显存/温度）
  ├── 启动模型状态轮询（1秒间隔）
  │     └── 模型+Qdrant都就绪后停止
  ├── 启动系统信息轮询（1秒间隔）
  │     └── 持续更新CPU/RAM/GPU数据
  └── 绑定图表Tab点击事件
```

### 图表Tab切换
```
点击 [24h/7d/30d/全部]
  → 切换active样式
  → fetchAndDrawChart(range)
      → GET /chart-data?range={range}
      → 数据处理：将added转为running累计
      → 更新统计数字（记忆总数 + 时段新增）
      → drawEChart(data, range)
          → ECharts渲染两条折线（新增+累计）
          → "全部"模式隐藏新增折线和增量统计
```

### 数字递增动画
```
animateCount(el, target)
  → 分10步递增，每步间隔50ms
  → 用于记忆总数的视觉过渡
```

## 数据流

### 状态卡片数据
| 卡片 | API | 字段 |
|------|-----|------|
| 模型 | `GET /status` | `model_loaded`, `embedding_model`, `model_size` |
| Qdrant | `GET /status` | `qdrant_ready`, `qdrant_host/port`, `qdrant_collection`, `qdrant_storage_path`, `qdrant_disk_size`, `qdrant_top_k`, `embedding_dim` |
| 设备 | `GET /system-info` | `platform`, `cpu_percent`, `cpu_temperature`, `memory_total/used/percent`, `gpu.name/memory/temperature` |

### 图表数据
```
GET /chart-data?range=today|week|month|all
返回: { data: [{ date: "2026-04-30", added: 5, total: 123 }] }
前端处理: running累加 added → 作为图表total值
```

### 记忆总数
```
GET /memory-count
返回: { count: 1234 }
```

## 核心函数
| 函数 | 说明 |
|------|------|
| `onPageLoad()` | 入口：加载图表+总数+页面数据，启动轮询 |
| `cleanup()` | 清除所有定时器和resize监听 |
| `loadOverviewPage()` | 并行加载settings/status/system-info，更新三张卡片 |
| `updateDeviceCard(sysInfo)` | 更新设备信息卡片 |
| `fetchAndDrawChart(range)` | 请求图表数据并渲染 |
| `drawEChart(data, range)` | ECharts渲染折线图 |
| `fetchMemoryCount()` | 获取记忆总数并播放动画 |
| `animateCount(el, target)` | 数字递增动画 |

## 全局状态
```javascript
var _overviewTimer = null;       // 模型状态轮询定时器
var _sysInfoTimer = null;        // 系统信息轮询定时器
var _currentChartRange = 'today'; // 当前图表时间范围
var _chartInstance = null;       // ECharts实例
var _chartData = null;           // 图表原始数据（tooltip用）
```

## 相关模块
- **Settings模块**: 模型/设备配置
- **Memory模块**: 记忆管理

---

*最后更新: 2026-04-30*
