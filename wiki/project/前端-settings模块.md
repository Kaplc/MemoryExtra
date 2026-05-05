# 前端 - Settings 模块（设置）

## 模块概述
全局设置页，三个Tab：模型（推理设备切换）、mem0.json（动态表单）、wiki.json（动态表单）。采用 TabRegistry 动态注册机制，新 Tab 无需修改主文件，只需在 TabRegistry.ts 中 import。

## 文件位置
```
web/src/views/SettingsView/
├── SettingsView.vue      # Vue组件，Tab 动态渲染
├── index.ts              # SettingsViewModel 类，单例 settingsViewModel
├── TabRegistry.ts        # 动态 Tab 注册表（import 即注册）
├── ModelTab/
│   ├── ModelTab.vue      # 模型Tab组件
│   └── ModelTab.ts       # ModelTab 类（设备选择 + GPU检测）
├── Mem0Tab/
│   ├── Mem0Tab.vue       # mem0配置Tab组件
│   └── Mem0Tab.ts        # Mem0Tab 类（动态表单渲染）
└── WikiTab/
    ├── WikiTab.vue       # wiki配置Tab组件
    └── WikiTab.ts        # WikiTab 类（动态表单渲染）
```

## 界面布局
```
┌──────────────────────────────────────────┐
│ 设置                                     │
│ [模型] [mem0.json] [wiki.json]           │  ← 动态Tab导航
├──────────────────────────────────────────┤
│ 模型Tab:                                 │
│  向量模型: BAAI/bge-m3 · 向量维度 1024    │
│  推理设备: [自动 ▼]                       │
│  ✅ 检测到 GPU: NVIDIA ...               │
│  [重置] [保存]                           │
├──────────────────────────────────────────┤
│ mem0.json Tab / wiki.json Tab:           │
│  (动态表单，根据后端 schema 生成)          │
│  目录字段 → 带浏览按钮 + 存在性检查       │
│  [恢复默认] [保存]                       │
└──────────────────────────────────────────┘
```

## 交互逻辑流

### 页面加载（SettingsView.onMounted）
```
onMounted()
  → settingsViewModel.onMounted()
  │     → loadAll() → _configStore.loadConfig()
  │     → 遍历 tabList，调用 tabClass.loadFromConfig(cfg, st, aibrain)
  → settingsViewModel.initDirChecks()
  │     → 遍历 tabList，调用 tabClass.initDirChecks()
```

### 设备保存（ModelTab.apply）
```
apply()
  → 检查是否变更
  → POST /settings/reload-model { device }
  → 更新 _configStore.savedDevice
  → Toast 提示"已保存并重载模型"
```

### 配置保存（Mem0Tab/WikiTab）
```
用户点击[保存]
  → 收集表单值（嵌套字段处理，如 llm.provider → llm_provider）
  → POST /settings/save-aibrain-config { mem0: {...} } 或 { wiki: {...} }
  → Toast 提示成功/失败
```

### 目录浏览
```
点击[📁] → browseDir(inputId)
  → POST /settings/select-directory
  → 选择后自动调用 checkDirExists(inputId)
```

### 目录存在性检查
```
输入框 change/blur → checkDirExists(inputId)
  → POST /settings/check-path { path }
  → 显示 ✓(绿色) 或 ✗(红色)
```

## 数据流

### 配置加载（loadAll）
```
GET /settings              → cfg: { device }
GET /statusbar/api         → st: { model_loaded, embedding_model, embedding_dim, cuda_available, gpu_name, ... }
GET /settings/aibrain-config → aibrain: { mem0: { fields: [...] }, wiki: { fields: [...] } }
```

### 动态表单 schema 格式
```json
{
  "mem0": {
    "fields": [
      { "key": "wiki_dir", "label": "Wiki目录", "type": "dir", "value": "wiki", "default": "wiki" },
      { "key": "chunk_token_size", "label": "分块大小", "type": "number", "value": 1200, "default": 1200 }
    ]
  }
}
```

### 字段类型推断
| 关键词 | 类型 |
|--------|------|
| `dir`/`path`/`folder`/`directory` | `dir`（带浏览按钮） |
| `url`/`endpoint`/`api_key`/`key` | `text` |
| `size`/`timeout`/`count`/`limit`（int） | `number` |
| 其他 | `text` |

### 配置保存
```
POST /settings/reload-model { device: "cuda" }
POST /settings/save-aibrain-config { mem0: {...} } 或 { wiki: {...} }
POST /settings/select-directory → { path: "C:\\..." }
POST /settings/check-path { path } → { exists: true }
```

## 核心类

### SettingsViewModel（index.ts:13）
| 属性 | 类型 | 说明 |
|------|------|------|
| `activeTab` | `Ref<string>` | 当前 Tab 名（默认 'model'） |
| `tabList` | `TabDef[]` | 从 TabRegistry 动态获取 |

| 方法 | 说明 |
|------|------|
| `switchTab(name)` | 切换活跃 Tab |
| `loadAll()` | 加载所有配置，触发各 Tab 的 loadFromConfig |
| `initDirChecks()` | 初始化目录检查 |
| `inputType(type)` | 返回 input type 属性 |

### ModelTab（ModelTab.ts:9）
| 属性 | 类型 | 说明 |
|------|------|------|
| `desc` | `Ref<string>` | 模型描述文字 |
| `gpuInfoHtml` | `Ref<string>` | GPU 检测信息（HTML） |
| `gpuInfoClass` | `Ref<'ok'|'warn'|'err'>` | GPU 信息样式类 |
| `saving` | `Ref<boolean>` | 保存中状态 |
| `pendingDevice` | `Ref<string>` | 待保存的设备选择 |

| 方法 | 说明 |
|------|------|
| `loadFromConfig(cfg, st, aibrain)` | 填充设备信息 + GPU 检测状态 |
| `apply()` | 保存设备并重载模型 |
| `reset()` | 重置为已保存的设备 |

### GPU 检测逻辑（ModelTab.ts）
| cuda_available | gpu_hardware | 显示 |
|----------------|-------------|------|
| true | - | ✅ 检测到 GPU（绿色） |
| false | true | ⚠️ 检测到 GPU 但安装的是 CPU 版 PyTorch（警告色） |
| false | false | 未检测到 NVIDIA GPU（红色） |

## Tab 注册机制（TabRegistry.ts）

### registerTab(def)
```typescript
// 存储到 window.__settingsTabRegistry__
window.__settingsTabRegistry__.push(def)
```

### 新增 Tab 步骤
1. 在 `SettingsView/` 下创建新文件夹，如 `MyTab/`
2. 放入 `MyTab.vue`（模板）和 `MyTab.ts`（逻辑类）
3. 在 `TabRegistry.ts` 中添加一行 `import './MyTab/MyTab'`

## 全局状态（settingsViewModel 单例）
```typescript
activeTab: string  // 'model' | 'mem0' | 'wiki'
tabList: TabDef[]   // 动态从 TabRegistry 获取
modelTab: ModelTab | undefined
mem0Tab: Mem0Tab | undefined
wikiTab: WikiTab | undefined
```

## 后端相关文件
| 文件 | 作用 |
|------|------|
| `backend/routes/settings_routes.py` | 提供 `/settings/*` 端点 |
| `backend/modules/Settings/settings_mod.py` | SettingsManager 单例 |
| `backend/modules/brain/mem0_adapter.py` | mem0 配置管理 |

---
*最后更新: 2026-05-05*