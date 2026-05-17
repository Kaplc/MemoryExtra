"""
MCP Server - 只暴露 store 和 search 两个工具
mem0 全权管理记忆的存储、去重、更新、检索。
搜索策略由后端根据数据量自动适配（MCP 零配置）。
"""
import os
import logging
import urllib.request
import json
from fastmcp import FastMCP

logger = logging.getLogger('mcp_server')

from .tools import store_memory, search_memory, list_entities

_flask_port = os.environ.get('FLASK_PORT')
if not _flask_port:
    _port_config = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.port_config'))
    if os.path.exists(_port_config):
        with open(_port_config, 'r') as f:
            _flask_port = f.read().strip().split(',')[0]
_API_BASE = f"http://127.0.0.1:{_flask_port or '18765'}"


def _graph_call(entity_name: str) -> dict:
    """直接调用后端 /memory/graph/entity，不走 tools.py 避免递归"""
    logger.info(f"[mcp:entity_lookup] calling entity_name={entity_name!r}")
    data = json.dumps({"entity_name": entity_name}).encode()
    req = urllib.request.Request(
        _API_BASE + "/memory/graph/entity",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        logger.info(f"[mcp:entity_lookup] result={result}")
        return result


mcp = FastMCP("AiBrain Memory Server")


@mcp.tool()
def store(text: str, link_entities: list[str]) -> str:
    """存储记忆。LLM 自动从文本中提取事实并存储。

    Args:
        text: 记忆文本（可包含多个事实）
        link_entities: 必须，实体关联列表，每项格式「旧实体-新实体」。
            旧实体（Key）必须是图中已存在的实体，不存在会被跳过。
            新实体（Value）由 LLM 从文本中总结得出。
            例如：['用户-志远'] 表示将新实体「志远」关联到已有实体「用户」
    """
    if not link_entities or not isinstance(link_entities, list) or len(link_entities) == 0:
        raise ValueError("link_entities 为必选参数，格式：['旧实体-新实体']，旧实体必须已存在")
    return store_memory(text, link_entities)


@mcp.tool()
def search(query: str) -> dict:
    """搜索记忆，返回文本和相关性分数。Args: query=搜索关键词"""
    if not query or not query.strip():
        raise ValueError("搜索关键词不能为空")
    results = search_memory(query)
    return {"query": query, "results": results}


@mcp.tool()
def entity_lookup(entity_name: str) -> dict:
    """查询实体是否存在，返回该实体及其关联的记忆和实体。Args: entity_name=实体名称"""
    if not entity_name or not entity_name.strip():
        raise ValueError("实体名称不能为空")
    result = _graph_call(entity_name)
    if "error" in result:
        raise RuntimeError(result["error"])
    return result


@mcp.tool()
def list_entities() -> list[dict]:
    """列出所有根实体及其关联的记忆数量。返回实体名、类型、关联记忆数"""
    return list_entities()
