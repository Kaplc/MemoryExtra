# 后端 - Statusbar 模块

## 概述
`statusbar_routes.py` 提供状态栏 API，返回模型/Qdrant/Flask 实时状态，供前端状态栏展示。

## 文件位置
```
backend/routes/statusbar_routes.py
```

## 路由注册
```python
def register(app, ready_state, logger, stats_db):
```
- `ready_state`：模型/Qdrant 就绪状态的共享字典引用
- `logger`：项目 logger 实例
- `stats_db`：统计数据库实例

## API 接口

### GET `/statusbar/api`
**功能**：获取系统核心状态（供前端状态栏和 Overview 卡片使用）

**响应字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| `model_loaded` | bool | embedding 模型是否已加载 |
| `qdrant_ready` | bool | Qdrant 是否就绪 |
| `device` | string | 当前设备（cpu/cuda） |
| `cuda_available` | bool | PyTorch CUDA 是否可用 |
| `gpu_hardware` | bool | 是否有 NVIDIA GPU 硬件（独立于 CUDA） |
| `gpu_name` | string/null | GPU 名称（CUDA 可用时） |
| `embedding_model` | string | embedding 模型名称 |
| `embedding_dim` | int | 向量维度（来自环境变量） |
| `model_size` | string | 模型参数量（B/M/K） |
| `qdrant_host` | string | Qdrant 主机 |
| `qdrant_port` | int | Qdrant 端口 |
| `qdrant_collection` | string | 集合名称 |
| `qdrant_top_k` | int | 默认 top_k |
| `qdrant_disk_size` | int | Qdrant 存储目录大小（字节） |
| `qdrant_storage_path` | string | 存储路径 |
| `flask_port` | int | Flask 端口（来自 FLASK_PORT 环境变量） |
| `flask_pid` | int | 当前 Flask 进程 PID |
| `flask_uptime` | float | Flask 运行时长（秒） |
| `flask_reload` | bool | 是否开启了 Flask reload 模式 |

## GPU 判断三状态
| cuda_available | gpu_hardware | 含义 |
|----------------|-------------|------|
| true | - | GPU 可用，CUDA 版 PyTorch 已安装 |
| false | true | 有 GPU 硬件但安装的是 CPU 版 PyTorch |
| false | false | 无 NVIDIA GPU |

## 内部函数

### `SystemInfoManager`（modules/SystemInfo/system_info_mod.py）
- `get_model_info()`：获取模型信息（名称、大小）
- `has_nvidia_gpu()`：检测系统是否有 NVIDIA GPU 硬件
- `get_qdrant_info()`：获取 Qdrant 状态（磁盘大小、存储路径）
- `get_flask_uptime()`：获取 Flask 运行时长
- `init_qdrant_cache()`：初始化 Qdrant 缓存

## 前端集成
- **Overview 前端**：消费 `/overview/model`, `/overview/qdrant`, `/overview/flask`, `/overview/system-info`
- **Status Store**：消费 `/statusbar/api` 供状态栏使用
- **Settings 前端**：消费 `gpu_hardware` 显示 GPU 安装警告

---
*最后更新: 2026-05-05*