"""
MCP Server - 暴露 search、store、update 工具
通过 Flask API 调用后端，不直接操作 Qdrant
"""
from fastmcp import FastMCP

from .tools import store_memory, search_memory, update_memory, update_memory_async

mcp = FastMCP("Qdrant Memory Server")


@mcp.tool()
def store(text: str, hit_ids: list = None) -> str:
    """Store a memory. hit_ids is a list of referenced memory IDs to increment hit_count.

    Args:
        text: The memory text to store
        hit_ids: List of existing memory IDs that were referenced (required)
    """
    return store_memory(text, hit_ids=hit_ids)


@mcp.tool()
def search(query: str) -> list[dict]:
    """Search memories by query. Returns results with decay_score.

    Args:
        query: The search query
    """
    return search_memory(query)


@mcp.tool()
def update(memory_id: str, new_text: str) -> str:
    """Update an existing memory by ID.

    Args:
        memory_id: The ID of the memory to update
        new_text: The new text content for the memory
    """
    return update_memory(memory_id, new_text)


@mcp.tool()
def update_async(memory_id: str, new_text: str) -> str:
    """Update an existing memory by ID (async, runs in background).

    Args:
        memory_id: The ID of the memory to update
        new_text: The new text content for the memory
    """
    return update_memory_async(memory_id, new_text)
