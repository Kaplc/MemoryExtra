# 前端 - Overview 模块（总览）

## 模块概述
系统首页，展示模型/Qdrant/Flask/设备四张状态卡片和记忆趋势图表。图表支持"累计曲线"和"新增曲线"两种视图切换，Flask 重启按钮可触发后端热重载。

## 文件位置
```
web/src/views/OverviewView/
├── OverviewView.vue      # Vue组件，HTML模板 + CSS（内联）
├── index.ts              # 导出 overviewViewModel 单例，聚合所有卡片
├── ModelCard/
│   ├── ModelCard.vue     # 模型状态卡片
│   └── ModelCard.ts     # ModelCard 类（轮询 /overview/model）
├── QdrantCard/
│   ├── QdrantCard.vue    # Qdrant 状态卡片
│   └── QdrantCard.ts     # QdrantCard 类（轮询 /overview/qdrant）
├── FlaskCard/
│   ├── FlaskCard.vue     # Flask 状态卡片（含重启按钮）
│   └── FlaskCard.ts      # FlaskCard 类（轮询 /overview/flask）
├── DeviceCard/
│   ├── DeviceCard.vue    # 系统信息卡片（CPU/内存/GPU）
│   └── DeviceCard.ts     # DeviceCard 类（轮询 /overview/system-info）
└── CardRegistry.ts       # 动态注册卡片列表
```

## 界面布局
```
┌──────────┬──────────┬──────────┬──────────┐
│ 模型状态  │ Qdrant   │ Flask    │ 设备信息  │  ← 四张状态卡片
│ badge OK  │ badge OK │ 重启按钮  │ CPU/RAM   │
└──────────┴──────────┴──────────┴──────────┘
┌──────────────────────────────────────────────┐
│ 记忆数据  [累计● 新增●] [近24h][7d][30d][全部]   │  ← 数据视图Tab + 图表Tab
│ ┌──────────────────────────────────────────┐  │
│ │  ECharts折线图（累计=紫色 / 新增=绿色）    │  │  ← 图表主体
│ └──────────────────────────────────────────┘  │
│  记忆总数: 1234              24h新增: 56       │  ← 统计数字（带递增动画）
└──────────────────────────────────────────────┘
```

## 交互逻辑流

### 页面加载（onMounted）
```
overviewViewModel.onMounted()
  ├── modelCard.start()         ← 2秒轮询 /overview/model
  ├── qdrantCard.start()        ← 2秒轮询 /overview/qdrant（800ms延迟）
  ├── flaskCard.start()         ← 2秒轮询 /overview/flask（1600ms延迟）
  ├── deviceCard.start()        ← 1秒轮询 /overview/system-info（500ms延迟）
  ├── fetchAndDrawChart()       ← 立即加载图表（默认today视图）
  └── fetchMemoryCount()        ← 立即加载记忆总数
```

### Flask 重启流程（flaskCard.restart）
```
restart()
  → POST /overview/flask/restart {}
  → 启动15秒倒计时，显示 restarting badge
  → 15秒后自动恢复（不再等待后端实际重启）
```

### 图表数据视图切换（setDataView）
```
点击 [累计曲线] → currentDataView='cumulative'
  → drawCumulativeChart() 紫色折线图

点击 [新增曲线] → currentDataView='added'
  → fetchAddedChart() 获取数据 → drawAddedChart() 绿色折线图
```

### 图表时间范围切换（setChartRange）
```
点击 [近24h / 7天 / 30天 / 全部]
  → 切换 currentChartRange
  → 累计视图：fetchAndDrawChart(range)
  → 新增视图：fetchAddedChart(range)
```

## 数据流

### 卡片轮询 API（各卡片独立轮询）
| 卡片 | API | 响应字段 |
|------|-----|---------|
| ModelCard | `GET /overview/model` | `loaded`, `embedding_model`, `embedding_dim` |
| QdrantCard | `GET /overview/qdrant` | `ready`, `host`, `port`, `disk_size` |
| FlaskCard | `GET /overview/flask` | `pid`, `port`, `uptime` |
| DeviceCard | `GET /overview/system-info` | `cpu_percent`, `memory_percent`, `gpu_name` |

### 图表数据（GET /chart-data?range=xxx）
```json
{ "data": [{ "date": "2026-04-30", "added": 5, "total": 123 }] }
累计曲线: y轴 = data[].total
新增曲线: y轴 = data[].added（绿色）
```

### 记忆总数（GET /memory/count）
```json
{ "count": 1234 }
```

## 核心类

### ModelCard（index.ts:40）
| 方法 | 说明 |
|------|------|
| `poll()` | GET /overview/model，badge='ok'/'loading'/'err' |
| `start()` / `stop()` | 启动/停止轮询 |
| `updateFromData(d)` | 更新 badge 和 subText |

### QdrantCard（index.ts:82）
| 方法 | 说明 |
|------|------|
| `poll()` | GET /overview/qdrant，badge='ok'/'loading'/'err' |
| `updateFromData(d)` | 计算磁盘大小(GB)，更新 detail |

### FlaskCard（index.ts:119）
| 方法 | 说明 |
|------|------|
| `poll()` | GET /overview/flask，更新 uptime |
| `restart()` | POST /overview/flask/restart，15秒倒计时 |
| `cleanup()` | 清除重启定时器 |

### DeviceCard（index.ts:181）
| 方法 | 说明 |
|------|------|
| `poll()` | GET /overview/system-info，合并更新 info |
| `updateFromData(d)` | 部分更新（保留旧值） |

### OverviewViewModel（index.ts:203）
| 方法 | 说明 |
|------|------|
| `onMounted()` | 启动所有卡片轮询 + 加载图表+总数 |
| `onUnmounted()` | 清除动画定时器，停止所有轮询 |
| `redrawCharts()` | 重新绘制图表（activated 时调用） |
| `fetchAndDrawChart(range)` | 获取累计曲线数据并渲染（紫色） |
| `fetchAddedChart()` | 获取新增曲线数据并渲染（绿色） |
| `fetchMemoryCount()` | 获取记忆总数并播放递增动画 |
| `animateCount(el, target, key)` | 数字递增动画（600ms，立方缓动） |
| `setChartRange(range)` | 切换图表时间范围 |
| `setDataView(view)` | 切换累计/新增视图 |

## 全局状态（overviewViewModel 单例）
```typescript
// 卡片实例
modelCard: ModelCard
qdrantCard: QdrantCard
flaskCard: FlaskCard
deviceCard: DeviceCard
cardList: OverviewCard[]  // 从 CardRegistry 动态获取

// Chart state
currentChartRange: 'today' | 'week' | 'month' | 'all'
currentDataView: 'cumulative' | 'added'
statTotalValue: number
statIncrementValue: number
addedStatValue: number
```

## 后端相关文件
| 文件 | 作用 |
|------|------|
| `backend/routes/overview_routes.py` | 提供 `/overview/model`, `/overview/qdrant`, `/overview/flask`, `/overview/system-info`, `/overview/flask/restart` |
| `backend/routes/stats_routes.py` | 提供 `/chart-data` |
| `backend/modules/SystemInfo/system_info_mod.py` | 系统信息采集 |

## 相关模块
- **Settings 模块**: 模型/设备配置，保存触发模型重载
- **Memory 模块**: 记忆管理，存入/删除后刷新图表

---
*最后更新: 2026-05-05*