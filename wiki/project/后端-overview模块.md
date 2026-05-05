# 后端 - Overview 路由模块

## 概述
`overview_routes.py` 提供 Overview 页面的详细数据 API，包括模型状态、Qdrant 状态、Flask 状态、系统信息、数据库状态等。

## 文件位置
```
backend/routes/overview_routes.py
```

## API 接口

### GET `/overview/model`
**功能**：获取模型状态

**响应字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `loaded` | bool | 模型是否已加载 |
| `device` | string | 当前设备（cpu/cuda） |
| `embedding_model` | string | embedding 模型名称 |
| `embedding_dim` | int | 向量维度 |
| `model_size` | string | 模型参数量 |
| `cuda_available` | bool | PyTorch CUDA 是否可用 |
| `gpu_hardware` | bool | 是否有 NVIDIA GPU 硬件 |
| `gpu_name` | string/null | GPU 名称 |

### GET `/overview/qdrant`
**功能**：获取 Qdrant 状态

**响应字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `ready` | bool | Qdrant 是否就绪 |
| `host` | string | Qdrant 主机 |
| `port` | int | Qdrant 端口 |
| `collection` | string | 集合名称 |
| `top_k` | int | 默认 top_k |
| `disk_size` | int | 存储目录大小（字节） |
| `storage_path` | string | 存储路径 |

### GET `/overview/flask`
**功能**：获取 Flask 运行状态

**响应字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `pid` | int | Flask 进程 ID |
| `port` | int | Flask 端口 |
| `uptime` | float | 运行时长（秒） |
| `reload` | bool | 是否热重载模式 |

### GET `/overview/system-info`
**功能**：获取详细硬件信息

**响应字段**：
| 字段 | 说明 |
|------|------|
| `cpu_percent` | CPU 使用率 |
| `memory_percent` | 内存使用率 |
| `gpu_name` | GPU 名称 |

### POST `/overview/flask/restart`
**功能**：手动重启 Flask（由 PM monitor 检测标志文件并执行重启）

**响应**：`{ "ok": true, "msg": "重启中...", "flag": "/path/to/.restart_flask" }`

### GET `/overview/db-status`
**功能**：检查统计数据库状态

**响应**：`{ "ok": true, "daily_stats_count": N, "stream_count": M, ... }`

### GET `/overview/model-info`
**功能**：检查本地模型文件状态

**响应**：
```json
{
  "local_models_dir": "E:\\Project\\AiBrain\\models",
  "model_name": "BAAI/bge-m3",
  "local_path": "E:\\Project\\AiBrain\\models\\BAAI_bge-m3",
  "local_available": true,
  "hf_cache_available": true,
  "embedding_dim": 1024
}
```

### POST `/overview/frontend/build`
**功能**：触发前端构建（后台执行，立即返回 build_id）

**响应**：`{ "build_id": "abc123", "status": "building" }`

### GET `/overview/frontend/build/status`
**功能**：轮询构建状态

**查询参数**：`build_id`

**响应**：`{ "build_id": "abc123", "status": "building"|"done"|"failed", "msg": "..." }`

## 内部函数

### `SystemInfoManager`（modules/SystemInfo/system_info_mod.py）
- `get_model_info()`：获取模型信息（名称、大小）
- `get_qdrant_info()`：获取 Qdrant 状态（磁盘大小、存储路径）
- `get_system_info()`：获取系统硬件信息
- `write_restart_flag()`：写入 Flask 重启标志文件
- `set_flask_start_time()`：设置 Flask 启动时间
- `get_flask_uptime()`：获取运行时长
- `has_nvidia_gpu()`：检测 GPU 硬件

## 前端集成
- **Overview 前端**：消费所有端点，更新各卡片状态
- **FlaskCard**：消费 `/overview/flask` 显示运行时长，重启调用 `/overview/flask/restart`

---
*最后更新: 2026-05-05*