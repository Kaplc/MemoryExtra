# 前端 - Router 模块（路由 + 状态栏）

## 模块概述
Router 模块使用 Vue Router 管理页面路由，提供导航和全局状态管理。前端采用 Vue 3 + Composition API，所有视图都是独立组件，通过路由懒加载按需引入。

## 文件位置
```
web/src/
├── main.ts              # 应用入口，创建 app.use(router)
├── router/
│   └── index.ts          # Vue Router 配置，懒加载所有视图
├── stores/
│   ├── status.ts         # 状态栏数据（轮询 /statusbar/api）
│   ├── wiki.ts           # Wiki 状态（索引状态）
│   └── config.ts         # 配置状态（设备/模型设置）
└── views/                # 各页面视图组件（懒加载）
    ├── OverviewView/
    ├── MemoryView/
    ├── StreamView/
    ├── WikiView/
    ├── LogsView/
    └── SettingsView/
```

## 路由配置（router/index.ts）
```typescript
const routes = [
  { path: '/', redirect: '/overview' },
  { path: '/overview', component: () => import('@/views/OverviewView/OverviewView.vue') },
  { path: '/memory', component: () => import('@/views/MemoryView/MemoryView.vue') },
  { path: '/stream', component: () => import('@/views/StreamView/StreamView.vue') },
  { path: '/wiki', component: () => import('@/views/WikiView/WikiView.vue') },
  { path: '/logs', component: () => import('@/views/LogsView/LogsView.vue') },
  { path: '/settings', component: () => import('@/views/SettingsView/SettingsView.vue') },
]
```

## Pinia Store 架构

### useStatusStore（stores/status.ts）
| 状态 | 类型 | 说明 |
|------|------|------|
| `modelLoaded` | `Ref<boolean>` | 模型是否已加载 |
| `qdrantReady` | `Ref<boolean>` | Qdrant 是否就绪 |
| `device` | `Ref<'cuda'|'cpu'>` | 当前设备 |
| `embeddingModel` | `Ref<string>` | Embedding 模型名 |
| `embeddingDim` | `Ref<number>` | 向量维度 |
| `flaskPid/flaskPort/flaskUptime` | `Ref<number>` | Flask 运行信息 |

### useWikiStore（stores/wiki.ts）
| 状态 | 类型 | 说明 |
|------|------|------|
| `indexed` | `Ref<boolean>` | 是否已索引 |

### useConfigStore（stores/config.ts）
| 状态 | 类型 | 说明 |
|------|------|------|
| `device` | `Ref<'cuda'|'cpu'>` | 当前设备 |
| `savedDevice` | `Ref<'cuda'|'cpu'>` | 已保存设备 |
| `aibrainConfig` | `Ref<any>` | 动态配置 schema |

## 前端日志上报
```
POST /log { level, message, source: 'frontend' }
```
由 backend/routes/statusbar_routes.py 的 `/log` 处理。

## 相关模块
- **所有业务视图**：通过 Vue Router 懒加载
- **Status 模块**：提供 `/statusbar/api` 端点
- **Wiki 模块**：提供 `/wiki/*` 端点

---
*最后更新: 2026-05-05*