"""
MCP Server - 只暴露 store 和 search 两个工具
mem0 全权管理记忆的存储、去重、更新、检索。
搜索策略由后端根据数据量自动适配（MCP 零配置）。
"""
from fastmcp import FastMCP

from .tools import store_memory, search_memory

mcp = FastMCP("AiBrain Memory Server")


@mcp.tool()
def store(text: str) -> str:
    """Store a memory. LLM automatically extracts facts and stores them.
    Returns the actual stored text lines.

    Args:
        text: The memory text (can contain multiple facts; LLM will split them).
    """
    return store_memory(text)


@mcp.tool()
def search(query: str) -> list[dict]:
    """Search memories. Returns matching text with relevance scores.
    Backend auto-adapts strategy based on data volume.

    Args:
        query: The search query string.
    """
    return search_memory(query)
