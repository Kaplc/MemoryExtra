"""
Wiki 配置管理
配置文件：~/.aibrain/config/wiki.json（首次使用自动创建）
"""
import os
import json
import logging

logger = logging.getLogger(__name__)

# 项目根目录（rag/ 的上一级，即 AiBrain 项目根目录）
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _get_config_path():
    """获取配置文件路径：~/.aibrain/config/wiki.json"""
    return os.path.join(os.path.expanduser("~"), ".aibrain", "config", "wiki.json")


def _ensure_config_file():
    """检查配置文件是否存在，不存在则创建默认值"""
    config_path = _get_config_path()
    config_dir = os.path.dirname(config_path)

    if not os.path.exists(config_dir):
        os.makedirs(config_dir, exist_ok=True)

    if not os.path.exists(config_path):
        default_config = {
            "wiki_dir": "wiki",
            "lightrag_dir": "rag/lightrag_data",
            "language": "Chinese",
            "chunk_token_size": 1200,
            "llm": {
                "provider": "",
                "model": "",
                "api_key": "",
                "base_url": "",
            },
            "search_timeout": 30,
        }
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)
        logger.info(f"Created default wiki config: {config_path}")

    return config_path


def load_wiki_config() -> dict:
    """读取 wiki 配置"""
    config_path = _ensure_config_file()
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_wiki_dir() -> str:
    """获取 wiki 目录的绝对路径"""
    cfg = load_wiki_config()
    wiki_dir = cfg.get("wiki_dir", "wiki")
    if os.path.isabs(wiki_dir):
        return wiki_dir
    return os.path.join(PROJECT_ROOT, wiki_dir)


def get_lightrag_dir() -> str:
    """获取 LightRAG 数据目录的绝对路径"""
    cfg = load_wiki_config()
    lightrag_dir = cfg.get("lightrag_dir", "rag/lightrag_data")
    if os.path.isabs(lightrag_dir):
        return lightrag_dir
    return os.path.join(PROJECT_ROOT, lightrag_dir)


def get_index_meta_path() -> str:
    """获取索引元数据文件路径"""
    return os.path.join(get_lightrag_dir(), ".wiki_index_meta.json")
