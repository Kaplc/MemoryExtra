from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    collection_name: str = "memories"
    embedding_model: str = "BAAI/bge-m3"
    embedding_dim: int = 1024
    top_k: int = 10
    score_threshold: float = 0.5

    class Config:
        env_prefix = "QDRANT_"


settings = Settings()

# 多实例支持：从环境变量或 .port_config 覆盖端口
import os
_http_port = os.environ.get('QDRANT_HTTP_PORT')
if not _http_port:
    # 从 .port_config 文件读取（start.bat 自动生成）
    _port_config = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.port_config'))
    if os.path.exists(_port_config):
        try:
            with open(_port_config, 'r') as f:
                parts = f.read().strip().split(',')
                if len(parts) >= 2:
                    _http_port = parts[1]
        except Exception:
            pass
if _http_port:
    settings.qdrant_port = int(_http_port)
